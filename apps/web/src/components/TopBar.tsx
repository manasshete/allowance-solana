"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

import { explorerAddress, PROGRAM_ID } from "@allowance/client";

// The wallet button reads window; render it on the client only.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

export function TopBar({ app = false }: { app?: boolean }) {
  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <Link className="wordmark" href="/" aria-label="Allowance, home">
          Allowance
        </Link>
        <span className="pill pill--live">Devnet</span>
        {app ? (
          <div className="topbar__end">
            <a className="topbar__program" href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
              <span className="muted">Program</span> <span className="mono-id">{PROGRAM_ID.toBase58().slice(0, 8)}…</span>
            </a>
            <WalletMultiButton />
          </div>
        ) : (
          <nav className="topbar__end" aria-label="Site">
            <Link href="/how-it-works">How it works</Link>
            <Link className="btn btn--primary btn--sm" href="/app">
              Launch app
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
