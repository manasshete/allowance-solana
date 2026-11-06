# Implementation plan v2: every payment on-chain

This replaces [10-implementation-plan.md](10-implementation-plan.md). The change: **every payment, every refusal and every reason is a Solana transaction that goes through the Allowance program.** Nothing is checked or recorded only on a server. The dashboard is a multipage Next.js app that reads only from the chain.

## 0. What changed from v1 and why

| v1 | v2 | Why |
| --- | --- | --- |
| `refill_pocket` tops up an agent-owned pocket, then the agent pays the merchant | `agent_pay` moves USDC straight from the vault to the merchant's token account | Money can't leave the vault for anyone except the merchant the rules were checked against. The agent can't lie about the merchant any more |
| Reputation is checked by the MCP server | Reputation is checked inside `agent_pay` from the registry account (or, under the fallback in § 2, unlisted merchants are refused on-chain) | The chain, not the server, says no |
| The reason is stored as a hash, and the text goes to a `/log` server | The reason is an instruction argument (up to 200 bytes) and is emitted in the event | Readable in the explorer, no server |
| A refusal only shows in the server log | A refused payment is recorded as a failed transaction carrying the program's error code | Every refusal is in the explorer too |
| `@x402/express` with a stock facilitator | `@x402/express` pointed at **your own facilitator**, which accepts an `agent_pay` transaction as payment | A stock facilitator expects a plain token transfer signed by the payer |
| Single-page dashboard | Multipage app: landing, overview, vault, sessions, activity, transaction detail, approvals, merchants, how it works | Each job gets its own page and URL |

**Cost of the change:** paying real pay.sh endpoints through a stock facilitator is out of scope. Only APIs that use your facilitator, or one that accepts `agent_pay`, can be paid. State this in the README as the trade for full on-chain enforcement.

## 1. Architecture

```text
 Owner (Phantom) ──signs──► init_vault, deposit, withdraw, create_session,
                            revoke_session, freeze_all, unfreeze,
                            approve_pending, reject_pending
                                   │
                                   ▼
                     ┌──────────────────────────────┐
                     │   Allowance program (Anchor) │ ◄── reads Agent Registry
                     │  Vault PDA ─ owns vault ATA  │     reputation account
                     │  Session PDA, Pending PDA    │
                     └──────────────────────────────┘
                                   ▲
 Agent key (MCP server) ──signs──► agent_pay, request_approval
          │                        │
          │ x402: tx in header     │ fee payer co-signs and submits
          ▼                        │
   apps/paid-api ──/verify,/settle──► apps/facilitator
                                   │
 apps/web (Next.js) ◄── reads accounts, transactions and logs from devnet RPC
```

Signers:
- **Owner:** everything that sets rules or moves money back.
- **Agent:** only `agent_pay` and `request_approval`. A leaked agent key can spend at most what the session rules allow.
- **Facilitator:** pays the network fee only. It must never be an authority on anything (§ 5.3).

## 2. Decision gates to settle on Thursday, before the event

Run these during prep. Each has an on-chain fallback, so neither one blocks the build.

**Gate R: can the program read a merchant's reputation from one account?**
1. Read the `8004-solana` source. Find the account that holds a registered agent's aggregate score, its owner program ID on devnet, its seeds, and how it links to the agent's wallet (the `payTo` address).
2. If one account (or an identity account plus a summary account) gives `wallet → score`, use **R-onchain**: `agent_pay` takes those accounts and checks them.
3. If the score is computed off-chain from many feedback accounts (`getSummary` aggregating in the SDK), use **R-listed**:
   - Unlisted merchants are refused on-chain with `NotListed`.
   - The owner adds a merchant to the session after looking at its reputation on the dashboard's merchant page.
   - Demo step 5 becomes "merchant not listed".

**Gate F: what does the x402 Solana facilitator accept?**
1. Read the `exact` scheme verifier in `@x402/svm`.
2. If it only accepts a top-level `TransferChecked` (expected), build your own facilitator (§ 5). Otherwise reuse it.
3. Note which x402 version you pin (v1 or v2). Header names and the payload shape differ between them; use your pinned version's names everywhere below.

Write the outcome of both gates at the top of the repo README on Thursday.

**Outcomes (checked 2026-11-06 against `8004-solana` 0.8.5 and `@x402/svm` 2.30.0):**
- **Gate R: R-onchain.**
  - The registry's `AgentAccount` (registry program `8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C` on devnet, PDA `["agent", asset]`) stores `agent_wallet: Option<Pubkey>`.
  - The ATOM engine's `AtomStats` (`AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF` on devnet, PDA `["atom_stats", asset]`) stores `ema_score_slow` (0 to 10000). The SDK's `getAverageScore()` is `ema_score_slow / 100`.
  - `agent_pay` takes both accounts and checks:
    - each account's owner program and discriminator,
    - `agent_wallet == merchant`,
    - that both accounts point at the same asset,
    - the score. See `programs/allowance/src/reputation.rs`.
- **Gate F: no custom verifier needed.** The stock `ExactSvmScheme` facilitator has a smart-wallet mode (`enableSmartWalletVerification: true`, `smartWalletAllowedPrograms: [ALLOWANCE_PROGRAM_ID]`). It:
  - checks the fee payer appears in no instruction,
  - checks the compute budget limits,
  - simulates the transaction,
  - requires exactly one inner `transferChecked` of the price to `payTo`'s token account.

  So `apps/facilitator` is configuration, not custom code. A public facilitator that adds Allowance to its allowlist could also settle these payments.

## 3. Repo layout

```text
allowance/
  programs/allowance/src/
    lib.rs                 entry points
    state.rs               Vault, Session, MerchantCap, Pending
    errors.rs              one error per rule
    events.rs              PaymentMade, PendingCreated, PendingResolved, VaultFrozen, SessionRevoked
    reputation.rs          registry account parsing (Gate R)
    instructions/          one file per instruction
  tests/allowance.ts       Anchor tests
  packages/client/         IDL types, PDA helpers, error map, history parser (shared by MCP, web, facilitator)
  apps/facilitator/        x402 /verify, /settle, /supported for agent_pay transactions
  apps/paid-api/           demo x402 API (Express) using the facilitator
  apps/mcp/                MCP server, holds the agent key
  apps/web/                Next.js multipage dashboard
  scripts/
    seed.ts                test mint, fund owner, agent, merchants, facilitator
    register-merchants.ts  Agent Registry entries and feedback (Gate R-onchain only)
    demo.ts                the whole demo as a CLI script (fallback for a live MCP failure)
```

npm workspaces. Pin Anchor, `@solana/web3.js`, `@x402/*` and `8004-solana` versions on Thursday.

## 4. Phase 1: the program (Fri 22:30 to Sat 03:00)

### 4.1 State

```rust
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub frozen: bool,
    pub session_count: u32,   // for listing sessions on the web
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct MerchantCap {
    pub merchant: Pubkey,     // the payTo wallet, not its token account
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
    pub other_daily_cap: u64,     // unlisted merchants; must be 0 under R-listed
    pub other_spent_today: u64,
    pub min_reputation: u8,       // 0..=100, checked on-chain under R-onchain
    pub day_start: i64,           // set to now in create_session
    pub expires_at: i64,
    pub revoked: bool,
    pub total_paid: u64,          // lifetime, for the overview page
    pub pending_nonce: u64,       // next Pending seed
    #[max_len(5)]
    pub merchants: Vec<MerchantCap>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PendingStatus { Open, Approved, Rejected, Used }

#[account]
#[derive(InitSpace)]
pub struct Pending {
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    #[max_len(200)]
    pub reason: String,
    pub created_at: i64,
    pub status: PendingStatus,
    pub nonce: u64,
    pub bump: u8,
}
```

Seeds:
- Vault: `["vault", owner]`.
- Session: `["session", vault, agent]`.
- Pending: `["pending", session, nonce.to_le_bytes()]`.
- Vault USDC: the vault PDA's associated token account.

### 4.2 Errors (one per rule, in check order)

`Frozen`, `Revoked`, `Expired`, `ZeroAmount`, `ReasonMissing`, `ReasonTooLong`, `OverRequestCap`, `OverDailyCap`, `OverMerchantCap`, `OverOtherCap`, `NotListed`, `ReputationAccountMissing`, `BadReputationAccount`, `LowReputation`, `PendingMismatch`, `PendingNotApproved`, `TooManyMerchants`, `BadExpiry`, `MathOverflow`.

`NotOwner` and `NotAgent` come from `has_one` / `constraint` attributes with these custom errors attached, so they show up by name too.

### 4.3 Instructions

| Instruction | Signer | Accounts (besides programs) | What it does |
| --- | --- | --- | --- |
| `init_vault` | Owner | vault (init), mint, vault_ata (init, ATA of vault) | Creates the vault and its USDC account |
| `deposit(amount)` | Owner | vault, owner_ata, vault_ata, mint | Owner → vault |
| `withdraw(amount)` | Owner | vault, vault_ata, owner_ata, mint | Vault → owner, PDA-signed. Works while frozen |
| `freeze_all` / `unfreeze` | Owner | vault | Flips `frozen` and emits `VaultFrozen{frozen}` |
| `create_session(params)` | Owner | vault, session (init), agent (unchecked) | Validates params (`expires_at > now`, at most 5 merchants, caps nonzero, per-request ≤ daily). Sets `day_start = now` and increments `session_count` |
| `revoke_session` | Owner | vault, session | `revoked = true` and emits `SessionRevoked` |
| `close_session` | Owner | vault, session (close = owner) | Reclaims rent from a revoked or expired session |
| `agent_pay(amount, reason, use_pending)` | Agent | vault, session, mint, vault_ata, merchant (unchecked), merchant_ata, reputation (optional), pending (optional) | **The only way USDC leaves for a merchant.** All checks below |
| `request_approval(amount, merchant, reason)` | Agent | vault, session, pending (init at `pending_nonce`) | Records an over-cap request and emits `PendingCreated` |
| `approve_pending` / `reject_pending` | Owner | vault, session, pending | Sets the status and emits `PendingResolved` |

On `create_session`, the client puts a `SystemProgram.transfer` of 0.02 devnet SOL from the owner to the agent in the same transaction. The agent only pays fees when it records a refusal (§ 6.3).

### 4.4 `agent_pay` checks, in order

```rust
pub fn agent_pay(ctx: Context<AgentPay>, amount: u64, reason: String, use_pending: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &ctx.accounts.vault;
    let s = &mut ctx.accounts.session;
    let merchant = ctx.accounts.merchant.key();

    require!(!vault.frozen, AllowanceError::Frozen);
    require!(!s.revoked, AllowanceError::Revoked);
    require!(now < s.expires_at, AllowanceError::Expired);
    require!(amount > 0, AllowanceError::ZeroAmount);
    require!(!reason.is_empty(), AllowanceError::ReasonMissing);
    require!(reason.len() <= 200, AllowanceError::ReasonTooLong);

    // over-cap approval acts as a one-time voucher for this merchant and amount
    if use_pending {
        let p = ctx.accounts.pending.as_mut().ok_or(AllowanceError::PendingMismatch)?;
        require_keys_eq!(p.session, s.key(), AllowanceError::PendingMismatch);
        require_keys_eq!(p.merchant, merchant, AllowanceError::PendingMismatch);
        require!(p.amount == amount, AllowanceError::PendingMismatch);
        require!(p.status == PendingStatus::Approved, AllowanceError::PendingNotApproved);
        p.status = PendingStatus::Used;
    } else {
        require!(amount <= s.per_request_cap, AllowanceError::OverRequestCap);
    }

    if now - s.day_start >= 86_400 {
        s.day_start = now;
        s.spent_today = 0;
        s.other_spent_today = 0;
        for m in s.merchants.iter_mut() { m.spent_today = 0; }
    }
    let new_daily = s.spent_today.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
    require!(new_daily <= s.daily_cap, AllowanceError::OverDailyCap);   // approvals still count

    match s.merchants.iter_mut().find(|m| m.merchant == merchant) {
        Some(m) => {
            let n = m.spent_today.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
            require!(n <= m.daily_cap, AllowanceError::OverMerchantCap);
            m.spent_today = n;
        }
        None => {
            // Gate R-listed: other_daily_cap is 0, so this always refuses
            require!(s.other_daily_cap > 0, AllowanceError::NotListed);
            let rep = ctx.accounts.reputation.as_ref().ok_or(AllowanceError::ReputationAccountMissing)?;
            let score = reputation::score_for(rep, &merchant)?;   // checks owner program + link to merchant
            require!(score >= s.min_reputation, AllowanceError::LowReputation);
            let n = s.other_spent_today.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;
            require!(n <= s.other_daily_cap, AllowanceError::OverOtherCap);
            s.other_spent_today = n;
        }
    }
    s.spent_today = new_daily;
    s.total_paid = s.total_paid.checked_add(amount).ok_or(AllowanceError::MathOverflow)?;

    // vault ATA -> merchant ATA, signed by the vault PDA
    let owner = vault.owner;
    let seeds: &[&[u8]] = &[b"vault", owner.as_ref(), &[vault.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.merchant_ata.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    emit!(PaymentMade { session: s.key(), merchant, amount, reason, pending: use_pending, at: now });
    Ok(())
}
```

`AgentPay` constraints:
- `agent: Signer` with `constraint = agent.key() == session.agent @ NotAgent`.
- `session` has `has_one = vault` and checked seeds.
- `vault_ata` has `associated_token::mint = mint, associated_token::authority = vault`.
- `merchant_ata` has `token::mint = mint, token::authority = merchant`. The merchant's token account must already exist; `seed.ts` creates it.
- `mint` has `address = vault.mint`.
- `token_program: Interface<TokenInterface>`.
- `reputation: Option<UncheckedAccount>`, validated inside `score_for`.
- `pending: Option<Account<Pending>>` with `mut`.

Error handling in the client: a missing optional account is passed as the program ID (Anchor's convention).

### 4.5 `reputation.rs` (Gate R-onchain)

```rust
pub fn score_for(acc: &AccountInfo, merchant: &Pubkey) -> Result<u8> {
    require_keys_eq!(*acc.owner, REGISTRY_PROGRAM_ID, AllowanceError::BadReputationAccount);
    let data = acc.try_borrow_data()?;
    // decode per the 8004-solana layout found in Gate R:
    // check the discriminator, check that the linked wallet == merchant
    // (or re-derive the PDA from merchant and compare to acc.key()), read the score (0..=100)
    ...
}
```

Hard-code `REGISTRY_PROGRAM_ID` for devnet. Read with a minimal manual decoder rather than pulling the registry crate in, to avoid dependency conflicts mid-event.

## 5. Phase 2: tests and deploy (Sat 03:00 to 04:00)

Run `anchor test` on the local validator, using LiteSVM or Bankrun if `anchor test` is slow.

`before` setup:
- Mint a 6-decimal test token.
- Fund the owner, agent, facilitator, merchants A, B and C (create all their token accounts).
- `init_vault`, then deposit 20.
- Create a session: per request 0.05, daily 2, merchant A at 1/day, other merchants at 0.5/day, min reputation 70, expiry in 1 hour.

Under R-onchain, create fake registry accounts with `setAccount` in LiteSVM/Bankrun: B with a score of 85, C with 40.

| # | Test | Expect |
| --- | --- | --- |
| 1 | Pay 0.01 to A | A +0.01, vault −0.01, `spent_today` 0.01, `PaymentMade` carries the reason |
| 2 | Pay 0.06 to A | `OverRequestCap` |
| 3 | Pay A past 1/day | `OverMerchantCap` |
| 4 | Pay past 2/day across merchants | `OverDailyCap` |
| 5 | Pay B (unlisted, score 85) 0.01 | Success, `other_spent_today` 0.01 |
| 6 | Pay C (score 40) | `LowReputation` |
| 7 | Pay B with no reputation account | `ReputationAccountMissing` |
| 8 | Pay B with C's reputation account | `BadReputationAccount` |
| 9 | Pay B with an account not owned by the registry program | `BadReputationAccount` |
| 10 | (R-listed) pay any unlisted merchant | `NotListed` |
| 11 | `freeze_all`, then pay | `Frozen`; after `unfreeze`, paying works |
| 12 | `revoke_session`, then pay | `Revoked` |
| 13 | Session with expiry in the past | `create_session` fails with `BadExpiry`; a session that expires during the test gives `Expired` on pay |
| 14 | Empty reason, 201-byte reason | `ReasonMissing`, `ReasonTooLong` |
| 15 | A different key signs as agent | `NotAgent` |
| 16 | Agent calls `withdraw` or `freeze_all` | `NotOwner` |
| 17 | `merchant_ata` owned by someone other than `merchant` | Constraint error (money can't be redirected) |
| 18 | `request_approval` 0.50, then pay with `use_pending` before approval | `PendingNotApproved` |
| 19 | Approve, then pay 0.50 with `use_pending` | Success, status `Used`; paying again with it gives `PendingNotApproved` |
| 20 | Approved pending, but a different amount or merchant | `PendingMismatch` |
| 21 | Daily reset | Use a test-only `set_day_start` behind `#[cfg(feature = "test-clock")]`, or warp the clock in LiteSVM |
| 22 | `withdraw` while frozen | Works |

Then:
- `anchor deploy --provider.cluster devnet`.
- Save the program ID in `packages/client/src/constants.ts`.
- Publish the IDL with `anchor idl init`.

## 6. Phase 3: client package, facilitator and paid API (Sat 09:30 to 12:30)

### 6.1 `packages/client`

| Export | Purpose |
| --- | --- |
| `PROGRAM_ID`, `REGISTRY_PROGRAM_ID`, `MINT`, `getProgram(provider)` | Setup |
| `vaultPda(owner)`, `sessionPda(vault, agent)`, `pendingPda(session, nonce)`, `vaultAta(vault)` | PDAs |
| `buildAgentPayIx({ agent, owner, merchant, amount, reason, reputation?, pending? })` | One instruction, used by MCP, facilitator tests and `demo.ts` |
| `ERRORS: Record<number, { name, sentence }>` | From the IDL, e.g. `6006 → OverRequestCap, "over the 0.05 USDC per-request cap"`. The sentence is filled from session values at runtime |
| `parseAllowanceTx(tx)` | Turns a fetched transaction into `{ kind, ok, errorName?, amount, merchant, reason, session, signature, time }`. Decodes instruction data with `BorshInstructionCoder`, so failed payments show their amount and reason too |
| `fetchSessionHistory(conn, session, { before, limit })` | `getSignaturesForAddress(session)` → `getTransactions` → `parseAllowanceTx` |
| `formatUsdc(u64)`, `parseUsdc(string)` | 6-decimal helpers |

### 6.2 `apps/facilitator` (Express, port 4020)

Endpoints follow the x402 facilitator interface so that `@x402/express` can call it:

- **`GET /supported`:** returns `{ scheme: "exact", network: "solana-devnet", extra: { feePayer } }`.
- **`POST /verify { paymentPayload, paymentRequirements }`:** decodes the base64 transaction and rejects unless **all** of these hold:
  1. The fee payer is the facilitator's key.
  2. The instructions are only `ComputeBudget` (unit limit ≤ 200k, price ≤ a set max) plus exactly one Allowance `agent_pay`.
  3. `agent_pay`'s `merchant` account == `payTo`, `mint` == `asset`, `merchant_ata` == the ATA of (`payTo`, `asset`), and the decoded `amount` == the required amount.
  4. The facilitator key appears in no instruction's account list. Otherwise someone could make it pay rent or act as an authority.
  5. The agent signature is present and valid.
  6. The blockhash is recent.
  7. `simulateTransaction` with `sigVerify: false` succeeds. This runs every program rule, so a refused payment fails here.

  It returns `{ isValid, invalidReason, payer: agent }`.
- **`POST /settle`:** re-runs verify, adds the fee payer signature, sends and confirms (`confirmed`), and returns `{ success, transaction: signature, network, payer }`.

Unit tests for checks 1 to 4, with hand-built bad transactions: wrong `payTo`, wrong amount, an extra instruction, and the fee payer listed as an account.

### 6.3 `apps/paid-api` (Express, port 4021)

`@x402/express` payment middleware with `facilitator: { url: "http://localhost:4020" }` and these routes:

| Route | Price | `payTo` | Demo use |
| --- | --- | --- | --- |
| `GET /summary?url=` | 0.01 | Merchant A (listed) | Happy path: fetches the page and has Claude write a three-line summary |
| `GET /premium-report` | 0.50 | Merchant A | `OverRequestCap`; then the approval flow |
| `GET /market-data` | 0.01 | Merchant B (unlisted, good reputation) | Reputation pass (R-onchain only) |
| `GET /sketchy-data` | 0.01 | Merchant C (low reputation or unlisted) | `LowReputation` or `NotListed` |

**Done when:** `scripts/demo.ts` builds an `agent_pay` transaction, pays `/summary`, and gets the summary plus a devnet signature back.

## 7. Phase 4: MCP server (Sat 13:30 to 19:30)

Holds `AGENT_SECRET_KEY` (an env var that never reaches the model) and the owner and session addresses from config.

### 7.1 Tools

| Tool | Input | Output |
| --- | --- | --- |
| `get_allowance` | none | Vault balance, frozen, session caps, spent today per cap, expiry, min reputation |
| `get_history` | `limit`, `status?` (`paid`, `refused`, all) | Rows from `fetchSessionHistory` with explorer links |
| `check_merchant` | `address` | Listed or not, its cap and spent today, and its reputation score (read from chain) |
| `pay_x402` | `url`, `reason` | The API response, or a refusal sentence plus the failed-transaction link |
| `transfer` | `to` (a contact name or address), `amount`, `reason` | A direct `agent_pay` to a listed merchant (contacts map to listed merchants) |
| `request_approval` | `url` or `to`, `amount`, `reason` | Creates a Pending account and returns its address and the dashboard link `/app/approvals/<pending>` |
| `check_approval` | `pending` | Status; if approved, the model may retry with it |

### 7.2 `pay_x402` flow

1. `GET url`. If not 402, return the body. Otherwise read the requirements: `amount`, `payTo`, `asset`, `extra.feePayer`.
2. Look up the merchant in the session. If unlisted, find its reputation account (via `8004-solana`, read only) to pass in.
3. Build the transaction: fee payer = `extra.feePayer`; instructions = ComputeBudget + `buildAgentPayIx(amount, reason)`. If an approved Pending exists for this merchant and amount, pass it with `use_pending = true`. Partially sign with the agent.
4. **Simulate locally.** If it fails with an Allowance error:
   - **Record the refusal:** send the same `agent_pay` instruction in a new transaction with the agent as fee payer and `skipPreflight: true`. It lands as a failed transaction with the error code, costing about 0.000005 SOL.
   - Return to the model: "Refused by the chain: over the 0.05 USDC per-request cap. Transaction: <link>. You can call request_approval."
5. If simulation passes, retry `GET url` with the x402 payment header holding the base64 transaction. The facilitator verifies, settles and returns the signature in the response header.
6. Return the body and the signature link.

Recording refusals is a convenience for the audit trail, not the enforcement: a compromised MCP server could skip it, but it still can't move money.

### 7.3 Transports

stdio for Claude Desktop (`claude_desktop_config.json` → `node apps/mcp/dist/index.js`), and optionally Streamable HTTP. On start, print the agent public key so the owner can paste it into `/app/sessions/new`.

**Checkpoint, Sat 19:30:** in Claude Desktop, "Summarize solana.com using the paid summary API" returns a summary and a devnet link, and asking for the premium report returns the on-chain refusal with its own link.

## 8. Phase 5: multipage website (Sat 20:30 to Sun 02:00, Sun 08:30 to 11:30)

Next.js App Router, TypeScript, Tailwind, Solana wallet adapter (Phantom, devnet), TanStack Query, `packages/client`. No backend and no database: every page reads from devnet RPC. Reuse the Wayfind look from the `ui/` prototype (`ui/tokens.css`, `ui/app.css`).

### 8.1 Site map

```text
/                                Landing (public)
/how-it-works                    The rules, architecture, program ID (public)
/app                             Overview (needs wallet)
/app/vault                       Deposit, withdraw, freeze
/app/sessions                    All sessions of this vault
/app/sessions/new                Create session form
/app/sessions/[agent]            One session: meters, merchants, revoke, its activity
/app/activity                    Full feed, filters in the URL
/app/activity/[signature]        One transaction, decoded
/app/approvals                   Open and past over-cap requests
/app/approvals/[pending]         One request: approve or reject
/app/merchants                   Listed merchants across sessions
/app/merchants/[address]         Reputation, caps, payments to this merchant
```

### 8.2 Shared layout

- **`app/layout.tsx`:** fonts, the wallet adapter provider, the Query provider, and `<ProgramProvider>` (connection, program, the owner's vault PDA).
- **`app/(public)/layout.tsx`:** a top bar with the wordmark, How it works, a Launch app button, and a footer with the program ID link.
- **`app/app/layout.tsx`:** the top bar (wordmark, Devnet tag, wallet button) plus a tab row: Overview, Vault, Sessions, Activity, Approvals (with an open count), Merchants. It also has:
  - **Wallet gate:** if no wallet is connected, show "Connect Phantom to manage your vault" with the button. If the wallet has no vault, show "Create your vault" (`init_vault`) and nothing else.
  - **Frozen banner:** if `vault.frozen`, a full-width bar on every `/app` page: "All sessions are frozen. Every payment fails on-chain." with an Unfreeze button.
- **`<LiveProvider>`:** one `connection.onLogs(PROGRAM_ID)` subscription. On each new signature that touches this vault, it invalidates the `['vault']`, `['sessions']`, `['history']` and `['pending']` queries and shows a short toast ("Paid 0.01 to Merchant A" or "Refused: OverRequestCap").

### 8.3 Pages

Every page that loads data has four states: loading (a skeleton the shape of the content), empty (what goes here, plus the one action that fills it), error (what failed, plus Retry) and full.

| Page | Shows | Actions (signer) | Data |
| --- | --- | --- | --- |
| `/` | Headline, one sentence, Launch app; three-step "how a payment is checked"; the four refusal types with their error names; a link to the demo video | Launch app | Static |
| `/how-it-works` | Each rule as a row (name, check, error code); architecture diagram; signer table; the known trade (only facilitators that accept `agent_pay`); program ID with explorer link | None | Static plus the program ID |
| `/app` | Vault balance plate; frozen state; active session count; spent today across sessions; open approvals; last 10 transactions | Quick links to each page | `vault`, `vault_ata`, `program.account.session.all([vault filter])`, history |
| `/app/vault` | Balance, deposited and withdrawn totals (from history), the freeze state | Deposit, Withdraw (Owner). Freeze all and Unfreeze (Owner), with an inline confirm | `vault`, owner and vault ATAs |
| `/app/sessions` | A table: agent (short), status (active, expired, revoked), spent today / daily cap, expires, total paid | New session; row → detail | `session.all` filtered by vault |
| `/app/sessions/new` | Form: agent key, per-request cap, daily cap, other-merchant cap, min reputation, expiry; up to 5 merchant rows (address, label, daily cap), each showing its reputation as you type the address | Create (Owner): `create_session` + a 0.02 SOL transfer to the agent in one transaction | Reputation lookup for each merchant address |
| `/app/sessions/[agent]` | Meters (daily, each merchant, others); caps; expiry countdown; this session's activity | Revoke (Owner, with confirm); Close once revoked or expired | `session`, `fetchSessionHistory` |
| `/app/activity` | A table: time, session, merchant, route or reason, amount, result (Paid, or Refused with the error name); refused rows marked | Filters in the URL: `?status=refused&session=…&merchant=…`; Load more (cursor in `?before=`) | `fetchSessionHistory` for each session, merged by slot |
| `/app/activity/[signature]` | The decoded `agent_pay`: amount, merchant, reason, signer, fee payer (facilitator or agent); for a refusal, the rule and its plain sentence; the program log lines; explorer link | Copy signature | `getTransaction` + `parseAllowanceTx` |
| `/app/approvals` | Tabs: Open, Resolved (in the URL); each request with amount, merchant, reason, age, and how far over the cap it is | Row → detail | `pending.all` filtered by session |
| `/app/approvals/[pending]` | The request; the session's caps and today's spend; whether approving would still pass the daily cap | Approve, Reject (Owner) | `pending`, `session` |
| `/app/merchants` | Every listed merchant across sessions: label, address, daily cap, spent today, reputation | Row → detail | Sessions + reputation reads |
| `/app/merchants/[address]` | Reputation score and feedback count (from the registry); which sessions list it; payments to it | Copy address | Registry account + history filtered by merchant |

### 8.4 Components

`WalletButton`, `NetworkTag`, `FrozenBanner`, `BalancePlate`, `Meter`, `SessionTable`, `ActivityTable` (one component for the overview, a session and the full feed), `ResultCell` (Paid / Refused + rule), `TxLink`, `AmountInput` (6 decimals, rejects more), `ConfirmInline` (for freeze, revoke and reject), `TxButton` (signs, shows pending → confirmed → error, then invalidates queries), `EmptyState`, `ErrorState`, `Skeleton`.

### 8.5 Signing pattern

`TxButton` handles every owner action:
1. Build instructions with `packages/client`.
2. `sendTransaction` through the wallet adapter.
3. Show "Waiting for Phantom", then "Confirming", then a toast with the explorer link.
4. On error, map Anchor error codes through `ERRORS` and show the sentence.

Never use optimistic updates: wait for `confirmed`, then refetch.

### 8.6 Build order inside the phase

1. **Sat 20:30 to 22:00:** the `/app` layout, wallet gate, `init_vault`, and `/app/vault` (deposit, withdraw, freeze).
2. **Sat 22:00 to Sun 00:00:** `/app/sessions/new`, `/app/sessions`, `/app/sessions/[agent]`.
3. **Sun 00:00 to 02:00:** `/app/activity` with live updates, and `/app` overview.
4. **Sun 08:30 to 10:00:** `/app/activity/[signature]`, `/app/approvals` and its detail page.
5. **Sun 10:00 to 11:30:** `/app/merchants` and its detail page, `/`, `/how-it-works`.

**Cut order if behind:** merchants pages, then the transaction detail page (link to the explorer instead), then `/how-it-works` (fold it into `/`). Never cut: vault, session create and detail, activity, approvals.

**Done when:** in the browser you can create a vault and a session, watch Claude's payments and refusals appear within about a second, approve an over-cap request and see it paid, and freeze everything, with every action reachable at its own URL.

## 9. Phase 6: deploy and submit (Sun 11:30 to 21:15)

- [ ] **11:30 to 12:30:** run `scripts/demo.ts` end to end twice on devnet with fresh wallets; check every refusal is in the explorer.
- [ ] **12:30 to 15:00:** deploy `apps/web` to Vercel (env: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_MINT`). Host `apps/facilitator` and `apps/paid-api` on Render or Railway; the facilitator key holds about 1 devnet SOL. README covers the pitch, architecture, rules table, the two gate outcomes, program ID, how to run the MCP server, and the facilitator trade.
- [ ] **15:00 to 17:30:** record the video (§ 10).
- [ ] **17:30 to 19:00:** Devpost initial submission (Overall and AI tracks), before 19:30 IST.
- [ ] **19:00 to 21:00:** fixes and polish, then the final submission before 21:15 IST.

## 10. Demo script (2 to 3 minutes)

1. **Problem (15 s):** agents pay for APIs over x402, but no company will give a model an open wallet.
2. **Set up (30 s):** `/app/vault`: deposit 20. `/app/sessions/new`: 0.05 per request, 2 a day, merchant A at 1 a day, others at 0.5, min reputation 70, 24 hours.
3. **Paid call:** ask Claude for a summary. It pays 0.01; the row appears in `/app/activity` with the reason; open `/app/activity/[signature]`, then the explorer.
4. **Too expensive:** the premium report at 0.50 is refused with `OverRequestCap`. The failed transaction is in the explorer with the error.
5. **Approval:** Claude calls `request_approval`. Approve it at `/app/approvals/[pending]`; Claude retries and the payment goes through on the voucher.
6. **Untrusted:** `/sketchy-data` is refused with `LowReputation` (or `NotListed`), on-chain.
7. **Kill switch:** Freeze all in `/app/vault`; the banner appears on every page; Claude's next call fails with `Frozen`.
8. **Close (15 s):** "Every payment and every refusal is a Solana transaction. Even if the AI or our servers were compromised, the chain enforces the rules." Show the program ID.

## 11. Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Registry layout can't be read on-chain (Gate R) | R-listed: unlisted merchants refused with `NotListed`; the owner checks reputation on `/app/merchants/[address]` before listing |
| The x402 middleware won't talk to a custom facilitator | Write the 402 middleware by hand in `paid-api` (about 80 lines: return the requirements, read the header, call the local verify and settle) |
| Recorded refusals cost the agent SOL | 0.02 SOL covers about 4,000 refusals; the dashboard shows the agent's SOL balance on the session page |
| PDA-signed `transfer_checked` fails | Get it working first, before any rule |
| Devnet USDC faucet down | Your own 6-decimal test mint, clearly labelled |
| RPC rate limits on the history pages | Helius devnet key; cap history at 50 per page; cache with TanStack Query |
| Behind at the Sat 19:30 checkpoint | Cut the web to vault, session create and detail, and activity; demo the rest from Claude and the explorer |
| MCP client misbehaves live | `scripts/demo.ts` makes the same calls; pre-record the video |

## 12. Docs to update after this

- **02:** the "One design change for x402" paragraph describes the pocket. Replace it with § 0 and § 6.2.
- **04:** swap `refill_pocket` for `agent_pay`; add the reputation account, reason string, Pending voucher and `close_session`.
- **05:** move reputation into the program must-haves; replace the dashboard item with the § 8.1 page list.
- **07:** use the times in this plan.
- **08:** replace it with § 10.
- **09:** add the rows from § 11.
- **11:** add `apps/facilitator`.
- **README:** link this file.
