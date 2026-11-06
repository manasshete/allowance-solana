"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ActivityTable } from "@/components/ActivityTable";
import { PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels } from "@/lib/format";
import { useActivity, useSessions } from "@/lib/hooks";

const FILTERS = [
  ["all", "All"],
  ["paid", "Paid"],
  ["refused", "Refused"],
  ["owner", "Owner actions"],
] as const;

function Board() {
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const merchant = params.get("merchant");
  const limit = Math.min(200, Number(params.get("limit") ?? 25) || 25);
  const activity = useActivity(limit);
  const sessions = useSessions();
  const labels = merchantLabels(sessions.data);

  const rows = (activity.data ?? []).filter((r) => {
    if (merchant && r.merchant !== merchant) return false;
    if (status === "paid") return r.ok && r.kind === "agentPay";
    if (status === "refused") return !r.ok;
    if (status === "owner") return r.kind !== "agentPay" && r.kind !== "requestApproval";
    return true;
  });
  const href = (s: string) => `/app/activity?status=${s}${merchant ? `&merchant=${merchant}` : ""}`;

  return (
    <section className="board" aria-labelledby="act-h">
      <div className="board__head">
        <div>
          <h2 id="act-h">What the chain said</h2>
          <p className="board__sub">
            Every transaction that touched your vault, read from devnet. Refusals are failed transactions carrying the rule.
            {merchant && (
              <>
                {" "}
                Showing {labels.get(merchant) ?? merchant}. <Link href={`/app/activity?status=${status}`}>Clear</Link>
              </>
            )}
          </p>
        </div>
        <nav className="filters" aria-label="Filter activity">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={href(k)} className={status === k ? "is-active" : ""} aria-current={status === k ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {activity.isLoading ? (
        <Skeleton rows={6} onInk />
      ) : activity.error ? (
        <ErrorState error={activity.error} retry={() => activity.refetch()} />
      ) : rows.length ? (
        <>
          <ActivityTable rows={rows} labels={labels} />
          {activity.data && activity.data.length >= limit && limit < 200 && (
            <Link className="btn btn--on-ink" href={`${href(status)}&limit=${limit + 25}`}>
              Load more
            </Link>
          )}
        </>
      ) : (
        <EmptyState title="Nothing matches">Change the filter, or ask your agent to call a paid API.</EmptyState>
      )}
    </section>
  );
}

export default function ActivityPage() {
  return (
    <>
      <PageHead title="Activity" sub="Filters and paging live in the URL, so a view can be shared." />
      <Suspense fallback={<Skeleton rows={6} />}>
        <Board />
      </Suspense>
    </>
  );
}
