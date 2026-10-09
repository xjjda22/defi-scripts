# defi-scripts

> **Live DeFi data, DEX quotes and fork simulations from your terminal.** 100+ protocols, 300+ commands, one naming scheme. Most need no API key.

[![CI](https://github.com/xjjda22/defi-scripts/actions/workflows/ci.yml/badge.svg)](https://github.com/xjjda22/defi-scripts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![EVM chains](https://img.shields.io/badge/EVM_chains-10-orange.svg)](#what-you-need)
[![Protocols](https://img.shields.io/badge/protocols-109-purple.svg)](docs/02-protocol-catalog.md)

Where is the best USDC borrow rate right now, across Aave and Morpho, on five chains? One command:

```text
$ npm run analytics:lending:rates

Cross-chain — best supply & borrow per asset (all chains scanned)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Asset   Best supply                 Best borrow                 Notes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USDC    Morpho 5.95% @ Arbitrum     Aave 3.83% @ Optimism
USDT    Aave 3.70% @ Ethereum       Morpho 2.61% @ Polygon
DAI     Aave 4.68% @ Polygon        Morpho 4.46% @ Ethereum
WETH    Morpho 3.36% @ Ethereum     Morpho 1.36% @ Optimism
WBTC    Morpho 0.12% @ Ethereum     Morpho 0.14% @ Ethereum     same chain+protocol
```

<sub>Live output captured 2026-10-03. Aave is read on-chain (one RPC URL per chain: Ethereum, Arbitrum, Optimism, Base, Polygon; chains without one are skipped), Morpho comes from its public API. Your numbers will differ.</sub>

## Contents

[Try it](#try-it-in-60-seconds) · [More output](#more-output) · [Why this repo](#why-this-repo) · [What you need](#what-you-need) · [Protocols](#protocols) · [Command families](#command-families) · [Use as a library](#use-as-a-library) · [Repo layout](#repo-layout) · [Contributing](#contributing)

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

## What you need

| Commands | Needs |
| --- | --- |
| DefiLlama monitors and boards (`analytics:<protocol>:*`, `analytics:l2:*`, `analytics:eth:*`, `simulate:*:smoke`, `crosschain:*` TVL/volume, `catalog`) | Nothing |
| On-chain reads and quotes (`analytics:aave:*`, `analytics:lending:rates`, `analytics:dex:prices`, `simulate:multi:quote`, `crosschain:uniswap:liquidity`) | RPC URLs in `.env` for the chains you query |
| Fork simulations (`simulate:*:fork`, `simulate:validate:forks`) | RPC + [anvil](https://book.getfoundry.sh/anvil/) |
| `swap:*` examples | RPC + `PRIVATE_KEY` |

> [!WARNING]
> `swap:*` scripts sign with `PRIVATE_KEY` and can broadcast **real transactions**. Use a throwaway wallet, or point the RPC at a local anvil fork (`node scripts/startFork.js`) first.

On-chain quotes and simulations cover 10 EVM chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, zkSync, Scroll, Unichain and Monad (`src/config/chains.js`). Analytics covers any chain DefiLlama tracks. All env vars are listed in [`sample.env`](sample.env).

## Protocols

<!-- catalog:start -->

**114 protocols**, **21 cross-protocol boards/tools**, **329 commands** (not counting repo tooling such as lint and reports). Each name links to its card in the [protocol catalog](docs/02-protocol-catalog.md): every command, what it prints, and what it needs.

| Category | Count | Entries |
|---|---:|---|
| [Spot DEX / AMM](docs/02-protocol-catalog.md#c-dex) | 29 | [Uniswap](docs/02-protocol-catalog.md#p-uniswap) · [Curve Finance](docs/02-protocol-catalog.md#p-curve) · [Balancer](docs/02-protocol-catalog.md#p-balancer) · [SushiSwap](docs/02-protocol-catalog.md#p-sushiswap) · [Aerodrome](docs/02-protocol-catalog.md#p-aerodrome) · [Velodrome](docs/02-protocol-catalog.md#p-velodrome) · [+23 more](docs/02-protocol-catalog.md#c-dex) |
| [Aggregators & intents](docs/02-protocol-catalog.md#c-aggregator) | 10 | [1inch](docs/02-protocol-catalog.md#p-1inch) · [CoW Swap](docs/02-protocol-catalog.md#p-cowswap) · [KyberSwap](docs/02-protocol-catalog.md#p-kyberswap) · [Matcha](docs/02-protocol-catalog.md#p-matcha) · [Odos](docs/02-protocol-catalog.md#p-odos) · [ParaSwap](docs/02-protocol-catalog.md#p-paraswap) · [+4 more](docs/02-protocol-catalog.md#c-aggregator) |
| [Perps & derivatives](docs/02-protocol-catalog.md#c-perps) | 22 | [Hyperliquid](docs/02-protocol-catalog.md#p-hyperliquid) · [GMX](docs/02-protocol-catalog.md#p-gmx) · [Gains Network](docs/02-protocol-catalog.md#p-gains) · [SynFutures V3](docs/02-protocol-catalog.md#p-synfutures) · [Orderly](docs/02-protocol-catalog.md#p-orderly) · [MUX](docs/02-protocol-catalog.md#p-mux) · [+16 more](docs/02-protocol-catalog.md#c-perps) |
| [Lending & money markets](docs/02-protocol-catalog.md#c-lending) | 12 | [Aave](docs/02-protocol-catalog.md#p-aave) · [Morpho](docs/02-protocol-catalog.md#p-morpho) · [Spark](docs/02-protocol-catalog.md#p-spark) · [Nostra Finance](docs/02-protocol-catalog.md#p-nostra) · [Suilend](docs/02-protocol-catalog.md#p-suilend) · [Benqi Lending](docs/02-protocol-catalog.md#p-benqi) · [+6 more](docs/02-protocol-catalog.md#c-lending) |
| [Vault curators & allocators](docs/02-protocol-catalog.md#c-vaults) | 5 | [Sentora Curator](docs/02-protocol-catalog.md#p-sentora) · [Steakhouse Financial](docs/02-protocol-catalog.md#p-steakhouse) · [Upshift](docs/02-protocol-catalog.md#p-upshift) · [Keyrock Prime USDC](docs/02-protocol-catalog.md#p-keyrock) · [Concrete](docs/02-protocol-catalog.md#p-concrete) |
| [Liquid staking](docs/02-protocol-catalog.md#c-staking) | 8 | [Lido](docs/02-protocol-catalog.md#p-lido) · [StakeStone](docs/02-protocol-catalog.md#p-stakestone) · [Kintsu](docs/02-protocol-catalog.md#p-kintsu) · [Jito](docs/02-protocol-catalog.md#p-jito) · [Sanctum](docs/02-protocol-catalog.md#p-sanctum) · [DFDV Staked SOL](docs/02-protocol-catalog.md#p-dfdv) · [+2 more](docs/02-protocol-catalog.md#c-staking) |
| [Restaking](docs/02-protocol-catalog.md#c-restaking) | 7 | [EigenLayer (EigenCloud)](docs/02-protocol-catalog.md#p-eigenlayer) · [ether.fi](docs/02-protocol-catalog.md#p-etherfi) · [Kelp](docs/02-protocol-catalog.md#p-kelp) · [Bedrock](docs/02-protocol-catalog.md#p-bedrock) · [Swell](docs/02-protocol-catalog.md#p-swell) · [Renzo](docs/02-protocol-catalog.md#p-renzo) · [+1 more](docs/02-protocol-catalog.md#c-restaking) |
| [Stablecoins & RWA](docs/02-protocol-catalog.md#c-stable-rwa) | 6 | [Sky (ex-Maker)](docs/02-protocol-catalog.md#p-sky) · [Ethena](docs/02-protocol-catalog.md#p-ethena) · [Circle](docs/02-protocol-catalog.md#p-circle) · [Ondo Finance](docs/02-protocol-catalog.md#p-ondo) · [BlackRock BUIDL](docs/02-protocol-catalog.md#p-buidl) · [USD AI](docs/02-protocol-catalog.md#p-usdai) |
| [Bridges & chains](docs/02-protocol-catalog.md#c-bridge-chain) | 10 | [Stargate Finance](docs/02-protocol-catalog.md#p-stargate) · [Meter Passport](docs/02-protocol-catalog.md#p-meter) · [Gravity by Galxe](docs/02-protocol-catalog.md#p-gravity) · [Payy Network](docs/02-protocol-catalog.md#p-payy) · [Arc Chain](docs/02-protocol-catalog.md#p-arc) · [Blast](docs/02-protocol-catalog.md#p-blast) · [+4 more](docs/02-protocol-catalog.md#c-bridge-chain) |
| [Launchpads, prediction & other](docs/02-protocol-catalog.md#c-other) | 5 | [pump.fun](docs/02-protocol-catalog.md#p-pumpfun) · [Polymarket](docs/02-protocol-catalog.md#p-polymarket) · [Zama](docs/02-protocol-catalog.md#p-zama) · [Aztec](docs/02-protocol-catalog.md#p-aztec) · [Bitget](docs/02-protocol-catalog.md#p-bitget) |
| [Market boards (cross-protocol)](docs/02-protocol-catalog.md#c-boards) | 12 | [Ethereum boards](docs/02-protocol-catalog.md#p-eth) · [ETH vs BTC](docs/02-protocol-catalog.md#p-ethbtc) · [Bitcoin wraps](docs/02-protocol-catalog.md#p-btc) · [L2 overview](docs/02-protocol-catalog.md#p-l2) · [RWA overview](docs/02-protocol-catalog.md#p-rwa) · [NFT markets](docs/02-protocol-catalog.md#p-nft) · [+6 more](docs/02-protocol-catalog.md#c-boards) |
| [Swap & simulation tooling](docs/02-protocol-catalog.md#c-tooling) | 9 | [Quote](docs/02-protocol-catalog.md#p-quote) · [Swap simulation](docs/02-protocol-catalog.md#p-swap) · [Multi-protocol](docs/02-protocol-catalog.md#p-multi) · [Pair sweep](docs/02-protocol-catalog.md#p-pairs) · [Fork validator](docs/02-protocol-catalog.md#p-validate) · [Auto-route swap](docs/02-protocol-catalog.md#p-autoroute) · [+3 more](docs/02-protocol-catalog.md#c-tooling) |

<!-- catalog:end -->

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
  simulation/      # fork quotes, lending/staking/UniswapX sims, DefiLlama smokes
  analytics/       # protocols/<name>/ monitors + aggregators/ + nft/ + airdrop/
  crosschain/      # Uniswap/Curve/Balancer/Sushi TVL + volume trackers
  examples/        # CLI demos of swap/quote flows
scripts/           # catalog, startFork, validateForkSimulations, healthCheckReport
docs/              # architecture, coverage notes, generated protocol catalog
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
