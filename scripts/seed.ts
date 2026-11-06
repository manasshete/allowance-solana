/**
 * Sets up everything the demo needs, on localnet or devnet:
 *   keys/{owner,agent,facilitator,merchant-a,merchant-b,merchant-c}.json (created if missing)
 *   SOL for owner, agent and facilitator (airdrop; on devnet fund them by hand if rate-limited)
 *   a 6-decimal test token (unless USDC_MINT is set), 100 to the owner, token accounts for the merchants
 *   the owner's vault with 20 deposited, and a session for the agent:
 *     0.05 per request, 2/day, Merchant A listed at 1/day, others 0.5/day at reputation 70+, 24 h
 * Writes the resulting values to .env.seed (merge into .env).
 *
 *   RPC_URL=http://localhost:8899 npx tsx scripts/seed.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  createSessionIx,
  fetchSession,
  fetchVault,
  getProgram,
  initVaultIx,
  moveFundsIx,
  parseUsdc,
  sessionPda,
  toBN,
  vaultPda,
} from "../packages/client/src/index";
import { loadDotEnv, readKeypair } from "../packages/client/src/env";

loadDotEnv();
const RPC = process.env.RPC_URL ?? "http://localhost:8899";
const KEYS = process.env.KEYS_DIR ?? "keys";
const conn = new Connection(RPC, "confirmed");
const program = getProgram(conn);
const usdc = (s: string) => toBN(parseUsdc(s));

function key(name: string): Keypair {
  const path = join(KEYS, `${name}.json`);
  if (existsSync(path)) return readKeypair(path);
  mkdirSync(KEYS, { recursive: true });
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`created ${path} ${kp.publicKey.toBase58()}`);
  return kp;
}

async function fund(kp: Keypair, sol: number) {
  const have = await conn.getBalance(kp.publicKey);
  if (have >= sol * LAMPORTS_PER_SOL * 0.5) return;
  if (!/localhost|127\.0\.0\.1/.test(RPC)) {
    // devnet's RPC faucet is closed; fund from a wallet you control (see scripts/docker/e2e-devnet.sh)
    if (have < 0.05 * LAMPORTS_PER_SOL)
      console.warn(`${kp.publicKey.toBase58()} has ${have / LAMPORTS_PER_SOL} SOL; fund it at https://faucet.solana.com`);
    return;
  }
  try {
    const sig = await conn.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    console.log(`airdropped ${sol} SOL to ${kp.publicKey.toBase58()}`);
  } catch (e) {
    console.warn(`airdrop to ${kp.publicKey.toBase58()} failed (${(e as Error).message}); fund it by hand`);
  }
}

async function main() {
  const owner = key("owner");
  const agent = key("agent");
  const facilitator = key("facilitator");
  const [a, b, c] = ["merchant-a", "merchant-b", "merchant-c"].map(key);

  await fund(owner, 5);
  await fund(agent, 1);
  await fund(facilitator, 1);

  // token: an existing mint (USDC_MINT) or a fresh 6-decimal test token
  let mint: PublicKey;
  if (process.env.USDC_MINT) {
    mint = new PublicKey(process.env.USDC_MINT);
    console.log(`using mint ${mint.toBase58()}`);
  } else {
    const mintKp = Keypair.generate();
    mint = mintKp.publicKey;
    const ownerAta = getAssociatedTokenAddressSync(mint, owner.publicKey);
    await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: owner.publicKey,
          newAccountPubkey: mint,
          lamports: await getMinimumBalanceForRentExemptMint(conn),
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mint, 6, owner.publicKey, null),
        createAssociatedTokenAccountIdempotentInstruction(owner.publicKey, ownerAta, owner.publicKey, mint),
        createMintToInstruction(mint, ownerAta, owner.publicKey, 100_000_000n),
      ),
      [owner, mintKp],
    );
    console.log(`created test token ${mint.toBase58()} (6 decimals), 100 to the owner`);
  }

  // token accounts for the merchants (x402 pays to payTo's ATA)
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      ...[a, b, c].map((m) =>
        createAssociatedTokenAccountIdempotentInstruction(
          owner.publicKey,
          getAssociatedTokenAddressSync(mint, m.publicKey),
          m.publicKey,
          mint,
        ),
      ),
    ),
    [owner],
  );

  // vault + deposit
  const vault = vaultPda(owner.publicKey);
  if (!(await fetchVault(program, vault))) {
    await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        await initVaultIx(program, { owner: owner.publicKey, mint }),
        await moveFundsIx(program, "deposit", {
          owner: owner.publicKey,
          mint,
          ownerAta: getAssociatedTokenAddressSync(mint, owner.publicKey),
          amount: usdc("20"),
        }),
      ),
      [owner],
    );
    console.log(`vault ${vault.toBase58()} created with 20 deposited`);
  }

  // session for the agent
  const session = sessionPda(vault, agent.publicKey);
  if (!(await fetchSession(program, session))) {
    const now = Math.floor(Date.now() / 1000);
    await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        await createSessionIx(program, owner.publicKey, agent.publicKey, {
          perRequestCap: usdc("0.05"),
          dailyCap: usdc("2"),
          otherDailyCap: usdc("0.5"),
          minReputation: 70,
          expiresAt: toBN(now + 24 * 3600),
          merchants: [{ merchant: a.publicKey, label: "Merchant A", dailyCap: usdc("1") }],
        }),
      ),
      [owner],
    );
    console.log(`session ${session.toBase58()} created for agent ${agent.publicKey.toBase58()}`);
  }

  const env = [
    `RPC_URL=${RPC}`,
    `USDC_MINT=${mint.toBase58()}`,
    `OWNER=${owner.publicKey.toBase58()}`,
    `AGENT_KEYPAIR=${join(KEYS, "agent.json")}`,
    `FACILITATOR_KEYPAIR=${join(KEYS, "facilitator.json")}`,
    `MERCHANT_A=${a.publicKey.toBase58()}`,
    `MERCHANT_B=${b.publicKey.toBase58()}`,
    `MERCHANT_C=${c.publicKey.toBase58()}`,
  ].join("\n");
  writeFileSync(".env.seed", env + "\n");
  console.log(`\nwrote .env.seed:\n${env}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
