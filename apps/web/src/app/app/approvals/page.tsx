"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { pendingStatus } from "@allowance/client";

import { PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels, shortKey, usdc, when } from "@/lib/format";
import { usePendings, useSessions } from "@/lib/hooks";

function List() {
  const tab = useSearchParams().get("tab") === "resolved" ? "resolved" : "open";
  const router = useRouter();
  const pendings = usePendings();
  const sessions = useSessions();
  const labels = merchantLabels(sessions.data);
  const capOf = new Map(sessions.data?.map((s) => [s.address.toBase58(), s.account.perRequestCap]) ?? []);

  const rows = (pendings.data ?? [])
    .filter((p) => (tab === "open" ? pendingStatus(p.account) === "open" : pendingStatus(p.account) !== "open"))
    .sort((a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());

  return (
    <>
      <nav className="filters filters--paper" aria-label="Approval status">
        {(["open", "resolved"] as const).map((t) => (
          <Link key={t} href={`/app/approvals?tab=${t}`} className={`btn btn--sm ${tab === t ? "btn--ink" : "btn--ghost"}`} aria-current={tab === t ? "page" : undefined}>
            {t === "open" ? "Open" : "Resolved"}
          </Link>
        ))}
      </nav>
      {pendings.isLoading ? (
        <Skeleton />
      ) : pendings.error ? (
        <ErrorState error={pendings.error} retry={() => pendings.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === "open" ? "Nothing waiting for you" : "No resolved requests"}>
          When a payment is over the per-request cap, the agent can ask with request_approval. It shows up here.
        </EmptyState>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Asked</th>
              <th scope="col">Merchant</th>
              <th scope="col" className="r">
                Amount
              </th>
              <th scope="col" className="r">
                Cap
              </th>
              <th scope="col">Reason</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ address, account: p }) => {
              const href = `/app/approvals/${address.toBase58()}`;
              const m = p.merchant.toBase58();
              return (
                <tr key={href} className="is-link" onClick={() => router.push(href)}>
                  <td data-label="Asked">
                    <Link href={href}>{when(p.createdAt.toNumber())}</Link>
                  </td>
                  <td data-label="Merchant">{labels.get(m) ?? shortKey(m)}</td>
                  <td className="r num" data-label="Amount">
                    {usdc(p.amount)}
                  </td>
                  <td className="r num" data-label="Cap">
                    {usdc(capOf.get(p.session.toBase58()))}
                  </td>
                  <td data-label="Reason">{p.reason}</td>
                  <td data-label="Status">{pendingStatus(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function Approvals() {
  return (
    <>
      <PageHead title="Approvals" sub="Over-cap payments your agent asked for. An approval works once, for that merchant and amount." />
      <Suspense fallback={<Skeleton />}>
        <List />
      </Suspense>
    </>
  );
}
