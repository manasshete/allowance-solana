#!/usr/bin/env bash
# Starts the MCP server with a missing keypair path: it must create the key, print it to stderr,
# and answer an MCP initialize + tools/list over stdio. Then calls get_allowance (no session yet).
cd /work
T=$(mktemp -d)
export AGENT_KEYPAIR_PATH="$T/agent.json" VAULT_OWNER=9Tb4Z3FzcZy6w9XmkRfvktLm8TvFgzbfffz5xM9K5N82
{
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
  printf '%s\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_allowance","arguments":{}}}'
  sleep 8
} | npx tsx apps/mcp/src/index.ts 2>"$T/err" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const l of s.trim().split("\n")){const m=JSON.parse(l);
 if(m.id===1)console.log("initialize:",m.result.serverInfo.name);
 if(m.id===2)console.log("tools:",m.result.tools.map(t=>t.name).join(", "));
 if(m.id===3)console.log("get_allowance:",m.result.content[0].text);}})'
echo "== stderr"; grep -v -e ExperimentalWarning -e trace-warnings -e bigint "$T/err"
echo "key file created: $([ -f "$T/agent.json" ] && echo yes || echo no)"
