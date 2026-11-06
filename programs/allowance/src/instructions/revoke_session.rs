use anchor_lang::prelude::*;

use crate::{
    errors::AllowanceError,
    events::SessionRevoked,
    state::{Session, Vault},
};

#[derive(Accounts)]
pub struct OwnerSession<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ AllowanceError::NotOwner)]
    pub vault: Account<'info, Vault>,

    #[account(mut, has_one = vault)]
    pub session: Account<'info, Session>,
}

pub fn handler(ctx: Context<OwnerSession>) -> Result<()> {
    let s = &mut ctx.accounts.session;
    s.revoked = true;
    emit!(SessionRevoked { vault: s.vault, session: s.key(), at: Clock::get()?.unix_timestamp });
    Ok(())
}
