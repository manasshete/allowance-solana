# Scope for a solo 48 hours

## Scope for a solo 48 hours

Ship the must-haves end to end before touching any stretch goal; a working demo of the rules beats extra features.

**Must have**

- [ ] Anchor program with vault, session, `agent_pay`, `refill_pocket`, `freeze_all`, `revoke_session`, deposit and withdraw, deployed to devnet
- [ ] Tests for each rule: per-request cap, daily cap, merchant cap, expired, revoked, frozen, payee below reputation threshold
- [ ] Your own x402 demo API on devnet (one paid endpoint, for example a summary API at 0.01 USDC per call)
- [ ] MCP server with `get_balance`, `transfer`, `get_transaction_history` and `pay_x402`, working from Claude Desktop or Cursor
- [ ] Dashboard: connect Phantom, create the vault, deposit, create a session with caps, kill switch, and a live feed of payments with the agent's reason and explorer links

**Should have**

- [ ] Reputation gate using the Agent Registry (on-chain check if possible, else in the MCP server)
- [ ] Over-cap approvals: `request_approval` plus an Approve button, with a plain-English explanation of the request
- [ ] Contacts: "pay Alice" resolves to an allowed address
- [ ] Hosted frontend on Vercel

**Stretch, only if the must-haves are done by Sunday 10:30 IST**

- [ ] Pay a real endpoint from the pay.sh catalog (mainnet, a few cents)
- [ ] Kill switch as a Blink you can trigger from your phone
- [ ] Agent-to-agent escrow
