# What changes from Stellar Pay3

## What changes from Stellar Pay3

The product idea, MCP tool surface and dashboard UX carry over; the custody and policy layer moves on-chain. Rewrite everything in a fresh repo during the event, using Pay3 as a design reference (see the rules check under Prep).

| Pay3 on Stellar | Allowance on Solana | Effort |
| --- | --- | --- |
| Policy engine in the Express API (AUTO / APPROVAL / REJECT) | Rules checked inside the Anchor program on every payment | New, the core of the build |
| Allocation jar = a G-account whose key the API stores encrypted | Vault PDA owned by the program; nobody holds its key | New |
| Session token for the AI | Session PDA tied to an agent keypair, with caps, expiry and allowlist | New |
| Zipper smart account (`__check_auth`) | Same idea, native to the Anchor program | Replaces it |
| `packages/stellar` (Horizon, Soroban RPC) | A small Solana client from the Anchor IDL, using `@solana/web3.js` and `@coral-xyz/anchor` | Rewrite |
| Freighter login | Phantom via Solana wallet adapter | Swap |
| XLM / USDC SAC | Devnet USDC (SPL token) | Swap |
| MCP tools: `get_balance`, `transfer`, `get_transaction_history` | Same names; `transfer` sends an `agent_pay` instruction | Port |
| Recipient resolver (contacts) | Contact names map to the allowlisted addresses | Port |
| Approvals UX | Over-cap payments become pending; the owner approves in Phantom | Port |
| Soroswap swaps | Jupiter (mainnet only, so a stretch goal) | Stretch |
| Prisma + Postgres | Mostly not needed: state lives in program accounts | Drop |
