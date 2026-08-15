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
- **Drake Exchange** — No verified DefiLlama slug in-repo; add `analytics:drake:dex` / `simulate:drake:smoke` after slug is confirmed.
- **Kintsu** — Analytics: `analytics:kintsu:staking`, `analytics:staking:compare`. Simulate: `simulate:kintsu:smoke`, `simulate:staking:compare:smoke`. Cross-chain / swap: no.
- **Curvance** — Analytics: **`analytics:lending:aggregate`** (TVL row for slug `curvance`). Simulate: **`simulate:lending:aggregate:smoke`**. Cross-chain / swap: no.
- **Resolv** — Same as Curvance via lending aggregate + `simulate:lending:aggregate:smoke` (slug `resolv`). Cross-chain / swap: no.
- **StakeStone** — Analytics: `analytics:stakestone:staking`, `analytics:staking:compare`. Simulate: `simulate:stakestone:smoke`, `simulate:staking:compare:smoke`. Cross-chain / swap: no.
- **Zama FHEVM DEX** — No DefiLlama protocol entry found for a stable `zama` slug; scope TBD (testnet vs mainnet listing).
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

## Day-trading catalog (early 2026)

Spot venues, aggregators, perps, and Synthetix use **`dexProtocolMonitor.js`** + **`smokeDefiLlamaProtocol.js`** with verified slugs (e.g. `maverick-protocol`, `vertex-perps`, `polynomial-trade`, `fluid-dex`, `cowswap`). Commands live in the README and `package.json`.

- **Aevo** — Analytics: `analytics:aevo:perps` (slug `aevo`). Simulate: `simulate:aevo:smoke`. Cross-chain / swap: no.
- **Spark** — Analytics: `analytics:spark:lend` (slug `spark`); row in `analytics:lending:aggregate`. Simulate: `simulate:spark:smoke`, `simulate:lending:aggregate:smoke`. Cross-chain / swap: no.
- **Gains / MUX / SynFutures** — Analytics: `analytics:gains:perps`, `analytics:mux:perps`, `analytics:synfutures:perps`. Simulate: `simulate:gains:smoke`, `simulate:mux:smoke`, `simulate:synfutures:smoke` (slugs `gains-network`, `mux-protocol`, `synfutures-v3`).
- **Lending aggregate smoke** now covers `aave-v3`, `morpho-v1`, `compound-v3`, `spark`, `venus`, `euler-v2`, `curvance`, `resolv` (matches `LENDING_PROTOCOLS` in `allLendingAggregator.js`).

- **AMM aggregate:** `analytics:amm:aggregate` / `simulate:amm:aggregate:smoke` — rows are defined in `AMM_PROTOCOLS` in `src/analytics/aggregators/allAmmDexAggregator.js` (reused by the smoke script).

## Adding a missing protocol

1. Confirm a **DefiLlama slug** via `https://api.llama.fi/protocol/<slug>` (HTTP 200 and sensible `name`).
2. **Analytics:** add a line to `package.json`, e.g. `DEFILLAMA_SLUG=<slug> DEFILLAMA_LABEL=<Name> node src/analytics/protocols/llama/dexProtocolMonitor.js` (copy `analytics:aster:perps` pattern).
3. **Smoke:** add `SMOKE_SLUG=<slug> node src/simulation/api/smokeDefiLlamaProtocol.js` (copy `simulate:lighter:smoke`). Use `SMOKE_ALLOW_NOT_LISTED=1` only when a 404 should not fail CI.
4. **Lending-style** protocols: consider extending `LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js` and `SLUGS` in `src/simulation/api/smokeLendingLlamaAggregate.js` instead of one-off monitors.
