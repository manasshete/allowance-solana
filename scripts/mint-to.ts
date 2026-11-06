/**
 * Mints the demo test token to a wallet (creating its token account), so that wallet
 * can create a vault and deposit from the dashboard. Signed by the mint authority,
 * keys/owner.json (the seed script's owner).
 *
 *   npx tsx scripts/mint-to.ts <wallet> [amount=100]
 *   env: RPC_URL, MINT (default: DEMO_MINT from keys/demo-mint.env)
 */
import { readFileSync } from "node:fs";

import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

import { formatUsdc, parseUsdc } from "../packages/client/src/index";
import { fromRoot, readKeypair } from "../packages/client/src/env";

const [walletArg, amountArg = "100"] = process.argv.slice(2);
if (!walletArg) {
  console.error("usage: npx tsx scripts/mint-to.ts <wallet> [amount]");
  process.exit(1);
}
const demoMint = (() => {
  try {
    return /DEMO_MINT=(\w+)/.exec(readFileSync(fromRoot("keys/demo-mint.env"), "utf8"))?.[1];
  } catch {
    return undefined;
  }
})();
const mintStr = process.env.MINT ?? demoMint;
if (!mintStr) throw new Error("No mint: set MINT or run scripts/docker/e2e-devnet.sh once");

const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const authority = readKeypair(process.env.MINT_AUTHORITY ?? "keys/owner.json");
const wallet = new PublicKey(walletArg);
const mint = new PublicKey(mintStr);
const ata = getAssociatedTokenAddressSync(mint, wallet);
const amount = parseUsdc(amountArg);

async function main() {
  const sig = await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, wallet, mint),
      createMintToInstruction(mint, ata, authority.publicKey, amount),
    ),
    [authority],
  );
  const bal = await conn.getTokenAccountBalance(ata);
  console.log(`minted ${formatUsdc(amount)} of ${mint.toBase58()} to ${wallet.toBase58()} (balance ${bal.value.uiAmountString})`);
  console.log(`tx ${sig}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
