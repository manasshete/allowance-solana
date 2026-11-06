"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { closeSessionIx, revokeSessionIx, sessionPda } from "@allowance/client";

import { ActivityTable } from "@/components/ActivityTable";
import { Addr, ConfirmInline, Meter, PageHead } from "@/components/Bits";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { merchantLabels, sessionStatus, timeLeft, usdc, when } from "@/lib/format";
import { useActivity, useOwner, useProgram, useReadOnly, useSessions, useVault } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

export default function SessionDetail() {
  const { agent } = useParams<{ agent: string }>();
  const owner = useOwner()!;
  const program = useProgram();
  const { connection } = useConnection();
  const vault = useVault();
  const sessions = useSessions();
  const activity = useActivity(25);
  const readOnly = useReadOnly();
  const revoke = useSend();
  const close = useSend();

  let agentKey: PublicKey | null = null;
  try {
    agentKey = new PublicKey(agent);
  } catch {}
  const address = agentKey && vault.address ? sessionPda(vault.address, agentKey) : null;
  const row = sessions.data?.find((s) => address && s.address.equals(address));

  const agentSol = useQuery({
    queryKey: ["sol", agent],
    enabled: !!agentKey,
    queryFn: async () => (await connection.getBalance(agentKey!)) / LAMPORTS_PER_SOL,
  });

  if (sessions.isLoading) return <Skeleton rows={6} />;
  if (sessions.error) return <ErrorState error={sessions.error} retry={() => sessions.refetch()} />;
  if (!row || !address)
    return (
      <EmptyState title="No session for this agent" action={<Link className="btn btn--primary" href="/app/sessions/new">New session</Link>}>
        This vault has no session for {agent}.
      </EmptyState>
    );

  const s = row.account;
  const st = sessionStatus(s);
  const labels = merchantLabels(sessions.data);
  const mine = activity.data?.filter((r) => r.session === address.toBase58()) ?? [];

  return (
    <>
      <PageHead
        title="Agent session"
        sub={
          <>
            Agent <Addr value={agent} /> <span className={`pill ${st === "active" ? "pill--live" : "pill--muted"}`}>{st}</span>
          </>
        }
      />
      <div className="grid-2">
        <div className="col">
          <div className="well">
            <Meter label="Spent today" spent={s.spentToday} cap={s.dailyCap} text={`${usdc(s.spentToday)} / ${usdc(s.dailyCap)}`} />
            {s.merchants.map((m) => (
              <Meter
                key={m.merchant.toBase58()}
                label={m.label || m.merchant.toBase58().slice(0, 8)}
                spent={m.spentToday}
                cap={m.dailyCap}
                text={`${usdc(m.spentToday)} / ${usdc(m.dailyCap)}`}
              />
            ))}
            <Meter
              label="Unlisted merchants"
              spent={s.otherSpentToday}
              cap={s.otherDailyCap}
              text={s.otherDailyCap.isZero() ? "not allowed" : `${usdc(s.otherSpentToday)} / ${usdc(s.otherDailyCap)}`}
            />
            <dl className="facts">
              <div>
                <dt>Per request</dt>
                <dd>{usdc(s.perRequestCap)}</dd>
              </div>
              <div>
                <dt>Min reputation</dt>
                <dd>{s.minReputation}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{timeLeft(s.expiresAt.toNumber())}</dd>
              </div>
              <div>
                <dt>Total paid</dt>
                <dd>{usdc(s.totalPaid)}</dd>
              </div>
              <div>
                <dt>Agent SOL (fees)</dt>
                <dd>{agentSol.data === undefined ? "…" : agentSol.data.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{when(s.createdAt.toNumber())}</dd>
              </div>
            </dl>
            {readOnly ? null : st === "active" ? (
              <ConfirmInline
                label="Revoke session"
                confirmLabel="Revoke now"
                busy={revoke.isPending}
                message="The agent can no longer pay or ask for approvals. This can't be undone; create a new session to resume."
                onConfirm={() => revoke.mutate({ label: "Revoke session", build: async () => [await revokeSessionIx(program, owner, address)] })}
              />
            ) : (
              <ConfirmInline
                label="Close session and reclaim rent"
                confirmLabel="Close now"
                busy={close.isPending}
                message="Deletes the session account and returns its rent to your wallet. Its history stays on-chain."
                onConfirm={() => close.mutate({ label: "Close session", build: async () => [await closeSessionIx(program, owner, address)] })}
              />
            )}
          </div>
        </div>

        <section className="board" aria-labelledby="s-act">
          <div className="board__head">
            <h2 id="s-act">This session&apos;s activity</h2>
          </div>
          {activity.isLoading ? (
            <Skeleton onInk />
          ) : activity.error ? (
            <ErrorState error={activity.error} retry={() => activity.refetch()} />
          ) : mine.length ? (
            <ActivityTable rows={mine} labels={labels} />
          ) : (
            <EmptyState title="No payments yet">Ask your agent to call a paid API; it lands here in about a second.</EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
