/**
 * The demo as a CLI script (the fallback if an MCP client misbehaves live).
 * Needs the facilitator and paid API running, and the values from seed.ts in the env.
 *
 *   1. Paid call            /summary         0.01 to Merchant A        -> paid
 *   2. Too expensive        /premium-report  0.50                      -> OverRequestCap, recorded on-chain
 *   3. Approval             request_approval, owner approves, retry    -> paid once
 *   4. Untrusted merchant   /sketchy-data    Merchant C (unlisted)     -> refused on-chain
 *   5. Kill switch          freeze_all, then /summary                  -> Frozen; unfreeze after
 *   6. History              read back from the chain
 */
import { Connection, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

import {
  fetchHistory,
  fetchPendings,
  fetchSession,
  formatUsdc,
  getProgram,
  parseUsdc,
  pendingStatus,
  requestApprovalIx,
  resolvePendingIx,
  sessionPda,
  setFrozenIx,
  toBN,
  vaultPda,
} from "../packages/client/src/index";
import { payX402, type AgentContext, type PayResult } from "../packages/client/src/agent";
import { loadDotEnv, pubkeyEnv, readKeypair, required, usdcMint } from "../packages/client/src/env";

loadDotEnv();
loadDotEnv(".env.seed");

const API = process.env.PAID_API_URL ?? "http://localhost:4021";
const conn = new Connection(required("RPC_URL"), "confirmed");
const program = getProgram(conn);
const owner = readKeypair(process.env.OWNER_KEYPAIR ?? "keys/owner.json");
const agent = readKeypair(required("AGENT_KEYPAIR"));
const ctx: AgentContext = { connection: conn, program, agent, owner: owner.publicKey, mint: usdcMint() };
const vault = vaultPda(owner.publicKey);
const session = sessionPda(vault, agent.publicKey);

let failures = 0;
function show(step: string, r: PayResult, expect: PayResult["status"], rule?: string) {
  const good = r.status === expect && (!rule || (r.status === "refused" && r.rule === rule));
  if (!good) failures++;
  const detail =
    r.status === "paid"
      ? `paid ${r.amount} ${r.link ?? ""}`
      : r.status === "refused"
        ? `refused ${r.rule} ${r.link ?? "(not recorded)"}`
        : r.status === "error"
          ? `error ${r.message}`
          : "free";
  console.log(`${good ? "PASS" : "FAIL"}  ${step}: ${detail}`);
}

async function ownerSends(tx: Transaction) {
  return sendAndConfirmTransaction(conn, tx, [owner]);
}

async function main() {
  show(
    "1 paid call",
    await payX402(ctx, `${API}/summary?url=https://example.com`, "Summarize example.com for the user"),
    "paid",
  );

  show(
    "2 over the per-request cap",
    await payX402(ctx, `${API}/premium-report`, "Full premium report for the quarterly review", {
      useApprovedRequest: false,
    }),
    "refused",
    "OverRequestCap",
  );

  // 3. approval: agent asks, owner approves, agent retries with the voucher
  const s = await fetchSession(program, session);
  const { ix, pending } = await requestApprovalIx(program, {
    agent: agent.publicKey,
    owner: owner.publicKey,
    merchant: pubkeyEnv("MERCHANT_A"),
    amount: toBN(parseUsdc("0.5")),
    reason: "Full premium report for the quarterly review",
    nonce: s!.pendingNonce,
  });
  await sendAndConfirmTransaction(conn, new Transaction().add(ix), [agent]);
  await ownerSends(new Transaction().add(await resolvePendingIx(program, owner.publicKey, session, pending, true)));
  show(
    "3 premium report after approval",
    await payX402(ctx, `${API}/premium-report`, "Full premium report for the quarterly review"),
    "paid",
  );
  const used = (await fetchPendings(program, vault)).find((p) => p.address.equals(pending));
  console.log(`      voucher status: ${used ? pendingStatus(used.account) : "missing"}`);

  const r4 = await payX402(ctx, `${API}/sketchy-data`, "Pull data from an unknown provider");
  show("4 unlisted merchant without trusted reputation", r4, "refused");

  // 5. kill switch
  await ownerSends(new Transaction().add(await setFrozenIx(program, owner.publicKey, true)));
  show("5 call while frozen", await payX402(ctx, `${API}/summary?url=https://example.com`, "Try while frozen"), "refused", "Frozen");
  await ownerSends(new Transaction().add(await setFrozenIx(program, owner.publicKey, false)));

  // 6. history from the chain
  const { rows } = await fetchHistory(conn, program, session, { limit: 20 });
  console.log("\nhistory (newest first, read from the chain):");
  for (const r of rows) {
    console.log(
      `  ${r.ok ? "ok     " : "REFUSED"} ${r.kind.padEnd(16)} ${r.amount !== null ? formatUsdc(r.amount).padStart(5) : "     "} ` +
        `${(r.error ?? "").padEnd(16)} fee:${r.feePayer.slice(0, 4)} ${r.reason ?? ""}`,
    );
  }

  const after = await fetchSession(program, session);
  console.log(`\nspent today ${formatUsdc(after!.spentToday.toString())} of ${formatUsdc(after!.dailyCap.toString())}`);
  console.log(failures ? `\n${failures} step(s) FAILED` : "\nall demo steps behaved as expected");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
