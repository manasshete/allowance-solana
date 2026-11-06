import type { Connection, PublicKey } from "@solana/web3.js";
import { PublicKey as PK } from "@solana/web3.js";

import { ATOM_ENGINE_PROGRAM_ID, REGISTRY_PROGRAM_ID } from "./constants";
import { registryAccounts } from "./pda";

// Same layout programs/allowance/src/reputation.rs checks (8004-solana 0.8.5).
const AGENT_DISC = [241, 119, 69, 140, 233, 9, 112, 50];
const STATS_DISC = [190, 187, 50, 59, 203, 39, 136, 244];

export type Reputation = {
  asset: string;
  wallet: string | null;
  score: number;
  feedbackCount: bigint;
  registryAgent: string;
  atomStats: string;
};

/** Reads an agent's wallet and score from the Agent Registry, as the program would. Null if not registered. */
export async function fetchReputation(connection: Connection, asset: PublicKey): Promise<Reputation | null> {
  const { registryAgent, atomStats } = registryAccounts(asset);
  const [a, s] = await connection.getMultipleAccountsInfo([registryAgent, atomStats]);
  if (!a || !s || !a.owner.equals(REGISTRY_PROGRAM_ID) || !s.owner.equals(ATOM_ENGINE_PROGRAM_ID)) return null;
  if (!AGENT_DISC.every((b, i) => a.data[i] === b) || !STATS_DISC.every((b, i) => s.data[i] === b)) return null;
  const wallet = a.data[138] === 1 ? new PK(a.data.subarray(139, 171)).toBase58() : null;
  const feedbackCount = Buffer.from(s.data).readBigUInt64LE(88);
  const ema = Buffer.from(s.data).readUInt16LE(98);
  return {
    asset: asset.toBase58(),
    wallet,
    score: feedbackCount === 0n ? 0 : Math.floor(Math.min(ema, 10_000) / 100),
    feedbackCount,
    registryAgent: registryAgent.toBase58(),
    atomStats: atomStats.toBase58(),
  };
}
