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
5. **Chain TVL, no protocol slug** (Arc, Blast, Abstract, Robinhood Chain, Stellar): set `LLAMA_CHAIN_NAME` (default `Arc`) on `src/analytics/protocols/llama/arcChainMonitor.js` and `src/simulation/api/smokeArcChain.js` (copy `analytics:blast:chain` / `simulate:blast:smoke`). Analytics also prints 7d/30d TVL change from `/v2/historicalChainTvl/<name>`. `LLAMA_CHAIN_DEX=1` adds `/overview/dexs/<name>` (24h/7d/30d). `LLAMA_CHAIN_FEES=1` adds `/overview/fees/<name>`. `LLAMA_CHAIN_NOTE` (percent-encoded) is printed after the tables. A name with a space or `;` is percent-encoded in the npm script (`Robinhood%20Chain`) and decoded before the `/v2/chains` lookup; request paths are `encodeURIComponent`'d again. `LLAMA_CHAIN_MIN_TVL_USD=0` allows a $0 row; the smoke still fails if that chain row is missing or the API errors. `analytics:arc:chain` / `simulate:arc:smoke` leave the env unset.
6. **Options notional / premium** (Derive): `src/analytics/protocols/llama/deriveOptionsMonitor.js` reads `/summary/options/<slug>` with `dataType=dailyNotionalVolume` and `dailyPremiumVolume`, TVL from `/protocol/<parent>`, and venue share from `/overview/options`. Copy `analytics:derive:options` / `simulate:derive:smoke`. The smoke fails unless 30d notional is > 0 or the API errors. A venue with a protocol page but no options-volume adapter (Hypercall) is TVL-only — say volume is not tracked. Do not call `/summary/derivatives` (paywalled).
7. **Fees / revenue claims** (or $0 TVL, e.g. launchpads): add `DEFILLAMA_FEES=1` to the analytics line and `SMOKE_FEES=1` to the smoke (copy `analytics:pumpfun:launchpad` / `simulate:pumpfun:smoke`); the smoke then fails unless `/summary/fees/<slug>?dataType=dailyRevenue` has a positive 24h value. Leave `SMOKE_FEES` off when daily revenue is sometimes $0. Open interest (not volume) is `DEFILLAMA_OI=1`, which prints `/summary/open-interest/<slug>` `total24h` (copy `analytics:variational:perps`); add `SMOKE_OI=1` to the smoke to require a positive value (copy `simulate:variational:smoke`). For "OI at a yearly high" claims also set `DEFILLAMA_OI_HIGH=1`, which prints the year-to-date high and its date from the same endpoint's daily chart (copy `analytics:lighter:perps`). Do not call `/summary/derivatives` (paywalled).
8. **Exploit amounts**: `src/analytics/protocols/llama/llamaHacksMonitor.js` reads the free DefiLlama `/hacks` list, matched by `LLAMA_HACK_ID` (DefiLlama protocol id) or `LLAMA_HACK_NAME`, optionally since `LLAMA_HACK_SINCE` (YYYY-MM-DD); `src/simulation/api/smokeLlamaHacks.js` fails unless a matching incident has a positive amount (copy `analytics:near:exploit` / `simulate:near:exploit:smoke`). DefiLlama often leaves `returnedFunds` empty, so cite recoveries from the news source.
9. **Lending-style** protocols: consider extending `LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js` and `SLUGS` in `src/simulation/api/smokeLendingLlamaAggregate.js` instead of one-off monitors. A one-off slug monitor already prints a `borrowed` row from `currentChainTvls` when DefiLlama has one.
10. **Register it** in `PROTOCOLS` in `src/catalog/protocols.js` (id = second segment of the script name, category, url, one-line `about`, optional sourced `notes`). Scripts that are not DefiLlama one-liners also need a line in `SCRIPT_DESCRIPTIONS`. Ids may start with a digit (`3jane`).
11. Run `npm run catalog:docs`, then `npm run catalog:check` (fails on unregistered or undescribed scripts and on stale docs).

## Claim monitors (2026-10-09)

Live numbers move. These scripts print the current DefiLlama windows, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:lighter:perps`, `simulate:lighter:smoke` | Lighter open interest hit a 2026 high; Robinhood partnership ~a quarter of OI and fee revenue, nearly 40% of daily active accounts. Now prints OI and its YTD high (`DEFILLAMA_OI=1 DEFILLAMA_OI_HIGH=1`); the smoke requires positive OI. | [TokenPost](https://www.tokenpost.com/news/business/28319) (2026-10-08); [Coinfomania](https://coinfomania.com/lighter-exchange-hits-2026-high-in-open-interest/) (2026-10-08); [X](https://x.com/Delphi_Digital/status/2108206129574539702) (2026-10-08) |
| `analytics:papertrade:perps`, `simulate:papertrade:smoke` | Papertrade (HyperEVM perps) opened pre-deposits 2026-10-08 with live trading expected after the 2026-10-10 HyperEVM upgrade; ~$25M in user deposits before launch (single X post). | [DeFi Prime](https://defiprime.com/papertrade-opens-predeposits-before-hyperevm-launch) (2026-10-09); [SignalPlus](https://t.signalplus.com/crypto-news/detail/papertrade-opens-predeposits-ahead-october-trading-launch?lang=en-US) (2026-10-08); [X](https://x.com/zoomerfied/status/2108565430499717403) (2026-10-09) |
| `analytics:stellar:chain`, `simulate:stellar:smoke` | Stellar DeFi TVL record of nearly $273M on 2026-10-02 (from ~$265M a week earlier). Chain name `Stellar`. | [BSC News](https://bsc.news/news/stellar-defi-tvl-record-rwa) (2026-10-05); [Blockonomi](https://blockonomi.com/stellar-defi-hits-new-tvl-record-as-active-wallets-near-100000/) (2026-10-03) |
| `analytics:near:exploit`, `simulate:near:exploit:smoke` | NEAR Intents exploited for ~$3.8M (USDT on BNB Chain, Sep 30 to Oct 1); funds returned in full 2026-10-02. Read from DefiLlama `/hacks` (id 6225); returned funds are not recorded there. | [Cointelegraph](https://cointelegraph.com/news/near-intents-recovers-entire-stolen-38m-after-ultimatum-to-exploiter) (2026-10-03); [Decrypt](https://decrypt.co/380014/near-intents-recovers-3-8-million-after-48-hour-ultimatum) (2026-10-04); [X](https://x.com/zacodil/status/2108480859942555933) (2026-10-09) |

## Trending showcase

`npm run ranking:top200` (alias `npm run showcase:build`) writes `showcase/data.json`: an overall top 200 and a ranking for each catalog category. It does not add per-protocol npm scripts, so `catalog:check` is unchanged. Methodology, the category map, and the Monday / Wednesday / Friday refresh are in [`03-showcase-ranking.md`](./03-showcase-ranking.md).

## Claim monitors (2026-10-07)

Live numbers move. These scripts print the current DefiLlama windows, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:abstract:chain`, `simulate:abstract:smoke` | Abstract (Ethereum L2) is winding down; the chain shuts down 2026-12-15 and funds not bridged out become inaccessible. Peaked ~$57M TVL / $32M daily DEX volume; reported ~$9.5M TVL / ~$316K DEX volume. Chain name `Abstract`. | [The Block](https://www.theblock.co/news/ecosystems/2026-10-06-abstract-ethereum-layer-2-shutting-down-pudgy-penguins-igloo-417855) (2026-10-06); [TokenPost](https://www.tokenpost.com/news/technology/27126) (2026-10-07); [X](https://x.com/NickPreszler/status/2107574455106994679) (2026-10-06) |
| `analytics:derive:options`, `simulate:derive:smoke` | September onchain options notional more than doubled to ~$4.83B (+121.7% MoM). Derive ~$3.8B, share 88.1% → 79.3%. Paradex notional +285% and OI >$250M. Hypercall ~11.2% share (TVL only here; volume is not tracked on DefiLlama). | [CryptoBriefing](https://cryptobriefing.com/derive-leads-onchain-options-volume-doubles/) (2026-10-05); [Coinfomania](https://coinfomania.com/onchain-options-market-surges-to-4-83b-as-competition-grows/) (2026-10-05); [X](https://x.com/Delphi_Digital/status/2107083828389187613) (2026-10-05) |
| `analytics:robinhood:chain`, `simulate:robinhood:smoke` | Robinhood Chain, about three months old: ~$1.04B TVL, ~$5M app fees in 24h, ~$1.5B DEX volume. Chain name `Robinhood Chain` (percent-encoded in the npm script). | [X](https://x.com/ripchillpill/status/2106018905907237207) (2026-10-02) |
