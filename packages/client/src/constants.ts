import { PublicKey } from "@solana/web3.js";

import idl from "./idl/allowance.json";

/** Program ID comes from the IDL, which `anchor keys sync` + `anchor build` keep current. */
export const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

// 8004 Agent Registry, devnet (from 8004-solana 0.8.5)
export const REGISTRY_PROGRAM_ID = new PublicKey("8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C");
export const ATOM_ENGINE_PROGRAM_ID = new PublicKey("AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF");

/** Circle's devnet USDC. Override with your own 6-decimal test mint via env if the faucet is down. */
export const DEVNET_USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export const USDC_DECIMALS = 6;
export const MAX_REASON_LEN = 200;
export const MAX_MERCHANTS = 5;

export const SEEDS = {
  vault: Buffer.from("vault"),
  session: Buffer.from("session"),
  pending: Buffer.from("pending"),
  agent: Buffer.from("agent"),
  atomStats: Buffer.from("atom_stats"),
};

export const explorerTx = (sig: string, cluster = "devnet") =>
  `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;
export const explorerAddress = (addr: string, cluster = "devnet") =>
  `https://explorer.solana.com/address/${addr}?cluster=${cluster}`;
