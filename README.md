# defi-scripts

> **Live DeFi data, DEX quotes and fork simulations from your terminal.** 100+ protocols, 300+ commands, one naming scheme. Most need no API key.

[![CI](https://github.com/xjjda22/defi-scripts/actions/workflows/ci.yml/badge.svg)](https://github.com/xjjda22/defi-scripts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![EVM chains](https://img.shields.io/badge/EVM_chains-10-orange.svg)](#what-you-need)
[![Protocols](https://img.shields.io/badge/protocols-117-purple.svg)](docs/02-protocol-catalog.md)

Where is the best USDC borrow rate right now, across Aave and Morpho, on five chains? One command:

```text
$ npm run analytics:lending:rates

Cross-chain — best supply & borrow per asset (all chains scanned)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Asset   Best supply                 Best borrow                 Notes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USDC    Morpho 5.95% @ Arbitrum     Aave 3.83% @ Optimism
USDT    Aave 3.70% @ Ethereum       Morpho 2.61% @ Polygon
DAI     Aave 4.68% @ Polygon        Morpho 4.46% @ Ethereum
WETH    Morpho 3.36% @ Ethereum     Morpho 1.36% @ Optimism
WBTC    Morpho 0.12% @ Ethereum     Morpho 0.14% @ Ethereum     same chain+protocol
```

<sub>Live output captured 2026-10-03. Aave is read on-chain (one RPC URL per chain: Ethereum, Arbitrum, Optimism, Base, Polygon; chains without one are skipped), Morpho comes from its public API. Your numbers will differ.</sub>

## Contents

[Try it](#try-it-in-60-seconds) · [More output](#more-output) · [Why this repo](#why-this-repo) · [Trending showcase](#trending-showcase) · [What you need](#what-you-need) · [Protocols](#protocols) · [Command families](#command-families) · [Use as a library](#use-as-a-library) · [Repo layout](#repo-layout) · [Contributing](#contributing)

## Try it in 60 seconds

No keys needed for these:

```bash
git clone https://github.com/xjjda22/defi-scripts.git && cd defi-scripts
npm install
npm run analytics:l2:overview        # TVL + DEX volume for 8 Ethereum L2s
npm run analytics:eth:tvl-drivers    # who brought TVL onto Ethereum this week
npm run crosschain:uniswap:tvl       # Uniswap V1–V4 TVL on every chain
npm run catalog                      # every protocol and what's covered
npm run catalog -- hyperliquid       # one protocol: its commands and what each prints
```

Add an Ethereum RPC URL to `.env` (`cp sample.env .env`) and the on-chain commands open up: `analytics:lending:rates`, `simulate:multi:quote`, `analytics:aave:markets`, `analytics:dex:prices`.

## More output

**L2 landscape**: `npm run analytics:l2:overview` (no key)

```text
┌────────────┬──────────┬──────────┬──────────┬────────┬───────────┐
│ L2         │      TVL │  DEX 24h │  DEX 30d │  30d Δ │ Uni share │
├────────────┼──────────┼──────────┼──────────┼────────┼───────────┤
│ Arbitrum   │   $1.41B │ $191.81M │   $6.05B │  -3.2% │       75% │
│ Optimism   │ $487.86M │  $33.84M │   $1.06B │  +9.0% │       32% │
│ Base       │   $6.36B │   $1.36B │  $29.36B │ +64.5% │       28% │
│ Polygon    │ $750.67M │ $166.59M │   $6.86B │ -23.7% │       37% │
│ …          │        … │        … │        … │      … │         … │
│ Unichain   │  $31.16M │  $11.99M │ $347.72M │ +40.9% │       97% │
└────────────┴──────────┴──────────┴──────────┴────────┴───────────┘
```

**Where Ethereum TVL came from this week**: `npm run analytics:eth:tvl-drivers` (no key)

```text
┌───────────────────────┬───────────────────────────┬──────────┬────────┬───────────┐
│ Name                  │ Category                  │  ETH TVL │   7d Δ │ Est. 7d $ │
├───────────────────────┼───────────────────────────┼──────────┼────────┼───────────┤
│ LayerZero V2          │ Bridge                    │   $7.22B │ +45.8% │    $2.27B │
│ Falcon Finance        │ Basis Trading             │   $1.44B │ +19.2% │  $231.57M │
│ Arbitrum Bridge       │ Canonical Bridge          │   $3.74B │  +6.5% │  $229.62M │
│ Spark Liquidity Layer │ Onchain Capital Allocator │   $2.38B │  +6.6% │  $147.86M │
│ Base Bridge           │ Canonical Bridge          │   $3.18B │  +4.5% │  $137.73M │
└───────────────────────┴───────────────────────────┴──────────┴────────┴───────────┘
```

<details>
<summary><b>Best route for 1 WETH across six DEXs</b>: <code>npm run simulate:multi:quote</code> (RPC)</summary>

```text
  Chain: Ethereum (ethereum)
  Mode: QUOTE ONLY
  Amount In: 1 WETH

  Uniswap V2        ✓ 2668.398668 USDC
  Uniswap V3        ✓ 2675.306771 USDC (0.01% fee)
  SushiSwap V2      ✓ 2622.382795 USDC
  SushiSwap V3      ✗ Not available
  Curve             ✗ Not available
  Balancer V2       ✓ 2601.7609 USDC (WETH/USDC (50/50))

Best Quote
  Protocol: Uniswap V3
  Expected Output: 2675.306771 USDC
  Savings vs Worst: 2.82%
```

</details>

## Why this repo

DefiLlama, Dune and protocol dashboards are great for looking. This is for **scripting**:

- **Composable.** Every command is a plain Node script with a meaningful exit code. Pipe it, cron it, or run `npm run report:analytics` to health-check every data source at once.
- **On-chain where it matters.** Rates, quotes and pool state are read straight from contracts over your RPC, and quotes and liquidations can be replayed on an anvil fork. DefiLlama fills in breadth (Solana, Sui, Cosmos and everything else it tracks).
- **One naming scheme.** `<family>:<protocol>:<what>`, so `analytics:aave:markets`, `simulate:aave:v3:fork` and `simulate:kelp:smoke` are guessable. `npm run catalog -- <protocol>` lists them all.
- **Smoke tests for data sources.** Each DefiLlama monitor has a `:smoke` twin that fails when a protocol is delisted, returns empty TVL, or stops earning revenue.

## Trending showcase

A static top-200 board of DeFi protocols trending over the last six months, with one tab for each of the twelve catalog categories. The score blends size, six-month TVL growth (in percent and in dollars), 30-day fees and volume momentum, and a small bonus for distinct posts on the tracked X lists. Versions of one protocol are combined (Aave V2/V3/V4 is one row), protocols listed in the last six months carry a **New** badge, and rows the repo already monitors link straight to their scripts.

```bash
npm run showcase:build     # rebuild showcase/data.json from DefiLlama (~800 history pulls)
node scripts/showcaseCheck.js   # offline sanity check of showcase/data.json (also runs in CI)
npm run showcase:serve     # http://127.0.0.1:4173
```

Live page: <https://xjjda22.github.io/defi-scripts/> (deep links work, for example `#tab=perps`, `#q=morpho`, or `#p=uniswap`). Methodology, the category map and the refresh routine are in [docs/03-showcase-ranking.md](docs/03-showcase-ranking.md). Each row opens a test panel (`#p=<slug>` or `showcase/protocol.html?slug=`) with its scripts, fork commands, contracts and testnet faucets. Fork setup is in [docs/04-fork-testing.md](docs/04-fork-testing.md).

```bash
CHAIN=ethereum node scripts/startFork.js
ETHEREUM_RPC_URL=http://127.0.0.1:8545 npm run fork:uniswap:v3
npm run fork:all
```

GitHub Pages publishes the `showcase/` folder from [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Each deploy rebuilds the ranking from DefiLlama first (on a push that touches the showcase, Monday/Wednesday/Friday at 05:30 Malaysia time, or a manual run) and falls back to the committed `showcase/data.json` if DefiLlama is down. Pages must be enabled on the repository with **Source** set to **GitHub Actions**. The **Showcase refresh** workflow rebuilds and commits `showcase/data.json` on a feature branch that changes the ranking code, or on demand.

## What you need

| Commands | Needs |
| --- | --- |
| DefiLlama monitors and boards (`analytics:<protocol>:*`, `analytics:l2:*`, `analytics:eth:*`, `simulate:*:smoke`, `crosschain:*` TVL/volume, `catalog`) | Nothing |
| On-chain reads and quotes (`analytics:aave:*`, `analytics:lending:rates`, `analytics:dex:prices`, `simulate:multi:quote`, `crosschain:uniswap:liquidity`) | RPC URLs in `.env` for the chains you query |
| Fork simulations (`fork:<protocol>:<action>`, `npm run fork:all`, `simulate:*:fork`, `simulate:validate:forks`) | RPC + [anvil](https://book.getfoundry.sh/anvil/) (no `PRIVATE_KEY`) |
| `swap:*` examples | RPC + `PRIVATE_KEY` |

> [!WARNING]
> `swap:*` scripts sign with `PRIVATE_KEY` and can broadcast **real transactions**. Use a throwaway wallet, or point the RPC at a local anvil fork (`node scripts/startFork.js`) first.

On-chain quotes and simulations cover 10 EVM chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, zkSync, Scroll, Unichain and Monad (`src/config/chains.js`). Analytics covers any chain DefiLlama tracks. All env vars are listed in [`sample.env`](sample.env).

## Protocols

<!-- catalog:start -->

**179 protocols**, **22 cross-protocol boards/tools**, **503 commands** (not counting repo tooling such as lint and reports). Each name links to its card in the [protocol catalog](docs/02-protocol-catalog.md): every command, what it prints, and what it needs.

| Category | Count | Entries |
|---|---:|---|
| [Spot DEX / AMM](docs/02-protocol-catalog.md#c-dex) | 31 | [Uniswap](docs/02-protocol-catalog.md#p-uniswap) · [Curve Finance](docs/02-protocol-catalog.md#p-curve) · [Balancer](docs/02-protocol-catalog.md#p-balancer) · [SushiSwap](docs/02-protocol-catalog.md#p-sushiswap) · [Aerodrome](docs/02-protocol-catalog.md#p-aerodrome) · [Velodrome](docs/02-protocol-catalog.md#p-velodrome) · [+25 more](docs/02-protocol-catalog.md#c-dex) |
| [Aggregators & intents](docs/02-protocol-catalog.md#c-aggregator) | 8 | [1inch](docs/02-protocol-catalog.md#p-1inch) · [CoW Swap](docs/02-protocol-catalog.md#p-cowswap) · [KyberSwap](docs/02-protocol-catalog.md#p-kyberswap) · [Matcha](docs/02-protocol-catalog.md#p-matcha) · [ParaSwap](docs/02-protocol-catalog.md#p-paraswap) · [Hashflow](docs/02-protocol-catalog.md#p-hashflow) · [+2 more](docs/02-protocol-catalog.md#c-aggregator) |
| [Perps & derivatives](docs/02-protocol-catalog.md#c-perps) | 22 | [Hyperliquid](docs/02-protocol-catalog.md#p-hyperliquid) · [GMX](docs/02-protocol-catalog.md#p-gmx) · [Gains Network](docs/02-protocol-catalog.md#p-gains) · [SynFutures V3](docs/02-protocol-catalog.md#p-synfutures) · [Orderly](docs/02-protocol-catalog.md#p-orderly) · [MUX](docs/02-protocol-catalog.md#p-mux) · [+16 more](docs/02-protocol-catalog.md#c-perps) |
| [Lending & money markets](docs/02-protocol-catalog.md#c-lending) | 23 | [Maple](docs/02-protocol-catalog.md#p-maple) · [Aave](docs/02-protocol-catalog.md#p-aave) · [Morpho](docs/02-protocol-catalog.md#p-morpho) · [Curve Llamalend](docs/02-protocol-catalog.md#p-llamalend) · [Dolomite](docs/02-protocol-catalog.md#p-dolomite) · [Alchemix](docs/02-protocol-catalog.md#p-alchemix) · [+17 more](docs/02-protocol-catalog.md#c-lending) |
| [Vault curators & allocators](docs/02-protocol-catalog.md#c-vaults) | 17 | [Sentora Curator](docs/02-protocol-catalog.md#p-sentora) · [Steakhouse Financial](docs/02-protocol-catalog.md#p-steakhouse) · [RockawayX](docs/02-protocol-catalog.md#p-rockawayx) · [Clearstar](docs/02-protocol-catalog.md#p-clearstar) · [Hyperithm](docs/02-protocol-catalog.md#p-hyperithm) · [Spark Savings Vaults](docs/02-protocol-catalog.md#p-spark-vaults) · [+11 more](docs/02-protocol-catalog.md#c-vaults) |
| [Liquid staking](docs/02-protocol-catalog.md#c-staking) | 15 | [Lido](docs/02-protocol-catalog.md#p-lido) · [SSV Network](docs/02-protocol-catalog.md#p-ssv) · [Rocket Pool](docs/02-protocol-catalog.md#p-rocketpool) · [Coinbase Wrapped Staked ETH](docs/02-protocol-catalog.md#p-cbeth) · [StakeStone](docs/02-protocol-catalog.md#p-stakestone) · [Kintsu](docs/02-protocol-catalog.md#p-kintsu) · [+9 more](docs/02-protocol-catalog.md#c-staking) |
| [Restaking](docs/02-protocol-catalog.md#c-restaking) | 8 | [EigenLayer (EigenCloud)](docs/02-protocol-catalog.md#p-eigenlayer) · [Symbiotic](docs/02-protocol-catalog.md#p-symbiotic) · [ether.fi](docs/02-protocol-catalog.md#p-etherfi) · [Kelp](docs/02-protocol-catalog.md#p-kelp) · [Bedrock](docs/02-protocol-catalog.md#p-bedrock) · [Swell](docs/02-protocol-catalog.md#p-swell) · [+2 more](docs/02-protocol-catalog.md#c-restaking) |
| [Stablecoins & RWA](docs/02-protocol-catalog.md#c-stable-rwa) | 12 | [Sky (ex-Maker)](docs/02-protocol-catalog.md#p-sky) · [Ethena](docs/02-protocol-catalog.md#p-ethena) · [Circle](docs/02-protocol-catalog.md#p-circle) · [Ondo Finance](docs/02-protocol-catalog.md#p-ondo) · [BlackRock BUIDL](docs/02-protocol-catalog.md#p-buidl) · [USD AI](docs/02-protocol-catalog.md#p-usdai) · [+6 more](docs/02-protocol-catalog.md#c-stable-rwa) |
| [Bridges & chains](docs/02-protocol-catalog.md#c-bridge-chain) | 31 | [Stargate Finance](docs/02-protocol-catalog.md#p-stargate) · [Arbitrum Bridge](docs/02-protocol-catalog.md#p-arbitrum) · [Base Bridge](docs/02-protocol-catalog.md#p-base) · [Optimism Bridge](docs/02-protocol-catalog.md#p-optimism) · [World Chain](docs/02-protocol-catalog.md#p-world-chain) · [Starknet Bridge](docs/02-protocol-catalog.md#p-starknet) · [+25 more](docs/02-protocol-catalog.md#c-bridge-chain) |
| [Launchpads, prediction & other](docs/02-protocol-catalog.md#c-other) | 12 | [UNCX Network](docs/02-protocol-catalog.md#p-uncx) · [Metaplex](docs/02-protocol-catalog.md#p-metaplex) · [pump.fun](docs/02-protocol-catalog.md#p-pumpfun) · [Polymarket](docs/02-protocol-catalog.md#p-polymarket) · [Kalshi](docs/02-protocol-catalog.md#p-kalshi) · [Zama](docs/02-protocol-catalog.md#p-zama) · [+6 more](docs/02-protocol-catalog.md#c-other) |
| [Market boards (cross-protocol)](docs/02-protocol-catalog.md#c-boards) | 13 | [Ethereum boards](docs/02-protocol-catalog.md#p-eth) · [ETH vs BTC](docs/02-protocol-catalog.md#p-ethbtc) · [Bitcoin wraps](docs/02-protocol-catalog.md#p-btc) · [L2 overview](docs/02-protocol-catalog.md#p-l2) · [RWA overview](docs/02-protocol-catalog.md#p-rwa) · [NFT markets](docs/02-protocol-catalog.md#p-nft) · [+7 more](docs/02-protocol-catalog.md#c-boards) |
| [Swap & simulation tooling](docs/02-protocol-catalog.md#c-tooling) | 9 | [Quote](docs/02-protocol-catalog.md#p-quote) · [Swap simulation](docs/02-protocol-catalog.md#p-swap) · [Multi-protocol](docs/02-protocol-catalog.md#p-multi) · [Pair sweep](docs/02-protocol-catalog.md#p-pairs) · [Fork validator](docs/02-protocol-catalog.md#p-validate) · [Auto-route swap](docs/02-protocol-catalog.md#p-autoroute) · [+3 more](docs/02-protocol-catalog.md#c-tooling) |

<!-- catalog:end -->

## Claim monitors (2026-10-23)

Window 2026-10-20 21:00Z to 2026-10-22 ~21:00Z. Live numbers move. These scripts print the current values, not the snapshot in the source. Cards and commands are in the [protocol catalog](docs/02-protocol-catalog.md).

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:swell:incident`, `simulate:swell:incident:smoke` | Swell oracle-bot hot keys compromised 2026-10-21; swETH / rswETH rates pushed up ~1%/hour with no new ETH; ~2,513 ETH exposed, no confirmed loss. Reads both rates on-chain vs the pre-incident 1.133254 / 1.082464, plus the DefiLlama `/hacks` row (no amount). Needs `ETHEREUM_RPC_URL`. | [X @odysseas_eth](https://x.com/odysseas_eth/status/2113087137444683860) (2026-10-22, mev gigachads / MEV KOL); [Crypto Briefing](https://cryptobriefing.com/swell-sweth-rsweth-inflated-rates-hot-keys/) (2026-10-22); [0xCERT-2026-0262](https://www.0xcert.com/advisory/0xCERT-2026-0262) (2026-10-22) |
| `analytics:wax:exploit`, `simulate:wax:exploit:smoke` | WAX Multi-Chain Bridge exploited 2026-10-22 via a negative `max_fee` on withdraw (~$90.5K). DefiLlama `/hacks`. | [DefiLlama hacks](https://defillama.com/hacks); [Coinfomania](https://coinfomania.com/wax-suffers-90-5k-loss-due-to-technical-oversight/) (2026-10-22) |
| `analytics:grvt:perps`, `simulate:grvt:perps:smoke` | Grvt Oct 21 snapshot: $446.6M open interest, $36.1M TVL (30d volume $14.75B is paywalled on DefiLlama). | [X @Nick_Researcher](https://x.com/Nick_Researcher/status/2113114914319696263) (2026-10-22, Airdrop?) |
| `analytics:ondo:perps`, `simulate:ondo:perps:smoke` | Ondo Perps $110.35M open interest, ~86% of volume from RWAs. Prints OI and its YTD high. | [X @Nick_Researcher](https://x.com/Nick_Researcher/status/2112763274999800152) (2026-10-21, Airdrop?) |
| `analytics:extended:perps`, `simulate:extended:perps:smoke` | Extended moving all of its ~$117M from Starknet to Arc on 2026-10-22. Prints TVL by chain. | [X @wyckoffweb](https://x.com/wyckoffweb/status/2113306705161281590) (2026-10-22, Airdrop?) |
| `analytics:pancakeswap:aggregator`, `simulate:pancakeswap:aggregator:smoke` | PancakeSwap Aggregator crossed $1B routed volume in 30 days. | [X @PancakeSwap](https://x.com/PancakeSwap/status/2112725564276514924) (2026-10-21, Airdrop?) |
| `analytics:pendle:tvl`, `simulate:pendle:tvl:smoke` | Pendle V2 TVL +43% in Q3 ($809M → $1.16B, Alea Research) while emissions fell 58%. Prints DefiLlama TVL on 2026-06-30 and 2026-09-30 (`DEFILLAMA_TVL_DATES`). | [X @monosarin](https://x.com/monosarin/status/2112867438442189198) (2026-10-21, Airdrop?) |
| `analytics:lighter:revenue`, `simulate:lighter:revenue:smoke` | Lighter Q2 revenue $7.2M, Q3 $8.55M (+19% QoQ). Monthly fees/revenue since April. | [X @TrustlessState](https://x.com/TrustlessState/status/2113267584304857540) (2026-10-22, Inner Circle CT) |
| `analytics:metaplex:revenue`, `simulate:metaplex:revenue:smoke` | Metaplex ($MPLX) $2.2M annual revenue (trailing 30d annualized). | [X @DegenMack](https://x.com/DegenMack/status/2113329230314721648) (2026-10-22, Airdrop?) |
| `analytics:berachain:chain`, `simulate:berachain:chain:smoke` | Berachain lost 99% of its $3.27B peak TVL, down to $32M. | [X @Defi_Warhol](https://x.com/Defi_Warhol/status/2112861733727724013) (2026-10-21, Inner Circle CT) |
| `analytics:rnt:lending`, `simulate:rnt:lending:smoke` | RNT Lend (Aave V3-based, Polygon) "$30M+ market size", ~9.5% APY. Prints TVL + borrowed. | [X @stacy_muur](https://x.com/stacy_muur/status/2113203049879810060) (2026-10-22, Inner Circle CT) |

## Claim monitors (2026-10-21)

Window 2026-10-15 21:00Z to 2026-10-20 ~21:00Z. Live numbers move. These scripts print the current values, not the snapshot in the source. Cards and commands are in the [protocol catalog](docs/02-protocol-catalog.md).

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:papertrade:revenue`, `simulate:papertrade:revenue:smoke` | Papertrade "$50M revenue in its first week". DefiLlama fees/revenue + month-to-date. | [X @patfscott](https://x.com/patfscott/status/2111185661432893613) (2026-10-16, Airdrop? / Inner Circle CT); [X @jussy_world](https://x.com/jussy_world/status/2111814590950711579) (2026-10-18) |
| `analytics:propr:revenue`, `simulate:propr:revenue:smoke` | Propr "zero to $5M in revenue in five months". DefiLlama fees by month (smoke checks 24h fees; net revenue can go negative). | [X @0xOwenThurm](https://x.com/0xOwenThurm/status/2112561870037000471) (2026-10-20, Smart Contract Security) |
| `analytics:popdex:tvl`, `simulate:popdex:tvl:smoke` | PopDEX "near 70M TVL". DefiLlama `popdex-bridge`. | [X @pandaBA007](https://x.com/pandaBA007/status/2112120838975816007) (2026-10-19, Airdrop?) |
| `analytics:plume:vaults`, `simulate:plume:vaults:smoke` | "Plume Vaults has attracted over $250M in RWA TVL". DefiLlama `plume-vaults` by chain. | [X @plumenetwork](https://x.com/plumenetwork/status/2112173816143282305) (2026-10-19, Privacy dashboard update) |
| `analytics:metric:dex`, `simulate:metric:dex:smoke` | Metric "$340M in RWA volume since launch"; ~20% of Robinhood stock-token DEX volume in its first day. DefiLlama `metric-v1` volume by month. | [X @realpepito](https://x.com/realpepito/status/2111843913938207090) (2026-10-18, Airdrop?); [X @Nomaticcap](https://x.com/Nomaticcap/status/2111211943713546518) (2026-10-16, Inner Circle CT) |
| `analytics:hypercall:perps`, `simulate:hypercall:perps:smoke` | Hypercall did more daily perp volume on Hyperliquid than Metamask and other builder front-ends. DefiLlama `hypercall-perps` volume. | [X @trajan0x](https://x.com/trajan0x/status/2111227611292799318) (2026-10-16, Airdrop?) |
| `analytics:fluid:lending`, `simulate:fluid:lending:smoke` | Fluid "$1.77B active loans". DefiLlama `fluid-lending` borrowed by chain + fees/revenue. | [X @DefiIgnas](https://x.com/DefiIgnas/status/2112554133257691275) (2026-10-20, Inner Circle CT) |
| `analytics:stonkfun:revenue`, `simulate:stonkfun:revenue:smoke` | StonkFun "$20.8M in protocol revenue" over 30 days. | [X @SolanaSensei](https://x.com/SolanaSensei/status/2112511403672404403) (2026-10-20, Inner Circle CT) |
| `analytics:collector-crypt:revenue`, `simulate:collector-crypt:revenue:smoke` | Collector Crypt "$24.3M in gross revenue in 24 hours" (DefiLlama books it as volume; fees/revenue are separate). | [X @sjdedic](https://x.com/sjdedic/status/2112628950736237001) (2026-10-20, Inner Circle CT) |
| `analytics:umia:launchpad`, `simulate:umia:launchpad:smoke` | Umia "averaging $300k per day" volume since launch. DefiLlama `umia` volume by month. | [X @merklefruit](https://x.com/merklefruit/status/2111127196349972663) (2026-10-16, Dev Alpha) |
| `analytics:near:intents-volume`, `simulate:near:intents-volume:smoke` | NEAR Intents Q3 volume ~$10.41B, September $4.80B. DefiLlama `near-intents` volume by month. | [X @nansen_ai](https://x.com/nansen_ai/status/2112530026088522110) (2026-10-20, ON CHAIN); [X @NEARProtocol](https://x.com/NEARProtocol/status/2112619862593880571) (2026-10-20, Airdrop?) |
| `analytics:tether:revenue`, `simulate:tether:revenue:smoke` | Tether "$5.79B revenue over the past 12 months". DefiLlama fees with 12 monthly totals. | [X @tokenterminal](https://x.com/tokenterminal/status/2112214218820702318) (2026-10-19, ON CHAIN) |
| `analytics:tron:revenue`, `simulate:tron:revenue:smoke` | Tron "monthly revenue reached $23.41M". DefiLlama fees slug `tron`. | [X @lookonchain](https://x.com/lookonchain/status/2112051216293540072) (2026-10-19, ON CHAIN) |
| `analytics:chains:fees`, `simulate:chains:fees:smoke` | Chain fee claims: Ethereum fees up ~48% over 30 days; ICP, Celestia and Algorand fees near zero relative to valuation. | [X @BitcoinStrat](https://x.com/BitcoinStrat/status/2111120582540718097) (2026-10-16); [ICP](https://x.com/BitcoinStrat/status/2111796169185903091), [Celestia](https://x.com/BitcoinStrat/status/2111812542750511303) (2026-10-18); [X @proofofjake_](https://x.com/proofofjake_/status/2111268012754194496) (2026-10-17); all Airdrop? |
| `analytics:uniswap:revenue`, `simulate:uniswap:revenue:smoke` | Uniswap protocol revenue $14.81M in September 2026. DefiLlama revenue by month. | [X @tokenterminal](https://x.com/tokenterminal/status/2111428989608923206) (2026-10-17, ON CHAIN) |
| `analytics:hyperliquid:fees`, `simulate:hyperliquid:fees:smoke` | Hyperliquid ~$91M trading fees in September. DefiLlama fees by month. | [X @BitcoinStrat](https://x.com/BitcoinStrat/status/2111781997534433773) (2026-10-18, Airdrop?) |
| `analytics:morpho:base-btc`, `simulate:morpho:base-btc:smoke` | Dollar loans against BTC on Morpho Base markets ~$1.6B at a ~5% borrow rate. Morpho GraphQL. | [X @Delphi_Digital](https://x.com/Delphi_Digital/status/2112197769645490434) (2026-10-19, MEV KOL); [X @maikaisogawa](https://x.com/maikaisogawa/status/2112197837496963515) (2026-10-19, Airdrop?) |
| `analytics:fx:morpho-vault`, `simulate:fx:morpho-vault:smoke` | f(x) Ecosystem USDC Morpho vault (RockawayX) at 8.26% with "$20M already in". Vault `0x2cA22cb25558fa2018ecb1CE4eD8AF92Ee7ea423` on Ethereum. | [X @PhilMrlo](https://x.com/PhilMrlo/status/2111175343319245156) (2026-10-16, Airdrop?) |
| `analytics:pumpfun:app`, `simulate:pumpfun:app:smoke` | pump.fun App gives away all app revenue; "paid out nearly $20M in just 2 months". DefiLlama `pump.fun-mobile-app` fees by month. | [X @sue_xbt](https://x.com/sue_xbt/status/2111328921631551595) (2026-10-17, Airdrop?) |
| `analytics:pons:revenue`, `simulate:pons:revenue:smoke` | $PONS daily revenue fell from $2M to $36K. DefiLlama parent `pons` fees/revenue by month. | [X @jussy_world](https://x.com/jussy_world/status/2112438814589571464) (2026-10-20, Inner Circle CT) |
| `analytics:solana:chain`, `simulate:solana:chain:smoke` | Solana DeFi TVL ~$5.85B. DefiLlama chain TVL, DEX volume, fees. | [X @satyamsharma_33](https://x.com/satyamsharma_33/status/2111896253181436399) (2026-10-18, Smart Contract Security) |
| `analytics:starknet:chain`, `simulate:starknet:chain:smoke` | Starknet "TVL stayed around 160 million". DefiLlama chain TVL + DEX volume. | [X @odin_free](https://x.com/odin_free/status/2112076313926533456) (2026-10-19, Airdrop?) |
| `analytics:usdsui:supply`, `simulate:usdsui:supply:smoke` | USDsui "record $80M supply". DefiLlama stablecoins id 373 (supply, change, ATH). | [X @Kylechasse](https://x.com/Kylechasse/status/2111302282700816514) (2026-10-17, Inner Circle CT) |
| `analytics:qubic:exploit`, `simulate:qubic:exploit:smoke` | Qubic network attack 2026-10-17. DefiLlama `/hacks` $1.3M. | [X @WuBlockchain](https://x.com/WuBlockchain/status/2111991201016721809) (2026-10-19, ON CHAIN) |
| `analytics:affluent:exploit`, `simulate:affluent:exploit:smoke` | Affluent (TON) exploit 2026-10-16, ~$1.05M. DefiLlama `/hacks` id 5726. | [DeTracker](https://feed.detracker.xyz/) (2026-10-16); [DefiLlama /hacks](https://defillama.com/hacks) |
| `analytics:alpscon:exploit`, `simulate:alpscon:exploit:smoke` | AlpsCon AI Trade Hub (BSC) exploit 2026-10-19, ~$152.8K, via a whitelisted Hardhat test wallet. | [Tozvan](https://tozvan.com/hacks/alpscon-ai-trade-hub-exploit) (2026-10-19); [telem.news](https://telem.news/security/alpscon-ai-exploited-152k-bnb-chain-whitelisted-hardhat-test-7ef99ce4) (2026-10-19) |

## Claim monitors (2026-10-16)

Live numbers move. These scripts print the current values, not the snapshot in the source. Cards and commands are in the [protocol catalog](docs/02-protocol-catalog.md).

| Monitor | Claim | Sources |
| --- | --- | --- |
| `analytics:uncx:exploit`, `simulate:uncx:exploit:smoke` | UNCX Vesting V2 exploit 2026-10-14; DefiLlama `/hacks` ~$86K vs Blockaid/news ~$1.49M later. | [The Defiant](https://thedefiant.io/news/hacks/uncx-vesting-pool-exploited-for-about-86-000-blockaid-says) (2026-10-14); [Crypto Times](https://www.cryptotimes.io/2026/10/15/uncx-exploit-escalates-vesting-v2-bug-drains-1-5m-across-4-chains-as-copycats-join-in/) (2026-10-15) |
| `analytics:pendle:hy-vault`, `simulate:pendle:hy-vault:smoke` | Pendle Ecosystem High Yield USDC Morpho vault ~$15.76M in a day (Ethereum). | [Crypto Briefing](https://cryptobriefing.com/pendle-high-yield-usdc-vault-morpho/) (2026-10-15) |
| `analytics:curve:lending`, `simulate:curve:lending:smoke` | Curve LlamaLend active loans +68% in Q3 to $70.9M (V1+V2 borrowed sum). | [crypto.news](https://crypto.news/curve-finance-loans-climb-68-in-q3-as-defi-lending/) (2026-10-15) |
| `analytics:balancer:protocol`, `simulate:balancer:protocol:smoke` | Balancer shutdown / withdrawals-only from 2026-10-30; DefiLlama fees line. | [rekt.news](https://www.rekt.news/out-of-balance) (2026-10-14) |
| `analytics:alchemix:base`, `simulate:alchemix:base:smoke` | Alchemix Base TVL ~$2.38M. | [X @scupytrooples](https://x.com/scupytrooples/status/2110721103853400532) (2026-10-15) |

## Claim monitors (2026-10-12)

Live values, not the snapshot in the source. Cards and commands are in the [protocol catalog](docs/02-protocol-catalog.md).

| Monitor | Claim | Sources |
| --- | --- | --- |
| `analytics:liquid:reserves`, `simulate:liquid:smoke` | Liquid Network peg-outs stay frozen 35 days after the 2026-09-06 Elements exploit; the federation reserve is ~603 BTC short of circulating L-BTC (85.8% coverage), and redemptions need full 1:1 backing plus security reviews. Reads the public liquid.network audit API (`/pegs`, `/reserves`, monthly series); peg-out status itself is not exposed. | [The Defiant](https://thedefiant.io/news/security/liquid-bitcoin-redemptions-remain-frozen-with-85-8-reserve-coverage) (2026-10-11); [TokenPost](https://www.tokenpost.com/news/technology/29859) (2026-10-11); [Crypto Briefing](https://cryptobriefing.com/liquid-network-halts-bitcoin-redemptions-reserve-gap/) (2026-10-11) |

## Claim monitors (2026-10-09)

Live DefiLlama windows, not the snapshot in the source. Cards and commands are in the [protocol catalog](docs/02-protocol-catalog.md).

| Monitor | Claim | Sources |
| --- | --- | --- |
| `analytics:lighter:perps`, `simulate:lighter:smoke` | Lighter open interest hit a 2026 high; Robinhood partnership ~a quarter of OI and fee revenue, nearly 40% of daily active accounts. Now prints OI and its YTD high (`DEFILLAMA_OI=1 DEFILLAMA_OI_HIGH=1`); the smoke requires positive OI. | [TokenPost](https://www.tokenpost.com/news/business/28319) (2026-10-08); [Coinfomania](https://coinfomania.com/lighter-exchange-hits-2026-high-in-open-interest/) (2026-10-08); [X](https://x.com/Delphi_Digital/status/2108206129574539702) (2026-10-08) |
| `analytics:papertrade:perps`, `simulate:papertrade:smoke` | Papertrade (HyperEVM perps) opened pre-deposits 2026-10-08 with live trading expected after the 2026-10-10 HyperEVM upgrade; ~$25M in user deposits before launch (single X post). | [DeFi Prime](https://defiprime.com/papertrade-opens-predeposits-before-hyperevm-launch) (2026-10-09); [SignalPlus](https://t.signalplus.com/crypto-news/detail/papertrade-opens-predeposits-ahead-october-trading-launch?lang=en-US) (2026-10-08); [X](https://x.com/zoomerfied/status/2108565430499717403) (2026-10-09) |
| `analytics:stellar:chain`, `simulate:stellar:smoke` | Stellar DeFi TVL record of nearly $273M on 2026-10-02 (from ~$265M a week earlier). Chain name `Stellar`. | [BSC News](https://bsc.news/news/stellar-defi-tvl-record-rwa) (2026-10-05); [Blockonomi](https://blockonomi.com/stellar-defi-hits-new-tvl-record-as-active-wallets-near-100000/) (2026-10-03) |
| `analytics:near:exploit`, `simulate:near:exploit:smoke` | NEAR Intents exploited for ~$3.8M (USDT on BNB Chain, Sep 30 to Oct 1); funds returned in full 2026-10-02. Read from DefiLlama `/hacks` (id 6225); returned funds are not recorded there. | [Cointelegraph](https://cointelegraph.com/news/near-intents-recovers-entire-stolen-38m-after-ultimatum-to-exploiter) (2026-10-03); [Decrypt](https://decrypt.co/380014/near-intents-recovers-3-8-million-after-48-hour-ultimatum) (2026-10-04); [X](https://x.com/zacodil/status/2108480859942555933) (2026-10-09) |

## Claim monitors (2026-10-07)

Live DefiLlama windows, not the snapshot in the source. Cards and commands are in the [protocol catalog](docs/02-protocol-catalog.md).

| Monitor | Claim | Sources |
| --- | --- | --- |
| `analytics:abstract:chain`, `simulate:abstract:smoke` | Abstract (Ethereum L2) winds down; chain shuts down 2026-12-15 and funds not bridged out become inaccessible. Peaked ~$57M TVL / $32M daily DEX volume; reported ~$9.5M TVL / ~$316K DEX volume. | [The Block](https://www.theblock.co/news/ecosystems/2026-10-06-abstract-ethereum-layer-2-shutting-down-pudgy-penguins-igloo-417855) (2026-10-06); [TokenPost](https://www.tokenpost.com/news/technology/27126) (2026-10-07); [X](https://x.com/NickPreszler/status/2107574455106994679) (2026-10-06) |
| `analytics:derive:options`, `simulate:derive:smoke` | September onchain options notional more than doubled to ~$4.83B (+121.7% MoM). Derive ~$3.8B, share 88.1% → 79.3%. Paradex notional +285%, OI >$250M. Hypercall ~11.2% share (TVL only; volume is not tracked on DefiLlama). | [CryptoBriefing](https://cryptobriefing.com/derive-leads-onchain-options-volume-doubles/) (2026-10-05); [Coinfomania](https://coinfomania.com/onchain-options-market-surges-to-4-83b-as-competition-grows/) (2026-10-05); [X](https://x.com/Delphi_Digital/status/2107083828389187613) (2026-10-05) |
| `analytics:robinhood:chain`, `simulate:robinhood:smoke` | Robinhood Chain, about three months old: ~$1.04B TVL, ~$5M app fees in 24h, ~$1.5B DEX volume. | [X](https://x.com/ripchillpill/status/2106018905907237207) (2026-10-02) |

## Command families

| Family | What it does |
| --- | --- |
| `analytics:*` | Live snapshot: TVL by chain, rates, fees/revenue, pool state |
| `simulate:*:smoke` | Pass/fail check of the same data source; non-zero exit when it breaks |
| `simulate:*` | Quotes, fork reads, and fill replays |
| `swap:*` | Wallet-backed swap examples |
| `crosschain:*` | One protocol aggregated across chains (Uniswap, Curve, Balancer, SushiSwap); weekly variants write CSV to `output/` |
| `report:*` | Run a whole family and write a pass/fail report to `output/` |

## Use as a library

It's CLI-first, but the building blocks are plain CommonJS modules you can `require` from a clone (run from the repo root so `.env` is picked up; `getBestQuote` logs each venue as it goes):

```js
const { ethers } = require("ethers");
const { getBestQuote } = require("./src/swaps/dexAggregator");
const { COMMON_TOKENS } = require("./src/config/chains");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("./src/analytics/utils/defiLlamaProtocol");

(async () => {
  const aave = await fetchDefiLlamaProtocol("aave-v3");
  console.log(lastTvlUsdFromSeries(aave.tvl)); // 18100598067

  const { WETH, USDC } = COMMON_TOKENS;
  const best = await getBestQuote("ethereum", WETH.ethereum, USDC.ethereum, ethers.parseEther("1").toString());
  console.log(best.protocol, best.version, best.amountOut); // uniswap v3 2674176801 (USDC, 6 decimals)
})();
```

Useful entry points: `src/config/chains.js` (RPCs, router/quoter/pool addresses for 10 chains), `src/swaps/` (Uniswap V2/V3/V4, SushiSwap, Curve, Balancer quotes and swaps), `src/analytics/utils/defiLlamaProtocol.js` (DefiLlama protocol, fees and chain fetchers).

## Repo layout

```
src/
  catalog/         # protocols.js registry → npm run catalog / catalog:docs / catalog:check
  config/          # chains.js (RPC + protocol addresses), pairs.js
  utils/           # web3 provider, validation, token helpers
  abis/            # contract ABIs
  swaps/           # Uniswap V2/V3/V4, Sushi, Curve, Balancer, dexAggregator
  simulation/      # fork quotes, fork:<protocol>:<action>, lending/staking/UniswapX sims, DefiLlama smokes
  analytics/       # protocols/<name>/ monitors + aggregators/ + ranking/ + nft/ + airdrop/
  crosschain/      # Uniswap/Curve/Balancer/Sushi TVL + volume trackers
  examples/        # CLI demos of swap/quote flows
scripts/           # catalog, startFork, forkSuite, validateForkSimulations, healthCheckReport
docs/              # architecture, coverage notes, showcase ranking, fork testing, generated protocol catalog
showcase/          # static top-200 page (index.html, protocol.html, data.json)
```

Deeper reading: [architecture](docs/00-architecture.md) · [coverage notes and scope](docs/01-protocol-script-coverage.md) · [full protocol catalog](docs/02-protocol-catalog.md).

## Contributing

Issues and PRs welcome, especially new protocols. A DefiLlama-listed protocol is two npm scripts plus one catalog entry.

**Add a protocol in 3 steps:**

1. Add the npm scripts to `package.json`. For a DefiLlama-listed protocol that's two lines: copy `analytics:aster:perps` and `simulate:aster:smoke` and change the slug ([recipes](docs/01-protocol-script-coverage.md#adding-a-missing-protocol)).
2. Add one entry to `PROTOCOLS` in [`src/catalog/protocols.js`](src/catalog/protocols.js): id, name, category, url, and a one-line `about`.
3. Run `npm run catalog:docs`, then `npm run lint && npm run catalog:check` (CI runs the same).

**Wanted:** Milk Road Swap, Soneium DEX and MegaETH AMM (waiting on a DefiLlama listing), and Slipstream-native quotes for Aerodrome/Velodrome (today they quote Uniswap V3 as a reference).

**Guidelines:** follow the existing style (`npm run prettier`), keep scripts general-purpose (no MEV bots or personal strategies), and never commit `.env` or keys.

## License

MIT. If this saved you a dashboard tab, a ⭐ helps others find it.

<p align="center">
  <img src="no-money-meme.jpg" alt="No Money Meme" width="320"/>
</p>
