# Trending showcase

A static top-200 board of DeFi protocols trending over the last six months, plus the same score broken out across the twelve catalog categories. The page is `showcase/index.html`. The numbers are `showcase/data.json`, produced by `npm run ranking:top200` (the same script as `npm run showcase:build`).

Architecture: [`00-architecture.md`](./00-architecture.md). Category ids match [`src/catalog/protocols.js`](../src/catalog/protocols.js).

## Refresh

```bash
npm run showcase:build          # reuse data/x-mentions.json
node scripts/showcaseCheck.js   # offline check of showcase/data.json (CI runs it too)
npm run showcase:serve          # http://127.0.0.1:4173 (HOST=0.0.0.0 to share on a LAN)
```

To recount X mentions from a directory of list reads:

```bash
X_MENTIONS_DIR=/path/to/list-reads npm run showcase:build
```

A build pulls about 800 protocol histories from DefiLlama. `RANKING_CACHE_DIR=/tmp/llama-cache` keeps each TVL series on disk for 20 hours, so a second run the same day takes seconds. `RANKING_CONCURRENCY` (default 6) sets the parallel pulls.

The script exits non-zero when `GET /protocols` fails, or when more than 5% of the history pulls fail (the growth terms would be unreliable). A failed fees or volume overview is a warning and that input stays neutral.

### Monday / Wednesday / Friday

The board is a snapshot. Refresh it with the claims run:

1. Put that run's X list reads (raw post JSON, or the markdown notes with status links) in a directory and run `X_MENTIONS_DIR=... npm run showcase:build`. Without new reads, run `npm run showcase:build` alone; the committed mention file is reused.
2. `node scripts/showcaseCheck.js`, then commit `showcase/data.json` and `data/x-mentions.json`.
3. Merge to `main`.

[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) publishes `showcase/` on a push that touches the showcase, the ranking code or `data/x-mentions.json`, every Monday, Wednesday and Friday at 05:30 Malaysia time, and on a manual run. Each deploy rebuilds `data.json` from DefiLlama first (X mentions come from the committed file) and falls back to the committed `data.json` when the rebuild or its check fails. In the repo settings, GitHub Pages must use **Source: GitHub Actions**. [`.github/workflows/showcase-refresh.yml`](../.github/workflows/showcase-refresh.yml) rebuilds `data.json` and commits it to the branch it runs on: automatically when a feature branch changes the ranking code or the mention file, and on a manual run.

## Rows

Eligible rows come from `GET https://api.llama.fi/protocols`. A protocol qualifies with at least **$5M** TVL, or **$100k** of 30-day fees, or **$5M** of 30-day volume.

**Excluded** (counted in `stats.excluded`): `CEX`, `Ponzi`, `Token Locker` (team tokens parked in a vesting contract are not DeFi usage), and a few non-DeFi fee earners (`Coins Tracker`, `Domains`, `Foundation`, `Physical TCG`, `Luck Games`, `Gamified Mining`). Fee rows that DefiLlama marks `protocolType: "chain"` are a chain's own gas fees (Ethereum, Solana, Tron) and are ignored, so whole chains do not enter on the fees floor.

**One row per protocol family and category.** DefiLlama splits many protocols into children that share a `parentProtocol` (Aave V2/V3/V4, Uniswap V2/V3/V4, Morpho Blue and Midnight). Children of one parent that land in the same showcase category are summed into one row named after the parent (from `GET /lite/protocols2`). Children in different categories stay separate, with the category in the name: `Jupiter Lend`, `Jupiter Perpetual Exchange`, `Lighter (Perps)` and `Lighter Bridge` are different rows. The row's **Details** lists the children it combines. This is what stops a new version (Aave V4) from taking a top-10 slot on its own launch growth.

Chains are represented by their canonical-bridge row where DefiLlama has one (Base Bridge, Arbitrum Bridge, Robinhood Chain Bridge). Chain-level TVL is not a separate row.

## Score

Every input becomes a **percentile** (0 to 1, ties share the average rank) across all eligible rows. A missing input scores 0.5, so a protocol without a fees adapter is neither helped nor punished.

| Input | Weight | Definition |
| --- | --- | --- |
| size | 0.35 | TVL, ranked among rows with at least $5M TVL. A row below that is ranked on its 30-day fees among every row's fees (or, without fees, its 30-day volume), so TVL, fee and volume dollars are never compared directly. |
| growth | 0.25 | `ln(TVL now / max(TVL 180 days ago, $1M))`, unclamped. The $1M floor stops a dust baseline from reading as a thousand-fold move. |
| tvlAdded | 0.20 | TVL now minus TVL 180 days ago, in dollars. This is what lets Morpho (+$3.9B) outrank a protocol that went from $30M to $300M. |
| feesMomentum | 0.12 | `ln(fees last 30d / fees previous 30d)`, only when both windows are at least $10k. |
| volumeMomentum | 0.08 | The same on 30-day volume, both windows at least $1M: spot DEX volume, then aggregator volume, then options volume. Perp volume needs DefiLlama's paid API, so perps lean on fees. |

```text
score = 0.35·size + 0.25·growth + 0.20·tvlAdded + 0.12·feesMomentum + 0.08·volumeMomentum
        + 0.012 · min(X posts, 6)
```

The X bonus caps at **+0.072**, about a quarter of the spread between a median and a top-decile row on one input, so mentions break near-ties but do not lift a small protocol over a large grower. Ties break by TVL, then id. `components` on each row stores its percentiles, and the page shows them under **Details**.

**Why percentiles.** The first version z-scored a growth figure clamped to a 0.2×–5× move. Every protocol launched in the last six months hit the 5× cap together (+400%), and the z-score made that cap worth more than Morpho's $3.9B of growth, so the top 10 filled with new listings (Aave V4, Fables, Robinhood Chain Bridge, Lighter Robinhood Perps, RockawayX, Jupiter Lend DEX). Percentiles cannot saturate, and ranking unclamped growth removes the ties.

**New listings.** A family with no TVL sample on or before the 180-day cutoff is **New**. Its relative growth is neutral (0.5), because a launch is not a six-month trend, and `tvlAdded` is the TVL it has gathered since its first sample. The page shows a New badge with the age in days.

**Rows with only fees or volume** (aggregators, prediction markets, launchpads) have no TVL history. Their growth and TVL-added inputs are neutral, and size comes from fees or volume.

## X mentions

`src/analytics/ranking/mentions.js` counts **distinct posts** from the user's X lists that name a row:

- Input files: raw post JSON (an array, `{ posts }`, or the X API `{ data }` shape) and markdown list notes. In notes only lines with an `x.com/<user>/status/<id>` link count, filed under the nearest `## <list>` heading.
- Files named `daily-*` are skipped. Those are this repo's own claim write-ups; counting them would reward a protocol for already having a monitor.
- Posts are de-duplicated by status id, so a post read on two days, or on two lists, counts once. A post counts once per row however often it repeats the name.
- Patterns: the row name, each child's name and slug, the parent name when the family has a single row, and a short alias map (`EigenLayer` for `eigencloud`, `weETH` for ether.fi, `Morpho` for `morpho-blue`). Matching is on word boundaries, so `Aave` does not hit `Aavegotchi`.
- Names that are ordinary words or four letters or fewer (`Lighter`, `Sky`, `Drift`, `Concrete`, `Fluid`, `GMX`) match case-sensitively only: Title case, ALL CAPS or a `$TICKER`. Category words (`swap`, `bridge`, `pool`) and names too generic even when capitalised (`World`, `Quote`, `Exactly`, `Unit`) are never used.

`data/x-mentions.json` keeps the corpus summary (post count, date range, list names) and, per row, `id`, `name`, `count`, `lastSeen` and `lists`. No post text.

## Categories

DefiLlama's own category decides, through `LLAMA_TO_CATEGORY` in `src/analytics/ranking/categoryMap.js`. `SLUG_OVERRIDES` is a short, commented exception list:

| Slug | Llama says | Showcase | Why |
| --- | --- | --- | --- |
| `sky-lending`, `sky-money`, `sky-rwa` | CDP / Risk Curators / RWA | Stablecoins & RWA | Sky is the USDS/DAI issuer |
| `near-intents` | Bridge | Aggregators & intents | Cross-chain intents venue |
| `ether.fi-stake` | Liquid Staking | Restaking | eETH/weETH is a liquid restaking token |
| `symbiotic` | Collateral Markets | Restaking | Restaking protocol |
| `alchemix`, `alchemix-v3` | Synthetics | Lending | Self-repaying loans |

The catalog card's category is only a fallback for a Llama category the map does not know yet; the build prints any such category so it can be added. Catalog links (script slug, exact name, or `CATALOG_ALIASES`) attach npm scripts but never move a row. Two rows the first version misfiled: **Fables** is a ve(3,3) DEX on Robinhood Chain (Llama `Dexs`) and stays under Spot DEX; **Jupiter Lend DEX** is the AMM on Jupiter Lend (Llama `Dexs`) and moves to Spot DEX.

| Id | Label | DefiLlama categories |
| --- | --- | --- |
| `dex` | Spot DEX / AMM | Dexs |
| `aggregator` | Aggregators & intents | DEX Aggregator, Bridge Aggregator(s) |
| `perps` | Perps & derivatives | Derivatives, Options, Options Vault, Exotic Options, Synthetics, Interest Rate Derivatives |
| `lending` | Lending & money markets | Lending, CDP, CDP Manager, Uncollateralized / NFT Lending, Leveraged Farming, Collateral Management, Collateral Markets |
| `vaults` | Vault curators & allocators | Risk Curators, Onchain Capital Allocator, Yield Aggregator, Yield, Liquidity Manager / Automation, Treasury Manager, Indexes |
| `staking` | Liquid staking | Liquid Staking, Staking Pool, Anchor BTC, Decentralized BTC |
| `restaking` | Restaking | Restaking, Liquid Restaking, Restaked BTC |
| `stable-rwa` | Stablecoins & RWA | RWA, Stablecoin Issuer / Wrapper, Algo-Stables, Dual-Token and Partially Algorithmic Stablecoins, Reserve Currency, Basis Trading |
| `bridge-chain` | Bridges & chains | Bridge, Canonical Bridge, Cross Chain Bridge, Cross Chain, Chain |
| `other` | Launchpads, prediction & other | Launchpad, Prediction Market, Farm, NFT, Gaming, Privacy, Services, Interface, Trading App, Telegram Bot, MEV, Block Builders, Oracle, Wallets, Payments, Insurance, CeDeFi, Crypto Card Issuer, and the rest |
| `boards` | Market boards (cross-protocol) | Catalog `BOARDS` with `group: "boards"` |
| `tooling` | Swap & simulation tooling | Catalog `BOARDS` with `group: "tooling"` |

The last two tabs are not DefiLlama protocols. They list the repo's cross-protocol boards and swap/simulation commands in catalog order. Each category tab keeps its top 100 rows (plus any row in the overall top 200), then appends catalog protocols that did not clear the floor, so every monitor stays visible.

`coverage` is `covered by a dedicated monitor` when one of the row's children matches a catalog protocol with its own npm scripts, and `ranking only` otherwise. Each script carries the file it runs; the page links it to the source on GitHub.

## Output

`showcase/data.json`: `generatedAt`, `methodology` (weights, floors, endpoints, exclusions, mention corpus), `categories` (label, row count, eligible count, how many made the top 200), `overall` (200 rows), `byCategory`, and `stats` (`dedicatedMonitor` vs `rankingOnly` in the top 200, `newInTop200`, history misses, exclusions).

Each scored row: `rank`, `overallRank`, `id`, `name`, `slug` (DefiLlama slug, the parent's for a combined row), `category`, `llamaCategories`, `members` (combined children), `tvl`, `tvl6mAgo`, `tvlAdded6m`, `tvlChange6m` (percent against `max(tvl6mAgo, $1M)`), `isNew`, `ageDays`, `fees30d`, `feesChange30d`, `volume30d`, `volumeChange30d`, `xMentions`, `xLists`, `llamaUrl`, `appUrl`, `chainTvls` (up to eight chains, borrowed rows omitted), `scripts` (`{ name, file, kind }`), `testing` (`mode` `fork` or `api-only`, copy-paste commands, contracts, category recipe), `coverage`, `score`, `components`.

Open a protocol with `#p=<slug>` or `protocol.html?slug=<slug>`. The panel lists scripts, fork commands, contracts and testnet faucets. How that maps onto `fork:*` is in [04-fork-testing.md](./04-fork-testing.md). `stats.forkInTop200` and `stats.apiOnlyInTop200` count the top 200.

Paid endpoints are not used: no `/summary/derivatives`, no `pro-api.llama.fi`. Calls: `/protocols`, `/lite/protocols2`, `/protocol/{slug}` (rows with at least $5M TVL), `/overview/fees`, `/overview/dexs`, `/overview/aggregators`, `/overview/options`.
