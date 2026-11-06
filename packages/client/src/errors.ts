/**
 * Program errors, in the order of programs/allowance/src/errors.rs (codes from 6000).
 * `sentence` is what the MCP server tells the model and what the dashboard shows.
 */
export const ERROR_NAMES = [
  "Frozen",
  "Revoked",
  "Expired",
  "ZeroAmount",
  "ReasonMissing",
  "ReasonTooLong",
  "OverRequestCap",
  "OverDailyCap",
  "OverMerchantCap",
  "OverOtherCap",
  "NotListed",
  "ReputationAccountMissing",
  "BadReputationAccount",
  "LowReputation",
  "PendingMismatch",
  "PendingNotApproved",
  "PendingNotOpen",
  "TooManyMerchants",
  "BadExpiry",
  "BadCaps",
  "LabelTooLong",
  "DuplicateMerchant",
  "NotOwner",
  "NotAgent",
  "SessionStillActive",
  "MathOverflow",
] as const;

export type AllowanceErrorName = (typeof ERROR_NAMES)[number];

export const ERROR_SENTENCES: Record<AllowanceErrorName, string> = {
  Frozen: "the owner has frozen every session",
  Revoked: "this session was revoked by the owner",
  Expired: "this session has expired",
  ZeroAmount: "the amount must be above zero",
  ReasonMissing: "every payment needs a reason",
  ReasonTooLong: "the reason is longer than 200 bytes",
  OverRequestCap: "the price is over the per-request cap",
  OverDailyCap: "this would pass the session's daily cap",
  OverMerchantCap: "this would pass this merchant's daily cap",
  OverOtherCap: "this would pass the daily cap for unlisted merchants",
  NotListed: "this merchant is not on the session's list",
  ReputationAccountMissing: "the merchant has no Agent Registry entry to check",
  BadReputationAccount: "the merchant's registry entry doesn't match its wallet",
  LowReputation: "the merchant's reputation is below the session minimum",
  PendingMismatch: "the approval is for a different merchant or amount",
  PendingNotApproved: "the approval request hasn't been approved (or was already used)",
  PendingNotOpen: "the approval request was already resolved",
  TooManyMerchants: "a session can list at most 5 merchants",
  BadExpiry: "the expiry must be in the future",
  BadCaps: "caps must be above zero, per-request at most daily, reputation at most 100",
  LabelTooLong: "a merchant label is longer than 24 bytes",
  DuplicateMerchant: "a merchant is listed twice",
  NotOwner: "only the vault owner can do this",
  NotAgent: "only the session's agent can do this",
  SessionStillActive: "revoke the session or wait for it to expire first",
  MathOverflow: "arithmetic overflow",
};

export const errorFromCode = (code: number): AllowanceErrorName | null =>
  code >= 6000 && code < 6000 + ERROR_NAMES.length ? ERROR_NAMES[code - 6000] : null;

/**
 * Pulls the Allowance error out of whatever a failed send or simulation gives back:
 * a transaction `err` object ({ InstructionError: [i, { Custom: n }] }), an
 * AnchorError, or raw program logs.
 */
export function extractError(input: unknown, logs?: string[] | null): AllowanceErrorName | null {
  const fromLogs = (ls?: string[] | null) => {
    for (const l of ls ?? []) {
      const m = /Error Code: (\w+)/.exec(l);
      if (m && (ERROR_NAMES as readonly string[]).includes(m[1])) return m[1] as AllowanceErrorName;
    }
    return null;
  };
  const named = fromLogs(logs);
  if (named) return named;

  const anyErr = input as Record<string, unknown> | null;
  const ie = (anyErr?.InstructionError ?? (anyErr?.err as Record<string, unknown>)?.InstructionError) as
    | [number, { Custom?: number }]
    | undefined;
  if (ie && typeof ie[1]?.Custom === "number") return errorFromCode(ie[1].Custom);

  const anchor = anyErr?.error as { errorCode?: { code?: string } } | undefined;
  const code = anchor?.errorCode?.code;
  if (code && (ERROR_NAMES as readonly string[]).includes(code)) return code as AllowanceErrorName;

  return fromLogs((anyErr?.logs as string[]) ?? (anyErr?.transactionLogs as string[]));
}

// ---------- refusals with their real numbers ----------

/** What a refusal sentence can draw on; every field is optional. */
export type RefusalContext = {
  /** The payment that was refused, in base units. */
  amount?: bigint | null;
  /** The session as it stood before the attempt. */
  session?: {
    perRequestCap: { toString(): string };
    dailyCap: { toString(): string };
    spentToday: { toString(): string };
    otherDailyCap: { toString(): string };
    otherSpentToday: { toString(): string };
    minReputation: number;
    expiresAt: { toString(): string };
    merchants: { merchant: { toBase58(): string }; label: string; dailyCap: { toString(): string } }[];
  } | null;
  /** The payee's wallet and, if known, its name. */
  merchant?: string | null;
  merchantLabel?: string | null;
  /** The payee's reputation score, when the program read one. */
  score?: number | null;
};

const fmt = (v: { toString(): string } | bigint) => {
  const n = BigInt(v.toString());
  const whole = n / 1_000_000n;
  let frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${whole}.${frac}`;
};

/**
 * One sentence per rule, with the numbers that made it fire
 * ("0.50 is over the 0.05 per-request cap."). Falls back to the plain sentence
 * when a number isn't known.
 */
export function describeRefusal(rule: AllowanceErrorName, c: RefusalContext = {}): string {
  const s = c.session;
  const amt = c.amount != null ? `${fmt(c.amount)} USDC` : "This payment";
  const listed = s && c.merchant ? s.merchants.find((m) => m.merchant.toBase58() === c.merchant) : undefined;
  const who = c.merchantLabel || listed?.label || (c.merchant ? `${c.merchant.slice(0, 4)}…${c.merchant.slice(-4)}` : "this merchant");
  switch (rule) {
    case "Frozen":
      return "The owner froze the vault. Every session is blocked.";
    case "Revoked":
      return "This session was revoked.";
    case "Expired":
      return s ? `This session expired at ${new Date(Number(s.expiresAt.toString()) * 1000).toISOString()}.` : "This session expired.";
    case "OverRequestCap":
      return s ? `${amt} is over the ${fmt(s.perRequestCap)} per-request cap.` : `${amt} is over the per-request cap.`;
    case "OverDailyCap":
      return s
        ? `${amt} would pass the ${fmt(s.dailyCap)} daily cap (${fmt(s.spentToday)} spent).`
        : `${amt} would pass the daily cap.`;
    case "OverMerchantCap":
      return listed ? `${amt} would pass ${who}'s ${fmt(listed.dailyCap)} daily cap.` : `${amt} would pass ${who}'s daily cap.`;
    case "OverOtherCap":
      return s
        ? `${amt} would pass the ${fmt(s.otherDailyCap)} daily cap for unlisted merchants (${fmt(s.otherSpentToday)} spent).`
        : `${amt} would pass the daily cap for unlisted merchants.`;
    case "LowReputation":
      return c.score != null && s
        ? `Reputation ${c.score} is below this session's minimum of ${s.minReputation}.`
        : s
          ? `${who}'s reputation is below this session's minimum of ${s.minReputation}.`
          : "The merchant's reputation is below this session's minimum.";
    case "BadReputationAccount":
      return "The reputation account doesn't belong to this payee.";
    case "ReputationAccountMissing":
      return `${who} has no Agent Registry entry, so its reputation can't be checked.`;
    case "NotListed":
      return `${who} isn't listed, and this session allows no unlisted merchants.`;
    default:
      return `${ERROR_SENTENCES[rule].charAt(0).toUpperCase()}${ERROR_SENTENCES[rule].slice(1)}.`;
  }
}
