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
| `fork:monad:v3` | Monad | Uniswap V3 | Skipped when `MONAD_RPC_URL` is unset |
| `fork:aave:supply` / `:borrow` / `:repay` / `:withdraw` | Ethereum | Aave V3 pool from `chains.js` | aToken, debt, or wallet balance moves the right way |
| `fork:spark:supply` / `:borrow` / `:repay` / `:withdraw` | Ethereum | Same four actions on the SparkLend pool | Spark is an Aave V3 fork |
| `fork:compound:supply` / `:borrow` | Ethereum | Compound III cUSDCv3 | base balance or borrow balance increases |
| `fork:morpho:supply` / `:borrow` | Ethereum | One listed WETH/USDC Morpho Blue market | supply shares or borrow shares increase |
| `fork:llamalend:deposit` | Ethereum | crvUSD into the Llamalend V1 wstETH-long vault (`OneWayLendingFactory.vaults(13)`, ERC-4626), then redeem | the factory still lists the vault, the deposit pulled the full amount, shares were minted, the redeem burned every share and crvUSD came back within rounding |
| `fork:dolomite:supply` | Ethereum | `DepositWithdrawalRouter.depositWei` into account 0, then `withdrawWei` of the full balance with `BalanceCheckFlag.From` | the deposit pulled the full amount, `DolomiteMargin.getAccountWei` rose by it, the withdraw left the account at 0 and the USDC came back |
| `fork:cooler:borrow` | Ethereum | MonoCooler `addCollateral` (gOHM), `borrow` USDS, `repay(type(uint128).max)`, then `withdrawCollateral(type(uint128).max)`. Pre-checks: the documented gOHM / USDS tokens, `borrowsPaused()` false, and the borrow sits between `minDebtRequired()` and the origination LTV | `accountCollateral` and the wallet move by exactly the gOHM posted, the wallet receives exactly the USDS borrowed and `accountDebt` equals it, the full repay leaves `accountDebt` at 0 (paying the borrow plus per-second interest), and every gOHM comes back |
| `fork:curvance:deposit` | Monad | WMON into cWMON of the WMON \| USDC market (ERC-4626 style `deposit`), then `redeem` every share. `marketManager()` must be the documented MarketManager. WMON is wrapped from native MON on the fork | the deposit pulled the full amount, shares were minted, the redeem burned every share and the WMON came back within rounding (plus a little interest) |
| `fork:stakelink:deposit` | Ethereum | Priority Pool `deposit(amount, true, [])`: stakes what the Staking Pool can take now (stLINK) and queues the rest, then `unqueueTokens` the queued part. Pre-checks: the documented LINK / Staking Pool wiring, `poolStatus()` OPEN and not paused | the user's LINK drops by exactly the amount, the `Deposit` event's staked + queued equals it, stLINK rises by the staked part (2 wei share rounding), the account queue and `totalQueued` rise by the queued part, and the unqueue returns exactly that LINK and restores both |
| `fork:lista:stake` | Bsc | `ListaStakeManager.deposit()` with native BNB | slisBNB balance increases |
| `fork:venus:supply` | Bsc | `vUSDC.mint` then `redeem` on the BSC Core Pool | the mint pulled the full USDC, vUSDC shares were minted, the redeem burned every share and USDC came back within rounding |
| `fork:lista-dao:deposit` | Bsc | USDT into the Lista MoolahVault (USDT) (ERC-4626), then redeem | the deposit pulled the full amount, shares were minted, the redeem burned every share and USDT came back within rounding |
| `fork:lido:submit` / `:wrap` | Ethereum | `submit` then optional `wrap` | stETH, then wstETH, increases |
| `fork:rocketpool:deposit` | Ethereum | `deposit()` on the Rocket deposit pool | rETH increases, or skip when the cap is too small |
| `fork:cbeth:rate` | Ethereum | `exchangeRate()` | rate above 1. No public mint |
| `fork:etherfi:deposit` / `:wrap` | Ethereum | deposit ETH, wrap eETH | eETH, then weETH, increases |
| `fork:kelp:deposit` | Ethereum | `depositETH` | rsETH increases, or skip when paused |
| `fork:renzo:deposit` | Ethereum | `depositETH` | ezETH increases, or skip when capped |
| `fork:eigenlayer:deposit` | Ethereum | `depositIntoStrategy` on the stETH strategy | deposit shares increase |
| `fork:eigenlayer:queue` | Ethereum | deposit, then `queueWithdrawals` | exactly one withdrawal queued and the deposited shares leave the staker (`sharesLeft` back to the starting 0). The delay is not advanced, completion is not asserted |
| `fork:symbiotic:read` | Ethereum | VaultFactory code | **Read-only.** Docs do not publish a permissionless vault |
| `fork:swell:deposit` | Ethereum | rswETH `deposit()` | rswETH increases, or read-only when the whitelist is on. FAIL with `coreMethodsPaused=true` when Swell's AccessControlManager has paused core methods (true since the 2026-10-21 incident, checked 2026-10-28), because deposit() would revert |
| `fork:puffer:deposit` | Ethereum | pufETH `depositETH` | pufETH increases, or read-only when `maxDeposit` is 0. FAIL with `targetClosed=true` when the vault's AccessManager has closed pufETH (`isTargetClosed`; true on 2026-10-19 and 2026-10-21), because depositETH would revert |
| `fork:wbeth:deposit` | Ethereum | wBETH `deposit(referral)` with native ETH | wBETH minted equals `value × 1e18 / exchangeRate()` (1 wei rounding) and the contract holds exactly the deposited ETH. Unwrap goes through Binance, so there is no redeem |
| `fork:meth:stake` | Ethereum | mETH `Staking.stake(minMETHAmount)` with native ETH, then `unstakeRequest` of every mETH minted. Pre-checks: `mETH()` and `unstakeRequestsManager()` are the documented contracts, staking and unstake requests are not paused, the staking allowlist is off, and the amount is above `minimumStakeBound()` | mETH minted equals the pre-tx `ethToMETH(value)` exactly and the Staking contract holds exactly the ETH; `unstakeRequest` moves every mETH into the UnstakeRequestsManager and emits `UnstakeRequested` for the user with `mETHLocked` = the minted mETH and `ethAmount` = the pre-tx `mETHToETH`. Finalisation and the claim are not waited out |
| `fork:meta-pool:deposit` | Ethereum | spETH `depositETH(receiver)` (ERC-4626). The Staking contract may fill from the Liquid Unstake Pool instead of minting | spETH + Liquid Unstake Pool hold exactly the deposited ETH more, the ERC-4626 `Deposit` event reports assets = deposit and shares = the user's gain, and shares are within 1 bp of the pre-tx `previewDeposit`. Unstake is a pool swap or a 2-9 day queue, so there is no redeem |
| `fork:stakewise:deposit` | Ethereum | Genesis Vault `depositAndMintOsToken` with native ETH, minting osETH worth half the deposit. Pre-checks: no pending keeper state update and room under `capacity()` | vault `totalAssets` rises by exactly the deposit, the `Deposited` event reports assets = deposit and shares = the user's gain (within 1 wei of the pre-tx `convertToShares`), and the user holds exactly the requested osETH, which equals the vault's osToken position. Exits use the validator exit queue, so there is no redeem |
| `fork:etherfi-cash:supply` | Optimism | USDC `supply` into reserve 0 of the ether.fi Cash Spoke (ether.fi-managed Aave V4 on OP Mainnet), then `withdraw` the full supplied balance. Pre-checks: reserve 0 is native USDC on the documented Liquidity Hub and is neither paused nor frozen | the user's USDC and the Hub's USDC move by exactly the amount, supply shares are minted and `getUserSuppliedAssets` is the amount within 1 wei; the withdraw returns exactly the supplied assets from the Hub and leaves 0 shares. Borrowing is limited to ether.fi Safes and is not called |
<!-- /features:actions -->

## Perps

Perp books are not Uniswap-style routers. GMX V2 runs an order pipeline and Hyperliquid matches off-chain on its own L1, so neither is reachable from a plain EVM fork. The rest of the perps tab stays API-only (`analytics:<name>:perps` + smoke), same rule as Solana venues.

<!-- features:perps -->
| Script | Chain | Action | Assertion |
| --- | --- | --- | --- |
| `fork:gmx:read` | Arbitrum | Read-only: GMX V1 vault, GLP supply and GLP price | USDC in the V1 vault and GLP supply both above 0 |
<!-- /features:perps -->

**GMX V1 is sunset, so there is no mint test.** [Contracts for V1](https://docs.gmx.io/docs/archived/contracts-v1) says trading and providing liquidity are no longer supported, and the live chain agrees:

- `Vault.isSwapEnabled()` and `Vault.isLeverageEnabled()` are both `false`.
- `GlpRewardRouter.mintAndStakeGlp` reverts with `SafeMath: subtraction overflow` even for 1 USDC, against a real whale.

The script therefore reads `Vault.poolAmounts(USDC)`, `GlpManager.getAum/getPrice` and `GLP.totalSupply()` and asserts the book still reads. GLP price on the last run was about **$0.090** with a V1 AUM near **$848k**, down from the V1 peak, which is consistent with a closed book.

**Hyperliquid has no fork coverage and no monitor is built from a bridge read.** The perps engine is off-chain, and the widely-copied Ethereum "bridge" address `0x2Df1c67E04526f42B83764733b06AAf4e2B05B02` has **no contract code** on Ethereum or Arbitrum and does not even pass EIP-55 checksum validation, so it cannot be asserted against. `analytics:hyperliquid:perps` covers TVL and fees from DefiLlama.

Raydium is Solana. The suite does not fork it. The showcase marks that row API-only.

## Vault curators and allocators

Same rules. A vault whose `maxDeposit` is 0 (or whose deposits are paused or closed, checked before any transaction) is not deposited into. The script prints `readOnly=` and the panel says **Read-only** when that is the known state. A deposit that reverts is a FAIL, even if the revert looks like an allowlist or cap.

<!-- features:vaults -->
| Script | What it asserts |
| --- | --- |
| `fork:steakhouse:deposit` | USDC into MetaMorpho Steakhouse USDC, then redeem. Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding (the key prints USDC before → after deposit → after redeem) |
| `fork:gauntlet:deposit` | Same on MetaMorpho Gauntlet USDC Prime (V1). V2 `maxDeposit` is 0, so V2 is not deposited into |
| `fork:sentora:deposit` | Sentora RLUSD Main is on Ethereum and is Morpho Vault V2. `maxDeposit` is 0, so this reads `totalAssets` and `convertToAssets`. **Read-only** |
| `fork:veda:deposit` | **Deposit only.** WETH into the ether.fi Liquid ETH BoringVault through its Teller. Shares minted. `bulkWithdraw` is not a public capability, and WETH `allowWithdraws` was false, so there is no redeem |
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
<!-- /features:vaults -->

## Stablecoins, RWA, and bridges

Same rules: pinned block via `FORK_BLOCK`, whale impersonation or `anvil_deal`, no `PRIVATE_KEY`. Addresses are in `src/catalog/contracts.js` with the doc link.

<!-- features:stables -->
| Script | What it asserts |
| --- | --- |
| `fork:sky:convert` | DAI→USDS→DAI on the Sky converter, 1:1 |
| `fork:sky:susds` | Deposit USDS into sUSDS and redeem |
| `fork:sky:sdai` | Deposit DAI into sDAI and redeem |
| `fork:ethena:stake` | USDe→sUSDe. Mint is whitelisted and is not called |
| `fork:usdai:stake` | USDai→sUSDai via ERC-4626 deposit. Protocol mint of USDai is whitelisted and is not called. Redeem is a 30-day queue, so this does not redeem |
| `fork:ethena:cooldown` | Start the sUSDe cooldown. Completing the unstake waits out `cooldownDuration` |
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
