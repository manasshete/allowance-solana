"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

import { initVaultIx } from "@allowance/client";

import { DEFAULT_MINT } from "@/lib/config";
import { useOwner, useProgram } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

export function CreateVault() {
  const owner = useOwner();
  const program = useProgram();
  const send = useSend();
  const [mint, setMint] = useState(DEFAULT_MINT.toBase58());
  let valid = true;
  try {
    new PublicKey(mint);
  } catch {
    valid = false;
  }
  return (
    <section className="well create-vault" aria-labelledby="cv-h">
      <h1 id="cv-h">Create your vault</h1>
      <p>
        One vault per wallet. The program owns it; only your wallet can withdraw, and agents can only spend through a
        session you create.
      </p>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          send.mutate({ label: "Create vault", build: async () => [await initVaultIx(program, { owner: owner!, mint: new PublicKey(mint) })] });
        }}
      >
        <label htmlFor="mint">Token the vault holds</label>
        <input id="mint" name="mint" type="text" spellCheck={false} autoComplete="off" value={mint} onChange={(e) => setMint(e.target.value.trim())} />
        <small className="help">{valid ? "6-decimal SPL token: the demo test token or devnet USDC." : "Not a valid address."}</small>
        <div>
          <button type="submit" className="btn btn--primary" disabled={!valid || send.isPending} aria-busy={send.isPending}>
            {send.isPending ? "Waiting for Phantom…" : "Create vault"}
          </button>
        </div>
      </form>
    </section>
  );
}
