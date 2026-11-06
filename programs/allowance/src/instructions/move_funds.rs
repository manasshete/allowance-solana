use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    errors::AllowanceError,
    events::FundsMoved,
    state::{Vault, VAULT_SEED},
};

/// Shared by deposit and withdraw. Withdraw works while frozen, so the owner
/// can always pull funds out.
#[derive(Accounts)]
pub struct MoveFunds<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ AllowanceError::NotOwner, has_one = mint)]
    pub vault: Account<'info, Vault>,

    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = owner,
        token::token_program = token_program
    )]
    pub owner_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn deposit(ctx: Context<MoveFunds>, amount: u64) -> Result<()> {
    require!(amount > 0, AllowanceError::ZeroAmount);
    let a = &ctx.accounts;
    transfer_checked(
        CpiContext::new(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.owner_ata.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.vault_ata.to_account_info(),
                authority: a.owner.to_account_info(),
            },
        ),
        amount,
        a.mint.decimals,
    )?;
    emit!(FundsMoved { vault: a.vault.key(), deposit: true, amount, at: Clock::get()?.unix_timestamp });
    Ok(())
}

pub fn withdraw(ctx: Context<MoveFunds>, amount: u64) -> Result<()> {
    require!(amount > 0, AllowanceError::ZeroAmount);
    let a = &ctx.accounts;
    let owner = a.vault.owner;
    let seeds: &[&[u8]] = &[VAULT_SEED, owner.as_ref(), &[a.vault.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.vault_ata.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.owner_ata.to_account_info(),
                authority: a.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        a.mint.decimals,
    )?;
    emit!(FundsMoved { vault: a.vault.key(), deposit: false, amount, at: Clock::get()?.unix_timestamp });
    Ok(())
}
