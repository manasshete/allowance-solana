import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PublicKey } from "@solana/web3.js";
import type { z as Zod } from "zod";

import {
  explorerTx,
  fetchHistory,
  fetchPending,
  fetchPendings,
  fetchSession,
  fetchVault,
  formatUsdc,
  parseUsdc,
  pendingStatus,
  requestApprovalIx,
  sessionPda,
  toBN,
  vaultAta,
  vaultPda,
} from "@allowance/client";
import { payDirect, payX402, type AgentContext } from "@allowance/client/agent";

import { resolveRecipient, type MerchantInfo } from "./context";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (o: unknown) => text(JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
const DASHBOARD = () => process.env.DASHBOARD_URL ?? "http://localhost:3100";

export function registerTools(server: McpServer, ctx: AgentContext, merchants: Record<string, MerchantInfo>, z: typeof Zod) {
  const vault = vaultPda(ctx.owner);
  const session = sessionPda(vault, ctx.agent.publicKey);
  const label = (addr: string) => merchants[addr]?.label ?? addr;

  /** Every tool refuses with the same sentence until the owner has created a session for this agent key. */
  const guard = async () => {
    const s = await fetchSession(ctx.program, session).catch(() => null);
    return s
      ? null
      : text(`No session for agent ${ctx.agent.publicKey.toBase58()}. Create one in the dashboard (${DASHBOARD()}/app/sessions/new).`);
  };

  server.registerTool(
    "get_allowance",
    {
      title: "Get allowance",
      description:
        "What you may still spend: vault balance, per-request cap, today's spend against each cap, expiry, and whether the owner froze or revoked you.",
      inputSchema: {},
    },
    async () => {
      const blocked = await guard();
      if (blocked) return blocked;
      const [v, s, bal] = await Promise.all([
        fetchVault(ctx.program, vault),
        fetchSession(ctx.program, session),
        ctx.connection.getTokenAccountBalance(vaultAta(vault, ctx.mint)).catch(() => null),
      ]);
      if (!v || !s) return text("No session for this agent yet. Ask the owner to create one in the dashboard.");
      const now = Math.floor(Date.now() / 1000);
      return json({
        vault_balance: bal?.value.uiAmountString ?? "unknown",
        frozen: v.frozen,
        revoked: s.revoked,
        expires_in_minutes: Math.max(0, Math.floor((s.expiresAt.toNumber() - now) / 60)),
        per_request_cap: formatUsdc(s.perRequestCap.toString()),
        spent_today: `${formatUsdc(s.spentToday.toString())} of ${formatUsdc(s.dailyCap.toString())}`,
        listed_merchants: s.merchants.map((m) => ({
          name: m.label || label(m.merchant.toBase58()),
          address: m.merchant.toBase58(),
          spent_today: `${formatUsdc(m.spentToday.toString())} of ${formatUsdc(m.dailyCap.toString())}`,
        })),
        unlisted_merchants:
          s.otherDailyCap.isZero()
            ? "not allowed"
            : `${formatUsdc(s.otherSpentToday.toString())} of ${formatUsdc(s.otherDailyCap.toString())} today, reputation ${s.minReputation}+ required`,
      });
    },
  );

  server.registerTool(
    "pay_x402",
    {
      title: "Call a paid API",
      description:
        "Fetch a URL that may charge via HTTP 402 (x402). If it asks for payment, pays through the Allowance program, which enforces the owner's caps on-chain. Always give an honest one-line reason; it is stored on-chain with the payment.",
      inputSchema: {
        url: z.string().url().describe("The full URL to fetch"),
        reason: z.string().min(1).max(200).describe("Why this call is needed, for the owner's audit trail"),
      },
    },
    async ({ url, reason }) => {
      const blocked = await guard();
      if (blocked) return blocked;
      const r = await payX402(ctx, url, reason);
      switch (r.status) {
        case "free":
          return text(r.body);
        case "paid":
          return text(`Paid ${r.amount} to ${label(r.merchant)}. Transaction: ${r.link ?? "pending"}\n\n${r.body}`);
        case "refused":
          return text(
            `${r.message}\nThe refusal is recorded on-chain: ${r.link ?? "not recorded"}\n` +
              (r.rule === "OverRequestCap" ? "You can ask the owner with request_approval." : ""),
          );
        case "error":
          return text(`Could not pay: ${r.message}`);
      }
    },
  );

  server.registerTool(
    "transfer",
    {
      title: "Pay a contact",
      description: "Send USDC from the allowance to a contact (by name) or address. The program applies the same caps.",
      inputSchema: {
        to: z.string().describe("Contact name like 'alice' or a Solana address"),
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/).describe("Amount in USDC, e.g. 0.05"),
        reason: z.string().min(1).max(200),
      },
    },
    async ({ to, amount, reason }) => {
      const blocked = await guard();
      if (blocked) return blocked;
      const dest = resolveRecipient(to, merchants);
      if (!dest) return text(`Unknown recipient "${to}".`);
      const r = await payDirect(ctx, dest, toBN(parseUsdc(amount)), reason);
      return r.status === "paid"
        ? text(`Sent ${r.amount} to ${label(r.merchant)}. Transaction: ${r.link}`)
        : text(`${"message" in r ? r.message : "Failed"}${"link" in r && r.link ? `\nRecorded on-chain: ${r.link}` : ""}`);
    },
  );

  server.registerTool(
    "request_approval",
    {
      title: "Ask the owner for an over-cap payment",
      description:
        "When a payment is over the per-request cap, create an on-chain approval request. The owner approves it in the dashboard; then retry the same payment and it goes through once.",
      inputSchema: {
        to: z.string().describe("The payTo address from the refused payment, or a contact name"),
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
        reason: z.string().min(1).max(200),
      },
    },
    async ({ to, amount, reason }) => {
      const blocked = await guard();
      if (blocked) return blocked;
      const dest = resolveRecipient(to, merchants);
      if (!dest) return text(`Unknown recipient "${to}".`);
      const s = await fetchSession(ctx.program, session);
      if (!s) return text("No session for this agent.");
      const { ix, pending } = await requestApprovalIx(ctx.program, {
        agent: ctx.agent.publicKey,
        owner: ctx.owner,
        merchant: dest,
        amount: toBN(parseUsdc(amount)),
        reason,
        nonce: s.pendingNonce,
        createdAt: s.createdAt,
      });
      const { Transaction } = await import("@solana/web3.js");
      const tx = new Transaction().add(ix);
      const sig = await ctx.connection.sendTransaction(tx, [ctx.agent], { skipPreflight: false });
      await ctx.connection.confirmTransaction(sig, "confirmed");
      return text(
        `Approval requested (${amount} to ${label(dest.toBase58())}). Pending: ${pending.toBase58()}\n` +
          `The owner can approve it at ${DASHBOARD()}/app/approvals/${pending.toBase58()}\nTransaction: ${explorerTx(sig)}`,
      );
    },
  );

  server.registerTool(
    "check_approval",
    {
      title: "Check an approval request",
      description: "Status of an approval request: open, approved, rejected or used.",
      inputSchema: { pending: z.string().describe("The pending address from request_approval") },
    },
    async ({ pending }) => {
      const blocked = await guard();
      if (blocked) return blocked;
      const p = await fetchPending(ctx.program, new PublicKey(pending));
      if (!p) return text("No such request.");
      return json({
        status: pendingStatus(p),
        amount: formatUsdc(p.amount.toString()),
        to: label(p.merchant.toBase58()),
        reason: p.reason,
      });
    },
  );

  server.registerTool(
    "check_merchant",
    {
      title: "Check a merchant",
      description: "Whether the session lists this merchant, its daily cap, and whether the reputation gate applies.",
      inputSchema: { address: z.string() },
    },
    async ({ address }) => {
      const blocked = await guard();
      if (blocked) return blocked;
      const dest = resolveRecipient(address, merchants);
      if (!dest) return text(`Not an address or known contact: ${address}`);
      const s = await fetchSession(ctx.program, session);
      const listed = s?.merchants.find((m) => m.merchant.equals(dest));
      const info = merchants[dest.toBase58()];
      return json({
        name: info?.label ?? null,
        listed: !!listed,
        cap: listed
          ? `${formatUsdc(listed.spentToday.toString())} of ${formatUsdc(listed.dailyCap.toString())} today`
          : s && !s.otherDailyCap.isZero()
            ? `shared unlisted cap, reputation ${s.minReputation}+ checked on-chain`
            : "unlisted merchants are not allowed",
        registry_asset: info?.asset ?? null,
      });
    },
  );

  server.registerTool(
    "get_history",
    {
      title: "Payment history",
      description: "Recent payments and refusals of this session, read from the chain.",
      inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
    },
    async ({ limit }) => {
      const blocked = await guard();
      if (blocked) return blocked;
      const { rows } = await fetchHistory(ctx.connection, ctx.program, session, { limit });
      const pend = await fetchPendings(ctx.program, vault);
      return json({
        history: rows.map((r) => ({
          when: r.time ? new Date(r.time * 1000).toISOString() : null,
          what: r.kind,
          result: r.ok ? "ok" : `refused: ${r.error ?? "unknown"}`,
          to: r.merchant ? label(r.merchant) : null,
          amount: r.amount !== null ? formatUsdc(r.amount) : null,
          reason: r.reason,
          link: explorerTx(r.signature),
        })),
        open_approvals: pend.filter((p) => pendingStatus(p.account) === "open").length,
      });
    },
  );
}
