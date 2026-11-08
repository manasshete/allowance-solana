import { PROGRAM_ID } from "@allowance/client";

import { DEFAULT_MINT, RPC_URL } from "./config";

export type Os = "windows" | "mac" | "linux";
export type McpClient = "claude-desktop" | "claude-code" | "cursor";

export type McpInputs = {
  /** Absolute path of the cloned allowance-solana repo on the owner's machine. */
  repo: string;
  os: Os;
  owner: string;
  agent: string;
  dashboardUrl: string;
};

export const REPO_URL = "https://github.com/manasshete/allowance-solana";

export function detectOs(): Os {
  if (typeof navigator === "undefined") return "windows";
  const p = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (p.includes("win")) return "windows";
  if (p.includes("mac")) return "mac";
  return "linux";
}

export const defaultRepo = (os: Os) =>
  os === "windows" ? "C:\\Users\\you\\allowance-solana" : os === "mac" ? "/Users/you/allowance-solana" : "/home/you/allowance-solana";

/** Joins onto the repo path with the OS's separator, dropping any trailing one the owner typed. */
export function inRepo(i: Pick<McpInputs, "repo" | "os">, ...parts: string[]) {
  const sep = i.os === "windows" ? "\\" : "/";
  const root = i.repo.trim().replace(/[\\/]+$/, "");
  return [root, ...parts].join(sep);
}

export const agentKeyPath = (i: Pick<McpInputs, "repo" | "os">) => inRepo(i, "keys", "agent.json");

/**
 * Everything apps/mcp/src/context.ts reads. Paths are absolute because MCP clients start the server
 * from their own working directory, not the repo. No secret is in here: the server reads the agent
 * key from AGENT_KEYPAIR_PATH on disk.
 */
export function mcpEnv(i: McpInputs): Record<string, string> {
  return {
    VAULT_OWNER: i.owner,
    AGENT_KEYPAIR_PATH: agentKeyPath(i),
    RPC_URL,
    USDC_MINT: DEFAULT_MINT.toBase58(),
    PROGRAM_ID: PROGRAM_ID.toBase58(),
    MERCHANTS_FILE: inRepo(i, "config", "merchants.json"),
    DASHBOARD_URL: i.dashboardUrl,
  };
}

/** Windows clients can't spawn npx directly (it's a .cmd shim), so they go through cmd /c. */
function command(i: McpInputs): { command: string; args: string[] } {
  const entry = inRepo(i, "apps", "mcp", "src", "index.ts");
  return i.os === "windows"
    ? { command: "cmd", args: ["/c", "npx", "tsx", entry] }
    : { command: "npx", args: ["tsx", entry] };
}

/** The mcpServers block Claude Desktop and Cursor both use. */
export function mcpJson(i: McpInputs): string {
  return JSON.stringify({ mcpServers: { allowance: { ...command(i), env: mcpEnv(i) } } }, null, 2);
}

const shQuote = (s: string) => (/^[\w./:@=-]+$/.test(s) ? s : `"${s.replace(/(["\\$`])/g, "\\$1")}"`);
const psQuote = (s: string) => (/^[\w./:@=\\-]+$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`);

/** One `claude mcp add` line; user scope so it works from any folder. */
export function claudeCodeCommand(i: McpInputs): string {
  const q = i.os === "windows" ? psQuote : shQuote;
  const env = Object.entries(mcpEnv(i)).map(([k, v]) => `-e ${k}=${q(v)}`);
  const { command: cmd, args } = command(i);
  return ["claude mcp add allowance --scope user", ...env, "--", cmd, ...args.map(q)].join(i.os === "windows" ? " `\n  " : " \\\n  ");
}

export function configFileFor(client: McpClient, os: Os): string {
  if (client === "cursor") return os === "windows" ? "%USERPROFILE%\\.cursor\\mcp.json" : "~/.cursor/mcp.json";
  if (client === "claude-desktop")
    return os === "windows"
      ? "%APPDATA%\\Claude\\claude_desktop_config.json"
      : os === "mac"
        ? "~/Library/Application Support/Claude/claude_desktop_config.json"
        : "~/.config/Claude/claude_desktop_config.json";
  return "";
}
