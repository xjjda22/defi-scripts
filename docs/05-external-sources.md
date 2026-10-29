# External signals (CoinGecko, Nansen)

The top-200 board is built from DefiLlama's free API. CoinGecko attention runs by default beside it; Nansen smart money is opt-in. Both are percentiles over the same eligible rows:

| Signal | Source | Raw value | Weight |
| --- | --- | --- | --- |
| `attention` | CoinGecko | 24h volume ÷ market cap (turnover) | 0.08 |
| `smartMoney` | Nansen | 30-day smart-money netflow ÷ market cap | 0.07 |

The other 0.85 stays with `size` 0.30, `growth` 0.21, `tvlAdded` 0.17, `feesMomentum` 0.10 and `volumeMomentum` 0.07. Weights live in [`src/analytics/ranking/weights.js`](../src/analytics/ranking/weights.js); the X-mention bonus (+0.072 cap) is still added on top.

CoinGecko is **on by default**; Nansen is opt-in. Both **fail open**: a failed call or a row with no token scores a neutral 0.5 — the same rule the core inputs use. When a source is off, its weight is dropped and the remaining weights are renormalised to 1, so the board still ranks and the score stays on a 0–1 scale.

In CI, `scripts/showcaseCheck.js` rejects a build whose `methodology.sources` has no available CoinGecko rows, so the published page always carries DefiLlama **and** CoinGecko. A keyless CI build that gets rate-limited fails the check and the Pages workflow falls back to the committed `data.json` instead of publishing a DefiLlama-only board.

## Token map

[`src/analytics/ranking/token-map.json`](../src/analytics/ranking/token-map.json) joins a showcase row id to one CoinGecko id plus the contract addresses Nansen needs (Ethereum, Solana, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche). It currently maps 73 row ids; 70 of them appeared in the last build and 52 of those made the top 200.

Add a row only when the token clearly represents that protocol. A wrong token is worse than a missing one: it would let an unrelated coin move a protocol's rank. Unmapped rows are neutral, not penalised.

Two rows can share a token (`sparklend` and `spark--vaults` both use SPK); that is expected. Rows with no token at all (bridges without one, chain-level rows, private companies) stay unmapped.

## CoinGecko

One batched call: `GET /coins/markets?vs_currency=usd&ids=…&price_change_percentage=30d`, up to 200 ids per request.

- The score uses **turnover**, not price momentum. TVL is dollar-denominated, so a token's price rise already inflates `growth` and `tvlAdded`; price change would double-count it.
- Free Demo key: 100 calls/min. Keyless calls work on the public host but are throttled per shared IP, so CI can be rate-limited.
- Cache: `data/cache/coingecko-markets.json`, six hours (`COINGECKO_CACHE_TTL_MS`). The cache is gitignored.
- Attribution: "Token market data by CoinGecko" is rendered in the page footer, linked to [coingecko.com](https://www.coingecko.com). Confirm the current free-tier clause before publishing.
- A 429 is retried once after six seconds; any other failure disables `attention` for that build with a warning.

## Nansen

One batched call: `POST /api/v1/smart-money/netflow` with every mapped contract address, `chains: ["all"]`, `per_page: 1000`.

- Raw value is `net_flow_30d_usd ÷ market_cap_usd`. Only the percentile is published; the board never prints dollar flows, wallet lists or trader counts.
- Credits: 5 per call. The free plan tops up to 10 credits a day, so a build needs at most two calls; Pro is 2,000 credits a month (400 calls).
- Cache: `data/cache/nansen-netflow.json`, twelve hours (`NANSEN_CACHE_TTL_MS`). A repeat build spends no credits.
- A 429 honours `Retry-After` once (capped at 15s). 401/403 usually means a rejected key, no credits, or a plan that excludes the endpoint.

### Redistribution gate

Nansen's [redistribution guidelines](https://docs.nansen.ai/guides/redistribution-guide.md) put smart-money flow data in the restricted bucket: approval **and** significant modification. `smart-money/holdings` is outright prohibited.

`NANSEN_PUBLIC` is a **0/1 flag, not a URL**. The dashboard is <https://app.nansen.ai> (create the API key under Account → API); the API base the code calls is `https://api.nansen.ai`.

Until approval exists, the source is local-only:

- A CI build (`CI` or `GITHUB_ACTIONS`) disables Nansen unless `NANSEN_PUBLIC=1`.
- A build that uses it sets `methodology.publishSafe: false`. The page shows a red "Local preview" banner, and `scripts/showcaseCheck.js` fails in CI when `publishSafe` is false.
- Attribution "Smart-money data powered by Nansen API" is required once it goes public, linked to [nansen.ai](https://www.nansen.ai).

Do not commit a `showcase/data.json` built with `publishSafe: false` to `main` before approval.

## Environment

```bash
COINGECKO_API_KEY=            # Demo key; keyless works but is throttled
NANSEN_API_KEY=               # required for smart money; create it at app.nansen.ai
NANSEN_PUBLIC=1               # 0/1 flag, NOT a URL; only after redistribution approval
SIGNALS_OFF=1                 # disable every external signal for one build
SIGNALS_CACHE_DIR=            # default data/cache
```

`npm run showcase:build` loads `.env` (the ranking script calls `dotenv` directly), so the keys can live
there. Shell variables still win. CoinGecko works without a key on the shared public host — set
`COINGECKO_API_KEY` when CI needs the higher limit.

## Checks

```bash
node scripts/showcaseSignalsCheck.js   # offline: turnover, netflow, join, weights
node scripts/showcaseCheck.js          # data.json shape, signal ranges, weight sum
npm run showcase:build                 # rebuilds showcase/data.json
```

The offline check uses fixtures in `test/fixtures/` and needs no network or keys, so it is safe in CI.

## Limits

- Coverage is 73 mapped row ids, of which 70 were present and 52 made the top 200 in the last build. Extending the token map is the cheapest way to raise it.
- CoinGecko cannot tell a protocol's own usage from a governance token's speculation; turnover is an attention proxy, not revenue.
- Nansen's netflow endpoint keeps a rolling 30 days, so it cannot backfill the six-month window.
- Tokens that exist only as a native asset (NEAR, TAO, RUNE) have no contract address in the map, so Nansen cannot score those rows. CoinGecko still can.
- Pump.fun is not wired as a signal. It has no official REST API; the board already ranks PumpSwap and Pump through DefiLlama. If launchpad activity is needed later, use DexPaprika's free candles or on-chain logs, and keep it scoped to the launchpad tab.
