import BN from "bn.js";

import { USDC_DECIMALS } from "./constants";

const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** "0.05" -> 50000n. Rejects more than 6 decimals rather than rounding money. */
export function parseUsdc(input: string): bigint {
  const s = input.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Not an amount: "${input}"`);
  const [whole, frac = ""] = s.split(".");
  if (frac.length > USDC_DECIMALS) throw new Error(`At most ${USDC_DECIMALS} decimals: "${input}"`);
  return BigInt(whole) * SCALE + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

/** 50000n -> "0.05" (at least 2 decimals, trailing zeros trimmed beyond that). */
export function formatUsdc(base: bigint | number | BN | string): string {
  const v = BigInt(base.toString());
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / SCALE;
  let frac = (abs % SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export const toBN = (v: bigint | number | string) => new BN(v.toString());
