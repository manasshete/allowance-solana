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
