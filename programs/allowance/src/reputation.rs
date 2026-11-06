//! Reads a merchant's reputation from the 8004 Agent Registry on-chain.
//!
//! Layouts come from the `8004-solana` SDK v0.8.5 (borsh schemas):
//!
//! AgentAccount (registry program), PDA ["agent", asset]:
//!   disc[8] collection[32] creator[32] owner[32] asset[32] bump[1]
//!   atom_enabled[1] agent_wallet: Option<Pubkey> ...
//!
//! AtomStats (ATOM engine program), PDA ["atom_stats", asset]:
//!   disc[8] collection[32] asset[32] first_feedback_slot u64
//!   last_feedback_slot u64 feedback_count u64 ema_score_fast u16
//!   ema_score_slow u16 ...
//!
//! The score is `ema_score_slow / 100` (0..=100), the same number the SDK's
//! `AtomStats.getAverageScore()` returns.
//!
//! Only the owner program can write an account's data, so checking the owner,
//! the discriminator and the cross-links (wallet == merchant, same asset in both)
//! is enough; the PDA seeds don't need re-deriving.

use anchor_lang::prelude::*;

use crate::errors::AllowanceError;

#[cfg(not(feature = "mainnet"))]
pub const REGISTRY_PROGRAM_ID: Pubkey = pubkey!("8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C");
#[cfg(not(feature = "mainnet"))]
pub const ATOM_ENGINE_PROGRAM_ID: Pubkey = pubkey!("AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF");

#[cfg(feature = "mainnet")]
pub const REGISTRY_PROGRAM_ID: Pubkey = pubkey!("8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ");
#[cfg(feature = "mainnet")]
pub const ATOM_ENGINE_PROGRAM_ID: Pubkey = pubkey!("AToMw53aiPQ8j7iHVb4fGt6nzUNxUhcPc3tbPBZuzVVb");

pub const AGENT_ACCOUNT_DISC: [u8; 8] = [241, 119, 69, 140, 233, 9, 112, 50];
pub const ATOM_STATS_DISC: [u8; 8] = [190, 187, 50, 59, 203, 39, 136, 244];

const AGENT_ASSET: usize = 8 + 32 * 3; // 104
const AGENT_WALLET_TAG: usize = AGENT_ASSET + 32 + 1 + 1; // 138
const AGENT_WALLET: usize = AGENT_WALLET_TAG + 1; // 139

const STATS_ASSET: usize = 8 + 32; // 40
const STATS_FEEDBACK_COUNT: usize = STATS_ASSET + 32 + 8 + 8; // 88
const STATS_EMA_SLOW: usize = STATS_FEEDBACK_COUNT + 8 + 2; // 98

/// Returns the merchant's score (0..=100), or an error if the accounts
/// are not genuine registry accounts belonging to this merchant.
pub fn score_for(agent_acc: &AccountInfo, stats_acc: &AccountInfo, merchant: &Pubkey) -> Result<u8> {
    require_keys_eq!(*agent_acc.owner, REGISTRY_PROGRAM_ID, AllowanceError::BadReputationAccount);
    require_keys_eq!(*stats_acc.owner, ATOM_ENGINE_PROGRAM_ID, AllowanceError::BadReputationAccount);

    let a = agent_acc.try_borrow_data()?;
    let s = stats_acc.try_borrow_data()?;

    require!(
        a.len() >= AGENT_WALLET + 32 && a[..8] == AGENT_ACCOUNT_DISC,
        AllowanceError::BadReputationAccount
    );
    require!(
        s.len() >= STATS_EMA_SLOW + 2 && s[..8] == ATOM_STATS_DISC,
        AllowanceError::BadReputationAccount
    );

    // agent_wallet must be Some(merchant)
    require!(a[AGENT_WALLET_TAG] == 1, AllowanceError::BadReputationAccount);
    let wallet = Pubkey::new_from_array(a[AGENT_WALLET..AGENT_WALLET + 32].try_into().unwrap());
    require_keys_eq!(wallet, *merchant, AllowanceError::BadReputationAccount);

    // both accounts describe the same agent asset
    require!(
        a[AGENT_ASSET..AGENT_ASSET + 32] == s[STATS_ASSET..STATS_ASSET + 32],
        AllowanceError::BadReputationAccount
    );

    let count = u64::from_le_bytes(s[STATS_FEEDBACK_COUNT..STATS_FEEDBACK_COUNT + 8].try_into().unwrap());
    if count == 0 {
        return Ok(0);
    }
    let ema = u16::from_le_bytes(s[STATS_EMA_SLOW..STATS_EMA_SLOW + 2].try_into().unwrap());
    Ok((ema.min(10_000) / 100) as u8)
}
