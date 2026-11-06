"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";

import { createSessionIx, MAX_MERCHANTS, parseUsdc, toBN } from "@allowance/client";

import { PageHead } from "@/components/Bits";
import { useOwner, useProgram } from "@/lib/hooks";
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

  const [agent, setAgent] = useState("");
  const [perRequest, setPerRequest] = useState("0.05");
  const [daily, setDaily] = useState("2.00");
  const [other, setOther] = useState("0.50");
  const [rep, setRep] = useState("70");
  const [hours, setHours] = useState("24");
  const [fundAgent, setFundAgent] = useState(true);
  const [rows, setRows] = useState<Row[]>([{ address: "", label: "", cap: "1.00" }]);
  const [tried, setTried] = useState(false);

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
      { onSuccess: () => router.push(`/app/sessions/${agentKey.toBase58()}`) },
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

  return (
    <>
      <PageHead title="New session" sub="The program enforces every number on this form, on every payment." />
      <form className="well" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field field--wide">
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
          {field("perRequest", "Per request (USDC)", perRequest, setPerRequest, "Above this, the agent must ask you first.")}
          {field("daily", "Daily cap (USDC)", daily, setDaily, "Across all merchants; resets every 24 hours.")}
          {field("other", "Unlisted merchants, daily", other, setOther, "0 refuses any merchant not listed below.")}
          {field("rep", "Min reputation", rep, setRep, "Agent Registry score for unlisted merchants.", "numeric")}
          {field("hours", "Expires in (hours)", hours, setHours, "", "numeric")}
        </div>

        <fieldset className="col" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend>
            Listed merchants <span className="muted">(up to {MAX_MERCHANTS})</span>
          </legend>
          {rows.map((r, i) => (
            <div className="merchant-row" key={i}>
              <div className="field">
                <label htmlFor={`m${i}a`}>Merchant address (x402 payTo)</label>
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

        <label className="check">
          <input type="checkbox" checked={fundAgent} onChange={(e) => setFundAgent(e.target.checked)} />
          Send the agent 0.05 devnet SOL for fees (refusal records and approval requests)
        </label>

        <div className="submit-row">
          <button type="submit" className="btn btn--primary" disabled={send.isPending} aria-busy={send.isPending}>
            {send.isPending ? "Waiting for Phantom…" : "Create session"}
          </button>
          <p className="muted">
            Signs <code>create_session</code>
            {fundAgent ? " and a 0.05 SOL transfer" : ""} in one transaction.
          </p>
        </div>
      </form>
    </>
  );
}
