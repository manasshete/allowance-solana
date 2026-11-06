# Solana ecosystem protocols

A map of the main protocols on Solana, grouped by what they do. Solana has thousands of projects, so this lists the established and widely used ones, not every one. It is written from general knowledge (up to mid 2026), so check current status, TVL and devnet support before you depend on any of them.

**★ = relevant to Allowance** (x402 agent payments, vaults, session keys, reputation).

## 1. Core protocol and runtime

| Protocol / component | What it is |
| --- | --- |
| Proof of History (PoH) | A verifiable clock (a SHA-256 hash chain) that orders transactions before consensus |
| Tower BFT | Solana's consensus: PBFT-style voting that uses PoH as its clock |
| Alpenglow (Votor + Rotor) | The newer consensus upgrade that replaces Tower BFT and Turbine and targets roughly 100 to 150 ms finality |
| Turbine | Block propagation: blocks are split into shreds and fanned out through a tree of validators |
| Gulf Stream | Transactions are forwarded to upcoming leaders, so there is no public mempool |
| Sealevel | The parallel runtime: transactions that touch different accounts run at the same time |
| SVM (Solana Virtual Machine) | The execution environment for programs (sBPF bytecode), also reused by other chains and rollups |
| Firedancer / Frankendancer | An independent validator client from Jump Crypto, alongside Agave (Anza, the Rust client) and Jito-Agave |
| Local fee markets and priority fees | Fees rise only for "hot" accounts, not across the whole chain; compute-unit price sets priority |
| Address Lookup Tables (v0 transactions) | Let one transaction reference many more accounts |
| Durable nonces | Let you sign a transaction offline that does not expire after about 1 minute |

## 2. Token standards

| Standard | What it is |
| --- | --- |
| SPL Token | The original fungible and NFT token program ★ (USDC in the vault) |
| Token-2022 (Token Extensions) | An upgraded token program with transfer hooks, transfer fees, confidential transfers, interest-bearing tokens, permanent delegate, memo-required, non-transferable tokens, and metadata ★ (a transfer hook is another way to enforce spending rules) |
| Associated Token Account (ATA) | The program that gives each wallet one deterministic token account per mint ★ (the vault ATA and the agent pocket) |
| Metaplex Token Metadata | The NFT and token metadata standard |
| Metaplex Core | A lighter, single-account NFT standard with plugins |
| Compressed NFTs (Bubblegum) | NFTs stored in Merkle trees through state compression, minted for fractions of a cent |
| ZK Compression (Light Protocol + Helius) | Compressed accounts and tokens, so that state is far cheaper than rent |

## 3. Payments and stablecoins

| Protocol | What it is |
| --- | --- |
| x402 on Solana ★ | HTTP 402 pay-per-request payments in stablecoins; the core rail for Allowance |
| pay.sh ★ | A Solana and Google Cloud directory of x402-payable APIs, with an MCP server |
| Solana Pay | A QR and URL standard for merchant payments and transaction requests |
| Solana Actions and Blinks ★ | Shareable links that turn into signable transactions anywhere (planned for the kill-switch Blink) |
| USDC (Circle) and CCTP | Native USDC, plus Circle's burn-and-mint bridge between chains ★ |
| PYUSD (PayPal), USDT, USDG (Paxos) | Other major stablecoins on Solana |
| Sphere, Helio (MoonPay) | Merchant payment and checkout platforms |
| Streamflow | Token vesting and payment streaming (relevant to the subscriptions feature) |
| Squads ★ | The multisig and smart-account standard; the treasury layer for team budgets |
| Crossmint ★ | Wallets-as-a-service, agent wallets, and card checkout |

## 4. DEXs and liquidity

| Protocol | What it is |
| --- | --- |
| Jupiter | The main swap aggregator; also offers limit orders, DCA, perps, the JLP pool, and launchpad ★ (stretch goal for swaps) |
| Raydium | AMM plus a concentrated-liquidity DEX; the main venue for launchpad tokens |
| Orca (Whirlpools) | A concentrated-liquidity AMM |
| Meteora | Dynamic liquidity (DLMM), dynamic AMM pools, and launch pools |
| Phoenix | A fully on-chain limit order book |
| OpenBook | A community-run order book (the successor to Serum) |
| Lifinity, Saber | Proactive-market-maker AMM, and a stable-swap AMM |
| Pump.fun / PumpSwap | Memecoin launchpad plus its own AMM |

## 5. Lending, perps and DeFi

| Protocol | What it is |
| --- | --- |
| Kamino | Lending, automated liquidity vaults, and multiply strategies |
| marginfi | Lending and borrowing |
| Solend / Save | One of the earliest lending markets on Solana |
| Drift | Perpetuals, spot trading, and lending in one protocol |
| Jupiter Perps | Perps backed by the JLP pool |
| Zeta, Parcl | Perps, and real-estate price perps |
| Kamino / Meteora vaults | Yield vaults |
| Ethena USDe (on Solana) | A synthetic dollar bridged to Solana |

## 6. Liquid staking and restaking

| Protocol | What it is |
| --- | --- |
| Marinade (mSOL) | The largest early liquid-staking protocol |
| Jito (JitoSOL) | Liquid staking that includes MEV rewards; Jito also runs the block engine and bundles |
| Sanctum (INF, LST infra) | Infrastructure for liquid staking tokens: lets anyone launch one, with an instant-unstake pool |
| BlazeStake (bSOL), Jupiter (JupSOL), Binance (BNSOL) | Other widely used LSTs |
| Jito Restaking, Solayer, Fragmetric | Restaking that secures other networks |

## 7. Oracles and data

| Protocol | What it is |
| --- | --- |
| Pyth Network | Pull-based price oracle that started on Solana |
| Switchboard | A permissionless oracle with custom feeds and on-demand pulls; it also supplies randomness |
| Chainlink (on Solana) | Price feeds and CCIP |
| Helius, Triton, QuickNode | RPC providers with webhooks, DAS API, and gRPC streaming (Yellowstone/Geyser) ★ (use a Helius devnet key) |

## 8. Identity, reputation and naming

| Protocol | What it is |
| --- | --- |
| Agent Registry (8004 on Solana) ★ | Identity, reputation and validation registries for AI agents; the reputation gate in Allowance |
| Solana Name Service / Bonfida (.sol) | Human-readable wallet names (useful for "pay Alice") |
| AllDomains | Other top-level domains such as .abc and .bonk |
| Civic Pass | Identity and KYC gateway tokens |
| Solana Attestation Service | On-chain attestations and credentials |

## 9. AI and agent infrastructure

| Protocol / tool | What it is |
| --- | --- |
| Solana Agent Kit (SendAI) ★ | A toolkit that lets LLM agents run Solana actions (swap, transfer, stake, and more) |
| Solana Agent Skills ★ | Pre-built agent skills, including security checks |
| x402 + pay.sh ★ | Agent payments (see section 3) |
| Agent Registry ★ | Agent trust (see section 8) |
| ai16z / ElizaOS | An open-source agent framework with a Solana plugin |
| Virtuals, Arc | Agent launch and agent frameworks with a Solana presence |
| io.net, Render, Nosana | Decentralized GPU compute networks on Solana |
| Grass | A network that sells bandwidth and data for AI training |

## 10. DePIN (physical infrastructure)

| Protocol | What it is |
| --- | --- |
| Helium | Decentralized wireless (IoT and 5G mobile) |
| Hivemapper | Crowdsourced maps from dashcams |
| Render, io.net, Nosana | GPU compute (see section 9) |
| Shadow (GenesysGo) | Decentralized storage |
| DIMO, Teleport | Vehicle data, and decentralized ride-sharing |

## 11. Wallets and account abstraction

| Wallet / tool | What it is |
| --- | --- |
| Phantom ★ | The most-used Solana wallet; the owner signs in Allowance with it |
| Solflare, Backpack | Other major wallets |
| Solana Wallet Adapter / Wallet Standard ★ | The library that connects any wallet to a dApp |
| Squads smart accounts ★ | Programmable multisig accounts with spending limits |
| Privy, Dynamic, Turnkey, Crossmint ★ | Embedded wallets and server-side key management for agents |
| Seed Vault (Saga / Seeker phones) | Hardware-backed key storage on Solana phones |

## 12. Bridges and interoperability

| Protocol | What it is |
| --- | --- |
| Wormhole | The largest general-purpose message bridge (with Portal token bridge) |
| Circle CCTP | Native USDC transfers between chains |
| deBridge (DLN) | Fast cross-chain swaps |
| Allbridge, Mayan | Cross-chain swap bridges |
| LayerZero | Omnichain messaging and OFT tokens |

## 13. MEV and transaction landing

| Protocol | What it is |
| --- | --- |
| Jito block engine and bundles | Atomic transaction bundles with tips to validators |
| bloXroute, Nozomi (Temporal), Helius Sender | Fast transaction-landing services |
| Stake-weighted QoS | Validators give priority to connections from staked nodes |

## 14. Developer frameworks and tooling

| Tool | What it is |
| --- | --- |
| Anchor ★ | The main Rust framework for Solana programs (used to build Allowance) |
| Pinocchio, Steel | Lightweight, zero-dependency program frameworks for low compute use |
| Solana Kit (`@solana/kit`), web3.js ★ | JavaScript and TypeScript SDKs |
| Codama | Generates clients from program IDLs |
| LiteSVM, Mollusk, Bankrun | Fast local test harnesses for programs ★ (faster Anchor tests) |
| Solana Playground | A browser IDE for programs |
| create-solana-dapp / Solana Developer Templates ★ | Starter templates (Anchor plus Next.js) |
| Solana Verify | Verifiable builds |
| Clockwork successors / Tuk Tuk | Scheduled on-chain automation |

## 15. Consumer, NFTs and gaming

| Protocol | What it is |
| --- | --- |
| Magic Eden, Tensor | NFT marketplaces |
| Metaplex | NFT standards and tools (see section 2) |
| Drip, Dialect | Consumer drops and on-chain messaging and notifications (Dialect also powers Blinks) |
| STEPN, Star Atlas, Aurory | Move-to-earn and gaming |
| Magicblock | Ephemeral rollups for real-time on-chain games |

## 16. Scaling and SVM networks

| Project | What it is |
| --- | --- |
| Magicblock ephemeral rollups | Fast, temporary execution environments that settle back to Solana |
| Sonic SVM, Eclipse, Soon | SVM-based L2s and app chains |

## What to use for Allowance

- **Must use:** Anchor, SPL Token (or Token-2022), ATA, devnet USDC, x402 (`@x402/svm`), the Agent Registry (8004), Phantom with Wallet Adapter, and a Helius devnet RPC.
- **Good additions:** a Squads multisig as the vault owner (team budgets), a Blink for the kill switch, SNS `.sol` names for contacts, and a Token-2022 transfer hook as an alternative enforcement design.
- **Stretch:** a Jupiter swap (mainnet only), real pay.sh endpoints, and Streamflow for subscriptions.
