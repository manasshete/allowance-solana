# Program design

## Program design

One Anchor program, three account types and seven instructions. Every rule lives in `agent_pay`; that is the instruction to test hardest.

Architecture: the owner (Phantom) and the agent (MCP server key) each sign their own instructions into one Anchor program; only the program can move USDC out of the vault.

The owner and the agent each sign their own instructions; only the program can move USDC out of the vault.

**Accounts (all PDAs)**

| Account | Seeds | Fields |
| --- | --- | --- |
| Vault | `"vault"`, owner | owner, usdc mint, bump; owns a USDC token account (the jar) |
| Session | `"session"`, vault, agent pubkey | agent, per-payment cap, daily cap, spent today, day start, expires at, revoked, allowlist (up to 5 addresses) |
| Pending | `"pending"`, session, nonce | recipient, amount, memo, created at, status |

**Instructions**

| Instruction | Signer | What it does |
| --- | --- | --- |
| `init_vault` | Owner | Creates the vault and its USDC token account |
| `deposit` / `withdraw` | Owner | Moves USDC between the owner's wallet and the jar |
| `create_session` | Owner | Registers an agent key with caps, expiry and allowlist |
| `revoke_session` | Owner | Sets revoked; the agent can no longer spend |
| `agent_pay` | Agent | Checks the rules, then transfers USDC from the jar to the recipient and emits a `PaymentMade` event |
| `request_approval` | Agent | For a payment over the cap: creates a Pending account instead of paying |
| `approve_pending` | Owner | Executes a pending payment |

**Added for the x402 firewall**

| Instruction or field | Signer | What it does |
| --- | --- | --- |
| `refill_pocket` | Agent | Tops up the agent's own small USDC pocket from the vault, never above the per-request cap, and counts it against the daily cap; records the merchant and a memo hash of the agent's reason |
| `freeze_all` / `unfreeze` | Owner | Kill switch: a `frozen` flag on the vault that blocks every refill and payment for every session |
| Merchant caps on Session |  | Up to 5 merchant addresses, each with its own daily cap |
| Reputation threshold on Session |  | Minimum Agent Registry score a payee needs; `refill_pocket` takes the payee's reputation account and checks it on-chain if the registry layout allows, otherwise the MCP server checks it before refilling |

The flow for a paid API call: the MCP server sends the request, gets a 402 with the price, calls `refill_pocket` for that price, then pays the x402 request from the pocket and logs the result.

**Checks in `agent_pay`, in order:** session not revoked; current time (Clock sysvar) before expiry; recipient on the allowlist; amount at or below the per-payment cap; reset spent-today if 24 hours have passed since day start; spent-today plus amount at or below the daily cap. Each failure is its own error code, so the demo can show exactly which rule the chain enforced.

**Agent key:** the MCP server generates the agent keypair and keeps it; the key can only spend through `agent_pay`, so a leak is bounded by the caps. The owner's wallet pays the agent's fees by funding it with about 0.05 devnet SOL when the session is created.
