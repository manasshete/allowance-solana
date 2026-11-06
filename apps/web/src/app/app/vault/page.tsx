"use client";

import { useState } from "react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";

import { moveFundsIx, parseUsdc, setFrozenIx, toBN, vaultAta } from "@allowance/client";

import { Addr, ConfirmInline, PageHead } from "@/components/Bits";
import { usdc } from "@/lib/format";
import { useOwner, useProgram, useReadOnly, useVault } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

export default function VaultPage() {
  const owner = useOwner()!;
  const program = useProgram();
  const { connection } = useConnection();
  const vault = useVault();
  const v = vault.data!.account!;
  const readOnly = useReadOnly();
  const send = useSend();
  const freeze = useSend();
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const ownerAta = getAssociatedTokenAddressSync(v.mint, owner);
  const wallet = useQuery({
    queryKey: ["owner-token", ownerAta.toBase58()],
    queryFn: async () => {
      const b = await connection.getTokenAccountBalance(ownerAta).catch(() => null);
      return b ? BigInt(b.value.amount) : null;
    },
  });

  function move(kind: "deposit" | "withdraw") {
    let base: bigint;
    try {
      base = parseUsdc(amount);
      if (base <= 0n) throw new Error("Enter an amount above zero");
    } catch (e) {
      setErr((e as Error).message);
      return;
    }
    setErr(null);
    send.mutate({
      label: kind === "deposit" ? `Deposit ${amount}` : `Withdraw ${amount}`,
      build: async () => [await moveFundsIx(program, kind, { owner, mint: v.mint, ownerAta, amount: toBN(base) })],
    });
  }

  return (
    <>
      <PageHead title="Vault" sub="Only your wallet can move money back out. Withdraw works even while frozen." />
      <div className="grid-even">
        <div className="col">
          <div className="plate">
            <div className="plate__head">
              <h2>Balance</h2>
              <span className="pill pill--on-ink">{v.frozen ? "Frozen" : "Open"}</span>
            </div>
            <p className="plate__figure">
              <span className="figure">{usdc(vault.data?.balance)}</span> <span>USDC</span>
            </p>
            <p className="plate__note">In your wallet: {wallet.data === null ? "no token account" : usdc(wallet.data)}</p>
          </div>

          {!readOnly && <form
            className="well"
            onSubmit={(e) => {
              e.preventDefault();
              move("deposit");
            }}
          >
            <div className="field">
              <label htmlFor="amount">Amount (USDC)</label>
              <div className="amount-row">
                <input
                  id="amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="5.00"
                  value={amount}
                  aria-invalid={!!err}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button type="submit" className="btn btn--ghost" disabled={send.isPending}>
                  Deposit
                </button>
                <button type="button" className="btn btn--ghost" disabled={send.isPending} onClick={() => move("withdraw")}>
                  Withdraw
                </button>
              </div>
              <small className={`help${err ? " help--error" : ""}`}>{err ?? (send.isPending ? "Waiting for Phantom…" : "")}</small>
            </div>
          </form>}
        </div>

        <div className="col">
          <div className="well">
            <h2>Kill switch</h2>
            <p className="muted">Freezing blocks every payment and approval request for every session, on-chain, at once.</p>
            {readOnly ? (
              <p className="muted">Connect Phantom as the owner to freeze or unfreeze.</p>
            ) : v.frozen ? (
              <button
                type="button"
                className="btn btn--ink btn--block"
                disabled={freeze.isPending}
                onClick={() => freeze.mutate({ label: "Unfreeze", build: async () => [await setFrozenIx(program, owner, false)] })}
              >
                {freeze.isPending ? "Waiting for Phantom…" : "Unfreeze"}
              </button>
            ) : (
              <ConfirmInline
                danger
                label="Freeze all sessions"
                confirmLabel="Freeze now"
                busy={freeze.isPending}
                message={
                  <>
                    Every payment fails on-chain until you unfreeze. Signs <code>freeze_all</code> in Phantom.
                  </>
                }
                onConfirm={() => freeze.mutate({ label: "Freeze all", build: async () => [await setFrozenIx(program, owner, true)] })}
              />
            )}
          </div>
          <div className="well">
            <h2>Accounts</h2>
            <dl className="facts">
              <div>
                <dt>Vault</dt>
                <dd>
                  <Addr value={vault.address!.toBase58()} />
                </dd>
              </div>
              <div>
                <dt>Vault token account</dt>
                <dd>
                  <Addr value={vaultAta(vault.address!, v.mint).toBase58()} />
                </dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd>
                  <Addr value={v.mint.toBase58()} />
                </dd>
              </div>
              <div>
                <dt>Sessions created</dt>
                <dd>{v.sessionCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
