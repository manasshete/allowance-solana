use anchor_lang::prelude::*;

use crate::{errors::AllowanceError, events::VaultFrozen, state::Vault};

#[derive(Accounts)]
pub struct SetFrozen<'info> {
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner @ AllowanceError::NotOwner)]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<SetFrozen>, frozen: bool) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.frozen = frozen;
    emit!(VaultFrozen { vault: vault.key(), frozen, at: Clock::get()?.unix_timestamp });
    Ok(())
}
