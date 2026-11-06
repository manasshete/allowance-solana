# Prep before Friday

## Prep before Friday 21:30 IST

Do all setup now so Friday night is spent on the program, not on toolchain errors. Keep prep code in a throwaway repo.

- [ ] Check the MLH rules on pre-existing code, and ask the organizers if reusing Pay3's design is fine
- [ ] Install Rust, the Solana CLI and Anchor with the one-command Quick Install Guide from the brief; confirm `solana --version` and `anchor --version` work
- [ ] `solana config set --url devnet`, create a keypair, and fund it from the Devnet Faucet (get more than you think; deploys cost about 2 to 3 SOL)
- [ ] Get devnet USDC for two test wallets from Circle's faucet; if it fails, plan to mint your own test stablecoin
- [ ] Get a free devnet RPC key (for example Helius) so you don't hit public rate limits
- [ ] Set Phantom to devnet (testnet mode in developer settings) and create two extra wallets for "Alice" and "Bob"
- [ ] Scaffold an Anchor and Next.js app from the Solana Developer Templates, then build, deploy and call one instruction on devnet
- [ ] Read up on Anchor PDAs and the token `transfer_checked` CPI with a PDA signer; that is the trickiest code in `agent_pay`
- [ ] Confirm x402 payments and the Agent Registry work on devnet (read the x402 and registry docs, try one sample); write the MCP tool names and the demo script on paper
- [ ] Register on Devpost and block out sleep in your calendar
