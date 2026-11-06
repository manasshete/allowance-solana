use anchor_lang::prelude::*;

use crate::{
    errors::AllowanceError,
    events::PendingResolved,
    state::{Pending, PendingStatus, Session, Vault},
};

#[derive(Accounts)]
pub struct ResolvePending<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ AllowanceError::NotOwner)]
    pub vault: Account<'info, Vault>,

    #[account(has_one = vault)]
    pub session: Account<'info, Session>,

    #[account(mut, has_one = session @ AllowanceError::PendingMismatch)]
    pub pending: Account<'info, Pending>,
}

pub fn handler(ctx: Context<ResolvePending>, approve: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.pending;
    require!(p.status == PendingStatus::Open, AllowanceError::PendingNotOpen);
    p.status = if approve { PendingStatus::Approved } else { PendingStatus::Rejected };
    p.resolved_at = now;
    emit!(PendingResolved {
        vault: p.vault,
        session: p.session,
        pending: p.key(),
        approved: approve,
        at: now,
    });
    Ok(())
}
