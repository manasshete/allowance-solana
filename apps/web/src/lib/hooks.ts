"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicKey } from "@solana/web3.js";

import {
  extractError,
  fetchHistory,
  fetchPendings,
  fetchSessions,
  fetchVault,
  getProgram,
  PROGRAM_ID,
  vaultAta,
  vaultPda,
  type ActivityRow,
} from "@allowance/client";

import { useToast } from "@/components/Toasts";

export function useProgram() {
  const { connection } = useConnection();
  return useMemo(() => getProgram(connection), [connection]);
}

/** A vault owner to view read-only (?view=<address>) when no wallet is connected. */
export const ViewOwnerContext = createContext<PublicKey | null>(null);

/** The connected wallet, or the read-only view owner. */
export function useOwner(): PublicKey | null {
  const wallet = useWallet().publicKey;
  const view = useContext(ViewOwnerContext);
  return wallet ?? view ?? null;
}

/** True when the data shown belongs to a viewed vault, not a connected wallet. */
export function useReadOnly(): boolean {
  return !useWallet().publicKey;
}

export function useVault() {
  const owner = useOwner();
  const program = useProgram();
  const { connection } = useConnection();
  const address = owner ? vaultPda(owner) : null;
  const q = useQuery({
    queryKey: ["vault", address?.toBase58()],
    enabled: !!address,
    queryFn: async () => {
      const account = await fetchVault(program, address!);
      let balance: bigint | null = null;
      if (account) {
        const b = await connection.getTokenAccountBalance(vaultAta(address!, account.mint)).catch(() => null);
        balance = b ? BigInt(b.value.amount) : 0n;
      }
      return { account, balance };
    },
  });
  return { address, ...q };
}

export function useSessions() {
  const { address } = useVault();
  const program = useProgram();
  return useQuery({
    queryKey: ["sessions", address?.toBase58()],
    enabled: !!address,
    queryFn: () => fetchSessions(program, address!),
  });
}

export function usePendings() {
  const { address } = useVault();
  const program = useProgram();
  return useQuery({
    queryKey: ["pending", address?.toBase58()],
    enabled: !!address,
    queryFn: () => fetchPendings(program, address!),
  });
}

/** Every transaction that touched the vault (payments, refusals, owner actions), newest first. */
export function useActivity(limit = 50) {
  const { address } = useVault();
  const program = useProgram();
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["history", address?.toBase58(), limit],
    enabled: !!address,
    // one request at a time with retries: public devnet RPC rate-limits getTransaction hard
    queryFn: async (): Promise<ActivityRow[]> =>
      (await fetchHistory(connection, program, address!, { limit, concurrency: 1 })).rows,
    retry: 3,
    retryDelay: (n) => 1500 * 2 ** n,
  });
}

/** One program-wide log subscription: refreshes every query and toasts what happened. */
export function useLiveUpdates() {
  const { connection } = useConnection();
  const qc = useQueryClient();
  const toast = useToast();
  const { address } = useVault();
  useEffect(() => {
    if (!address) return;
    const id = connection.onLogs(
      PROGRAM_ID,
      (l) => {
        const ix = l.logs.find((x) => x.startsWith("Program log: Instruction: "))?.slice(26) ?? "Transaction";
        const rule = l.err ? extractError(l.err, l.logs) : null;
        toast(l.err ? `Refused: ${rule ?? "failed"} (${ix})` : `${ix} confirmed`, l.signature, l.err ? "error" : "ok");
        void qc.invalidateQueries();
      },
      "confirmed",
    );
    return () => {
      void connection.removeOnLogsListener(id);
    };
  }, [connection, qc, toast, address]);
}
