# Repo layout and stack

## Repo layout and stack

One monorepo with npm workspaces, created fresh on Friday at 21:30 IST.

```text
allowance/
  programs/allowance/src/
    lib.rs            instruction entry points
    state.rs          Vault, Session, Pending
    errors.rs         one error per rule
    instructions/     one file per instruction
  tests/allowance.ts  Anchor tests (TypeScript)
  packages/client/    TypeScript client built from the IDL
  apps/paid-api/      your x402 demo API (Express)
  apps/mcp/           MCP server (stdio for Claude Desktop, HTTP for hosting)
  apps/web/           Next.js dashboard
  scripts/            seed.ts (mint test USD, fund wallets), demo.ts
```

| Layer | Choice |
| --- | --- |
| Program | Rust, Anchor, `anchor-spl` token interface (`transfer_checked`) |
| Client | `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token` |
| x402 | `@x402/express` (server), `@x402/fetch` with `@x402/svm` client (agent), network `solana-devnet` |
| Reputation | `8004-solana` SDK, read-only, devnet |
| MCP | `@modelcontextprotocol/sdk` |
| Web | Next.js, Solana wallet adapter (Phantom), Tailwind |
| Token | Devnet USDC, or your own 6-decimal test mint as fallback |

Pin the Anchor and x402 versions on Thursday when your test deploy works, and don't upgrade during the event.

## Sources

- [x402 repository](https://github.com/coinbase/x402): server middleware packages and examples
- [@x402/svm on Socket](https://socket.dev/npm/package/@x402/svm): Solana client and facilitator, devnet network ids, TransferChecked payment scheme
- [8004-solana SDK](https://www.pkgstats.com/pkg:8004-solana): Agent Registry devnet program IDs, `getSummary` for reputation
- [Solana Agent Registry](https://solana.com/agent-registry)
- [What is x402 on Solana](https://solana.com/x402/what-is-x402)
