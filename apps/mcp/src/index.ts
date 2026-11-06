#!/usr/bin/env -S npx tsx
/**
 * Allowance MCP server. Holds the agent key (never shown to the model) and gives
 * the model tools that can only spend through the Allowance program.
 *
 * Claude Desktop (claude_desktop_config.json):
 *   "allowance": { "command": "npx", "args": ["tsx", "<repo>/apps/mcp/src/index.ts"], "cwd": "<repo>" }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadDotEnv } from "@allowance/client/env";

loadDotEnv();

const { buildContext } = await import("./context");
const { registerTools } = await import("./tools");

const { ctx, merchants } = buildContext();
const server = new McpServer({ name: "allowance", version: "0.1.0" });
registerTools(server, ctx, merchants, z);

// stderr only: stdout is the MCP channel.
console.error(`[allowance-mcp] agent ${ctx.agent.publicKey.toBase58()} for owner ${ctx.owner.toBase58()}`);
console.error("[allowance-mcp] paste the agent key into the dashboard's New session form");

await server.connect(new StdioServerTransport());
