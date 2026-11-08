"use client";

import Link from "next/link";

import { pendingStatus, resolvePendingIx } from "@allowance/client";

import { Card3D } from "@/components/Card3D";
import { ErrorState, Skeleton } from "@/components/States";
import { formatTime, usdc } from "@/lib/format";
import { useOwner, usePendings, useProgram, useReadOnly, useSessions } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

export default function ApprovalsPage() {
  const owner = useOwner()!;
  const program = useProgram();
  const readOnly = useReadOnly();
  const pendings = usePendings();
  const sessions = useSessions();
  const send = useSend();

  const all = pendings.data ?? [];
  const open = all.filter((p) => pendingStatus(p.account) === "open");
  const resolved = all.filter((p) => pendingStatus(p.account) !== "open");

  const handleResolve = async (p: (typeof all)[0], approve: boolean) => {
    if (readOnly) return;
    try {
      const ix = await resolvePendingIx(program, owner, p.account.session, p.address, approve);
      await send.mutateAsync({
        label: `${approve ? "Approve" : "Reject"} payment request`,
        build: async () => [ix],
      });
      pendings.refetch();
    } catch {
      /* handled by useSend */
    }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Approvals</h1>
          <p className="muted">
            Payments above a session&apos;s per-request cap wait here until you approve or reject them. An approval works
            once, for that merchant and amount.
          </p>
        </div>
      </div>

      {pendings.isLoading ? (
        <Skeleton onInk />
      ) : pendings.error ? (
        <ErrorState error={pendings.error} retry={() => pendings.refetch()} />
      ) : (
        <div className="grid-2">
          {/* Left Column: Pending Queue */}
          <div className="col">
            <div className="split-head">
              <h2 className="split-title">Waiting for you</h2>
              <span className="split-count figure">{open.length}</span>
            </div>

            {open.length === 0 ? (
              <div className="dashed-box">No pending approvals.</div>
            ) : (
              <div className="approval-list">
                {open.map((p) => (
                  <Card3D key={p.address.toBase58()} intensity={10} glare={false}>
                    <div className="plate approval-item">
                      <div className="approval-head">
                        <span className="figure text-mint">{usdc(p.account.amount)} USDC</span>
                        <span className="pill pill--on-ink text-ok">Open</span>
                      </div>
                      <p className="approval-merchant addr mono-id">
                        To: {p.account.merchant.toBase58()}
                      </p>
                      <p className="approval-reason">&ldquo;{p.account.reason}&rdquo;</p>
                      {!readOnly && (
                        <div className="approval-actions">
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => handleResolve(p, true)}
                          >
                            Approve once
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => handleResolve(p, false)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </Card3D>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Approval History */}
          <div className="col">
            <div className="split-head">
              <h2 className="split-title">Resolved</h2>
              <span className="split-count figure">{resolved.length}</span>
            </div>

            {resolved.length === 0 ? (
              <div className="dashed-box">No resolved approvals yet.</div>
            ) : (
              <div className="approval-list">
                {resolved.map((p) => {
                  const status = pendingStatus(p.account);
                  return (
                    <Card3D key={p.address.toBase58()} intensity={8} glare={false}>
                      <div className="plate approval-item">
                        <div className="approval-head">
                          <span className="figure">{usdc(p.account.amount)} USDC</span>
                          <span
                            className={`pill pill--on-ink ${
                              status === "approved" || status === "used"
                                ? "text-mint"
                                : "text-danger"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="approval-merchant addr mono-id">
                          To: {p.account.merchant.toBase58()}
                        </p>
                        <p className="approval-reason muted">&ldquo;{p.account.reason}&rdquo;</p>
                        <span className="approval-time muted">
                          Resolved {formatTime(p.account.resolvedAt.toNumber())}
                        </span>
                      </div>
                    </Card3D>
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
