# Trending showcase

A static top-200 board of DeFi protocols, plus the same score broken out across the twelve catalog categories. The page is `showcase/index.html`. The numbers are `showcase/data.json`, produced by `npm run ranking:top200` (the same script as `npm run showcase:build`).

Architecture: [`00-architecture.md`](./00-architecture.md). Category ids match [`src/catalog/protocols.js`](../src/catalog/protocols.js).

## Refresh

```bash
npm run showcase:build          # reuse data/x-mentions.json
npm run showcase:serve          # http://127.0.0.1:4173
```

To recount X notes (markdown, not the uploaded tarball):

```bash
X_MENTIONS_DIR=/path/to/notes npm run showcase:build
```

That rewrites `data/x-mentions.json` (protocol name, count, last-seen date, list names) and `showcase/data.json`. The script exits non-zero only when `GET /protocols` fails. A single protocol history miss, or a failed fees or volume overview, is a warning and that component stays neutral.

### Monday / Wednesday / Friday

The board is a snapshot, not a live websocket. Refresh it three times a week so GitHub Pages does not serve a stale week:

1. On Monday, Wednesday and Friday, drop new list notes into a directory and run `X_MENTIONS_DIR=... npm run showcase:build`. If there are no new notes, run `npm run showcase:build` alone; the committed mention file is reused and the bonus stays put.
2. Commit `showcase/data.json` and `data/x-mentions.json`.
3. Push to `main`.

[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) publishes the `showcase/` folder on every push to `main`. In the repo settings, GitHub Pages must be enabled with **Source: GitHub Actions**. The workflow does not rebuild the ranking (that needs DefiLlama and, when notes changed, the local mention files).

## Score

Eligible protocols come from `GET https://api.llama.fi/protocols`. A row qualifies when current TVL is at least **$5M**, or, below that, 30-day fees are at least **$100k**, or 30-day DEX volume is at least **$5M**. CEX and Ponzi rows are left out.

Paid endpoints are not used. In particular the script does not call `/summary/derivatives` or `pro-api.llama.fi`. Fees and volume come from one shot each of:

- `GET /overview/fees`
- `GET /overview/fees?dataType=dailyRevenue`
- `GET /overview/dexs`

Six-month TVL uses `GET /protocol/{slug}` (the free history payload) only for rows that clear the $5M TVL floor. Responses are cached in memory for that run. The baseline is the sample on or just before 180 days ago. If the series starts later but is at least 30 days long, the first sample is the baseline and `tvlWindowDays` records the shorter window. Younger than 30 days, the growth term is omitted.

Robust growth, so a protocol that went from a few dollars — or from zero — to $5M does not look like a million-fold trend:

```text
tvlGrowth = clamp(ln(tvlNow) - ln(max(tvlThen, $1M)), ln(0.2), ln(5))
```

A baseline of $0 or a missing sample contributes no growth term. The percent column is the clamped move (about −80% to +400%). `tvlChange6mRaw` is the unclamped figure against `max(tvlThen, $1M)`, and `tvl6mAgo` is the actual sample.

Momentum is the log change of the last 30 days against the previous 30 days (`total30d` vs `total60dto30d`), clamped to a 0.2x–5x move. Fees and revenue are averaged when both exist. Volume uses the DEX overview the same way.

Size is `ln(sizeUsd / $1M)`, where `sizeUsd` is current TVL when that is at least $5M, otherwise the larger of 30-day fees and 30-day volume.

Each of size, TVL growth, fees momentum and volume momentum is a z-score across the eligible set. A missing input scores 0 (the mean), so a protocol with no fees adapter is not punished.

```text
score = 0.34·z(size) + 0.46·z(tvlGrowth) + 0.12·z(feesMom) + 0.08·z(volumeMom)
        + 0.04·min(xMentions, 6)
```

The mention term caps at **+0.24**. A z-score term is typically around 1, so size and six-month growth still decide the order. Ties break by TVL, then slug.

Weights and floors are also stored on `showcase/data.json` under `methodology`.

## X mentions

Notes are matched case-insensitively on the protocol name, the slug with hyphens read as spaces, and the small alias map in `src/analytics/ranking/mentions.js` (`EigenLayer` for `eigencloud`, `Aave` for the Aave versions, and similar). Boundaries are letters and digits, so `Aave` does not count inside `Aavegotchi`. Category words (`swap`, `bridge`, `pool`, …) are not used as a whole-name pattern.

`data/x-mentions.json` keeps only `name`, `count`, `lastSeen` and `lists`.

## Categories

Every scored protocol lands in exactly one of the twelve catalog categories. `LLAMA_TO_CATEGORY` in `src/analytics/ranking/categoryMap.js` maps DefiLlama's category string. `SLUG_OVERRIDES` is the exception list (Sky and Ethena stay under Stablecoins & RWA, NEAR Intents stays an aggregator, ether.fi's stake and liquid products stay in Restaking, Polymarket and pump.fun stay in the catch-all, Alchemix stays in lending, Jupiter Lend DEX stays with Jupiter Lend). An exact script slug or an exact name uses the catalog category. `CATALOG_ALIASES` still attaches npm scripts, but those child slugs keep the Llama category unless they are in `SLUG_OVERRIDES`.

| Id | Label | Source |
| --- | --- | --- |
| `dex` | Spot DEX / AMM | Llama `Dexs` |
| `aggregator` | Aggregators & intents | Llama DEX / bridge aggregators |
| `perps` | Perps & derivatives | Derivatives, options, synthetics |
| `lending` | Lending & money markets | Lending, CDP, NFT lending |
| `vaults` | Vault curators & allocators | Risk curators, allocators, yield aggregators, yield markets |
| `staking` | Liquid staking | Liquid staking, staking pools |
| `restaking` | Restaking | Restaking, liquid restaking |
| `stable-rwa` | Stablecoins & RWA | RWA, stablecoin issuers, basis trading |
| `bridge-chain` | Bridges & chains | Bridges, canonical bridges, chain rows |
| `other` | Launchpads, prediction & other | Launchpads, prediction markets, farms, anything unmapped |
| `boards` | Market boards (cross-protocol) | Catalog `BOARDS` with `group: "boards"` |
| `tooling` | Swap & simulation tooling | Catalog `BOARDS` with `group: "tooling"` |

The last two tabs are not Llama protocols. They list the repo's cross-protocol boards and swap/simulation commands, in catalog order, with their npm scripts. Incentive `Farm` rows go to the catch-all; `Yield` (Pendle, Convex, and similar) sits with vaults because the twelve categories have no separate yield bucket.

`coverage` is `covered by a dedicated monitor` when the row's slug or name matches a catalog protocol that has its own npm scripts, and `ranking only` otherwise. A name that appears only inside an aggregate (`analytics:lending:aggregate` and friends) stays ranking-only. Catalog protocols that never cleared the floor are appended on their category tab with empty TVL so the monitor is still visible.

## Output

`showcase/data.json` includes `generatedAt`, `methodology`, `categories`, `overall` (200 rows when the pull succeeds), `byCategory`, and `stats` (`dedicatedMonitor` vs `rankingOnly` inside the top 200). Each scored row has rank, name, slug, category, current TVL, 6-month TVL change, 30-day fees, X mention count, a DefiLlama URL, the repo npm scripts, and the coverage flag.
