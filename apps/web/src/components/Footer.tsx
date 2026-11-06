import Link from "next/link";

import { explorerAddress, PROGRAM_ID } from "@allowance/client";

export function Footer() {
  return (
    <footer className="container foot">
      <span>Allowance on Solana devnet. The program enforces every rule; this site only reads and asks you to sign.</span>
      <span>
        <Link href="/how-it-works">How it works</Link>{" "}
        <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
          Program on Explorer
        </a>
      </span>
    </footer>
  );
}
