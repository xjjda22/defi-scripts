# Architecture (defi-scripts)

Sibling of `defi-mev/` (not one npm workspace). Placement: `.cursor/rules/defi-mev-vs-defi-scripts.mdc`. MEV map: [`../../defi-mev/docs/00-architecture.md`](../../defi-mev/docs/00-architecture.md). Coverage matrix: [`01-protocol-script-coverage.md`](./01-protocol-script-coverage.md). Commands: root `README.md`.

`defi-mev` may reuse this package’s `src/config/chains.js`, quotes, and web3. Today the graph records one inbound require: `defi-mev/scripts/lib/aaveLiquidation.js` → `src/config/chains.js`.

## Module boundaries

| Cluster | Where | What |
|---------|-------|------|
| Quote / swap | `src/swaps/` | Uniswap V2/V3/V4, Sushi, Curve, Balancer; `dexAggregator.getBestQuote` → `swapTokens` |
| Fork simulation | `src/simulation/` | `dexForkRunner`, lending/staking/UniswapX sims, `scripts/validateForkSimulations.js` |
| Cross-chain TVL/volume | `src/crosschain/{uniswap,curve,balancer,sushiswap}/` | Subgraph + DefiLlama trackers |
| Analytics | `src/analytics/protocols/` + `aggregators/` | Per-protocol monitors, Llama slug wrappers, lending/AMM/staking aggregates |
| Shared utils | `src/config/chains.js`, `src/utils/web3.js`, `src/utils/validation.js`, `src/abis/` | Chain map, providers, checks |

`src/examples/` are CLIs on top of `src/swaps/`, not a separate cluster.

## Critical flow

**Best quote:** `dexAggregator.getBestQuote` → `uniswapSwap.getV{2,3,4}Quote` / `sushiswapSwap.getV{2,3}Quote` / optional `curveSwap.getQuote` → max `amountOut` → `swapTokens` / `executeSwapOnProtocol`.

## Entry points

npm scripts in `package.json` → `src/analytics/`, `src/crosschain/`, `src/simulation/`, `src/examples/`. Fork validator: `scripts/validateForkSimulations.js`.

## Hotspots

| Symbol | File | Why |
|--------|------|-----|
| `getQuote` / `findBestFee` / `estimateSwapOutput` | `src/swaps/v{2,3,4}Swap.js` | Shared quote path |
| `getBestQuote` / `swapTokens` | `src/swaps/dexAggregator.js` | Multi-DEX routing |
| `getProvider` | `src/utils/web3.js` | RPC entry |

## External APIs

No in-repo HTTP server. Outbound: DefiLlama `api.llama.fi`, Morpho GraphQL, Lido, Ethena, CoinGecko, plus `*_RPC_URL`.

## Harness

From the workspace root (`defi/`):

```bash
bash harness/verify.sh [quick|smoke|full] [all|defi-scripts|defi-mev]
```

`quick` after every edit; `smoke` when APIs/sims/data change. Queue: `harness/TASKS.md`. Agent loop: `.cursor/rules/harness-and-loop.mdc`.

## Code graph

Indexed project: `Users-harirana-Documents-git-eth-defi`. Scope with `get_architecture` `path: "defi-scripts"`.
