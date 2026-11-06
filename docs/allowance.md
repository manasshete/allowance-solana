# LLM prompt: rebuild Pay3 on Solana as Allowance

Paste everything below the line into another LLM (Claude, Cursor, ChatGPT). It explains how Pay3 works, then how each piece maps to Solana in the Allowance design, then the workflow for creating a session and connecting Claude through MCP, then what to build. Sources: the Pay3 docs (https://pay3.mintlify.site/how-it-works plus the concepts and MCP tools pages) and docs 03, 04, 08, 09, 10, 11 and 13 in this folder.

---

You are a senior Solana engineer (Rust, Anchor, TypeScript). Help me build **Allowance**, a Solana rebuild of my Stellar project **Pay3**. Keep Pay3's product, MCP tool surface and dashboard UX, but move custody and every spending rule into an Anchor program, so the chain, not my server, is the security boundary. Follow the design in this prompt exactly. Where something here is ambiguous, ask me instead of inventing a different design.

## Part 1: How Pay3 works today (Stellar)

Pay3 lets an AI client (Claude, Cursor, ChatGPT or any MCP client) spend a limited amount of USDC for its owner.

**Actors**
- **Owner:** connects a Stellar wallet with Freighter and signs a one-time challenge. The owner's main key never leaves the wallet.
- **Soroban smart account (the vault):** a Rust contract the owner deploys and funds with a limited amount, for example 200 of 10,000 USDC. The AI can never reach more than the vault balance. The owner can top it up or withdraw at any time, by hand.
- **Session key:** a fresh Stellar keypair per AI session, registered on the smart account. Its private key is encrypted and stored by the Pay3 backend, which decrypts it in memory to sign.
- **AI client:** gets only an MCP auth token (`PAY3_MCP_AUTH_TOKEN`), never key material.
- **Pay3 backend:** Express API with a policy engine, session manager and transaction engine, using the Stellar JS SDK, Horizon and Soroban RPC. Prisma and Postgres store sessions, contacts and the audit log.

Request path: AI → Pay3 MCP server → Pay3 API → policy engine and session manager → transaction engine → Soroban smart account → Stellar (3 to 5 second finality).

**Sessions.** In the dashboard the owner picks an AI client, a duration and a policy, reviews a summary and signs. Pay3 then calls the contract, which only the owner can call:

```rust
pub fn add_session(env: Env, session: Address, expires_at: u64, per_tx_max: i128, daily_max: i128) -> Result<(), Error>
pub fn revoke_session(env: Env, session: Address) -> Result<(), Error>
```

Lifecycle: created, registered on-chain, active, then expired or revoked. Each AI client has its own key, expiry and caps, so revoking one leaves the others alone. Presets:

| Preset | Duration | Per-tx max | Daily cap | Approval above |
| --- | --- | --- | --- | --- |
| Conservative | 24 hours | 20 USDC | 100 USDC | 15 USDC |
| Balanced | 7 days | 100 USDC | 500 USDC | 250 USDC |
| DeFi | 7 days | 250 USDC | 1,000 USDC | 500 USDC |

**Policy engine (off-chain, in the API).** Policy fields: `allowedActions`, `allowedAssets`, `allowedRecipientIds`, `perTransactionMax`, `dailyBudget`, optional `monthlyBudget`, `manualApprovalThreshold`. It is snapshotted into the session at creation. Checks run in order and stop at the first failure: action allowed (`ACTION_NOT_ALLOWED`), asset allowed (`ASSET_NOT_ALLOWED`), recipient in the allowlist if one is set (`RECIPIENT_NOT_ALLOWED`), per-transaction max (`PER_TRANSACTION_LIMIT_EXCEEDED`, a hard reject), rolling 24-hour daily budget (`DAILY_BUDGET_EXCEEDED`), monthly budget (`MONTHLY_BUDGET_EXCEEDED`), then above the approval threshold gives `PENDING_APPROVAL`, otherwise `AUTO_EXECUTE`. After the API passes, the Soroban contract re-checks expiry, revocation, `per_tx_max` and `daily_max` (`SessionExpired`, `SessionRevoked`).

**Payments.** The MCP `transfer(recipient, asset, amount, idempotency_key)` tool resolves a contact name or `G...` address, runs the policy engine, and on `AUTO_EXECUTE` the backend signs with the session key and submits. Pending approvals expire after 2 minutes. A repeated idempotency key returns the original result. Every transaction is logged with its policy decision and Stellar hash. For x402, the AI hits a paid API, gets `402 Payment Required` with the price, Pay3 checks the policy, pays on Stellar, and the AI retries with the payment proof.

**MCP tools:** `get_balance(asset)`, `transfer(recipient, asset, amount, idempotency_key)`, `get_transaction_history(limit)`.

**Kill switch:** per-session Revoke, plus "Revoke all" (`POST /api/ai-sessions/revoke-all`), which invalidates every session key. Funds stay in the vault. There is no contract-wide freeze.

**What Pay3 does not have:** no on-chain reputation, no per-merchant caps, no automatic refill (only manual top-ups), and no global on-chain freeze. Most of the policy lives in the API, so a compromised server could sign anything the contract's few checks allow.

## Part 2: How each piece maps to Allowance on Solana

| Pay3 on Stellar | Allowance on Solana |
| --- | --- |
| Policy engine in the Express API (AUTO / APPROVAL / REJECT) | Every rule checked inside the Anchor program on every payment |
| Soroban smart account / allocation jar | **Vault PDA** owned by the program; nobody holds its key |
| Session key + `add_session` | **Session PDA** tied to an agent keypair, with caps, expiry, up to 5 listed merchants and a reputation threshold, created by `create_session` |
| Backend signs each transfer with the decrypted session key | Agent calls **`refill_pocket`** to move exactly one request's price into its own small pocket, then pays x402 from the pocket |
| Recipient allowlist (`allowedRecipientIds`) | Up to 5 listed merchants on the session, each with its own daily cap. No separate allowlist |
| No reputation | Unlisted payees must pass an **on-chain reputation check** against the 8004-solana Agent Registry |
| `revoke_session`, Revoke all in the API | `revoke_session` per session, plus **`freeze_all` / `unfreeze`**, a `frozen` flag on the vault that blocks every session |
| Pending approvals in the API | Optional `request_approval` / `approve_pending` with a Pending PDA |
| `packages/stellar` (Horizon, Soroban RPC) | `packages/client` built from the Anchor IDL with `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token` |
| Freighter | Phantom via Solana wallet adapter |
| XLM / USDC SAC | Devnet USDC (SPL), or my own 6-decimal test mint as fallback |
| MCP `get_balance`, `transfer`, `get_transaction_history` | `get_allowance`, `get_history`, `pay_x402`, `check_merchant`, and `transfer` (only if `agent_pay` is built) |
| Contacts resolver | Contact names map to the session's listed merchant addresses |
| Prisma + Postgres | Dropped: state lives in program accounts |
| Soroswap | Jupiter, mainnet only, stretch goal |

### Accounts (all PDAs)

| Account | Seeds | Fields |
| --- | --- | --- |
| Vault | `"vault"`, owner | owner, mint, frozen, bump. Owns a USDC token account (the vault PDA's associated token account, "the jar") |
| Session | `"session"`, vault, agent | vault, agent, per_request_cap, daily_cap, spent_today, other_daily_cap, other_spent_today, day_start, expires_at, revoked, min_reputation (0 to 100), merchants (max 5 × {merchant, daily_cap, spent_today}), bump |
| Pending (optional) | `"pending"`, session, nonce | session, recipient, amount, reason_hash, created_at, status (Open, Approved, Rejected), bump |

The pocket is the agent's associated token account for the mint.

### Instructions

| Instruction | Signer | What it does |
| --- | --- | --- |
| `init_vault` | Owner | Creates the vault and its token account |
| `deposit` / `withdraw` | Owner | Moves USDC between the owner's wallet and the jar |
| `create_session` | Owner | Registers an agent key with caps, merchant caps, min reputation and expiry. Requires `expires_at > now`, sets `day_start = Clock::get()?.unix_timestamp` and every spent counter to 0 (if `day_start` stays 0, the first refill resets immediately) |
| `revoke_session` | Owner | Sets `revoked = true` |
| `refill_pocket(amount, merchant, reason_hash)` | Agent | The core rule check, below |
| `freeze_all` / `unfreeze` | Owner | Kill switch for every session on the vault |
| `agent_pay` (optional) | Agent | Pays a listed merchant directly from the jar, same checks, recipient must be listed (`NotListed`) |
| `request_approval` / `approve_pending` (optional) | Agent / Owner | Over-cap payment becomes a Pending account; the owner approves it in Phantom (or rejects it) |

### `refill_pocket` checks, in this exact order (one error each)

1. Vault not frozen → `Frozen`
2. Session not revoked → `Revoked`
3. Clock before `expires_at` → `Expired`
4. `amount <= per_request_cap` → `OverRequestCap`
5. If 24 hours (86,400 s) have passed since `day_start`, reset `day_start` to now and all spent counters to 0
6. `spent_today + amount <= daily_cap` → `OverDailyCap`
7. If `merchant` is listed: its `spent_today + amount <= daily_cap` → `OverMerchantCap`, then add to it.
   Otherwise: the `merchant_reputation` account must be passed, owned by the 8004-solana registry program, and bound to `merchant` (it is the PDA the registry derives for that wallet, or its stored agent-wallet field equals `merchant`) → `BadReputationAccount`; its average score must be `>= min_reputation` → `LowReputation`; and `other_spent_today + amount <= other_daily_cap` → `OverMerchantCap`, then add to it.
8. `pocket.amount + amount <= per_request_cap` → `PocketFull` (the pocket never holds more than one request's worth)
9. Add to `spent_today`, then `transfer_checked` from the jar to the pocket with vault PDA signer seeds `["vault", owner, bump]`
10. `emit!(PocketRefilled { session, merchant, amount, reason_hash, at })`

Other errors: `NotListed` (agent_pay only), `NotOwner`, `NotAgent`. Use `checked_add` everywhere.

`RefillPocket` accounts: `agent` (Signer, equals `session.agent`), `vault`, `session` (has_one = vault, seeds checked), `mint`, `vault_ata`, `pocket`, `merchant_reputation: Option<UncheckedAccount>` (only for unlisted merchants), `token_program: Interface<TokenInterface>`.

### Reputation

The program reads the 8004-solana reputation account directly (owner check, payee binding, average score 0 to 100). Confirm the registry's account layout and wallet linkage from the 8004-solana source before writing `read_reputation`. **Fallback:** if it cannot be read or tied to the payee on-chain, move the check to the MCP server (`check_merchant` before `refill_pocket`) and say so; do not fake an on-chain check.

### Agent key and fees

The MCP server generates and holds the agent keypair (env var, never sent to the model). It can only spend through `refill_pocket` (and `agent_pay`), so a leak is bounded by the caps. The owner funds the agent with about 0.05 devnet SOL at session creation for fees.

### The `pay_x402` flow (MCP server)

1. Fetch the URL without paying; if 402, parse `amount` and `payTo`.
2. If `payTo` is not a listed merchant, look up its reputation account (`reputationAccountFor(payTo)` in `packages/client`).
3. Call `refill_pocket(amount, payTo, sha256(url + "|" + reason))`. Any rule failure comes back as the program error.
4. Pay the x402 request from the pocket with `@x402/fetch` `wrapFetchWithPayment` and an `@x402/svm` client signed by the agent key, on `solana-devnet`.
5. Log `{url, reason, amount, payTo, tx}` and post `{reason, hash}` to a `/log` endpoint for the dashboard.

Return program errors to the model as plain sentences, for example "Refused by the chain: over the 0.05 USDC per-request cap".

MCP tools: `get_allowance()` (vault and pocket balance, caps, spent today, frozen), `get_history(limit)` (`PocketRefilled` events and receipts with explorer links), `pay_x402(url, reason)`, `check_merchant(address)` (read-only reputation and which cap applies), `transfer(to, amount, reason)` (only with `agent_pay`). Transports: stdio for Claude Desktop, Streamable HTTP if hosted.

### Known limits (state them honestly in the README)

- The pocket can pay any address, so merchant caps limit what is refilled, not where it lands. The loss is bounded by one pocket.
- The agent chooses the `merchant` label, so a compromised agent can label every refill as a listed merchant and skip the reputation check. Against a compromised agent only the per-request cap, pocket size, daily cap, expiry, revoke and kill switch hold.

## Part 3: Workflow: create a session and connect Claude through MCP

**In Pay3 today:** the owner connects Freighter, opens the dashboard, picks an AI client, a duration and a policy preset, and signs. Pay3 generates the session keypair server-side, encrypts it, calls `add_session` on the smart account, and shows a `PAY3_MCP_AUTH_TOKEN`. The owner pastes that token into the AI client's MCP config. The AI never sees a key; the Pay3 backend signs for it.

**In Allowance the direction flips:** the agent key is born in the MCP server on the owner's machine, and the owner registers that public key on-chain. No auth token and no server-held key exist. The session PDA is the permission.

### Step by step

1. **Start the MCP server once to get the agent key.** `apps/mcp` loads its keypair from the file named in `AGENT_KEYPAIR_PATH`. If the file doesn't exist, it generates a new keypair, saves it there, and prints the public key to stderr (stdout belongs to the MCP stdio protocol). The secret key never goes to the model or the dashboard. Other env vars: `RPC_URL` (devnet), `PROGRAM_ID`, `VAULT_OWNER` (the owner's Phantom address, used to derive the vault PDA `["vault", owner]` and then the session PDA `["session", vault, agent]`), `LOG_URL` (the dashboard's `/log` endpoint). These env var names are my suggestion; keep them consistent across the repo.
2. **Connect Phantom in the dashboard** (devnet). On first run: `init_vault`, then `deposit` 20 USDC. Each is one Phantom signature.
3. **Open `/sessions/new` and fill five fieldsets:**
   - Agent: a name, and the agent public key from step 1
   - Spending caps: per request (also the pocket limit) and per day
   - Listed merchants: label, payee address, daily cap, up to 5
   - Everyone else: minimum reputation (0 to 100) and the shared daily cap for unlisted merchants
   - Expiry: 1 hour, 24 hours, 7 days or custom
   A side panel restates the rules in plain sentences ("No single payment over 0.05 USDC"). Pay3's presets can be offered as starting values, scaled down for devnet. Demo values: 0.05 per request, 2 per day, Summary API listed at 1 per day, minimum reputation 70, 0.5 per day for unlisted merchants, 24 hours.
4. **Click Create session.** One transaction, one Phantom signature: `create_session` (sets `day_start` to now and all spent counters to 0) plus a transfer of about 0.05 devnet SOL to the agent for fees. The session card appears with status Active, the agent key, the session PDA and an expiry countdown.
5. **Connect Claude Desktop.** Add the server to `claude_desktop_config.json` and restart Claude Desktop:

   ```json
   {
     "mcpServers": {
       "allowance": {
         "command": "node",
         "args": ["/absolute/path/to/allowance/apps/mcp/dist/index.js"],
         "env": {
           "AGENT_KEYPAIR_PATH": "/absolute/path/to/agent.json",
           "RPC_URL": "https://api.devnet.solana.com",
           "PROGRAM_ID": "<program id>",
           "VAULT_OWNER": "<owner Phantom address>",
           "LOG_URL": "http://localhost:3000/api/log"
         }
       }
     }
   }
   ```

   For Cursor, put the same entry in `.cursor/mcp.json`. For a hosted server, use the Streamable HTTP transport and keep the keypair on the host.
6. **Check the connection.** On start the MCP server fetches the Session account. If none exists for this agent key, every tool returns "No session for agent {pubkey}. Create one in the dashboard." In Claude, ask "What's my allowance?" and `get_allowance` should show the vault and pocket balance, caps, spent today and frozen status.
7. **Use it.** Ask "Summarize solana.com using the paid summary API". Claude calls `pay_x402(url, reason)`, the program refills the pocket with exactly the price, the x402 call is paid and answered, and the dashboard feed shows a Paid row with the reason and an Explorer link within about a second.
8. **Stop it.** Revoke the session (only this agent stops, like Pay3's per-session Revoke) or press Freeze all (every session on the vault stops, which Pay3 can't do on-chain). The next tool call returns the program error as a sentence, for example "Refused by the chain: this session was revoked." To give the agent new limits, create a new session for the same key; as in Pay3, a session's limits are fixed at creation.

Error sentences shared by the MCP server and the dashboard feed:

| Code | Sentence |
| --- | --- |
| `Frozen` | The owner froze the vault. Every session is blocked. |
| `Revoked` | This session was revoked. |
| `Expired` | This session expired at {time}. |
| `OverRequestCap` | {amount} is over the {cap} per-request cap. |
| `OverDailyCap` | {amount} would pass the {cap} daily cap ({spent} spent). |
| `OverMerchantCap` | {amount} would pass {merchant}'s {cap} daily cap. |
| `LowReputation` | Reputation {score} is below this session's minimum of {min}. |
| `BadReputationAccount` | The reputation account doesn't belong to this payee. |
| `PocketFull` | The pocket already holds a request's worth. |

Note: `create_session` uses `init` on the session PDA, so a second session for the same vault and agent key fails while the first account exists. Either generate a new agent key per session (closest to Pay3, one key per session) or add an owner-only `close_session` that closes the old account and returns its rent. Ask me which before building it.

## Part 4: What to build

**Stack:** Rust + Anchor with `anchor-spl` token interface (`transfer_checked`); TypeScript client from the IDL; `@x402/express` server and `@x402/fetch` + `@x402/svm` client on `solana-devnet`; `8004-solana` SDK read-only on devnet; `@modelcontextprotocol/sdk`; Next.js + Solana wallet adapter (Phantom) + Tailwind. Pin Anchor and x402 versions once a test deploy works.

**Repo layout (npm workspaces):**

```text
allowance/
  programs/allowance/src/   lib.rs, state.rs, errors.rs, instructions/ (one file each)
  tests/allowance.ts        Anchor tests
  packages/client/          TS client from the IDL
  apps/paid-api/            x402 demo API (Express)
  apps/mcp/                 MCP server
  apps/web/                 Next.js dashboard
  scripts/                  seed.ts, demo.ts
```

**Build order:** state and errors → one PDA-signed `transfer_checked` working → `init_vault`, `deposit`, `create_session`, `refill_pocket`, `freeze_all`, `revoke_session`, `withdraw` → tests → paid API → reputation gate → MCP server → dashboard → optional `agent_pay` and approvals.

**Tests (6-decimal test mint; deposit 20; per-request 0.05, daily 2, one listed merchant at 1/day, other merchants 0.5/day, min reputation 70, expiry 1 hour):** refill 0.01 for the listed merchant succeeds and emits; 0.06 → `OverRequestCap`; pocket already at 0.05 → `PocketFull`; past merchant cap → `OverMerchantCap`; past daily cap → `OverDailyCap`; unlisted low-reputation merchant → `LowReputation`; missing or wrong reputation account → `BadReputationAccount`; unlisted good merchant succeeds and adds to `other_spent_today`; frozen → `Frozen` and unfreeze restores; revoked → `Revoked`; past expiry → `Expired`; wrong agent → `NotAgent`; agent calls withdraw → `NotOwner`; `create_session` stores the current time in `day_start`. Clone the registry program and merchant reputation accounts from devnet in `Anchor.toml` for the reputation tests.

**Paid demo API routes:** `GET /summary?url=` at 0.01 to listed merchant A (happy path), `GET /premium-report` at 0.50 to A (over the per-request cap), `GET /sketchy-data` at 0.01 to registered low-reputation merchant C (reputation refusal). Run an `ExactSvmFacilitator` in the same app if no public facilitator settles devnet.

**Dashboard (one page):** connect Phantom; vault card with balance gauge, deposit, withdraw and a big red Freeze all; session form (agent pubkey, caps, merchant caps, other-merchant cap, min reputation, expiry); session card with spent vs cap bars, pocket balance and Revoke; live feed of `PocketRefilled` events with merchant, amount, the agent's reason (checked against the on-chain hash), reputation and explorer link, with refused attempts in red showing the rule that fired.

Start with `state.rs`, `errors.rs` and `refill_pocket`, and show me the full Rust before moving on.
