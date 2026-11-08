"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";

import { createSessionIx, MAX_MERCHANTS, parseUsdc, toBN } from "@allowance/client";


import { Card3D } from "@/components/Card3D";
import { saveAgentName } from "@/lib/names";
import { useOwner, useProgram, useSessions } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

type Row = { address: string; label: string; cap: string };

const isKey = (s: string) => {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
};
const isAmount = (s: string) => /^\d+(\.\d{1,6})?$/.test(s.trim());

export default function NewSession() {
  const owner = useOwner()!;
  const program = useProgram();
  const router = useRouter();
  const send = useSend();
  const sessions = useSessions();

  const [aiClient, setAiClient] = useState("Claude");
  const [name, setName] = useState("");
  const [agent, setAgent] = useState("");
  // The local MCP agent's public key, filled in for the owner. Manual entry only as a fallback.
  const [localAgent, setLocalAgent] = useState<string | null>(null);
  const [manualAgent, setManualAgent] = useState(false);
  // A key made in this tab for hosted use. Held in memory only, offered once as a download, never stored or sent.
  const [generated, setGenerated] = useState<Keypair | null>(null);
  const [keySaved, setKeySaved] = useState(false);
  function generateKey() {
    const kp = Keypair.generate();
    setGenerated(kp);
    setKeySaved(false);
    setAgent(kp.publicKey.toBase58());
  }
  function downloadKey() {
    if (!generated) return;
    const blob = new Blob([JSON.stringify(Array.from(generated.secretKey))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent.json";
    a.click();
    URL.revokeObjectURL(url);
    setKeySaved(true);
  }
  useEffect(() => {
    fetch("/api/agent")
      .then((r) => (r.ok ? r.json() : { agent: null }))
      .then((j: { agent: string | null }) => {
        if (j.agent) {
          setLocalAgent(j.agent);
          setAgent((a) => a || j.agent!);
        } else setManualAgent(true);
      })
      .catch(() => setManualAgent(true));
  }, []);
  const [durationHours, setDurationHours] = useState("24");
  const [dailyBudget, setDailyBudget] = useState("100");
  const [perTxMax, setPerTxMax] = useState("20");

  // Unlisted payees (any x402 API not listed below) must pass the on-chain reputation check.
  const [allowUnlisted, setAllowUnlisted] = useState(true);
  const [otherCap, setOtherCap] = useState("5");
  const [minRep, setMinRep] = useState("70");
  const [fundAgent, setFundAgent] = useState(true);

  const [rows, setRows] = useState<Row[]>([{ address: "", label: "friend", cap: "5.00" }]);
  const [tried, setTried] = useState(false);

  const errors: Record<string, string> = {};
  if (!isKey(agent)) errors.agent = "Paste the agent public key printed by the MCP server, or generate one";
  else if (sessions.data?.some((x) => x.account.agent.toBase58() === agent.trim()))
    errors.agent = "This agent already has a session on your vault. Open it, or revoke and close it first, or use a new agent key.";
  else if (generated && generated.publicKey.toBase58() === agent.trim() && !keySaved)
    errors.agent = "Download agent.json first. Without it the agent can't sign and this session is unusable.";
  if (!isAmount(perTxMax)) errors.perTxMax = "Valid number required";
  if (!isAmount(dailyBudget)) errors.dailyBudget = "Valid number required";
  if (!errors.perTxMax && !errors.dailyBudget && parseUsdc(perTxMax) > parseUsdc(dailyBudget))
    errors.perTxMax = "Can't exceed daily budget";
  if (!/^\d+$/.test(durationHours) || Number(durationHours) < 1)
    errors.durationHours = "Whole hours, at least 1";
  if (allowUnlisted && !isAmount(otherCap)) errors.otherCap = "Valid number required";
  if (allowUnlisted && (!/^\d{1,3}$/.test(minRep) || Number(minRep) > 100)) errors.minRep = "0 to 100";

  const filled = rows.filter((r) => r.address.trim());
  filled.forEach((r, i) => {
    if (!isKey(r.address)) errors[`m${i}`] = "Not a valid Solana address";
    else if (!isAmount(r.cap) || parseUsdc(r.cap) === 0n) errors[`m${i}`] = "Cap must be above zero";
  });

  const existing = isKey(agent) ? sessions.data?.find((x) => x.account.agent.toBase58() === agent.trim()) : undefined;
  const show = (k: string) => (tried || (k === "agent" && existing) ? errors[k] : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) {
      document.querySelector<HTMLInputElement>("[aria-invalid='true']")?.focus();
      return;
    }
    const agentKey = new PublicKey(agent.trim());
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Number(durationHours) * 3600;

    const merchants = filled.map((r) => ({
      merchant: new PublicKey(r.address.trim()),
      label: r.label.trim().slice(0, 24),
      dailyCap: toBN(parseUsdc(r.cap)),
    }));

    const otherDailyCap = toBN(parseUsdc(allowUnlisted ? otherCap : "0"));

    const ix = await createSessionIx(program, owner, agentKey, {
      perRequestCap: toBN(parseUsdc(perTxMax)),
      dailyCap: toBN(parseUsdc(dailyBudget)),
      otherDailyCap,
      minReputation: allowUnlisted ? Number(minRep) : 100,
      expiresAt: toBN(expiresAt),
      merchants,
    });

    const ixs = [ix];
    if (fundAgent) {
      ixs.unshift(
        SystemProgram.transfer({
          fromPubkey: owner,
          toPubkey: agentKey,
          lamports: Math.round(0.05 * LAMPORTS_PER_SOL),
        }),
      );
    }

    try {
      await send.mutateAsync({
        label: `Create session for ${name || aiClient}`,
        build: async () => ixs,
      });
      saveAgentName(agentKey.toBase58(), name || aiClient);
      setGenerated(null);
      router.push(`/app/sessions/${agentKey.toBase58()}?connect=1&client=${encodeURIComponent(aiClient)}`);
    } catch {
      /* handled by useSend */
    }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <Link href="/app/sessions" className="btn btn--text">
            Back to sessions
          </Link>
          <h1>Issue an agent session</h1>
          <p className="muted">
            Give an AI client its own spending key on your vault. The program enforces every number here, on every payment.
          </p>
        </div>
      </div>

      <div className="form-layout">
        <div className="col">
          <Card3D intensity={10} glare={false}>
            <form onSubmit={submit} className="plate hud-card hud-form">
              <div className="field">
                <label htmlFor="ai-client">AI client</label>
                <select
                  id="ai-client"
                  value={aiClient}
                  onChange={(e) => setAiClient(e.target.value)}
                >
                  <option value="Claude">Claude</option>
                  <option value="Cursor">Cursor</option>
                  <option value="Custom Agent">Custom Agent</option>
                </select>
              </div>

              {manualAgent ? (
                <div className="field">
                  <label htmlFor="s-agent">Agent public key</label>
                  <input
                    id="s-agent"
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="Printed by MCP server (e.g. 8kQb...)"
                    value={agent}
                    aria-invalid={!!show("agent")}
                    onChange={(e) => setAgent(e.target.value)}
                  />
                  {show("agent") && <small className="help help--error">{show("agent")}</small>}
                  {!generated && (
                    <button type="button" className="btn btn--text" style={{ width: "fit-content" }} onClick={generateKey}>
                      No agent yet? Generate a key in this browser
                    </button>
                  )}
                  {generated && generated.publicKey.toBase58() === agent.trim() && (
                    <div className="key-once" role="alert">
                      <strong>Save this agent key now. It is shown once.</strong>
                      <span>
                        It was made in this tab and is not stored or sent anywhere. Anyone with the file can spend within this
                        session&rsquo;s limits, so keep it private and put it in your repo at <code>keys/agent.json</code>.
                      </span>
                      <button type="button" className="btn btn--primary" style={{ width: "fit-content" }} onClick={downloadKey}>
                        {keySaved ? "Saved. Download again" : "Download agent.json"}
                      </button>
                    </div>
                  )}
                  {localAgent && (
                    <button
                      type="button"
                      className="btn btn--text"
                      style={{ width: "fit-content" }}
                      onClick={() => {
                        setAgent(localAgent);
                        setManualAgent(false);
                      }}
                    >
                      Use this computer&rsquo;s agent
                    </button>
                  )}
                </div>
              ) : (
                <div className="field">
                  <span className="help">
                    {localAgent
                      ? "Agent: set up automatically for the MCP server on this computer."
                      : "Finding this computer's agent…"}
                  </span>
                  {show("agent") && (
                    <small className="help help--error">
                      {existing ? show("agent") : "Still loading the agent, try again in a moment"}
                    </small>
                  )}
                  {existing && (
                    <Link className="btn btn--text" style={{ width: "fit-content" }} href={`/app/sessions/${agent.trim()}`}>
                      Open the existing session
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn btn--text"
                    style={{ width: "fit-content" }}
                    onClick={() => setManualAgent(true)}
                  >
                    Use a different agent
                  </button>
                </div>
              )}

              <div className="field">
                <label htmlFor="s-label">Name (optional, kept in this browser)</label>
                <input
                  id="s-label"
                  type="text"
                  autoComplete="off"
                  placeholder="Work laptop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="s-dur">Expires in (hours)</label>
                  <input
                    id="s-dur"
                    type="number"
                    min="1"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="s-asset">Token</label>
                  <input id="s-asset" type="text" value="Your vault's token (USDC)" readOnly disabled className="asset-locked" />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="s-daily">Daily budget</label>
                  <input
                    id="s-daily"
                    type="text"
                    inputMode="decimal"
                    value={dailyBudget}
                    aria-invalid={!!show("dailyBudget")}
                    onChange={(e) => setDailyBudget(e.target.value)}
                  />
                  {show("dailyBudget") && <small className="help help--error">{show("dailyBudget")}</small>}
                </div>
                <div className="field">
                  <label htmlFor="s-pertx">Most per payment</label>
                  <input
                    id="s-pertx"
                    type="text"
                    inputMode="decimal"
                    value={perTxMax}
                    aria-invalid={!!show("perTxMax")}
                    onChange={(e) => setPerTxMax(e.target.value)}
                  />
                  <small className={`help${show("perTxMax") ? " help--error" : ""}`}>
                    {show("perTxMax") ?? "Above this, the agent has to ask you on the Approvals page."}
                  </small>
                </div>
              </div>

              <div className="hud-toggles">
                <label className="hud-checkbox-card">
                  <input type="checkbox" checked={allowUnlisted} onChange={(e) => setAllowUnlisted(e.target.checked)} />
                  <div className="hud-checkbox-copy">
                    <strong>Allow payees not listed below</strong>
                    <span>For paid x402 APIs. Each must pass the on-chain Agent Registry reputation check.</span>
                  </div>
                </label>
              </div>
              {allowUnlisted && (
                <div className="form-grid-2">
                  <div className="field">
                    <label htmlFor="s-minrep">Minimum reputation (0 to 100)</label>
                    <input
                      id="s-minrep"
                      type="text"
                      inputMode="numeric"
                      value={minRep}
                      aria-invalid={!!show("minRep")}
                      onChange={(e) => setMinRep(e.target.value)}
                    />
                    {show("minRep") && <small className="help help--error">{show("minRep")}</small>}
                  </div>
                  <div className="field">
                    <label htmlFor="s-other">Their shared daily cap</label>
                    <input
                      id="s-other"
                      type="text"
                      inputMode="decimal"
                      value={otherCap}
                      aria-invalid={!!show("otherCap")}
                      onChange={(e) => setOtherCap(e.target.value)}
                    />
                    {show("otherCap") && <small className="help help--error">{show("otherCap")}</small>}
                  </div>
                </div>
              )}

              {/* Listed Contact / Friend section */}
              <fieldset className="listed-contacts-section fieldset">
                <legend>People and merchants your agent can pay by name (up to {MAX_MERCHANTS})</legend>
                <p className="help">
                  Claude resolves &ldquo;pay my friend&rdquo; from these labels, which are stored on-chain with the session.
                </p>
                {rows.map((r, i) => (
                  <div key={i} className="merchant-row">
                    <div className="field">
                      <label htmlFor={`m${i}l`}>Name</label>
                      <input
                        id={`m${i}l`}
                        type="text"
                        autoComplete="off"
                        placeholder="friend"
                        value={r.label}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`m${i}a`}>Solana address</label>
                      <input
                        id={`m${i}a`}
                        type="text"
                        spellCheck={false}
                        autoComplete="off"
                        value={r.address}
                        aria-invalid={!!show(`m${filled.indexOf(r)}`)}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`m${i}c`}>Daily cap</label>
                      <input
                        id={`m${i}c`}
                        type="text"
                        inputMode="decimal"
                        value={r.cap}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, cap: e.target.value } : x)))}
                      />
                    </div>
                    <button type="button" className="btn btn--text" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                    {show(`m${filled.indexOf(r)}`) && (
                      <small className="help help--error field--wide">{show(`m${filled.indexOf(r)}`)}</small>
                    )}
                  </div>
                ))}
                {rows.length < MAX_MERCHANTS && (
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => setRows([...rows, { address: "", label: "", cap: "5.00" }])}
                  >
                    Add another
                  </button>
                )}
              </fieldset>

              <label className="hud-checkbox-inline">
                <input
                  type="checkbox"
                  checked={fundAgent}
                  onChange={(e) => setFundAgent(e.target.checked)}
                />
                <span>Send the agent 0.05 devnet SOL for its transaction fees</span>
              </label>

              <button type="submit" className="btn btn--primary" style={{ width: "fit-content" }} disabled={send.isPending}>
                {send.isPending ? "Waiting for Phantom…" : "Sign and create session"}
              </button>
            </form>
          </Card3D>
        </div>

        <aside className="plate rules" aria-labelledby="rules-h">
          <h2 id="rules-h">The rules, in plain words</h2>
          <ul>
            <li>No single payment over {perTxMax || "?"} USDC unless you approve that exact payment.</li>
            <li>No more than {dailyBudget || "?"} USDC a day in total.</li>
            {filled.map((r) => (
              <li key={r.address}>
                {r.label.trim() || "This address"}: up to {r.cap || "?"} USDC a day, payable by name.
              </li>
            ))}
            <li>
              {allowUnlisted
                ? `Anyone else needs a reputation of ${minRep || "?"} or more, and they share ${otherCap || "?"} USDC a day.`
                : "Nobody else can be paid."}
            </li>
            <li>The session ends after {durationHours || "?"} hours. You can revoke it or freeze everything at any time.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
