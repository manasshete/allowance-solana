# Demo script and submission

## Demo script and submission

The video should prove one thing: the chain, not your server, says no. Show three rejections, each with the program's error.

1. **The problem (15 seconds).** Agents now pay for APIs over x402, but no company will hand a model an open wallet.
2. **Set up (30 seconds).** In the dashboard, connect Phantom, deposit 20 USDC, and create a session: 0.05 USDC max per request, 2 USDC per day, 1 USDC per day for any one merchant, minimum reputation 70, expires in 24 hours.
3. **Paid API call.** Ask Claude a question that needs your x402 API. It hits a 402, the program refills the pocket with exactly the price, the call is paid and answered in about a second. Show the feed entry with the agent's reason and the explorer link.
4. **Too expensive.** Point the agent at an endpoint priced at 0.50 USDC. The program refuses the refill as over the per-request cap; show the error code.
5. **Untrusted service.** Point it at a service below the reputation threshold. The refill is refused.
6. **Kill switch.** Hit freeze in the dashboard (or the Blink on your phone), ask Claude again, and every session fails on-chain.
7. **Close (15 seconds).** "Allowance is the spending firewall that lets companies switch agents on for x402. Even if the AI or our server were compromised, the chain enforces the rules." Show the program ID.

**Devpost:** select Overall and the AI Track; include the repo, devnet program ID with an explorer link, the live dashboard, the video, an architecture picture, and a short "what the program enforces" list. Say in the write-up that it is a Solana rebuild of your earlier Stellar idea with policy moved on-chain.
