# Fork testing

Architecture: [`00-architecture.md`](./00-architecture.md). The showcase panel that lists these commands is [`03-showcase-ranking.md`](./03-showcase-ranking.md).

`fork:<protocol>:<action>` runs one action on a local Anvil fork. It impersonates or funds a whale, asserts a balance or position change, prints `FORK_RESULT`, and exits non-zero on failure. It does not read `PRIVATE_KEY`.

## Setup

Install Foundry if `anvil` is missing. `node scripts/startFork.js` prints the same lines when the binary is not on `PATH`:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

Copy `sample.env` to `.env` and set the upstream RPC for each chain you fork. Public RPCs work for a latest-block fork. An old `FORK_BLOCK` needs an archive endpoint.

```bash
# terminal 1 — Ethereum mainnet fork, optional pin
CHAIN=ethereum node scripts/startFork.js
FORK_BLOCK=21000000 CHAIN=ethereum node scripts/startFork.js

# terminal 2 — point the chain RPC at Anvil, then run one action
ETHEREUM_RPC_URL=http://127.0.0.1:8545 npm run fork:aave:supply
```

| Chain | Env var |
| --- | --- |
| Ethereum | `ETHEREUM_RPC_URL` (or `ETH_RPC_URL`) |
| Base | `BASE_RPC_URL` |
| Optimism | `OPTIMISM_RPC_URL` |
| Arbitrum | `ARBITRUM_RPC_URL` |
| BSC | `BSC_RPC_URL` |
| Polygon | `POLYGON_RPC_URL` |
| Monad | `MONAD_RPC_URL` |

`npm run fork:all` (also `npm run simulate:fork:suite`) starts **one Anvil per chain**, runs every action for that chain, then shuts Anvil down. `CHAINS=ethereum` limits the suite. A chain with no RPC URL is skipped. `SKIP` does not fail the process. `FAIL` does. CI runs this job only when the `ETHEREUM_RPC_URL` secret is set; a missing secret skips its steps, and the job is `continue-on-error`, so it never fails CI.

Every test has a hard deadline, `FORK_TEST_TIMEOUT_MS` (default 180000). The script's own watchdog prints `FORK_RESULT status=FAIL ... key=timeout=<ms>` and exits 1. The suite also runs each script in its own process group and kills the whole group 15 s after that, so a stuck RPC call cannot hang `fork:all`. Anvil processes are killed when the suite exits.

## What each recipe does

Every action starts from the block Anvil forked (latest, or `FORK_BLOCK`). Whales come from `src/utils/impersonate.js`. If that balance is short, the test calls `anvil_deal` on the fork. The whale then sends the test amount to a brand-new impersonated account, and the test runs from that account, so positions from earlier tests on the same fork (an Aave borrow, a Spark supply) do not leak into later ones. `FORK_SHARED_WHALE=1` runs from the whale directly. Nothing signs with a private key.

| Script | Chain | Action | Assertion |
| --- | --- | --- | --- |
| `fork:uniswap:v2` / `:v3` | Ethereum | WETH→USDC through the existing DEX runner | USDC balance increases |
| `fork:uniswap:v4` | Ethereum | ETH→USDC: V4Quoter, then `V4_SWAP` on the Universal Router | USDC received ≥ quote − 0.5% |
| `fork:sushiswap:v2` / `:v3` | Ethereum | WETH→USDC | USDC balance increases |
| `fork:balancer:swap` | Ethereum | WETH→USDC on the V2 Vault | USDC balance increases |
| `fork:curve:swap` | Ethereum | USDC→USDT on 3pool | USDT balance increases |
| `fork:aerodrome:swap` | Base | **Reference swap only:** Uniswap V3 (SwapRouter02) on Base, because the Slipstream quoter reverts here. Aerodrome contracts are not exercised | USDC balance increases |
| `fork:velodrome:swap` | Optimism | **Reference swap only:** Uniswap V3 on Optimism. Velodrome contracts are not exercised | USDC balance increases |
| `fork:pancakeswap:v3` | Ethereum (`CHAIN=bsc` for BSC) | WETH→USDC on PancakeSwap V3 | USDC balance increases |
| `fork:monad:v3` | Monad | Uniswap V3 | skipped when `MONAD_RPC_URL` is unset |
| `fork:aave:supply` / `:borrow` / `:repay` / `:withdraw` | Ethereum | Aave V3 pool from `chains.js` | aToken, debt, or wallet balance moves the right way |
| `fork:spark:*` | Ethereum | Same four actions on the SparkLend pool | Spark is an Aave V3 fork |
| `fork:compound:supply` / `:borrow` | Ethereum | Compound III cUSDCv3 | base balance or borrow balance increases |
| `fork:morpho:supply` / `:borrow` | Ethereum | One listed WETH/USDC Morpho Blue market | supply shares or borrow shares increase |
| `fork:lido:submit` / `:wrap` | Ethereum | `submit` then optional `wrap` | stETH, then wstETH, increases |
| `fork:rocketpool:deposit` | Ethereum | `deposit()` on the Rocket deposit pool | rETH increases, or skip when the cap is too small |
| `fork:cbeth:rate` | Ethereum | `exchangeRate()` | rate above 1. No public mint |
| `fork:etherfi:deposit` / `:wrap` | Ethereum | deposit ETH, wrap eETH | eETH, then weETH, increases |
| `fork:kelp:deposit` | Ethereum | `depositETH` | rsETH increases, or skip when paused |
| `fork:renzo:deposit` | Ethereum | `depositETH` | ezETH increases, or skip when capped |

Raydium is Solana. The suite does not fork it. The showcase marks that row API-only.

Addresses are in `src/catalog/contracts.js`. Each one is either already in `src/config/chains.js` or copied from the official doc linked next to it.

A passing test prints a line like:

```text
FORK_RESULT status=PASS protocol=aave action=supply chain=ethereum block=21000000 aToken=0.0->1000.0
```

## Testnet faucets

The showcase reads this list from `src/catalog/faucets.js`. These URLs returned HTTP 200 on 2026-10-10 (redirects followed).

| Network | Faucets |
| --- | --- |
| Ethereum Sepolia | [Google Cloud](https://cloud.google.com/application/web3/faucet/ethereum/sepolia), [Alchemy](https://www.alchemy.com/faucets/ethereum-sepolia), [QuickNode](https://faucet.quicknode.com/ethereum/sepolia) |
| Base Sepolia | [Coinbase CDP](https://portal.cdp.coinbase.com/products/faucet), [Base docs](https://docs.base.org/get-started/get-funds), [Alchemy](https://www.alchemy.com/faucets/base-sepolia) |
| Arbitrum Sepolia | [Alchemy](https://www.alchemy.com/faucets/arbitrum-sepolia), [QuickNode](https://faucet.quicknode.com/arbitrum/sepolia) |
| OP Sepolia | [Optimism Console](https://console.optimism.io/faucet), [Optimism docs](https://docs.optimism.io/app-developers/tools-sdks/faucets), [Alchemy](https://www.alchemy.com/faucets/optimism-sepolia) |
| Polygon Amoy | [Google Cloud](https://cloud.google.com/application/web3/faucet/polygon/amoy), [Alchemy](https://www.alchemy.com/faucets/polygon-amoy) |
| BNB Smart Chain testnet | [BNB Chain](https://www.bnbchain.org/en/testnet-faucet) |
| Avalanche Fuji | [Core](https://core.app/tools/testnet-faucet/?subnet=c&token=c) |
| Scroll Sepolia | [Scroll docs](https://docs.scroll.io/en/user-guide/faucet/) |
| zkSync Sepolia | [Alchemy](https://www.alchemy.com/faucets/zksync-sepolia) |

[Chainlink faucets](https://faucets.chain.link/) cover several of the same networks. The fork suite itself runs against mainnet forks, not these testnets. The faucets are there when you want to try a protocol UI with test coins.

## Showcase panel

`showcase/data.json` rows carry `testing`:

- `mode: "fork"` — copy-paste `startFork` command, the `fork:*` command, the RPC env var, and contract addresses.
- `mode: "api-only"` — a clear API-only label plus the generic Anvil recipe for that category (DEX → Uniswap V3 quote, lending → `fork:aave:supply`, staking → `fork:lido:submit`, and so on).

Open `#p=uniswap` on the board, or `showcase/protocol.html?slug=aave`. `src/analytics/ranking/coverage.js` calls `enrichShowcase` from `src/catalog/forkRecipes.js` when `npm run showcase:build` writes `data.json`. `node scripts/showcaseCheck.js` rejects a row with no `testing.mode`.
