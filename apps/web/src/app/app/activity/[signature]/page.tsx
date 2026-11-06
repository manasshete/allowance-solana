"use client";

import { useParams } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";

import { describeRefusal, parseAllowanceTx } from "@allowance/client";

import { kindLabel } from "@/components/ActivityTable";
import { Addr, Copy, PageHead, TxLink } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels, usdc, when } from "@/lib/format";
import { useProgram, useSessions } from "@/lib/hooks";

export default function TxDetail() {
  const { signature } = useParams<{ signature: string }>();
  const { connection } = useConnection();
  const program = useProgram();
  const sessions = useSessions();
  const labels = merchantLabels(sessions.data);

  const tx = useQuery({
    queryKey: ["tx", signature],
    queryFn: async () => {
      const t = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      return t ? parseAllowanceTx(program, t) : null;
    },
  });

  if (tx.isLoading) return <Skeleton rows={6} />;
  if (tx.error) return <ErrorState error={tx.error} retry={() => tx.refetch()} />;
  const r = tx.data;
  if (!r) return <EmptyState title="Not an Allowance transaction">Devnet has no Allowance instruction under this signature.</EmptyState>;

  const verdict = r.ok ? (r.kind === "agentPay" ? "Paid" : "Confirmed") : "Refused";
  return (
    <>
      <PageHead
        title={`${kindLabel(r.kind)}: ${verdict}`}
        sub={
          <>
            {when(r.time)} <TxLink sig={r.signature}>Open in Explorer</TxLink> <Copy value={r.signature} />
          </>
        }
      />
      <div className="grid-2">
        <div className="col">
          {!r.ok && (
            <div className="refusal">
              <code>{r.error ?? "Failed"}</code>
              <span>
                {r.error
                  ? `Refused by the chain: ${describeRefusal(r.error, {
                      amount: r.amount,
                      merchant: r.merchant,
                      merchantLabel: r.merchant ? (labels.get(r.merchant) ?? null) : null,
                      session: sessions.data?.find((x) => x.address.toBase58() === r.session)?.account ?? null,
                    })}`
                  : "The transaction failed."}
              </span>
              <span className="refusal__note">Caps shown are the session&apos;s current values.</span>
            </div>
          )}
          <div className="well">
            <dl className="facts">
              <div>
                <dt>Amount</dt>
                <dd>{r.amount !== null ? `${usdc(r.amount)} USDC` : "—"}</dd>
              </div>
              <div>
                <dt>Merchant</dt>
                <dd>{r.merchant ? <Addr value={r.merchant} label={labels.get(r.merchant) ?? null} /> : "—"}</dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{r.session ? <Addr value={r.session} /> : "—"}</dd>
              </div>
              <div>
                <dt>Fee paid by</dt>
                <dd>
                  <Addr value={r.feePayer} />
                </dd>
              </div>
              {r.reputation !== null && (
                <div>
                  <dt>Merchant reputation</dt>
                  <dd>{r.reputation}</dd>
                </div>
              )}
              {r.pending && (
                <div>
                  <dt>Approval used</dt>
                  <dd>
                    <Addr value={r.pending} />
                  </dd>
                </div>
              )}
            </dl>
            {r.reason && (
              <div className="field">
                <span className="muted">The agent&apos;s reason (stored on-chain)</span>
                <p>{r.reason}</p>
              </div>
            )}
          </div>
        </div>
        <section className="col" aria-labelledby="logs-h">
          <h2 id="logs-h">Program logs</h2>
          <pre className="logs">{r.logs.join("\n")}</pre>
        </section>
      </div>
    </>
  );
}
