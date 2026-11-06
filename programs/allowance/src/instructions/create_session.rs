use anchor_lang::prelude::*;

use crate::{
    errors::AllowanceError,
    events::SessionCreated,
    state::{MerchantCap, Session, SessionParams, Vault, MAX_LABEL_LEN, MAX_MERCHANTS, SESSION_SEED},
};

#[derive(Accounts)]
pub struct CreateSession<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner @ AllowanceError::NotOwner)]
    pub vault: Account<'info, Vault>,

    /// CHECK: any public key; it becomes the only signer allowed to spend in this session.
    pub agent: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Session::INIT_SPACE,
        seeds = [SESSION_SEED, vault.key().as_ref(), agent.key().as_ref()],
        bump
    )]
    pub session: Account<'info, Session>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateSession>, p: SessionParams) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(p.expires_at > now, AllowanceError::BadExpiry);
    require!(
        p.per_request_cap > 0 && p.daily_cap > 0 && p.per_request_cap <= p.daily_cap && p.min_reputation <= 100,
        AllowanceError::BadCaps
    );
    require!(p.merchants.len() <= MAX_MERCHANTS, AllowanceError::TooManyMerchants);

    let mut merchants = Vec::with_capacity(p.merchants.len());
    for (i, m) in p.merchants.iter().enumerate() {
        require!(m.label.len() <= MAX_LABEL_LEN, AllowanceError::LabelTooLong);
        require!(m.daily_cap > 0, AllowanceError::BadCaps);
        require!(
            !p.merchants[..i].iter().any(|o| o.merchant == m.merchant),
            AllowanceError::DuplicateMerchant
        );
        merchants.push(MerchantCap {
            merchant: m.merchant,
            label: m.label.clone(),
            daily_cap: m.daily_cap,
            spent_today: 0,
        });
    }

    let vault = &mut ctx.accounts.vault;
    vault.session_count = vault.session_count.checked_add(1).ok_or(AllowanceError::MathOverflow)?;

    let s = &mut ctx.accounts.session;
    s.vault = vault.key();
    s.agent = ctx.accounts.agent.key();
    s.per_request_cap = p.per_request_cap;
    s.daily_cap = p.daily_cap;
    s.spent_today = 0;
    s.other_daily_cap = p.other_daily_cap;
    s.other_spent_today = 0;
    s.min_reputation = p.min_reputation;
    s.day_start = now;
    s.expires_at = p.expires_at;
    s.created_at = now;
    s.revoked = false;
    s.total_paid = 0;
    s.pending_nonce = 0;
    s.merchants = merchants;
    s.bump = ctx.bumps.session;

    emit!(SessionCreated { vault: s.vault, session: s.key(), agent: s.agent, at: now });
    Ok(())
}
