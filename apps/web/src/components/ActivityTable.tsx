"use client";

import Link from "next/link";

import type { ActivityRow } from "@allowance/client";

import { shortKey, usdc, when } from "@/lib/format";

const KIND: Record<string, string> = {
  agentPay: "Payment",
  requestApproval: "Approval request",
  approvePending: "Approved",
  rejectPending: "Rejected",
  freezeAll: "Freeze all",
  unfreeze: "Unfreeze",
  deposit: "Deposit",
  withdraw: "Withdraw",
  createSession: "Session created",
  revokeSession: "Session revoked",
  closeSession: "Session closed",
  initVault: "Vault created",
};

export const kindLabel = (k: string) => KIND[k] ?? k;

/** The departure board: every transaction the chain answered, refusals filled amber. */
export function ActivityTable({ rows, labels }: { rows: ActivityRow[]; labels: Map<string, string> }) {
  return (
    <table className="feed">
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">What</th>
          <th scope="col">Merchant</th>
          <th scope="col" className="r">
            USDC
          </th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.signature} className={r.ok ? "" : "is-refused"}>
            <td className="num" data-label="Time">
              {when(r.time)}
            </td>
            <td data-label="What">
              <Link href={`/app/activity/${r.signature}`}>{kindLabel(r.kind)}</Link>
              {r.reason && <span className="reason">{r.reason}</span>}
            </td>
            <td data-label="Merchant">{r.merchant ? (labels.get(r.merchant) ?? shortKey(r.merchant)) : "—"}</td>
            <td className="num r figure" data-label="USDC">
              {r.amount !== null ? usdc(r.amount) : ""}
            </td>
            <td data-label="Result">
              <strong>{r.ok ? (r.kind === "agentPay" ? "Paid" : "Done") : "Refused"}</strong>
              {r.error && <span className="rule">{r.error}</span>}
              {r.reputation !== null && <span className="rule">reputation {r.reputation}</span>}
              {r.pending && r.ok && r.kind === "agentPay" && <span className="rule">on approval</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
