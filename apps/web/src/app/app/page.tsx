"use client";

import { useState } from "react";

import { moveFundsIx, parseUsdc, toBN, vaultAta, vaultPda } from "@allowance/client";

import { Card3D } from "@/components/Card3D";
import { QRCodeCanvas } from "@/components/QRCodeSvg";
import { sessionStatus, usdc } from "@/lib/format";
import { useActivity, useOwner, useProgram, useReadOnly, useSessions, useVault } from "@/lib/hooks";
import { useSend } from "@/lib/tx";

export default function Overview() {
  const owner = useOwner()!;
  const program = useProgram();
  const readOnly = useReadOnly();
  const vault = useVault();
  const sessions = useSessions();
  const activity = useActivity(20);
  const send = useSend();

  const [depositAmount, setDepositAmount] = useState("");
  const [copyStatus, setCopyStatus] = useState("Copy");

  const active = sessions.data?.filter((s) => sessionStatus(s.account) === "active") ?? [];
  const spentToday = active.reduce((sum, s) => sum + BigInt(s.account.spentToday.toString()), 0n);

  // A query that hasn't answered is shown as "…" and one that failed as "—", never as a confident 0.
  const sessionsValue = sessions.isLoading ? "…" : sessions.error ? "—" : String(active.length);
  const spentValue = sessions.isLoading ? "…" : sessions.error ? "—" : `${usdc(spentToday)} USDC`;
  const txValue = activity.isLoading ? "…" : activity.error ? "—" : String(activity.data?.length ?? 0);

  const vaultAddress = owner ? vaultPda(owner).toBase58() : "";

  const handleCopy = () => {
    if (!vaultAddress) return;
    void navigator.clipboard.writeText(vaultAddress);
    setCopyStatus("Copied");
    setTimeout(() => setCopyStatus("Copy"), 2000);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mint = vault.data?.account?.mint;
    if (!depositAmount || readOnly || !mint) return;
    try {
      const amountBN = toBN(parseUsdc(depositAmount));
      const ix = await moveFundsIx(program, "deposit", {
        owner,
        mint,
        ownerAta: vaultAta(owner, mint), // the owner's own token account for this mint
        amount: amountBN,
      });
      await send.mutateAsync({
        label: `Deposit ${depositAmount} USDC`,
        build: async () => [ix],
      });
      setDepositAmount("");
      void vault.refetch();
    } catch {
      /* handled by useSend */
    }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Overview</h1>
          <p className="muted">Your agents&apos; wallet. You own and fund this vault; each agent spends from it only through its own capped session key.</p>
        </div>
        <dl className="stats stats--inline">
          <div className="stat">
            <dt>Active sessions</dt>
            <dd>{sessionsValue}</dd>
          </div>
          <div className="stat">
            <dt>Spent today</dt>
            <dd>{spentValue}</dd>
          </div>
          <div className="stat">
            <dt>Recent transactions</dt>
            <dd>{txValue}</dd>
          </div>
        </dl>
      </div>

      <div className="grid-2">
        <Card3D>
          <div className="plate">
            <div className="plate__head">
              <h2>Vault balance</h2>
              <span className="pill pill--on-ink">{vault.data?.account?.frozen ? "Frozen" : "Open"}</span>
            </div>
            <p className="plate__figure">
              <span className="figure">{usdc(vault.data?.balance)}</span> <span>USDC</span>
            </p>
            <p className="plate__note">On Solana devnet. Only this balance is available to agent sessions.</p>
          </div>
        </Card3D>

        <Card3D>
          <div className="plate">
            <h2>Fund the vault</h2>

            <div className="fund-layout">
              <div className="fund-qr-wrap">
                <QRCodeCanvas value={vaultAddress} size={110} />
                <span className="fund-qr-caption">Scan with Phantom on devnet</span>
              </div>

              <div className="fund-details">
                <div className="field">
                  <span className="field__label">Vault address</span>
                  <div className="addr-box">
                    <span className="addr-text mono-id">{vaultAddress}</span>
                    <button type="button" className="btn btn--copy" onClick={handleCopy}>
                      {copyStatus}
                    </button>
                  </div>
                </div>

                {!readOnly && (
                  <form onSubmit={handleDeposit} className="fund-form">
                    <label htmlFor="dep-amt">Add from Phantom</label>
                    <div className="fund-input-row">
                      <div className="fund-input-wrap">
                        <input
                          id="dep-amt"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0.00"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                        <span className="fund-input-unit">USDC</span>
                      </div>
                      <button type="submit" className="btn btn--primary" disabled={!depositAmount || send.isPending}>
                        {send.isPending ? "Waiting for Phantom…" : "Add USDC"}
                      </button>
                    </div>
                  </form>
                )}

                <button type="button" className="btn btn--text" onClick={() => vault.refetch()}>
                  Refresh balance
                </button>
              </div>
            </div>
          </div>
        </Card3D>
      </div>
    </>
  );
}
