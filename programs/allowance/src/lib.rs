//! Allowance: an on-chain spending firewall for AI agents.
//!
//! The owner funds a vault and gives an agent key a session with caps.
//! The only way USDC leaves the vault for anyone but the owner is
//! `agent_pay`, which checks every rule before a PDA-signed transfer
//! straight to the merchant's associated token account.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod reputation;
pub mod state;

use instructions::*;
use state::SessionParams;

declare_id!("83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL");

#[program]
pub mod allowance {
    use super::*;

    // ---------- owner ----------

    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        instructions::init_vault::handler(ctx)
    }

    pub fn deposit(ctx: Context<MoveFunds>, amount: u64) -> Result<()> {
        instructions::move_funds::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<MoveFunds>, amount: u64) -> Result<()> {
        instructions::move_funds::withdraw(ctx, amount)
    }

    pub fn freeze_all(ctx: Context<SetFrozen>) -> Result<()> {
        instructions::set_frozen::handler(ctx, true)
    }

    pub fn unfreeze(ctx: Context<SetFrozen>) -> Result<()> {
        instructions::set_frozen::handler(ctx, false)
    }

    pub fn create_session(ctx: Context<CreateSession>, params: SessionParams) -> Result<()> {
        instructions::create_session::handler(ctx, params)
    }

    pub fn revoke_session(ctx: Context<OwnerSession>) -> Result<()> {
        instructions::revoke_session::handler(ctx)
    }

    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        instructions::close_session::handler(ctx)
    }

    pub fn approve_pending(ctx: Context<ResolvePending>) -> Result<()> {
        instructions::resolve_pending::handler(ctx, true)
    }

    pub fn reject_pending(ctx: Context<ResolvePending>) -> Result<()> {
        instructions::resolve_pending::handler(ctx, false)
    }

    // ---------- agent ----------

    pub fn agent_pay(ctx: Context<AgentPay>, amount: u64, reason: String) -> Result<()> {
        instructions::agent_pay::handler(ctx, amount, reason)
    }

    pub fn request_approval(
        ctx: Context<RequestApproval>,
        amount: u64,
        reason: String,
    ) -> Result<()> {
        instructions::request_approval::handler(ctx, amount, reason)
    }
}
