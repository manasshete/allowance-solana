#!/usr/bin/env -S npx tsx
/**
 * Allowance MCP server. Holds the agent key (never shown to the model) and gives
 * the model tools that can only spend through the Allowance program.
 *
 * Env: VAULT_OWNER (or OWNER), AGENT_KEYPAIR_PATH (or AGENT_KEYPAIR; created if missing),
 *      RPC_URL, USDC_MINT, optional PROGRAM_ID (checked against the IDL), MERCHANTS_FILE.
 *
 * Claude Desktop (claude_desktop_config.json):
 *   "allowance": { "command": "npx", "args": ["tsx", "<repo>/apps/mcp/src/index.ts"],
 *                  "env": { "VAULT_OWNER": "<your Phantom address>", "AGENT_KEYPAIR_PATH": "<repo>/keys/agent.json" } }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadDotEnv } from "@allowance/client/env";

loadDotEnv();

const { buildContext } = await import("./context");
const { registerTools } = await import("./tools");

const { ctx, merchants, agentPath, created } = buildContext();
const server = new McpServer({ name: "allowance", version: "0.1.0" });
registerTools(server, ctx, merchants, z);

// stderr only: stdout is the MCP channel.
const agent = ctx.agent.publicKey.toBase58();
console.error(
  created
    ? `[allowance-mcp] created a new agent key at ${agentPath}`
    : `[allowance-mcp] loaded the agent key from ${agentPath}`,
);
console.error(`[allowance-mcp] agent public key: ${agent}`);
console.error(`[allowance-mcp] vault owner: ${ctx.owner.toBase58()}`);
console.error("[allowance-mcp] paste the agent public key into the dashboard's New session form");

await server.connect(new StdioServerTransport());
