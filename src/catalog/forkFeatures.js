/**
 * What each `fork:<protocol>:<action>` script does and asserts.
 *
 * This is the single source of truth for the fork-feature tables in
 * docs/04-fork-testing.md and for the per-protocol playground panel in the
 * showcase. `node scripts/catalog.js --check` fails when a `fork:*` script in
 * package.json has no entry here, so the three cannot drift apart.
 *
 * Fields:
 *   script     npm script name (must exist in package.json)
 *   section    which docs table it belongs to (see SECTIONS)
 *   chain      chain the fork runs against; "varies" when the script takes CHAIN
 *   title      short human label for the playground card
 *   action     what the script does on the fork
 *   assertion  what makes it PASS
 *   params     env overrides a player may set; FORK_AMOUNT is the common one
 *   readOnly   true when the script writes no state (no transaction is sent)
 *   gated      true when a whitelist, KYC gate or cap can make it skip
 *   group      entries sharing a group merge into one row in the docs table
 */

/** FORK_AMOUNT is read by 31 fork call sites; it is the usual dial. */
function amount(defaultValue, unit) {
  return [{ env: "FORK_AMOUNT", label: "Amount", default: defaultValue, unit }];
}

const SECTIONS = [
  { id: "actions", columns: ["script", "chain", "action", "assertion"] },
  { id: "perps", columns: ["script", "chain", "action", "assertion"] },
  { id: "vaults", columns: ["script", "assertion"], assertionHeader: "What it asserts" },
  { id: "stables", columns: ["script", "assertion"], assertionHeader: "What it asserts" },
];

const FEATURES = [
  // ---- DEX / swaps -------------------------------------------------------
  {
    script: "fork:uniswap:v2",
    section: "actions",
    chain: "ethereum",
    title: "Swap WETH → USDC (V2)",
    action: "WETH→USDC through the existing DEX runner",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
    group: "uniswap-v2v3",
  },
  {
    script: "fork:uniswap:v3",
    section: "actions",
    chain: "ethereum",
    title: "Swap WETH → USDC (V3)",
    action: "WETH→USDC through the existing DEX runner",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
    group: "uniswap-v2v3",
  },
  {
    script: "fork:uniswap:v4",
    section: "actions",
    chain: "ethereum",
    title: "Swap ETH → USDC (V4)",
    action: "ETH→USDC: V4Quoter, then `V4_SWAP` on the Universal Router",
    assertion: "USDC received ≥ quote − 0.5%",
    params: amount("0.1", "ETH"),
  },
  {
    script: "fork:sushiswap:v2",
    section: "actions",
    chain: "ethereum",
    title: "Swap WETH → USDC (V2)",
    action: "WETH→USDC",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
    group: "sushiswap-v2v3",
  },
  {
    script: "fork:sushiswap:v3",
    section: "actions",
    chain: "ethereum",
    title: "Swap WETH → USDC (V3)",
    action: "WETH→USDC",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
    group: "sushiswap-v2v3",
  },
  {
    script: "fork:balancer:swap",
    section: "actions",
    chain: "ethereum",
    title: "Swap WETH → USDC (V2 Vault)",
    action: "WETH→USDC on the V2 Vault",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
  },
  {
    script: "fork:curve:swap",
    section: "actions",
    chain: "ethereum",
    title: "Swap USDC → USDT (3pool)",
    action: "USDC→USDT on 3pool",
    assertion: "USDT balance increases",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:aerodrome:swap",
    section: "actions",
    chain: "base",
    title: "Reference swap (Aerodrome not exercised)",
    action:
      "**Reference swap only:** Uniswap V3 (SwapRouter02) on Base, because the Slipstream quoter reverts here. Aerodrome contracts are not exercised",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
  },
  {
    script: "fork:velodrome:swap",
    section: "actions",
    chain: "optimism",
    title: "Reference swap (Velodrome not exercised)",
    action: "**Reference swap only:** Uniswap V3 on Optimism. Velodrome contracts are not exercised",
    assertion: "USDC balance increases",
    params: amount("0.1", "WETH"),
  },
  {
    script: "fork:pancakeswap:v3",
    section: "actions",
    chain: "ethereum",
    title: "Swap WETH → USDC (PancakeSwap V3)",
    action: "WETH→USDC on PancakeSwap V3. `CHAIN=bsc` runs it on BSC instead",
    assertion: "USDC balance increases",
    params: amount("0.05", "WETH"),
  },
  {
    script: "fork:monad:v3",
    section: "actions",
    chain: "monad",
    title: "Swap on Uniswap V3 (Monad)",
    action: "Uniswap V3",
    assertion: "Skipped when `MONAD_RPC_URL` is unset",
    params: amount("0.1", "native"),
    gated: true,
  },

  // ---- Lending -----------------------------------------------------------
  {
    script: "fork:aave:supply",
    section: "actions",
    chain: "ethereum",
    title: "Supply USDC to Aave V3",
    action: "Aave V3 pool from `chains.js`",
    assertion: "aToken, debt, or wallet balance moves the right way",
    params: amount("1000", "USDC"),
    group: "aave",
  },
  {
    script: "fork:aave:borrow",
    section: "actions",
    chain: "ethereum",
    title: "Borrow USDC from Aave V3",
    action: "Aave V3 pool from `chains.js`",
    assertion: "aToken, debt, or wallet balance moves the right way",
    params: amount("100", "USDC"),
    group: "aave",
  },
  {
    script: "fork:aave:repay",
    section: "actions",
    chain: "ethereum",
    title: "Repay USDC to Aave V3",
    action: "Aave V3 pool from `chains.js`",
    assertion: "aToken, debt, or wallet balance moves the right way",
    params: amount("100", "USDC"),
    group: "aave",
  },
  {
    script: "fork:aave:withdraw",
    section: "actions",
    chain: "ethereum",
    title: "Withdraw USDC from Aave V3",
    action: "Aave V3 pool from `chains.js`",
    assertion: "aToken, debt, or wallet balance moves the right way",
    params: amount("1000", "USDC"),
    group: "aave",
  },
  {
    script: "fork:spark:supply",
    section: "actions",
    chain: "ethereum",
    title: "Supply USDC to SparkLend",
    action: "Same four actions on the SparkLend pool",
    assertion: "Spark is an Aave V3 fork",
    params: amount("1000", "USDC"),
    group: "spark",
  },
  {
    script: "fork:spark:borrow",
    section: "actions",
    chain: "ethereum",
    title: "Borrow USDC from SparkLend",
    action: "Same four actions on the SparkLend pool",
    assertion: "Spark is an Aave V3 fork",
    params: amount("100", "USDC"),
    group: "spark",
  },
  {
    script: "fork:spark:repay",
    section: "actions",
    chain: "ethereum",
    title: "Repay USDC to SparkLend",
    action: "Same four actions on the SparkLend pool",
    assertion: "Spark is an Aave V3 fork",
    params: amount("100", "USDC"),
    group: "spark",
  },
  {
    script: "fork:spark:withdraw",
    section: "actions",
    chain: "ethereum",
    title: "Withdraw USDC from SparkLend",
    action: "Same four actions on the SparkLend pool",
    assertion: "Spark is an Aave V3 fork",
    params: amount("1000", "USDC"),
    group: "spark",
  },
  {
    script: "fork:compound:supply",
    section: "actions",
    chain: "ethereum",
    title: "Supply USDC to Compound III",
    action: "Compound III cUSDCv3",
    assertion: "base balance or borrow balance increases",
    params: amount("1000", "USDC"),
    group: "compound",
  },
  {
    script: "fork:compound:borrow",
    section: "actions",
    chain: "ethereum",
    title: "Borrow USDC from Compound III",
    action: "Compound III cUSDCv3",
    assertion: "base balance or borrow balance increases",
    params: amount("100", "USDC"),
    group: "compound",
  },
  {
    script: "fork:morpho:supply",
    section: "actions",
    chain: "ethereum",
    title: "Supply to a Morpho Blue market",
    action: "One listed WETH/USDC Morpho Blue market",
    assertion: "supply shares or borrow shares increase",
    params: [
      { env: "FORK_AMOUNT", label: "Amount", default: "1000", unit: "USDC" },
      { env: "MORPHO_MARKET_ID", label: "Market id", default: "", unit: "" },
    ],
    group: "morpho",
  },
  {
    script: "fork:morpho:borrow",
    section: "actions",
    chain: "ethereum",
    title: "Borrow from a Morpho Blue market",
    action: "One listed WETH/USDC Morpho Blue market",
    assertion: "supply shares or borrow shares increase",
    params: [
      { env: "FORK_AMOUNT", label: "Amount", default: "100", unit: "USDC" },
      { env: "FORK_COLLATERAL", label: "Collateral", default: "", unit: "" },
      { env: "MORPHO_MARKET_ID", label: "Market id", default: "", unit: "" },
    ],
    group: "morpho",
  },
  {
    script: "fork:llamalend:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Lend crvUSD on Curve Llamalend",
    action: "crvUSD into the Llamalend V1 wstETH-long vault (`OneWayLendingFactory.vaults(13)`, ERC-4626), then redeem",
    assertion:
      "the factory still lists the vault, the deposit pulled the full amount, shares were minted, the redeem burned every share and crvUSD came back within rounding",
    params: amount("100", "crvUSD"),
  },
  {
    script: "fork:dolomite:supply",
    section: "actions",
    chain: "ethereum",
    title: "Supply and withdraw USDC on Dolomite",
    action: "`DepositWithdrawalRouter.depositWei` into account 0, then `withdrawWei` of the full balance with `BalanceCheckFlag.From`",
    assertion:
      "the deposit pulled the full amount, `DolomiteMargin.getAccountWei` rose by it, the withdraw left the account at 0 and the USDC came back",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:cooler:borrow",
    section: "actions",
    chain: "ethereum",
    title: "Borrow USDS against gOHM (Olympus Cooler V2)",
    action:
      "MonoCooler `addCollateral` (gOHM), `borrow` USDS, `repay(type(uint128).max)`, then `withdrawCollateral(type(uint128).max)`. Pre-checks: the documented gOHM / USDS tokens, `borrowsPaused()` false, and the borrow sits between `minDebtRequired()` and the origination LTV",
    assertion:
      "`accountCollateral` and the wallet move by exactly the gOHM posted, the wallet receives exactly the USDS borrowed and `accountDebt` equals it, the full repay leaves `accountDebt` at 0 (paying the borrow plus per-second interest), and every gOHM comes back",
    params: [
      { env: "FORK_AMOUNT", label: "Collateral", default: "1", unit: "gOHM" },
      { env: "FORK_BORROW", label: "Borrow", default: "1500", unit: "USDS" },
    ],
  },
  {
    script: "fork:curvance:deposit",
    section: "actions",
    chain: "monad",
    title: "Lend WMON on Curvance (Monad)",
    action:
      "WMON into cWMON of the WMON | USDC market (ERC-4626 style `deposit`), then `redeem` every share. `marketManager()` must be the documented MarketManager. WMON is wrapped from native MON on the fork",
    assertion:
      "the deposit pulled the full amount, shares were minted, the redeem burned every share and the WMON came back within rounding (plus a little interest)",
    params: amount("100", "WMON"),
  },
  {
    script: "fork:stakelink:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Stake or queue LINK (stake.link Priority Pool)",
    action:
      "Priority Pool `deposit(amount, true, [])`: stakes what the Staking Pool can take now (stLINK) and queues the rest, then `unqueueTokens` the queued part. Pre-checks: the documented LINK / Staking Pool wiring, `poolStatus()` OPEN and not paused",
    assertion:
      "the user's LINK drops by exactly the amount, the `Deposit` event's staked + queued equals it, stLINK rises by the staked part (2 wei share rounding), the account queue and `totalQueued` rise by the queued part, and the unqueue returns exactly that LINK and restores both",
    params: amount("10", "LINK"),
  },
  {
    script: "fork:lista:stake",
    section: "actions",
    chain: "bsc",
    title: "Stake BNB for slisBNB",
    action: "`ListaStakeManager.deposit()` with native BNB",
    assertion: "slisBNB balance increases",
    params: amount("0.1", "BNB"),
  },
  {
    script: "fork:venus:supply",
    section: "actions",
    chain: "bsc",
    title: "Supply USDC to Venus Core Pool",
    action: "`vUSDC.mint` then `redeem` on the BSC Core Pool",
    assertion: "the mint pulled the full USDC, vUSDC shares were minted, the redeem burned every share and USDC came back within rounding",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:lista-dao:deposit",
    section: "actions",
    chain: "bsc",
    title: "Deposit USDT into Lista Moolah vault",
    action: "USDT into the Lista MoolahVault (USDT) (ERC-4626), then redeem",
    assertion: "the deposit pulled the full amount, shares were minted, the redeem burned every share and USDT came back within rounding",
    params: amount("100", "USDT"),
  },

  // ---- Liquid staking / restaking ---------------------------------------
  {
    script: "fork:lido:submit",
    section: "actions",
    chain: "ethereum",
    title: "Stake ETH with Lido",
    action: "`submit` then optional `wrap`",
    assertion: "stETH, then wstETH, increases",
    params: [{ env: "LIDO_SUBMIT_WEI", label: "Amount (wei)", default: "", unit: "wei" }],
    group: "lido",
  },
  {
    script: "fork:lido:wrap",
    section: "actions",
    chain: "ethereum",
    title: "Wrap stETH → wstETH",
    action: "`submit` then optional `wrap`",
    assertion: "stETH, then wstETH, increases",
    params: [{ env: "LIDO_SUBMIT_WEI", label: "Amount (wei)", default: "", unit: "wei" }],
    group: "lido",
  },
  {
    script: "fork:rocketpool:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit ETH to Rocket Pool",
    action: "`deposit()` on the Rocket deposit pool",
    assertion: "rETH increases, or skip when the cap is too small",
    params: amount("0.05", "ETH"),
    gated: true,
  },
  {
    script: "fork:cbeth:rate",
    section: "actions",
    chain: "ethereum",
    title: "Read the cbETH rate",
    action: "`exchangeRate()`",
    assertion: "rate above 1. No public mint",
    readOnly: true,
  },
  {
    script: "fork:etherfi:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit ETH to ether.fi",
    action: "deposit ETH, wrap eETH",
    assertion: "eETH, then weETH, increases",
    params: amount("0.01", "ETH"),
    group: "etherfi",
  },
  {
    script: "fork:etherfi:wrap",
    section: "actions",
    chain: "ethereum",
    title: "Wrap eETH → weETH",
    action: "deposit ETH, wrap eETH",
    assertion: "eETH, then weETH, increases",
    params: amount("0.01", "ETH"),
    group: "etherfi",
  },
  {
    script: "fork:kelp:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit ETH to Kelp",
    action: "`depositETH`",
    assertion: "rsETH increases, or skip when paused",
    params: amount("0.01", "ETH"),
    gated: true,
  },
  {
    script: "fork:renzo:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit ETH to Renzo",
    action: "`depositETH`",
    assertion: "ezETH increases, or skip when capped",
    params: amount("0.01", "ETH"),
    gated: true,
  },
  {
    script: "fork:eigenlayer:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit stETH into an EigenLayer strategy",
    action: "`depositIntoStrategy` on the stETH strategy",
    assertion: "deposit shares increase",
    params: amount("0.01", "stETH"),
    group: "eigenlayer",
  },
  {
    script: "fork:eigenlayer:queue",
    section: "actions",
    chain: "ethereum",
    title: "Queue an EigenLayer withdrawal",
    action: "deposit, then `queueWithdrawals`",
    assertion:
      "exactly one withdrawal queued and the deposited shares leave the staker (`sharesLeft` back to the starting 0). The delay is not advanced, completion is not asserted",
    params: amount("0.01", "stETH"),
    group: "eigenlayer",
  },
  {
    script: "fork:symbiotic:read",
    section: "actions",
    chain: "ethereum",
    title: "Read the Symbiotic VaultFactory",
    action: "VaultFactory code",
    assertion: "**Read-only.** Docs do not publish a permissionless vault",
    readOnly: true,
  },
  {
    script: "fork:swell:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit ETH to Swell",
    action: "rswETH `deposit()`",
    assertion: "rswETH increases, or read-only when the whitelist is on",
    params: amount("0.05", "ETH"),
    gated: true,
  },
  {
    script: "fork:puffer:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Deposit ETH to Puffer",
    action: "pufETH `depositETH`",
    assertion:
      "pufETH increases, or read-only when `maxDeposit` is 0. FAIL with `targetClosed=true` when the vault's AccessManager has closed pufETH (`isTargetClosed`; true on 2026-10-19 and 2026-10-21), because depositETH would revert",
    params: amount("0.05", "ETH"),
    gated: true,
  },
  {
    script: "fork:wbeth:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Mint wBETH with ETH",
    action: "wBETH `deposit(referral)` with native ETH",
    assertion: "wBETH minted equals `value × 1e18 / exchangeRate()` (1 wei rounding) and the contract holds exactly the deposited ETH. Unwrap goes through Binance, so there is no redeem",
    params: amount("0.1", "ETH"),
  },
  {
    script: "fork:meta-pool:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Stake ETH for Meta Pool spETH",
    action: "spETH `depositETH(receiver)` (ERC-4626). The Staking contract may fill from the Liquid Unstake Pool instead of minting",
    assertion: "spETH + Liquid Unstake Pool hold exactly the deposited ETH more, the ERC-4626 `Deposit` event reports assets = deposit and shares = the user's gain, and shares are within 1 bp of the pre-tx `previewDeposit`. Unstake is a pool swap or a 2-9 day queue, so there is no redeem",
    params: amount("0.1", "ETH"),
  },
  {
    script: "fork:stakewise:deposit",
    section: "actions",
    chain: "ethereum",
    title: "Stake ETH and mint osETH (StakeWise V3)",
    action: "Genesis Vault `depositAndMintOsToken` with native ETH, minting osETH worth half the deposit. Pre-checks: no pending keeper state update and room under `capacity()`",
    assertion:
      "vault `totalAssets` rises by exactly the deposit, the `Deposited` event reports assets = deposit and shares = the user's gain (within 1 wei of the pre-tx `convertToShares`), and the user holds exactly the requested osETH, which equals the vault's osToken position. Exits use the validator exit queue, so there is no redeem",
    params: amount("0.1", "ETH"),
  },

  // ---- Perps -------------------------------------------------------------
  {
    script: "fork:gmx:read",
    section: "perps",
    chain: "arbitrum",
    title: "Read the sunset GMX V1 book",
    action: "Read-only: GMX V1 vault, GLP supply and GLP price",
    assertion: "USDC in the V1 vault and GLP supply both above 0",
    readOnly: true,
  },

  // ---- Vault curators and allocators -------------------------------------
  {
    script: "fork:steakhouse:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Steakhouse USDC)",
    assertion:
      "USDC into MetaMorpho Steakhouse USDC, then redeem. Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding (the key prints USDC before → after deposit → after redeem)",
    params: amount("1000", "USDC"),
  },
  {
    script: "fork:gauntlet:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Gauntlet USDC Prime)",
    assertion:
      "Same on MetaMorpho Gauntlet USDC Prime (V1). V2 `maxDeposit` is 0, so V2 is not deposited into",
    params: amount("1000", "USDC"),
  },
  {
    script: "fork:sentora:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Read Sentora RLUSD Main",
    assertion:
      "Sentora RLUSD Main is on Ethereum and is Morpho Vault V2. `maxDeposit` is 0, so this reads `totalAssets` and `convertToAssets`. **Read-only**",
    readOnly: true,
  },
  {
    script: "fork:veda:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit WETH (ether.fi Liquid ETH)",
    assertion:
      "**Deposit only.** WETH into the ether.fi Liquid ETH BoringVault through its Teller. Shares minted. `bulkWithdraw` is not a public capability, and WETH `allowWithdraws` was false, so there is no redeem",
    params: amount("0.01", "WETH"),
  },
  {
    script: "fork:upshift:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and instant-redeem (Upshift)",
    assertion:
      "USDC into Upshift Sentora USD, then `instantRedeem`. Assets come back minus `instantRedemptionFee` (basis points). If instant redeem is closed, `requestRedeem` is asserted and the withdrawal is not waited out",
    params: amount("1000", "USDC"),
  },
  {
    script: "fork:yearn:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Yearn V3 USDC-1)",
    assertion: "USDC into Yearn V3 USDC-1, then redeem",
    params: amount("1000", "USDC"),
  },
  {
    script: "fork:euler:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Euler Earn)",
    assertion:
      "USDC into Euler Earn K3 Capital Earn USDC (first non-deprecated Ethereum vault in euler-labels), then redeem",
    params: amount("1000", "USDC"),
  },
  {
    script: "fork:rockawayx:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (RockawayX USDC Yield)",
    assertion:
      "USDC into RockawayX USDC Yield, a Morpho Vault V2, then redeem. V2 `maxDeposit` is always 0, so the pre-check is that all four gates are unset (a set gate makes it a labelled read). Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:spark-vaults:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Spark Savings USDC)",
    assertion: "USDC into Spark Savings spUSDC (ERC-4626), then redeem. Idle liquidity caps redeem; the round trip asserts within idle balance",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:clearstar:deposit",
    section: "vaults",
    chain: "base",
    title: "Deposit and redeem (Clearstar cbAssets, Base)",
    assertion:
      "USDC into Clearstar cbAssets Vault on Base, a Morpho Vault V2, then redeem. Pre-check: all four V2 gates unset (a set gate makes it a labelled read). Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the USDC came back within rounding",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:hyperithm:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Hyperithm USDC Apex)",
    assertion:
      "USDC into Hyperithm USDC Apex on Ethereum, a Morpho Vault V2, then redeem. Same gate pre-check and round-trip assertions as RockawayX. Most of the row's TVL is the Monad vault of the same name",
    params: amount("100", "USDC"),
  },
  {
    script: "fork:concrete:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit USDT (Concrete ctDefiUSDT)",
    assertion:
      "**Deposit only.** USDT into Concrete ctDefiUSDT (Earn V2 async vault, ERC-4626 deposit). Pre-check: the amount sits inside `getDepositLimits()` (outside is a labelled read). Asserts the vault pulled exactly the amount, the shares equal the pre-tx `previewDeposit`, and the `Deposit` event reports the same assets and shares. Withdrawal is an epoch queue processed about weekly, so there is no redeem",
    params: amount("200", "USDT"),
  },
  {
    script: "fork:concentrator:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Concentrator aCRV)",
    assertion:
      "cvxCRV into Concentrator aCRV (AladdinCRV, ERC-4626 compounder), then redeem. Asserts the deposit pulled the full amount, shares were minted, the redeem burned every share, and the cvxCRV came back within rounding (`withdrawFeePercentage()` was 0 on 2026-10-26)",
    params: amount("100", "cvxCRV"),
  },
  {
    script: "fork:fluid-lite:deposit",
    section: "vaults",
    chain: "ethereum",
    title: "Deposit and redeem (Fluid Lite iETHv2)",
    assertion:
      "stETH into Fluid Lite iETHv2 (ERC-4626), then redeem every share. Asserts the shares equal the pre-tx `previewDeposit`, the deposit pulled the amount (stETH 1-2 wei rounding), the redeem burned every share, and the stETH returned equals `previewRedeem` minus `withdrawalFeePercentage()` (ppm; 500 = 0.05% on 2026-10-26) within 2 wei",
    params: amount("1", "stETH"),
  },

  // ---- Stablecoins, RWA, bridges ----------------------------------------
  {
    script: "fork:sky:convert",
    section: "stables",
    chain: "ethereum",
    title: "Convert DAI ↔ USDS",
    assertion: "DAI→USDS→DAI on the Sky converter, 1:1",
    params: amount("1000", "DAI"),
  },
  {
    script: "fork:sky:susds",
    section: "stables",
    chain: "ethereum",
    title: "Deposit and redeem sUSDS",
    assertion: "Deposit USDS into sUSDS and redeem",
    params: amount("1000", "USDS"),
  },
  {
    script: "fork:sky:sdai",
    section: "stables",
    chain: "ethereum",
    title: "Deposit and redeem sDAI",
    assertion: "Deposit DAI into sDAI and redeem",
    params: amount("1000", "DAI"),
  },
  {
    script: "fork:ethena:stake",
    section: "stables",
    chain: "ethereum",
    title: "Stake USDe → sUSDe",
    assertion: "USDe→sUSDe. Mint is whitelisted and is not called",
    params: amount("1000", "USDe"),
    gated: true,
  },
  {
    script: "fork:usdai:stake",
    section: "stables",
    chain: "arbitrum",
    title: "Stake USDai → sUSDai",
    assertion: "USDai→sUSDai via ERC-4626 deposit. Protocol mint of USDai is whitelisted and is not called. Redeem is a 30-day queue, so this does not redeem",
    params: amount("100", "USDai"),
    gated: true,
  },
  {
    script: "fork:ethena:cooldown",
    section: "stables",
    chain: "ethereum",
    title: "Start the sUSDe cooldown",
    assertion: "Start the sUSDe cooldown. Completing the unstake waits out `cooldownDuration`",
    gated: true,
  },
  {
    script: "fork:circle:transfer",
    section: "stables",
    chain: "ethereum",
    title: "Transfer USDC (mint/redeem are off-chain)",
    assertion:
      "Transfer only. Mint and redeem are off-chain or KYC'd. The panel says **Transfer / read-only**",
    params: amount("100", "USDC"),
    readOnly: true,
    group: "circle-tether",
  },
  {
    script: "fork:tether:transfer",
    section: "stables",
    chain: "ethereum",
    title: "Transfer USDT (mint/redeem are off-chain)",
    assertion:
      "Transfer only. Mint and redeem are off-chain or KYC'd. The panel says **Transfer / read-only**",
    params: amount("100", "USDT"),
    readOnly: true,
    group: "circle-tether",
  },
  {
    script: "fork:frax:rate",
    section: "stables",
    chain: "ethereum",
    title: "Read the sfrxUSD rate",
    assertion:
      "`sfrxUSD.convertToAssets`. Ethereum `maxDeposit` is 0, so there is no local deposit. The panel says **Read-only** (not KYC; there is just no Ethereum deposit path)",
    readOnly: true,
  },
  {
    script: "fork:buidl:read",
    section: "stables",
    chain: "ethereum",
    title: "Read BUIDL supply",
    assertion: "BUIDL `totalSupply`. **KYC-gated: read-only**",
    readOnly: true,
  },
  {
    script: "fork:ondo:rate",
    section: "stables",
    chain: "ethereum",
    title: "Read USDY / OUSG prices",
    assertion: "USDY `getPrice` and OUSG `getAssetPrice`. **KYC-gated: read-only**",
    readOnly: true,
  },
  {
    script: "fork:superstate:nav",
    section: "stables",
    chain: "ethereum",
    title: "Read the USTB NAV",
    assertion: "USTB continuous oracle `latestRoundData`. **KYC-gated: read-only**",
    readOnly: true,
  },
  {
    script: "fork:arbitrum:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to Arbitrum",
    assertion: "`Inbox.depositEth`. Bridge ETH increases and `InboxMessageDelivered` is emitted",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:base:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to Base",
    assertion:
      "`L1StandardBridge.depositETH`. ETH held by the bridge + portal (+ the `ETHLockbox` that `OptimismPortal.ethLockbox()` returns; OP Mainnet holds its ETH there, Base returned none on 2026-10-10) increases by the deposit and `ETHDepositInitiated` is emitted",
    params: amount("0.05", "ETH"),
    group: "op-stack-bridge",
  },
  {
    script: "fork:optimism:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to Optimism",
    assertion:
      "`L1StandardBridge.depositETH`. ETH held by the bridge + portal (+ the `ETHLockbox` that `OptimismPortal.ethLockbox()` returns; OP Mainnet holds its ETH there, Base returned none on 2026-10-10) increases by the deposit and `ETHDepositInitiated` is emitted",
    params: amount("0.05", "ETH"),
    group: "op-stack-bridge",
  },
  {
    script: "fork:across:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge USDC via Across",
    assertion: "`SpokePool.depositV3` locks USDC on Ethereum toward Base",
    params: amount("20", "USDC"),
  },
  {
    script: "fork:stargate:quote",
    section: "stables",
    chain: "ethereum",
    title: "Quote a Stargate transfer",
    assertion: "`quoteOFT` + `quoteSend`, then `send` locks USDC toward Arbitrum",
    readOnly: true,
    group: "stargate",
  },
  {
    script: "fork:stargate:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge USDC via Stargate",
    assertion: "`quoteOFT` + `quoteSend`, then `send` locks USDC toward Arbitrum",
    params: amount("10", "USDC"),
    group: "stargate",
  },
  {
    script: "fork:world-chain:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to World Chain",
    assertion:
      "World Chain `L1StandardBridge.depositETH`. ETH held by the bridge + portal (+ an `ETHLockbox` when the portal reports one; none on 2026-10-19) increases by exactly the deposit and `ETHDepositInitiated` is emitted",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:robinhood:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to Robinhood Chain",
    assertion:
      "Robinhood Chain Delayed Inbox `depositEth`. `Inbox.bridge()` is the documented Bridge, the Bridge holds exactly the deposit more ETH, and `InboxMessageDelivered` is emitted",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:starknet:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to Starknet",
    assertion:
      "StarkGate `deposit(ETH, amount, l2Recipient)` with `amount + estimateDepositFeeWei()`. The bridge keeps exactly `amount`, emits `Deposit`, and the Starknet core contract emits `LogMessageToL2`",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:polygon:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to Polygon PoS",
    assertion: "`RootChainManager.depositEtherFor`. The EtherPredicate holds exactly the deposit more ETH and emits `LockedEther`",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:lighter-bridge:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Deposit USDC to Lighter",
    assertion:
      "Lighter `deposit(to, 3, 0, amount)` (USDC, perps route). The user's USDC drops by exactly the amount, the Lighter contract's USDC rises by it, and the contract logs the deposit. L2 crediting is off this machine",
    params: amount("20", "USDC"),
  },
  {
    script: "fork:near-bridge:deposit",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH to NEAR (Omni Bridge)",
    assertion:
      "Omni Bridge `initTransfer(address(0), amount, 0, 0, \"near:…\", \"\")` with native ETH. The bridge holds exactly the deposit more ETH and emits `InitTransfer` with the same sender, token, amount, zero fees and recipient. The NEAR light client side is off this machine",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:portal:transfer",
    section: "stables",
    chain: "ethereum",
    title: "Bridge ETH via Portal (Wormhole)",
    assertion:
      "Token Bridge `wrapAndTransferETH` toward Wormhole chain 23 (Arbitrum). The bridge's WETH rises by exactly the amount and the Core Contract's `LogMessagePublished` carries a type-1 transfer payload with the amount at 8 decimals, WETH on chain 2 and the recipient. Guardian signing and redemption are off this machine",
    params: amount("0.05", "ETH"),
  },
  {
    script: "fork:ccip:send",
    section: "stables",
    chain: "ethereum",
    title: "Send LINK via Chainlink CCIP",
    assertion:
      "Router `ccipSend` of LINK to Base, fee in ETH. `TokenAdminRegistry.getPool(LINK)` must be the documented LockReleaseTokenPool. The user's LINK drops and the pool's LINK rises by exactly the amount, the user pays exactly `getFee()` in ETH, and the lane's OnRamp logs the message. DON execution on Base is off this machine",
    params: amount("1", "LINK"),
  },
  {
    script: "fork:saturn:stake",
    section: "stables",
    chain: "ethereum",
    title: "Stake USDat into sUSDat (Saturn)",
    assertion:
      "**Deposit only.** USDat into sUSDat (StakedUSDat, ERC-4626). Pre-checks: not `paused()` and `maxDeposit` covers the amount. Asserts the vault pulled exactly the amount, the shares equal the pre-tx `previewDeposit` (which prices in the deposit fee), and the `Deposit` event reports the same assets, shares and owner. Unstaking is a request / process / claim queue, so there is no redeem",
    params: amount("100", "USDat"),
  },
];

const BY_SCRIPT = new Map(FEATURES.map(feature => [feature.script, feature]));

function featuresByScript() {
  return BY_SCRIPT;
}

function featuresForSection(section) {
  return FEATURES.filter(feature => feature.section === section);
}

/** Features for one protocol, most important first (registry order). */
function featuresForProtocol(protocolId) {
  const prefix = `fork:${String(protocolId).toLowerCase()}:`;
  return FEATURES.filter(feature => feature.script.startsWith(prefix));
}

module.exports = { SECTIONS, FEATURES, featuresByScript, featuresForSection, featuresForProtocol };
