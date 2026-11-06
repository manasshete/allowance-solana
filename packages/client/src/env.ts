/**
 * Shared server-side config for the facilitator, paid API, MCP server and scripts.
 * Values come from the environment (see .env.example at the repo root).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { Keypair, PublicKey } from "@solana/web3.js";

import { DEVNET_USDC } from "./constants";

/** The repo root (the folder with Anchor.toml), so apps started from their own folder find keys/ and .env. */
export function repoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "Anchor.toml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}

/** Relative paths in .env are relative to the repo root. */
export const fromRoot = (p: string) => (isAbsolute(p) ? p : resolve(repoRoot(), p));

export function loadDotEnv(path = fromRoot(".env")) {
  path = fromRoot(path);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

export const rpcUrl = () => process.env.RPC_URL ?? "https://api.devnet.solana.com";
export const usdcMint = () => new PublicKey(process.env.USDC_MINT ?? DEVNET_USDC.toBase58());
export const pubkeyEnv = (name: string) => new PublicKey(required(name));

/** Reads a solana-keygen JSON keypair file (path relative to the repo root or absolute). */
export function readKeypairBytes(path: string): Uint8Array {
  return Uint8Array.from(JSON.parse(readFileSync(fromRoot(path), "utf8")) as number[]);
}

export const readKeypair = (path: string) => Keypair.fromSecretKey(readKeypairBytes(path));
