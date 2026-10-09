# Architecture (defi-scripts)

A collection of standalone Node.js (CommonJS) scripts, exposed as npm scripts. No server, no database. Coverage notes: [`01-protocol-script-coverage.md`](./01-protocol-script-coverage.md). Commands per protocol: [`02-protocol-catalog.md`](./02-protocol-catalog.md) (generated from `src/catalog/protocols.js` + `package.json`; `npm run catalog`).

MEV tooling (bundle simulation, sandwich/flashloan analysis, bots) is intentionally out of scope; other projects can reuse `src/config/chains.js`, the quote helpers and `src/utils/web3.js` directly.

## Module boundaries

| Cluster | Where | What |
|---------|-------|------|
| Quote / swap | `src/swaps/` | Uniswap V2/V3/V4, Sushi, Curve, Balancer; `dexAggregator.getBestQuote` → `swapTokens` |
| Fork simulation | `src/simulation/` | `dexForkRunner`, lending/staking/UniswapX sims, `scripts/validateForkSimulations.js` |
| Cross-chain TVL/volume | `src/crosschain/{uniswap,curve,balancer,sushiswap}/` | Subgraph + DefiLlama trackers |
| Analytics | `src/analytics/protocols/` + `aggregators/` + `nft/` + `airdrop/` | Per-protocol monitors, Llama slug wrappers, lending/AMM/staking aggregates, L2/ETH DEX/yield/BTC wrap/RWA/NFT/airdrop overviews |
| Ranking | `src/analytics/ranking/` | Top-200 trending score (`ranking:top200` / `showcase:build`) written to `showcase/data.json` |
| Shared utils | `src/config/chains.js`, `src/utils/web3.js`, `src/utils/validation.js`, `src/abis/` | Chain map, providers, checks |

`src/examples/` are CLIs on top of `src/swaps/`, not a separate cluster.

## Critical flow

**Best quote:** `dexAggregator.getBestQuote` → `uniswapSwap.getV{2,3,4}Quote` / `sushiswapSwap.getV{2,3}Quote` / optional `curveSwap.getQuote` → max `amountOut` → `swapTokens` / `executeSwapOnProtocol`.

## Entry points

npm scripts in `package.json` → `src/analytics/`, `src/crosschain/`, `src/simulation/`, `src/examples/`. Fork validator: `scripts/validateForkSimulations.js`. Trending board: `npm run ranking:top200` (same script as `showcase:build`).

## Hotspots

| Symbol | File | Why |
|--------|------|-----|
| `getQuote` / `findBestFee` / `estimateSwapOutput` | `src/swaps/v{2,3,4}Swap.js` | Shared quote path |
| `getBestQuote` / `swapTokens` | `src/swaps/dexAggregator.js` | Multi-DEX routing |
| `getProvider` | `src/utils/web3.js` | RPC entry |

## External APIs

No in-repo HTTP server. Outbound: DefiLlama `api.llama.fi`, Morpho GraphQL, Lido, Ethena, CoinGecko, plus `*_RPC_URL`.
