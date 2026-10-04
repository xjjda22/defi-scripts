# Protocol script coverage

Architecture: [`00-architecture.md`](./00-architecture.md). The per-protocol command list lives in the generated [`02-protocol-catalog.md`](./02-protocol-catalog.md) (or `npm run catalog -- <protocol>` in a terminal). This document covers what each script family means, what is deliberately out of scope, and how to add a protocol.

## Legend

- **Cross-chain (`crosschain:*`)** — Subgraph-backed TVL, volume, and (for Uniswap) liquidity trackers under `src/crosschain/`. Only **Uniswap, Curve, Balancer, and SushiSwap** have these scripts.
- **Analytics (`analytics:*`)** — Dedicated monitors or generic DefiLlama summaries (`DEFILLAMA_SLUG`), plus category aggregators such as `analytics:lending:aggregate` and `analytics:amm:aggregate`.
- **Smoke (`simulate:*:smoke`)** — Pass/fail check of the same data source as the analytics twin; exits non-zero when the source breaks.
- **Simulate (`simulate:*`)** — On-chain fork / quote flows and fill replays.
- **Swap (`swap:*`)** — Wallet-backed examples in `src/examples/`. Only major pool DEX routes have named scripts; lending, LST, perp, and RWA protocols do not (by design).

## Swap / simulate: not applicable in this stack

These are **not** modeled as `swap:*` or `dexForkRunner` pool quotes in this repo:

- **Solana AMM (e.g. HumidiFi)** — requires a non-ethers client.
- **Perp / hybrid DEX (Reya, Lighter, Aster, Drake)** — not spot Uniswap-style routers; use analytics / Llama smokes only.
- **RWA / allowlisted transfer (Ondo, BUIDL)** — swap examples are usually blocked without institutional setup.
- **Privacy / FHEVM (Zama), Aztec Ignition** — toolchain-specific; Aztec row on Llama may still differ from Ignition branding.
- **Morpho** — no `swap:morpho` (it would be misleading); `simulate:morpho:fork` reads `market(bytes32)` instead.

## Aerodrome / Velodrome (Slipstream) — reference quotes

Slipstream **on-chain quoters** at the published addresses do not return success for standard `QuoterV2.quoteExactInputSingle.staticCall` in this codebase (calls revert). To still ship useful scripts:

- **`simulate:dex:aerodrome:v3`** / **`simulate:dex:velodrome:v3`** set `DEFI_SLIPSTREAM_PROXY=1` and run **Uniswap V3** on the same chain (`base` / `optimism`) with a console note — liquid reference for WETH/USDC-style pairs, not Slipstream execution.
- **`swap:aerodrome`** / **`swap:velodrome`** quote **Uniswap V3** on that chain and explain the limitation; execute via protocol UI or extend with a compatible quoter path.
- **`chains.js`** still lists `aerodrome.v3` / `velodrome.v3` (router, quoter, **pool factory from `router.factory()`**) for future integration via `v3Swap` + `dexId`.

## Aggregate rows without their own scripts

- **Curvance, Resolv, Compound V3, Venus, Euler V2** — rows in `analytics:lending:aggregate` (`LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js`), checked by `simulate:lending:aggregate:smoke`.
- **AMM families** — rows in `analytics:amm:aggregate` (`AMM_PROTOCOLS` in `src/analytics/aggregators/allAmmDexAggregator.js`), reused by `simulate:amm:aggregate:smoke`.
- **Landscape boards** (L2, ETH, BTC, RWA, NFT, airdrop) are read-only DefiLlama / calendar views: not claimers, not MEV submit.

## Not covered yet

- **Milk Road Swap**, **Soneium DEX**, **MegaETH AMM** — no verified DefiLlama slug or on-chain scope; add after a listing exists.

## Adding a missing protocol

1. Confirm a **DefiLlama slug** via `https://api.llama.fi/protocol/<slug>` (HTTP 200 and sensible `name`).
2. **Analytics:** add a line to `package.json`, e.g. `DEFILLAMA_SLUG=<slug> DEFILLAMA_LABEL=<Name> node src/analytics/protocols/llama/dexProtocolMonitor.js` (copy `analytics:aster:perps` pattern).
3. **Smoke:** add `SMOKE_SLUG=<slug> node src/simulation/api/smokeDefiLlamaProtocol.js` (copy `simulate:lighter:smoke`). Use `SMOKE_ALLOW_NOT_LISTED=1` only when a 404 should not fail CI.
4. **No slug but a checkable contract balance** (e.g. a drained bridge): reuse `src/analytics/protocols/onchain/erc20BalanceMonitor.js` with `ERC20_TOKEN` / `ERC20_HOLDER` / `ERC20_CHAIN` (copy `analytics:payy:bridge`).
5. **Chain TVL, no protocol slug** (Arc, Blast): set `LLAMA_CHAIN_NAME` (default `Arc`) on `src/analytics/protocols/llama/arcChainMonitor.js` and `src/simulation/api/smokeArcChain.js` (copy `analytics:blast:chain` / `simulate:blast:smoke`). Analytics also prints 7d/30d TVL change from `/v2/historicalChainTvl/<name>`. `LLAMA_CHAIN_MIN_TVL_USD=0` allows a $0 row; the smoke still fails if that chain row is missing or the API errors. `analytics:arc:chain` / `simulate:arc:smoke` leave the env unset.
6. **Fees / revenue claims** (or $0 TVL, e.g. launchpads): add `DEFILLAMA_FEES=1` to the analytics line and `SMOKE_FEES=1` to the smoke (copy `analytics:pumpfun:launchpad` / `simulate:pumpfun:smoke`); the smoke then fails unless `/summary/fees/<slug>?dataType=dailyRevenue` has a positive 24h value. Leave `SMOKE_FEES` off when daily revenue is sometimes $0. Open interest (not volume) is `DEFILLAMA_OI=1`, which prints `/summary/open-interest/<slug>` `total24h` (copy `analytics:variational:perps`). Do not call `/summary/derivatives` (paywalled).
7. **Lending-style** protocols: consider extending `LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js` and `SLUGS` in `src/simulation/api/smokeLendingLlamaAggregate.js` instead of one-off monitors. A one-off slug monitor already prints a `borrowed` row from `currentChainTvls` when DefiLlama has one.
8. **Register it** in `PROTOCOLS` in `src/catalog/protocols.js` (id = second segment of the script name, category, url, one-line `about`, optional sourced `notes`). Scripts that are not DefiLlama one-liners also need a line in `SCRIPT_DESCRIPTIONS`. Ids may start with a digit (`3jane`).
9. Run `npm run catalog:docs`, then `npm run catalog:check` (fails on unregistered or undescribed scripts and on stale docs).
