"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Transaction, type TransactionInstruction } from "@solana/web3.js";

import { ERROR_SENTENCES, extractError } from "@allowance/client";

import { useToast } from "@/components/Toasts";

export type SendArgs = { label: string; build: () => Promise<TransactionInstruction[]> };

export function humanError(e: unknown): string {
  const err = e as { logs?: string[]; message?: string; name?: string };
  const rule = extractError(e, err?.logs);
  if (rule) return `${ERROR_SENTENCES[rule]} (${rule})`;
  if (err?.logs?.some((l) => /already in use/.test(l)))
    return "That account already exists on-chain (for a session: this agent already has one, so revoke and close it or use a new agent key)";
  if (err?.name === "WalletSendTransactionError" && /unexpected/i.test(err?.message ?? ""))
    return "Phantom refused the transaction. Check Phantom is on Solana Devnet (Settings, Developer Settings, Testnet Mode) and try again";
  if (err?.name === "WalletSignTransactionError" || /reject/i.test(err?.message ?? "")) return "You declined in Phantom";
  return err?.message ?? String(e);
}

/** Builds instructions, asks Phantom to sign, waits for `confirmed`, then refreshes all data. */
export function useSend() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({ build }: SendArgs) => {
      if (!wallet.publicKey) throw new Error("Connect Phantom first");
      const tx = new Transaction().add(...(await build()));
      // Dry-run on devnet first: a transaction that would fail never reaches Phantom, whose
      // "failed to simulate" warning hides the reason. Here the program's own error is shown.
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err)
        throw Object.assign(new Error(`Would fail on-chain: ${JSON.stringify(sim.value.err)}`), {
          logs: sim.value.logs ?? undefined,
          err: sim.value.err,
        });
      const sig = await wallet.sendTransaction(tx, connection);
      const conf = await connection.confirmTransaction(sig, "confirmed");
      if (conf.value.err) {
        const t = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
        throw Object.assign(new Error("Transaction failed"), { logs: t?.meta?.logMessages, err: conf.value.err });
      }
      return sig;
    },
    onSuccess: (sig, v) => {
      toast(`${v.label}: confirmed`, sig, "ok");
      void qc.invalidateQueries();
    },
    onError: (e, v) => toast(`${v.label} failed: ${humanError(e)}`, null, "error"),
  });
}
