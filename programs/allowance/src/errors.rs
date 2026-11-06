use anchor_lang::prelude::*;

/// One error per rule, so every refusal names the rule that fired.
/// Codes start at 6000; keep the order stable, the client maps them by name.
#[error_code]
pub enum AllowanceError {
    #[msg("The vault is frozen")]
    Frozen,
    #[msg("The session was revoked")]
    Revoked,
    #[msg("The session has expired")]
    Expired,
    #[msg("Amount must be above zero")]
    ZeroAmount,
    #[msg("A reason is required")]
    ReasonMissing,
    #[msg("Reason is longer than 200 bytes")]
    ReasonTooLong,
    #[msg("Amount is over the per-request cap")]
    OverRequestCap,
    #[msg("Amount would pass the session's daily cap")]
    OverDailyCap,
    #[msg("Amount would pass this merchant's daily cap")]
    OverMerchantCap,
    #[msg("Amount would pass the daily cap for unlisted merchants")]
    OverOtherCap,
    #[msg("Merchant is not listed and unlisted merchants are not allowed")]
    NotListed,
    #[msg("Unlisted merchant: reputation accounts are required")]
    ReputationAccountMissing,
    #[msg("Reputation accounts are not the registry's or not this merchant's")]
    BadReputationAccount,
    #[msg("Merchant's reputation is below the session minimum")]
    LowReputation,
    #[msg("Pending request does not match this payment")]
    PendingMismatch,
    #[msg("Pending request is not approved")]
    PendingNotApproved,
    #[msg("Pending request is already resolved")]
    PendingNotOpen,
    #[msg("At most 5 listed merchants")]
    TooManyMerchants,
    #[msg("Expiry must be in the future")]
    BadExpiry,
    #[msg("Caps must be above zero, per-request at most daily, reputation at most 100")]
    BadCaps,
    #[msg("Merchant label is longer than 24 bytes")]
    LabelTooLong,
    #[msg("Merchant listed twice")]
    DuplicateMerchant,
    #[msg("Only the vault owner can do this")]
    NotOwner,
    #[msg("Only the session's agent can do this")]
    NotAgent,
    #[msg("Revoke the session or wait for it to expire first")]
    SessionStillActive,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
