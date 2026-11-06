"use client";

import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

import { pendingStatus, resolvePendingIx } from "@allowance/client";

import { Addr, PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels, usdc, when } from "@/lib/format";
import { useOwner, usePendings, useProgram, useReadOnly, useSessions } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

export default function ApprovalDetail() {
  const { pending } = useParams<{ pending: string }>();
  const owner = useOwner()!;
  const program = useProgram();
  const pendings = usePendings();
  const sessions = useSessions();
  const readOnly = useReadOnly();
  const approve = useSend();
  const reject = useSend();

  if (pendings.isLoading || sessions.isLoading) return <Skeleton rows={5} />;
  if (pendings.error) return <ErrorState error={pendings.error} retry={() => pendings.refetch()} />;
  const row = pendings.data?.find((p) => p.address.toBase58() === pending);
  if (!row) return <EmptyState title="No such request">This vault has no approval request at {pending}.</EmptyState>;

  const p = row.account;
  const s = sessions.data?.find((x) => x.address.equals(p.session))?.account;
  const status = pendingStatus(p);
  const labels = merchantLabels(sessions.data);
  const merchant = p.merchant.toBase58();
  const amount = BigInt(p.amount.toString());
  const after = s ? BigInt(s.spentToday.toString()) + amount : null;
  const fitsDaily = s && after !== null ? after <= BigInt(s.dailyCap.toString()) : null;
  const busy = approve.isPending || reject.isPending;
  const act = (yes: boolean) =>
    (yes ? approve : reject).mutate({
      label: yes ? "Approve" : "Reject",
      build: async () => [await resolvePendingIx(program, owner, p.session, new PublicKey(pending), yes)],
    });

  return (
    <>
      <PageHead title={`Approval request: ${status}`} sub={`Asked ${when(p.createdAt.toNumber())}`} />
      <div className="grid-even">
        <div className="plate">
          <div className="plate__head">
            <h2>Pay {labels.get(merchant) ?? "this merchant"}</h2>
          </div>
          <p className="plate__figure">
            <span className="figure">{usdc(p.amount)}</span> <span>USDC</span>
          </p>
          <p className="plate__note">&ldquo;{p.reason}&rdquo;</p>
        </div>
        <div className="well">
          <dl className="facts">
            <div>
              <dt>Merchant</dt>
              <dd>
                <Addr value={merchant} />
              </dd>
            </div>
            <div>
              <dt>Per-request cap</dt>
              <dd>{s ? usdc(s.perRequestCap) : "—"}</dd>
            </div>
            <div>
              <dt>Spent today after this</dt>
              <dd>{s && after !== null ? `${usdc(after)} / ${usdc(s.dailyCap)}` : "—"}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>
                <Addr value={p.session.toBase58()} />
              </dd>
            </div>
          </dl>
          {fitsDaily === false && (
            <p className="help help--error">
              Even approved, this would be refused today: it passes the session&apos;s daily cap.
            </p>
          )}
          {status === "open" && readOnly ? (
            <p className="muted">Waiting for the owner. Connect Phantom as the owner to approve or reject.</p>
          ) : status === "open" ? (
            <div className="confirm__actions">
              <button type="button" className="btn btn--primary" disabled={busy} aria-busy={approve.isPending} onClick={() => act(true)}>
                {approve.isPending ? "Waiting for Phantom…" : "Approve once"}
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} aria-busy={reject.isPending} onClick={() => act(false)}>
                {reject.isPending ? "Waiting for Phantom…" : "Reject"}
              </button>
            </div>
          ) : (
            <p className="muted">
              {status === "approved" && "Approved. The agent's next payment of exactly this amount to this merchant goes through once."}
              {status === "used" && `Used on ${when(p.resolvedAt.toNumber())}.`}
              {status === "rejected" && `Rejected on ${when(p.resolvedAt.toNumber())}.`}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
