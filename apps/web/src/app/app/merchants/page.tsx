"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { sessionStatus, shortKey, usdc } from "@/lib/format";
import { useActivity, useSessions } from "@/lib/hooks";

type Row = { address: string; label: string; sessions: number; cap: bigint; spent: bigint; paid: bigint };

export default function Merchants() {
  const sessions = useSessions();
  const activity = useActivity(50);
  const router = useRouter();

  const byAddr = new Map<string, Row>();
  for (const { account: s } of sessions.data ?? []) {
    const live = sessionStatus(s) === "active";
    for (const m of s.merchants) {
      const a = m.merchant.toBase58();
      const r = byAddr.get(a) ?? { address: a, label: m.label, sessions: 0, cap: 0n, spent: 0n, paid: 0n };
      r.label ||= m.label;
      if (live) {
        r.sessions += 1;
        r.cap += BigInt(m.dailyCap.toString());
        r.spent += BigInt(m.spentToday.toString());
      }
      byAddr.set(a, r);
    }
  }
  // merchants paid without being listed (the reputation gate let them through)
  for (const r of activity.data ?? []) {
    if (!r.merchant || !r.ok || r.kind !== "agentPay" || r.amount === null) continue;
    const row = byAddr.get(r.merchant) ?? { address: r.merchant, label: "", sessions: 0, cap: 0n, spent: 0n, paid: 0n };
    row.paid += r.amount;
    byAddr.set(r.merchant, row);
  }
  const rows = [...byAddr.values()].sort((a, b) => Number(b.paid - a.paid));

  return (
    <>
      <PageHead title="Merchants" sub="Who your agents may pay: listed in a session, or paid after passing the reputation gate." />
      {sessions.isLoading ? (
        <Skeleton />
      ) : sessions.error ? (
        <ErrorState error={sessions.error} retry={() => sessions.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No merchants yet" action={<Link className="btn btn--primary" href="/app/sessions/new">New session</Link>}>
          List a merchant&apos;s x402 payTo address when you create a session.
        </EmptyState>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Merchant</th>
              <th scope="col">Listed in</th>
              <th scope="col" className="r">
                Today / cap
              </th>
              <th scope="col" className="r">
                Paid (recent)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = `/app/merchants/${r.address}`;
              return (
                <tr key={r.address} className="is-link" onClick={() => router.push(href)}>
                  <td data-label="Merchant">
                    <Link href={href}>{r.label || shortKey(r.address, 6)}</Link>
                  </td>
                  <td data-label="Listed in">{r.sessions ? `${r.sessions} active session${r.sessions > 1 ? "s" : ""}` : "unlisted"}</td>
                  <td className="r num" data-label="Today / cap">
                    {r.sessions ? `${usdc(r.spent)} / ${usdc(r.cap)}` : "shared cap"}
                  </td>
                  <td className="r num" data-label="Paid (recent)">
                    {activity.isLoading ? "…" : usdc(r.paid)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
