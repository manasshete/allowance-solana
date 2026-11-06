import { existsSync, readFileSync } from "node:fs";

import { Connection, PublicKey } from "@solana/web3.js";

import { getProgram, registryAccounts } from "@allowance/client";
import type { AgentContext } from "@allowance/client/agent";
import { fromRoot, pubkeyEnv, readKeypair, rpcUrl, usdcMint } from "@allowance/client/env";

export type MerchantInfo = { label: string; contact?: string; asset?: string };

export function loadMerchants(): Record<string, MerchantInfo> {
  const path = fromRoot(process.env.MERCHANTS_FILE ?? "config/merchants.json");
  if (!existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, MerchantInfo | string>;
  return Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, MerchantInfo] => !e[0].startsWith("_") && typeof e[1] === "object"),
  );
}

export function buildContext() {
  const connection = new Connection(rpcUrl(), "confirmed");
  const program = getProgram(connection);
  const agent = readKeypair(process.env.AGENT_KEYPAIR ?? "keys/agent.json");
  const owner = pubkeyEnv("OWNER");
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
  return { ctx, merchants };
}

/** "alice", "Merchant A" or a base58 address -> wallet. */
export function resolveRecipient(to: string, merchants: Record<string, MerchantInfo>): PublicKey | null {
  const q = to.trim().toLowerCase();
  for (const [addr, m] of Object.entries(merchants)) {
    if (m.contact?.toLowerCase() === q || m.label.toLowerCase() === q) return new PublicKey(addr);
  }
  try {
    return new PublicKey(to.trim());
  } catch {
    return null;
  }
}
