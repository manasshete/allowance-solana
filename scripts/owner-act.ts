/**
 * Owner actions from the command line, signed with OWNER_KEYPAIR (default keys/owner.json).
 * The dashboard does the same with the owner's wallet; this is for demos and recordings.
 *   npx tsx scripts/owner-act.ts approve|reject   resolve every open approval request
 *   npx tsx scripts/owner-act.ts freeze|unfreeze  the kill switch
 */
import { Connection, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

import { fetchPendings, getProgram, pendingStatus, resolvePendingIx, setFrozenIx, vaultPda } from "../packages/client/src/index";
import { loadDotEnv, readKeypair, rpcUrl } from "../packages/client/src/env";

loadDotEnv();

async function main() {
  const action = process.argv[2];
  const owner = readKeypair(process.env.OWNER_KEYPAIR ?? "keys/owner.json");
  const conn = new Connection(rpcUrl(), "confirmed");
  const program = getProgram(conn);
  const send = async (tx: Transaction, what: string) => {
    const sig = await sendAndConfirmTransaction(conn, tx, [owner]);
    console.log(`${what}: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  };

  if (action === "freeze" || action === "unfreeze") {
    await send(new Transaction().add(await setFrozenIx(program, owner.publicKey, action === "freeze")), action);
  } else if (action === "approve" || action === "reject") {
    const open = (await fetchPendings(program, vaultPda(owner.publicKey))).filter((p) => pendingStatus(p.account) === "open");
    if (!open.length) console.log("no open approval requests");
    for (const p of open) {
      const ix = await resolvePendingIx(program, owner.publicKey, p.account.session, p.address, action === "approve");
      await send(new Transaction().add(ix), `${action} ${p.address.toBase58()}`);
    }
  } else {
    throw new Error("usage: owner-act.ts approve|reject|freeze|unfreeze");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
