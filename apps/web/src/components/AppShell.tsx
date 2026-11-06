"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

import { setFrozenIx } from "@allowance/client";

import { DEMO_OWNER } from "@/lib/config";
import { useLiveUpdates, useOwner, usePendings, useProgram, useReadOnly, useVault, ViewOwnerContext } from "@/lib/hooks";
import { useSend } from "@/lib/tx";
import { pendingStatus } from "@allowance/client";

import { EmptyState, ErrorState, Skeleton } from "./States";
import { TopBar } from "./TopBar";
import { CreateVault } from "./CreateVault";

const TABS = [
  ["/app", "Overview"],
  ["/app/vault", "Vault"],
  ["/app/sessions", "Sessions"],
  ["/app/activity", "Activity"],
  ["/app/approvals", "Approvals"],
  ["/app/merchants", "Merchants"],
] as const;

const VIEW_KEY = "allowance:view";

export function AppShell({ children }: { children: ReactNode }) {
  const [view, setView] = useState<PublicKey | null>(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("view");
      const s = q ?? sessionStorage.getItem(VIEW_KEY);
      if (!s) return;
      const pk = new PublicKey(s);
      sessionStorage.setItem(VIEW_KEY, s);
      setView(pk);
    } catch {
      /* not an address, or storage blocked: stay on the connect gate */
    }
  }, []);
  return (
    <ViewOwnerContext.Provider value={view}>
      <TopBar app />
      <Gate onLeaveView={() => {
        try {
          sessionStorage.removeItem(VIEW_KEY);
        } catch {}
        setView(null);
      }}>{children}</Gate>
    </ViewOwnerContext.Provider>
  );
}

function Gate({ children, onLeaveView }: { children: ReactNode; onLeaveView: () => void }) {
  const owner = useOwner();
  const readOnly = useReadOnly();
  const modal = useWalletModal();
  const vault = useVault();

  if (!owner)
    return (
      <main className="container page">
        <EmptyState
          title="Connect Phantom to manage your vault"
          action={
            <div className="hero__actions">
              <button type="button" className="btn btn--primary" onClick={() => modal.setVisible(true)}>
                Connect Phantom
              </button>
              <a className="btn btn--ghost" href={`/app?view=${DEMO_OWNER}`}>
                View the demo vault
              </a>
            </div>
          }
        >
          Set Phantom to devnet. Your wallet owns the vault; the agent only ever gets a capped session. Or look around the
          devnet demo vault read-only.
        </EmptyState>
      </main>
    );
  if (readOnly && !vault.isLoading && !vault.data?.account)
    return (
      <main className="container page">
        <EmptyState
          title="No vault for this address"
          action={
            <button type="button" className="btn btn--ghost" onClick={onLeaveView}>
              Back
            </button>
          }
        >
          {owner.toBase58()} has no Allowance vault on devnet.
        </EmptyState>
      </main>
    );
  if (vault.isLoading)
    return (
      <main className="container page">
        <Skeleton rows={5} />
      </main>
    );
  if (vault.error)
    return (
      <main className="container page">
        <ErrorState error={vault.error} retry={() => vault.refetch()} />
      </main>
    );
  if (!vault.data?.account)
    return (
      <main className="container page">
        <CreateVault />
      </main>
    );
  return (
    <Shell frozen={vault.data.account.frozen} readOnlyOwner={readOnly ? owner.toBase58() : null} onLeaveView={onLeaveView}>
      {children}
    </Shell>
  );
}

function Shell({
  frozen,
  readOnlyOwner,
  onLeaveView,
  children,
}: {
  frozen: boolean;
  readOnlyOwner: string | null;
  onLeaveView: () => void;
  children: ReactNode;
}) {
  useLiveUpdates();
  const modal = useWalletModal();
  const path = usePathname();
  const pendings = usePendings();
  const open = pendings.data?.filter((p) => pendingStatus(p.account) === "open").length ?? 0;
  return (
    <>
      <nav className="tabs" aria-label="Dashboard">
        <div className="container tabs__inner">
          {TABS.map(([href, label]) => {
            const active = href === "/app" ? path === "/app" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                {label}
                {href === "/app/approvals" && open > 0 && <span className="count">{open}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
      {readOnlyOwner && (
        <div className="viewing">
          <div className="container frozen__inner">
            <span>
              Viewing <strong>{readOnlyOwner.slice(0, 6)}…{readOnlyOwner.slice(-4)}</strong> read-only. Connect Phantom to act on
              your own vault.
            </span>
            <span className="hero__actions">
              <button type="button" className="btn btn--sm btn--ink" onClick={() => modal.setVisible(true)}>
                Connect Phantom
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={onLeaveView}>
                Stop viewing
              </button>
            </span>
          </div>
        </div>
      )}
      {frozen && <FrozenBanner readOnly={!!readOnlyOwner} />}
      <main className="container page">{children}</main>
    </>
  );
}

function FrozenBanner({ readOnly }: { readOnly: boolean }) {
  const owner = useOwner();
  const program = useProgram();
  const send = useSend();
  return (
    <div className="frozen" role="alert">
      <div className="container frozen__inner">
        <span>
          <strong>All sessions are frozen.</strong> Every payment fails on-chain.
        </span>
        {!readOnly && <button
          type="button"
          className="btn btn--on-ink btn--sm"
          disabled={send.isPending}
          onClick={() => send.mutate({ label: "Unfreeze", build: async () => [await setFrozenIx(program, owner!, false)] })}
        >
          {send.isPending ? "Waiting for Phantom…" : "Unfreeze"}
        </button>}
      </div>
    </div>
  );
}
