# Protocol script coverage (README “Planned Protocols”)

Architecture: [`00-architecture.md`](./00-architecture.md). This document maps each named protocol to **cross-chain trackers**, **analytics**, **simulation / smoke**, and **swap** commands in `package.json`.

## Legend

- **Cross-chain (`crosschain:*`)** — Subgraph-backed TVL, volume, and (for Uniswap) liquidity trackers under `src/crosschain/`. Only **Uniswap, Curve, Balancer, and SushiSwap** have these scripts; nothing else in the list uses this namespace.
- **Analytics (`analytics:*`)** — Dedicated monitors or generic DefiLlama summaries (`DEFILLAMA_SLUG`), plus category aggregators such as `analytics:lending:aggregate` and `analytics:amm:aggregate`.
- **Simulate (`simulate:*`)** — On-chain fork / quote flows, or DefiLlama/API smokes (`simulate:*:smoke`, aggregate smokes).
- **Swap (`swap:*`)** — Wallet-backed examples in `src/examples/`. Only major pool DEX routes have named scripts; lending, LST, perp, and RWA rows do not (by design).

## Swap / simulate: not applicable in this stack

These are **not** modeled as `swap:*` or `dexForkRunner` pool quotes in this repo:

- **Solana AMM (e.g. HumidiFi)** — requires a non-ethers client.
- **Perp / hybrid DEX (Reya, Lighter, Aster, Drake)** — not spot Uniswap-style routers; use analytics / Llama smokes only.
- **RWA / allowlisted transfer (Ondo, BUIDL)** — swap examples are usually blocked without institutional setup.
- **Privacy / FHEVM (Zama), Aztec Ignition** — toolchain-specific; Aztec row on Llama may still differ from Ignition branding.

## Aerodrome / Velodrome (Slipstream) — reference quotes

Slipstream **on-chain quoters** at the published addresses do not return success for standard `QuoterV2.quoteExactInputSingle.staticCall` in this codebase (calls revert). To still ship useful scripts:

- **`simulate:dex:aerodrome:v3`** / **`simulate:dex:velodrome:v3`** set `DEFI_SLIPSTREAM_PROXY=1` and run **Uniswap V3** on the same chain (`base` / `optimism`) with a console note — liquid reference for WETH/USDC-style pairs, not Slipstream execution.
- **`swap:aerodrome`** / **`swap:velodrome`** quote **Uniswap V3** on that chain and explain the limitation; execute via protocol UI or extend with a compatible quoter path.
- **`chains.js`** still lists `aerodrome.v3` / `velodrome.v3` (router, quoter, **pool factory from `router.factory()`**) for future integration via `v3Swap` + `dexId`.

## Established protocols (pre-2025)

- **Uniswap** — Cross-chain: yes (`crosschain:uniswap:*`). Analytics: `analytics:uniswap:prices`. Simulate: `simulate:dex:uniswap:v2|v3|v4`, `simulate:multi*`, `simulate:quote`, `simulate:swap`. Swap: `swap:uniswap:v2|v3|v4`.
- **Lido** — Cross-chain: no. Analytics: `analytics:lido:staking`. Simulate: `simulate:lido:fork`, `simulate:lido:read`. Swap: no.
- **Aave** — Cross-chain: no. Analytics: `analytics:aave:markets`, `analytics:aave:versions`, `analytics:aave:liquidations`. Simulate: `simulate:aave:*`, lending smokes. Swap: no.
- **Curve** — Cross-chain: yes. Analytics: `analytics:curve:pools`. Simulate: `simulate:dex:curve`, `simulate:multi*`. Swap: `swap:curve`.
- **Balancer** — Cross-chain: yes. Analytics: `analytics:balancer:pools`. Simulate: `simulate:dex:balancer`, `simulate:multi*`. Swap: `swap:balancer`.
- **Morpho** — Cross-chain: no. Analytics: `analytics:morpho:optimizer`; also listed in `analytics:lending:aggregate`. Simulate: `simulate:morpho:smoke`, **`simulate:morpho:fork`** (read `market(bytes32)` on Morpho Blue; optional `MORPHO_MARKET_ID`). Swap: no (`swap:morpho` would be misleading).
- **SushiSwap** — Cross-chain: yes. Analytics: `analytics:sushiswap:pools`. Simulate: `simulate:dex:sushiswap:v2|v3`, `simulate:multi*`. Swap: `swap:sushiswap`.

## 2025 launched (README list)

- **Reya** — Analytics: `analytics:reya:dex`. Simulate: `simulate:reya:smoke`. Cross-chain / swap: no.
- **Aster** — Analytics: `analytics:aster:perps`. Simulate: `simulate:aster:smoke`. Cross-chain / swap: no.
- **Ammalgam** — Analytics: `analytics:ammalgam:hybrid`. Simulate: `simulate:ammalgam:smoke`. Cross-chain / swap: no.
- **Kinto** — Analytics: `analytics:kinto:dex`. Simulate: `simulate:kinto:smoke` (DefiLlama slug `kinto`). Cross-chain / swap: no.
- **Curvy v2** — Analytics: `analytics:curvy:aggregator`. Simulate: `simulate:curvy:smoke`. Cross-chain / swap: no.
- **Milk Road Swap** — No dedicated scripts; confirm a DefiLlama slug (or on-chain scope) before adding smokes.
- **HumidiFi** — Analytics: `analytics:humidifi:dex`. Simulate: `simulate:humidifi:smoke` (slug `humidifi`). Cross-chain / swap: no.
- **Lighter** — Analytics: `analytics:lighter:perps`. Simulate: `simulate:lighter:smoke`. Cross-chain / swap: no.
- **Drake Exchange** — Analytics: `analytics:drake:perps` (Monad perp DEX; slug `drake-exchange`). Simulate: `simulate:drake:smoke`. Points / MON campaign row in `analytics:airdrop:watch`. Cross-chain / swap: no.
- **Kintsu** — Analytics: `analytics:kintsu:staking`, `analytics:staking:compare`. Simulate: `simulate:kintsu:smoke`, `simulate:staking:compare:smoke`. Cross-chain / swap: no.
- **Curvance** — Analytics: **`analytics:lending:aggregate`** (TVL row for slug `curvance`). Simulate: **`simulate:lending:aggregate:smoke`**. Cross-chain / swap: no.
- **Resolv** — Same as Curvance via lending aggregate + `simulate:lending:aggregate:smoke` (slug `resolv`). Cross-chain / swap: no.
- **StakeStone** — Analytics: `analytics:stakestone:staking`, `analytics:staking:compare`. Simulate: `simulate:stakestone:smoke`, `simulate:staking:compare:smoke`. Cross-chain / swap: no.
- **Zama FHEVM DEX** — Analytics: `analytics:zama:privacy` (confidential DeFi on Ethereum; slug `zama`, category Privacy). Simulate: `simulate:zama:smoke`. Cross-chain / swap: no (FHEVM toolchain).
- **Aztec Ignition DEX** — Analytics: `analytics:aztec:dex`. Simulate: `simulate:aztec:smoke`. DefiLlama currently surfaces **Aztec Connect** under slug `aztec`; naming may differ from “Ignition DEX.” Cross-chain / swap: no.
- **Monad AMM (native)** — Analytics: `analytics:monad:dex`. Simulate: `simulate:monad:smoke`, **`simulate:dex:monad:v3`** (Uniswap V3 on Monad; `CHAINS.monad` + `MONAD_RPC_URL` override). WMON is under `COMMON_TOKENS.WETH.monad`. Pool liquidity can be thin — quotes may fail sanity filters. Cross-chain: no.
- **Base liquidity AMM (Aerodrome)** — Analytics: `analytics:aerodrome:dex`, row in `analytics:amm:aggregate`. Simulate: `simulate:aerodrome:smoke`, **`simulate:dex:aerodrome:v3`** (Slipstream proxy → Uniswap V3 on Base; see above). Swap: **`swap:aerodrome`** (reference quote). Cross-chain: no `crosschain:aerodrome:*`.
- **Morpho Base AMM** — Same as Morpho (no separate npm names).
- **Soneium DEX** — No verified DefiLlama slug; add after listing exists.
- **MegaETH AMM** — No verified DefiLlama slug; add after listing exists.

## Trending 2026

- **UniswapX** — Analytics: `analytics:uniswapx:activity`. Simulate: **`simulate:uniswapx:fill`** (chunked `eth_getLogs` + `eth_call` replay at fill block; soft-fail on revert unless `UNISWAPX_REPLAY_STRICT=1`). Swap: **`swap:uniswapx`** (doc-only pointer). Env: `UNISWAPX_REPLAY_TX`, `UNISWAPX_MAX_BLOCKS`, `UNISWAPX_LOG_CHUNK`.
- **Ondo** — Analytics: `analytics:ondo:markets`. Simulate: `simulate:ondo:smoke`. Cross-chain / swap: no.
- **BUIDL** — Analytics: `analytics:buidl:markets`, `analytics:buidl:supply`. Simulate: `simulate:buidl:smoke`. Cross-chain / swap: no.
- **Sky** — Analytics: `analytics:sky:rates`. Simulate: `simulate:sky:smoke`. Cross-chain / swap: no.
- **Ethena** — Analytics: `analytics:ethena:monitor`. Simulate: `simulate:ethena:smoke`. Cross-chain / swap: no.
- **Nostra Finance** — Analytics: `analytics:nostra:lending` (Starknet lending/money-market; slug `nostra`). Simulate: `simulate:nostra:smoke`. Cross-chain / swap: no.
- **Suilend** — Analytics: `analytics:suilend:lending` (Sui lending; slug `suilend`). Simulate: `simulate:suilend:smoke`. Cross-chain / swap: no.
- **Rhea Finance** — Analytics: `analytics:rhea:defi` (NEAR DEX + lending + LST parent; slug `rhea-finance`), `analytics:rhea:lending` (Rhea Lend; slug `rhea-lend`). Simulate: `simulate:rhea:smoke`, `simulate:rhea:lending:smoke`. Cross-chain / swap: no.
- **Stargate Finance** — Analytics: `analytics:stargate:bridge` (V1+V2 bridge parent; slug `stargate-finance`), `analytics:stargate:v2` (slug `stargate-v2`). Simulate: `simulate:stargate:smoke`, `simulate:stargate:v2:smoke`. Cross-chain / swap: no.
- **Benqi Lending** — Analytics: `analytics:benqi:lending` (Avalanche lending; slug `benqi-lending`). Simulate: `simulate:benqi:smoke`. Cross-chain / swap: no.
- **EigenLayer (EigenCloud)** — Analytics: `analytics:eigenlayer:restaking` (slug `eigencloud`; `eigenlayer` resolves to the same entry). Simulate: `simulate:eigenlayer:smoke`. Cross-chain / swap: no.
- **Astroport** — Analytics: `analytics:astroport:dex` (Terra2/Injective/Osmosis/Neutron DEX; slug `astroport`). Simulate: `simulate:astroport:smoke`. Neutron sibling **Drop** (slug `drop`) is wired separately as `analytics:drop:staking` (its Llama series is $0 after the drain).
- **Meter Passport** — Analytics: `analytics:meter:bridge` (slug `meter-passport`). Simulate: `simulate:meter:smoke`. Cross-chain / swap: no.
- **Meteora DLMM** — Analytics: `analytics:meteora:dex` (slug `meteora-dlmm`; claim: Referral Staking Cycle 2 paid $700K+ USDC; cycle ended 2026-09-21 ([Solana Compass](https://solanacompass.com/news/meteora-referral-staking-cycle-2-distributes-over-700k-in-usdc-more-than-double-cycle-1), 2026-09-23)). Simulate: `simulate:meteora:smoke`. Cross-chain / swap: no.
- **Bitget (CEX)** — Analytics: `analytics:bitget:cex` (CEX reserve TVL by chain; slug `bitget`). Simulate: `simulate:bitget:smoke`. Read-only; not a DeFi venue.
- **Drop** — Analytics: `analytics:drop:staking` (slug `drop`; claim: Neutron Prop 9 governance attack emptied Astroport and Drop contracts (~$9.4M per Rarma) on 2026-09-22 ([Altcoin Buzz](https://www.altcoinbuzz.io/cosmos-hub-moves-2-1m-of-stolen-atom-after-25-hour-halt), 2026-09-23); Llama TVL is $0). Simulate: `simulate:drop:smoke` (SMOKE_MIN_TVL_USD=0 so $0 is OK). Wired even at $0 TVL (the Astroport row previously skipped it).
- **THORChain DEX** — Analytics: `analytics:thorchain:dex` (slug `thorchain-dex`; claim: ~500k stolen ATOM swapped through THORChain; 168,990.9 ATOM refunded to the attacker after the Hub restart ([Cosmos forum](https://forum.cosmos.network/t/neutron-governance-attack-cosmos-hub-response-and-recovery-update/17369); [CryptoSlate](https://cryptoslate.com/cosmos-restarted-to-seize-2-2-million-in-stolen-atom-but-169000-tokens-still-escaped/), 2026-09-24)). Simulate: `simulate:thorchain:smoke`. Cross-chain / swap: no.
- **Polymarket** — Analytics: `analytics:polymarket:pred` (slug `polymarket`; claim: Polymarket U.S. just over $1.03B notional volume on the Sep 19-20 weekend ([SCCG](https://sccgmanagement.com/sccg-articles/2026/09/23/kalshi-crypto-volume-allegations-emerge-against-backdrop-of-764-billion-prediction-market-record/), 2026-09-23); the Llama slug tracks the international book). Simulate: `simulate:polymarket:smoke`. Cross-chain / swap: no.
- **Circle** — Analytics: `analytics:circle:stable` (slug `circle`; claim: Circle 24h revenue $7.35M per DefiLlama ([BlockBeats](https://en.theblockbeats.news/flash/369146), 2026-09-26)). Simulate: `simulate:circle:smoke`. Cross-chain / swap: no.
- **Circle Bitcoin** — Analytics: `analytics:circle-bitcoin:bridge` (slug `circle-bitcoin`; claim: cirBTC live on Arc 2026-09-21; ~$302M mcap / Llama TVL ~$376M (+409% 7d) ([Arc blog](https://www.arc.io/blog/cirbtc-is-now-live-on-arc), [CoinFomania](https://coinfomania.com/301-9m-circles-wrapped-bitcoin-circles-defi-landscape/), 2026-09-21/25)). Simulate: `simulate:circle-bitcoin:smoke`. Cross-chain / swap: no.
- **Arc Chain** — Analytics: `analytics:arc:chain` (Circle L1, chainId 5042; DefiLlama v2/chains name=Arc; claim: Arc DeFi TVL $494M, +44.52% 7d, 10 days after mainnet ([TokenPost](https://www.tokenpost.com/news/technology/24382), 2026-09-26)). Simulate: `simulate:arc:smoke` (reuses `fetchLlamaChains` from `src/analytics/utils/defiLlamaProtocol.js`; exits 0 when Arc TVL is a finite number). Do NOT add Arc to L2_CHAINS (it is Circle's L1, not an L2). Cross-chain / swap: no.
- **NEAR Intents** — Analytics: `analytics:near:intents` (slug `near-intents`; claim: NEAR Intents passed ~$31.4B cumulative volume ([Bitinsider](https://bitinsider.io/articles/near-protocol-intents-surpass-30b-in-all-time-volume-as-daily-records-fall), 2026-09-22)). Simulate: `simulate:near:intents:smoke`. Cross-chain / swap: no.
- **Jupiter Lend DEX** — Analytics: `analytics:jupiter:lend-dex` (slug `jupiter-lend-dex`; claim: Jupiter Earn to seed $10M of sUSDai DEX liquidity on the Jupiter Lend AMM ([Altcoin Buzz](https://www.altcoinbuzz.io/kamino-opens-usdc-borrowing-against-gpu-loan-yields-on-solana), 2026-09-25)). Simulate: `simulate:jupiter:lend-dex:smoke`. Cross-chain / swap: no.
- **Gravity by Galxe** — Analytics: `analytics:gravity:bridge` (slug `gravity-by-galxe`; claim: $G cross-exchange spread hit 40% on bridge limits ([GetChain](https://www.getchainnews.com/en/newflash/E6KkDYb68k), 2026-09-20); Fast Withdraw cut Alpha Mainnet to Ethereum settlement from 7 days to ~10 min ([TradingView](https://www.tradingview.com/news/coinmarketcal:61ad0b705094b:0-gravity-by-galxe-fast-withdraw-goes-live-for-g-bridge-transfers-to-ethereum-20-sep-2026/), 2026-09-20)). Simulate: `simulate:gravity:smoke`. Cross-chain / swap: no.
- **USD AI** — Analytics: `analytics:usdai:rwa` (slug `usd-ai`; claim: $128.9M GPU financing facility, its largest to date ([PR Newswire](https://www.prnewswire.com/news-releases/usdai-announces-128-9m-gpu-financing-facility-its-largest-to-date-302888224.html), 2026-09-23)). Simulate: `simulate:usdai:smoke`. Cross-chain / swap: no.
- **Jupiter Lend** — Analytics: `analytics:jupiter:lend` (slug `jupiter-lend`; claim: record $2.41B total deposits on 2026-09-22 ([Solana Compass](https://solanacompass.com/news/jupiter-perps-adds-six-markets-including-tokenized-spacex-hype-and-zec-via-gum-orderbook), 2026-09-22)). Simulate: `simulate:jupiter:lend:smoke`. Sibling to Jupiter Lend DEX above. Cross-chain / swap: no.
- **Kuru CLOB** — Analytics: `analytics:kuru:clob` (slug `kuru-clob`; claim: Kuru cumulative trading volume passed $7B on Monad ([TokenPost](https://www.tokenpost.com/news/investing/24062), 2026-09-25)). Simulate: `simulate:kuru:smoke`. Cross-chain / swap: no.
- **NAVI Lending** — Analytics: `analytics:navi:lending` (slug `navi-lending`; claim: NAVI held >$420M of deposits in Sui's $1.21B TVL snapshot of 2026-09-22 ([Bitcoinist](https://bitcoinist.com/sui-tvl-moves-above-1-2b-as-defi-liquidity-expands/), 2026-09-24)). Simulate: `simulate:navi:smoke`. Cross-chain / swap: no.
- **PumpSwap** — Analytics: `analytics:pumpswap:dex` (slug `pumpswap`; claim: ~$482.79M 24h volume, ~17% of Solana's $2.80B DEX volume ([The Chain Observer](https://thechainobserver.com/solana-dex-volume-reaches-2-8b/), 2026-09-22 snapshot)). Simulate: `simulate:pumpswap:smoke`. Cross-chain / swap: no.
- **pump.fun** — Analytics: `analytics:pumpfun:launchpad` (slug `pump.fun`; claim: $1.96M 24h protocol revenue ahead of Hyperliquid ([The Block Beats](https://en.theblockbeats.news/flash/369146), [Gate.com](https://www.gate.com/zh-tw/news/detail/pumpfun-surpasses-hyperliquid-with-196m-protocol-revenue-in-24-hours-24572571), 2026-09-26)). Simulate: `simulate:pumpfun:smoke` with SMOKE_MIN_TVL_USD=0 (TVL series is empty; fees/revenue is the checkable surface; smoke must pass when TVL is 0/empty). Do not confuse with existing analytics:pumpswap:dex (slug pumpswap). Cross-chain / swap: no.
- **Kamino Lend** — Analytics: `analytics:kamino:lending` (slug `kamino-lend`; claim: sUSDai/USDC market opened at 80% max LTV, 85% liquidation LTV, 5M supply/borrow caps ([Altcoin Buzz](https://www.altcoinbuzz.io/kamino-opens-usdc-borrowing-against-gpu-loan-yields-on-solana), 2026-09-25)). Simulate: `simulate:kamino:smoke`. Cross-chain / swap: no.
- **Raydium AMM** — Analytics: `analytics:raydium:dex` (slug `raydium-amm`; claim: Raydium TVL $1.26B; handled $1.713B (64%) of StonkFun's $2.67B volume ([KuCoin](https://www.kucoin.com/news/flash/ray-gains-10-as-raydium-captures-64-of-stonkfun-volume), 2026-09-22)). Simulate: `simulate:raydium:smoke`. Cross-chain / swap: no.
- **DFDV Staked SOL** — Analytics: `analytics:dfdv:staking` (slug `dfdv-staked-sol`; claim: DFDV added 101,381 SOL in a week to ~2,490,304 SOL, deployed via its staking/validator stack ([KuCoin / The Coin Republic](https://www.kucoin.com/news/flash/dfdv-adds-101-381-sol-to-treasury-as-sol-price-surpasses-116), 2026-09-22)). Simulate: `simulate:dfdv:smoke`. Cross-chain / swap: no.
- **DeepBook V3** — Analytics: `analytics:deepbook:dex` (slug `deepbook-v3`; claim: DeepBook App launched on the order book behind $20B+ of Sui volume ([Sui blog](https://www.sui.io/blog/deepbook-app-is-live-onchain-power-for-serious-traders); [TradingView](https://www.tradingview.com/news/coinmarketcal:e0ad19724094b:0-deepbook-alpha-app-goes-live-with-spot-trading-btc-prediction-markets-and-api-24-sep-2026/), 2026-09-24)). Simulate: `simulate:deepbook:smoke`. Cross-chain / swap: no.
- **BisonFi** — Analytics: `analytics:bisonfi:dex` (slug `bisonfi`; claim: ~$424.26M 24h volume ([The Chain Observer](https://thechainobserver.com/solana-dex-volume-reaches-2-8b/), 2026-09-22); top Solana AMM by volume for 25 straight weeks ([Gate News](https://www.gate.com/news/detail/SOL/bisonfi-dominates-solana-amm-market-for-25-consecutive-weeks-24501218), 2026-09-23)). Simulate: `simulate:bisonfi:smoke`. Cross-chain / swap: no.
- **Jito** — Analytics: `analytics:jito:staking` (slug `jito`; claim: Jito pool held 10.38M SOL vs 7.96M JitoSOL supply at epoch 1042 ([Solana Compass](https://solanacompass.com/news/sec-staff-faq-says-staking-receipt-tokens-can-be-digital-commodities-jito), 2026-09-25)). Simulate: `simulate:jito:smoke`. Cross-chain / swap: no.
- **Sanctum** — Analytics: `analytics:sanctum:staking` (slug `sanctum`; claim: CLOUD-008 passed: 259M CLOUD burned, total supply 1B to ~741M; TVL $2.05B ([Solana Compass](https://solanacompass.com/news/sanctum-governance-vote-passes-259m-cloud-tokens-to-be-burned-ticker-renames-to-sanc), 2026-09-19 19:35 UTC = 2026-09-20 UTC+8)). Simulate: `simulate:sanctum:smoke`. Cross-chain / swap: no.
- **Steakhouse Financial** — Analytics: `analytics:steakhouse:curator` (slug `steakhouse-financial`; claim: Steakhouse Prime Instant on Base $444.37M TVL (Portals week-4) ([Portals blog](https://blog.portals.fi/defi-tvl-september-2026-week-4/), 2026-09-25)). Simulate: `simulate:steakhouse:smoke`. Cross-chain / swap: no.
- **Upshift** — Analytics: `analytics:upshift:allocator` (slug `upshift`; claim: Upshift Sentora USD Earn $94.41M TVL on Ethereum ([Portals blog](https://blog.portals.fi/defi-tvl-september-2026-week-4/), 2026-09-25)). Simulate: `simulate:upshift:smoke`. Cross-chain / swap: no.
- **Payy Network** — No DefiLlama slug. Analytics: `analytics:payy:bridge` (generic `src/analytics/protocols/onchain/erc20BalanceMonitor.js`: USDC `balanceOf` the Payy Ethereum bridge `0x367C1eAF14AA06b78ce76bd0243297de79d85270`). Simulate: `simulate:payy:smoke` (same module, `ERC20_SMOKE=1`). Needs `ETHEREUM_RPC_URL`.

## Day-trading catalog (early 2026)

Spot venues, aggregators, perps, and Synthetix use **`dexProtocolMonitor.js`** + **`smokeDefiLlamaProtocol.js`** with verified slugs (e.g. `maverick-protocol`, `vertex-perps`, `polynomial-trade`, `fluid-dex`, `cowswap`). Commands live in the README and `package.json`.

- **Aevo** — Analytics: `analytics:aevo:perps` (slug `aevo`). Simulate: `simulate:aevo:smoke`. Cross-chain / swap: no.
- **Spark** — Analytics: `analytics:spark:lend` (slug `spark`); row in `analytics:lending:aggregate`. Simulate: `simulate:spark:smoke`, `simulate:lending:aggregate:smoke`. Cross-chain / swap: no.
- **Gains / MUX / SynFutures** — Analytics: `analytics:gains:perps`, `analytics:mux:perps`, `analytics:synfutures:perps`. Simulate: `simulate:gains:smoke`, `simulate:mux:smoke`, `simulate:synfutures:smoke` (slugs `gains-network`, `mux-protocol`, `synfutures-v3`).
- **Hyperliquid** — Analytics: `analytics:hyperliquid:perps` (slug `hyperliquid`). Simulate: `simulate:hyperliquid:smoke`. Cross-chain / swap: no.
- **Lending aggregate smoke** now covers `aave-v3`, `morpho-v1`, `compound-v3`, `spark`, `venus`, `euler-v2`, `curvance`, `resolv` (matches `LENDING_PROTOCOLS` in `allLendingAggregator.js`).

- **AMM aggregate:** `analytics:amm:aggregate` / `simulate:amm:aggregate:smoke` — rows are defined in `AMM_PROTOCOLS` in `src/analytics/aggregators/allAmmDexAggregator.js` (reused by the smoke script).

## Landscape analytics (L2 / NFT / airdrop — no money-legos)

Read-only DefiLlama / calendar views. Not claimers, not MEV submit.

- **L2** — `analytics:l2:overview` (DefiLlama chain TVL + DEX volume). Smoke: `simulate:l2:overview:smoke`.
- **ETH DEX share** — `analytics:eth:dex-share` (Uniswap V4/V3/Aqua venue volume on Ethereum). Smoke: `simulate:eth:dex-share:smoke`.
- **ETH/BTC TVL** — `analytics:ethbtc:tvl` (chain TVL last month / this month / this week). Smoke: `simulate:ethbtc:tvl:smoke`.
- **ETH/BTC ratio** — `analytics:ethbtc:ratio` (spot + ratio windows). Smoke: `simulate:ethbtc:ratio:smoke`.
- **ETH lending movers** — `analytics:eth:lending-movers` (Lending/CDP 7d TVL Δ). Smoke: `simulate:eth:lending-movers:smoke`.
- **ETH yield / Pendle** — `analytics:eth:yield` (Pendle DEX volume + yield TVL). Smoke: `simulate:eth:yield:smoke`.
- **ETH TVL drivers** — `analytics:eth:tvl-drivers` (7d $ inflow/outflow, CEX omitted). Smoke: `simulate:eth:tvl-drivers:smoke`.
- **Aave mix** — `analytics:eth:aave-mix` (V3/V4/Horizon collateral). Smoke: `simulate:eth:aave-mix:smoke`.
- **Pendle markets** — `analytics:eth:pendle-markets` (chain TVL + ETH PT/YT). Smoke: `simulate:eth:pendle-markets:smoke`.
- **BTC wraps** — `analytics:btc:wraps` (Bitcoin wrap/restake TVL, CEX omitted). Smoke: `simulate:btc:wraps:smoke`.
- **BTC wrap trail** — `analytics:btc:wrap-trail` (Circle daily path vs peers). Smoke: `simulate:btc:wrap-trail:smoke`.
- **RWA** — `analytics:rwa:overview` (RWA protocol TVL board; Ondo/BUIDL one-offs remain). Smoke: `simulate:rwa:overview:smoke`.
- **NFT** — `analytics:nft:markets` (marketplace fees + collection watchlist). Smoke: `simulate:nft:markets:smoke`.
- **Airdrop** — `analytics:airdrop:watch` (research calendar; optional trends join). Smoke: `simulate:airdrop:watch:smoke`.

Social chatter for the same landscapes is the collective `defi-mev` scrape (`TWITTER_URLS` + `DISCORD_CHANNEL_URLS`).

## Adding a missing protocol

1. Confirm a **DefiLlama slug** via `https://api.llama.fi/protocol/<slug>` (HTTP 200 and sensible `name`).
2. **Analytics:** add a line to `package.json`, e.g. `DEFILLAMA_SLUG=<slug> DEFILLAMA_LABEL=<Name> node src/analytics/protocols/llama/dexProtocolMonitor.js` (copy `analytics:aster:perps` pattern).
3. **Smoke:** add `SMOKE_SLUG=<slug> node src/simulation/api/smokeDefiLlamaProtocol.js` (copy `simulate:lighter:smoke`). Use `SMOKE_ALLOW_NOT_LISTED=1` only when a 404 should not fail CI.
4. **No slug but a checkable contract balance** (e.g. a drained bridge): reuse `src/analytics/protocols/onchain/erc20BalanceMonitor.js` with `ERC20_TOKEN` / `ERC20_HOLDER` / `ERC20_CHAIN` (copy `analytics:payy:bridge`).
5. **Lending-style** protocols: consider extending `LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js` and `SLUGS` in `src/simulation/api/smokeLendingLlamaAggregate.js` instead of one-off monitors.
