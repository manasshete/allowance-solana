/**
 * Registers the demo merchants in the 8004 Agent Registry on devnet, so the reputation
 * gate in agent_pay has real data: Merchant B with good feedback, Merchant C with poor.
 *
 *   npx tsx scripts/register-merchants.ts
 *
 * Owner and fee payer: keys/deployer.json. Merchant wallets: keys/merchant-b.json, keys/merchant-c.json
 * (bound to each agent with the registry's Ed25519-verified setAgentWallet).
 * Reviewers: three fresh wallets in keys/reviewer-*.json, funded from the deployer.
 * Writes keys/registry.json and merges labels + assets into config/merchants.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
// 8004-solana is ESM-only; these scripts run as CommonJS, so it is loaded with import() in main().
type SDK = import("8004-solana").SolanaSDK;

import { fetchReputation } from "../packages/client/src/index";
import { fromRoot, readKeypair } from "../packages/client/src/env";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const deployer = readKeypair("keys/deployer.json");

const MERCHANTS = [
  { key: "merchant-b", label: "Merchant B", scores: [92, 88, 95] },
  { key: "merchant-c", label: "Merchant C", scores: [25, 30, 20] },
] as const;

function keyFile(name: string): Keypair {
  const path = fromRoot(`keys/${name}.json`);
  if (existsSync(path)) return readKeypair(path);
  mkdirSync(fromRoot("keys"), { recursive: true });
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function fund(to: PublicKey, sol: number) {
  if ((await conn.getBalance(to)) >= sol * LAMPORTS_PER_SOL * 0.5) return;
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) })),
    [deployer],
  );
}

let sdkFor: (signer: Keypair) => SDK;

async function main() {
  const { SolanaSDK } = await import("8004-solana");
  sdkFor = (signer) => new SolanaSDK({ cluster: "devnet", rpcUrl: RPC, signer });
  const registryPath = fromRoot("keys/registry.json");
  const saved: Record<string, { asset: string; wallet: string }> = existsSync(registryPath)
    ? JSON.parse(readFileSync(registryPath, "utf8"))
    : {};

  const reviewers = [0, 1, 2].map((i) => keyFile(`reviewer-${i}`));
  for (const r of reviewers) await fund(r.publicKey, 0.03);

  const ownerSdk = sdkFor(deployer);

  for (const m of MERCHANTS) {
    const wallet = keyFile(m.key);
    let asset = saved[m.key]?.asset ? new PublicKey(saved[m.key].asset) : null;

    if (!asset) {
      const res = (await ownerSdk.registerAgent(`https://github.com/manasshete/allowance-solana#${m.key}`, {
        atomEnabled: true,
      })) as { asset?: PublicKey; signature?: string };
      if (!res.asset) throw new Error(`registerAgent returned no asset for ${m.label}: ${JSON.stringify(res)}`);
      asset = res.asset;
      saved[m.key] = { asset: asset.toBase58(), wallet: wallet.publicKey.toBase58() };
      writeFileSync(registryPath, JSON.stringify(saved, null, 2));
      console.log(`${m.label}: registered agent asset ${asset.toBase58()}`);

      await ownerSdk.setAgentWallet(asset, wallet);
      console.log(`${m.label}: agent wallet set to ${wallet.publicKey.toBase58()}`);

      for (const [i, score] of m.scores.entries()) {
        await sdkFor(reviewers[i]).giveFeedback(asset, { value: String(score), score, tag1: "starred" });
        console.log(`${m.label}: feedback ${score} from reviewer ${i}`);
      }
    } else {
      console.log(`${m.label}: already registered as ${asset.toBase58()}`);
    }

    const rep = await fetchReputation(conn, asset);
    console.log(
      `${m.label}: on-chain score ${rep?.score ?? "none"} from ${rep?.feedbackCount ?? 0} feedback, wallet ${
        rep?.wallet === wallet.publicKey.toBase58() ? "matches" : `MISMATCH (${rep?.wallet})`
      }`,
    );
  }

  // merge into config/merchants.json for the MCP server and demo
  const cfgPath = fromRoot("config/merchants.json");
  const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
  const a = readKeypair("keys/merchant-a.json").publicKey.toBase58();
  cfg[a] = { ...(cfg[a] ?? {}), label: "Merchant A", contact: "summary-api" };
  for (const m of MERCHANTS) cfg[saved[m.key].wallet] = { ...(cfg[saved[m.key].wallet] ?? {}), label: m.label, asset: saved[m.key].asset };
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`wrote ${cfgPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
