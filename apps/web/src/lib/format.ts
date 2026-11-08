import { formatUsdc, shortKey, type SessionAccount } from "@allowance/client";

export { formatUsdc, shortKey };

export const usdc = (v: bigint | { toString(): string } | null | undefined) =>
  v === null || v === undefined ? "—" : formatUsdc(BigInt(v.toString()));

export function when(unix: number | null) {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
}

export const formatTime = when;

export function timeLeft(expiresAt: number) {
  const s = expiresAt - Math.floor(Date.now() / 1000);
  if (s <= 0) return "expired";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}

export type SessionStatus = "active" | "expired" | "revoked";
export const sessionStatus = (s: SessionAccount): SessionStatus =>
  s.revoked ? "revoked" : s.expiresAt.toNumber() <= Date.now() / 1000 ? "expired" : "active";

/** Labels for merchant addresses, from every session's merchant list. */
export function merchantLabels(sessions: { account: SessionAccount }[] | undefined) {
  const map = new Map<string, string>();
  for (const s of sessions ?? []) for (const m of s.account.merchants) if (m.label) map.set(m.merchant.toBase58(), m.label);
  return map;
}

export const ratio = (a: { toString(): string }, b: { toString(): string }) => {
  const d = Number(b.toString());
  return d > 0 ? Math.min(1, Number(a.toString()) / d) : 0;
};
