use anchor_lang::prelude::*;

use crate::{
    errors::AllowanceError,
    state::{Session, Vault},
};

/// Returns the session's rent to the owner once it can no longer spend.
#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ AllowanceError::NotOwner)]
    pub vault: Account<'info, Vault>,

    #[account(mut, has_one = vault, close = owner)]
    pub session: Account<'info, Session>,
}

pub fn handler(ctx: Context<CloseSession>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let s = &ctx.accounts.session;
    require!(s.revoked || s.is_expired(now), AllowanceError::SessionStillActive);
    Ok(())
}
