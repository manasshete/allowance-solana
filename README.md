# Allowance

An on-chain spending firewall for AI agents paying over x402 on Solana. The owner funds a vault and gives an agent key a session with caps. **The only way money leaves the vault for a merchant is the `agent_pay` instruction**, which checks every rule before paying. Every payment and every refusal is a Solana transaction.

Rebuilt from the Stellar project [Pay3](https://github.com/manasshete/PAYThreeWallet). Planning docs are in [`docs/`](docs/README.md); the current plan is [`docs/13-onchain-implementation-plan.md`](docs/13-onchain-implementation-plan.md), and what has been built so far is in [`docs/14-build-log.md`](docs/14-build-log.md).

## Status (2026-11-06)

| Part | State |
| --- | --- |
| Anchor program `programs/allowance` | Built; 27 LiteSVM tests pass |
| `packages/client` (PDAs, instruction builders, errors, history, x402 agent) | Done, type-checked |
| `apps/facilitator` (x402 facilitator) | Done; verified and settled real payments on a local validator |
| `apps/paid-api` (demo x402 API) | Done; returns correct 402 terms and serves paid content |
| `apps/mcp` (MCP server for Claude) | Done, type-checked; uses the same payment code the end-to-end demo exercises |
| `scripts/seed.ts`, `scripts/demo.ts` | Done; the full demo passes on a local validator and on devnet |
| Devnet deploy | **Live** at `83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL`; upgrade authority is the deployer `AytDxidJai3MWV5bR8CPe3cYpBce4DMVP2XVs6sWTkbZ` |
| `apps/web` multipage dashboard | Done: 13 routes, production build passes; verified against the devnet demo vault (read-only view) |

## Program

- **Program ID:** `83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL`, [deployed on devnet](https://explorer.solana.com/address/83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL?cluster=devnet). The program keypair is backed up in `keys/allowance-program.json` (gitignored).
- **Owner instructions:**
  - `init_vault`
  - `deposit`, `withdraw` (`withdraw` works while frozen)
  - `freeze_all`, `unfreeze`
  - `create_session`, `revoke_session`, `close_session`
  - `approve_pending`, `reject_pending`
- **Agent instructions:** `agent_pay(amount, reason)`, `request_approval(amount, reason)`

**Rules `agent_pay` checks, in order (each refusal names its rule):**

1. Vault not frozen (`Frozen`), session not revoked (`Revoked`), session not expired (`Expired`)
2. Amount above zero (`ZeroAmount`); a reason of 1 to 200 bytes (`ReasonMissing`, `ReasonTooLong`)
3. Per-request cap (`OverRequestCap`), unless an approved over-cap request for this exact merchant and amount is passed; it is then marked used
4. Daily cap, reset every 24 hours (`OverDailyCap`)
5. A listed merchant's own daily cap (`OverMerchantCap`). For an unlisted merchant:
   - unlisted merchants must be allowed at all (`NotListed`),
   - the 8004 Agent Registry accounts must be passed (`ReputationAccountMissing`),
   - they must be the registry's and this merchant's (`BadReputationAccount`),
   - the score must meet the minimum (`LowReputation`),
   - the shared cap for unlisted merchants must not be passed (`OverOtherCap`).
6. Transfer from the vault's token account to **the merchant's associated token account** (`ConstraintAssociated` if anything else is passed)

## How a paid API call works

```text
Claude ──MCP──► apps/mcp ──GET──► apps/paid-api ──402 + PAYMENT-REQUIRED (price, token, payTo, feePayer)
                   │
                   ├─ builds v0 tx: compute budget + agent_pay(price, reason) to payTo; fee payer = facilitator
                   ├─ simulates it ── refused? send the same instruction with the agent paying the fee
                   │                  (lands on-chain as a failed tx with the rule) and tell Claude which rule
                   └─ GET again with PAYMENT-SIGNATURE ──► paid-api ──► apps/facilitator
                                                            /verify: stock ExactSvmScheme, smart-wallet mode:
                                                            fee payer in no instruction, compute limits,
                                                            simulate, exactly one inner transferChecked of
                                                            the price to payTo's ATA
                                                            /settle: co-sign as fee payer, submit
```

## Build and test (Windows, through Docker)

Rust, the Solana CLI and Anchor are not installed locally; the official image `solanafoundation/anchor:v0.32.1` is used instead.

```powershell
.\scripts\anchor.ps1 build   # anchor build; copies target/deploy, idl, types back to the repo
.\scripts\anchor.ps1 test    # syncs the IDL into packages/client, npm install, 27 LiteSVM tests
.\scripts\anchor.ps1 shell   # shell in the container at the repo root
```

The full demo on a local validator, plus checks:

```powershell
$p = (Get-Location).Path
docker run --rm -v "${p}:/work" -v allowance-node-modules:/work/node_modules -w /work solanafoundation/anchor:v0.32.1 bash scripts/docker/e2e-local.sh
docker run --rm -v "${p}:/work" -v allowance-node-modules:/work/node_modules -w /work solanafoundation/anchor:v0.32.1 bash scripts/docker/typecheck.sh
docker run --rm -v "${p}:/work" -v allowance-node-modules:/work/node_modules -w /work solanafoundation/anchor:v0.32.1 bash scripts/docker/smoke-x402.sh
```

## Running on devnet

The whole demo on devnet in one command:

```powershell
docker run --rm -v "${p}:/work" -v allowance-node-modules:/work/node_modules -w /work solanafoundation/anchor:v0.32.1 bash scripts/docker/e2e-devnet.sh
```

This funds the demo wallets from the deployer, then seeds (once), and runs the facilitator, paid API and demo. Merchant A has a 1.00 daily cap, so more than one full run per day ends in a correct `OverMerchantCap` refusal at step 3. The public devnet RPC rate-limits history reads, so set `RPC_URL` to a Helius devnet URL for regular use.

To redeploy after a program change, run this in `.\scripts\anchor.ps1 shell`:

```bash
solana program deploy target/deploy/allowance.so --program-id keys/allowance-program.json --keypair keys/deployer.json --url devnet
```

Manual steps:

1. The program is already deployed (see above).
2. `cp .env.example .env`, then set `RPC_URL` to devnet (a Helius key helps).
3. `RPC_URL=https://api.devnet.solana.com npx tsx scripts/seed.ts`. This writes `.env.seed`; merge it into `.env`. Fund any key whose airdrop failed by hand.
4. Run each in its own terminal:
   - `npm run start -w @allowance/facilitator`
   - `npm run start -w @allowance/paid-api`
   - `npx tsx scripts/demo.ts`
5. Claude Desktop: add to `claude_desktop_config.json`:
   ```json
   "allowance": { "command": "npx", "args": ["tsx", "apps/mcp/src/index.ts"], "cwd": "<repo path>" }
   ```

**MCP tools:**
- `get_allowance`
- `pay_x402(url, reason)`
- `transfer(to, amount, reason)`
- `request_approval(to, amount, reason)`
- `check_approval(pending)`
- `check_merchant(address)`
- `get_history(limit)`

## Dashboard (`apps/web`)

A Next.js 16 App Router site. Phantom connects through the Wallet Standard, data comes through TanStack Query, and there is no backend. Every page reads devnet directly, and one `onLogs` subscription refreshes everything when the program logs.

| Route | What it shows |
| --- | --- |
| `/` | What Allowance does, how a payment is checked, the four refusals |
| `/how-it-works` | Every rule and its error, the paid-call flow, who signs what, known limits |
| `/app` | Vault balance, active sessions, spent today, open approvals, the last 10 transactions |
| `/app/vault` | Deposit, withdraw, freeze all / unfreeze (confirmed inline), account addresses |
| `/app/sessions`, `/app/sessions/new`, `/app/sessions/[agent]` | Session list; create form (caps, up to 5 merchants, optional 0.05 SOL to the agent); meters, facts, revoke or close, this session's activity |
| `/app/activity`, `/app/activity/[signature]` | The board with filters in the URL (`?status=refused&merchant=…`, `&limit=`); one decoded transaction with its rule, reason, fee payer and program logs |
| `/app/approvals`, `/app/approvals/[pending]` | Open and resolved over-cap requests; approve once or reject, with a warning if it would still pass the daily cap |
| `/app/merchants`, `/app/merchants/[address]` | Listed and paid merchants; caps per session, payments, and an Agent Registry reputation lookup |

- Every data page has loading, empty, error and full states.
- A frozen vault puts a banner on every `/app` page.
- **Read-only view:** `/app?view=<owner address>` shows any vault without a wallet, and the address persists while you navigate. The landing gate links to the devnet demo vault, so judges can look around without Phantom. Owner actions are hidden in this mode.

```powershell
cp apps/web/.env.example apps/web/.env.local   # NEXT_PUBLIC_RPC_URL (a Helius devnet URL avoids 429s), NEXT_PUBLIC_MINT
npm run dev -w @allowance/web                  # or build in Docker: bash scripts/docker/web-build.sh
```

The public devnet RPC rate-limits `getTransaction` hard. The dashboard fetches history one transaction at a time with retries, but a Helius (or other) devnet RPC URL is recommended.

## Layout

```text
programs/allowance/   Anchor program (state, errors, events, reputation reader, one file per instruction)
tests/                LiteSVM tests + web3.js adapter for LiteSVM 1.x
packages/client/      shared TS: PDAs, instruction builders, error map, history parser
                      ./env (Node config), ./agent (x402 payment flow)
apps/facilitator/     x402 facilitator (stock @x402/svm, smart-wallet mode, Allowance allowlisted)
apps/paid-api/        demo x402 API: /summary, /premium-report, /market-data, /sketchy-data
apps/mcp/             MCP server for Claude Desktop / Cursor
scripts/              seed.ts, demo.ts, anchor.ps1, docker/*.sh, setup-wsl.sh
ui/                   static HTML/CSS prototype of the dashboard (Wayfind theme)
docs/                 plan, research, build log
```

## Known limits

- **x402 facilitators.** A payment is a program call, not a plain token transfer. So only facilitators that run `@x402/svm`'s smart-wallet verification with the Allowance program allowlisted can settle it. Ours does; stock public ones don't yet.
- **Refusal records are an audit trail, not the enforcement.** A compromised MCP server could skip recording a refusal, but it still can't move money outside the rules.
- **Reasons are public.** They are stored in instruction data and events, so the agent must never put secrets in a reason.
