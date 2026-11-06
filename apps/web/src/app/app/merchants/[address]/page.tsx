"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMutation } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";

import { fetchReputation, type Reputation } from "@allowance/client";

import { ActivityTable } from "@/components/ActivityTable";
import { Addr, Copy, PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels, sessionStatus, shortKey, usdc } from "@/lib/format";
import { useActivity, useSessions } from "@/lib/hooks";

export default function MerchantDetail() {
  const { address } = useParams<{ address: string }>();
  const { connection } = useConnection();
  const sessions = useSessions();
  const activity = useActivity(50);
  const labels = merchantLabels(sessions.data);
  const [asset, setAsset] = useState("");

  const lookup = useMutation({
    mutationFn: async (a: string): Promise<Reputation | null> => fetchReputation(connection, new PublicKey(a.trim())),
  });

  const listings = (sessions.data ?? []).flatMap(({ account: s }) =>
    s.merchants.filter((m) => m.merchant.toBase58() === address).map((m) => ({ s, m })),
  );
  const rows = activity.data?.filter((r) => r.merchant === address) ?? [];
  const minRep = Math.max(0, ...(sessions.data ?? []).filter((x) => sessionStatus(x.account) === "active").map((x) => x.account.minReputation));
  const rep = lookup.data;

  return (
    <>
      <PageHead
        title={labels.get(address) ?? "Merchant"}
        sub={
          <>
            <Addr value={address} label={shortKey(address, 8)} /> <Copy value={address} />
          </>
        }
        actions={
          <Link className="btn btn--ghost" href={`/app/activity?merchant=${address}`}>
            Filter activity
          </Link>
        }
      />
      <div className="grid-2">
        <div className="col">
          <div className="well">
            <h2>Caps</h2>
            {sessions.isLoading ? (
              <Skeleton rows={2} />
            ) : listings.length ? (
              <dl className="facts">
                {listings.map(({ s, m }) => (
                  <div key={s.agent.toBase58()}>
                    <dt>
                      Session <Link href={`/app/sessions/${s.agent.toBase58()}`}>{shortKey(s.agent)}</Link>
                    </dt>
                    <dd>
                      {usdc(m.spentToday)} / {usdc(m.dailyCap)} today
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">Not listed in any session. Agents can pay it only through the shared unlisted cap, if it passes the reputation gate.</p>
            )}
          </div>

          <form
            className="well"
            onSubmit={(e) => {
              e.preventDefault();
              if (asset.trim()) lookup.mutate(asset);
            }}
          >
            <h2>Reputation</h2>
            <div className="field">
              <label htmlFor="asset">Agent Registry asset</label>
              <input id="asset" type="text" spellCheck={false} autoComplete="off" value={asset} onChange={(e) => setAsset(e.target.value)} />
              <small className="help">The merchant&apos;s 8004 agent asset; the program reads the same accounts.</small>
            </div>
            <div>
              <button type="submit" className="btn btn--ghost" disabled={lookup.isPending || !asset.trim()}>
                {lookup.isPending ? "Reading…" : "Read reputation"}
              </button>
            </div>
            {lookup.error && <p className="help help--error">{(lookup.error as Error).message}</p>}
            {lookup.isSuccess && !rep && <p className="muted">No registry entry for that asset on devnet.</p>}
            {rep && (
              <dl className="facts">
                <div>
                  <dt>Score</dt>
                  <dd>
                    {rep.score} {minRep ? (rep.score >= minRep ? "(passes)" : `(below ${minRep})`) : ""}
                  </dd>
                </div>
                <div>
                  <dt>Feedback</dt>
                  <dd>{rep.feedbackCount.toString()}</dd>
                </div>
                <div>
                  <dt>Registered wallet</dt>
                  <dd>{rep.wallet === address ? "matches this merchant" : rep.wallet ? `different (${shortKey(rep.wallet)})` : "none"}</dd>
                </div>
              </dl>
            )}
          </form>
        </div>

        <section className="board" aria-labelledby="m-act">
          <div className="board__head">
            <h2 id="m-act">Payments to this merchant</h2>
          </div>
          {activity.isLoading ? (
            <Skeleton onInk />
          ) : activity.error ? (
            <ErrorState error={activity.error} retry={() => activity.refetch()} />
          ) : rows.length ? (
            <ActivityTable rows={rows} labels={labels} />
          ) : (
            <EmptyState title="No payments yet">Nothing in the last 50 transactions of your vault.</EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
