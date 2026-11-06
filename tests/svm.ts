/**
 * LiteSVM 1.x speaks @solana/kit; the tests and Anchor client speak web3.js.
 * This wrapper keeps the web3.js surface the tests use and converts at the edge:
 * a signed web3.js Transaction serializes to the same wire bytes kit decodes.
 */
import { address, getTransactionDecoder, lamports, type Address } from "@solana/kit";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { Clock, FailedTransactionMetadata, LiteSVM as KitLiteSVM, TransactionMetadata } from "litesvm";

export { Clock, FailedTransactionMetadata, TransactionMetadata };

const addr = (pk: PublicKey): Address => address(pk.toBase58());
const txDecoder = getTransactionDecoder();

export class LiteSVM {
  readonly inner = new KitLiteSVM();

  addProgramFromFile(programId: PublicKey, path: string) {
    this.inner.addProgramFromFile(addr(programId), path);
  }

  airdrop(to: PublicKey, amount: bigint) {
    return this.inner.airdrop(addr(to), lamports(amount));
  }

  minimumBalanceForRentExemption(len: bigint) {
    return this.inner.minimumBalanceForRentExemption(len);
  }

  setAccount(at: PublicKey, acc: { lamports: number; data: Uint8Array; owner: PublicKey; executable: boolean }) {
    this.inner.setAccount({
      address: addr(at),
      lamports: lamports(BigInt(acc.lamports)),
      data: Uint8Array.from(acc.data),
      programAddress: addr(acc.owner),
      executable: acc.executable,
      space: BigInt(acc.data.length),
    });
  }

  getAccount(at: PublicKey): { lamports: number; data: Uint8Array } | null {
    const a = this.inner.getAccount(addr(at));
    if (!a.exists) return null;
    return { lamports: Number(a.lamports), data: a.data };
  }

  latestBlockhash(): string {
    return this.inner.latestBlockhash();
  }

  expireBlockhash() {
    this.inner.expireBlockhash();
  }

  getClock(): Clock {
    return this.inner.getClock();
  }

  setClock(c: Clock) {
    this.inner.setClock(c);
  }

  sendTransaction(tx: Transaction): TransactionMetadata | FailedTransactionMetadata {
    const decoded = txDecoder.decode(tx.serialize());
    return this.inner.sendTransaction(decoded as Parameters<KitLiteSVM["sendTransaction"]>[0]);
  }
}
