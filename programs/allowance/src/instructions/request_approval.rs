use anchor_lang::prelude::*;

use crate::{
    errors::AllowanceError,
    events::PendingCreated,
    state::{check_reason, Pending, PendingStatus, Session, Vault, PENDING_SEED},
};

/// The agent asks the owner to allow one payment over the per-request cap.
/// The agent pays the rent for the Pending account.
#[derive(Accounts)]
pub struct RequestApproval<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    pub vault: Account<'info, Vault>,

    #[account(mut, has_one = vault, has_one = agent @ AllowanceError::NotAgent)]
    pub session: Account<'info, Session>,

    /// CHECK: the payTo wallet the approval is for; stored and matched in agent_pay.
    pub merchant: UncheckedAccount<'info>,

    #[account(
        init,
        payer = agent,
        space = 8 + Pending::INIT_SPACE,
        seeds = [PENDING_SEED, session.key().as_ref(), &session.pending_nonce.to_le_bytes()],
        bump
    )]
    pub pending: Account<'info, Pending>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestApproval>, amount: u64, reason: String) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &ctx.accounts.vault;
    let s = &mut ctx.accounts.session;

    require!(!vault.frozen, AllowanceError::Frozen);
    require!(!s.revoked, AllowanceError::Revoked);
    require!(!s.is_expired(now), AllowanceError::Expired);
    require!(amount > 0, AllowanceError::ZeroAmount);
    check_reason(&reason)?;

    let nonce = s.pending_nonce;
    s.pending_nonce = nonce.checked_add(1).ok_or(AllowanceError::MathOverflow)?;

    let p = &mut ctx.accounts.pending;
    p.vault = vault.key();
    p.session = s.key();
    p.merchant = ctx.accounts.merchant.key();
    p.amount = amount;
    p.reason = reason.clone();
    p.created_at = now;
    p.resolved_at = 0;
    p.status = PendingStatus::Open;
    p.nonce = nonce;
    p.bump = ctx.bumps.pending;

    emit!(PendingCreated {
        vault: p.vault,
        session: p.session,
        pending: p.key(),
        merchant: p.merchant,
        amount,
        reason,
        at: now,
    });
    Ok(())
}
