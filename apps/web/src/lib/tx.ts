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
