# Category coverage audit

Status: **proposal, not shipped.** The board still renders the twelve tabs described in
[03-showcase-ranking.md](./03-showcase-ranking.md). This page records what the catch-all holds, which
buckets are large enough to deserve their own tab, and what changing the taxonomy would touch.

Numbers are from the full-universe build of **2026-10-29 14:43 UTC**, taken before the candidate-pool
cap. The cap now limits the board to ~267 rows (`other` 32); the shares below still describe DefiLlama's
composition and remain the evidence for the proposed tabs. Fees are DefiLlama 30-day fees. One protocol can carry several Llama categories, so column
sums overlap; the overlap is largest for launchpads, which also count as an interface or a Telegram bot.

## Where `other` goes

`other` is not a tail. The tab holds **107 rows across 26 DefiLlama categories**, and in the overall
top 200 it carries **$157M of 30-day fees**, more than perps ($20.8M) or aggregators ($11.4M).

| Hidden bucket | Llama categories | Rows | 30d fees | TVL | Top examples |
| --- | --- | ---: | ---: | ---: | --- |
| Launchpads | `Launchpad` | 20 | **$156.6M** | $0.17B | Pump (#60, $77.2M), Meteora DBC (#113), Stockereum (#140), clanker (#164) |
| Prediction markets | `Prediction Market` | 8 | **$120.4M** | $0.37B | Kalshi (#119), Polymarket, Overtime, PancakeSwap Prediction |
| Interfaces | `Interface` | 20 | $116.7M | — | tradeXYZ, XOX Perps, Trust Wallet, Base App |
| Telegram bots | `Telegram Bot` | 4 | $82.4M | — | BONK.fun, Trojan, Maestro |
| Trading apps | `Trading App` | 9 | $62.3M | — | Hypernova, Axiom, Propr, fomo |
| NFT marketplaces | `NFT Marketplace` | 3 | $28.5M | — | Fragment, Immutable Orderbook, OpenSea Seaport |
| MEV + builders | `MEV`, `Block Builders` | 5 | $23.1M | — | Jito (Other), Flashbots, Titan Builder |
| Wallets | `Wallets` | 6 | $13.9M | — | Binance Wallet, Base App, Trust Wallet, Phantom |
| Oracles | `Oracle` | 2 | $5.4M | — | Chainlink (#199), Geodnet |
| Privacy | `Privacy` | 5 | $2.0M | $1.06B | Tornado Cash, Railgun, Zama |
| Insurance | `Insurance` | 1 | $0.2M | $0.09B | Nexus Mutual |
| Everything else | AI, DePIN, Farm, Gaming, Payments, CeDeFi, Cards, Services, … | 24 | ~$30M | — | Chutes, Render BME, EtherFi Cash, Fidelity Crypto Fund |

The only Llama category the map did not know at build time was `Transaction Execution` (Lunar Lander,
one row). That is a mapper gap, not a missing tab.

## Candidates, in priority order

### 1. Launchpads — recommended

Twenty rows, $156.6M of fees, and a distinct unit of usage (launches, graduations, bonding-curve
volume). Pump alone would rank around #60 on fees. Keeping it under “Launchpads, prediction & other”
hides the largest fee bucket outside the ten protocol tabs.

### 2. Prediction markets — recommended

Eight rows, $120.4M of fees, and a market that is structurally different from DEXs: event contracts,
not tokens. Kalshi is already in the top 200; Polymarket, Overtime and PancakeSwap Prediction sit in the
`other` tab. A dedicated tab is cheap and self-contained.

### 3. Split Stablecoins from RWA — recommended next

`stable-rwa` currently mixes two markets:

| Part | Llama categories | Tagged rows | 30d fees |
| --- | --- | ---: | ---: |
| Stablecoin issuance | `Stablecoin Issuer` | 5 | **$760.9M** |
| RWA / tokenised assets | `RWA` | 52 | $333.3M |
| Wrappers, CDPs, basis, algo-stables | `Stablecoin Wrapper`, `CDP`, `Basis Trading`, `Algo-Stables`, `Dual-Token`, `Reserve Currency` | 33 | $261.3M |

The tab has 87 unique rows and $887.7M of fees; the rows above overlap (Ethena is both RWA and basis
trading, Circle is both issuer and wrapper, Sky is CDP and risk curator).

The tab is dominated by RWA row count (52) but by stablecoin fee weight (Tether, RLUSD, Paxos, Circle,
M0). Two tabs would read better and make the “real demand” signal legible. It is the most subjective
split because wrappers, CDPs and basis trades need an explicit home.

### 4. Consumer / interfaces / wallets — hold

Interfaces, trading apps, Telegram bots and wallets total roughly **$275M** of fees across 39 rows, but
they are mostly front-ends and distribution, not protocol TVL. They fit the “DeFi usage” framing less
well than launchpads or prediction markets, and they overlap with launchpad rows (Pump is all three).
Recommendation: keep them in `other` until the board decides whether “consumer” is in scope.

### 5. Oracles / MEV / builders — hold, or one “Infrastructure” tab

Oracles ($5.4M) and MEV/builders ($23.1M) are strategically important but fee-light. A single
`Infrastructure` tab (oracles + MEV + block builders + dev tools) is defensible later; separate tabs
would be mostly empty.

### 6. Chains / L2s — needs a different board, not a tab

Chains have no tab today: they appear only through their canonical-bridge row (Base Bridge, Arbitrum
Bridge, …). That is deliberate — chain TVL sums the protocols on the chain and would double-count every
row on the board. A chain view needs its own data source and its own ranking, not a category mapping.

## What “shipping it” touches

Adding a tab is not only a label; the following move together:

1. `src/catalog/protocols.js` — append the category to `CATEGORIES` in display order; adjust the `other`
   label if it no longer covers launchpads/prediction.
2. `src/analytics/ranking/categoryMap.js` — move `Launchpad` and `Prediction Market` out of the
   catch-all and into the new ids.
3. `showcase/app.js` — add short tab labels; the tab bar currently wraps to two rows at desktop width.
4. `scripts/showcaseCheck.js` — the hard-coded `12` category count.
5. `docs/03`, `README.md` — the “twelve categories” wording and the category table.
6. `docs/02-protocol-catalog.md` and the README catalog block — regenerate with `npm run catalog:docs`, and
   reassign the fourteen catalog cards currently filed under `other` (pump.fun, Polymarket, Kalshi,
   UNCX, Metaplex, ORE, X100, Zama, Bitget, StonkFun, Collector Crypt, Umia, Pons, AlpsCon AI Trade Hub)
   if their cards should appear in the new tabs.
7. `showcase/data.json` — rebuild with `RANKING_CACHE_DIR=… npm run showcase:build` and run
   `showcaseCheck` + `showcaseSignalsCheck`.

No score changes: weights and percentiles are independent of the category. Only tab membership and the
category counts in `data.json` change.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-10-29 | Audit recorded. Launchpads and Prediction markets recommended first (12 → 14 tabs). Stablecoins/RWA split recommended as a second step. Consumer and Infrastructure tabs held. Not implemented. |
