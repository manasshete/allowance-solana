/**
 * The agent side of an x402 payment through Allowance (server-side only).
 *
 * payX402():
 *   1. GET the URL. Not 402 -> return the body.
 *   2. Read the PAYMENT-REQUIRED terms; pick the Solana `exact` option in our token.
 *   3. Build a v0 transaction: compute budget + agent_pay(price, reason) to payTo,
 *      fee payer = the facilitator (extra.feePayer). The agent signs its part.
 *   4. Simulate. If an Allowance rule refuses it, record the refusal on-chain
 *      (same instruction, agent pays the fee, skipPreflight) and return the rule.
 *   5. Otherwise retry the GET with PAYMENT-SIGNATURE; the facilitator verifies,
 *      co-signs and settles, and PAYMENT-RESPONSE carries the signature.
 */
import type { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";

import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { explorerTx } from "./constants";
import { describeRefusal, extractError, type AllowanceErrorName } from "./errors";
import { scoreFromAtomStats } from "./reputation";
import { agentPayIx, fetchPendings, fetchSession, pendingStatus, type Allowance } from "./program";
import { merchantAta, sessionPda, vaultPda } from "./pda";
import { formatUsdc } from "./units";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const CU_LIMIT = 120_000;
const CU_PRICE_MICROLAMPORTS = 1_000;

export type AgentContext = {
  connection: Connection;
  program: Program<Allowance>;
  agent: Keypair;
  owner: PublicKey;
  mint: PublicKey;
  /** payTo wallet -> Agent Registry accounts, for merchants the session doesn't list. */
  reputationFor?: (merchant: PublicKey) => Promise<{ registryAgent: PublicKey; atomStats: PublicKey } | null>;
};

export type PayResult =
  | { status: "free"; body: string }
  | { status: "paid"; body: string; amount: string; merchant: string; signature: string | null; link: string | null }
  | {
      status: "refused";
      rule: AllowanceErrorName | null;
      message: string;
      amount: string;
      merchant: string;
      signature: string | null;
      link: string | null;
    }
  | { status: "error"; message: string };

type Requirements = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { feePayer?: string } & Record<string, unknown>;
};

export async function payX402(
  ctx: AgentContext,
  url: string,
  reason: string,
  opts: { useApprovedRequest?: boolean } = {},
): Promise<PayResult> {
  const probe = await fetch(url);
  if (probe.status !== 402) return { status: "free", body: await probe.text() };

  const header = probe.headers.get("PAYMENT-REQUIRED");
  if (!header) return { status: "error", message: "402 without a PAYMENT-REQUIRED header" };
  const required = decodePaymentRequiredHeader(header);
  const req = (required.accepts as Requirements[]).find(
    (a) => a.scheme === "exact" && a.network === SOLANA_DEVNET && a.asset === ctx.mint.toBase58(),
  );
  if (!req) return { status: "error", message: "No Solana devnet option in our token" };
  if (!req.extra?.feePayer) return { status: "error", message: "The API's facilitator gave no fee payer" };

  const merchant = new PublicKey(req.payTo);
  const amount = new BN(req.amount);
  const human = formatUsdc(req.amount);

  // An approved over-cap request for exactly this merchant and amount is used once.
  const pending = opts.useApprovedRequest === false ? null : await findApprovedPending(ctx, merchant, amount);
  const reputation = (await isListed(ctx, merchant)) ? null : ((await ctx.reputationFor?.(merchant)) ?? null);

  const ix = await agentPayIx(ctx.program, {
    agent: ctx.agent.publicKey,
    owner: ctx.owner,
    mint: ctx.mint,
    merchant,
    amount,
    reason,
    reputation,
    pending,
  });

  const feePayer = new PublicKey(req.extra.feePayer);
  const tx = await buildTx(ctx.connection, feePayer, [ix]);
  tx.sign([ctx.agent]); // the facilitator adds the fee payer signature on settle

  const sim = await ctx.connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
  if (sim.value.err) {
    const rule = extractError(sim.value.err, sim.value.logs);
    const recorded = await recordRefusal(ctx, ix);
    return {
      status: "refused",
      rule,
      message: rule
        ? `Refused by the chain: ${await explain(ctx, rule, amount, merchant, reputation)} (${rule})`
        : `Simulation failed: ${JSON.stringify(sim.value.err)}`,
      amount: human,
      merchant: merchant.toBase58(),
      signature: recorded,
      link: recorded ? explorerTx(recorded) : null,
    };
  }

  const payload = {
    x402Version: 2,
    resource: required.resource,
    accepted: req,
    payload: { transaction: Buffer.from(tx.serialize()).toString("base64") },
  };
  const paid = await fetch(url, { headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload as never) } });
  const body = await paid.text();
  if (!paid.ok) return { status: "error", message: `Payment not accepted (${paid.status}): ${body.slice(0, 300)}` };

  const respHeader = paid.headers.get("PAYMENT-RESPONSE");
  const signature = respHeader ? (decodePaymentResponseHeader(respHeader).transaction ?? null) : null;
  return {
    status: "paid",
    body,
    amount: human,
    merchant: merchant.toBase58(),
    signature,
    link: signature ? explorerTx(signature) : null,
  };
}

/**
 * Sends the refused instruction with the agent as fee payer and no preflight,
 * so the refusal lands on-chain as a failed transaction carrying the rule's error code.
 * Costs the agent ~0.000005 SOL. Enforcement doesn't depend on this; it's the audit trail.
 */
export async function recordRefusal(ctx: AgentContext, ix: TransactionInstruction): Promise<string | null> {
  try {
    const tx = await buildTx(ctx.connection, ctx.agent.publicKey, [ix]);
    tx.sign([ctx.agent]);
    const sig = await ctx.connection.sendTransaction(tx, { skipPreflight: true, maxRetries: 3 });
    await ctx.connection.confirmTransaction(sig, "confirmed").catch(() => undefined);
    return sig;
  } catch {
    return null;
  }
}

/** Direct payment to a listed merchant (the MCP `transfer` tool). Agent pays the fee. */
export async function payDirect(
  ctx: AgentContext,
  merchant: PublicKey,
  amount: BN,
  reason: string,
): Promise<Exclude<PayResult, { status: "free" }>> {
  const human = formatUsdc(amount.toString());
  const pending = await findApprovedPending(ctx, merchant, amount);
  const reputation = (await isListed(ctx, merchant)) ? null : ((await ctx.reputationFor?.(merchant)) ?? null);
  const ix = await agentPayIx(ctx.program, {
    agent: ctx.agent.publicKey,
    owner: ctx.owner,
    mint: ctx.mint,
    merchant,
    amount,
    reason,
    reputation,
    pending,
  });
  const ata = merchantAta(merchant, ctx.mint);
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    ctx.agent.publicKey,
    ata,
    merchant,
    ctx.mint,
  );
  const tx = await buildTx(ctx.connection, ctx.agent.publicKey, [createAtaIx, ix]);
  tx.sign([ctx.agent]);
  const sig = await ctx.connection.sendTransaction(tx, { skipPreflight: true, maxRetries: 3 });
  const conf = await ctx.connection.confirmTransaction(sig, "confirmed");
  if (conf.value.err) {
    const t = await ctx.connection.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    const rule = extractError(conf.value.err, t?.meta?.logMessages);
    return {
      status: "refused",
      rule,
      message: rule
        ? `Refused by the chain: ${await explain(ctx, rule, amount, merchant, reputation)} (${rule})`
        : "Refused by the chain.",
      amount: human,
      merchant: merchant.toBase58(),
      signature: sig,
      link: explorerTx(sig),
    };
  }
  return { status: "paid", body: "", amount: human, merchant: merchant.toBase58(), signature: sig, link: explorerTx(sig) };
}

async function buildTx(connection: Connection, feePayer: PublicKey, ixs: TransactionInstruction[]) {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE_MICROLAMPORTS }),
      ...ixs,
    ],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** The refusal sentence with the session's real numbers (a refused transaction changes nothing on-chain). */
async function explain(
  ctx: AgentContext,
  rule: AllowanceErrorName,
  amount: BN,
  merchant: PublicKey,
  reputation: { atomStats: PublicKey } | null,
): Promise<string> {
  const session = await fetchSession(ctx.program, sessionPda(vaultPda(ctx.owner), ctx.agent.publicKey)).catch(() => null);
  let score: number | null = null;
  if (rule === "LowReputation" && reputation) {
    const acc = await ctx.connection.getAccountInfo(reputation.atomStats).catch(() => null);
    score = acc ? scoreFromAtomStats(acc.data) : null;
  }
  return describeRefusal(rule, { amount: BigInt(amount.toString()), session, merchant: merchant.toBase58(), score });
}

async function isListed(ctx: AgentContext, merchant: PublicKey) {
  const s = await fetchSession(ctx.program, sessionPda(vaultPda(ctx.owner), ctx.agent.publicKey));
  return !!s?.merchants.some((m) => m.merchant.equals(merchant));
}

async function findApprovedPending(ctx: AgentContext, merchant: PublicKey, amount: BN) {
  const session = sessionPda(vaultPda(ctx.owner), ctx.agent.publicKey);
  const s = await fetchSession(ctx.program, session);
  if (!s) return null;
  // only approvals of this session instance: a recreated session keeps its address,
  // and the program refuses vouchers whose PDA was derived from an earlier created_at
  const mine = pendingPda(session, s.createdAt, null);
  const all = await fetchPendings(ctx.program, vaultPda(ctx.owner));
  const hit = all.find(
    (p) =>
      p.account.session.equals(session) &&
      mine(p.account.nonce).equals(p.address) &&
      p.account.merchant.equals(merchant) &&
      p.account.amount.eq(amount) &&
      pendingStatus(p.account) === "approved",
  );
  return hit?.address ?? null;
}
