import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Keypair } from "@solana/web3.js";
import { fromRoot, loadDotEnv, readKeypair } from "@allowance/client/env";

export const dynamic = "force-dynamic";

/**
 * The public key of this machine's MCP agent, so the owner never has to copy it by hand.
 * Same path and create-if-missing rule as apps/mcp/src/context.ts, so both always agree.
 * Only the public key leaves this route; the secret stays in the keypair file.
 */
export function GET() {
  loadDotEnv();
  const path = fromRoot(process.env.AGENT_KEYPAIR_PATH ?? process.env.AGENT_KEYPAIR ?? "keys/agent.json");
  try {
    if (!existsSync(path)) {
      const kp = Keypair.generate();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
    }
    return Response.json({ agent: readKeypair(path).publicKey.toBase58() });
  } catch {
    // e.g. a hosted deployment with no local key file: the form falls back to manual entry.
    return Response.json({ agent: null }, { status: 404 });
  }
}
