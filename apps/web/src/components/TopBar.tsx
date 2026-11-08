"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { explorerAddress, PROGRAM_ID } from "@allowance/client";

import { LogoMark } from "./Logo";

// The wallet button reads window; render it on the client only.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

const SITE_LINKS = [
  ["/#stack", "Infrastructure"],
  ["/#how", "Payments"],
  ["/#refusals", "Refusals"],
  ["/how-it-works", "The rules"],
] as const;

export function TopBar({ app = false }: { app?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`topbar${open ? " is-open" : ""}`}>
      <div className="container topbar__inner">
        <Link className="wordmark" href="/" aria-label="Allowance, home">
          <LogoMark />
          <span>Allowance</span>
        </Link>
        <span className="pill pill--live">
          <span className="live-dot" aria-hidden="true" />
          Devnet
        </span>
        {app ? (
          <div className="topbar__end">
            <a className="topbar__program" href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
              <span className="muted">Program</span> <span className="mono-id">{PROGRAM_ID.toBase58().slice(0, 8)}…</span>
            </a>
            <WalletMultiButton />
          </div>
        ) : (
          <>
            <nav className="topbar__end topbar__site" aria-label="Site">
              {SITE_LINKS.map(([href, label]) => (
                <Link key={href} className="navlink" href={href} aria-current={path === href ? "page" : undefined}>
                  {label}
                </Link>
              ))}
              <Link className="btn btn--primary btn--sm btn--glow" href="/app">
                Launch app <span className="btn__arrow" aria-hidden="true">→</span>
              </Link>
            </nav>
            <button
              type="button"
              className="menu-btn"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span />
              <span />
            </button>
          </>
        )}
      </div>
      {!app && (
        <nav id="site-menu" className="sheet" aria-label="Site menu" hidden={!open}>
          <div className="container sheet__inner" data-stagger>
            {SITE_LINKS.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
            <Link className="btn btn--primary btn--block" href="/app" onClick={() => setOpen(false)}>
              Launch app
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
