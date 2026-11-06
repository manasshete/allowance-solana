use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    errors::AllowanceError,
    events::PaymentMade,
    reputation,
    state::{check_reason, Pending, PendingStatus, Session, Vault, VAULT_SEED},
};

/// The only way USDC leaves the vault for a merchant.
///
/// Optional accounts:
/// - `registry_agent` + `atom_stats`: required when the merchant is not listed
///   in the session; the program reads its reputation from them.
/// - `pending`: an approved over-cap request, used once as a voucher.
#[derive(Accounts)]
pub struct AgentPay<'info> {
    pub agent: Signer<'info>,

    pub vault: Account<'info, Vault>,

    #[account(mut, has_one = vault, has_one = agent @ AllowanceError::NotAgent)]
    pub session: Account<'info, Session>,

    #[account(address = vault.mint, mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: the payee wallet (x402 payTo); bound to merchant_ata below.
    pub merchant: UncheckedAccount<'info>,

    /// The merchant's associated token account, so the money can only land
    /// where an x402 facilitator expects it.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = merchant,
        associated_token::token_program = token_program
    )]
    pub merchant_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: validated in reputation::score_for (owner, discriminator, wallet).
    pub registry_agent: Option<UncheckedAccount<'info>>,

    /// CHECK: validated in reputation::score_for (owner, discriminator, asset).
    pub atom_stats: Option<UncheckedAccount<'info>>,

    #[account(mut, has_one = session @ AllowanceError::PendingMismatch)]
    pub pending: Option<Account<'info, Pending>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<AgentPay>, amount: u64, reason: String) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let merchant = ctx.accounts.merchant.key();
    let vault_key = ctx.accounts.vault.key();
    let session_key = ctx.accounts.session.key();

    // 1. switches and expiry
    require!(!ctx.accounts.vault.frozen, AllowanceError::Frozen);
    require!(!ctx.accounts.session.revoked, AllowanceError::Revoked);
    require!(!ctx.accounts.session.is_expired(now), AllowanceError::Expired);

    // 2. the payment itself
    require!(amount > 0, AllowanceError::ZeroAmount);
    check_reason(&reason)?;

    // 3. per-request cap, or a one-time approved voucher
    let pending_key = match ctx.accounts.pending.as_mut() {
        Some(p) => {
            require_keys_eq!(p.merchant, merchant, AllowanceError::PendingMismatch);
            require!(p.amount == amount, AllowanceError::PendingMismatch);
            require!(p.status == PendingStatus::Approved, AllowanceError::PendingNotApproved);
            p.status = PendingStatus::Used;
            p.resolved_at = now;
            Some(p.key())
        }
        None => {
            require!(amount <= ctx.accounts.session.per_request_cap, AllowanceError::OverRequestCap);
            None
        }
    };

    // 4. daily caps (an approval still counts against them)
    let s = &mut ctx.accounts.session;
    s.roll_day(now);
    let new_daily = s.spent_today.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
    require!(new_daily <= s.daily_cap, AllowanceError::OverDailyCap);

    // 5. merchant: listed cap, or reputation gate + shared cap
    let mut reputation_score = None;
    match s.merchants.iter_mut().find(|m| m.merchant == merchant) {
        Some(m) => {
            let n = m.spent_today.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
            require!(n <= m.daily_cap, AllowanceError::OverMerchantCap);
            m.spent_today = n;
        }
        None => {
            require!(s.other_daily_cap > 0, AllowanceError::NotListed);
            let (agent_acc, stats_acc) = match (&ctx.accounts.registry_agent, &ctx.accounts.atom_stats) {
                (Some(a), Some(b)) => (a, b),
                _ => return err!(AllowanceError::ReputationAccountMissing),
            };
            let score = reputation::score_for(agent_acc, stats_acc, &merchant)?;
            require!(score >= s.min_reputation, AllowanceError::LowReputation);
            let n = s.other_spent_today.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
            require!(n <= s.other_daily_cap, AllowanceError::OverOtherCap);
            s.other_spent_today = n;
            reputation_score = Some(score);
        }
    }
    s.spent_today = new_daily;
    s.total_paid = s.total_paid.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
    let spent_today = s.spent_today;

    // 6. vault ATA -> merchant ATA, signed by the vault PDA
    let a = &ctx.accounts;
    let owner = a.vault.owner;
    let seeds: &[&[u8]] = &[VAULT_SEED, owner.as_ref(), &[a.vault.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.vault_ata.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.merchant_ata.to_account_info(),
                authority: a.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        a.mint.decimals,
    )?;

    emit!(PaymentMade {
        vault: vault_key,
        session: session_key,
        merchant,
        amount,
        reason,
        pending: pending_key,
        reputation: reputation_score,
        spent_today,
        at: now,
    });
    Ok(())
}
