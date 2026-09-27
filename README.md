## Overview

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?logo=ethereum&logoColor=white)](https://ethereum.org)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Chains](https://img.shields.io/badge/chains-9-orange.svg)](#setup)


DeFi analytics and swap scripts for Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, zkSync, Scroll, and Unichain.

Workspace map: [`docs/00-architecture.md`](docs/00-architecture.md). Protocol command matrix: [`docs/01-protocol-script-coverage.md`](docs/01-protocol-script-coverage.md).

<p align="center">
  <img src="no-money-meme.jpg" alt="No Money Meme" width="500"/>
</p>

**⭐ Star this repo if you find it useful!**

## Repo layout

```
src/
  config/          # chains.js (RPC + protocol addresses), pairs.js
  utils/           # web3 provider, validation, token helpers
  abis/            # contract ABIs
  swaps/           # Uniswap V2/V3/V4, Sushi, Curve, Balancer, dexAggregator
  simulation/      # fork quotes, lending/staking/UniswapX sims, Llama smokes
  analytics/       # protocols/<name>/ monitors + aggregators/ + nft/ + airdrop/
  crosschain/      # Uniswap/Curve/Balancer/Sushi TVL + volume trackers
  examples/        # CLI demos of swap/quote flows
scripts/           # startFork, validateForkSimulations, healthCheckReport
docs/              # 00-architecture.md, 01-protocol-script-coverage.md (README.md is the only package-root .md)
```

Placement vs MEV bots: `.cursor/rules/defi-mev-vs-defi-scripts.mdc`.

## Setup

```bash
npm install
```

Create `.env` with RPC URLs:
```env
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org/
ZKSYNC_RPC_URL=https://mainnet.era.zksync.io
SCROLL_RPC_URL=https://rpc.scroll.io
# Optional — Unichain (Uniswap V3/V4 in chains.js; use CHAIN=unichain for quotes)
UNICHAIN_RPC_URL=https://mainnet.unichain.org
```

## Scripts

### Cross-Chain Analytics

Track TVL and volume across **all major DEXs** on 8 chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, zkSync and Scroll):

| Protocol | TVL | Volume |
|----------|-----|--------|
| **Uniswap** | `npm run crosschain:uniswap:tvl` | `npm run crosschain:uniswap:volume` |
| **Curve** | `npm run crosschain:curve:tvl` | `npm run crosschain:curve:volume` |
| **Balancer** | `npm run crosschain:balancer:tvl` | `npm run crosschain:balancer:volume` |
| **SushiSwap** | `npm run crosschain:sushiswap:tvl` | `npm run crosschain:sushiswap:volume` |

**Weekly Trackers (Historical Data):**
- Uniswap: `npm run crosschain:uniswap:weekly:tvl`, `npm run crosschain:uniswap:weekly:volume`, `npm run crosschain:uniswap:weekly:liquidity`
- Curve: `npm run crosschain:curve:weekly:tvl`, `npm run crosschain:curve:weekly:volume`
- Balancer: `npm run crosschain:balancer:weekly:tvl`, `npm run crosschain:balancer:weekly:volume`
- SushiSwap: `npm run crosschain:sushiswap:weekly:tvl`, `npm run crosschain:sushiswap:weekly:volume`

**Additional Uniswap Trackers:**
- `npm run crosschain:uniswap:liquidity` - Liquidity flows via mint/burn events

### DEX Analytics

Compare prices and analyze pools across different DEX protocols:

| Script | Command | Description |
|--------|---------|-------------|
| **Uniswap Prices** | `npm run analytics:uniswap:prices` | Compare V2/V3/V4 prices and fees (`priceMonitor.js`; quote-centric, unlike `poolMonitor` on other DEXs). |
| **Curve Pools** | `npm run analytics:curve:pools` | Monitor pool balances and arbitrage opportunities |
| **Balancer Pools** | `npm run analytics:balancer:pools` | Track weighted pools and impermanent loss |
| **SushiSwap Pools** | `npm run analytics:sushiswap:pools` | Compare SushiSwap vs Uniswap prices |
| **Multi-DEX Prices** | `npm run analytics:dex:prices` | Aggregate prices across DEXs; `CHAIN=base` `PAIR_GROUP=daytrade` supported |
| **AMM aggregate (Llama)** | `npm run analytics:amm:aggregate` | One-shot TVL snapshot for major AMMs via DefiLlama |
| **Aerodrome (Llama)** | `npm run analytics:aerodrome:dex` | Base DEX TVL snapshot (`DEFILLAMA_SLUG` overridable) |
| **Velodrome (Llama)** | `npm run analytics:velodrome:dex` | Optimism DEX TVL snapshot |
| **PancakeSwap v3 (Llama)** | `npm run analytics:pancakeswap:dex` | Multichain Pancake v3 TVL (`pancakeswap-amm-v3`) |
| **GMX (Llama)** | `npm run analytics:gmx:perps` | Perps / liquidity TVL snapshot |
| **Hyperliquid (Llama)** | `npm run analytics:hyperliquid:perps` | Perps TVL snapshot (`hyperliquid`) |
| **Gains (Llama)** | `npm run analytics:gains:perps` | gTrade TVL snapshot |
| **SynFutures (Llama)** | `npm run analytics:synfutures:perps` | Perp DEX TVL snapshot |
| **Orderly (Llama)** | `npm run analytics:orderly:perps` | Omnichain orderbook infra TVL |
| **MUX (Llama)** | `npm run analytics:mux:perps` | Aggregated perp liquidity TVL |
| **Aster (Llama)** | `npm run analytics:aster:perps` | Hybrid perp/spot TVL |
| **Aevo (Llama)** | `npm run analytics:aevo:perps` | Options + perps L2 TVL snapshot |
| **Lighter (Llama)** | `npm run analytics:lighter:perps` | TVL when listed on DefiLlama |
| **Reya (Llama)** | `npm run analytics:reya:dex` | Protocol summary when listed (slug overridable via env) |
| **Ammalgam (Llama)** | `npm run analytics:ammalgam:hybrid` | Hybrid AMM + lending summary when `AMMALGAM_LLAMA_SLUG` is set |
| **Curvy (Llama)** | `npm run analytics:curvy:aggregator` | Curvy / ZK aggregator monitor from DefiLlama |
| **Kinto (Llama)** | `npm run analytics:kinto:dex` | Kinto TVL snapshot (`kinto`) |
| **HumidiFi (Llama)** | `npm run analytics:humidifi:dex` | HumidiFi TVL snapshot (`humidifi`) |
| **Monad (Llama)** | `npm run analytics:monad:dex` | Monad TVL snapshot (`monad`; often chain-level) |
| **Aztec (Llama)** | `npm run analytics:aztec:dex` | Aztec row on DefiLlama (`aztec`; may show as Aztec Connect) |
| **Drake Exchange (Llama)** | `npm run analytics:drake:perps` | Monad perp DEX TVL snapshot (`drake-exchange`) |
| **Rhea Finance (Llama)** | `npm run analytics:rhea:defi` | NEAR DEX + lending + LST parent TVL (`rhea-finance`) |
| **Rhea Lend (Llama)** | `npm run analytics:rhea:lending` | Rhea lending market TVL (`rhea-lend`) |
| **Stargate Finance (Llama)** | `npm run analytics:stargate:bridge` | Stargate V1+V2 bridge parent TVL (`stargate-finance`) |
| **Stargate V2 (Llama)** | `npm run analytics:stargate:v2` | Stargate V2 bridge TVL only (`stargate-v2`) |
| **Zama (Llama)** | `npm run analytics:zama:privacy` | Zama confidential-DeFi TVL (`zama`) |
| **Astroport (Llama)** | `npm run analytics:astroport:dex` | Cosmos DEX TVL incl. Neutron (`astroport`) |
| **Meter Passport (Llama)** | `npm run analytics:meter:bridge` | Meter bridge TVL (`meter-passport`) |
| **EigenLayer (Llama)** | `npm run analytics:eigenlayer:restaking` | Restaking TVL (`eigencloud`, ex-`eigenlayer`) |
| **Bitget (Llama)** | `npm run analytics:bitget:cex` | CEX reserve TVL by chain (`bitget`) |
| **Drop (Llama)** | `npm run analytics:drop:staking` | Drop liquid staking (Neutron drain, $0 TVL OK) (`drop`) |
| **THORChain DEX (Llama)** | `npm run analytics:thorchain:dex` | THORChain DEX TVL (`thorchain-dex`) |
| **Polymarket (Llama)** | `npm run analytics:polymarket:pred` | Polymarket prediction market TVL (`polymarket`) |
| **Circle (Llama)** | `npm run analytics:circle:stable` | Circle protocol TVL (`circle`) |
| **Arc Chain (Llama)** | `npm run analytics:arc:chain` | Arc (Circle L1, chainId 5042) chain TVL |
| **NEAR Intents (Llama)** | `npm run analytics:near:intents` | NEAR Intents TVL (`near-intents`) |
| **Jupiter Lend DEX (Llama)** | `npm run analytics:jupiter:lend-dex` | Jupiter Lend DEX TVL (`jupiter-lend-dex`) |
| **Gravity by Galxe (Llama)** | `npm run analytics:gravity:bridge` | Gravity bridge TVL (`gravity-by-galxe`) |
| **USD AI (Llama)** | `npm run analytics:usdai:rwa` | USD AI RWA TVL (`usd-ai`) |
| **Jupiter Lend (Llama)** | `npm run analytics:jupiter:lend` | Jupiter Lend lending TVL (`jupiter-lend`) |
| **Kuru CLOB (Llama)** | `npm run analytics:kuru:clob` | Kuru CLOB (Monad) TVL (`kuru-clob`) |
| **NAVI Lending (Llama)** | `npm run analytics:navi:lending` | NAVI Lending (Sui) TVL (`navi-lending`) |
| **PumpSwap (Llama)** | `npm run analytics:pumpswap:dex` | PumpSwap DEX TVL (`pumpswap`) |
| **Kamino Lend (Llama)** | `npm run analytics:kamino:lending` | Kamino Lend TVL (`kamino-lend`) |
| **Raydium AMM (Llama)** | `npm run analytics:raydium:dex` | Raydium AMM TVL (`raydium-amm`) |
| **DFDV Staked SOL (Llama)** | `npm run analytics:dfdv:staking` | DFDV Staked SOL TVL (`dfdv-staked-sol`) |
| **DeepBook V3 (Llama)** | `npm run analytics:deepbook:dex` | DeepBook V3 TVL (`deepbook-v3`) |
| **BisonFi (Llama)** | `npm run analytics:bisonfi:dex` | BisonFi DEX TVL (`bisonfi`) |
| **Jito (Llama)** | `npm run analytics:jito:staking` | Jito staking TVL (`jito`) |
| **Sanctum (Llama)** | `npm run analytics:sanctum:staking` | Sanctum staking TVL (`sanctum`) |
| **Payy bridge (on-chain)** | `npm run analytics:payy:bridge` | USDC `balanceOf` Payy Ethereum bridge `0x367C…5270` (needs `ETHEREUM_RPC_URL`) |

### Trending / 2026 monitors

| Script | Command | Description |
|--------|---------|-------------|
| **Unichain (quotes)** | `CHAIN=unichain npm run analytics:dex:prices` | OP Stack L2 — Uniswap V3/V4 + WETH/USDC in [`chains.js`](src/config/chains.js); set `UNICHAIN_RPC_URL` |
| **Ondo (Llama)** | `npm run analytics:ondo:markets` | Ondo Finance TVL (`ondo-finance`) |
| **BlackRock BUIDL (Llama)** | `npm run analytics:buidl:markets` | Tokenized fund TVL (`blackrock-buidl`) |
| **BUIDL supply (optional)** | `npm run analytics:buidl:supply` | ERC-20 `totalSupply` when `BUIDL_TOKEN_ADDRESS` is set |
| **Sky / Maker** | `npm run analytics:sky:rates` | DSR from Maker Pot + DefiLlama Maker & Sky rows |
| **Ethena** | `npm run analytics:ethena:monitor` | DefiLlama TVL, public mint/redeem pairs API, USDe / sUSDe `totalSupply` |
| **UniswapX** | `npm run analytics:uniswapx:activity` | Recent `Fill` events on the configured reactor (`CHAIN`, `UNISWAPX_REACTOR`, `UNISWAPX_MAX_BLOCKS`) |
| **UniswapX fill replay** | `npm run simulate:uniswapx:fill` | Chunked `Fill` log scan + `eth_call` replay at block (`UNISWAPX_REPLAY_TX`, `UNISWAPX_LOG_CHUNK`, `UNISWAPX_REPLAY_STRICT`) |

DefiLlama smoke tests: `npm run simulate:ondo:smoke`, `simulate:ethena:smoke`, `simulate:sky:smoke`, `simulate:buidl:smoke`.

### Landscape analytics (no money-legos)

Read-only boards. Social chatter for the same topics is the collective `defi-mev` scrape (`TWITTER_URLS` + `DISCORD_CHANNEL_URLS`).

| Script | Command | Description |
|--------|---------|-------------|
| **L2 overview** | `npm run analytics:l2:overview` | Live DefiLlama TVL + DEX 30d volume for Arb/OP/Base/Polygon/Scroll/zkSync/Linea/Unichain |
| **ETH DEX share** | `npm run analytics:eth:dex-share` | Ethereum venue volume: Uniswap V4 vs V3 vs 1inch Aqua vs long-tail; 7d Δ ≥ 400% marked new |
| **ETH/BTC TVL** | `npm run analytics:ethbtc:tvl` | Ethereum vs Bitcoin chain TVL for last month, this month, and this week |
| **ETH/BTC ratio** | `npm run analytics:ethbtc:ratio` | ETH vs BTC spot and ratio for the same windows (CoinGecko) |
| **ETH lending movers** | `npm run analytics:eth:lending-movers` | Ethereum lending/CDP 7d TVL Δ (Aave V4, Spark, Morpho) |
| **ETH yield / Pendle** | `npm run analytics:eth:yield` | Pendle V2 DEX volume plus Ethereum yield TVL week-up |
| **ETH TVL drivers** | `npm run analytics:eth:tvl-drivers` | Ethereum DeFi 7d $ inflow/outflow by protocol (CEX omitted) |
| **Aave mix** | `npm run analytics:eth:aave-mix` | Aave V3 vs V4 vs Horizon collateral and borrowed on Ethereum |
| **Pendle markets** | `npm run analytics:eth:pendle-markets` | Pendle chain TVL plus Ethereum PT/YT market liquidity |
| **BTC wraps** | `npm run analytics:btc:wraps` | Bitcoin wrap / restake TVL (WBTC, Babylon, Citrea, Nexus). CEX omitted |
| **BTC wrap trail** | `npm run analytics:btc:wrap-trail` | Circle Bitcoin daily TVL path vs Kraken / Babylon / Nexus |
| **RWA overview** | `npm run analytics:rwa:overview` | RWA protocol TVL (DigiFT, Huma, Ondo, BUIDL, thBill). Complements slug one-offs |
| **NFT markets** | `npm run analytics:nft:markets` | Marketplace fees + 10-collection watchlist; optional `RESERVOIR_API_KEY` floors |
| **Airdrop watch** | `npm run analytics:airdrop:watch` | Research calendar (not a claimer). Optional join to `defi-mev` `trends-report.json` |

Smokes: `simulate:l2:overview:smoke`, `simulate:eth:dex-share:smoke`, `simulate:ethbtc:tvl:smoke`, `simulate:ethbtc:ratio:smoke`, `simulate:eth:lending-movers:smoke`, `simulate:eth:yield:smoke`, `simulate:eth:tvl-drivers:smoke`, `simulate:eth:aave-mix:smoke`, `simulate:eth:pendle-markets:smoke`, `simulate:btc:wraps:smoke`, `simulate:btc:wrap-trail:smoke`, `simulate:rwa:overview:smoke`, `simulate:nft:markets:smoke`, `simulate:airdrop:watch:smoke`.

### Lending Analytics

Track lending rates and compare protocols:

| Script | Command | Description |
|--------|---------|-------------|
| **Aave Markets** | `npm run analytics:aave:markets` | Aave V3 supply/borrow rates and utilization (all configured chains) |
| **Aave Versions** | `npm run analytics:aave:versions` | Aave V2 vs V3 comparison (L1/L2 labels) |
| **Aave Liquidations** | `npm run analytics:aave:liquidations` | Recent `LiquidationCall` logs; optional `AAVE_WATCH_ADDRESSES` for health factors |
| **Morpho vs Aave** | `npm run analytics:morpho:optimizer` | Morpho Blue (API) vs Aave V3 rates per chain |
| **Nostra Finance (Llama)** | `npm run analytics:nostra:lending` | Nostra Starknet lending/money-market TVL (`nostra`) |
| **Benqi Lending (Llama)** | `npm run analytics:benqi:lending` | Avalanche lending market TVL (`benqi-lending`) |
| **Lending aggregator** | `npm run analytics:lending:rates` | Best supply/borrow across Aave + Morpho; cross-chain summary |
| **All lending (Llama)** | `npm run analytics:lending:aggregate` | Pull several lending protocols from DefiLlama in one run (Aave, Morpho, Compound, Spark, Venus, Euler, Curvance, Resolv) |
| **Compound / Venus (Llama)** | `npm run analytics:lending:venues` | BSC + L2 TVL rows for Compound V3 and Venus (`LENDING_LLAMA_CHAINS`) |
| **Spark (Llama)** | `npm run analytics:spark:lend` | Spark lending TVL snapshot (MakerDAO/Sky-aligned rates) |

### Staking (LST) analytics

| Script | Command | Description |
|--------|---------|-------------|
| **Lido** | `npm run analytics:lido:staking` | stETH APR (Lido API), TVL (DefiLlama), mainnet peg; L2 wstETH needs RPCs |
| **StakeStone** | `npm run analytics:stakestone:staking` | TVL from DefiLlama; optional `STAKESTONE_YIELDS_POOL_ID` for chart APY |
| **Kintsu** | `npm run analytics:kintsu:staking` | TVL from DefiLlama; APY from yields chart (override with `KINTSU_YIELDS_POOL_ID`) |
| **LST compare** | `npm run analytics:staking:compare` | Lido vs StakeStone vs Kintsu — heuristic score + size-band notes |
| **All staking (Llama)** | `npm run analytics:staking:aggregate` | Pull multiple LST / staking protocols from DefiLlama in one run |

### Simulation and swaps

| Command | Purpose |
|---------|---------|
| `npm run simulate:quote` / `simulate:swap` | Quote or simulate a swap (`SIMULATE_ONLY=true` for quote-only) |
| `npm run simulate:multi:quote` / `simulate:multi` | Multi-protocol quote comparison |
| `npm run simulate:dex:aerodrome:v3` / `simulate:dex:velodrome:v3` | Slipstream **reference**: Uniswap V3 quote on Base / Optimism (see [coverage doc](docs/01-protocol-script-coverage.md#aerodrome--velodrome-slipstream--reference-quotes)) |
| `npm run simulate:dex:monad:v3` | Uniswap V3 quote on Monad (`MONAD_RPC_URL`; WMON as `WETH` in `chains.js`) |
| `npm run simulate:uniswapx:fill` | UniswapX fill `eth_call` replay helper |
| `npm run simulate:morpho:fork` | Morpho Blue `market(bytes32)` read (`MORPHO_MARKET_ID` optional) |
| `npm run swap:example`, `swap:uniswap:v2`, `v3`, `v4`, `swap:sushiswap`, `swap:balancer`, `swap:curve`, `swap:aerodrome`, `swap:velodrome`, `swap:uniswapx`, `swap:autoroute`, `swap:crosschain`, `swap:check` | Example flows (`swap:aerodrome` / `swap:velodrome` = Uni V3 reference quote on that chain; see docs) |

### Other Analytics

| Script | Command | Description |
|--------|---------|-------------|
| **Weekly Blocks** | `npm run analytics:weekly:blocks` | Block-level transaction and gas analysis |


## Planned Protocols

### Established Protocols (Pre-2025)
- [x] **Uniswap** - DEX AMM [![Uniswap](https://img.shields.io/badge/Uniswap-V2%20%7C%20V3%20%7C%20V4-ff007a.svg)](https://uniswap.org)
- [x] **Lido Finance** - Liquid Staking [![Lido](https://img.shields.io/badge/Lido-00A3FF?logo=lido&logoColor=white)](https://lido.fi)
- [x] **Aave** - Lending & Borrowing [![Aave](https://img.shields.io/badge/Aave-1C202F?logo=aave&logoColor=white)](https://aave.com)
- [x] **Curve Finance** - DEX Stablecoin-Focused [![Curve](https://img.shields.io/badge/Curve-0000FF?logo=curve&logoColor=white)](https://curve.fi)
- [x] **Balancer** - DEX & Liquidity Management [![Balancer](https://img.shields.io/badge/Balancer-1E1E1E?logo=balancer&logoColor=white)](https://balancer.fi)
- [x] **Morpho** - Lending Optimizer [![Morpho](https://img.shields.io/badge/Morpho-161C3D?logoColor=white)](https://morpho.org)
- [x] **SushiSwap** - AMM DEX [![SushiSwap](https://img.shields.io/badge/SushiSwap-FA52A0?logo=sushi&logoColor=white)](https://sushi.com)

### 2025 Launched Protocols
- [x] **Reya Network** - High-Speed AMM DEX L2 [![Reya](https://img.shields.io/badge/Reya-2B2D42?logoColor=white)](https://reya.network)
- [x] **Aster DEX** - Multi-Chain AMM Perp/Spot [![Aster](https://img.shields.io/badge/Aster-7B2CBF?logoColor=white)](https://aster.finance) *(DefiLlama monitor: `npm run analytics:aster:perps`)*
- [x] **Ammalgam** - Hybrid AMM + Lending [![Ammalgam](https://img.shields.io/badge/Ammalgam-06FFA5?logoColor=black)](https://ammalgam.fi)
- [ ] **Kinto** - KYC-Modular AMM DEX [![Kinto](https://img.shields.io/badge/Kinto-000000?logoColor=white)](https://kinto.xyz)
- [x] **Curvy v2** - ZK Stealth AMM Aggregator [![Curvy](https://img.shields.io/badge/Curvy-FF6B6B?logoColor=white)](https://curvy.finance)
- [ ] **Milk Road Swap** - Gasless Multi-Chain AMM [![Milk Road](https://img.shields.io/badge/Milk_Road-FFFFFF?logoColor=black)](https://milkroad.com)
- [ ] **HumidiFi** - Prop AMM DEX [![HumidiFi](https://img.shields.io/badge/HumidiFi-4ECDC4?logoColor=white)](https://humidifi.xyz)
- [x] **Lighter** - ZK Perp AMM L2 [![Lighter](https://img.shields.io/badge/Lighter-FFD93D?logoColor=black)](https://lighter.xyz) *(DefiLlama monitor: `npm run analytics:lighter:perps`)*
- [x] **Drake Exchange** - CLOB-AMM Perp DEX [![Drake](https://img.shields.io/badge/Drake-E63946?logoColor=white)](https://drake.exchange) *(DefiLlama monitor: `npm run analytics:drake:perps`)*
- [x] **Kintsu** - Liquid Staking AMM [![Kintsu](https://img.shields.io/badge/Kintsu-F77F00?logoColor=white)](https://kintsu.xyz)
- [x] **Curvance** - Multi-Chain Isolated AMM [![Curvance](https://img.shields.io/badge/Curvance-6A4C93?logoColor=white)](https://curvance.com) *(DefiLlama slug in `simulate:lending:aggregate:smoke`)*
- [x] **Resolv Labs** - Trustless Stablecoin AMM [![Resolv](https://img.shields.io/badge/Resolv-2EC4B6?logoColor=white)](https://resolv.xyz) *(DefiLlama slug in `simulate:lending:aggregate:smoke`)*
- [x] **StakeStone** - LST AMM DEX [![StakeStone](https://img.shields.io/badge/StakeStone-8B5CF6?logoColor=white)](https://stakestone.io)
- [x] **Zama FHEVM DEX** - Privacy AMM FHE [![Zama](https://img.shields.io/badge/Zama-000000?logoColor=white)](https://zama.ai) *(DefiLlama monitor: `npm run analytics:zama:privacy`)*
- [ ] **Aztec Ignition DEX** - Decentralized Privacy AMM L2 [![Aztec](https://img.shields.io/badge/Aztec-1E1E1E?logoColor=white)](https://aztec.network)
- [ ] **Monad AMM (Native)** - EVM-Compatible AMM L1 [![Monad](https://img.shields.io/badge/Monad-9333EA?logoColor=white)](https://monad.xyz)
- [ ] **Base Liquidity AMM (AERO Fork)** - Base Ecosystem AMM [![Base](https://img.shields.io/badge/Base-0052FF?logo=base&logoColor=white)](https://base.org)
- [x] **Morpho Base AMM** - Lending-Optimized AMM [![Morpho](https://img.shields.io/badge/Morpho-161C3D?logoColor=white)](https://morpho.org) *(same Morpho / lending stack as above)*
- [ ] **Soneium DEX** - Enterprise AMM L2 [![Soneium](https://img.shields.io/badge/Soneium-00D4FF?logoColor=white)](https://soneium.org)
- [ ] **MegaETH AMM** - High-Perf AMM L2 [![MegaETH](https://img.shields.io/badge/MegaETH-FF6B35?logoColor=white)](https://megaeth.systems)

### Trending 2026

- [x] **UniswapX** — Intent / Dutch-style orders (settles on existing chains) [![Uniswap](https://img.shields.io/badge/UniswapX-ff007a?logoColor=white)](https://docs.uniswap.org/contracts/uniswapx/overview) *(`npm run analytics:uniswapx:activity`)*
- [x] **Ondo Global Markets** — Tokenized securities / yield [![Ondo](https://img.shields.io/badge/Ondo-1A1A2E?logoColor=white)](https://ondo.finance) *(`npm run analytics:ondo:markets`)*
- [x] **BlackRock BUIDL** — Tokenized fund (e.g. ERC-20) [![BUIDL](https://img.shields.io/badge/BUIDL-000000?logoColor=white)](https://www.blackrock.com) *(`analytics:buidl:markets`, optional `analytics:buidl:supply`)*
- [x] **Sky (ex-Maker)** — Stablecoin / DSR / lending [![Sky](https://img.shields.io/badge/Sky-1E88E5?logoColor=white)](https://sky.money) *(`npm run analytics:sky:rates`)*
- [x] **Ethena** — USDe / minting [![Ethena](https://img.shields.io/badge/Ethena-111111?logoColor=white)](https://ethena.fi) *(`npm run analytics:ethena:monitor`)*
- [x] **Nostra Finance** — Starknet lending/money-market [![Nostra](https://img.shields.io/badge/Nostra-FF6B00?logoColor=white)](https://nostra.finance) *(`npm run analytics:nostra:lending`)*
- [x] **Suilend** — Sui lending protocol [![Suilend](https://img.shields.io/badge/Suilend-4DA2FF?logoColor=white)](https://suilend.fi) *(DefiLlama monitor: `npm run analytics:suilend:lending`)*
- [x] **Rhea Finance** — NEAR DEX + lending + LST [![Rhea](https://img.shields.io/badge/Rhea-00C08B?logoColor=white)](https://www.rhea.finance) *(DefiLlama monitors: `npm run analytics:rhea:defi`, `npm run analytics:rhea:lending`)*
- [x] **Stargate Finance** — LayerZero bridge (STG→ZRO migration) [![Stargate](https://img.shields.io/badge/Stargate-999999?logoColor=white)](https://stargate.finance) *(DefiLlama monitors: `npm run analytics:stargate:bridge`, `npm run analytics:stargate:v2`)*
- [x] **Benqi Lending** — Avalanche lending market [![Benqi](https://img.shields.io/badge/Benqi-00B3FF?logoColor=white)](https://benqi.fi) *(DefiLlama monitor: `npm run analytics:benqi:lending`)*
- [x] **EigenLayer / EigenCloud** — Ethereum restaking [![EigenLayer](https://img.shields.io/badge/EigenLayer-1A0C6D?logoColor=white)](https://www.eigenlayer.xyz) *(DefiLlama monitor: `npm run analytics:eigenlayer:restaking`)*
- [x] **Astroport** — Cosmos DEX (Neutron governance exploit, 2026-09-22) [![Astroport](https://img.shields.io/badge/Astroport-5A3FFF?logoColor=white)](https://astroport.fi) *(DefiLlama monitor: `npm run analytics:astroport:dex`)*
- [x] **Meter Passport** — Bridge (unbacked wMTRG mint, 2026-09-23) [![Meter](https://img.shields.io/badge/Meter-2F80ED?logoColor=white)](https://meter.io) *(DefiLlama monitor: `npm run analytics:meter:bridge`)*
- [x] **Bitget** — CEX reserves (hot-wallet incident, 2026-09-24) [![Bitget](https://img.shields.io/badge/Bitget-00F0FF?logoColor=black)](https://www.bitget.com) *(DefiLlama monitor: `npm run analytics:bitget:cex`)*
- [x] **Drop** — Neutron Prop 9 governance attack emptied Astroport and Drop contracts (~$9.4M per Rarma) on 2026-09-22 ([Altcoin Buzz](https://www.altcoinbuzz.io/cosmos-hub-moves-2-1m-of-stolen-atom-after-25-hour-halt), 2026-09-23); Llama TVL is $0 [![Drop](https://img.shields.io/badge/Drop-5B21B6?logoColor=white)](https://drop.money) *(DefiLlama monitor: `npm run analytics:drop:staking`)*
- [x] **THORChain DEX** — ~500k stolen ATOM swapped through THORChain; 168,990.9 ATOM refunded to the attacker after the Hub restart ([Cosmos forum](https://forum.cosmos.network/t/neutron-governance-attack-cosmos-hub-response-and-recovery-update/17369); [CryptoSlate](https://cryptoslate.com/cosmos-restarted-to-seize-2-2-million-in-stolen-atom-but-169000-tokens-still-escaped/), 2026-09-24) [![THORChain](https://img.shields.io/badge/THORChain-00CCBB?logoColor=white)](https://thorchain.org) *(DefiLlama monitor: `npm run analytics:thorchain:dex`)*
- [x] **Polymarket** — Polymarket U.S. just over $1.03B notional volume on the Sep 19-20 weekend ([SCCG](https://sccgmanagement.com/sccg-articles/2026/09/23/kalshi-crypto-volume-allegations-emerge-against-backdrop-of-764-billion-prediction-market-record/), 2026-09-23); the Llama slug tracks the international book [![Polymarket](https://img.shields.io/badge/Polymarket-6366F1?logoColor=white)](https://polymarket.com) *(DefiLlama monitor: `npm run analytics:polymarket:pred`)*
- [x] **Circle / Arc** — Arc DeFi TVL $494M, +44.52% 7d, 10 days after mainnet ([TokenPost](https://www.tokenpost.com/news/technology/24382), 2026-09-26); Circle 24h revenue $7.35M per DefiLlama ([BlockBeats](https://en.theblockbeats.news/flash/369146), 2026-09-26) [![Circle](https://img.shields.io/badge/Circle-3E73C4?logoColor=white)](https://circle.com) *(DefiLlama monitors: `npm run analytics:circle:stable`, `npm run analytics:arc:chain`)*
- [x] **NEAR Intents** — NEAR Intents passed ~$31.4B cumulative volume ([Bitinsider](https://bitinsider.io/articles/near-protocol-intents-surpass-30b-in-all-time-volume-as-daily-records-fall), 2026-09-22) [![NEAR](https://img.shields.io/badge/NEAR-000000?logoColor=white)](https://near.org) *(DefiLlama monitor: `npm run analytics:near:intents`)*
- [x] **Jupiter Lend DEX** — Jupiter Earn to seed $10M of sUSDai DEX liquidity on the Jupiter Lend AMM ([Altcoin Buzz](https://www.altcoinbuzz.io/kamino-opens-usdc-borrowing-against-gpu-loan-yields-on-solana), 2026-09-25) [![Jupiter](https://img.shields.io/badge/Jupiter-19FB9B?logoColor=black)](https://jup.ag) *(DefiLlama monitor: `npm run analytics:jupiter:lend-dex`)*
- [x] **Gravity by Galxe** — $G cross-exchange spread hit 40% on bridge limits ([GetChain](https://www.getchainnews.com/en/newflash/E6KkDYb68k), 2026-09-20); Fast Withdraw cut Alpha Mainnet to Ethereum settlement from 7 days to ~10 min ([TradingView](https://www.tradingview.com/news/coinmarketcal:61ad0b705094b:0-gravity-by-galxe-fast-withdraw-goes-live-for-g-bridge-transfers-to-ethereum-20-sep-2026/), 2026-09-20) [![Gravity](https://img.shields.io/badge/Gravity-5865F2?logoColor=white)](https://gravity.xyz) *(DefiLlama monitor: `npm run analytics:gravity:bridge`)*
- [x] **USD AI** — $128.9M GPU financing facility, its largest to date ([PR Newswire](https://www.prnewswire.com/news-releases/usdai-announces-128-9m-gpu-financing-facility-its-largest-to-date-302888224.html), 2026-09-23) [![USDAI](https://img.shields.io/badge/USD_AI-1E88E5?logoColor=white)](https://usdai.money) *(DefiLlama monitor: `npm run analytics:usdai:rwa`)*
- [x] **Jupiter Lend** — record $2.41B total deposits on 2026-09-22 ([Solana Compass](https://solanacompass.com/news/jupiter-perps-adds-six-markets-including-tokenized-spacex-hype-and-zec-via-gum-orderbook), 2026-09-22) [![Jupiter](https://img.shields.io/badge/Jupiter-19FB9B?logoColor=black)](https://jup.ag) *(DefiLlama monitor: `npm run analytics:jupiter:lend`)*
- [x] **Kuru CLOB** — Kuru cumulative trading volume passed $7B on Monad ([TokenPost](https://www.tokenpost.com/news/investing/24062), 2026-09-25) [![Kuru](https://img.shields.io/badge/Kuru-9333EA?logoColor=white)](https://kuru.io) *(DefiLlama monitor: `npm run analytics:kuru:clob`)*
- [x] **NAVI Lending** — NAVI held >$420M of deposits in Sui's $1.21B TVL snapshot of 2026-09-22 ([Bitcoinist](https://bitcoinist.com/sui-tvl-moves-above-1-2b-as-defi-liquidity-expands/), 2026-09-24) [![NAVI](https://img.shields.io/badge/NAVI-4DA2FF?logoColor=white)](https://naviprotocol.io) *(DefiLlama monitor: `npm run analytics:navi:lending`)*
- [x] **PumpSwap** — ~$482.79M 24h volume, ~17% of Solana's $2.80B DEX volume ([The Chain Observer](https://thechainobserver.com/solana-dex-volume-reaches-2-8b/), 2026-09-22 snapshot) [![PumpSwap](https://img.shields.io/badge/PumpSwap-14F195?logoColor=black)](https://pumpswap.io) *(DefiLlama monitor: `npm run analytics:pumpswap:dex`)*
- [x] **Kamino Lend** — sUSDai/USDC market opened at 80% max LTV, 85% liquidation LTV, 5M supply/borrow caps ([Altcoin Buzz](https://www.altcoinbuzz.io/kamino-opens-usdc-borrowing-against-gpu-loan-yields-on-solana), 2026-09-25) [![Kamino](https://img.shields.io/badge/Kamino-00CCBB?logoColor=white)](https://kamino.finance) *(DefiLlama monitor: `npm run analytics:kamino:lending`)*
- [x] **Raydium AMM** — Raydium TVL $1.26B; handled $1.713B (64%) of StonkFun's $2.67B volume ([KuCoin](https://www.kucoin.com/news/flash/ray-gains-10-as-raydium-captures-64-of-stonkfun-volume), 2026-09-22) [![Raydium](https://img.shields.io/badge/Raydium-C042FF?logoColor=white)](https://raydium.io) *(DefiLlama monitor: `npm run analytics:raydium:dex`)*
- [x] **DFDV Staked SOL** — DFDV added 101,381 SOL in a week to ~2,490,304 SOL, deployed via its staking/validator stack ([KuCoin / The Coin Republic](https://www.kucoin.com/news/flash/dfdv-adds-101-381-sol-to-treasury-as-sol-price-surpasses-116), 2026-09-22) [![DFDV](https://img.shields.io/badge/DFDV-14F195?logoColor=black)](https://dfdv.com) *(DefiLlama monitor: `npm run analytics:dfdv:staking`)*
- [x] **DeepBook V3** — DeepBook App launched on the order book behind $20B+ of Sui volume ([Sui blog](https://www.sui.io/blog/deepbook-app-is-live-onchain-power-for-serious-traders); [TradingView](https://www.tradingview.com/news/coinmarketcal:e0ad19724094b:0-deepbook-alpha-app-goes-live-with-spot-trading-btc-prediction-markets-and-api-24-sep-2026/), 2026-09-24) [![DeepBook](https://img.shields.io/badge/DeepBook-4DA2FF?logoColor=white)](https://deepbook.tech) *(DefiLlama monitor: `npm run analytics:deepbook:dex`)*
- [x] **BisonFi** — ~$424.26M 24h volume ([The Chain Observer](https://thechainobserver.com/solana-dex-volume-reaches-2-8b/), 2026-09-22); top Solana AMM by volume for 25 straight weeks ([Gate News](https://www.gate.com/news/detail/SOL/bisonfi-dominates-solana-amm-market-for-25-consecutive-weeks-24501218), 2026-09-23) [![BisonFi](https://img.shields.io/badge/BisonFi-14F195?logoColor=black)](https://bisonfi.io) *(DefiLlama monitor: `npm run analytics:bisonfi:dex`)*
- [x] **Jito** — Jito pool held 10.38M SOL vs 7.96M JitoSOL supply at epoch 1042 ([Solana Compass](https://solanacompass.com/news/sec-staff-faq-says-staking-receipt-tokens-can-be-digital-commodities-jito), 2026-09-25) [![Jito](https://img.shields.io/badge/Jito-14F195?logoColor=black)](https://jito.network) *(DefiLlama monitor: `npm run analytics:jito:staking`)*
- [x] **Sanctum** — CLOUD-008 passed: 259M CLOUD burned, total supply 1B to ~741M; TVL $2.05B ([Solana Compass](https://solanacompass.com/news/sanctum-governance-vote-passes-259m-cloud-tokens-to-be-burned-ticker-renames-to-sanc), 2026-09-19 19:35 UTC = 2026-09-20 UTC+8) [![Sanctum](https://img.shields.io/badge/Sanctum-14F195?logoColor=black)](https://sanctum.so) *(DefiLlama monitor: `npm run analytics:sanctum:staking`)*
- [x] **Payy Network** — Ethereum ZK payments rollup bridge (drained 2026-09-24) [![Payy](https://img.shields.io/badge/Payy-C6FF00?logoColor=black)](https://payy.network) *(on-chain USDC balance: `npm run analytics:payy:bridge`)*

## Contributing

Contributions are welcome! Please follow these guidelines:

**Code Guidelines:**
- Follow existing code structure and style
- Add JSDoc comments for functions
- Run `npm run prettier` before committing
- Test with fork tests when applicable

**Submitting:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request with clear description

**Security:** Never commit private keys or `.env` files.

## License
MIT
