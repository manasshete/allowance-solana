import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { Keypair } from "@solana/web3.js";

export const dynamic = "force-dynamic";

/** The repo root (the folder with Anchor.toml). Ignored by tracing so keys/ never ends up in a build. */
function repoRoot() {
  let dir = resolve(/* turbopackIgnore: true */ process.cwd());
  for (;;) {
    if (existsSync(resolve(/* turbopackIgnore: true */ dir, "Anchor.toml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}

/** AGENT_KEYPAIR from the root .env, since Next only loads apps/web/.env*. */
function agentPathSetting(root: string) {
  const fromEnv = process.env.AGENT_KEYPAIR_PATH ?? process.env.AGENT_KEYPAIR;
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(resolve(/* turbopackIgnore: true */ root, ".env"), "utf8");
    const m = /^\s*AGENT_KEYPAIR(?:_PATH)?\s*=\s*["']?(.+?)["']?\s*$/m.exec(text);
    if (m) return m[1];
  } catch {
    /* no .env */
  }
  return "keys/agent.json";
}

/**
 * The public key of this machine's MCP agent, so the owner never has to copy it by hand.
 * Same path and create-if-missing rule as apps/mcp/src/context.ts, so both always agree.
 * Only the public key leaves this route; the secret stays in the keypair file.
 */
export function GET() {
  // Hosted deployments have no key file: the public key comes from the environment instead.
  if (process.env.AGENT_PUBKEY) return Response.json({ agent: process.env.AGENT_PUBKEY.trim() });
  try {
    const root = repoRoot();
    const setting = agentPathSetting(root);
    const path = isAbsolute(setting) ? setting : resolve(/* turbopackIgnore: true */ root, setting);
    if (!existsSync(path)) {
      const kp = Keypair.generate();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
    }
    const secret = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]);
    return Response.json({ agent: Keypair.fromSecretKey(secret).publicKey.toBase58() });
  } catch {
    // e.g. a hosted deployment with no local key file: the form falls back to manual entry.
    return Response.json({ agent: null }, { status: 404 });
  }
}
