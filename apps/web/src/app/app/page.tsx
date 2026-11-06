"use client";

import Link from "next/link";

import { pendingStatus } from "@allowance/client";

import { ActivityTable } from "@/components/ActivityTable";
import { PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels, sessionStatus, usdc } from "@/lib/format";
import { useActivity, usePendings, useSessions, useVault } from "@/lib/hooks";

export default function Overview() {
  const vault = useVault();
  const sessions = useSessions();
  const pendings = usePendings();
  const activity = useActivity(10);

  const v = vault.data?.account;
  const active = sessions.data?.filter((s) => sessionStatus(s.account) === "active") ?? [];
  const spentToday = active.reduce((sum, s) => sum + BigInt(s.account.spentToday.toString()), 0n);
  const open = pendings.data?.filter((p) => pendingStatus(p.account) === "open").length ?? 0;
  const labels = merchantLabels(sessions.data);

  return (
    <>
      <PageHead title="Overview" sub="Your vault, your agents and what the chain said, newest first." />

      <div className="grid-2">
        <div className="col">
          <div className="plate">
            <div className="plate__head">
              <h2>Vault</h2>
              <span className="pill pill--on-ink">{v?.frozen ? "Frozen" : "Open"}</span>
            </div>
            <p className="plate__figure">
              <span className="figure">{usdc(vault.data?.balance)}</span> <span>USDC</span>
            </p>
            <p className="plate__note">
              <Link href="/app/vault">Deposit, withdraw or freeze</Link>
            </p>
          </div>
          <dl className="stats">
            <Link className="stat" href="/app/sessions">
              <dt>Active sessions</dt>
              <dd>{sessions.isLoading ? "…" : active.length}</dd>
            </Link>
            <Link className="stat" href="/app/sessions">
              <dt>Spent today</dt>
              <dd>{sessions.isLoading ? "…" : usdc(spentToday)}</dd>
            </Link>
            <Link className="stat" href="/app/approvals">
              <dt>Open approvals</dt>
              <dd>{pendings.isLoading ? "…" : open}</dd>
            </Link>
          </dl>
        </div>

        <section className="board" aria-labelledby="recent-h">
          <div className="board__head">
            <div>
              <h2 id="recent-h">What the chain said</h2>
              <p className="board__sub">The last 10 transactions that touched your vault.</p>
            </div>
            <Link href="/app/activity">All activity</Link>
          </div>
          {activity.isLoading ? (
            <Skeleton onInk />
          ) : activity.error ? (
            <ErrorState error={activity.error} retry={() => activity.refetch()} />
          ) : activity.data?.length ? (
            <ActivityTable rows={activity.data} labels={labels} />
          ) : (
            <EmptyState title="Nothing yet" action={<Link className="btn btn--on-ink" href="/app/sessions/new">Create a session</Link>}>
              Create a session for your agent, then ask it to call a paid API. Each payment lands here in about a second.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
