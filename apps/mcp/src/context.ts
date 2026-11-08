import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { getProgram, PROGRAM_ID, registryAccounts } from "@allowance/client";
import type { AgentContext } from "@allowance/client/agent";
import { fromRoot, readKeypair, rpcUrl, usdcMint } from "@allowance/client/env";

export type MerchantInfo = { label: string; contact?: string; asset?: string };

export function loadMerchants(): Record<string, MerchantInfo> {
  const path = fromRoot(process.env.MERCHANTS_FILE ?? "config/merchants.json");
  if (!existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, MerchantInfo | string>;
  return Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, MerchantInfo] => !e[0].startsWith("_") && typeof e[1] === "object"),
  );
}

/**
 * The agent key is born here, on the owner's machine: if the keypair file doesn't exist,
 * a new one is generated and saved. Its secret never reaches the model or the dashboard.
 */
function loadOrCreateAgent(): { agent: Keypair; path: string; created: boolean } {
  const path = fromRoot(process.env.AGENT_KEYPAIR_PATH ?? process.env.AGENT_KEYPAIR ?? "keys/agent.json");
  if (existsSync(path)) return { agent: readKeypair(path), path, created: false };
  const agent = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(agent.secretKey)), { mode: 0o600 });
  return { agent, path, created: true };
}

export function buildContext() {
  // PROGRAM_ID is optional: the program ID comes from the IDL; a different value is a config mistake.
  if (process.env.PROGRAM_ID && process.env.PROGRAM_ID !== PROGRAM_ID.toBase58())
    throw new Error(`PROGRAM_ID ${process.env.PROGRAM_ID} doesn't match the deployed program ${PROGRAM_ID.toBase58()}`);
  const ownerStr = process.env.VAULT_OWNER ?? process.env.OWNER;
  if (!ownerStr) throw new Error("Set VAULT_OWNER (or OWNER) to the vault owner's wallet address");

  const connection = new Connection(rpcUrl(), "confirmed");
  const program = getProgram(connection);
  const { agent, path: agentPath, created } = loadOrCreateAgent();
  const owner = new PublicKey(ownerStr);
  const mint = usdcMint();
  const merchants = loadMerchants();

  const ctx: AgentContext = {
    connection,
    program,
    agent,
    owner,
    mint,
    reputationFor: async (merchant: PublicKey) => {
      const asset = merchants[merchant.toBase58()]?.asset;
      return asset ? registryAccounts(new PublicKey(asset)) : null;
    },
  };
  return { ctx, merchants, agentPath, created };
}

/** "alice", "friend", "Merchant A" or a base58 address -> wallet. */
export function resolveRecipient(
  to: string,
  merchants: Record<string, MerchantInfo>,
  sessionMerchants?: { merchant: PublicKey; label: string }[],
): PublicKey | null {
  const trimmed = to.trim();
  const q = trimmed.toLowerCase();
  const stripped = q.replace(/^(my|the)\s+/, "");

  // 1. Session contacts added via dashboard (e.g. friend's wallet address with label "friend")
  if (sessionMerchants && sessionMerchants.length > 0) {
    for (const m of sessionMerchants) {
      const lbl = m.label.trim().toLowerCase();
      const strippedLbl = lbl.replace(/^(my|the)\s+/, "");
      if (lbl === q || lbl === stripped || strippedLbl === stripped) {
        return m.merchant;
      }
    }
  }

  // 2. config/merchants.json
  for (const [addr, m] of Object.entries(merchants)) {
    const contact = m.contact?.trim().toLowerCase();
    const lbl = m.label.trim().toLowerCase();
    if (contact === q || contact === stripped || lbl === q || lbl === stripped) {
      return new PublicKey(addr);
    }
  }

  // 3. Raw base58 Solana public key
  try {
    return new PublicKey(trimmed);
  } catch {
    return null;
  }
}
