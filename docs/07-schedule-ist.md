# Weekend schedule (IST)

## Weekend schedule (IST)

Claude paying for its first x402 API call on devnet by Saturday 19:30 is the checkpoint that matters; if it slips, cut the dashboard down, not the program tests. Aim to submit 30 minutes before each deadline.

| When (IST) | Block | Done when |
| --- | --- | --- |
| Fri 21:30 to 22:30 | Opening ceremony, new repo, `anchor init` | Empty program builds |
| Fri 22:30 to Sat 02:30 | Program: vault, deposit, withdraw, session, `agent_pay`, `refill_pocket`, `freeze_all` with all checks | Compiles |
| Sat 02:30 to 03:30 | Tests for every rule, deploy to devnet | Tests pass, program ID saved |
| Sat 03:30 to 09:30 | Sleep |  |
| Sat 09:30 to 12:00 | Your x402 demo API on devnet; TypeScript client from the IDL | A script pays the API from a pocket |
| Sat 12:00 to 13:30 | Reputation gate: read Agent Registry scores (on-chain if possible) | A low-reputation payee is refused |
| Sat 13:30 to 14:30 | Break |  |
| Sat 14:30 to 19:30 | MCP server: balance, transfer, history, `pay_x402`; hook up Claude Desktop | **Checkpoint: Claude pays for an API call on devnet** |
| Sat 19:30 to 20:30 | Break |  |
| Sat 20:30 to Sun 02:00 | Dashboard: Phantom connect, vault setup, session form, kill switch, live feed with reasons | Full flow works in the browser |
| Sun 02:00 to 08:30 | Sleep |  |
| Sun 08:30 to 12:30 | End-to-end bug fixes; over-cap approvals; one stretch goal only if all must-haves pass by 10:30 | Demo script runs clean twice |
| Sun 12:30 to 15:00 | Deploy frontend, README with architecture and program ID | Live link works |
| Sun 15:00 to 17:30 | Record a 2 to 3 minute demo video | Video uploaded |
| Sun 17:30 to 19:00 | Devpost write-up, **initial submission** | Submitted before 19:30 |
| Sun 19:00 to 21:00 | Final fixes and polish, **final submission** | Submitted before 21:15 |
| Sun 21:30 | Closing ceremony |  |
