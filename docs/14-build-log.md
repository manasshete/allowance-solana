# Build log

What has been built, how it was checked, and what was learned along the way. Newest at the bottom.

## 2026-11-06

### 1. Decision gates (plan § 2)

Both were checked against the real packages before writing code.

**Gate R: reputation can be read on-chain.** In `8004-solana` 0.8.5:
- The registry's `AgentAccount` (devnet program `8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C`, PDA `["agent", asset]`) stores `agent_wallet: Option<Pubkey>`.
- The ATOM engine's `AtomStats` (devnet program `AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF`, PDA `["atom_stats", asset]`) stores `ema_score_slow` (0 to 10000). The SDK's `getAverageScore()` is that value divided by 100.
- `programs/allowance/src/reputation.rs` reads both accounts by byte offset and checks:
  - each account's owner program and 8-byte discriminator,
  - that the agent account's wallet is `Some(merchant)`,
  - that both accounts name the same asset.

**Gate F: no custom verifier needed.** The `ExactSvmScheme` facilitator in `@x402/svm` 2.30.0 has a smart-wallet mode (`enableSmartWalletVerification`, `smartWalletAllowedPrograms`).
- A transaction whose third instruction isn't a plain transfer fails the static check with a "recoverable layout" reason, so it falls through to that mode.
- That mode then:
  - requires the fee payer to appear in no instruction,
  - checks the compute-budget limits,
  - simulates the transaction,
  - requires exactly one inner `transferChecked` of the price to `payTo`'s associated token account.

So the facilitator is configuration, not custom code.

### 2. Anchor program

`programs/allowance/` has 12 instructions, events for every state change, and one error per rule. Changes from the plan:
- `agent_pay` takes no `use_pending` flag: passing a `pending` account is the flag.
- `merchant_ata` must be the merchant's associated token account. That's where x402 facilitators expect the money, and it stops redirects.
- The `Vault` and `Pending` accounts lead with `vault: Pubkey`, so the web app can list a vault's sessions and approvals with one `memcmp` filter.
- `MerchantCap` has a `label` (up to 24 bytes) for the dashboard.
- `create_session` sets `day_start = now` (the gap flagged in review).
- `request_approval`: the agent pays the rent for the `Pending` account.

**Program ID:** `83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL`. `anchor keys sync` only updated `[programs.devnet]`, so `[programs.localnet]` was set by hand.

### 3. Building without a local toolchain

Rust, the Solana CLI and Anchor aren't on Windows, and the WSL Ubuntu install needs a sudo password. The build runs in the official image `solanafoundation/anchor:v0.32.1`:
- Anchor 0.32.1, Solana CLI 2.3.0, Cargo 1.90, Node 20.
- The user allowed `PowerShell(docker *)` in `.claude/settings.local.json`.

**Problems hit:**
- **Old compiler.** `cargo-build-sbf` ships **Cargo 1.84**, which can't parse crates using the 2024 edition. `blake3` 1.8.7 pulled in `digest` 0.11, `cmov` and friends. `scripts/docker/build.sh` pins `blake3` 1.8.2, `indexmap` 2.11.4 and `zeroize` 1.8.1. Setting `rust-version = "1.84"` and the MSRV-aware resolver wasn't enough, because `cmov` declares no `rust-version`.
- **Slow builds.** Compiling on the Windows drive through Docker is slow, so `target/`, the cargo registry and Linux `node_modules` live in Docker volumes. Build output is copied back to `target/`.
- **PowerShell quoting.** It mangles nested quotes in `bash -lc '...'`, so the container commands live in `scripts/docker/*.sh`.

The first full build took 3.5 minutes and produced a 397 KB `allowance.so`. The only warning is the harmless ambiguous `handler` glob re-export.

### 4. Program tests (27 pass)

`tests/allowance.test.ts` runs in LiteSVM. Each refusal is asserted by the error name in the logs, so a failure says which rule fired.

**Covered:**
- a normal payment with its event,
- every refusal: each cap, the reason checks, zero amount, wrong signer, frozen, revoked, expired, a session created already expired, not-owner,
- money redirected to someone else's token account,
- reputation: pass, too low, accounts missing, another merchant's accounts, accounts not owned by the registry,
- `NotListed` when the cap for unlisted merchants is 0,
- the 24-hour reset (the clock is moved forward), and `withdraw` while frozen,
- revoke then close (and `SessionStillActive` before revoke),
- approvals: open isn't a voucher, only the owner approves, it pays once, amount and merchant must match, a rejected request can't be approved.

**Problems hit:**
- **LiteSVM 0.8** (web3.js API) crashed the process with `std::bad_alloc` whenever the program created accounts through a CPI. **LiteSVM 1.6.2** works but speaks `@solana/kit`, so `tests/svm.ts` adapts it: a signed web3.js transaction serializes to the same bytes kit decodes.
- **Account names.** Anchor's TS coder uses camelCase account names: `decode("session", …)`, not `"Session"`.

### 5. `packages/client`

- **`.` (browser-safe):**
  - constants and PDA helpers,
  - instruction builders for every instruction, typed with the generated IDL (`Program<Allowance>`),
  - the error-to-sentence map and USDC parse/format,
  - `fetchHistory` / `parseAllowanceTx`, which turn transactions back into feed rows. Failed transactions still decode their amount and reason from the instruction data, and the rule from the logs.
- **`./env` (Node):** `.env` loading and keypair files.
- **`./agent` (Node):** `payX402` and `payDirect` (described in the README).

**Runtime problems found by actually running it (type-checking passed):**
- **`BN`:** under Node ESM, `@coral-xyz/anchor` doesn't expose `BN` as a named export, so `BN` comes from `bn.js`.
- **`uuid`:** `@solana/web3.js` → `rpc-websockets` resolved an ESM-only `uuid` that Node 20 can't `require()`. The root `package.json` overrides it to `uuid` 11.1.0.

### 6. Apps

- **`apps/facilitator`:** `x402Facilitator` + `ExactSvmScheme(signer, undefined, { enableSmartWalletVerification: true, smartWalletAllowedPrograms: [PROGRAM_ID] })` behind `GET /supported`, `POST /verify`, `POST /settle`. `/supported` advertises `smartWalletSupported: true`.
- **`apps/paid-api`:** `@x402/express` `paymentMiddleware` with prices as `{ asset: USDC_MINT, amount }`:
  - `/summary?url=` 0.01 to A, a real extractive summary that needs no API key,
  - `/premium-report` 0.50 to A,
  - `/market-data` 0.01 to B,
  - `/sketchy-data` 0.01 to C.
- **`apps/mcp`:** `@modelcontextprotocol/sdk` 1.32.2 over stdio. It has the seven tools in the README. Contacts and registry assets come from `config/merchants.json`.

### 7. End-to-end on a local validator

`scripts/docker/e2e-local.sh` does the whole flow:
1. starts `solana-test-validator` with the program loaded,
2. runs `scripts/seed.ts`: keys, a test token, merchant token accounts, the vault with 20 deposited, the demo session,
3. starts the facilitator and paid API,
4. runs `scripts/demo.ts`.

Result: **all steps PASS.**

| Step | Result | Fee paid by |
| --- | --- | --- |
| `/summary` 0.01 | paid, settled through the facilitator | facilitator |
| `/premium-report` 0.50 | refused `OverRequestCap`, recorded on-chain | agent |
| request approval, owner approves, retry | paid 0.50, voucher `used` | facilitator |
| `/sketchy-data` (C has no registry entry configured) | refused `ReputationAccountMissing` | agent |
| freeze, then `/summary` | refused `Frozen`; then unfreeze | agent |
| history | every row read back from the chain with its reason and rule | |

### 8. Devnet

- **Funding:** the deployer `AytDxidJai3MWV5bR8CPe3cYpBce4DMVP2XVs6sWTkbZ` was funded with 5 SOL. Its RPC airdrops were rate-limited, and devnet's RPC faucet now answers "closed", so this was done through faucet.solana.com in Chrome, with the user's GitHub already connected to the faucet.
- **Deploy:** `solana program deploy` put the program at `83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL`. It is upgradeable, the data is 396,824 bytes, the rent was about 2.02 SOL, and the authority is the deployer. The program keypair is backed up to `keys/allowance-program.json`.
- **The demo on devnet** (`scripts/docker/e2e-devnet.sh`):
  - The deployer funds the owner (0.8), facilitator (0.3) and agent (0.15 SOL).
  - `seed.ts` creates a 6-decimal test token `7XhdZfnuTzRjC8eUQF2CE4bEcCyDgjgxoNLjHC1YN5yL`. It is remembered in `keys/demo-mint.env`.
  - It also creates the vault `6X7M2HpPdSkaA8NFCG8ngfcqXTrHgQh5WqiwJ74nAJsM` (20 deposited) and the session `8YFoRXpBvLBKdF245XDFZQ3vxPyL7nBadA9z6EN2HcL5`.
- **Result:** the second run passed all five steps on devnet:
  - paid through the facilitator,
  - `OverRequestCap` recorded,
  - paid with an approval,
  - `ReputationAccountMissing`,
  - `Frozen`.

  The third run correctly refused step 3 with `OverMerchantCap`, because Merchant A had reached its 1.00 daily cap across the runs.
- **Fixes this needed:**
  - Relative paths in `.env` (`keys/…`, `config/…`, `.env` itself) now resolve against the repo root (`fromRoot` in `env.ts`). The facilitator started from its own folder couldn't find its key.
  - `seed.ts` no longer tries RPC airdrops off localhost.
  - `payX402` takes `useApprovedRequest: false`, so the demo's step 2 shows the refusal even if an approved request is left over.
  - `fetchHistory` fetches transactions three at a time instead of one JSON-RPC batch, because the public devnet RPC rejects batches. It still gets 429s and retries, so a Helius key is recommended.

### 9. Dashboard (`apps/web`)

**Stack:**
- Next.js 16.4.5 (Turbopack), React 19.3, `@solana/wallet-adapter-react` 0.15.40 with Phantom through the Wallet Standard, TanStack Query 5.
- `@solana/web3.js` was bumped to 1.99.0 everywhere, because the wallet adapter needs `^1.99.0`.

**Design:**
- The Wayfind look from the `ui/` prototype: Chivo Mono through `next/font`, and the tokens in `globals.css`.
- The activity "board" is the signature element: refusals are filled amber and show the rule.

**Structure:**
- `lib/hooks.ts`: vault, sessions, pendings, activity, live updates.
- `lib/tx.ts`: `useSend` builds the instructions, asks Phantom to sign, waits for `confirmed`, toasts with an explorer link, refreshes. Errors become sentences through `ERROR_SENTENCES`.
- `components/AppShell.tsx`: wallet gate, create-vault gate, tab row with the open-approvals count, frozen banner, read-only banner.

**Pages:** all 13 routes from the plan § 8.1. `next build` passed on the first compile.

**Checked in a browser (headless Edge):**
- The landing page, how-it-works and the connect gate render correctly.
- Read-only view of the devnet demo vault: Overview showed the live balance (19.48), the stats and the full board of demo payments and refusals. The session detail page showed the meters (0.52 / 2.00, Merchant A 0.52 / 1.00), the facts and the agent's SOL.

**Problems found:**
- **Rate limits.** After today's demo runs, the public devnet RPC answered history reads with 429. The error state rendered as designed. History now loads one transaction at a time with three backed-off retries, and page sizes are smaller (25 on Activity, 50 on Merchants). Use a Helius URL for anything real.
- **Actions in view mode.** The read-only view showed owner actions (Revoke). They are now hidden whenever no wallet is connected.

**Not yet checked:** signing with Phantom in the browser (create vault, deposit, session, approve, freeze). It needs the user's wallet with devnet SOL and the demo token.

### 10. Not done yet

- **The vault owner.** `.env` has `OWNER=EibuVg8LKVrgXqZBQeDeCLXNXvViUkyaKKcQAsbzFJLG` (the user's Phantom wallet). The CLI demo uses its own owner keypair (`keys/owner.json`); the user's vault is created from the dashboard.
- **Registry entries on devnet** for merchants B and C (`8004-solana`), so the demo shows a reputation pass and `LowReputation` rather than `ReputationAccountMissing`.
- **Docs 02, 04, 05, 07, 08, 09 and 11** still describe the pocket design (plan § 12).
