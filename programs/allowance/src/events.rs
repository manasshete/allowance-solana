use anchor_lang::prelude::*;

#[event]
pub struct PaymentMade {
    pub vault: Pubkey,
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub reason: String,
    /// Set when an approved over-cap request was used as a voucher.
    pub pending: Option<Pubkey>,
    /// Some(score) when the merchant was unlisted and passed the reputation gate.
    pub reputation: Option<u8>,
    pub spent_today: u64,
    pub at: i64,
}

#[event]
pub struct PendingCreated {
    pub vault: Pubkey,
    pub session: Pubkey,
    pub pending: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub reason: String,
    pub at: i64,
}

#[event]
pub struct PendingResolved {
    pub vault: Pubkey,
    pub session: Pubkey,
    pub pending: Pubkey,
    pub approved: bool,
    pub at: i64,
}

#[event]
pub struct VaultFrozen {
    pub vault: Pubkey,
    pub frozen: bool,
    pub at: i64,
}

#[event]
pub struct FundsMoved {
    pub vault: Pubkey,
    pub deposit: bool,
    pub amount: u64,
    pub at: i64,
}

#[event]
pub struct SessionCreated {
    pub vault: Pubkey,
    pub session: Pubkey,
    pub agent: Pubkey,
    pub at: i64,
}

#[event]
pub struct SessionRevoked {
    pub vault: Pubkey,
    pub session: Pubkey,
    pub at: i64,
}
