import { AnchorProvider, Program, type Provider } from "@coral-xyz/anchor";
import BN from "bn.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";

import idlJson from "./idl/allowance.json";
import type { Allowance } from "./idl/allowance";
import { MAX_REASON_LEN } from "./constants";
import { merchantAta, pendingPda, sessionPda, vaultAta, vaultPda } from "./pda";

export const IDL = idlJson as Allowance;
export type { Allowance };
export type AllowanceProgram = Program<Allowance>;

/**
 * A Program for building instructions and decoding accounts.
 * Pass a real provider to send; for read-only use a Connection is enough.
 */
export function getProgram(providerOrConnection: Provider | Connection): AllowanceProgram {
  const provider =
    providerOrConnection instanceof Connection
      ? ({ connection: providerOrConnection } as Provider)
      : providerOrConnection;
  return new Program<Allowance>(IDL, provider);
}

export type { AnchorProvider };

// ---------- types (mirror state.rs; Anchor decodes to camelCase) ----------

export type MerchantCap = { merchant: PublicKey; label: string; dailyCap: BN; spentToday: BN };

export type VaultAccount = {
  owner: PublicKey;
  mint: PublicKey;
  frozen: boolean;
  sessionCount: number;
  bump: number;
};

export type SessionAccount = {
  vault: PublicKey;
  agent: PublicKey;
  perRequestCap: BN;
  dailyCap: BN;
  spentToday: BN;
  otherDailyCap: BN;
  otherSpentToday: BN;
  minReputation: number;
  dayStart: BN;
  expiresAt: BN;
  createdAt: BN;
  revoked: boolean;
  totalPaid: BN;
  pendingNonce: BN;
  merchants: MerchantCap[];
  bump: number;
};

export type PendingStatus = "open" | "approved" | "rejected" | "used";

export type PendingAccount = {
  vault: PublicKey;
  session: PublicKey;
  merchant: PublicKey;
  amount: BN;
  reason: string;
  createdAt: BN;
  resolvedAt: BN;
  status: Record<PendingStatus, object>;
  nonce: BN;
  bump: number;
};

export const pendingStatus = (p: PendingAccount): PendingStatus => Object.keys(p.status)[0] as PendingStatus;

export type MerchantInput = { merchant: PublicKey; label: string; dailyCap: BN };

export type SessionParams = {
  perRequestCap: BN;
  dailyCap: BN;
  otherDailyCap: BN;
  minReputation: number;
  expiresAt: BN;
  merchants: MerchantInput[];
};

// ---------- reads ----------

export async function fetchVault(program: AllowanceProgram, vault: PublicKey) {
  return (await program.account.vault.fetchNullable(vault)) as unknown as VaultAccount | null;
}

export async function fetchSession(program: AllowanceProgram, session: PublicKey) {
  return (await program.account.session.fetchNullable(session)) as unknown as SessionAccount | null;
}

export async function fetchPending(program: AllowanceProgram, pending: PublicKey) {
  return (await program.account.pending.fetchNullable(pending)) as unknown as PendingAccount | null;
}

/** Sessions of one vault (memcmp on the `vault` field right after the discriminator). */
export async function fetchSessions(program: AllowanceProgram, vault: PublicKey) {
  const rows = await program.account.session.all([{ memcmp: { offset: 8, bytes: vault.toBase58() } }]);
  return rows.map((r) => ({ address: r.publicKey, account: r.account as unknown as SessionAccount }));
}

/** Pending requests of one vault (`vault` is the first field of Pending too). */
export async function fetchPendings(program: AllowanceProgram, vault: PublicKey) {
  const rows = await program.account.pending.all([{ memcmp: { offset: 8, bytes: vault.toBase58() } }]);
  return rows.map((r) => ({ address: r.publicKey, account: r.account as unknown as PendingAccount }));
}

// ---------- owner instructions ----------

type Owner = { owner: PublicKey; mint: PublicKey; tokenProgram?: PublicKey };

export function initVaultIx(program: AllowanceProgram, { owner, mint, tokenProgram = TOKEN_PROGRAM_ID }: Owner) {
  const vault = vaultPda(owner);
  return program.methods
    .initVault()
    .accountsStrict({
      owner,
      vault,
      mint,
      vaultAta: vaultAta(vault, mint, tokenProgram),
      tokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function moveFundsIx(
  program: AllowanceProgram,
  kind: "deposit" | "withdraw",
  { owner, mint, ownerAta, amount, tokenProgram = TOKEN_PROGRAM_ID }: Owner & { ownerAta: PublicKey; amount: BN },
) {
  const vault = vaultPda(owner);
  const m = kind === "deposit" ? program.methods.deposit(amount) : program.methods.withdraw(amount);
  return m
    .accountsStrict({ owner, vault, mint, ownerAta, vaultAta: vaultAta(vault, mint, tokenProgram), tokenProgram })
    .instruction();
}

export function setFrozenIx(program: AllowanceProgram, owner: PublicKey, frozen: boolean) {
  const m = frozen ? program.methods.freezeAll() : program.methods.unfreeze();
  return m.accountsStrict({ owner, vault: vaultPda(owner) }).instruction();
}

export function createSessionIx(program: AllowanceProgram, owner: PublicKey, agent: PublicKey, params: SessionParams) {
  const vault = vaultPda(owner);
  return program.methods
    .createSession(params as never)
    .accountsStrict({
      owner,
      vault,
      agent,
      session: sessionPda(vault, agent),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function revokeSessionIx(program: AllowanceProgram, owner: PublicKey, session: PublicKey) {
  return program.methods.revokeSession().accountsStrict({ owner, vault: vaultPda(owner), session }).instruction();
}

export function closeSessionIx(program: AllowanceProgram, owner: PublicKey, session: PublicKey) {
  return program.methods.closeSession().accountsStrict({ owner, vault: vaultPda(owner), session }).instruction();
}

export function resolvePendingIx(
  program: AllowanceProgram,
  owner: PublicKey,
  session: PublicKey,
  pending: PublicKey,
  approve: boolean,
) {
  const m = approve ? program.methods.approvePending() : program.methods.rejectPending();
  return m.accountsStrict({ owner, vault: vaultPda(owner), session, pending }).instruction();
}

// ---------- agent instructions ----------

export type AgentPayArgs = {
  agent: PublicKey;
  /** Vault owner (to derive the vault). */
  owner: PublicKey;
  mint: PublicKey;
  merchant: PublicKey;
  amount: BN;
  reason: string;
  /** Registry accounts, required for a merchant the session doesn't list. */
  reputation?: { registryAgent: PublicKey; atomStats: PublicKey } | null;
  /** An approved over-cap request to use once. */
  pending?: PublicKey | null;
  tokenProgram?: PublicKey;
};

export function agentPayIx(program: AllowanceProgram, a: AgentPayArgs): Promise<TransactionInstruction> {
  const tokenProgram = a.tokenProgram ?? TOKEN_PROGRAM_ID;
  const vault = vaultPda(a.owner);
  const reason = clampReason(a.reason);
  return program.methods
    .agentPay(a.amount, reason)
    .accountsStrict({
      agent: a.agent,
      vault,
      session: sessionPda(vault, a.agent),
      mint: a.mint,
      vaultAta: vaultAta(vault, a.mint, tokenProgram),
      merchant: a.merchant,
      merchantAta: merchantAta(a.merchant, a.mint, tokenProgram),
      registryAgent: a.reputation?.registryAgent ?? null,
      atomStats: a.reputation?.atomStats ?? null,
      pending: a.pending ?? null,
      tokenProgram,
    })
    .instruction();
}

export async function requestApprovalIx(
  program: AllowanceProgram,
  a: { agent: PublicKey; owner: PublicKey; merchant: PublicKey; amount: BN; reason: string; nonce: BN },
) {
  const vault = vaultPda(a.owner);
  const session = sessionPda(vault, a.agent);
  const pending = pendingPda(session, a.nonce);
  const ix = await program.methods
    .requestApproval(a.amount, clampReason(a.reason))
    .accountsStrict({
      agent: a.agent,
      vault,
      session,
      merchant: a.merchant,
      pending,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return { ix, pending };
}

/** Trims to the on-chain limit on a UTF-8 boundary, so the agent's reason never fails ReasonTooLong. */
export function clampReason(reason: string): string {
  const enc = new TextEncoder();
  let r = reason.trim();
  while (enc.encode(r).length > MAX_REASON_LEN) r = r.slice(0, -1);
  return r;
}
