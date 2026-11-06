import { PublicKey } from "@solana/web3.js";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const DEFAULT_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_MINT ?? "7XhdZfnuTzRjC8eUQF2CE4bEcCyDgjgxoNLjHC1YN5yL",
);
export const CLUSTER = "devnet";
/** Owner of the devnet demo vault (scripts/docker/e2e-devnet.sh), for the read-only "view the demo" link. */
export const DEMO_OWNER = process.env.NEXT_PUBLIC_DEMO_OWNER ?? "9Tb4Z3FzcZy6w9XmkRfvktLm8TvFgzbfffz5xM9K5N82";
