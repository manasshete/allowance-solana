import Link from "next/link";

import { explorerAddress, PROGRAM_ID } from "@allowance/client";

import { LogoMark } from "./Logo";

export function Footer() {
  const program = PROGRAM_ID.toBase58();
  return (
    <footer className="foot">
      <div className="container foot__inner">
        <div className="foot__brand">
          <Link className="wordmark" href="/" aria-label="Allowance, home">
            <LogoMark />
            <span>Allowance</span>
          </Link>
          <p>
            Agentic wallet infrastructure on Solana: a program-owned vault, a session key per agent, MCP wallet tools and on-chain
            spending rules. This site only reads and asks you to sign.
          </p>
        </div>
        <nav className="foot__cols" aria-label="Footer">
          <div>
            <h2>Product</h2>
            <Link href="/app">Dashboard</Link>
            <Link href="/app/sessions/new">New session</Link>
            <Link href="/app/activity">Activity</Link>
          </div>
          <div>
            <h2>Learn</h2>
            <Link href="/#stack">Infrastructure</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/#refusals">Refusals</Link>
            <a href={explorerAddress(program)} target="_blank" rel="noreferrer">
              Program on Explorer
            </a>
          </div>
        </nav>
      </div>
      <div className="container foot__base">
        <span>Solana devnet</span>
        <span className="mono-id">{program}</span>
      </div>
    </footer>
  );
}
