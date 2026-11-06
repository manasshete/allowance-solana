# Implementation plan

> **Superseded** by [13-onchain-implementation-plan.md](13-onchain-implementation-plan.md): every payment goes through the program, and the site is multipage.

## Phase 1: Anchor program (Fri 22:30 to Sat 02:30)

Write state and errors first, then the instructions in this order: `init_vault`, `deposit`, `create_session`, `refill_pocket`, `freeze_all`, `revoke_session`, `withdraw`, then `agent_pay` and the approval pair if time allows. Get one PDA-signed `transfer_checked` working before writing any rule.

**state.rs**

```rust
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub mint: Pubkey,      // USDC or your test mint
    pub frozen: bool,      // kill switch
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct MerchantCap {
    pub merchant: Pubkey,
    pub daily_cap: u64,
    pub spent_today: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Session {
    pub vault: Pubkey,
    pub agent: Pubkey,
    pub per_request_cap: u64,
    pub daily_cap: u64,
    pub spent_today: u64,
    pub other_daily_cap: u64,  // merchants not listed below (reputation-gated)
    pub other_spent_today: u64,
    pub day_start: i64,
    pub expires_at: i64,
    pub revoked: bool,
    pub min_reputation: u8,    // 0 to 100, checked by the MCP server
    #[max_len(5)]
    pub merchants: Vec<MerchantCap>,
    pub bump: u8,
}
```

**errors.rs:** `Frozen`, `Revoked`, `Expired`, `OverRequestCap`, `OverDailyCap`, `OverMerchantCap`, `PocketFull`, `NotOwner`, `NotAgent`. One per rule, so the demo can show which rule fired.

**Seeds:** vault `["vault", owner]`; session `["session", vault, agent]`; the vault's USDC account is the vault PDA's associated token account; the pocket is the agent's associated token account.

**refill\_pocket, the core instruction**

```rust
pub fn refill_pocket(
    ctx: Context<RefillPocket>,
    amount: u64,
    merchant: Pubkey,
    reason_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &ctx.accounts.vault;
    let s = &mut ctx.accounts.session;

    require!(!vault.frozen, AllowanceError::Frozen);
    require!(!s.revoked, AllowanceError::Revoked);
    require!(now < s.expires_at, AllowanceError::Expired);
    require!(amount <= s.per_request_cap, AllowanceError::OverRequestCap);

    if now - s.day_start >= 86_400 {
        s.day_start = now;
        s.spent_today = 0;
        s.other_spent_today = 0;
        for m in s.merchants.iter_mut() { m.spent_today = 0; }
    }
    require!(s.spent_today + amount <= s.daily_cap, AllowanceError::OverDailyCap);

    match s.merchants.iter_mut().find(|m| m.merchant == merchant) {
        Some(m) => {
            require!(m.spent_today + amount <= m.daily_cap, AllowanceError::OverMerchantCap);
            m.spent_today += amount;
        }
        None => {
            require!(s.other_spent_today + amount <= s.other_daily_cap, AllowanceError::OverMerchantCap);
            s.other_spent_today += amount;
        }
    }
    // the pocket never holds more than one request's worth
    require!(ctx.accounts.pocket.amount + amount <= s.per_request_cap, AllowanceError::PocketFull);
    s.spent_today += amount;

    let owner = vault.owner;
    let seeds: &[&[u8]] = &[b"vault", owner.as_ref(), &[vault.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.pocket.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    emit!(PocketRefilled { session: s.key(), merchant, amount, reason_hash, at: now });
    Ok(())
}
```

`RefillPocket` accounts: `agent` (Signer, must equal `session.agent`), `vault`, `session` (has\_one = vault, seeds checked), `mint`, `vault_ata`, `pocket` (associated token account of the agent), `token_program` as `Interface<TokenInterface>`. Use `checked_add` in the real code.

**Known limit to state in the README:** the pocket can pay any address, so the merchant caps are enforced on what is refilled, not where it lands. The loss is still bounded by one request's worth, which is the point of the pocket.

## Phase 2: Program tests (Sat 02:30 to 03:30)

Run on the local validator with `anchor test`, then deploy with `anchor deploy --provider.cluster devnet` and save the program ID. Setup in a `before` hook: mint a 6-decimal test token, fund owner and agent, `init_vault`, deposit 20, create a session with per-request 0.05, daily 2, one listed merchant at 1 per day, other merchants at 0.5 per day, expiry in 1 hour.

| Test | Expect |
| --- | --- |
| Refill 0.01 for the listed merchant | Pocket +0.01, `spent_today` 0.01, event emitted |
| Refill 0.06 | `OverRequestCap` |
| Refill while the pocket already holds 0.05 | `PocketFull` |
| Refill past the merchant's 1 per day | `OverMerchantCap` |
| Refill past the 2 per day total | `OverDailyCap` |
| `freeze_all`, then refill | `Frozen`; `unfreeze` restores it |
| `revoke_session`, then refill | `Revoked` |
| Session with expiry in the past | `Expired` |
| A different keypair signs as agent | `NotAgent` (constraint error) |
| Agent tries `withdraw` | `NotOwner` |

For the daily reset, either add a test-only `set_day_start` instruction behind a feature flag, or skip the test and show the reset in the README.

## Phase 3: x402 demo API (Sat 09:30 to 12:00)

A small Express app with three paid routes, so the demo can show a normal call, an expensive one and an untrusted one.

| Route | Price | Pays to | Used in demo for |
| --- | --- | --- | --- |
| `GET /summary?url=` | 0.01 | Merchant A (listed in session) | Happy path |
| `GET /premium-report` | 0.50 | Merchant A | Over the per-request cap |
| `GET /sketchy-data` | 0.01 | Merchant C (registered, low reputation) | Reputation refusal |

Steps:

1. Add `@x402/express` payment middleware with each route's price, the `solana-devnet` network (CAIP-2 `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` in v2), your test mint as the asset, and the merchant's address as `payTo`. Follow the Solana example in the [x402 repo](https://github.com/coinbase/x402).
2. Facilitator: if no public facilitator settles Solana devnet, run your own with `ExactSvmFacilitator` from `@x402/svm` inside the same app, with a fee-payer keypair holding devnet SOL.
3. The route handler does real work: `/summary` fetches the page and asks Claude for a three-line summary, so the payment buys something visible.
4. Test from a script with `@x402/fetch`'s `wrapFetchWithPayment` and a plain funded keypair before wiring in the pocket.

**Done when:** a script pays `/summary` from a funded keypair and gets the summary back on devnet.

Register merchant A and merchant C in the Agent Registry on devnet (`8004-solana`), then leave a few good feedback scores for A and poor ones for C from a spare wallet, so the reputation gate has real data.

## Phase 4: MCP server (Sat 12:00 to 19:30)

The MCP server holds the agent keypair (from an env var, never sent to the model) and exposes five tools.

| Tool | Input | What it does |
| --- | --- | --- |
| `get_allowance` | none | Vault balance, pocket balance, caps, spent today, frozen or not |
| `get_history` | `limit` | Recent `PocketRefilled` events and x402 receipts, with explorer links |
| `pay_x402` | `url`, `reason` | Calls a paid API through the firewall (flow below) and returns the response |
| `transfer` | `to`, `amount`, `reason` | Pays a contact via `agent_pay` (only if you built it) |
| `check_merchant` | `address` | Shows the merchant's reputation and which cap applies |

**The `pay_x402` flow**

```ts
async function payX402(url: string, reason: string) {
  // 1. Ask for the resource without paying, read the 402 terms
  const probe = await fetch(url);
  if (probe.status !== 402) return probe.text();
  const { amount, payTo } = parseRequirements(await probe.json());

  // 2. Reputation gate (off-chain): merchants not listed in the session
  if (!session.merchants.some(m => m.merchant.equals(payTo))) {
    const asset = merchantDirectory[payTo.toBase58()];          // payTo -> registry asset
    const { averageScore } = await registry.getSummary(asset);  // 8004-solana, read-only
    if (averageScore < session.minReputation) throw new Error(`Refused: reputation ${averageScore}`);
  }

  // 3. On-chain gate: refill the pocket with exactly the price
  const reasonHash = sha256(`${url}|${reason}`);
  await program.methods.refillPocket(new BN(amount), payTo, [...reasonHash])
    .accounts({ agent: agent.publicKey, vault, session, mint, vaultAta, pocket })
    .signers([agent]).rpc();   // fails with the program's error if any rule is broken

  // 4. Pay from the pocket with the standard x402 client
  const paidFetch = wrapFetchWithPayment(fetch, createSvmClient({ signer: agent }));
  const res = await paidFetch(url);
  log({ url, reason, amount, payTo, tx: receiptFrom(res) });
  return res.text();
}
```

Check the exact `@x402/svm` and `@x402/fetch` signatures against their README on Thursday; the shape above is the flow, not final code. Return program errors to the model as plain sentences ("Refused by the chain: over the 0.05 USDC per-request cap") so Claude explains them in the demo.

**Transports:** stdio for Claude Desktop (`claude_desktop_config.json` points at `node apps/mcp/dist/index.js`), plus Streamable HTTP if you host it.

**Done when:** in Claude Desktop, "Summarize solana.com using the paid summary API" returns a summary and a devnet transaction link.

## Phase 5: Dashboard (Sat 20:30 to Sun 02:00)

One page is enough; judges watch the video more than they click around. Reuse Pay3's look (the jar gauge, session cards) but rebuild the components.

| Area | Contents | Signs with |
| --- | --- | --- |
| Header | Connect Phantom (wallet adapter, devnet), program ID link |  |
| Vault card | Balance gauge, Deposit and Withdraw, big red **Freeze all** button | Owner |
| Session form | Agent pubkey (shown by the MCP server on start), per-request cap, daily cap, merchant caps, other-merchant cap, minimum reputation, expiry | Owner |
| Session card | Spent today vs cap bars, pocket balance, Revoke | Owner |
| Live feed | Each refill: time, merchant name, amount, the agent's reason, reputation score, explorer link; refused attempts in red with the rule that fired |  |

The feed reads `PocketRefilled` events via `program.addEventListener` (or `onLogs` on the program ID). The agent's reason text is not on-chain, only its hash, so have the MCP server post `{reason, hash}` to a tiny `/log` endpoint the dashboard reads, and show a check mark when the hash matches the on-chain event. Refused attempts come from that log too.

**Done when:** you can set up a session, watch Claude's payments appear within about a second, and freeze it, all in the browser.

## Phase 6: Deploy and submit (Sun 08:30 to 21:15)

- [ ] Run `scripts/demo.ts` end to end twice on devnet with fresh wallets
- [ ] Deploy `apps/web` to Vercel; host `apps/paid-api` (Render, Railway or Vercel functions) so judges can hit it
- [ ] README: one-paragraph pitch, the architecture picture, the rules the program enforces, program ID with explorer link, how to run the MCP server locally, the known limit of the pocket
- [ ] Record the demo video following the script in the Plan tab
- [ ] Devpost: tracks Overall and AI, repo, live link, video, program ID; mention it rebuilds your Stellar idea with policy moved on-chain
- [ ] Initial submission before 19:30 IST, final before 21:15 IST
