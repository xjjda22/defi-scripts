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
- **Astroport** — Analytics: `analytics:astroport:dex` (Terra2/Injective/Osmosis/Neutron DEX; slug `astroport`). Simulate: `simulate:astroport:smoke`. Neutron sibling **Drop** (slug `drop`) is not wired: its Llama series ends at $0 on 2026-09-15 and Cosmos reads need a non-ethers client.
- **Meter Passport** — Analytics: `analytics:meter:bridge` (slug `meter-passport`). Simulate: `simulate:meter:smoke`. Cross-chain / swap: no.
- **Bitget (CEX)** — Analytics: `analytics:bitget:cex` (CEX reserve TVL by chain; slug `bitget`). Simulate: `simulate:bitget:smoke`. Read-only; not a DeFi venue.
- **Bitget SOL** — Analytics: `analytics:bitget:sol` (Bitget SOL LST; slug `bitget-sol`; 7d +35.5% TVL $56.1M; distinct from Bitget CEX). Simulate: `simulate:bitget:sol:smoke`. Cross-chain / swap: no.
- **Drop** — Analytics: `analytics:drop:staking` (Neutron liquid staking; slug `drop`; Neutron governance exploit drain 2026-09-22, TVL $0). Simulate: `simulate:drop:smoke` (SMOKE_MIN_TVL_USD=0 so $0 is OK). Previously unwired; now wired even at $0 TVL.
- **THORChain DEX** — Analytics: `analytics:thorchain:dex` (Cross-chain DEX; slug `thorchain-dex`; routed ~500k stolen ATOM; 7d +21.7% TVL $71.9M). Simulate: `simulate:thorchain:smoke`. Cross-chain / swap: no.
- **Polymarket** — Analytics: `analytics:polymarket:pred` (Prediction market; slug `polymarket`; TVL ~$358M; unofficial $POLY airdrop chatter). Simulate: `simulate:polymarket:smoke`. Also added to `src/analytics/airdrop/watchlist.json` as status=watch (native $POLY unofficial/rumor; proxy tokens are not the official token). Cross-chain / swap: no.
- **Circle** — Analytics: `analytics:circle:stable` (Circle protocol; slug `circle`; TVL ~$68M; chains Ethereum+Arc). Simulate: `simulate:circle:smoke`. Cross-chain / swap: no.
- **Arc Chain** — Analytics: `analytics:arc:chain` (Circle L1, chainId 5042; chain TVL $504M from DefiLlama v2/chains name=Arc). Simulate: `simulate:arc:smoke` (reuses `fetchLlamaChains` from `src/analytics/utils/defiLlamaProtocol.js`; exits 0 when Arc TVL is a finite number). Do NOT add Arc to L2_CHAINS (it is Circle's L1, not an L2). Cross-chain / swap: no.
- **NEAR Intents** — Analytics: `analytics:near:intents` (slug `near-intents`; 7d +50.9% TVL $255M). Simulate: `simulate:near:intents:smoke`. Cross-chain / swap: no.
- **NEAR Bridge** — Analytics: `analytics:near:bridge` (slug `near-bridge`; 7d +84.4% TVL $128M). Simulate: `simulate:near:bridge:smoke`. Cross-chain / swap: no.
- **Jupiter Lend DEX** — Analytics: `analytics:jupiter:lend-dex` (slug `jupiter-lend-dex`; 7d +108% TVL $23.3M). Simulate: `simulate:jupiter:lend-dex:smoke`. Cross-chain / swap: no.
- **Fables** — Analytics: `analytics:fables:dex` (Robinhood Chain DEX; slug `fables`; 7d +74.9% TVL $50.7M). Simulate: `simulate:fables:smoke`. Cross-chain / swap: no.
- **Stellar DeFi Hub** — Analytics: `analytics:stellar:hub` (slug `stellar-defi-hub`; 7d +62.8% TVL $57.3M). Simulate: `simulate:stellar:smoke`. Cross-chain / swap: no.
- **Gravity by Galxe** — Analytics: `analytics:gravity:bridge` (slug `gravity-by-galxe`; 7d -54.5% TVL $32.2M). Simulate: `simulate:gravity:smoke`. Cross-chain / swap: no.
- **Lisk Bridge** — Analytics: `analytics:lisk:bridge` (slug `lisk-bridge`; 7d -45.1% TVL $44.9M). Simulate: `simulate:lisk:smoke`. Cross-chain / swap: no.
- **Haedal Protocol** — Analytics: `analytics:haedal:staking` (liquid staking; slug `haedal-protocol`; 7d +41.7% TVL $44.1M). Simulate: `simulate:haedal:smoke`. Cross-chain / swap: no.
- **Meta Pool Near** — Analytics: `analytics:metapool:near` (NEAR LST; slug `meta-pool-near`; 7d +40% TVL $124.4M). Simulate: `simulate:metapool:smoke`. Cross-chain / swap: no.
- **RHEA LST** — Analytics: `analytics:rhea:lst` (Rhea liquid staking; slug `rhea-lst`; 7d +39.4% TVL $43.3M; sibling to Rhea Dex). Simulate: `simulate:rhea:lst:smoke`. Cross-chain / swap: no.
- **Volo LST** — Analytics: `analytics:volo:staking` (slug `volo-lst`; 7d +39% TVL $26.6M). Simulate: `simulate:volo:smoke`. Cross-chain / swap: no.
- **LiNEAR Protocol** — Analytics: `analytics:linear:staking` (NEAR LST; slug `linear-protocol`; 7d +38.6% TVL $120.8M). Simulate: `simulate:linear:smoke`. Cross-chain / swap: no.
- **Rhea Dex** — Analytics: `analytics:rhea:dex` (slug `rhea-dex`; 7d -31.2% TVL $29.5M; sibling to Rhea LST). Simulate: `simulate:rhea:dex:smoke`. Cross-chain / swap: no.
- **vfat.io** — Analytics: `analytics:vfat:yield` (yield aggregator; slug `vfat.io` contains a dot; 7d +33.7% TVL $38.7M). Simulate: `simulate:vfat:smoke`. Cross-chain / swap: no.
- **Unit** — Analytics: `analytics:unit:bridge` (bridge; slug `unit`; 7d +31.9% TVL $1.08B). Simulate: `simulate:unit:smoke`. Cross-chain / swap: no.
- **40 Acres** — Analytics: `analytics:40acres:lending` (lending; slug `40-acres`; 7d +30.4% TVL $54.4M). Simulate: `simulate:40acres:smoke`. Cross-chain / swap: no.
- **USD AI** — Analytics: `analytics:usdai:rwa` (RWA; slug `usd-ai`; 7d -30.1% TVL $214.9M). Simulate: `simulate:usdai:smoke`. Cross-chain / swap: no.
- **Current** — Analytics: `analytics:current:lending` (lending; slug `current`; 7d +25.4% TVL $54.4M). Simulate: `simulate:current:smoke`. Cross-chain / swap: no.
- **Jupiter Lend** — Analytics: `analytics:jupiter:lend` (Solana lending; slug `jupiter-lend`; TVL $1.18B). Simulate: `simulate:jupiter:lend:smoke`. Sibling to Jupiter Lend DEX above. Cross-chain / swap: no.
- **Kuru CLOB** — Analytics: `analytics:kuru:clob` (Monad CLOB; slug `kuru-clob`; vol24 $143.9M, 7d chg +489.6%). Simulate: `simulate:kuru:smoke`. Cross-chain / swap: no.
- **Maple** — Analytics: `analytics:maple:lending` (lending; slug `maple`; TVL $3.00B, fees24 $1.11M). Simulate: `simulate:maple:smoke`. Cross-chain / swap: no.
- **NAVI Lending** — Analytics: `analytics:navi:lending` (Sui lending; slug `navi-lending`; TVL $176.6M, 7d +19.61%). Simulate: `simulate:navi:smoke`. Cross-chain / swap: no.
- **HyperLend Pooled** — Analytics: `analytics:hyperlend:lending` (Hyperliquid L1 lending; slug `hyperlend-pooled`; TVL $430.9M). Simulate: `simulate:hyperlend:smoke`. Cross-chain / swap: no.
- **PumpSwap** — Analytics: `analytics:pumpswap:dex` (Solana DEX; slug `pumpswap`; vol24 $426.0M, fees24 $5.59M). Simulate: `simulate:pumpswap:smoke`. Cross-chain / swap: no.
- **Orca DEX** — Analytics: `analytics:orca:dex` (Solana DEX; slug `orca-dex`; vol24 $230.8M, 7d chg +62.95%). Simulate: `simulate:orca:smoke`. Cross-chain / swap: no.
- **Portal** — Analytics: `analytics:portal:bridge` (Wormhole bridge; slug `portal`; TVL $1.87B, 7d +17.01%). Simulate: `simulate:portal:smoke`. Cross-chain / swap: no.
- **Kamino Lend** — Analytics: `analytics:kamino:lending` (Solana lending; slug `kamino-lend`; TVL $1.46B, 7d +5.82%). Simulate: `simulate:kamino:smoke`. Cross-chain / swap: no.
- **Fluid Lending** — Analytics: `analytics:fluid:lending` (lending; slug `fluid-lending`; TVL $734.7M; new metric vs Fluid DEX). Simulate: `simulate:fluid:lending:smoke`. Fluid DEX (`fluid-dex`) already covered separately. Cross-chain / swap: no.
- **Raydium AMM** — Analytics: `analytics:raydium:dex` (Solana DEX; slug `raydium-amm`; TVL $1.36B, vol24 $199.0M). Simulate: `simulate:raydium:smoke`. Cross-chain / swap: no.
- **Meteora DLMM** — Analytics: `analytics:meteora:dex` (Solana DEX; slug `meteora-dlmm`; vol24 $204.6M, TVL $189.6M). Simulate: `simulate:meteora:smoke`. Cross-chain / swap: no.
- **World Chain** — Analytics: `analytics:worldchain:bridge` (canonical bridge; slug `world-chain`; TVL $474.4M, 7d +19.09%). Simulate: `simulate:worldchain:smoke`. Cross-chain / swap: no.
- **Backpack** — Analytics: `analytics:backpack:cex` (CEX; slug `backpack`; TVL $633.5M, 7d +31.61%). Simulate: `simulate:backpack:smoke`. Read-only; not a DeFi venue. Cross-chain / swap: no.
- **Bittensor dTAO** — Analytics: `analytics:bittensor:dtao` (slug `bittensor-dtao`; TVL $568.5M, 7d +21.59%). Simulate: `simulate:bittensor:smoke`. Cross-chain / swap: no.
- **cap** — Analytics: `analytics:cap:lending` (lending; slug `cap`; TVL $291.7M). Simulate: `simulate:cap:smoke`. Cross-chain / swap: no.
- **SpringSui** — Analytics: `analytics:springsui:staking` (Sui staking; slug `springsui`; TVL $74.2M, 7d +22.04%). Simulate: `simulate:springsui:smoke`. Cross-chain / swap: no.
- **DFDV Staked SOL** — Analytics: `analytics:dfdv:staking` (Solana LST; slug `dfdv-staked-sol`; TVL $218.7M, 7d +24.78%). Simulate: `simulate:dfdv:smoke`. Cross-chain / swap: no.
- **Cetus CLMM** — Analytics: `analytics:cetus:dex` (Sui DEX; slug `cetus-clmm`; vol 7d chg +150.54%). Simulate: `simulate:cetus:smoke`. Cross-chain / swap: no.
- **Bluefin Spot** — Analytics: `analytics:bluefin:dex` (Sui DEX; slug `bluefin-spot`; vol 7d chg +149.76%). Simulate: `simulate:bluefin:smoke`. Cross-chain / swap: no.
- **DeepBook V3** — Analytics: `analytics:deepbook:dex` (Sui DEX; slug `deepbook-v3`; vol 7d chg +141.27%). Simulate: `simulate:deepbook:smoke`. Cross-chain / swap: no.
- **Chainflip AMM** — Analytics: `analytics:chainflip:dex` (cross-chain DEX; slug `chainflip-amm`; vol 7d chg +148.17%). Simulate: `simulate:chainflip:smoke`. Cross-chain / swap: no.
- **Dexalot DEX** — Analytics: `analytics:dexalot:dex` (multi-chain DEX; slug `dexalot-dex`; vol24 $123.1M). Simulate: `simulate:dexalot:smoke`. Cross-chain / swap: no.
- **Scorch** — Analytics: `analytics:scorch:dex` (Solana DEX; slug `scorch`; vol24 $97.4M, 7d chg +58.21%). Simulate: `simulate:scorch:smoke`. Cross-chain / swap: no.
- **BisonFi** — Analytics: `analytics:bisonfi:dex` (Solana DEX; slug `bisonfi`; vol24 $327.8M). Simulate: `simulate:bisonfi:smoke`. Cross-chain / swap: no.
- **Manifest Trade** — Analytics: `analytics:manifest:dex` (Solana DEX; slug `manifest-trade`; vol24 $128.4M). Simulate: `simulate:manifest:smoke`. Cross-chain / swap: no.
- **Pharaoh DLMM** — Analytics: `analytics:pharaoh:dex` (Avalanche DEX; slug `pharaoh-dlmm`; vol 7d chg +72.93%). Simulate: `simulate:pharaoh:smoke`. Cross-chain / swap: no.
- **AO Bridge** — Analytics: `analytics:ao:bridge` (bridge; slug `ao-bridge`; TVL $91.4M, 7d +29.68%). Simulate: `simulate:ao:smoke`. Cross-chain / swap: no.
- **Sonic Gateway** — Analytics: `analytics:sonic:bridge` (bridge; slug `sonic-gateway`; TVL $59.5M, 7d +17.35%). Simulate: `simulate:sonic:smoke`. Cross-chain / swap: no.
- **Hylo Protocol** — Analytics: `analytics:hylo:stable` (dual-token stablecoin; slug `hylo-protocol`; TVL $42.2M). Simulate: `simulate:hylo:smoke`. Cross-chain / swap: no.
- **Contango V2** — Analytics: `analytics:contango:perps` (derivatives; slug `contango-v2`; TVL $13.1M, 7d +41.79%). Simulate: `simulate:contango:smoke`. Cross-chain / swap: no.
- **Liquid Collective** — Analytics: `analytics:liquidcollective:staking` (staking; slug `liquid-collective`; TVL $738.1M). Simulate: `simulate:liquidcollective:smoke`. Cross-chain / swap: no.
- **Steakhouse Financial** — Analytics: `analytics:steakhouse:curator` (risk curator; slug `steakhouse-financial`; TVL $2.61B). Simulate: `simulate:steakhouse:smoke`. Cross-chain / swap: no.
- **Frankencoin** — Analytics: `analytics:frankencoin:cdp` (CDP; slug `frankencoin`; TVL $66.0M). Simulate: `simulate:frankencoin:smoke`. Cross-chain / swap: no.
- **Rysk V12** — Analytics: `analytics:rysk:options` (options; slug `rysk-v12`; TVL $37.7M). Simulate: `simulate:rysk:smoke`. Cross-chain / swap: no.
- **Galaxy Curation** — Analytics: `analytics:galaxy:curator` (curation; slug `galaxy-curation`; TVL $46.9M). Simulate: `simulate:galaxy:smoke`. Cross-chain / swap: no.
- **Drift** — Analytics: `analytics:drift:perps` (Solana perps; slug `drift`; TVL $343.0M parent). Simulate: `simulate:drift:smoke`. Cross-chain / swap: no.
- **Jito** — Analytics: `analytics:jito:staking` (Solana staking; slug `jito`; TVL $1.26B parent). Simulate: `simulate:jito:smoke`. Cross-chain / swap: no.
- **Marinade** — Analytics: `analytics:marinade:staking` (Solana staking; slug `marinade`; TVL $949.9M parent). Simulate: `simulate:marinade:smoke`. Cross-chain / swap: no.
- **Sanctum** — Analytics: `analytics:sanctum:staking` (Solana staking; slug `sanctum`; TVL $2.28B parent). Simulate: `simulate:sanctum:smoke`. Cross-chain / swap: no.
- **Fables** — Analytics: `analytics:fables:dex` (Robinhood Chain DEX; slug `fables`; 7d +74.9% TVL $50.7M; points program ending 2026-10-05 ahead of TGE). Simulate: `simulate:fables:smoke`. Also added to `src/analytics/airdrop/watchlist.json` as status=watch. Cross-chain / swap: no.
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
