import { BorshInstructionCoder, EventParser, type Idl, type Program } from "@coral-xyz/anchor";
import type {
  ConfirmedSignatureInfo,
  Connection,
  PublicKey,
  VersionedTransactionResponse,
} from "@solana/web3.js";

import { PROGRAM_ID } from "./constants";
import { extractError, type AllowanceErrorName } from "./errors";

/** One row of the activity feed, built only from the chain. */
export type ActivityRow = {
  signature: string;
  slot: number;
  time: number | null;
  ok: boolean;
  /** Instruction name, e.g. agentPay, requestApproval, freezeAll. */
  kind: string;
  error: AllowanceErrorName | null;
  session: string | null;
  merchant: string | null;
  amount: bigint | null;
  reason: string | null;
  pending: string | null;
  reputation: number | null;
  /** Who paid the network fee: the facilitator for x402 payments, the agent for recorded refusals. */
  feePayer: string;
  logs: string[];
};

const ACCOUNT_INDEX: Record<string, Record<string, number>> = {
  agentPay: { session: 2, merchant: 5, pending: 9 },
  requestApproval: { session: 2, merchant: 3, pending: 4 },
};

/**
 * Turns a fetched transaction into the Allowance instruction it carried.
 * Failed transactions decode too: their instruction data still holds the
 * amount and reason, and the logs hold the rule that fired.
 */
export function parseAllowanceTx(program: Program<any>, tx: VersionedTransactionResponse): ActivityRow | null {
  const msg = tx.transaction.message;
  const keys = msg.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }).staticAccountKeys;
  const allKeys = [
    ...keys,
    ...(tx.meta?.loadedAddresses?.writable ?? []),
    ...(tx.meta?.loadedAddresses?.readonly ?? []),
  ];
  const coder = new BorshInstructionCoder(program.idl as Idl);
  const logs = tx.meta?.logMessages ?? [];

  for (const ix of msg.compiledInstructions) {
    const programId = allKeys[ix.programIdIndex];
    if (!programId?.equals(PROGRAM_ID)) continue;
    const decoded = coder.decode(Buffer.from(ix.data));
    if (!decoded) continue;

    const acct = (name: string) => {
      const i = ACCOUNT_INDEX[decoded.name]?.[name];
      if (i === undefined) return null;
      const k = allKeys[ix.accountKeyIndexes[i]];
      return k && !k.equals(PROGRAM_ID) ? k.toBase58() : null; // optional account left empty = program id
    };
    const data = decoded.data as { amount?: { toString(): string }; reason?: string };

    let reputation: number | null = null;
    let pending = acct("pending");
    for (const ev of new EventParser(PROGRAM_ID, program.coder).parseLogs(logs)) {
      if (ev.name === "paymentMade" || ev.name === "PaymentMade") {
        const d = ev.data as { reputation: number | null; pending: PublicKey | null };
        reputation = d.reputation ?? null;
        pending = d.pending?.toBase58() ?? pending;
      }
    }

    return {
      signature: tx.transaction.signatures[0],
      slot: tx.slot,
      time: tx.blockTime ?? null,
      ok: !tx.meta?.err,
      kind: decoded.name,
      error: tx.meta?.err ? extractError(tx.meta.err, logs) : null,
      session: acct("session"),
      merchant: acct("merchant"),
      amount: data.amount ? BigInt(data.amount.toString()) : null,
      reason: data.reason ?? null,
      pending,
      reputation,
      feePayer: keys[0].toBase58(),
      logs,
    };
  }
  return null;
}

/** Newest-first activity for an address (a session, or the vault). */
export async function fetchHistory(
  connection: Connection,
  program: Program<any>,
  address: PublicKey,
  opts: { limit?: number; before?: string; concurrency?: number } = {},
): Promise<{ rows: ActivityRow[]; next: string | null }> {
  const sigs: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(address, {
    limit: opts.limit ?? 25,
    before: opts.before,
  });
  if (sigs.length === 0) return { rows: [], next: null };
  // One request at a time, a few in flight: public RPCs reject JSON-RPC batches
  // (getTransactions) with "Connection rate limits exceeded".
  const txs: (VersionedTransactionResponse | null)[] = new Array(sigs.length).fill(null);
  const concurrency = opts.concurrency ?? 3;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, sigs.length) }, async () => {
      while (next < sigs.length) {
        const i = next++;
        txs[i] = await connection.getTransaction(sigs[i].signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
      }
    }),
  );
  const rows = txs
    .map((t) => (t ? parseAllowanceTx(program, t) : null))
    .filter((r): r is ActivityRow => r !== null);
  return { rows, next: sigs.length === (opts.limit ?? 25) ? sigs[sigs.length - 1].signature : null };
}

/** Merges several histories (e.g. every session of a vault), newest first, without duplicates. */
export function mergeHistories(lists: ActivityRow[][]): ActivityRow[] {
  const seen = new Map<string, ActivityRow>();
  for (const list of lists) for (const r of list) seen.set(r.signature, r);
  return [...seen.values()].sort((a, b) => b.slot - a.slot);
}

export const shortKey = (k: string | PublicKey, n = 4) => {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, n)}…${s.slice(-n)}`;
};

