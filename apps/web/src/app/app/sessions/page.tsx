"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { sessionStatus, shortKey, timeLeft, usdc } from "@/lib/format";
import { useReadOnly, useSessions } from "@/lib/hooks";
import { useAgentNames } from "@/lib/names";

export default function Sessions() {
  const sessions = useSessions();
  const router = useRouter();
  const readOnly = useReadOnly();
  const names = useAgentNames();
  const rows = [...(sessions.data ?? [])].sort((a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());
  return (
    <>
      <PageHead
        title="Sessions"
        sub="Each agent key gets one session: its caps, merchants and expiry."
        actions={
          readOnly ? undefined : (
            <Link className="btn btn--primary" href="/app/sessions/new">
              New session
            </Link>
          )
        }
      />
      {sessions.isLoading ? (
        <Skeleton />
      ) : sessions.error ? (
        <ErrorState error={sessions.error} retry={() => sessions.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No sessions yet" action={<Link className="btn btn--primary" href="/app/sessions/new">New session</Link>}>
          Start the MCP server, copy the agent key it prints, and create a session for it.
        </EmptyState>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Status</th>
              <th scope="col" className="r">
                Spent today
              </th>
              <th scope="col" className="r">
                Per request
              </th>
              <th scope="col">Expires</th>
              <th scope="col" className="r">
                Total paid
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ account: s }) => {
              const href = `/app/sessions/${s.agent.toBase58()}`;
              const st = sessionStatus(s);
              return (
                <tr key={href} className="is-link" onClick={() => router.push(href)}>
                  <td data-label="Agent">
                    <Link href={href}>{names[s.agent.toBase58()] ?? shortKey(s.agent, 6)}</Link>
                  </td>
                  <td data-label="Status">
                    <span className={`pill ${st === "active" ? "pill--live" : st === "revoked" ? "pill--error" : "pill--muted"}`}>{st}</span>
                  </td>
                  <td className="r num" data-label="Spent today">
                    {usdc(s.spentToday)} / {usdc(s.dailyCap)}
                  </td>
                  <td className="r num" data-label="Per request">
                    {usdc(s.perRequestCap)}
                  </td>
                  <td data-label="Expires">{timeLeft(s.expiresAt.toNumber())}</td>
                  <td className="r num" data-label="Total paid">
                    {usdc(s.totalPaid)}
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
