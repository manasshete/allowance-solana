"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";

import { createSessionIx, MAX_MERCHANTS, parseUsdc, toBN } from "@allowance/client";

import { PageHead } from "@/components/Bits";
import { saveAgentName } from "@/lib/names";
import { useOwner, useProgram } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

type Row = { address: string; label: string; cap: string };

/** Pay3's presets, scaled down for devnet test money. */
const PRESETS = {
  conservative: { label: "Conservative", perRequest: "0.05", daily: "2.00", other: "0.50", rep: "70", hours: 24 },
  balanced: { label: "Balanced", perRequest: "0.25", daily: "10.00", other: "2.00", rep: "60", hours: 168 },
  defi: { label: "DeFi", perRequest: "0.50", daily: "20.00", other: "5.00", rep: "50", hours: 168 },
} as const;
type PresetKey = keyof typeof PRESETS;

const EXPIRIES = [
  ["1", "1 hour"],
  ["24", "24 hours"],
  ["168", "7 days"],
  ["custom", "Custom"],
] as const;

const isKey = (s: string) => {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
};
const isAmount = (s: string) => /^\d+(\.\d{1,6})?$/.test(s.trim());
const show2 = (s: string) => (isAmount(s) ? Number(s).toFixed(Math.max(2, (s.split(".")[1] ?? "").length)) : s);

export default function NewSession() {
  const owner = useOwner()!;
  const program = useProgram();
  const router = useRouter();
  const send = useSend();

  const [name, setName] = useState("");
  const [agent, setAgent] = useState("");
  const [preset, setPreset] = useState<PresetKey | null>("conservative");
  const [perRequest, setPerRequest] = useState<string>(PRESETS.conservative.perRequest);
  const [daily, setDaily] = useState<string>(PRESETS.conservative.daily);
  const [other, setOther] = useState<string>(PRESETS.conservative.other);
  const [rep, setRep] = useState<string>(PRESETS.conservative.rep);
  const [expiry, setExpiry] = useState<string>("24");
  const [customHours, setCustomHours] = useState("48");
  const [fundAgent, setFundAgent] = useState(true);
  const [rows, setRows] = useState<Row[]>([{ address: "", label: "Summary API", cap: "1.00" }]);
  const [tried, setTried] = useState(false);

  const hours = expiry === "custom" ? customHours : expiry;

  function applyPreset(k: PresetKey) {
    const p = PRESETS[k];
    setPreset(k);
    setPerRequest(p.perRequest);
    setDaily(p.daily);
    setOther(p.other);
    setRep(p.rep);
    setExpiry(String(p.hours));
  }
  const edited = <T,>(set: (v: T) => void) => (v: T) => {
    setPreset(null);
    set(v);
  };

  const errors: Record<string, string> = {};
  if (!isKey(agent)) errors.agent = "Paste the agent public key the MCP server printed";
  for (const [k, v] of [["perRequest", perRequest], ["daily", daily], ["other", other]] as const)
    if (!isAmount(v)) errors[k] = "An amount with at most 6 decimals";
  if (!errors.perRequest && !errors.daily && parseUsdc(perRequest) > parseUsdc(daily)) errors.perRequest = "Can't be above the daily cap";
  if (!errors.perRequest && parseUsdc(perRequest) === 0n) errors.perRequest = "Must be above zero";
  if (!/^\d{1,3}$/.test(rep) || Number(rep) > 100) errors.rep = "0 to 100";
  if (!/^\d+$/.test(hours) || Number(hours) < 1) errors.hours = "Whole hours, at least 1";
  const filled = rows.filter((r) => r.address.trim());
  filled.forEach((r, i) => {
    if (!isKey(r.address)) errors[`m${i}`] = "Not a valid address";
    else if (!isAmount(r.cap) || parseUsdc(r.cap) === 0n) errors[`m${i}`] = "Daily cap above zero";
    else if (new TextEncoder().encode(r.label).length > 24) errors[`m${i}`] = "Label at most 24 bytes";
  });
  const show = (k: string) => (tried ? errors[k] : undefined);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) {
      document.querySelector<HTMLInputElement>("[aria-invalid='true']")?.focus();
      return;
    }
    const agentKey = new PublicKey(agent.trim());
    send.mutate(
      {
        label: "Create session",
        build: async () => {
          const ixs = [
            await createSessionIx(program, owner, agentKey, {
              perRequestCap: toBN(parseUsdc(perRequest)),
              dailyCap: toBN(parseUsdc(daily)),
              otherDailyCap: toBN(parseUsdc(other)),
              minReputation: Number(rep),
              expiresAt: toBN(Math.floor(Date.now() / 1000) + Number(hours) * 3600),
              merchants: filled.map((r) => ({
                merchant: new PublicKey(r.address.trim()),
                label: r.label.trim(),
                dailyCap: toBN(parseUsdc(r.cap)),
              })),
            }),
          ];
          if (fundAgent)
            ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: agentKey, lamports: 0.05 * LAMPORTS_PER_SOL }));
          return ixs;
        },
      },
      {
        onSuccess: () => {
          if (name.trim()) saveAgentName(agentKey.toBase58(), name.trim());
          router.push(`/app/sessions/${agentKey.toBase58()}`);
        },
      },
    );
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, help: string, mode = "decimal") => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode={mode as "decimal"}
        autoComplete="off"
        value={value}
        aria-invalid={!!show(id)}
        onChange={(e) => set(e.target.value)}
      />
      <small className={`help${show(id) ? " help--error" : ""}`}>{show(id) ?? help}</small>
    </div>
  );

  const expiryText = expiry === "custom" ? `${customHours || "?"} hours` : EXPIRIES.find(([k]) => k === expiry)?.[1];
  const listedNames = filled.map((r) => r.label.trim() || `${r.address.trim().slice(0, 4)}…`);

  return (
    <>
      <PageHead title="New session" sub="The program enforces every number on this form, on every payment." />
      <form className="form-layout" onSubmit={submit} noValidate>
        <div className="col">
          <fieldset className="well fieldset">
            <legend>Agent</legend>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" autoComplete="off" placeholder="Claude Desktop" value={name} onChange={(e) => setName(e.target.value)} />
                <small className="help">Only kept in this browser, to tell sessions apart.</small>
              </div>
              <div className="field">
                <label htmlFor="agent">Agent public key</label>
                <input
                  id="agent"
                  name="agent"
                  type="text"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Printed by the MCP server on start"
                  value={agent}
                  aria-invalid={!!show("agent")}
                  onChange={(e) => setAgent(e.target.value)}
                />
                <small className={`help${show("agent") ? " help--error" : ""}`}>
                  {show("agent") ?? "This key can only spend through agent_pay, within the caps below."}
                </small>
              </div>
            </div>
          </fieldset>

          <fieldset className="well fieldset">
            <legend>Spending caps</legend>
            <div className="choices" role="group" aria-label="Start from a preset">
              {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
                <button key={k} type="button" className={`btn btn--sm ${preset === k ? "btn--ink" : "btn--ghost"}`} aria-pressed={preset === k} onClick={() => applyPreset(k)}>
                  {PRESETS[k].label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              {field("perRequest", "Per request (USDC)", perRequest, edited(setPerRequest), "Above this, the agent must ask you first.")}
              {field("daily", "Per day (USDC)", daily, edited(setDaily), "Across all merchants; resets every 24 hours.")}
            </div>
          </fieldset>

          <fieldset className="well fieldset">
            <legend>
              Listed merchants <span className="muted">(up to {MAX_MERCHANTS})</span>
            </legend>
            {rows.map((r, i) => (
              <div className="merchant-row" key={i}>
                <div className="field">
                  <label htmlFor={`m${i}l`}>Label</label>
                  <input
                    id={`m${i}l`}
                    type="text"
                    autoComplete="off"
                    placeholder="Summary API"
                    value={r.label}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`m${i}a`}>Payee address (x402 payTo)</label>
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
                    autoComplete="off"
                    value={r.cap}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, cap: e.target.value } : x)))}
                  />
                </div>
                <button type="button" className="btn btn--text" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  Remove
                </button>
                {show(`m${filled.indexOf(r)}`) && <small className="help help--error field--wide">{show(`m${filled.indexOf(r)}`)}</small>}
              </div>
            ))}
            {rows.length < MAX_MERCHANTS && (
              <div>
                <button type="button" className="btn btn--text" onClick={() => setRows([...rows, { address: "", label: "", cap: "1.00" }])}>
                  Add merchant
                </button>
              </div>
            )}
          </fieldset>

          <fieldset className="well fieldset">
            <legend>Everyone else</legend>
            <div className="form-grid">
              {field("rep", "Minimum reputation", rep, edited(setRep), "Agent Registry score, 0 to 100, read on-chain.", "numeric")}
              {field("other", "Shared daily cap (USDC)", other, edited(setOther), "0 refuses every merchant not listed above.")}
            </div>
          </fieldset>

          <fieldset className="well fieldset">
            <legend>Expiry</legend>
            <div className="choices" role="radiogroup" aria-label="Session length">
              {EXPIRIES.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={expiry === k}
                  className={`btn btn--sm ${expiry === k ? "btn--ink" : "btn--ghost"}`}
                  onClick={() => {
                    setPreset(null);
                    setExpiry(k);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {expiry === "custom" && field("hours", "Hours", customHours, setCustomHours, "", "numeric")}
            {expiry !== "custom" && show("hours") && <small className="help help--error">{show("hours")}</small>}
          </fieldset>

          <label className="check">
            <input type="checkbox" checked={fundAgent} onChange={(e) => setFundAgent(e.target.checked)} />
            Send the agent 0.05 devnet SOL for fees (refusal records and approval requests)
          </label>

          <div className="submit-row">
            <button type="submit" className="btn btn--primary" disabled={send.isPending} aria-busy={send.isPending}>
              {send.isPending ? "Waiting for Phantom…" : "Create session"}
            </button>
            <p className="muted">
              One signature: <code>create_session</code>
              {fundAgent ? " and a 0.05 SOL transfer" : ""}.
            </p>
          </div>
        </div>

        <aside className="plate rules" aria-labelledby="rules-h">
          <h2 id="rules-h">The rules, in plain words</h2>
          <ul>
            <li>No single payment over {show2(perRequest)} USDC, unless you approve that exact payment.</li>
            <li>No more than {show2(daily)} USDC a day across all merchants.</li>
            {filled.length > 0 ? (
              filled.map((r) => (
                <li key={r.address}>
                  {r.label.trim() || "This merchant"}: up to {show2(r.cap)} USDC a day.
                </li>
              ))
            ) : (
              <li>No merchants listed: every payee goes through the reputation check.</li>
            )}
            {isAmount(other) && parseUsdc(other) === 0n ? (
              <li>Nobody else can be paid.</li>
            ) : (
              <li>
                Anyone else{listedNames.length ? " not listed" : ""} needs an Agent Registry reputation of {rep || "?"} or more, and
                they share {show2(other)} USDC a day.
              </li>
            )}
            <li>The session ends after {expiryText}. You can revoke it or freeze everything at any time.</li>
          </ul>
        </aside>
      </form>
    </>
  );
}
