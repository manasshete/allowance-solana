"use client";

import { useMemo } from "react";
import Link from "next/link";

import { explorerTx } from "@allowance/client";

import { Card3D } from "@/components/Card3D";
import { ErrorState, Skeleton } from "@/components/States";
import { formatTime, merchantLabels, usdc } from "@/lib/format";
import { useActivity, useSessions } from "@/lib/hooks";

export default function ActivityPage() {
  const activity = useActivity(50);
  const sessions = useSessions();
  const labels = useMemo(() => merchantLabels(sessions.data), [sessions.data]);

  const all = activity.data ?? [];
  const allowanceTransfers = all.filter((r) => r.kind === "agentPay");
  const onChainAccountRows = all;

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Activity</h1>
          <p className="muted">
            Every payment your agents made or were refused, and every action on your vault, read from the chain.
          </p>
        </div>
      </div>

      {activity.isLoading ? (
        <Skeleton onInk />
      ) : activity.error ? (
        <ErrorState error={activity.error} retry={() => activity.refetch()} />
      ) : (
        <div className="grid-2">
          {/* Left Column: Allowance Transfers */}
          <div className="col">
            <div className="split-head">
              <h2 className="split-title">Agent payments</h2>
              <span className="split-count figure">{allowanceTransfers.length}</span>
            </div>

            {allowanceTransfers.length === 0 ? (
              <div className="dashed-box">No Allowance transfers yet.</div>
            ) : (
              <div className="activity-list">
                {allowanceTransfers.map((r) => (
                  <Card3D key={r.signature} intensity={8} glare={false}>
                    <div className="plate activity-item">
                      <div className="activity-item__top">
                        <span className="figure text-mint">
                          {r.amount !== null ? `${usdc(r.amount)} USDC` : "—"}
                        </span>
                        <span
                          className={`pill pill--on-ink ${
                            r.ok ? "text-ok" : "text-refused"
                          }`}
                        >
                          {r.ok ? "Paid" : `Refused: ${r.error || "Denied"}`}
                        </span>
                      </div>
                      <p className="activity-item__reason">&ldquo;{r.reason || "Payment"}&rdquo;</p>
                      <div className="activity-item__meta">
                        <span className="muted">{formatTime(r.time)}</span>
                        <a
                          href={explorerTx(r.signature)}
                          target="_blank"
                          rel="noreferrer"
                          className="mono-id text-mint"
                        >
                          {r.signature.slice(0, 6)}...{r.signature.slice(-6)}
                        </a>
                      </div>
                    </div>
                  </Card3D>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Solana Allocation Account Activity */}
          <div className="col">
            <div className="split-head">
              <h2 className="split-title">Everything on your vault</h2>
              <span className="split-count figure">{onChainAccountRows.length}</span>
            </div>

            {onChainAccountRows.length === 0 ? (
              <div className="dashed-box">No on-chain activity yet.</div>
            ) : (
              <div className="onchain-table-card">
                {onChainAccountRows.map((r) => {
                  let badge = r.ok ? "Done" : `Refused: ${r.error ?? "failed"}`;
                  let badgeClass = "badge-cyan";
                  let title = "Transaction";

                  if (r.kind === "agentPay") {
                    badge = r.ok ? "Paid" : `Refused: ${r.error ?? "failed"}`;
                    badgeClass = "badge-cyan";
                    title = r.amount !== null ? `${usdc(r.amount)} USDC` : "Payment";
                  } else if (r.kind === "createSession") {
                    badge = "Session";
                    badgeClass = "badge-purple";
                    title = "Session created";
                  } else if (r.kind === "initVault" || r.kind === "deposit" || r.kind === "withdraw") {
                    badge = "Vault";
                    badgeClass = "badge-green";
                    title = r.kind === "initVault" ? "Vault created" : r.kind === "deposit" ? "Deposit" : "Withdrawal";
                  } else if (r.kind === "requestApproval") {
                    badge = "Approval";
                    badgeClass = "badge-amber";
                    title = "Approval requested";
                  }

                  return (
                    <div key={r.signature} className="onchain-row">
                      <div className="onchain-row__main">
                        <div className="onchain-row__line">
                          <span className="onchain-row__title figure">{title}</span>
                          <span className={`pill-badge ${badgeClass}`}>{badge}</span>
                        </div>
                        <span className="onchain-row__time muted">
                          {formatTime(r.time)}
                        </span>
                      </div>

                      <a
                        href={explorerTx(r.signature)}
                        target="_blank"
                        rel="noreferrer"
                        className="onchain-row__hash mono-id"
                      >
                        {r.signature.slice(0, 6)}...{r.signature.slice(-6)}
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
