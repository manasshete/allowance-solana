"use client";

import { useEffect, useMemo, useState } from "react";

import { Copy } from "@/components/Bits";
import {
  agentKeyPath,
  claudeCodeCommand,
  configFileFor,
  defaultRepo,
  detectOs,
  mcpJson,
  REPO_URL,
  type McpClient,
  type Os,
} from "@/lib/mcpConfig";

const REPO_KEY = "allowance.mcpRepoPath";

const CLIENTS: { id: McpClient; label: string }[] = [
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
];

function CodeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="mcp-code">
      <div className="mcp-code__head">
        <span className="help">{label}</span>
        <Copy value={value} />
      </div>
      <pre className="logs" tabIndex={0}>
        {value}
      </pre>
    </div>
  );
}

/**
 * Ready-to-paste MCP config for this session's agent. Nothing secret is shown: the MCP server reads
 * the agent key from a file on the owner's machine, so the config only carries public values and paths.
 */
export function ConnectAgent({
  owner,
  agent,
  defaultClient = "Claude",
  justCreated = false,
}: {
  owner: string;
  agent: string;
  defaultClient?: string;
  justCreated?: boolean;
}) {
  const [os, setOs] = useState<Os>("windows");
  const [repo, setRepo] = useState("");
  const [client, setClient] = useState<McpClient>(defaultClient === "Cursor" ? "cursor" : "claude-desktop");
  const [origin, setOrigin] = useState("http://localhost:3100");

  useEffect(() => {
    const detected = detectOs();
    setOs(detected);
    setRepo(localStorage.getItem(REPO_KEY) ?? defaultRepo(detected));
    setOrigin(window.location.origin);
  }, []);

  const inputs = useMemo(() => ({ repo: repo || defaultRepo(os), os, owner, agent, dashboardUrl: origin }), [repo, os, owner, agent, origin]);
  const json = mcpJson(inputs);
  const keyPath = agentKeyPath(inputs);

  return (
    <section className="plate mcp-connect" id="connect" aria-labelledby="connect-h">
      <div className="plate__head">
        <h2 id="connect-h">{justCreated ? "Session created. Now connect your AI client" : "Connect an AI client"}</h2>
      </div>
      <p className="plate__note">
        The Allowance MCP server runs on your computer, holds this session&rsquo;s agent key and signs payments the program allows.
        Paste one of these into Claude or Cursor and it can spend within the limits you just set.
      </p>

      <div className="form-grid-2">
        <div className="field">
          <label htmlFor="mcp-repo">Where you cloned the repo</label>
          <input
            id="mcp-repo"
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={repo}
            onChange={(e) => {
              setRepo(e.target.value);
              localStorage.setItem(REPO_KEY, e.target.value);
            }}
          />
          <small className="help">Full path. Kept in this browser only.</small>
        </div>
        <div className="field">
          <label htmlFor="mcp-os">Your computer</label>
          <select id="mcp-os" value={os} onChange={(e) => setOs(e.target.value as Os)}>
            <option value="windows">Windows</option>
            <option value="mac">macOS</option>
            <option value="linux">Linux</option>
          </select>
        </div>
      </div>

      <ol className="mcp-steps">
        <li>
          Once per computer: <code>git clone {REPO_URL}</code>, then <code>npm install</code> in that folder (Node 20 or newer).
        </li>
        <li>
          Put this session&rsquo;s agent key at <code>{keyPath}</code>. If the dashboard found this computer&rsquo;s agent, it&rsquo;s
          already there. If you generated a key in the browser, move the downloaded <code>agent.json</code> there. If the file is
          missing, the server makes a new key that won&rsquo;t match this session.
        </li>
        <li>Pick your client below, paste the config, then fully restart the client.</li>
        <li>
          Check: ask &ldquo;What&rsquo;s my allowance?&rdquo;. The server log should say <code>agent public key: {agent.slice(0, 8)}…</code>.
        </li>
      </ol>

      <div className="mcp-tabs" role="tablist" aria-label="AI client">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={client === c.id}
            className={`tab${client === c.id ? " is-active" : ""}`}
            onClick={() => setClient(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {client === "claude-code" ? (
        <>
          <CodeBlock value={claudeCodeCommand(inputs)} label={os === "windows" ? "Run in PowerShell" : "Run in a terminal"} />
          <small className="help">Then check with <code>claude mcp list</code>, or <code>/mcp</code> inside a session.</small>
        </>
      ) : (
        <>
          <CodeBlock value={json} label={configFileFor(client, os)} />
          <small className="help">
            {client === "claude-desktop"
              ? "Settings, Developer, Edit Config opens this file. If it already has mcpServers, add just the \"allowance\" entry. Quit Claude from the tray and reopen."
              : "Settings, MCP shows \"allowance\" in green when it's running. Use Agent mode in chat; Ask mode doesn't call tools."}
          </small>
        </>
      )}

      <p className="help">
        This config has no secrets in it, only your wallet address, where the agent key file lives and devnet settings. Never
        paste the contents of <code>agent.json</code> into a chat or a config file.
      </p>
    </section>
  );
}
