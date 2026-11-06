import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { ATOM_ENGINE_PROGRAM_ID, PROGRAM_ID, REGISTRY_PROGRAM_ID, SEEDS } from "./constants";

export const vaultPda = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync([SEEDS.vault, owner.toBuffer()], PROGRAM_ID)[0];

export const sessionPda = (vault: PublicKey, agent: PublicKey) =>
  PublicKey.findProgramAddressSync([SEEDS.session, vault.toBuffer(), agent.toBuffer()], PROGRAM_ID)[0];

export const pendingPda = (session: PublicKey, nonce: number | bigint | BN) =>
  PublicKey.findProgramAddressSync(
    [SEEDS.pending, session.toBuffer(), new BN(nonce.toString()).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  )[0];

/** The vault's USDC account (an ATA owned by the vault PDA). */
export const vaultAta = (vault: PublicKey, mint: PublicKey, tokenProgram = TOKEN_PROGRAM_ID) =>
  getAssociatedTokenAddressSync(mint, vault, true, tokenProgram);

/** Where a merchant (x402 payTo) receives USDC. */
export const merchantAta = (merchant: PublicKey, mint: PublicKey, tokenProgram = TOKEN_PROGRAM_ID) =>
  getAssociatedTokenAddressSync(mint, merchant, true, tokenProgram);

/** Agent Registry accounts for an agent asset; agent_pay needs both for an unlisted merchant. */
export const registryAccounts = (asset: PublicKey) => ({
  registryAgent: PublicKey.findProgramAddressSync([SEEDS.agent, asset.toBuffer()], REGISTRY_PROGRAM_ID)[0],
  atomStats: PublicKey.findProgramAddressSync([SEEDS.atomStats, asset.toBuffer()], ATOM_ENGINE_PROGRAM_ID)[0],
});
