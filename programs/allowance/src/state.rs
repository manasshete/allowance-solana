use anchor_lang::prelude::*;

use crate::errors::AllowanceError;

pub const VAULT_SEED: &[u8] = b"vault";
pub const SESSION_SEED: &[u8] = b"session";
pub const PENDING_SEED: &[u8] = b"pending";

pub const MAX_MERCHANTS: usize = 5;
pub const MAX_LABEL_LEN: usize = 24;
pub const MAX_REASON_LEN: usize = 200;
pub const DAY_SECONDS: i64 = 86_400;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub mint: Pubkey,
    /// Kill switch: blocks every agent_pay and request_approval for every session.
    pub frozen: bool,
    /// Sessions ever created, for the dashboard.
    pub session_count: u32,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct MerchantCap {
    /// The payTo wallet (owner of the merchant's token account).
    pub merchant: Pubkey,
    #[max_len(MAX_LABEL_LEN)]
    pub label: String,
    pub daily_cap: u64,
    pub spent_today: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Session {
    pub vault: Pubkey,
    pub agent: Pubkey,
    pub per_request_cap: u64,
    pub daily_cap: u64,
    pub spent_today: u64,
    /// Daily cap shared by merchants not listed below; 0 means unlisted merchants are refused.
    pub other_daily_cap: u64,
    pub other_spent_today: u64,
    /// Minimum Agent Registry score (0..=100) for unlisted merchants.
    pub min_reputation: u8,
    pub day_start: i64,
    pub expires_at: i64,
    pub created_at: i64,
    pub revoked: bool,
    pub total_paid: u64,
    pub pending_nonce: u64,
    #[max_len(MAX_MERCHANTS)]
    pub merchants: Vec<MerchantCap>,
    pub bump: u8,
}

impl Session {
    /// Resets the daily counters once 24 hours have passed since day_start.
    pub fn roll_day(&mut self, now: i64) {
        if now - self.day_start >= DAY_SECONDS {
            self.day_start = now;
            self.spent_today = 0;
            self.other_spent_today = 0;
            for m in self.merchants.iter_mut() {
                m.spent_today = 0;
            }
        }
    }

    pub fn is_expired(&self, now: i64) -> bool {
        now >= self.expires_at
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PendingStatus {
    Open,
    Approved,
    Rejected,
    Used,
}

#[account]
#[derive(InitSpace)]
pub struct Pending {
    pub vault: Pubkey,
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    #[max_len(MAX_REASON_LEN)]
    pub reason: String,
    pub created_at: i64,
    pub resolved_at: i64,
    pub status: PendingStatus,
    pub nonce: u64,
    pub bump: u8,
}

// ---------- instruction inputs ----------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MerchantInput {
    pub merchant: Pubkey,
    pub label: String,
    pub daily_cap: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SessionParams {
    pub per_request_cap: u64,
    pub daily_cap: u64,
    pub other_daily_cap: u64,
    pub min_reputation: u8,
    pub expires_at: i64,
    pub merchants: Vec<MerchantInput>,
}

pub fn check_reason(reason: &str) -> Result<()> {
    require!(!reason.trim().is_empty(), AllowanceError::ReasonMissing);
    require!(reason.len() <= MAX_REASON_LEN, AllowanceError::ReasonTooLong);
    Ok(())
}
