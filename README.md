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
| **Bitget SOL (Llama)** | `npm run analytics:bitget:sol` | Bitget SOL LST TVL (`bitget-sol`) |
| **Drop (Llama)** | `npm run analytics:drop:staking` | Drop liquid staking (Neutron drain, $0 TVL OK) (`drop`) |
| **THORChain DEX (Llama)** | `npm run analytics:thorchain:dex` | THORChain DEX TVL (`thorchain-dex`) |
| **Polymarket (Llama)** | `npm run analytics:polymarket:pred` | Polymarket prediction market TVL (`polymarket`) |
| **Circle (Llama)** | `npm run analytics:circle:stable` | Circle protocol TVL (`circle`) |
| **Arc Chain (Llama)** | `npm run analytics:arc:chain` | Arc (Circle L1, chainId 5042) chain TVL |
| **NEAR Intents (Llama)** | `npm run analytics:near:intents` | NEAR Intents TVL (`near-intents`) |
| **NEAR Bridge (Llama)** | `npm run analytics:near:bridge` | NEAR Bridge TVL (`near-bridge`) |
| **Jupiter Lend DEX (Llama)** | `npm run analytics:jupiter:lend-dex` | Jupiter Lend DEX TVL (`jupiter-lend-dex`) |
| **Fables (Llama)** | `npm run analytics:fables:dex` | Fables DEX TVL (`fables`) |
| **Stellar DeFi Hub (Llama)** | `npm run analytics:stellar:hub` | Stellar DeFi Hub TVL (`stellar-defi-hub`) |
| **Gravity by Galxe (Llama)** | `npm run analytics:gravity:bridge` | Gravity bridge TVL (`gravity-by-galxe`) |
| **Lisk Bridge (Llama)** | `npm run analytics:lisk:bridge` | Lisk bridge TVL (`lisk-bridge`) |
| **Haedal Protocol (Llama)** | `npm run analytics:haedal:staking` | Haedal liquid staking TVL (`haedal-protocol`) |
| **Meta Pool Near (Llama)** | `npm run analytics:metapool:near` | Meta Pool Near LST TVL (`meta-pool-near`) |
| **RHEA LST (Llama)** | `npm run analytics:rhea:lst` | Rhea liquid staking TVL (`rhea-lst`) |
| **Volo LST (Llama)** | `npm run analytics:volo:staking` | Volo LST TVL (`volo-lst`) |
| **LiNEAR Protocol (Llama)** | `npm run analytics:linear:staking` | LiNEAR liquid staking TVL (`linear-protocol`) |
| **Rhea Dex (Llama)** | `npm run analytics:rhea:dex` | Rhea DEX TVL (`rhea-dex`) |
| **vfat.io (Llama)** | `npm run analytics:vfat:yield` | vfat.io yield aggregator TVL (`vfat.io`) |
| **Unit (Llama)** | `npm run analytics:unit:bridge` | Unit bridge TVL (`unit`) |
| **40 Acres (Llama)** | `npm run analytics:40acres:lending` | 40 Acres lending TVL (`40-acres`) |
| **USD AI (Llama)** | `npm run analytics:usdai:rwa` | USD AI RWA TVL (`usd-ai`) |
| **Current (Llama)** | `npm run analytics:current:lending` | Current lending TVL (`current`) |
| **Jupiter Lend (Llama)** | `npm run analytics:jupiter:lend` | Jupiter Lend lending TVL (`jupiter-lend`) |
| **Kuru CLOB (Llama)** | `npm run analytics:kuru:clob` | Kuru CLOB (Monad) TVL (`kuru-clob`) |
| **Maple (Llama)** | `npm run analytics:maple:lending` | Maple lending TVL (`maple`) |
| **NAVI Lending (Llama)** | `npm run analytics:navi:lending` | NAVI Lending (Sui) TVL (`navi-lending`) |
| **HyperLend (Llama)** | `npm run analytics:hyperlend:lending` | HyperLend Pooled TVL (`hyperlend-pooled`) |
| **PumpSwap (Llama)** | `npm run analytics:pumpswap:dex` | PumpSwap DEX TVL (`pumpswap`) |
| **Orca DEX (Llama)** | `npm run analytics:orca:dex` | Orca DEX TVL (`orca-dex`) |
| **Portal (Llama)** | `npm run analytics:portal:bridge` | Portal (Wormhole) bridge TVL (`portal`) |
| **Kamino Lend (Llama)** | `npm run analytics:kamino:lending` | Kamino Lend TVL (`kamino-lend`) |
| **Fluid Lending (Llama)** | `npm run analytics:fluid:lending` | Fluid Lending TVL (`fluid-lending`) |
| **Raydium AMM (Llama)** | `npm run analytics:raydium:dex` | Raydium AMM TVL (`raydium-amm`) |
| **Meteora DLMM (Llama)** | `npm run analytics:meteora:dex` | Meteora DLMM TVL (`meteora-dlmm`) |
| **World Chain (Llama)** | `npm run analytics:worldchain:bridge` | World Chain bridge TVL (`world-chain`) |
| **Backpack (Llama)** | `npm run analytics:backpack:cex` | Backpack CEX TVL (`backpack`) |
| **Bittensor dTAO (Llama)** | `npm run analytics:bittensor:dtao` | Bittensor dTAO TVL (`bittensor-dtao`) |
| **cap (Llama)** | `npm run analytics:cap:lending` | cap lending TVL (`cap`) |
| **SpringSui (Llama)** | `npm run analytics:springsui:staking` | SpringSui staking TVL (`springsui`) |
| **DFDV Staked SOL (Llama)** | `npm run analytics:dfdv:staking` | DFDV Staked SOL TVL (`dfdv-staked-sol`) |
| **Cetus CLMM (Llama)** | `npm run analytics:cetus:dex` | Cetus CLMM TVL (`cetus-clmm`) |
| **Bluefin Spot (Llama)** | `npm run analytics:bluefin:dex` | Bluefin Spot TVL (`bluefin-spot`) |
| **DeepBook V3 (Llama)** | `npm run analytics:deepbook:dex` | DeepBook V3 TVL (`deepbook-v3`) |
| **Chainflip AMM (Llama)** | `npm run analytics:chainflip:dex` | Chainflip AMM TVL (`chainflip-amm`) |
| **Dexalot DEX (Llama)** | `npm run analytics:dexalot:dex` | Dexalot DEX TVL (`dexalot-dex`) |
| **Scorch (Llama)** | `npm run analytics:scorch:dex` | Scorch DEX TVL (`scorch`) |
| **BisonFi (Llama)** | `npm run analytics:bisonfi:dex` | BisonFi DEX TVL (`bisonfi`) |
| **Manifest Trade (Llama)** | `npm run analytics:manifest:dex` | Manifest Trade TVL (`manifest-trade`) |
| **Pharaoh DLMM (Llama)** | `npm run analytics:pharaoh:dex` | Pharaoh DLMM TVL (`pharaoh-dlmm`) |
| **AO Bridge (Llama)** | `npm run analytics:ao:bridge` | AO Bridge TVL (`ao-bridge`) |
| **Sonic Gateway (Llama)** | `npm run analytics:sonic:bridge` | Sonic Gateway TVL (`sonic-gateway`) |
| **Hylo Protocol (Llama)** | `npm run analytics:hylo:stable` | Hylo Protocol stablecoin TVL (`hylo-protocol`) |
| **Contango V2 (Llama)** | `npm run analytics:contango:perps` | Contango V2 derivatives TVL (`contango-v2`) |
| **Liquid Collective (Llama)** | `npm run analytics:liquidcollective:staking` | Liquid Collective staking TVL (`liquid-collective`) |
| **Steakhouse Financial (Llama)** | `npm run analytics:steakhouse:curator` | Steakhouse Financial curator TVL (`steakhouse-financial`) |
| **Frankencoin (Llama)** | `npm run analytics:frankencoin:cdp` | Frankencoin CDP TVL (`frankencoin`) |
| **Rysk V12 (Llama)** | `npm run analytics:rysk:options` | Rysk V12 options TVL (`rysk-v12`) |
| **Galaxy Curation (Llama)** | `npm run analytics:galaxy:curator` | Galaxy Curation TVL (`galaxy-curation`) |
| **Drift (Llama)** | `npm run analytics:drift:perps` | Drift perps TVL (`drift`) |
| **Jito (Llama)** | `npm run analytics:jito:staking` | Jito staking TVL (`jito`) |
| **Marinade (Llama)** | `npm run analytics:marinade:staking` | Marinade staking TVL (`marinade`) |
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
- [x] **Bitget SOL** — Bitget SOL LST (sibling to Bitget CEX; 7d +35.5%, distinct from CEX) [![Bitget](https://img.shields.io/badge/Bitget_SOL-00F0FF?logoColor=black)](https://www.bitget.com) *(DefiLlama monitor: `npm run analytics:bitget:sol`)*
- [x] **Drop** — Liquid staking (Neutron governance exploit drain, 2026-09-22; TVL $0) [![Drop](https://img.shields.io/badge/Drop-5B21B6?logoColor=white)](https://drop.money) *(DefiLlama monitor: `npm run analytics:drop:staking`)*
- [x] **THORChain DEX** — Cross-chain DEX (routed stolen ATOM; 7d +21.7% TVL $71.9M) [![THORChain](https://img.shields.io/badge/THORChain-00CCBB?logoColor=white)](https://thorchain.org) *(DefiLlama monitor: `npm run analytics:thorchain:dex`)*
- [x] **Polymarket** — Prediction market (TVL ~$358M; unofficial $POLY airdrop chatter) [![Polymarket](https://img.shields.io/badge/Polymarket-6366F1?logoColor=white)](https://polymarket.com) *(DefiLlama monitor: `npm run analytics:polymarket:pred`)*
- [x] **Circle / Arc** — Circle protocol + Arc L1 (chainId 5042; $504M chain TVL, $68M protocol) [![Circle](https://img.shields.io/badge/Circle-3E73C4?logoColor=white)](https://circle.com) *(DefiLlama monitors: `npm run analytics:circle:stable`, `npm run analytics:arc:chain`)*
- [x] **NEAR Intents / NEAR Bridge** — NEAR Intents 7d +50.9% $255M; NEAR Bridge 7d +84.4% $128M [![NEAR](https://img.shields.io/badge/NEAR-000000?logoColor=white)](https://near.org) *(DefiLlama monitors: `npm run analytics:near:intents`, `npm run analytics:near:bridge`)*
- [x] **Jupiter Lend DEX** — Jupiter Lend DEX 7d +108% TVL $23.3M [![Jupiter](https://img.shields.io/badge/Jupiter-19FB9B?logoColor=black)](https://jup.ag) *(DefiLlama monitor: `npm run analytics:jupiter:lend-dex`)*
- [x] **Fables** — Robinhood Chain DEX 7d +74.9% TVL $50.7M [![Fables](https://img.shields.io/badge/Fables-00D4AA?logoColor=black)](https://fables.market) *(DefiLlama monitor: `npm run analytics:fables:dex`)*
- [x] **Stellar DeFi Hub** — Stellar DeFi Hub 7d +62.8% TVL $57.3M [![Stellar](https://img.shields.io/badge/Stellar-7D00FF?logoColor=white)](https://stellar.org) *(DefiLlama monitor: `npm run analytics:stellar:hub`)*
- [x] **Gravity by Galxe** — Gravity bridge 7d -54.5% TVL $32.2M [![Gravity](https://img.shields.io/badge/Gravity-5865F2?logoColor=white)](https://gravity.xyz) *(DefiLlama monitor: `npm run analytics:gravity:bridge`)*
- [x] **Lisk Bridge** — Lisk bridge 7d -45.1% TVL $44.9M [![Lisk](https://img.shields.io/badge/Lisk-1A6EAA?logoColor=white)](https://lisk.com) *(DefiLlama monitor: `npm run analytics:lisk:bridge`)*
- [x] **Haedal Protocol** — Liquid staking 7d +41.7% TVL $44.1M [![Haedal](https://img.shields.io/badge/Haedal-FF6B00?logoColor=white)](https://haedal.xyz) *(DefiLlama monitor: `npm run analytics:haedal:staking`)*
- [x] **Meta Pool Near** — NEAR LST 7d +40% TVL $124.4M [![MetaPool](https://img.shields.io/badge/MetaPool-00DC82?logoColor=black)](https://metapool.app) *(DefiLlama monitor: `npm run analytics:metapool:near`)*
- [x] **RHEA LST** — Rhea liquid staking 7d +39.4% TVL $43.3M [![RHEA](https://img.shields.io/badge/RHEA-00C08B?logoColor=white)](https://www.rhea.finance) *(DefiLlama monitor: `npm run analytics:rhea:lst`)*
- [x] **Volo LST** — Volo LST 7d +39% TVL $26.6M [![Volo](https://img.shields.io/badge/Volo-8B5CF6?logoColor=white)](https://volo.fi) *(DefiLlama monitor: `npm run analytics:volo:staking`)*
- [x] **LiNEAR Protocol** — NEAR LST 7d +38.6% TVL $120.8M [![LiNEAR](https://img.shields.io/badge/LiNEAR-00D4AA?logoColor=black)](https://linearprotocol.org) *(DefiLlama monitor: `npm run analytics:linear:staking`)*
- [x] **Rhea Dex** — Rhea DEX 7d -31.2% TVL $29.5M (sibling to Rhea LST) [![RHEA](https://img.shields.io/badge/RHEA_DEX-00C08B?logoColor=white)](https://www.rhea.finance) *(DefiLlama monitor: `npm run analytics:rhea:dex`)*
- [x] **vfat.io** — Yield aggregator 7d +33.7% TVL $38.7M [![vfat](https://img.shields.io/badge/vfat.io-000000?logoColor=white)](https://vfat.io) *(DefiLlama monitor: `npm run analytics:vfat:yield`)*
- [x] **Unit** — Bridge 7d +31.9% TVL $1.08B [![Unit](https://img.shields.io/badge/Unit-FF6B35?logoColor=white)](https://unit.network) *(DefiLlama monitor: `npm run analytics:unit:bridge`)*
- [x] **40 Acres** — Lending 7d +30.4% TVL $54.4M [![40Acres](https://img.shields.io/badge/40_Acres-8B4513?logoColor=white)](https://40acres.xyz) *(DefiLlama monitor: `npm run analytics:40acres:lending`)*
- [x] **USD AI** — RWA 7d -30.1% TVL $214.9M [![USDAI](https://img.shields.io/badge/USD_AI-1E88E5?logoColor=white)](https://usdai.money) *(DefiLlama monitor: `npm run analytics:usdai:rwa`)*
- [x] **Current** — Lending 7d +25.4% TVL $54.4M [![Current](https://img.shields.io/badge/Current-00B4D8?logoColor=white)](https://current.tech) *(DefiLlama monitor: `npm run analytics:current:lending`)*
- [x] **Jupiter Lend** — Jupiter Lend lending $1.18B TVL [![Jupiter](https://img.shields.io/badge/Jupiter-19FB9B?logoColor=black)](https://jup.ag) *(DefiLlama monitor: `npm run analytics:jupiter:lend`)*
- [x] **Kuru CLOB** — Monad CLOB vol24 $143.9M, 7d chg +489.6% [![Kuru](https://img.shields.io/badge/Kuru-9333EA?logoColor=white)](https://kuru.io) *(DefiLlama monitor: `npm run analytics:kuru:clob`)*
- [x] **Maple** — Lending TVL $3.00B, fees24 $1.11M [![Maple](https://img.shields.io/badge/Maple-8B5CF6?logoColor=white)](https://maple.finance) *(DefiLlama monitor: `npm run analytics:maple:lending`)*
- [x] **NAVI Lending** — Sui lending TVL $176.6M, 7d +19.61% [![NAVI](https://img.shields.io/badge/NAVI-4DA2FF?logoColor=white)](https://naviprotocol.io) *(DefiLlama monitor: `npm run analytics:navi:lending`)*
- [x] **HyperLend** — Hyperliquid L1 lending TVL $430.9M [![HyperLend](https://img.shields.io/badge/HyperLend-5865F2?logoColor=white)](https://hyperlend.finance) *(DefiLlama monitor: `npm run analytics:hyperlend:lending`)*
- [x] **PumpSwap** — Solana DEX vol24 $426.0M, fees24 $5.59M [![PumpSwap](https://img.shields.io/badge/PumpSwap-14F195?logoColor=black)](https://pumpswap.io) *(DefiLlama monitor: `npm run analytics:pumpswap:dex`)*
- [x] **Orca DEX** — Solana DEX vol24 $230.8M, 7d chg +62.95% [![Orca](https://img.shields.io/badge/Orca-FFD15C?logoColor=black)](https://orca.so) *(DefiLlama monitor: `npm run analytics:orca:dex`)*
- [x] **Portal** — Wormhole bridge TVL $1.87B, 7d +17.01% [![Portal](https://img.shields.io/badge/Portal-999999?logoColor=white)](https://portalbridge.com) *(DefiLlama monitor: `npm run analytics:portal:bridge`)*
- [x] **Kamino Lend** — Solana lending TVL $1.46B, 7d +5.82% [![Kamino](https://img.shields.io/badge/Kamino-00CCBB?logoColor=white)](https://kamino.finance) *(DefiLlama monitor: `npm run analytics:kamino:lending`)*
- [x] **Fluid Lending** — Lending TVL $734.7M (new metric vs Fluid DEX) [![Fluid](https://img.shields.io/badge/Fluid-1E88E5?logoColor=white)](https://fluid.instadapp.io) *(DefiLlama monitor: `npm run analytics:fluid:lending`)*
- [x] **Raydium AMM** — Solana DEX TVL $1.36B, vol24 $199.0M [![Raydium](https://img.shields.io/badge/Raydium-C042FF?logoColor=white)](https://raydium.io) *(DefiLlama monitor: `npm run analytics:raydium:dex`)*
- [x] **Meteora DLMM** — Solana DEX vol24 $204.6M, TVL $189.6M [![Meteora](https://img.shields.io/badge/Meteora-8B5CF6?logoColor=white)](https://meteora.ag) *(DefiLlama monitor: `npm run analytics:meteora:dex`)*
- [x] **World Chain** — Bridge TVL $474.4M, 7d +19.09% [![WorldChain](https://img.shields.io/badge/World_Chain-000000?logoColor=white)](https://worldchain.org) *(DefiLlama monitor: `npm run analytics:worldchain:bridge`)*
- [x] **Backpack** — CEX TVL $633.5M, 7d +31.61% [![Backpack](https://img.shields.io/badge/Backpack-FF6B35?logoColor=white)](https://backpack.exchange) *(DefiLlama monitor: `npm run analytics:backpack:cex`)*
- [x] **Bittensor dTAO** — TVL $568.5M, 7d +21.59% [![Bittensor](https://img.shields.io/badge/Bittensor-000000?logoColor=white)](https://bittensor.com) *(DefiLlama monitor: `npm run analytics:bittensor:dtao`)*
- [x] **cap** — Lending TVL $291.7M [![cap](https://img.shields.io/badge/cap-1A1A2E?logoColor=white)](https://cap.xyz) *(DefiLlama monitor: `npm run analytics:cap:lending`)*
- [x] **SpringSui** — Sui staking TVL $74.2M, 7d +22.04% [![SpringSui](https://img.shields.io/badge/SpringSui-4DA2FF?logoColor=white)](https://springsui.io) *(DefiLlama monitor: `npm run analytics:springsui:staking`)*
- [x] **DFDV Staked SOL** — Solana LST TVL $218.7M, 7d +24.78% [![DFDV](https://img.shields.io/badge/DFDV-14F195?logoColor=black)](https://dfdv.com) *(DefiLlama monitor: `npm run analytics:dfdv:staking`)*
- [x] **Cetus CLMM** — Sui DEX vol 7d chg +150.54% [![Cetus](https://img.shields.io/badge/Cetus-4DA2FF?logoColor=white)](https://cetus.zone) *(DefiLlama monitor: `npm run analytics:cetus:dex`)*
- [x] **Bluefin Spot** — Sui DEX vol 7d chg +149.76% [![Bluefin](https://img.shields.io/badge/Bluefin-5B21B6?logoColor=white)](https://bluefin.io) *(DefiLlama monitor: `npm run analytics:bluefin:dex`)*
- [x] **DeepBook V3** — Sui DEX vol 7d chg +141.27% [![DeepBook](https://img.shields.io/badge/DeepBook-4DA2FF?logoColor=white)](https://deepbook.tech) *(DefiLlama monitor: `npm run analytics:deepbook:dex`)*
- [x] **Chainflip AMM** — Cross-chain DEX vol 7d chg +148.17% [![Chainflip](https://img.shields.io/badge/Chainflip-00D4AA?logoColor=black)](https://chainflip.io) *(DefiLlama monitor: `npm run analytics:chainflip:dex`)*
- [x] **Dexalot DEX** — Multi-chain DEX vol24 $123.1M [![Dexalot](https://img.shields.io/badge/Dexalot-FF6B00?logoColor=white)](https://dexalot.com) *(DefiLlama monitor: `npm run analytics:dexalot:dex`)*
- [x] **Scorch** — Solana DEX vol24 $97.4M, 7d chg +58.21% [![Scorch](https://img.shields.io/badge/Scorch-14F195?logoColor=black)](https://scorch.io) *(DefiLlama monitor: `npm run analytics:scorch:dex`)*
- [x] **BisonFi** — Solana DEX vol24 $327.8M [![BisonFi](https://img.shields.io/badge/BisonFi-14F195?logoColor=black)](https://bisonfi.io) *(DefiLlama monitor: `npm run analytics:bisonfi:dex`)*
- [x] **Manifest Trade** — Solana DEX vol24 $128.4M [![Manifest](https://img.shields.io/badge/Manifest-14F195?logoColor=black)](https://manifest.trade) *(DefiLlama monitor: `npm run analytics:manifest:dex`)*
- [x] **Pharaoh DLMM** — Avalanche DEX vol 7d chg +72.93% [![Pharaoh](https://img.shields.io/badge/Pharaoh-E84142?logoColor=white)](https://pharaoh.exchange) *(DefiLlama monitor: `npm run analytics:pharaoh:dex`)*
- [x] **AO Bridge** — Bridge TVL $91.4M, 7d +29.68% [![AO](https://img.shields.io/badge/AO-000000?logoColor=white)](https://ao.arweave.dev) *(DefiLlama monitor: `npm run analytics:ao:bridge`)*
- [x] **Sonic Gateway** — Bridge TVL $59.5M, 7d +17.35% [![Sonic](https://img.shields.io/badge/Sonic-0052FF?logoColor=white)](https://soniclabs.com) *(DefiLlama monitor: `npm run analytics:sonic:bridge`)*
- [x] **Hylo Protocol** — Dual-token stablecoin TVL $42.2M [![Hylo](https://img.shields.io/badge/Hylo-8B5CF6?logoColor=white)](https://hylo.com) *(DefiLlama monitor: `npm run analytics:hylo:stable`)*
- [x] **Contango V2** — Derivatives TVL $13.1M, 7d +41.79% [![Contango](https://img.shields.io/badge/Contango-1E88E5?logoColor=white)](https://contango.xyz) *(DefiLlama monitor: `npm run analytics:contango:perps`)*
- [x] **Liquid Collective** — Staking TVL $738.1M [![LiquidCollective](https://img.shields.io/badge/Liquid_Collective-5B21B6?logoColor=white)](https://liquidcollective.io) *(DefiLlama monitor: `npm run analytics:liquidcollective:staking`)*
- [x] **Steakhouse Financial** — Risk curator TVL $2.61B [![Steakhouse](https://img.shields.io/badge/Steakhouse-1A1A2E?logoColor=white)](https://steakhouse.financial) *(DefiLlama monitor: `npm run analytics:steakhouse:curator`)*
- [x] **Frankencoin** — CDP TVL $66.0M [![Frankencoin](https://img.shields.io/badge/Frankencoin-000000?logoColor=white)](https://frankencoin.com) *(DefiLlama monitor: `npm run analytics:frankencoin:cdp`)*
- [x] **Rysk V12** — Options TVL $37.7M [![Rysk](https://img.shields.io/badge/Rysk-5865F2?logoColor=white)](https://rysk.finance) *(DefiLlama monitor: `npm run analytics:rysk:options`)*
- [x] **Galaxy Curation** — Curation TVL $46.9M [![Galaxy](https://img.shields.io/badge/Galaxy-5865F2?logoColor=white)](https://galaxy.eco) *(DefiLlama monitor: `npm run analytics:galaxy:curator`)*
- [x] **Drift** — Solana perps TVL $343.0M [![Drift](https://img.shields.io/badge/Drift-14F195?logoColor=black)](https://drift.trade) *(DefiLlama monitor: `npm run analytics:drift:perps`)*
- [x] **Jito** — Solana staking TVL $1.26B [![Jito](https://img.shields.io/badge/Jito-14F195?logoColor=black)](https://jito.network) *(DefiLlama monitor: `npm run analytics:jito:staking`)*
- [x] **Marinade** — Solana staking TVL $949.9M [![Marinade](https://img.shields.io/badge/Marinade-14F195?logoColor=black)](https://marinade.finance) *(DefiLlama monitor: `npm run analytics:marinade:staking`)*
- [x] **Sanctum** — Solana staking TVL $2.28B [![Sanctum](https://img.shields.io/badge/Sanctum-14F195?logoColor=black)](https://sanctum.so) *(DefiLlama monitor: `npm run analytics:sanctum:staking`)*
- [x] **Fables** — Robinhood Chain DEX (points program ending 2026-10-05 ahead of TGE) [![Fables](https://img.shields.io/badge/Fables-00D4AA?logoColor=black)](https://fables.market) *(DefiLlama monitor: `npm run analytics:fables:dex`; airdrop watch row added)*
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
