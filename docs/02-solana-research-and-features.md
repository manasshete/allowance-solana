# Solana research and new features

## What Solana wants from agents

Solana is betting that agents, not people, will make most on-chain transactions, paying for things in stablecoins over x402. The gap it leaves open is control: who the agent may pay, how much, and how to stop it.

- **Agents as the main users.** The Solana Foundation's chief product officer says 95 to 99% of transactions will come from LLMs, and that stablecoins will be the default way agents pay for compute ([CoinDesk, Mar 2026](https://www.coindesk.com/business/2026/03/25/solana-bets-on-ai-agents-foundation-says-network-is-becoming-core-infrastructure-for-agentic-internet)).
- **x402 is the payment rail.** HTTP 402 payments let an agent pay per request with no API key; the wallet becomes the agent's identity. Solana cites about 200M x402 transactions, most under 50 cents ([Solana webinar recap, Aug 2026](https://solana.com/news/webinar-recap-agentic-payments); [What is x402](https://solana.com/x402/what-is-x402)).
- **pay.sh is the storefront.** A Solana and Google Cloud directory of x402-payable APIs with its own MCP server, launched May 2026 ([TECHi](https://www.techi.com/solana-pay-sh-ai-agent-payments/)).
- **Agent Registry for trust.** Identity, Reputation and Validation registries on Solana PDAs. Solana's own build list includes trust-gated DeFi, agents that hire each other, and x402 content gated by reputation ([Agent Registry](https://solana.com/agent-registry/what-is-agent-registry)).
- **Agent Skills and Agent Kit.** Pre-built skills, including security checks, so agents can use Solana programs safely ([BlockEden, Apr 2026](https://blockeden.xyz/blog/2026/04/11/solana-agent-skills-framework-ai-defi-payments/)).
- **The open problems.** Commentators flag spend controls, kill switches and audit trails as missing for real companies, plus much early x402 volume being test traffic ([TECHi](https://www.techi.com/solana-pay-sh-ai-agent-payments/)). Wallet vendors are converging on session keys with caps, allowed programs and expiry ([Squads and Crossmint](https://squads.xyz/blog/crossmint-integration); [Alchemy](https://www.alchemy.com/es/overviews/agent-wallets-session-permission-model)).

That gap is exactly where Allowance sits: the spending firewall a company needs before it lets agents loose on x402.

## New features beyond Pay3

Recommendation: build features 1 to 3 as the product (an x402 spending firewall with reputation-gated payees and a kill switch). Add 4 if time allows; 5 to 7 are pitch material or future work.

| # | Feature | What it does | Why Solana cares | 48h effort |
| --- | --- | --- | --- | --- |
| 1 | x402 spending firewall | The agent pays any x402 API (for example from pay.sh) only through Allowance: a max price per request, per-merchant daily caps, and a log of what each call bought | Turns x402 from test traffic into something a company can safely switch on | Medium |
| 2 | Reputation-gated payees | Instead of a fixed allowlist, the agent may pay any service or agent whose Agent Registry reputation is above your threshold; after each paid call it leaves feedback | Uses Solana's own Agent Registry, the composability judges want | Medium, check SDK first |
| 3 | Kill switch and audit trail | One tap (dashboard or a Blink on your phone) freezes every session; each payment carries a memo with a hash of the agent's reason, shown in a live feed | The control gap named for enterprises; verifiable AI from the AI track list | Low |
| 4 | Agent-to-agent escrow | Your agent hires another agent; funds sit in escrow until the work is accepted, then release and update reputation | Matches "agents that hire each other" on Solana's build list | Medium to high |
| 5 | Team budgets on Squads | A company's Squads multisig owns the vault and gives each team's agent its own budget | Real company use; plugs into existing Solana treasury tooling | Medium |
| 6 | Plain-English approvals | Any over-cap request comes with an AI explanation of what it pays for and a risk flag before you sign | AI making on-chain activity safer, straight from the AI track brief | Low |
| 7 | Subscriptions and streaming | The agent pays a service per minute or monthly within the cap, stopping the moment you revoke | Sub-cent fees make per-minute billing possible | Medium |

**One design change for x402.** x402 facilitators expect a normal token transfer signed by the payer, which a program vault can't produce directly. So the vault never pays merchants itself: it **refills a small "pocket" token account** owned by the agent, never above the per-request cap, and only when the rules allow. The agent pays x402 from the pocket. The chain still bounds the loss to one pocket, and the dashboard shows every refill and spend.

**Check before Friday:** whether x402 and the Agent Registry work on devnet. If the registry is mainnet-only, read reputation from mainnet and keep payments on devnet.
