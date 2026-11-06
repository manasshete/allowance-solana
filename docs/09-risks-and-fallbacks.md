# Risks and fallbacks

## Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Toolchain or Anchor version errors on Friday | Have everything installed and a test deploy done before Friday |
| PDA-signed token transfer fails | Get `transfer_checked` with PDA signer seeds working first, before any rule logic |
| Devnet USDC faucet is down or rate-limited | Mint your own 6-decimal test stablecoin and label it clearly |
| Public devnet RPC rate limits or airdrops fail | Use a free RPC key; top up SOL from the web faucet in advance |
| Running behind at the Saturday 19:30 checkpoint | Cut the dashboard to setup plus a feed; demo the rules from Claude and the explorer |
| MCP client misbehaves live | Pre-record the demo and keep a CLI script that makes the same calls |
| Jupiter has no devnet liquidity | Leave swaps out, or show a mainnet quote only |

See [10-implementation-plan.md](10-implementation-plan.md) for the step-by-step build guide.
