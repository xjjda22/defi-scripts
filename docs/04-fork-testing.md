# Fork testing

Architecture: [`00-architecture.md`](./00-architecture.md). The showcase panel that lists these commands is [`03-showcase-ranking.md`](./03-showcase-ranking.md).

This page covers the JS/Anvil `fork:*` suite. Foundry `.t.sol` coverage of the protocol contracts
is a separate queue: [`11-foundry-contract-plan.md`](./11-foundry-contract-plan.md).
`npm run test:contracts:fork` now runs that protocol suite on isolated, pinned per-chain Anvil
nodes using `data/fork-blocks.json`; this does not replace or change the JS runner below.
Its summary parses Foundry JSON as `PASS n, FAIL n, SKIP n`. Missing RPCs are explicit skips,
not passes; a skip on a configured chain fails the Foundry job. `npm run test:contracts`
also includes the existing receiver/mock unit tests, not just protocol files.

`fork:<protocol>:<action>` runs one action on a local Anvil fork. It impersonates or funds a whale, asserts a balance or position change, prints `FORK_RESULT`, and exits non-zero on failure. It does not read `PRIVATE_KEY`.

The contracts each test actually calls — and the features the suite still does **not** cover
per protocol — are charted in [`10-contract-flows.md`](./10-contract-flows.md), generated from
`data/contract-flows.json`. `npm run flowcharts:check` (inside `catalog:check`) fails when a
`FORK_RECIPES` entry has no flow, when a diagram cites an address that is not in the repo, or
when the doc is stale.

## Setup

Install Foundry if `anvil` is missing. `scripts/lib/anvil.js` finds the binary from `ANVIL_BIN`, then `PATH`, then `~/.foundry/bin/anvil` (foundryup's default), so a shell without Foundry on `PATH` still works. `node scripts/startFork.js` prints these lines when none is found:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

Copy `.sample.env` to `.env` and set the upstream RPC for each chain you fork. Public RPCs work for a latest-block fork. An old `FORK_BLOCK` needs an archive endpoint.

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
| Monad | `MONAD_RPC_URL` (public default `rpc.monad.xyz`) |
| Avalanche C-Chain | `AVALANCHE_RPC_URL` (public default `api.avax.network/ext/bc/C/rpc`) |

`npm run fork:all` (also `npm run simulate:fork:suite`) starts **one Anvil per chain**, runs every action for that chain, then shuts Anvil down. `CHAINS=ethereum` limits the suite. A chain with no RPC URL is skipped. `SKIP` does not fail the process. `FAIL` does. CI runs the fork tests only when RPC URLs are configured; otherwise the job writes **SKIPPED: no fork test ran** to the job summary and a warning annotation, so a green job is not mistaken for a fork-test pass. The job is `continue-on-error`.

**Per-test isolation (2026-11-03).** The suite takes an `evm_snapshot` before every test and `evm_revert`s after it, pass or fail, so each test starts from the same fork block. Without it, one test's leftovers leak into the next: Theo warps time by the 5-day lockup, the liquidation tests replace an oracle with MockPrice, and earlier tests drain the whales they touch. That leakage is what made `fork:superstate:nav`, `fork:saturn:stake` and `fork:cian:deposit` fail inside the suite while each passed alone on a fresh fork. `FORK_ISOLATE=0` disables the snapshot/revert for debugging a shared-state failure.

**Contracts the tests deploy.** `src/simulation/fork/contracts/` holds `FlashReceivers.sol` (the Aave/Spark and Morpho flashloan receivers) and `MockPrice.sol` (the oracle stub the liquidation tests install with `anvil_setCode`). Both are compiled into `artifacts.json` with solc 0.8.24 and the optimizer off: `npm run build:contracts` rebuilds it, and `npm run check:contracts` fails when a `.sol` file was edited without rebuilding, so a test can never run stale bytecode. CI runs the check.

RPC fallbacks and retries (2026-11-02): when the configured upstream cannot start an Anvil fork, the suite tries public endpoints for that chain in order (Optimism publicnode then `mainnet.optimism.io`, BSC publicnode then `bsc-dataseed.bnbchain.org`, Arbitrum `arb1` then publicnode, Avalanche `api.avax.network` then publicnode, Base official only; `FORK_RPC_FALLBACK=0` disables). `FORK_PUBLIC_RPC=1` forks a chain from its first public endpoint when its env var is unset. A FAIL is retried once when the output looks like an RPC error (timeout, 429, reset, header not found, archive limit) or the script is a known flake (`fork:velodrome:swap`, `fork:venus:supply`, `fork:rockawayx:deposit`, `fork:etherfi-cash:supply`; override with `FORK_RETRY_SCRIPTS`, disable with `FORK_RETRY=0`). A pass on retry is labelled `(passed on retry)`.

`src/simulation/fork/run.js` adjusts two ethers defaults for Anvil 1.8. Anvil can return the transaction hash before the block is mined, and `TransactionResponse.wait()` could then miss the block and hang until the watchdog. The runner now polls for the receipt first. Anvil's `eth_estimateGas` can also come back tight enough that a nested call runs out of gas (seen on the Aave borrow), so estimates for transactions without their own `gasLimit` are padded by 30%. `anvil_deal` is still `Method not found` on Anvil 1.8.5. When every configured whale is short, `dealErc20` in `src/simulation/fork/runtime.js` falls back to `anvil_dealERC20`, which on 2026-10-30 set 500,000 USDC and 100 WETH on a mainnet fork (more than the Binance whales held after the 2026-10-29 hot-wallet drain). Tests still prefer whales first. While a transaction is unmined, Anvil forwards the receipt lookup to the upstream RPC, and a public endpoint can answer with an archive error that ethers reports as "could not coalesce error". The receipt poll treats those errors as "not mined yet". Fork Arbitrum from an endpoint that keeps recent state (`https://arb1.arbitrum.io/rpc`); `arbitrum-one-rpc.publicnode.com` prunes it within minutes and the fork then fails with "historical state is not available". Fork Optimism from `https://optimism-rpc.publicnode.com`: on 2026-10-21 a fork of `mainnet.optimism.io` stalled `fork:velodrome:swap` in the Uniswap V3 quote until the 180 s deadline, while the same test passed in about 20 s from publicnode. Chains with no configured WETH whale (Monad, where WETH is WMON) fund the fresh account by wrapping native gas token through `deposit()`.

Every test has a hard deadline, `FORK_TEST_TIMEOUT_MS` (default 180000). The script's own watchdog prints `FORK_RESULT status=FAIL ... key=timeout=<ms>` and exits 1. The suite also runs each script in its own process group and kills the whole group 15 s after that, so a stuck RPC call cannot hang `fork:all`. Anvil processes are killed when the suite exits.

## What each recipe does

Every action starts from the block Anvil forked (latest, or `FORK_BLOCK`). Whales come from `src/utils/impersonate.js`. If that balance is short, the test calls `anvil_deal` on the fork. The whale then sends the test amount to a brand-new impersonated account, and the test runs from that account, so positions from earlier tests on the same fork (an Aave borrow, a Spark supply) do not leak into later ones. `FORK_SHARED_WHALE=1` runs from the whale directly. Nothing signs with a private key.

The tables below, and the "Test it" panel on each protocol page, are both generated from `src/catalog/forkFeatures.js`. Edit that file, then run `npm run catalog:docs`. `npm run catalog:check` fails when a `fork:*` script has no entry there, so a new fork test cannot ship undocumented. Each entry also carries the `FORK_AMOUNT`-style dials a reader can set, which the panel renders.

<!-- features:actions -->
| Script | Chain | Action | Assertion |
| --- | --- | --- | --- |
| `fork:uniswap:v2` / `:v3` | Ethereum | WETH→USDC through the existing DEX runner | USDC balance increases |
| `fork:uniswap:v4` | Ethereum | ETH→USDC: V4Quoter, then `V4_SWAP` on the Universal Router | USDC received ≥ quote − 0.5% |
| `fork:sushiswap:v2` / `:v3` | Ethereum | WETH→USDC | USDC balance increases |
| `fork:balancer:swap` | Ethereum | WETH→USDC on the V2 Vault | USDC balance increases |
| `fork:curve:swap` | Ethereum | USDC→USDT on 3pool | USDT balance increases |
| `fork:aerodrome:swap` | Base | **Reference swap only:** Uniswap V3 (SwapRouter02) on Base, because the Slipstream quoter reverts here. Aerodrome contracts are not exercised | USDC balance increases |
| `fork:velodrome:swap` | Optimism | **Reference swap only:** Uniswap V3 on Optimism. Velodrome contracts are not exercised | USDC balance increases |
| `fork:pancakeswap:v3` | Ethereum | WETH→USDC on PancakeSwap V3. `CHAIN=bsc` runs it on BSC instead | USDC balance increases |
| `fork:uniswap:v2-add` | Ethereum | Buy USDC on Router02, then `addLiquidity` USDC/WETH | LP minted = staticCall preview, within 0.1% of the reserve-share formula; reserves grow by the amounts used |
| `fork:uniswap:v3-mint` | Ethereum | `NonfungiblePositionManager.mint` WETH/USDC 0.05%, ±20 tick spacings | NFT owned by the minter, `positions().liquidity` = event liquidity, both legs used |
| `fork:uniswap:v3-remove` | Ethereum | Mint, then `decreaseLiquidity` all + `collect` | Liquidity 0, collected ≥ owed and ≥ 99.9% of each deposited leg |
| `fork:uniswap:v4-add` | Ethereum | `PositionManager.modifyLiquidities` MINT_POSITION + SETTLE_PAIR + SWEEP, ETH/USDC 0.05% via Permit2 | `getPositionLiquidity` = requested liquidity, NFT owned by the minter, ETH and USDC both spent, excess ETH swept back |
| `fork:pancakeswap:v2-swap` | Bsc | `swapExactETHForTokens` on the V2 router | USDT received ≥ `getAmountsOut` in the same block |
| `fork:pancakeswap:v3-mint` | Bsc | `NonfungiblePositionManager.mint` USDT/WBNB 0.05% | NFT owned by the minter, liquidity = event, both legs used |
| `fork:pancakeswap:v3-remove` | Bsc | Mint, then `decreaseLiquidity` all + `collect` | Liquidity 0, collected ≥ owed and ≥ 99.9% of each leg |
| `fork:pancakeswap:farm` | Bsc | Mint, `safeTransferFrom` the NFT to MasterChef V3, warp 1h, swap through the pool | MasterChef owns the NFT, `userPositionInfos` has the user, pid and liquidity, `pendingCake` > 0 |
| `fork:curve:add` | Ethereum | `add_liquidity` single-sided USDC | 3Crv ≥ 99% of `calc_token_amount` and worth ≥ 99% of the USDC at virtual price |
| `fork:curve:remove` | Ethereum | Add, then `remove_liquidity_one_coin` to USDC | USDC back ≥ `calc_withdraw_one_coin` and ≥ 99% of the USDC put in, 0 3Crv left |
| `fork:curve:gauge` | Ethereum | Add, then `deposit` 3Crv into the 3pool LiquidityGauge | Gauge balance = 3Crv deposited, wallet 3Crv 0 |
| `fork:monad:v3` | Monad | Uniswap V3 | Skipped when `MONAD_RPC_URL` is unset |
| `fork:aave:supply` / `:borrow` / `:repay` / `:withdraw` | Ethereum | Aave V3 pool from `chains.js` | aToken, debt, or wallet balance moves the right way |
| `fork:aave:flashloan` | Ethereum | `flashLoanSimple` 100k USDC into a receiver deployed on the fork (`src/simulation/fork/contracts/FlashReceivers.sol`) | the callback saw the full amount, the premium equals `FLASHLOAN_PREMIUM_TOTAL`, the receiver paid exactly the premium and the aToken's USDC rose by it |
| `fork:aave:emode` | Ethereum | Supply 1 WETH, `setUserUseReserveAsCollateral` off then on, `setUserEMode(1)` then 0 | the user-config collateral bit and collateral base go off and back on, `getUserEMode` reads 1 then 0 and the LTV changes with the category |
| `fork:aave:stake` | Ethereum | `stkAAVE.stake` 10 AAVE, then `cooldown()` | stkAAVE rises by the amount staked and `stakersCooldowns` records the cooldown block timestamp |
| `fork:spark:supply` / `:borrow` / `:repay` / `:withdraw` | Ethereum | Same four actions on the SparkLend pool | Spark is an Aave V3 fork |
| `fork:spark:flashloan` | Ethereum | `flashLoanSimple` 100k USDC into a receiver deployed on the fork | the callback saw the full amount, the premium equals `FLASHLOAN_PREMIUM_TOTAL` (0 today) and the receiver paid exactly that |
| `fork:spark:liquidate` | Ethereum | 1 WETH collateral, borrow 95% of the limit in USDC, swap the oracle's WETH source for a mock at 70% of price, `liquidationCall` half the debt | health factor goes from above 1 to below 1, debt falls and the liquidator receives WETH; the real price source is restored after |
| `fork:compound:supply` / `:borrow` | Ethereum | Compound III cUSDCv3 | base balance or borrow balance increases |
| `fork:compound:repay` | Ethereum | WETH collateral, borrow USDC, `supply(USDC)` half the debt | borrowBalanceOf falls by the USDC spent and stays above 0 |
| `fork:compound:withdraw` | Ethereum | Supply USDC, `withdraw(USDC)` half | wallet USDC rises by exactly the amount, base balance falls, no debt opened |
| `fork:compound:absorb` | Ethereum | 1 WETH collateral, borrow 95% of the limit, mock the ETH/USD feed at 70%, `absorb` | `isLiquidatable` is true, the debt goes to 0, the user's WETH goes to 0 and protocol WETH reserves rise by exactly 1 |
| `fork:compound:buycollateral` | Ethereum | Absorb a shocked position (feed restored), then `buyCollateral(WETH)` for 500 USDC while reserves are below target | the buyer gets exactly `quoteCollateral`, WETH reserves fall by that and base reserves rise by the USDC paid |
| `fork:morpho:supply` / `:borrow` | Ethereum | One listed WETH/USDC Morpho Blue market | supply shares or borrow shares increase |
| `fork:morpho:repay` | Ethereum | Open a WETH/USDC borrow, `repay` half, `withdrawCollateral` 10% | borrow shares fall, collateral and wallet WETH move by exactly the withdrawn amount |
| `fork:morpho:withdraw` | Ethereum | Supply USDC, `withdraw` half as the lender | wallet USDC rises by exactly the amount and supply shares fall |
| `fork:morpho:flashloan` | Ethereum | `Morpho.flashLoan` 100k USDC through an `onMorphoFlashLoan` receiver deployed on the fork | the callback held exactly the amount, Morpho's USDC balance is unchanged (fee-free) and the receiver ends empty |
| `fork:morpho:liquidate` | Ethereum | WETH/USDC market: 1 WETH collateral, borrow 95% of LLTV, mock the market oracle at 70%, `liquidate` seizing 0.5 WETH | borrower collateral falls by exactly the seized amount, borrow shares fall and the liquidator receives that WETH; the oracle is restored after |
| `fork:llamalend:deposit` | Ethereum | crvUSD into the Llamalend V1 wstETH-long vault (`OneWayLendingFactory.vaults(13)`, ERC-4626), then redeem | the factory still lists the vault, the deposit pulled the full amount, shares were minted, the redeem burned every share and crvUSD came back within rounding |
| `fork:llamalend:borrow` | Ethereum | `Controller.create_loan` on the wstETH market (vault index 13): 1 wstETH, 50% of `max_borrowable`, N=10 | the loan exists, the wallet received exactly the debt in crvUSD and `debt()` records it |
| `fork:llamalend:repay` | Ethereum | Open the loan above, warp 1h, `repay` half | `debt()` falls by the amount repaid (within 0.001 crvUSD of accrued interest) and the loan stays open |
| `fork:llamalend:liquidate` | Ethereum | Borrow 95% of `max_borrowable`, mock the AMM price oracle at 60%, `liquidate(user, 0)` | health goes from positive to negative, the loan is closed with 0 debt and the liquidator receives the wstETH; the oracle is restored after |
| `fork:dolomite:supply` | Ethereum | `DepositWithdrawalRouter.depositWei` into account 0, then `withdrawWei` of the full balance with `BalanceCheckFlag.From` | the deposit pulled the full amount, `DolomiteMargin.getAccountWei` rose by it, the withdraw left the account at 0 and the USDC came back |
| `fork:cooler:borrow` | Ethereum | MonoCooler `addCollateral` (gOHM), `borrow` USDS, `repay(type(uint128).max)`, then `withdrawCollateral(type(uint128).max)`. Pre-checks: the documented gOHM / USDS tokens, `borrowsPaused()` false, and the borrow sits between `minDebtRequired()` and the origination LTV | `accountCollateral` and the wallet move by exactly the gOHM posted, the wallet receives exactly the USDS borrowed and `accountDebt` equals it, the full repay leaves `accountDebt` at 0 (paying the borrow plus per-second interest), and every gOHM comes back |
| `fork:curvance:deposit` | Monad | WMON into cWMON of the WMON \| USDC market (ERC-4626 style `deposit`), then `redeem` every share. `marketManager()` must be the documented MarketManager. WMON is wrapped from native MON on the fork | the deposit pulled the full amount, shares were minted, the redeem burned every share and the WMON came back within rounding (plus a little interest) |
| `fork:stakelink:deposit` | Ethereum | Priority Pool `deposit(amount, true, [])`: stakes what the Staking Pool can take now (stLINK) and queues the rest, then `unqueueTokens` the queued part. Pre-checks: the documented LINK / Staking Pool wiring, `poolStatus()` OPEN and not paused | the user's LINK drops by exactly the amount, the `Deposit` event's staked + queued equals it, stLINK rises by the staked part (2 wei share rounding), the account queue and `totalQueued` rise by the queued part, and the unqueue returns exactly that LINK and restores both |
| `fork:lista:stake` | Bsc | `ListaStakeManager.deposit()` with native BNB | slisBNB balance increases |
| `fork:lista:unstake` | Bsc | StakeManager `deposit` BNB → slisBNB, then `requestWithdraw` all | slisBNB goes to 0 and one withdrawal request for the full amount is recorded |
| `fork:venus:supply` | Bsc | `vUSDC.mint` then `redeem` on the BSC Core Pool | the mint pulled the full USDC, vUSDC shares were minted, the redeem burned every share and USDC came back within rounding |
| `fork:lista-dao:deposit` | Bsc | USDT into the Lista MoolahVault (USDT) (ERC-4626), then redeem | the deposit pulled the full amount, shares were minted, the redeem burned every share and USDT came back within rounding |
| `fork:lido:submit` / `:wrap` | Ethereum | `submit` then optional `wrap` | stETH, then wstETH, increases |
| `fork:lido:request` | Ethereum | `submit`, then WithdrawalQueueERC721 `requestWithdrawals` | one unstETH NFT minted to the user for the stETH amount; request not finalized; pause is a FAIL |
| `fork:lido:unwrap` | Ethereum | `submit`, `wrap`, then `unwrap` the full wstETH balance | wstETH goes to 0 and stETH rises by getStETHByWstETH (±2 wei) |
| `fork:rocketpool:deposit` | Ethereum | `deposit()` on the Rocket deposit pool | rETH increases, or skip when the cap is too small |
| `fork:rocketpool:burn` | Ethereum | `deposit` ETH → rETH, then `rETH.burn` half | rETH falls by the burned amount and ETH received equals `getEthValue` exactly |
| `fork:cbeth:rate` | Ethereum | `exchangeRate()` | rate above 1. No public mint |
| `fork:etherfi:deposit` / `:wrap` | Ethereum | deposit ETH, wrap eETH | eETH, then weETH, increases |
| `fork:etherfi:request` | Ethereum | `deposit` ETH → eETH, then LiquidityPool `requestWithdraw` | a WithdrawRequestNFT is minted to the user, eETH is taken, request not finalized |
| `fork:kelp:deposit` | Ethereum | `depositETH` | rsETH increases, or skip when paused |
| `fork:kelp:request` | Ethereum | `depositETH` → rsETH, then LRTWithdrawalManager `initiateWithdrawal(ETH)` | rsETH goes to 0 and the user's ETH request nonce range grows by one |
| `fork:renzo:deposit` | Ethereum | `depositETH` | ezETH increases, or skip when capped |
| `fork:renzo:request` | Ethereum | `depositETH` → ezETH, then WithdrawQueue `withdraw(ezETH, ETH)` | ezETH goes to 0 and outstanding withdraw requests grow by one |
| `fork:eigenlayer:deposit` | Ethereum | `depositIntoStrategy` on the stETH strategy | deposit shares increase |
| `fork:eigenlayer:queue` | Ethereum | deposit, then `queueWithdrawals` | exactly one withdrawal queued and the deposited shares leave the staker (`sharesLeft` back to the starting 0). The delay is not advanced, completion is not asserted |
| `fork:symbiotic:read` | Ethereum | VaultFactory code | **Read-only.** Docs do not publish a permissionless vault |
| `fork:swell:deposit` | Ethereum | rswETH `deposit()` | rswETH increases, or read-only when the whitelist is on. FAIL with `coreMethodsPaused=true` when Swell's AccessControlManager has paused core methods (true since the 2026-10-21 incident, checked 2026-10-28), because deposit() would revert |
| `fork:puffer:deposit` | Ethereum | pufETH `depositETH` | pufETH increases, or read-only when `maxDeposit` is 0. FAIL with `targetClosed=true` when the vault's AccessManager has closed pufETH (`isTargetClosed`; true on 2026-10-19 and 2026-10-21), because depositETH would revert |
| `fork:wbeth:deposit` | Ethereum | wBETH `deposit(referral)` with native ETH | wBETH minted equals `value × 1e18 / exchangeRate()` (1 wei rounding) and the contract holds exactly the deposited ETH. Unwrap goes through Binance, so there is no redeem |
| `fork:meth:stake` | Ethereum | mETH `Staking.stake(minMETHAmount)` with native ETH, then `unstakeRequest` of every mETH minted. Pre-checks: `mETH()` and `unstakeRequestsManager()` are the documented contracts, staking and unstake requests are not paused, the staking allowlist is off, and the amount is above `minimumStakeBound()` | mETH minted equals the pre-tx `ethToMETH(value)` exactly and the Staking contract holds exactly the ETH; `unstakeRequest` moves every mETH into the UnstakeRequestsManager and emits `UnstakeRequested` for the user with `mETHLocked` = the minted mETH and `ethAmount` = the pre-tx `mETHToETH`. Finalisation and the claim are not waited out |
| `fork:meta-pool:deposit` | Ethereum | spETH `depositETH(receiver)` (ERC-4626). The Staking contract may fill from the Liquid Unstake Pool instead of minting | spETH + Liquid Unstake Pool hold exactly the deposited ETH more, the ERC-4626 `Deposit` event reports assets = deposit and shares = the user's gain, and shares are within 1 bp of the pre-tx `previewDeposit`. Unstake is a pool swap or a 2-9 day queue, so there is no redeem |
| `fork:stakewise:deposit` | Ethereum | Genesis Vault `depositAndMintOsToken` with native ETH, minting osETH worth half the deposit. Pre-checks: no pending keeper state update and room under `capacity()` | vault `totalAssets` rises by exactly the deposit, the `Deposited` event reports assets = deposit and shares = the user's gain (within 1 wei of the pre-tx `convertToShares`), and the user holds exactly the requested osETH, which equals the vault's osToken position. Exits use the validator exit queue, so there is no redeem |
| `fork:stakewise:exit` | Ethereum | Genesis Vault `deposit`, then `enterExitQueue` for every share | vault shares go to 0 and ExitQueueEntered carries the full share amount and a ticket |
| `fork:etherfi-cash:supply` | Optimism | USDC `supply` into reserve 0 of the ether.fi Cash Spoke (ether.fi-managed Aave V4 on OP Mainnet), then `withdraw` the full supplied balance. Pre-checks: reserve 0 is native USDC on the documented Liquidity Hub and is neither paused nor frozen | the user's USDC and the Hub's USDC move by exactly the amount, supply shares are minted and `getUserSuppliedAssets` is the amount within 1 wei; the withdraw returns exactly the supplied assets from the Hub and leaves 0 shares. Borrowing is limited to ether.fi Safes and is not called |
| `fork:layerzero:send` | Ethereum | OApp send → EndpointV2 PacketSent | Pre-check: the OApp's `endpoint()` is the documented EndpointV2 and the endpoint's `eid()` is 30101. `send` to Arbitrum (EID 30110) makes EndpointV2 emit `PacketSent` from exactly the send library `getSendLibrary(oapp, 30110)` returns, and `outboundNonce(oapp, 30110, peer)` rises by one. DVN verification and executor delivery are not run |
| `fork:benqi:supply` | Avalanche | supply USDC → qiUSDCn → redeem | Pre-check: Comptroller `mintGuardianPaused(qiUSDCn)` is false and `underlying()` is native USDC. `mint` returns 0, pulls exactly the amount, market cash rises by it and the qiTokens are worth the amount within 1 bp at `exchangeRateStored`; `redeem` of every qiToken returns the amount within 1 bp and leaves 0 qiUSDCn |
| `fork:benqi:stake` | Avalanche | stake AVAX → sAVAX | Pre-check: `mintingPaused()` is false. `submit` with the amount mints exactly the pre-tx `getSharesByPooledAvax(amount)` sAVAX and `totalPooledAvax` rises by exactly the amount. The 15-day `requestUnlock` exit is not exercised |
| `fork:tornado-cash:deposit` | Ethereum | Tornado Cash Classic 0.1 ETH pool: `deposit(bytes32 commitment)` payable with exactly `denomination()` | the pool's ETH balance rises by exactly 0.1 ETH, `Deposit` is emitted for the submitted commitment and `commitments[commitment]` flips to true |
| `fork:fluid-dex:swap` | Ethereum | `swapIn` on Fluid's USDC/native-ETH Dex pool (Fluid has no router) | WETH drops by exactly 1, USDC received equals the pool's `Swap` amountOut and is within 0.01% of the DexResolver quote |
| `fork:obol:stake` | Ethereum | `stake` on stOBOL (FixedStakedObol, non-rebasing staked OBOL) | stake(1000 OBOL) on stOBOL from a fresh, unfunded address is permissionless and moves exactly 1000.0 OBOL out of the caller; the stOBOL minted equals the pre-tx stake() quote exactly (796.819915503418444951 stOBOL at block 26328390, i.e. 1.25498871268574598 OBOL per stOBOL, not 1:1); stOBOL totalSupply rises by the minted shares (a +1 wei share-rounding tolerance) and rstOBOL totalSupply, ObolStaker.totalStaked and the default deposit's balance each rise by exactly 1000.0 OBOL; the receipt carries Fixed(caller, 1000e18) from stOBOL, Staked(stOBOL, 1000e18) from rstOBOL, StakeDeposited(rstOBOL, deposit 1, 1000e18) from ObolStaker and the stOBOLTransfer(0x0 -> caller, minted) mint. |
| `fork:pendle:buy-pt` | Ethereum | `buy-pt` on Pendle Router V4 | Buying PT with 1 wstETH through Pendle Router V4 swapExactTokenForPt on the PT-stETH-30DEC2027 market: the user's wstETH falls by exactly 1.0 (and the router's allowance is fully consumed), the PT balance rises by exactly the router's own netPtOut return value from the mined tx (1.280734577840052519 PT > 0 at block 26328420), netSyInterm > 0 proves SY was minted from the wstETH, and the PT received is within 0.5% of RouterStatic.swapExactTokenForPtStatic (quote 1.280650765635385731 PT, drift 6/1e5). |
| `fork:aster-bridge:deposit-native` | Bsc | `deposit-native` on Aster Deposit Bridge (AstherusVault, ERC-1967 proxy) | depositNative(0) with exactly 0.5 BNB on Aster's own BSC deposit bridge: the vault's own BNB balance rises by exactly 0.5 BNB, the vault emits Deposit(account=depositor, currency=NATIVE, isNative=true, amount=0.5 BNB, broker=0), and the depositor pays exactly 0.5 BNB plus gas |
| `fork:bedrock-unibtc:mint` | Ethereum | `mint` on Bedrock Vault (TransparentUpgradeableProxy) — the permissionless wrapped-BTC mint | Vault.mint(WBTC, 0.1 WBTC) on Bedrock's own Vault mints uniBTC 1:1: the caller's uniBTC balance rises by exactly 0.1 uniBTC, uniBTC.totalSupply() rises by exactly 0.1, the caller's WBTC falls by exactly 0.1 WBTC, the Vault's WBTC balance rises by exactly 0.1 WBTC, and the Vault emits Minted(WBTC, 10000000) |
| `fork:railgun:shield` | Ethereum | `shield` on RailgunSmartWallet (Ethereum proxy, EIP-1967) | shield() with one 10 USDC ShieldRequest (preimage npk = poseidon([masterPublicKey, 16-byte random]), TokenData(ERC20, USDC, 0), uint120 value 10000000) on RailgunSmartWallet: the wallet contract's USDC balance rises by exactly the post-deduction 9.975 USDC, the treasury receives exactly the 0.025 USDC documented 0.25% deduction, nextLeafIndex advances by exactly 1 from the Shield event's startPosition, merkleRoot changes to a root recorded in rootHistory(treeNumber, root), and the Shield event carries our preimage (npk, USDC, 9975000) whose PoseidonT4 leaf hash is poseidon([npk, tokenID, valueAfterFee]) |
| `fork:axelar:send-message` | Ethereum | `send-message` on AxelarGateway (Ethereum) | payNativeGasForContractCall{value: 0.01 ETH}(sender, "Polygon", 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C, payload, sender) on the AxelarGasService, then callContract("Polygon", 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C, payload) on the AxelarGateway: the gas service's own ETH balance rises by exactly 0.01 ETH, the gas service emits NativeGasPaidForContractCall with sender/destinationChain/destinationAddress/keccak256(payload)/0.01 ETH/refundAddress and the gateway emits ContractCall with the same payloadHash and the exact payload bytes, and the caller's ETH spend equals exactly 0.01 ETH + gas |
| `fork:fraxtal:deposit-erc20` | Ethereum | `deposit-erc20` on Fraxtal L1StandardBridgeProxy | depositERC20(100 frxUSD, l2Token 0xFc00000000000000000000000000000000000001, minGasLimit 200000, extraData 0x) on the Fraxtal L1StandardBridge is permissionless and locks exactly 100 frxUSD: the bridge's frxUSD balance rises by exactly 100 frxUSD (99,488,625.39670378616664868 -> 99,488,725.39670378616664868), the depositor's frxUSD drops by exactly 100, the bridge emits ERC20DepositInitiated(l1Token=0x853d955aCEf822Db058eb8505911ED77F175b99e, l2Token=0xFc00000000000000000000000000000000000001, from=to=depositor, amount=100e18, extraData=0x) and the OptimismPortal emits TransactionDeposited for the enqueued L2 message; native ETH is provably NOT bridgeable - depositETH reverts with "StandardBridge: cannot bridge ETH with custom gas token" because Fraxtal is a custom-gas-token chain |
| `fork:hyperliquid-bridge:deposit` | Arbitrum | `deposit` on Hyperliquid Bridge (Bridge2, Arbitrum USDC escrow) | Escrow's USDC balance rises by exactly 10.0 USDC (197,413,197.707209 -> 197,413,207.707209 at fork block 520631025) and the receipt carries USDC Transfer(from=depositor, to=escrow, value=10.0 USDC), while the depositor's USDC falls by exactly 10.0. The escrow's own storage does not move: the deposit path is a plain ERC-20 transfer, not a contract call. |
| `fork:polymarket:split` | Polygon | `split` on ConditionalTokens (Gnosis CTF, Polymarket deployment) | splitPosition(USDC, bytes32(0), conditionId, [1,2], 10 USDC) on a prepared, unresolved binary condition from Polymarket's UMA CTF Adapter moves exactly 10.0 USDC out of the fresh account and exactly 10.0 USDC into the ConditionalTokens contract, and the account's YES (indexSet 1) and NO (indexSet 2) CTF position balances each go 0 -> 10.0 (equal and non-zero), with a PositionSplit event carrying the same stakeholder, conditionId and amount |
| `fork:armitage:deposit` | Ethereum | `deposit` on Wintermute USDC Select (Morpho Vault V2, symbol armUSDCs; largest of the seven Armitage-curated vaults) | deposit(100 USDC, freshAccount) into Wintermute USDC Select (0xA2EA…68cd) is permissionless: it mints shares equal to previewDeposit (drift <= 1e-6 of preview), increases totalSupply by exactly the minted shares, increases totalAssets by 100 USDC plus at most one block of accrued interest, and the minted shares convertToAssets back to ~100 USDC (within 1%) |
| `fork:xdai-stake-bridge:deposit` | Ethereum | `deposit` on xDAI Stake Bridge, Ethereum side (POA EternalStorageProxy; implementation 0x257bDD093Cab1Bd39eBF837dCB60f33d031d7d49) | relayTokens(freshAccount, 100 USDS) on the Ethereum xDAI bridge (0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016) is permissionless: the bridge's USDS collateral (USDS.balanceOf(bridge), the exact call the DefiLlama adapter makes) rises by exactly 100 USDS, the bridge's own totalSpentPerDay bucket for the deposit block's day rises by exactly 100 USDS, and the depositor's USDS balance falls by exactly 100 USDS |
| `fork:lista-dao:borrow` | Bsc | supplyCollateral 0.01 BTCB into the BTCB/USDT Moolah market, then borrow 100 USDT | USDT balance rises by the borrowed amount and borrow shares > 0 |
| `fork:liquity:open` | Ethereum | BorrowerOperations.openTrove with 2 ETH and walked SortedTroves hints | trove opens and LUSD balance rises by the requested debt |
| `fork:liquity:redeem` | Ethereum | TroveManager.redeemCollateral of 100 LUSD with partial-redemption hints | LUSD burned and ETH balance rises |
| `fork:liquity:liquidate` | Ethereum | open a thin trove, crash PriceFeed 50% with MockPrice, TroveManager.liquidate | trove status goes 1 (active) to 3 (closed by liquidation) |
| `fork:venus:borrow` | Bsc | mint vUSDC collateral, enterMarkets, vUSDC.borrow 100 USDC | borrowBalance goes 0 to 100 USDC and USDC received |
| `fork:venus:repay` | Bsc | borrow then repayBorrow(type(uint256).max) | borrowBalance returns to 0 |
| `fork:venus:redeem` | Bsc | mint vUSDC then redeemUnderlying | USDC received equals the redeemed amount |
| `fork:fluid-lending:borrow` | Ethereum | vault.operate(nftId 0, +1 ETH collateral, +100 USDC debt) on the ETH/USDC vault | position NFT minted and USDC balance rises by 100 |
| `fork:benqi:borrow` | Avalanche | qiAVAX.mint, enterMarkets, qiUSDCn.borrow 100 USDC | borrowBalance goes 0 to 100 USDC |
| `fork:benqi:redeem` | Avalanche | mint qiUSDCn then redeemUnderlying | USDC received equals the redeemed amount |
| `fork:euler:borrow` | Ethereum | deposit WETH into K3 Prime eWETH, EVC enableCollateral + enableController, eUSDC.borrow | USDC debt goes 0 to 100 and USDC received |
| `fork:veda:liquid-usd` | Ethereum | Teller.deposit 100 USDC into the Liquid USD BoringVault | liquidUSD minted equals amount / Accountant rate and vault USDC +100 |
| `fork:veda:liquid-btc` | Ethereum | Teller.deposit 0.01 WBTC into the Liquid BTC BoringVault | liquidBTC minted at the Accountant rate |
| `fork:lagoon:request-deposit` | Ethereum | create a USDC vault from the official Factory (logic v0.5.0, whitelist off), then requestDeposit | pendingDepositRequest equals the assets and USDC moves to the pending silo |
| `fork:eigenlayer:complete` | Ethereum | deposit stETH, queueWithdrawals, mine past minWithdrawalDelayBlocks, completeQueuedWithdrawal | stETH returned to the staker; slow (~25 min), excluded from default fork:all |
| `fork:eigenlayer:delegate` | Ethereum | register a fresh operator, deposit stETH, DelegationManager.delegateTo | operatorShares rise by the staker's shares |
| `fork:saturn:unstake` | Ethereum | sUSDat.deposit then requestRedeem(all) | shares escrowed in the Withdraw contract and a request NFT minted |
| `fork:meta-pool:withdraw-request` | Ethereum | spETH.depositETH then redeem(all) into the Withdrawal queue | pendingWithdraws records the request for the next epoch |
| `fork:solvbtc:redeem` | Ethereum | Router.createSubscription with WBTC, then createRedemption(all) | SolvBTC burned and a redemption share id issued |
| `fork:cian:withdraw-request` | Ethereum | vault.requestRedeem(all, rsETH); shares are dealt because deposit is paused (stale price) | shares move to the RedeemOperator |
| `fork:benqi:unlock` | Avalanche | sAVAX.requestUnlock(all), warp the 15-day cooldown, redeem(index) | early redeem reverts; after the cooldown AVAX is paid back |
| `fork:frax:mint-frxeth` | Ethereum | frxETHMinter.submit{1 ETH} on the original minter | frxETH minted 1:1 |
| `fork:symbiotic:deposit` | Ethereum | scan VaultFactory for a public wstETH vault with room, Vault.deposit | activeBalanceOf rises by the deposit |
| `fork:theo:unstake` | Ethereum | initiateRedeem(all), early redeem reverts, warp 5-day lockup, redeem | redeem pays the booked thUSD |
| `fork:aerodrome:add-liquidity` | Base | transfer AERO + USDC pro-rata to the AERO/USDC v2 pool and mint | LP minted equals totalSupply delta and reserves rise by the inputs |
| `fork:aerodrome:lock` | Base | VotingEscrow.createStake(1000 AERO, 52 weeks) | stake NFT owned by the user, supply +1000 and voting power > 0 |
| `fork:balancer:join` | Ethereum | Vault.joinPool EXACT_TOKENS_IN_FOR_BPT_OUT with 1 WETH into B-80BAL-20WETH | BPT > 0, WETH -1 and pool WETH balance +1 |
| `fork:sushiswap:add-liquidity` | Ethereum | Router.addLiquidity WETH/USDC | SLP > 0 and both legs debited |
| `fork:pendle:mint-py` | Ethereum | Router V4 mintPyFromToken with 1 wstETH | PT and YT deltas equal the static preview |
| `fork:pendle:add-liquidity` | Ethereum | Router V4 addLiquiditySingleToken with 1 wstETH | LP >= 99.5% of the static preview |
| `fork:fx:operate` | Ethereum | PoolManager.operate on the wstETH pool: 2 wstETH collateral, 2000 fxUSD debt | position owned by the user and fxUSD minted net of fee |
| `fork:fx:stability-deposit` | Ethereum | FxUSDBasePool.deposit 1000 fxUSD | shares equal previewDeposit and fxUSD -1000 |
| `fork:cooler:repay` | Ethereum | addCollateral 1 gOHM, borrow 1500 USDS, repay(MAX), withdrawCollateral | debt goes to 0 and repaid >= principal |
| `fork:convex:claim` | Ethereum | deposit 3Crv (pid 9), earmarkRewards, warp, BaseRewardPool.getReward | CRV received >= earned and earned resets to 0 |
| `fork:usdai:mint` | Arbitrum | USDai.deposit with its baseToken PYUSD (USDC is rejected on-chain) | PYUSD -1000, USDai +1000 and supply +1000 |
| `fork:sky:vault` | Ethereum | WETH join, Vat.frob(ETH-A), USDS_JOIN.exit 8000 USDS | USDS +8000 and the urn's ink/art rise |
| `fork:xdai-stake-bridge:relay` | Ethereum | OmniBridge.relayTokens(USDC, receiver, 1000) | mediator USDC +1000 and TokensBridgingInitiated emitted |
| `fork:defisaver:recipe` | Ethereum | build a DSProxy, execute RecipeExecutor: AaveV3Supply 5 WETH + AaveV3Borrow 1000 USDC | user USDC +1000, proxy holds aWETH and USDC debt, health factor > 1 |
<!-- /features:actions -->

## Perps

Perp books are not Uniswap-style routers. GMX V2 runs an order pipeline and Hyperliquid matches off-chain on its own L1, so neither is reachable from a plain EVM fork. The rest of the perps tab stays API-only (`analytics:<name>:perps` + smoke), same rule as Solana venues.

<!-- features:perps -->
| Script | Chain | Action | Assertion |
| --- | --- | --- | --- |
| `fork:gmx:read` | Arbitrum | Read-only: GMX V1 vault, GLP supply and GLP price | USDC in the V1 vault and GLP supply both above 0 |
| `fork:derive-v3:deposit` | Ethereum | `deposit` on Derive v3 ACTION_MANAGER (OnchainActionManager proxy; depositToNewSubaccount) | depositToNewSubaccount(USDC spot label 0x57B03E14d409ADC7fAb6CFc44b5886CAD2D5f02b, 100 USDC, managerId 1) from a fresh address moves exactly 100.0 USDC: the depositor's USDC falls by 100.0 and SPOT_VAULT's USDC rises by 100.0 in the deposit block, and the OnchainActionManager queues one public action of type 2 (DEPOSIT_TO_NEW_SUBACCOUNT_TYPE) whose 76-byte payload encodes the USDC label, 100.0 USDC, managerId 1 and the depositor, advancing publicActionsAcc; the new subaccount itself is credited asynchronously by the zk batch, which a fork cannot run |
<!-- /features:perps -->

**GMX V1 is sunset, so there is no mint test.** [Contracts for V1](https://docs.gmx.io/docs/archived/contracts-v1) says trading and providing liquidity are no longer supported, and the live chain agrees:

- `Vault.isSwapEnabled()` and `Vault.isLeverageEnabled()` are both `false`.
- `GlpRewardRouter.mintAndStakeGlp` reverts with `SafeMath: subtraction overflow` even for 1 USDC, against a real whale.

The script therefore reads `Vault.poolAmounts(USDC)`, `GlpManager.getAum/getPrice` and `GLP.totalSupply()` and asserts the book still reads. GLP price on the last run was about **$0.090** with a V1 AUM near **$848k**, down from the V1 peak, which is consistent with a closed book.

**Hyperliquid Bridge has fork coverage on Arbitrum (2026-11-03).** The perps engine stays off-chain, but this row's TVL is the Arbitrum escrow `0x2df1c51e09aecf9cacb7bc98cb1742757f163df7` (Bridge2, ~197M USDC), and a deposit there is a bare USDC transfer that the L1 validators consume. `fork:hyperliquid-bridge:deposit` asserts the escrow USDC delta and the transfer log. The previously cited `0x2Df1c67E04526f42B83764733b06AAf4e2B05B02` is the wrong address: it fails EIP-55 checksum validation and its checksum-correct form has no code.

Raydium is Solana. The suite does not fork it. The showcase marks that row API-only.

## Vault curators and allocators

Same rules. A vault whose `maxDeposit` is 0 (or whose deposits are paused or closed, checked before any transaction) is not deposited into. The script prints `readOnly=` and the panel says **Read-only** when that is the known state. A deposit that reverts is a FAIL, even if the revert looks like an allowlist or cap.

<!-- features:vaults -->
| Script | What it asserts |
| --- | --- |
| `fork:steakhouse:deposit` | USDC into MetaMorpho Steakhouse USDC, then redeem. Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding (the key prints USDC before → after deposit → after redeem) |
| `fork:gauntlet:deposit` | Same on MetaMorpho Gauntlet USDC Prime (V1). V2 `maxDeposit` is 0, so V2 is not deposited into |
| `fork:sentora:deposit` | deposit pulls exactly the amount and mints shares; the exit returns every RLUSD and leaves at most interest-dust shares. A set gate makes it a labelled read |
| `fork:veda:deposit` | **Deposit only.** WETH into the ether.fi Liquid ETH BoringVault through its Teller. Shares minted. `bulkWithdraw` is not a public capability, and WETH `allowWithdraws` was false, so there is no redeem |
| `fork:veda:request` | all shares move from the user to the queue and exactly one request is added; a paused queue or closed payout assets is a FAIL |
| `fork:upshift:deposit` | USDC into Upshift Sentora USD, then `instantRedeem`. The USDC paid equals the pre-tx `previewRedemption(shares, true)` after-fee amount, that amount is the gross minus `instantRedemptionFee` (basis points), and the gross is within 1 bp of the deposit. If instant redeem is closed, `requestRedeem` is asserted and the withdrawal is not waited out |
| `fork:yearn:deposit` | USDC into Yearn V3 USDC-1, then redeem |
| `fork:euler:deposit` | USDC into Euler Earn K3 Capital Earn USDC (first non-deprecated Ethereum vault in euler-labels), then redeem |
| `fork:rockawayx:deposit` | USDC into RockawayX USDC Yield, a Morpho Vault V2, then redeem. V2 `maxDeposit` is always 0, so the pre-check is that all four gates are unset (a set gate makes it a labelled read). Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding |
| `fork:spark-vaults:deposit` | USDC into Spark Savings spUSDC (ERC-4626), then redeem. Idle liquidity caps redeem; the round trip asserts within idle balance |
| `fork:clearstar:deposit` | USDC into Clearstar cbAssets Vault on Base, a Morpho Vault V2, then redeem. Pre-check: all four V2 gates unset (a set gate makes it a labelled read). Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding |
| `fork:hyperithm:deposit` | USDC into Hyperithm USDC Apex on Ethereum, a Morpho Vault V2, then redeem. Same gate pre-check and round-trip assertions as RockawayX. Most of the row's TVL is the Monad vault of the same name |
| `fork:concrete:deposit` | **Deposit only.** USDT into Concrete ctDefiUSDT (Earn V2 async vault, ERC-4626 deposit). Pre-check: the amount sits inside `getDepositLimits()` (outside is a labelled read). Asserts the vault pulled exactly the amount, the shares equal the pre-tx `previewDeposit`, and the `Deposit` event reports the same assets and shares. Withdrawal is an epoch queue processed about weekly, so there is no redeem |
| `fork:concentrator:deposit` | cvxCRV into Concentrator aCRV (AladdinCRV, ERC-4626 compounder), then redeem. Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the cvxCRV came back within rounding (`withdrawFeePercentage()` was 0 on 2026-10-26) |
| `fork:fluid-lite:deposit` | stETH into Fluid Lite iETHv2 (ERC-4626), then redeem every share. Asserts the shares equal the pre-tx `previewDeposit`, the deposit pulled the amount (stETH 1-2 wei rounding), the redeem burned every share, and the stETH returned equals `previewRedeem` minus `withdrawalFeePercentage()` (ppm; 500 = 0.05% on 2026-10-26) within 2 wei |
| `fork:ember:deposit` | USDC into Ember Earn (eEARN, ERC-4626 deposit), then `redeemShares`. Pre-checks: `asset()` is USDC and `maxDeposit` covers the amount (below it is a labelled read). Asserts the vault pulled exactly the amount, the shares equal the pre-tx `previewDeposit`, and `redeemShares` moved every share into the vault and appended one queue entry for the user with those shares and `estimatedWithdrawAmount` = `convertToAssets(shares)`. Ember's operator processes the queue (3-day period), so the payout is not waited out |
| `fork:kpk:deposit` | USDC into KPK USDC Prime on Ethereum, a Morpho Vault V2 curated by KPK, then redeem. Same gate pre-check and round-trip assertions as RockawayX. KPK's Gearbox pools, Symbiotic vault and managed Safes are not exercised |
| `fork:galaxy:deposit` | USDC into Galaxy USDC Quality (gUSDCq) on Ethereum, a Morpho Vault V2 curated by Galaxy Curation, then redeem. Same gate pre-check and round-trip assertions as RockawayX. Most of the row's TVL is the Galaxy USDC vault on Arc, which the repo does not fork |
| `fork:aera:request` | USDC `requestDeposit` (auto price, no solver tip, 1-hour deadline, `minUnitsOut` = 97% of `convertTokenToUnits`) on the gtUSDa ProvisionerV2 on Base. Pre-checks: the vault's `provisioner()` and `feeCalculator()` are the documented ones, async USDC deposits are enabled and the vault is not paused. Asserts the user's USDC and the Provisioner's USDC move by exactly the amount and `asyncRequestHashes` holds `getRequestHash` of the request; after the deadline `refundRequest` returns exactly the USDC, clears the hash, and the user holds no units. Solving is done by Aera's solver off this machine |
| `fork:liquity:deposit` | Pre-check: the Stability Pool's `lusdToken()` is the documented LUSD. `provideToSP` pulls exactly the amount, `getTotalLUSDDeposits` rises by it and the compounded deposit equals it; `withdrawFromSP` returns every LUSD, leaves a 0 deposit and restores the pool total. Opening a trove and Liquity V2 (BOLD) are not exercised |
| `fork:convex:deposit` | Booster `poolInfo(9)` (Curve 3pool) gives the LP token, gauge and BaseRewardPool; neither the pool nor the Booster is shut down. `deposit(pid, amount, true)` takes exactly the LP, the Curve gauge's LP rises by it, and the user's BaseRewardPool balance and its total supply rise by it (no loose cvx3Crv left). `withdrawAndUnwrap` returns every LP, clears the stake and restores the gauge balance. CRV/CVX reward claims are not asserted |
| `fork:cian:deposit` | Pre-checks: `asset()` is rsETH, not paused, `maxDeposit` covers the amount, and the operator's exchange-price window (`remainingUpdateTime`) is open (deposits revert `PriceNotUpdated()` otherwise). `deposit` takes exactly the rsETH and mints exactly the pre-tx `previewDeposit`, matching the rise in total supply. `requestRedeem(shares, rsETH)` moves every share to the documented RedeemOperator queue. CIAN settles the queue off the fork, so the rsETH payout is not asserted |
| `fork:grove:deposit` | shares minted equal `previewDeposit`, `totalSupply` rises by exactly the shares and `totalAssets` by 100 USDC |
| `fork:bitfi-basis:deposit` | deposit(0.01 BTCB, minAmount = previewDeposit * 0.99) on BitFi's own bfBTC basis vault on BSC, from a fresh impersonated address: measured delta is bfBTC minted 0.00895896 (exactly equal to previewDeposit(0.01 BTCB)), vault totalSupply +0.00895896 bfBTC (equal to the mint), depositor BTCB -0.01 exactly, and the minted bfBTC values back to 0.009999991182019973 BTCB at currentRatio (0.01% tolerance) |
| `fork:fluid-lending:deposit` | deposit(100 USDC, freshAccount) on Fluid's fUSDC fToken is permissionless and mints exactly previewDeposit(100 USDC) shares (a same-second deposit matches exactly; a deposit that lands in a later second may only round at most 1e-6 relative below preview because the exchange price is monotonic), increases fUSDC.totalSupply by exactly the minted shares, increases fUSDC.totalAssets by 100 USDC (within 10 micro-USDC of share/exchange-price rounding and at most one block of accrued interest), moves exactly 100 USDC into the Fluid Liquidity contract that holds all fToken underlying (the fToken itself never holds funds), and the fToken emits Deposit(sender=freshAccount, owner=freshAccount, assets=100 USDC, shares=minted) |
| `fork:mellow-core:deposit` | deposit(100 USDC) from a fresh impersonated address on the earnUSD Mellow Core Vault through its USDC SyncDepositQueue: measured delta is 96.253508847487042426 shares minted, exactly equal to previewDeposit = 100 USDC * oracle price 962535088474870424260645342946 / 1e18 (penaltyD6 0, depositFeeD6 0), ShareManager totalShares +96.253508847487042426 (equal to the mint), the vault's total assets (Mellow Collector totalBase = totalShares * 1e18 / priceD18) +100.000000 USDC (56,754,285.912745 -> 56,754,385.912745 USDC), and the depositor's USDC -100.000000 exactly |
<!-- /features:vaults -->

## Stablecoins, RWA, and bridges

Same rules: pinned block via `FORK_BLOCK`, whale impersonation or `anvil_deal`, no `PRIVATE_KEY`. Addresses are in `src/catalog/contracts.js` with the doc link.

<!-- features:stables -->
| Script | What it asserts |
| --- | --- |
| `fork:sky:convert` | DAI→USDS→DAI on the Sky converter, 1:1 |
| `fork:sky:susds` | Deposit USDS into sUSDS and redeem |
| `fork:sky:psm` | USDC and USDS move by exactly the amounts implied by `tin`/`tout`; a halted direction is a FAIL |
| `fork:sky:redeem` | sUSDS goes to 0, USDS out ≥ previewRedeem and ≥ the deposit |
| `fork:sky:sdai` | Deposit DAI into sDAI and redeem |
| `fork:ethena:stake` | USDe→sUSDe. Mint is whitelisted and is not called |
| `fork:usdai:stake` | USDai→sUSDai via ERC-4626 deposit. Protocol mint of USDai is whitelisted and is not called. Redeem is a 30-day queue, so this does not redeem |
| `fork:ethena:cooldown` | Start the sUSDe cooldown. Completing the unstake waits out `cooldownDuration` |
| `fork:ethena:unstake` | Stake, `cooldownShares`, advance the fork by `cooldownDuration`, `unstake`: wallet USDe rises by exactly the cooled amount and the cooldown clears |
| `fork:circle:transfer` / `fork:tether:transfer` | Transfer only. Mint and redeem are off-chain or KYC'd. The panel says **Transfer / read-only** |
| `fork:frax:rate` | `sfrxUSD.convertToAssets`. Ethereum `maxDeposit` is 0, so there is no local deposit. The panel says **Read-only** (not KYC; there is just no Ethereum deposit path) |
| `fork:buidl:read` | BUIDL `totalSupply`. **KYC-gated: read-only** |
| `fork:ondo:rate` | USDY `getPrice` and OUSG `getAssetPrice`. **KYC-gated: read-only** |
| `fork:superstate:nav` | USTB continuous oracle `latestRoundData`. **KYC-gated: read-only** |
| `fork:arbitrum:deposit` | `Inbox.depositEth`. Bridge ETH increases and `InboxMessageDelivered` is emitted |
| `fork:base:deposit` / `fork:optimism:deposit` | `L1StandardBridge.depositETH`. ETH held by the bridge + portal (+ the `ETHLockbox` that `OptimismPortal.ethLockbox()` returns; OP Mainnet holds its ETH there, Base returned none on 2026-10-10) increases by the deposit and `ETHDepositInitiated` is emitted |
| `fork:across:deposit` | `SpokePool.depositV3` locks USDC on Ethereum toward Base |
| `fork:stargate:quote` / `:deposit` | `quoteOFT` + `quoteSend`, then `send` locks USDC toward Arbitrum |
| `fork:world-chain:deposit` | World Chain `L1StandardBridge.depositETH`. ETH held by the bridge + portal (+ an `ETHLockbox` when the portal reports one; none on 2026-10-19) increases by exactly the deposit and `ETHDepositInitiated` is emitted |
| `fork:robinhood:deposit` | Robinhood Chain Delayed Inbox `depositEth`. `Inbox.bridge()` is the documented Bridge, the Bridge holds exactly the deposit more ETH, and `InboxMessageDelivered` is emitted |
| `fork:starknet:deposit` | StarkGate `deposit(ETH, amount, l2Recipient)` with `amount + estimateDepositFeeWei()`. The bridge keeps exactly `amount`, emits `Deposit`, and the Starknet core contract emits `LogMessageToL2` |
| `fork:polygon:deposit` | `RootChainManager.depositEtherFor`. The EtherPredicate holds exactly the deposit more ETH and emits `LockedEther` |
| `fork:lighter-bridge:deposit` | Lighter `deposit(to, 3, 0, amount)` (USDC, perps route). The user's USDC drops by exactly the amount, the Lighter contract's USDC rises by it, and the contract logs the deposit. L2 crediting is off this machine |
| `fork:near-bridge:deposit` | Omni Bridge `initTransfer(address(0), amount, 0, 0, "near:…", "")` with native ETH. The bridge holds exactly the deposit more ETH and emits `InitTransfer` with the same sender, token, amount, zero fees and recipient. The NEAR light client side is off this machine |
| `fork:portal:transfer` | Token Bridge `wrapAndTransferETH` toward Wormhole chain 23 (Arbitrum). The bridge's WETH rises by exactly the amount and the Core Contract's `LogMessagePublished` carries a type-1 transfer payload with the amount at 8 decimals, WETH on chain 2 and the recipient. Guardian signing and redemption are off this machine |
| `fork:ccip:send` | Router `ccipSend` of LINK to Base, fee in ETH. `TokenAdminRegistry.getPool(LINK)` must be the documented LockReleaseTokenPool. The user's LINK drops and the pool's LINK rises by exactly the amount, the user pays exactly `getFee()` in ETH, and the lane's OnRamp logs the message. DON execution on Base is off this machine |
| `fork:saturn:stake` | **Deposit only.** USDat into sUSDat (StakedUSDat, ERC-4626). Pre-checks: not `paused()` and `maxDeposit` covers the amount. Asserts the vault pulled exactly the amount, the shares equal the pre-tx `previewDeposit` (which prices in the deposit fee), and the `Deposit` event reports the same assets, shares and owner. Unstaking is a request / process / claim queue, so there is no redeem |
| `fork:vesper:deposit` | Gateway `deposit` of USDC mints exactly the pre-tx `previewDeposit` in USDv (fixed-price adapter at 1.0) and pulls exactly the USDC. Staking all of it into sUSDv (ERC-4626) spends exactly that USDv, the `Deposit` event reports those assets and the user's shares, and shares are within 1 bp of the preview (sUSDv vests yield per second). `requestRedeem` burns every share, opens one pending request whose assets equal the rise in `totalAssetsInCooldown`, and that amount is at least the pre-tx `previewRedeem` and within 1 bp of it (vesting can add a second of yield). The 7-day cooldown and the USDv -> USDC redemption are not waited out |
| `fork:falcon:stake` | USDf into sUSDf (ERC-4626), then `redeem` every share. Pre-checks: `asset()` is the documented USDf and `maxDeposit` covers the amount. Asserts the user's USDf and the vault's USDf move by exactly the amount, the `Deposit` event reports the amount and the user's shares, and the shares are within 1 bp of the pre-tx `previewDeposit` (sUSDf vests yield per second); the redeem burns every share, the `Withdraw` event matches the USDf received, and that is within 1 bp of both `previewRedeem` and the amount staked. Minting USDf from collateral is KYC-gated and is not called |
| `fork:usdt0:send` | Pre-check: the adapter's `token()` is USDT. `quoteOFT` sets `minAmountLD` to the quoted received amount and `quoteSend` prices the LayerZero fee; `send` to Arbitrum (EID 30110) takes exactly the amount from the user, the adapter's locked USDT rises by exactly the quoted `amountSentLD`, and `OFTSent` reports the destination, sender, sent and received amounts. Minting USDT0 on Arbitrum needs LayerZero delivery and is not run |
| `fork:theo:stake` | Pre-checks: `asset()` is the documented thUSD and the vault is not paused. `deposit` moves exactly the amount, mints exactly the pre-tx `previewDeposit` and emits a matching `Deposit`. `initiateRedeem` burns every share and books one request for them worth the pre-tx `convertToAssets` (within 1 bp, vesting only moves it up). After `lockupPeriod` (5 days) is advanced on the fork, `redeem` pays exactly the booked thUSD and clears the request; the time jump is then reverted with `evm_revert`. Minting thUSD itself is whitelisted (signed orders) and is not called |
| `fork:solvbtc:subscribe` | Pre-check: `checkPoolPermission` is true for a fresh account on the documented Ethereum WBTC storage pool. `createSubscription` takes exactly the WBTC, the user's SolvBTC rises by exactly the router's static-call return value, SolvBTC total supply rises by the same amount, `CreateSubscription` reports it with the WBTC paid, and the amount is within 1% of the WBTC at 1:1 (it carries Solv's deposit fee). Redeeming SolvBTC is an Open Fund request settled by Solv and is not run |
| `fork:zama:wrap` | Pre-checks: the Wrappers Registry lists cUSDC as the valid wrapper for USDC and its `underlying()` is USDC. `wrap` takes exactly the amount from the user, the wrapper's USDC rises by it, `inferredTotalSupply` rises by amount / `rate()`, and the user gets a non-zero encrypted balance handle. Balances are FHE ciphertexts, so the amount inside the handle is not read; unwrapping needs the Zama decryption network and is not run |
| `fork:usdd:mint` | sellGem(user, 100 USDT) on the USDD PSM (ilk PSM-USDT-A, tin 0) mints USDD at 1:1: the caller's USDD balance rises by exactly 100 USDD, USDD totalSupply rises by exactly 100 USDD, the caller's USDT falls by exactly 100 USDT, and the PSM emits SellGem(user, 100e6, 0) |
| `fork:avant:stake` | deposit(100 avUSD, freshAccount) on savUSD at Avalanche fork block 99237527 is permissionless (maxDeposit = 2^256-1, no whitelist/role on the deposit path) and mints exactly 82.425633865240743429 savUSD, equal to previewDeposit(100e18) with 0 wei drift; savUSD totalSupply rises by exactly 82.425633865240743429; the caller's avUSD balance falls by exactly 100.0; the vault's avUSD balance and totalAssets each rise by exactly 100.0 avUSD (unvested 0 before and after); the receipt carries Transfer(0x0 -> caller, 82.425633865240743429) from savUSD and Transfer(caller -> vault, 100e18) from avUSD. |
<!-- /features:stables -->

Bridge panels are labeled **Source chain only**. A single fork cannot see the destination credit. Rollup derivation, Across fillers, and LayerZero relayers are off this machine.

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

## Rows with a documented reason instead of a test

Some top-200 rows sit on a chain the repo can fork but expose no permissionless action, so a fork test could only revert. Their reason lives in `API_ONLY` in `src/catalog/forkRecipes.js` and the protocol page prints it in place of an empty panel. Contracts, where they exist, are still listed from `src/catalog/contracts.js`.

| Row | Why there is no fork test |
| --- | --- |
| NEAR Intents | Balances live in the `intents.near` Verifier on NEAR; solvers fill signed intents off-chain |
| Re | Mint and redeem of reUSD / reUSDe require KYC/KYB |
| Plume Vaults (Nest) | Each deposit needs a fresh Predicate compliance attestation from the Nest API |
| Unit | Guardian MPC network; the Ethereum treasury is an MPC account with no contract code |
| Maple | SyrupRouter enforces `PoolPermissionManager` `P:deposit`; a first deposit needs a Maple signature |
| LayerZero V2 | Messaging layer: EndpointV2 holds no user funds, value sits in each OApp/OFT, and delivery needs DVNs and an Executor. `fork:stargate:deposit` already runs a LayerZero V2 send |
| RSK Bridge | Almost all BTC sits in the Rootstock Powpeg on Bitcoin; the Ethereum Token Bridge (about $1M) was sunset at the end of March 2026 |
| Huma | PST is minted and redeemed by the Huma program on Solana; on Ethereum PST is a CCIP cross-chain token with no Huma deposit or redeem contract |

## Showcase panel

`showcase/data.json` rows carry `testing`:

- `mode: "fork"` — copy-paste `startFork` command, the `fork:*` command, the RPC env var, and contract addresses.
- `mode: "api-only"` — a clear API-only label plus the generic Anvil recipe for that category (DEX → Uniswap V3 quote, lending → `fork:aave:supply`, staking → `fork:lido:submit`, and so on).

Open `#p=uniswap` on the board, or `showcase/protocol.html?slug=aave`. `src/analytics/ranking/coverage.js` calls `enrichShowcase` from `src/catalog/forkRecipes.js` when `npm run showcase:build` writes `data.json`. `node scripts/showcaseCheck.js` rejects a row with no `testing.mode`.
