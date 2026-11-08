/**
 * Where an owner stands: vault, balance, and every session with its agent and state.
 *   npx tsx scripts/status.ts [owner]   (default: OWNER / VAULT_OWNER from .env)
 */
import { Connection, PublicKey } from "@solana/web3.js";

import { fetchSessions, fetchVault, formatUsdc, getProgram, vaultAta, vaultPda } from "../packages/client/src/index";
import { loadDotEnv, readKeypair, rpcUrl } from "../packages/client/src/env";

loadDotEnv();

async function main() {
  const ownerStr = process.argv[2] ?? process.env.VAULT_OWNER ?? process.env.OWNER;
  if (!ownerStr) throw new Error("Pass an owner address or set OWNER in .env");
  const owner = new PublicKey(ownerStr);
  const conn = new Connection(rpcUrl(), "confirmed");
  const program = getProgram(conn);
  const vault = vaultPda(owner);

  console.log(`owner   ${owner.toBase58()}  (${(await conn.getBalance(owner)) / 1e9} SOL)`);
  const v = await fetchVault(program, vault);
  if (!v) {
    console.log(`vault   none yet: create it at /app in the dashboard (address will be ${vault.toBase58()})`);
  } else {
    const bal = await conn.getTokenAccountBalance(vaultAta(vault, v.mint)).catch(() => null);
    console.log(`vault   ${vault.toBase58()}  ${bal?.value.uiAmountString ?? "?"} of mint ${v.mint.toBase58()}${v.frozen ? "  FROZEN" : ""}`);
    const sessions = v ? await fetchSessions(program, vault) : [];
    const now = Date.now() / 1000;
    if (!sessions.length) console.log("session none yet");
    for (const { address, account: s } of sessions) {
      const state = s.revoked ? "revoked" : s.expiresAt.toNumber() <= now ? "expired" : "active";
      const names = s.merchants.map((m) => `${m.label || "?"}=${m.merchant.toBase58().slice(0, 6)}…`).join(", ") || "none";
      console.log(
        `session ${address.toBase58()}  agent ${s.agent.toBase58()}  ${state}  per-request ${formatUsdc(
          s.perRequestCap.toString(),
        )}  daily ${formatUsdc(s.dailyCap.toString())}  listed: ${names}`,
      );
    }
  }
  try {
    const agent = readKeypair(process.env.AGENT_KEYPAIR_PATH ?? process.env.AGENT_KEYPAIR ?? "keys/agent.json").publicKey;
    console.log(`agent   ${agent.toBase58()}  (key the MCP server uses, ${(await conn.getBalance(agent)) / 1e9} SOL)`);
  } catch {
    console.log("agent   no key file yet: the MCP server creates one on first start");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
