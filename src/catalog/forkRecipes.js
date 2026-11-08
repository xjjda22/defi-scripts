/**
 * Fork recipes shown on the showcase and executed by `npm run fork:all`.
 * Commands assume Anvil is started with scripts/startFork.js, then the chain RPC
 * env var points at http://127.0.0.1:8545.
 */

const { contractsForKeys } = require("./contracts");
const { featuresByScript } = require("./forkFeatures");
const { flowForKeys } = require("./contractFlows");
const { TESTNETS, CHAINLINK } = require("./faucets");
const { statusFor, coverageStats } = require("./forkStatus");

const LOCAL = "http://127.0.0.1:8545";

const RPC_ENV = {
  ethereum: "ETHEREUM_RPC_URL",
  arbitrum: "ARBITRUM_RPC_URL",
  optimism: "OPTIMISM_RPC_URL",
  base: "BASE_RPC_URL",
  polygon: "POLYGON_RPC_URL",
  bsc: "BSC_RPC_URL",
  zksync: "ZKSYNC_RPC_URL",
  scroll: "SCROLL_RPC_URL",
  unichain: "UNICHAIN_RPC_URL",
  monad: "MONAD_RPC_URL",
  avalanche: "AVALANCHE_RPC_URL",
};

function test(script, action, chain, note) {
  return { script, action, chain, rpcEnv: RPC_ENV[chain], note: note || null };
}

function recipe(partial) {
  const chain = partial.chain;
  const tests = partial.tests;
  return {
    keys: partial.keys.map(key => key.toLowerCase()),
    appUrl: partial.appUrl,
    chain,
    rpcEnv: RPC_ENV[chain],
    category: partial.category || null,
    label: partial.label || null,
    note: partial.note || null,
    tests,
    commands: [
      `CHAIN=${chain} node scripts/startFork.js`,
      `FORK_BLOCK=<block> CHAIN=${chain} node scripts/startFork.js`,
      ...tests.map(item => `${RPC_ENV[item.chain]}=${LOCAL} npm run ${item.script}`),
    ],
    contracts: contractsForKeys(partial.contractKeys || partial.keys),
  };
}

const FORK_RECIPES = [
  recipe({
    keys: ["uniswap", "uniswap-v2", "uniswap-v3", "uniswap-v4"],
    appUrl: "https://app.uniswap.org",
    chain: "ethereum",
    contractKeys: ["uniswap"],
    tests: [
      test("fork:uniswap:v2", "swap", "ethereum"),
      test("fork:uniswap:v3", "swap", "ethereum"),
      test("fork:uniswap:v4", "swap", "ethereum"),
      test("fork:uniswap:v2-add", "add liquidity V2", "ethereum"),
      test("fork:uniswap:v3-mint", "add liquidity V3", "ethereum"),
      test("fork:uniswap:v3-remove", "remove liquidity V3", "ethereum"),
      test("fork:uniswap:v4-add", "add liquidity V4", "ethereum"),
    ],
  }),
  recipe({
    keys: ["sushiswap", "sushiswap-v3"],
    appUrl: "https://www.sushi.com/swap",
    chain: "ethereum",
    contractKeys: ["sushiswap"],
    tests: [
      test("fork:sushiswap:v2", "swap", "ethereum"),
      test("fork:sushiswap:v3", "swap", "ethereum"),
      test("fork:sushiswap:add-liquidity", "add liquidity", "ethereum"),
    ],
  }),
  recipe({
    keys: ["balancer", "balancer-v2", "balancer-v3"],
    appUrl: "https://balancer.fi",
    chain: "ethereum",
    contractKeys: ["balancer"],
    tests: [test("fork:balancer:swap", "swap", "ethereum"), test("fork:balancer:join", "join pool", "ethereum")],
  }),
  recipe({
    keys: ["curve", "curve-dex"],
    appUrl: "https://curve.fi",
    chain: "ethereum",
    contractKeys: ["curve"],
    tests: [
      test("fork:curve:swap", "swap", "ethereum", "USDC/USDT on 3pool"),
      test("fork:curve:add", "add liquidity", "ethereum", "USDC into 3pool"),
      test("fork:curve:remove", "remove liquidity", "ethereum", "3Crv to USDC"),
      test("fork:curve:gauge", "gauge deposit", "ethereum", "3pool gauge"),
    ],
  }),
  recipe({
    keys: ["aerodrome", "aerodrome-v1", "aerodrome-slipstream"],
    appUrl: "https://aerodrome.finance",
    chain: "base",
    contractKeys: ["aerodrome"],
    label: "Reference swap (Uniswap V3 on Base)",
    note: "Slipstream quoters revert in this stack. The fork script swaps Uniswap V3 on Base as the liquid reference, same as simulate:dex:aerodrome:v3.",
    tests: [test("fork:aerodrome:swap", "swap", "base")],
  }),
  recipe({
    keys: ["velodrome", "velodrome-v1", "velodrome-v2", "velodrome-v3"],
    appUrl: "https://velodrome.finance",
    chain: "optimism",
    contractKeys: ["velodrome"],
    label: "Reference swap (Uniswap V3 on Optimism)",
    note: "Slipstream quoters revert in this stack. The fork script swaps Uniswap V3 on Optimism as the liquid reference.",
    tests: [test("fork:velodrome:swap", "swap", "optimism")],
  }),
  recipe({
    keys: ["pancakeswap", "pancakeswap-amm", "pancakeswap-amm-v3", "pancakeswap--dex"],
    appUrl: "https://pancakeswap.finance",
    chain: "ethereum",
    contractKeys: ["pancakeswap"],
    note: "PancakeSwap V3 on Ethereum (same router addresses as BSC). Set CHAIN=bsc to run it on BSC instead.",
    tests: [
      test("fork:pancakeswap:v3", "swap", "ethereum"),
      test("fork:pancakeswap:v2-swap", "swap V2", "bsc"),
      test("fork:pancakeswap:v3-mint", "add liquidity V3", "bsc"),
      test("fork:pancakeswap:v3-remove", "remove liquidity V3", "bsc"),
      test("fork:pancakeswap:farm", "farm (MasterChef V3)", "bsc"),
    ],
  }),
  recipe({
    keys: ["monad"],
    appUrl: "https://www.monad.xyz",
    chain: "monad",
    note: "Uniswap V3 on Monad from chains.js. Skipped when MONAD_RPC_URL is unset.",
    tests: [test("fork:monad:v3", "swap", "monad")],
  }),
  recipe({
    keys: ["gmx"],
    appUrl: "https://gmx.io",
    chain: "arbitrum",
    contractKeys: ["gmx"],
    category: "perps",
    label: "Read-only (V1 vault, sunset)",
    note: "GMX V1 is sunset: the docs say trading and providing liquidity are no longer supported, Vault.isSwapEnabled()/isLeverageEnabled() are false and GLP minting reverts. The script reads the V1 vault, GLP supply and GLP price. The V2 perp order pipeline is not exercised on a local fork; monitor:dex -- gmx:perps covers OI and fees.",
    tests: [test("fork:gmx:read", "read", "arbitrum")],
  }),
  recipe({
    keys: ["aave", "aave-v2", "aave-v3", "aave-v4"],
    appUrl: "https://app.aave.com",
    chain: "ethereum",
    contractKeys: ["aave"],
    tests: [
      test("fork:aave:supply", "supply", "ethereum"),
      test("fork:aave:borrow", "borrow", "ethereum"),
      test("fork:aave:repay", "repay", "ethereum"),
      test("fork:aave:withdraw", "withdraw", "ethereum"),
      test("fork:aave:flashloan", "flash loan", "ethereum"),
      test("fork:aave:emode", "set collateral / e-mode", "ethereum"),
      test("fork:aave:stake", "stake AAVE", "ethereum"),
    ],
  }),
  recipe({
    keys: ["sparklend"],
    appUrl: "https://app.spark.fi",
    chain: "ethereum",
    contractKeys: ["spark"],
    note: "SparkLend is an Aave V3 fork. The same supply, borrow, repay and withdraw flow runs against the Spark pool.",
    tests: [
      test("fork:spark:supply", "supply", "ethereum"),
      test("fork:spark:borrow", "borrow", "ethereum"),
      test("fork:spark:repay", "repay", "ethereum"),
      test("fork:spark:withdraw", "withdraw", "ethereum"),
      test("fork:spark:flashloan", "flash loan", "ethereum"),
      test("fork:spark:liquidate", "liquidate", "ethereum"),
    ],
  }),
  recipe({
    keys: ["compound", "compound-finance", "compound-v3"],
    appUrl: "https://app.compound.finance",
    chain: "ethereum",
    contractKeys: ["compound"],
    tests: [
      test("fork:compound:supply", "supply", "ethereum"),
      test("fork:compound:borrow", "borrow", "ethereum"),
      test("fork:compound:repay", "repay", "ethereum"),
      test("fork:compound:withdraw", "withdraw", "ethereum"),
      test("fork:compound:absorb", "absorb a liquidatable account", "ethereum"),
      test("fork:compound:buycollateral", "buy collateral", "ethereum"),
    ],
  }),
  recipe({
    keys: ["morpho", "morpho-blue"],
    appUrl: "https://app.morpho.org",
    chain: "ethereum",
    contractKeys: ["morpho"],
    note: "Supply and borrow on the deepest listed WETH/USDC Morpho Blue market (or MORPHO_MARKET_ID).",
    tests: [
      test("fork:morpho:supply", "supply", "ethereum"),
      test("fork:morpho:borrow", "borrow", "ethereum"),
      test("fork:morpho:repay", "repay", "ethereum"),
      test("fork:morpho:withdraw", "withdraw", "ethereum"),
      test("fork:morpho:flashloan", "flash loan", "ethereum"),
      test("fork:morpho:liquidate", "liquidate", "ethereum"),
    ],
  }),
  recipe({
    keys: ["steakhouse", "steakhouse-financial"],
    category: "vaults",
    appUrl: "https://www.steakhouse.financial",
    chain: "ethereum",
    contractKeys: ["steakhouse"],
    note: "ERC-4626 deposit and redeem on the Ethereum MetaMorpho Steakhouse USDC vault.",
    tests: [test("fork:steakhouse:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["gauntlet"],
    category: "vaults",
    appUrl: "https://www.gauntlet.xyz",
    chain: "ethereum",
    contractKeys: ["gauntlet"],
    note: "ERC-4626 deposit and redeem on MetaMorpho Gauntlet USDC Prime. Gauntlet USDC Prime V2 maxDeposit is 0, so it is not the vault under test.",
    tests: [test("fork:gauntlet:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["sentora", "sentora-curator"],
    category: "vaults",
    label: "Read-only",
    appUrl: "https://sentora.com",
    chain: "ethereum",
    contractKeys: ["sentora"],
    note: "Sentora RLUSD Main is a Morpho Vault V2 on Ethereum. V2 maxDeposit always returns 0 by design, not as a deposit-closure signal. The JS recipe checks the four gates before its deposit/exit flow; the Foundry primitive separately proves public accrueInterest settlement, not an investor deposit or redemption.",
    tests: [test("fork:sentora:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["veda", "ether.fi-liquid", "nonce-capital"],
    category: "vaults",
    label: "Deposit only",
    appUrl: "https://veda.tech",
    chain: "ethereum",
    contractKeys: ["veda"],
    note: "ether.fi Liquid ETH is a Veda BoringVault. The test deposits WETH through the Teller and asserts shares. Teller bulkWithdraw is not a public capability, so it does not redeem. WETH allowWithdraws was false. The ether.fi Liquid row and the Nonce Capital row (the curator of the ether.fi Liquid vaults, veda.tech/ecosystem/nonce-capital) share this vault; Liquid USD, Liquid BTC and Nonce's OP Mainnet Midas tokens are not exercised.",
    tests: [
      test("fork:veda:deposit", "deposit", "ethereum"),
      test("fork:veda:request", "request", "ethereum"),
      test("fork:veda:liquid-usd", "Liquid USD deposit", "ethereum"),
      test("fork:veda:liquid-btc", "Liquid BTC deposit", "ethereum"),
    ],
  }),
  recipe({
    keys: ["upshift"],
    category: "vaults",
    appUrl: "https://app.upshift.finance",
    chain: "ethereum",
    contractKeys: ["upshift"],
    note: "Upshift Sentora USD on Ethereum. Deposit USDC, then instantRedeem. The instant redemption fee (basis points) is taken out of the assets returned. If instant redeem is closed, requestRedeem is asserted instead of a completed withdrawal.",
    tests: [test("fork:upshift:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["yearn", "yearn-finance"],
    category: "vaults",
    appUrl: "https://yearn.fi",
    chain: "ethereum",
    contractKeys: ["yearn"],
    note: "Yearn V3 USDC-1 (yvUSDC-1) is ERC-4626. Deposit USDC and redeem.",
    tests: [test("fork:yearn:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["euler", "euler-v2"],
    label: "Euler Earn vault only",
    appUrl: "https://www.euler.finance",
    chain: "ethereum",
    contractKeys: ["euler"],
    note: "Euler Earn is ERC-4626. Deposit and redeem USDC on the first non-deprecated Ethereum vault in euler-labels (K3 Capital Earn USDC).",
    tests: [test("fork:euler:deposit", "deposit", "ethereum"), test("fork:euler:borrow", "borrow (EVC)", "ethereum")],
  }),
  recipe({
    keys: ["rockawayx"],
    category: "vaults",
    appUrl: "https://app.morpho.org/ethereum/vault/0xE0181090c22579B6A217f1522cbf8c9f1F0C1965/rockawayx-usdc-yield",
    chain: "ethereum",
    contractKeys: ["rockawayx"],
    note: "RockawayX USDC Yield is a Morpho Vault V2 on Ethereum. V2 maxDeposit always returns 0, so the test checks that all four gates are unset, then deposits USDC and redeems every share.",
    tests: [test("fork:rockawayx:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["curve-llamalend", "curve-llamalend-v2", "llamalend"],
    category: "lending",
    label: "Llamalend lend vault",
    appUrl: "https://www.curve.finance/crvusd/ethereum/markets/",
    chain: "ethereum",
    contractKeys: ["llamalend"],
    note: "Lends crvUSD into the Llamalend V1 wstETH-long vault (OneWayLendingFactory.vaults(13), ERC-4626) and redeems it, and opens, repays and liquidates a wstETH-collateral loan through the market controller.",
    tests: [
      test("fork:llamalend:deposit", "deposit", "ethereum"),
      test("fork:llamalend:borrow", "borrow", "ethereum"),
      test("fork:llamalend:repay", "repay", "ethereum"),
      test("fork:llamalend:liquidate", "liquidate", "ethereum"),
    ],
  }),
  recipe({
    keys: ["dolomite"],
    category: "lending",
    appUrl: "https://app.dolomite.io",
    chain: "ethereum",
    contractKeys: ["dolomite"],
    note: "Supplies USDC to DolomiteMargin through the official DepositWithdrawalRouter (account 0) and withdraws the full balance with BalanceCheckFlag.From. Borrowing and isolation-mode vaults are not exercised.",
    tests: [test("fork:dolomite:supply", "supply", "ethereum")],
  }),
  recipe({
    keys: ["lido"],
    appUrl: "https://stake.lido.fi",
    chain: "ethereum",
    contractKeys: ["lido"],
    tests: [
      test("fork:lido:submit", "submit", "ethereum"),
      test("fork:lido:wrap", "wrap", "ethereum"),
      test("fork:lido:request", "request", "ethereum"),
      test("fork:lido:unwrap", "unwrap", "ethereum"),
    ],
  }),
  recipe({
    keys: ["rocketpool", "rocket-pool"],
    appUrl: "https://stake.rocketpool.net",
    chain: "ethereum",
    contractKeys: ["rocketpool"],
    tests: [test("fork:rocketpool:deposit", "deposit", "ethereum"), test("fork:rocketpool:burn", "burn", "ethereum")],
  }),
  recipe({
    keys: ["cbeth", "coinbase-wrapped-staked-eth"],
    appUrl: "https://www.coinbase.com/cbeth",
    chain: "ethereum",
    contractKeys: ["cbeth"],
    note: "cbETH is minted by Coinbase. There is no public mint, so the fork script only reads exchangeRate().",
    tests: [test("fork:cbeth:rate", "rate", "ethereum")],
  }),
  recipe({
    keys: ["etherfi", "ether.fi", "ether.fi-stake"],
    // ether.fi Liquid (vaults) and the borrowing market share the etherfi scripts but are not eETH staking.
    category: "restaking",
    appUrl: "https://www.ether.fi",
    chain: "ethereum",
    contractKeys: ["etherfi"],
    tests: [
      test("fork:etherfi:deposit", "deposit", "ethereum"),
      test("fork:etherfi:wrap", "wrap", "ethereum"),
      test("fork:etherfi:request", "request", "ethereum"),
    ],
  }),
  recipe({
    keys: ["kelp"],
    category: "restaking",
    appUrl: "https://kelpdao.xyz",
    chain: "ethereum",
    contractKeys: ["kelp"],
    tests: [test("fork:kelp:deposit", "deposit", "ethereum"), test("fork:kelp:request", "request", "ethereum")],
  }),
  recipe({
    keys: ["renzo"],
    category: "restaking",
    appUrl: "https://app.renzoprotocol.com",
    chain: "ethereum",
    contractKeys: ["renzo"],
    tests: [test("fork:renzo:deposit", "deposit", "ethereum"), test("fork:renzo:request", "request", "ethereum")],
  }),
  recipe({
    keys: ["eigenlayer", "eigencloud"],
    category: "restaking",
    appUrl: "https://www.eigenlayer.xyz",
    chain: "ethereum",
    contractKeys: ["eigenlayer"],
    note: "StrategyManager.depositIntoStrategy on the stETH strategy, then DelegationManager.queueWithdrawals. The withdrawal delay is not advanced, so completion is not asserted.",
    tests: [
      test("fork:eigenlayer:deposit", "deposit", "ethereum"),
      test("fork:eigenlayer:queue", "queue", "ethereum"),
      {
        ...test(
          "fork:eigenlayer:complete",
          "complete withdrawal",
          "ethereum",
          "Slow (~25 min: mines the 14-day withdrawal delay). Left out of the default fork:all; run with FORK_SLOW=1 or FORK_ONLY."
        ),
        slow: true,
      },
      test("fork:eigenlayer:delegate", "delegate to operator", "ethereum"),
    ],
  }),
  recipe({
    keys: ["symbiotic"],
    category: "restaking",
    label: "Read-only",
    appUrl: "https://symbiotic.fi",
    chain: "ethereum",
    contractKeys: ["symbiotic"],
    note: "Official docs publish VaultFactory, not a permissionless vault. Curator vaults set their own deposit whitelist. The fork test reads the factory and does not deposit.",
    tests: [
      test("fork:symbiotic:read", "read", "ethereum"),
      test("fork:symbiotic:deposit", "vault deposit", "ethereum"),
    ],
  }),
  recipe({
    keys: ["swell", "swell-liquid-restaking"],
    category: "restaking",
    appUrl: "https://www.swellnetwork.io",
    chain: "ethereum",
    contractKeys: ["swell"],
    note: "rswETH deposit(). Skipped as a read when whitelistEnabled() is true.",
    tests: [test("fork:swell:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["puffer", "puffer-stake"],
    category: "restaking",
    appUrl: "https://www.puffer.fi",
    chain: "ethereum",
    contractKeys: ["puffer"],
    note: "pufETH depositETH. Read-only when maxDeposit is 0. The test FAILs with targetClosed=true when the pufETH AccessManager has closed the vault (isTargetClosed returned true on 2026-10-19 and 2026-10-21), since depositETH then reverts with AccessManagedUnauthorized.",
    tests: [test("fork:puffer:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["maker", "sky", "sky-lending", "sky-money", "sky-rwa"],
    category: "stable-rwa",
    appUrl: "https://sky.money",
    chain: "ethereum",
    contractKeys: ["sky"],
    note: "Permissionless Sky routes: DAI↔USDS on the official converter, USDS↔sUSDS and DAI↔sDAI through the ERC-4626 vaults.",
    tests: [
      test("fork:sky:convert", "convert", "ethereum"),
      test("fork:sky:susds", "susds", "ethereum"),
      test("fork:sky:sdai", "sdai", "ethereum"),
      test("fork:sky:redeem", "redeem", "ethereum"),
      test("fork:sky:psm", "psm", "ethereum"),
      test("fork:sky:vault", "open vault / draw USDS", "ethereum"),
    ],
  }),
  recipe({
    keys: ["ethena", "ethena-usde", "ethena-usdtb"],
    category: "stable-rwa",
    appUrl: "https://ethena.fi",
    chain: "ethereum",
    contractKeys: ["ethena"],
    note: "Minting USDe is whitelisted, so it is not tested. The public path is staking USDe into sUSDe and starting the cooldown.",
    tests: [
      test("fork:ethena:stake", "stake", "ethereum"),
      test("fork:ethena:cooldown", "cooldown", "ethereum"),
      test("fork:ethena:unstake", "unstake", "ethereum"),
    ],
  }),
  recipe({
    keys: ["circle", "usdc"],
    category: "stable-rwa",
    label: "Transfer / read-only",
    appUrl: "https://www.circle.com/usdc",
    chain: "ethereum",
    contractKeys: ["circle"],
    note: "USDC mint and redeem are off-chain (Circle). This fork test only transfers USDC and reads totalSupply.",
    tests: [test("fork:circle:transfer", "transfer", "ethereum")],
  }),
  recipe({
    keys: ["tether", "usdt"],
    category: "stable-rwa",
    label: "Transfer / read-only",
    appUrl: "https://tether.to",
    chain: "ethereum",
    contractKeys: ["tether"],
    note: "USDT mint and redeem are off-chain (Tether, KYC). This fork test only transfers USDT and reads totalSupply.",
    tests: [test("fork:tether:transfer", "transfer", "ethereum")],
  }),
  recipe({
    keys: ["frax-finance", "frax", "frax-usd"],
    category: "stable-rwa",
    // Not KYC-gated: Ethereum sfrxUSD simply has maxDeposit 0, so only a read is possible here.
    label: "Read-only",
    appUrl: "https://frax.com",
    chain: "ethereum",
    contractKeys: ["frax"],
    note: "Ethereum sfrxUSD maxDeposit is 0, so there is no local permissionless deposit. The fork test reads convertToAssets. Stake and unstake on Ethereum go through a Fraxtal lockbox.",
    tests: [test("fork:frax:rate", "rate", "ethereum"), test("fork:frax:mint-frxeth", "mint frxETH", "ethereum")],
  }),
  recipe({
    keys: ["buidl", "blackrock-buidl", "securitize"],
    category: "stable-rwa",
    label: "KYC-gated: read-only",
    appUrl: "https://securitize.io/blackrock/BUIDL",
    chain: "ethereum",
    contractKeys: ["buidl"],
    note: "KYC-gated: read-only. BUIDL mint is allowlisted. The fork test reads totalSupply of the rebasing token and does not mint.",
    tests: [test("fork:buidl:read", "read", "ethereum")],
  }),
  recipe({
    keys: ["ondo-finance", "ondo", "ondo-yield-assets", "ondo-global-markets"],
    category: "stable-rwa",
    label: "KYC-gated: read-only",
    appUrl: "https://ondo.finance",
    chain: "ethereum",
    contractKeys: ["ondo"],
    note: "KYC-gated: read-only. USDY and OUSG issuer mints are allowlisted. The JS fork test reads the oracles and does not mint; the Foundry row separately proves the public rUSDY unwrap path without claiming issuer subscription.",
    tests: [test("fork:ondo:rate", "rate", "ethereum")],
  }),
  recipe({
    keys: ["superstate", "invesco-ustb", "ustb"],
    category: "stable-rwa",
    label: "KYC-gated: read-only",
    appUrl: "https://superstate.com",
    chain: "ethereum",
    contractKeys: ["superstate"],
    note: "KYC-gated: read-only. USTB subscribe is allowlisted. The fork test reads the continuous NAV oracle and does not mint.",
    tests: [test("fork:superstate:nav", "nav", "ethereum")],
  }),
  recipe({
    keys: ["arbitrum-bridge", "arbitrum"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://bridge.arbitrum.io",
    chain: "ethereum",
    contractKeys: ["arbitrum"],
    note: "L1 Inbox.depositEth locks ETH and emits InboxMessageDelivered. Destination delivery on Arbitrum needs the rollup; a single Ethereum fork cannot verify it.",
    tests: [test("fork:arbitrum:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["base-bridge", "base"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://bridge.base.org",
    chain: "ethereum",
    contractKeys: ["base"],
    note: "L1StandardBridge.depositETH locks ETH and emits ETHDepositInitiated. Destination delivery on Base needs the rollup; a single Ethereum fork cannot verify it.",
    tests: [test("fork:base:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["optimism-bridge", "optimism"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://app.optimism.io/bridge",
    chain: "ethereum",
    contractKeys: ["optimism"],
    note: "L1StandardBridge.depositETH locks ETH (into the ETHLockbox that OptimismPortal.ethLockbox() reports) and emits ETHDepositInitiated. Destination delivery on OP Mainnet needs the rollup; a single Ethereum fork cannot verify it.",
    tests: [test("fork:optimism:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["across"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://app.across.to",
    chain: "ethereum",
    contractKeys: ["across"],
    note: "SpokePool.depositV3 locks USDC on Ethereum toward Base. A filler or relayer delivers the destination leg; this fork does not.",
    tests: [test("fork:across:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["stargate-finance", "stargate", "stargate-v2"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://stargate.finance",
    chain: "ethereum",
    contractKeys: ["stargate"],
    note: "Stargate V2 quoteSend and send lock USDC on Ethereum toward Arbitrum. LayerZero relayers deliver the destination; this fork does not.",
    tests: [test("fork:stargate:quote", "quote", "ethereum"), test("fork:stargate:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["lista-liquid-staking", "lista"],
    appUrl: "https://lista.org",
    chain: "bsc",
    contractKeys: ["lista-liquid-staking"],
    note: "ListaStakeManager.deposit() stakes native BNB and mints slisBNB. Withdrawal is a 7-day unbond queue, so the fork test only stakes.",
    tests: [test("fork:lista:stake", "stake", "bsc"), test("fork:lista:unstake", "unstake", "bsc")],
  }),
  recipe({
    keys: ["venus-core-pool", "venus"],
    appUrl: "https://app.venus.io",
    chain: "bsc",
    contractKeys: ["venus-core-pool"],
    note: "Venus Core Pool vUSDC mint and redeem on BSC (Compound V2-style). Borrow is not exercised.",
    tests: [
      test("fork:venus:supply", "supply", "bsc"),
      test("fork:venus:borrow", "borrow", "bsc"),
      test("fork:venus:repay", "repay", "bsc"),
      test("fork:venus:redeem", "redeem", "bsc"),
    ],
  }),
  recipe({
    keys: ["usd-ai", "usdai"],
    appUrl: "https://app.usd.ai",
    chain: "arbitrum",
    contractKeys: ["usd-ai"],
    note: "Protocol mint/redeem of USDai is whitelisted (docs.usd.ai). The fork stakes USDai into sUSDai (ERC-4626). Redeem is a 30-day queue, so the test does not redeem.",
    tests: [test("fork:usdai:stake", "stake", "arbitrum"), test("fork:usdai:mint", "mint USDai", "arbitrum")],
  }),
  recipe({
    keys: ["spark"],
    category: "vaults",
    appUrl: "https://app.spark.fi",
    chain: "ethereum",
    contractKeys: ["spark-vaults"],
    note: "Spark Savings Vaults V2 spUSDC is an ERC-4626 vault. Deposit and redeem on Ethereum. Idle liquidity caps redeem (SparkVault/insufficient-liquidity when the taker has deployed funds).",
    tests: [test("fork:spark-vaults:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["lista-dao"],
    appUrl: "https://lista.org",
    chain: "bsc",
    contractKeys: ["lista-dao"],
    note: "Lista MoolahVault (USDT) is ERC-4626. Deposit USDT and redeem on a BSC fork.",
    tests: [test("fork:lista-dao:deposit", "deposit", "bsc"), test("fork:lista-dao:borrow", "borrow", "bsc")],
  }),
  recipe({
    keys: ["world-chain", "world-chain-bridge"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://world.org/",
    chain: "ethereum",
    contractKeys: ["world-chain"],
    note: "World Chain is an OP Stack chain. L1StandardBridge.depositETH locks ETH in the OptimismPortal and emits ETHDepositInitiated. Delivery on World Chain needs the rollup; a single Ethereum fork cannot verify it.",
    tests: [test("fork:world-chain:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["robinhood-chain-bridge"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://robinhood.com/us/en/chain/",
    chain: "ethereum",
    contractKeys: ["robinhood-chain-bridge"],
    note: "Robinhood Chain is an Arbitrum Orbit chain. Delayed Inbox depositEth locks ETH in the Bridge and emits InboxMessageDelivered for the retryable. The L2 credit needs the chain's sequencer; this fork does not see it.",
    tests: [test("fork:robinhood:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["starknet-bridge"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://starkgate.starknet.io",
    chain: "ethereum",
    contractKeys: ["starknet-bridge"],
    note: "StarkGate locks ETH in the L1 bridge and the Starknet core contract emits LogMessageToL2. The sequencer consumes that message on Starknet; a single Ethereum fork cannot verify the L2 credit.",
    tests: [test("fork:starknet:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["polygon-bridge"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://polygon.technology/",
    chain: "ethereum",
    contractKeys: ["polygon-bridge"],
    note: "Polygon PoS RootChainManager.depositEtherFor locks ETH in the EtherPredicate. The StateSender sync is picked up by Polygon validators; this fork does not see the WETH minted on Polygon.",
    tests: [test("fork:polygon:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["lighter-bridge"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://app.lighter.xyz",
    chain: "ethereum",
    contractKeys: ["lighter-bridge"],
    note: "Lighter's Ethereum contract takes a direct USDC deposit (asset index 3, perps route) and queues it for the Lighter zk rollup. Crediting the Lighter account happens off this machine.",
    tests: [test("fork:lighter-bridge:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["binance-staked-eth"],
    appUrl: "https://www.binance.com/en/wbeth",
    chain: "ethereum",
    contractKeys: ["binance-staked-eth"],
    note: "wBETH mints on Ethereum for anyone who sends ETH to deposit(referral). Redemption runs through a Binance account, so the fork test only mints.",
    tests: [test("fork:wbeth:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["meta-pool", "meta-pool-eth"],
    appUrl: "https://metapool.app",
    chain: "ethereum",
    contractKeys: ["meta-pool"],
    note: "Meta Pool spETH (Ethereum) is ERC-4626; depositETH may be filled from the Liquid Unstake Pool. Most of this row's TVL is NEAR staking (stNEAR), which the repo cannot fork. The older mpETH contract is paused.",
    tests: [
      test("fork:meta-pool:deposit", "deposit", "ethereum"),
      test("fork:meta-pool:withdraw-request", "withdraw request", "ethereum"),
    ],
  }),
  recipe({
    keys: ["near-bridge"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://near.org/",
    chain: "ethereum",
    contractKeys: ["near-bridge"],
    note: "DefiLlama's NEAR Bridge row is the Omni Bridge. initTransfer locks ETH on Ethereum and emits InitTransfer; NEAR verifies it through its Ethereum light client, which a single Ethereum fork cannot run.",
    tests: [test("fork:near-bridge:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["portal"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://portalbridge.com",
    chain: "ethereum",
    contractKeys: ["portal"],
    note: "Portal is the Wormhole Token Bridge (Wrapped Token Transfers). wrapAndTransferETH keeps WETH in the bridge and the Core Contract publishes the transfer; the Guardians sign it and the destination redeems it off this machine.",
    tests: [test("fork:portal:transfer", "transfer", "ethereum")],
  }),
  recipe({
    keys: ["ccip"],
    category: "bridge-chain",
    label: "Source chain only",
    appUrl: "https://chain.link/cross-chain",
    chain: "ethereum",
    contractKeys: ["ccip"],
    note: "CCIP Router ccipSend of LINK to Base. LINK uses a LockReleaseTokenPool on Ethereum; the DON commits and executes on Base, which a single Ethereum fork cannot verify. LINK's Ethereum pool does not list Arbitrum (ChainNotAllowed on 2026-10-23).",
    tests: [test("fork:ccip:send", "send", "ethereum")],
  }),
  recipe({
    keys: ["stakewise-v3", "stakewise"],
    appUrl: "https://stakewise.io/",
    chain: "ethereum",
    contractKeys: ["stakewise-v3"],
    note: "StakeWise V3 Genesis Vault. depositAndMintOsToken stakes ETH and mints osETH in one call; exits go through the validator exit queue, so the fork test does not redeem.",
    tests: [test("fork:stakewise:deposit", "deposit", "ethereum"), test("fork:stakewise:exit", "exit", "ethereum")],
  }),
  recipe({
    keys: ["clearstar"],
    appUrl: "https://app.morpho.org/base/vault/0x91C056B6d4311a743614FBc03ac32d4E6A2d3a3c/clearstar-cbassets-vault",
    chain: "base",
    contractKeys: ["clearstar"],
    note: "Clearstar cbAssets Vault (Morpho Vault V2) on Base, Clearstar's largest vault. V2 maxDeposit is 0 by design, so the pre-check is that all four gates are unset.",
    tests: [test("fork:clearstar:deposit", "deposit", "base")],
  }),
  recipe({
    keys: ["hyperithm"],
    appUrl: "https://app.morpho.org/ethereum/vault/0x093272C07700d3cA5301C3Bf9B3A392624179E2F/hyperithm-usdc-apex",
    chain: "ethereum",
    contractKeys: ["hyperithm"],
    note: "Hyperithm USDC Apex (Morpho Vault V2) on Ethereum. Most of the row's TVL is the Monad vault of the same name, listed for verification; the Ethereum vault runs the same V2 code.",
    tests: [test("fork:hyperithm:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["concrete"],
    label: "Deposit only",
    appUrl: "https://app.concrete.xyz",
    chain: "ethereum",
    contractKeys: ["concrete"],
    note: "Concrete Earn V2 vaults are async: deposit is ERC-4626, withdrawal is an epoch queue processed about weekly, so the fork test deposits only. It uses ctDefiUSDT; the largest vault, ctDeltaWeETH, had getDepositLimits() of 0 on 2026-10-23 (deposits revert AssetAmountOutOfBounds).",
    tests: [test("fork:concrete:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["k3-capital"],
    category: "vaults",
    label: "Euler Earn vault (Ethereum)",
    appUrl: "https://k3.capital",
    chain: "ethereum",
    contractKeys: ["k3-capital"],
    note: "K3 Capital curates K3 Capital Earn USDC, the Euler Earn vault that fork:euler:deposit deposits into and redeems from. Most of the row's TVL is on Monad, which this test does not cover.",
    tests: [test("fork:euler:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["curvance"],
    category: "lending",
    appUrl: "https://app.curvance.com",
    chain: "monad",
    contractKeys: ["curvance"],
    note: "Curvance on Monad: lends WMON into cWMON of the WMON | USDC market and redeems it. cTokens are ERC-4626 in spirit; a collateral position would add a cooldown, so the test only lends. Needs MONAD_RPC_URL (the suite skips Monad without it).",
    tests: [test("fork:curvance:deposit", "deposit", "monad")],
  }),
  recipe({
    keys: ["saturn"],
    category: "stable-rwa",
    label: "Deposit only",
    appUrl: "https://app.saturn.credit/",
    chain: "ethereum",
    contractKeys: ["saturn"],
    note: "Saturn sUSDat (StakedUSDat, ERC-4626 over USDat). Staking is open with a deposit fee (25 bps on 2026-10-26) that previewDeposit prices in. Unstaking is request, processing and claim through WithdrawalQueueERC721, run by Saturn's processor, so the fork test deposits only. Minting USDat itself goes through Saturn's swap facility and is not tested.",
    tests: [test("fork:saturn:stake", "stake", "ethereum"), test("fork:saturn:unstake", "unstake", "ethereum")],
  }),
  recipe({
    keys: ["concentrator"],
    category: "vaults",
    appUrl: "https://concentrator.aladdin.club/",
    chain: "ethereum",
    contractKeys: ["concentrator"],
    note: "Concentrator aCRV (AladdinCRV), the cvxCRV auto-compounder. The test deposits cvxCRV and redeems it. Other Concentrator vaults (asdCRV, aCVX, arUSD) are listed for verification; arUSD is also on the f(x) Protocol row.",
    tests: [test("fork:concentrator:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["cooler-loans"],
    category: "lending",
    appUrl: "https://app.olympusdao.finance/#/lending/cooler",
    chain: "ethereum",
    contractKeys: ["cooler-loans"],
    note: "Olympus Cooler V2 (MonoCooler): gOHM collateral, USDS debt at a fixed rate. The test posts gOHM, borrows USDS, repays in full and withdraws the collateral. gOHM comes from the DLGTE module listed in the Olympus docs, because anvil_deal is unavailable.",
    tests: [test("fork:cooler:borrow", "borrow", "ethereum"), test("fork:cooler:repay", "repay", "ethereum")],
  }),
  recipe({
    keys: ["stake.link-liquid", "stake.link"],
    category: "staking",
    appUrl: "https://stake.link/staking-pools",
    chain: "ethereum",
    contractKeys: ["stake.link-liquid"],
    note: "stake.link LINK staking through the Priority Pool. When Chainlink staking has no room (canDeposit() was 0 on 2026-10-26) the deposit is queued; the test then unqueues it. Queued LINK turns into stLINK through an off-chain merkle distribution, which a fork cannot run.",
    tests: [test("fork:stakelink:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["fluid-lite"],
    category: "vaults",
    appUrl: "https://www.fluid.io/",
    chain: "ethereum",
    contractKeys: ["fluid-lite"],
    note: "Fluid Lite (Instadapp Lite) iETHv2, the stETH vault that holds most of the row. The test deposits stETH and redeems it net of the vault's withdrawal fee. fLiteUSD (USDC) is listed for verification.",
    tests: [test("fork:fluid-lite:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["ember-protocol", "ember"],
    category: "stable-rwa",
    label: "Deposit + queued exit",
    appUrl: "https://ember.so/",
    chain: "ethereum",
    contractKeys: ["ember-protocol"],
    note: "Ember Earn (eEARN), the largest public USDC vault Ember lists on Ethereum. The test deposits USDC and files redeemShares, which joins the FIFO withdrawal queue Ember's operator processes. Ember's Sui and Pharos vaults (about half the row) are not forkable here. Two other large Ethereum vaults are listed for verification.",
    tests: [test("fork:ember:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["vesper"],
    category: "vaults",
    label: "Deposit + cooldown request",
    appUrl: "https://vesper.finance/",
    chain: "ethereum",
    contractKeys: ["vesper"],
    note: "Vesper 2 (Vesper USD): USDC -> USDv through the Gateway, USDv -> sUSDv staking, then a cooldown unstake request. The cooldown (7 days by default) and the Gateway redemption back to USDC are not waited out. Vesper ETH (ETHv / sETHv) is listed for verification; older Vesper Grow pools are not covered.",
    tests: [test("fork:vesper:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["etherfi-borrowing-market", "etherfi-cash-liquid"],
    appUrl: "https://www.ether.fi/cash",
    chain: "optimism",
    contractKeys: ["etherfi-borrowing-market"],
    note: "ether.fi Cash lending is an ether.fi-managed Aave V4 instance on OP Mainnet (one Liquidity Hub, one Spoke). Borrowing is permissioned to ether.fi Safes, but anyone can supply, so the test supplies USDC and withdraws it. The Cash Liquid row is the collateral users hold in their ether.fi Safes on the same market; the Safes themselves are created by ether.fi for account holders and are not exercised here.",
    tests: [test("fork:etherfi-cash:supply", "supply", "optimism")],
  }),
  recipe({
    keys: ["falcon-finance"],
    category: "stable-rwa",
    label: "Stake + redeem",
    appUrl: "https://app.falcon.finance/",
    chain: "ethereum",
    contractKeys: ["falcon-finance"],
    note: "Falcon Finance: the row is USDf supply on Ethereum. Minting USDf from collateral needs Falcon KYC, so the test stakes USDf (funded from the Curve USDC/USDf pool) into sUSDf, the ERC-4626 yield vault anyone can enter, and redeems it. Restaking sUSDf into fixed-term boosted positions (Falcon Position NFT) is not exercised.",
    tests: [test("fork:falcon:stake", "stake", "ethereum")],
  }),
  recipe({
    keys: ["meth-protocol"],
    category: "staking",
    label: "Stake + unstake request",
    appUrl: "https://www.mantle.xyz/meth",
    chain: "ethereum",
    contractKeys: ["meth-protocol"],
    note: "mETH Protocol (Mantle LST) on Ethereum: stake ETH for mETH through the Staking contract, then file an unstake request that locks the mETH in the UnstakeRequestsManager. Request finalisation follows validator exits and is not waited out. cmETH restaking is not exercised.",
    tests: [test("fork:meth:stake", "stake", "ethereum")],
  }),
  recipe({
    keys: ["kpk"],
    category: "vaults",
    appUrl: "https://app.morpho.org/ethereum/vault/0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6",
    chain: "ethereum",
    contractKeys: ["kpk"],
    note: "KPK USDC Prime (Morpho Vault V2) on Ethereum, one of the vaults KPK curates (docs.kpk.io). The row also counts KPK's Gearbox Earn Pools, a Symbiotic vault, kpk Funds and Safes KPK manages through Zodiac roles, which are not exercised. USDC Prime Core is listed for verification.",
    tests: [test("fork:kpk:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["galaxy-curation"],
    category: "vaults",
    appUrl: "https://app.curation.galaxy.com/",
    chain: "ethereum",
    contractKeys: ["galaxy-curation"],
    note: "Galaxy USDC Quality (Morpho Vault V2) on Ethereum, from Galaxy Curation's deployed-vaults page. Most of the row's TVL is the Galaxy USDC vault on Arc, which the repo does not fork; the other Ethereum vaults are listed for verification.",
    tests: [test("fork:galaxy:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["aera"],
    category: "vaults",
    label: "Async request + refund",
    appUrl: "https://app.gauntlet.xyz/vaults/gtusda",
    chain: "base",
    contractKeys: ["aera"],
    note: "Aera V3 gtUSDa (Gauntlet USD Alpha) on Base, the multi-depositor vault Aera's integration guide documents. Entry is an async requestDeposit to the ProvisionerV2 that Aera's solver fills (usually within 6 hours); the test files one and, after its deadline, refunds it with refundRequest. Aera's Ethereum vaults and single-depositor vaults (treasury mandates) are not exercised.",
    tests: [test("fork:aera:request", "request", "base")],
  }),
  recipe({
    keys: ["usdt0"],
    category: "bridge-chain",
    label: "OFT send",
    appUrl: "https://usdt0.to/transfer",
    chain: "ethereum",
    contractKeys: ["usdt0"],
    note: "USDT0 is Tether's LayerZero OFT. On Ethereum the OFT Adapter locks USDT (the row's TVL) and other chains mint USDT0. The test sends USDT to Arbitrum through the adapter; the mint on Arbitrum needs LayerZero DVNs and an executor, which a fork does not run. The XAUT0 adapter and the IOTA lockbox are listed for verification.",
    tests: [test("fork:usdt0:send", "send", "ethereum")],
  }),
  recipe({
    keys: ["layerzero-v2", "layerzero"],
    category: "bridge-chain",
    label: "OApp send (source chain)",
    appUrl: "https://layerzero.network/",
    chain: "ethereum",
    contractKeys: ["layerzero-v2"],
    note: "LayerZero V2 is a messaging layer; its DefiLlama TVL is tokens locked in OFT adapters. The test sends USDT through the USDT0 OFT Adapter (an OApp) and asserts at the LayerZero layer: the OApp's endpoint() is EndpointV2, EndpointV2 emits PacketSent from the OApp's configured send library, and the outbound nonce to Arbitrum advances by one. DVN verification and executor delivery on the destination are off-chain/other-chain and not run on a fork.",
    tests: [test("fork:layerzero:send", "send", "ethereum")],
  }),
  recipe({
    keys: ["benqi-lending", "benqi"],
    category: "lending",
    label: "Supply and redeem",
    appUrl: "https://app.benqi.fi/markets",
    chain: "avalanche",
    contractKeys: ["benqi-lending"],
    note: "Benqi Core Markets on Avalanche C-Chain (Compound V2-style). Mints qiUSDCn with native USDC and redeems every qiToken; pre-checks Comptroller mintGuardianPaused. Borrowing, isolated (Ecosystem) markets and QI rewards are not exercised.",
    tests: [
      test("fork:benqi:supply", "supply", "avalanche"),
      test("fork:benqi:borrow", "borrow", "avalanche"),
      test("fork:benqi:redeem", "redeem", "avalanche"),
    ],
  }),
  recipe({
    keys: ["benqi-staked-avax"],
    category: "staking",
    label: "Stake",
    appUrl: "https://app.benqi.fi/liquid-staking",
    chain: "avalanche",
    contractKeys: ["benqi-staked-avax"],
    note: "Benqi Liquid Staking: submit() AVAX for sAVAX; shares must equal the pre-tx getSharesByPooledAvax and totalPooledAvax must rise by the amount. Unstaking is a 15-day requestUnlock cooldown and is not exercised.",
    tests: [test("fork:benqi:stake", "stake", "avalanche"), test("fork:benqi:unlock", "request unlock", "avalanche")],
  }),
  recipe({
    keys: ["liquity"],
    category: "lending",
    label: "Stability Pool",
    appUrl: "https://www.liquity.org/",
    chain: "ethereum",
    contractKeys: ["liquity"],
    note: "Liquity V1: LUSD into the Stability Pool and back. Opening a trove (ETH collateral, 2,000 LUSD minimum debt) is not exercised. Liquity V2 (BOLD, ETH / wstETH / rETH branches) is part of the row; its core contracts are listed for verification.",
    tests: [
      test("fork:liquity:deposit", "deposit", "ethereum"),
      test("fork:liquity:open", "open trove", "ethereum"),
      test("fork:liquity:redeem", "redeem", "ethereum"),
      test("fork:liquity:liquidate", "liquidate", "ethereum"),
    ],
  }),
  recipe({
    keys: ["convex-finance"],
    category: "vaults",
    label: "Booster deposit + withdraw",
    appUrl: "https://www.convexfinance.com/",
    chain: "ethereum",
    contractKeys: ["convex-finance"],
    note: "Convex for Curve on Ethereum: deposit Curve LP through the Booster with stake=true and withdraw it from the pool's BaseRewardPool. Pid 9 (Curve 3pool) by default; CONVEX_PID picks another pool. cvxCRV staking and vlCVX locking are not exercised; their contracts are listed for verification.",
    tests: [test("fork:convex:deposit", "deposit", "ethereum"), test("fork:convex:claim", "claim rewards", "ethereum")],
  }),
  recipe({
    keys: ["theo"],
    category: "stable-rwa",
    label: "Stake + lockup redeem",
    appUrl: "https://app.theo.xyz/",
    chain: "ethereum",
    contractKeys: ["theo"],
    note: "Theo thUSD / sthUSD on Ethereum. Minting thUSD and thBILL goes through whitelisted signed orders, so the test stakes thUSD into sthUSD (open to anyone), requests the redemption and claims it after the 5-day lockup, which it advances on the fork. thBILL and the minters are listed for verification.",
    tests: [test("fork:theo:stake", "stake", "ethereum"), test("fork:theo:unstake", "unstake", "ethereum")],
  }),
  recipe({
    keys: ["cian-yield-layer"],
    category: "vaults",
    label: "Deposit + redeem request",
    appUrl: "https://yieldlayer.cian.app/",
    chain: "ethereum",
    contractKeys: ["cian-yield-layer"],
    note: "CIAN rsETH Yield Layer on Ethereum, the largest public Yield Layer vault in CIAN's vault API. The test deposits rsETH and queues a redemption with the RedeemOperator, which CIAN's operator settles. The stETH Yield Layer is listed for verification; Mantle and other chains are not forked.",
    tests: [
      test("fork:cian:deposit", "deposit", "ethereum"),
      test("fork:cian:withdraw-request", "withdraw request", "ethereum"),
    ],
  }),
  recipe({
    keys: ["solvbtc"],
    category: "bridge-chain",
    label: "Mint SolvBTC",
    appUrl: "https://app.solv.finance/solvbtc",
    chain: "ethereum",
    contractKeys: ["solvbtc"],
    note: "Most of the row is BTC on Bitcoin, which the repo does not fork. On Ethereum, the SolvBTC Router mints SolvBTC from WBTC through the permissionless WBTC storage pool; the test does that. Redemption is an Open Fund request Solv settles and is not run. xSolvBTC and the LST router are listed for verification.",
    tests: [test("fork:solvbtc:subscribe", "subscribe", "ethereum"), test("fork:solvbtc:redeem", "redeem", "ethereum")],
  }),
  recipe({
    keys: ["zama"],
    category: "other",
    label: "Confidential wrap",
    appUrl: "https://www.zama.org/",
    chain: "ethereum",
    contractKeys: ["zama"],
    note: "Zama's confidential token wrappers on Ethereum (ERC-7984): the row's TVL is ERC-20s locked in them. The test wraps USDC into cUSDC. Balances become FHE handles, so the encrypted amount is not read, and unwrapping needs the Zama decryption network, which a fork does not have.",
    tests: [test("fork:zama:wrap", "wrap", "ethereum")],
  }),
  recipe({
    keys: ["tornado-cash"],
    appUrl: "https://tornado.cash",
    chain: "ethereum",
    contractKeys: ["tornado-cash"],
    tests: [test("fork:tornado-cash:deposit", "deposit 0.1 ETH", "ethereum")],
  }),
  recipe({
    keys: ["grove", "grove-finance"],
    appUrl: "https://app.grove.finance",
    chain: "base",
    contractKeys: ["grove"],
    tests: [test("fork:grove:deposit", "deposit 100 USDC", "base")],
  }),
  recipe({
    keys: ["fluid-dex"],
    appUrl: "https://fluid.instadapp.io",
    chain: "ethereum",
    contractKeys: ["fluid-dex"],
    tests: [test("fork:fluid-dex:swap", "swap 1 WETH to USDC", "ethereum")],
  }),
  recipe({
    keys: ["obol"],
    appUrl: "https://stake.obol.org",
    chain: "ethereum",
    contractKeys: ["obol"],
    tests: [test("fork:obol:stake", "stake", "ethereum")],
  }),
  recipe({
    keys: ["usdd"],
    appUrl: "https://usdd.io",
    chain: "ethereum",
    contractKeys: ["usdd"],
    tests: [test("fork:usdd:mint", "mint", "ethereum")],
  }),
  recipe({
    keys: ["pendle", "pendle-v2"],
    appUrl: "https://pendle.finance",
    chain: "ethereum",
    contractKeys: ["pendle"],
    tests: [
      test("fork:pendle:buy-pt", "buy-pt", "ethereum"),
      test("fork:pendle:mint-py", "mint PT/YT", "ethereum"),
      test("fork:pendle:add-liquidity", "add liquidity", "ethereum"),
    ],
  }),
  recipe({
    keys: ["aster-bridge", "astherus--bridge-chain"],
    appUrl: "https://www.asterdex.com",
    chain: "bsc",
    contractKeys: ["aster-bridge"],
    tests: [test("fork:aster-bridge:deposit-native", "deposit-native", "bsc")],
  }),
  recipe({
    keys: ["bitfi-basis"],
    appUrl: "https://www.bitfi.one",
    chain: "bsc",
    contractKeys: ["bitfi-basis"],
    tests: [test("fork:bitfi-basis:deposit", "deposit", "bsc")],
  }),
  recipe({
    keys: ["bedrock-unibtc"],
    appUrl: "https://app.bedrock.technology/unibtc",
    chain: "ethereum",
    contractKeys: ["bedrock-unibtc"],
    tests: [test("fork:bedrock-unibtc:mint", "mint", "ethereum")],
  }),
  recipe({
    keys: ["derive-v3", "derive-v3-options"],
    appUrl: "https://app.derive.xyz",
    chain: "ethereum",
    contractKeys: ["derive-v3"],
    tests: [test("fork:derive-v3:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["railgun"],
    appUrl: "https://railgun.org",
    chain: "ethereum",
    contractKeys: ["railgun"],
    tests: [test("fork:railgun:shield", "shield", "ethereum")],
  }),
  recipe({
    keys: ["fluid-lending"],
    appUrl: "https://fluid.instadapp.io",
    chain: "ethereum",
    contractKeys: ["fluid-lending"],
    tests: [
      test("fork:fluid-lending:deposit", "deposit", "ethereum"),
      test("fork:fluid-lending:borrow", "vault borrow", "ethereum"),
    ],
  }),
  recipe({
    keys: ["mellow-core"],
    appUrl: "https://app.mellow.finance/vaults",
    chain: "ethereum",
    contractKeys: ["mellow-core"],
    tests: [test("fork:mellow-core:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["axelar"],
    appUrl: "https://axelar.network",
    chain: "ethereum",
    contractKeys: ["axelar"],
    tests: [test("fork:axelar:send-message", "send-message", "ethereum")],
  }),
  recipe({
    keys: ["fraxtal"],
    appUrl: "https://frax.com/",
    chain: "ethereum",
    contractKeys: ["fraxtal"],
    tests: [test("fork:fraxtal:deposit-erc20", "deposit-erc20", "ethereum")],
  }),
  recipe({
    keys: ["avant", "avant-protocol"],
    appUrl: "https://www.avantprotocol.com",
    chain: "avalanche",
    contractKeys: ["avant"],
    tests: [test("fork:avant:stake", "stake", "avalanche")],
  }),
  recipe({
    keys: ["hyperliquid-bridge"],
    appUrl: "https://hyperliquid.xyz",
    chain: "arbitrum",
    contractKeys: ["hyperliquid-bridge"],
    tests: [test("fork:hyperliquid-bridge:deposit", "deposit", "arbitrum")],
  }),
  recipe({
    keys: ["polymarket"],
    appUrl: "https://polymarket.com",
    chain: "polygon",
    contractKeys: ["polymarket"],
    tests: [test("fork:polymarket:split", "split", "polygon")],
  }),
  recipe({
    keys: ["armitage", "armitage-by-wintermute"],
    appUrl: "https://armitage.wintermute.com",
    chain: "ethereum",
    contractKeys: ["armitage"],
    tests: [test("fork:armitage:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["xdai-stake-bridge"],
    appUrl: "https://www.gnosis.io/",
    chain: "ethereum",
    contractKeys: ["xdai-stake-bridge"],
    tests: [
      test("fork:xdai-stake-bridge:deposit", "deposit", "ethereum"),
      test("fork:xdai-stake-bridge:relay", "OmniBridge relayTokens (erc-to-erc sibling)", "ethereum"),
    ],
  }),
  recipe({
    keys: ["lagoon"],
    category: "vaults",
    label: "ERC-7540 deposit request",
    appUrl: "https://app.lagoon.finance/",
    chain: "ethereum",
    contractKeys: ["lagoon"],
    note: "Lagoon docs name no reference vault, so the test creates one from the official Ethereum Factory (vault logic v0.5.0, USDC, whitelist off) and asserts the ERC-7540 requestDeposit: pendingDepositRequest equals the assets. Settlement needs the curator's valuation and is not exercised.",
    tests: [test("fork:lagoon:request-deposit", "ERC-7540 deposit request", "ethereum")],
  }),
  recipe({
    keys: ["aero-protocol--dex", "aero"],
    category: "dex",
    label: "Add liquidity + lock (Aero)",
    appUrl: "https://aero.finance",
    chain: "base",
    contractKeys: ["aero-protocol--dex"],
    note: "Aero (Aerodrome rebranded 2026-10-22) on Base: mints LP on the AERO/USDC v2 pool and locks 1,000 AERO for 52 weeks in the Aero VotingEscrow. Addresses come from docs.iaero.finance (secondary docs; Aero has not yet published an official address page) and are checked on the fork. Gauge staking is not testable: legacy gauges are NotAlive and the new Voter has no pool-to-gauge lookup.",
    tests: [
      test("fork:aerodrome:add-liquidity", "add liquidity", "base"),
      test("fork:aerodrome:lock", "lock AERO (veNFT)", "base"),
    ],
  }),
  recipe({
    keys: ["fx-protocol", "fx"],
    category: "stable-rwa",
    label: "Open position + stability pool",
    appUrl: "https://fx.aladdin.club",
    chain: "ethereum",
    contractKeys: ["fx-protocol"],
    note: "f(x) Protocol V2 on Ethereum: PoolManager.operate opens a wstETH position minting fxUSD, and FxUSDBasePool takes a 1,000 fxUSD stability-pool deposit (fxUSD funded by a storage write).",
    tests: [
      test("fork:fx:operate", "mint fxUSD / open position", "ethereum"),
      test("fork:fx:stability-deposit", "stability pool deposit", "ethereum"),
    ],
  }),
  recipe({
    keys: ["defi-saver-asset-management"],
    category: "lending",
    label: "Recipe through a DSProxy",
    appUrl: "https://defisaver.com/",
    chain: "ethereum",
    contractKeys: ["defi-saver-asset-management"],
    note: "Builds a fresh DSProxy and runs a two-action DeFi Saver recipe through RecipeExecutor: AaveV3Supply 5 WETH, then AaveV3Borrow 1,000 USDC. Registry and executor from defisaver-v3-contracts addresses/mainnet.json. Automation (strategy triggers run by DeFi Saver bots) is not exercised.",
    tests: [test("fork:defisaver:recipe", "automation / recipes", "ethereum")],
  }),
];

const API_ONLY = [
  {
    keys: ["coinbase-bridge"],
    category: "bridge-chain",
    appUrl: "https://www.coinbase.com/cbbtc",
    note: "No fork test: Coinbase Bridge is custodial. Its TVL is BTC, XRP and ADA held by Coinbase on Bitcoin, Ripple and Cardano; cbBTC and the other wrapped assets are minted and burned only by Coinbase's own minter, so there is no permissionless user action on a forkable chain. Checked 2026-11-02.",
  },
  {
    keys: ["fence-finance", "fence"],
    appUrl: "https://fence.finance",
    note: "Contracts only: Fence Finance's Avalanche TranchePool was drained (~$1.01M USDC, DefiLlama /hacks 2026-10-27). Depositing into an exploited pool is not a meaningful test, so no fork test is added even though Avalanche is now forkable. analytics:fence:exploit tracks the incident.",
  },
  {
    keys: ["raydium-amm", "raydium", "raydium-amm-v3"],
    appUrl: "https://raydium.io",
    note: "Raydium is a Solana AMM. The fork suite is EVM-only, so this row stays API-only.",
  },
  // Documented reasons for forkable top-200 rows that have no permissionless action to test.
  {
    keys: ["near-intents"],
    category: "aggregator",
    appUrl: "https://near.com/",
    note: "No fork test: NEAR Intents settles on NEAR. Balances live in the intents.near Verifier contract's internal ledger and solvers fill signed intents off-chain (docs.near-intents.org). EVM chains only hold bridged deposits, so there is no EVM contract with a permissionless action to assert on a fork. monitor:dex -- near:intents covers TVL and volume.",
  },
  {
    keys: ["re"],
    category: "stable-rwa",
    appUrl: "https://app.re.xyz",
    note: "KYC-gated: no fork test. Re requires KYC/KYB for every mint and redemption of reUSD and reUSDe (docs.re.xyz/minting-and-redemptions/minting), so there is no permissionless action to run on a fork. The contracts listed are the Ethereum tokens and NAV oracles from the official contract page.",
  },
  {
    keys: ["plume-vaults"],
    category: "stable-rwa",
    appUrl: "https://app.plume.org/vaults",
    note: "Compliance-gated: no fork test. Nest (Plume Vaults) deposits go through a ComplianceProxy or the legacy NestVaultPredicateProxy, and each deposit needs a fresh Predicate attestation issued by the Nest API (docs.nest.credit integration guides), so a local fork cannot mint shares permissionlessly. Most TVL sits on Plume Mainnet, which the repo does not fork.",
  },
  {
    keys: ["unit"],
    category: "bridge-chain",
    appUrl: "https://hyperunit.xyz/deposit",
    note: "No fork test: Unit is run by a Guardian network that signs with MPC/TSS. Deposits go to Guardian-generated addresses and are credited on Hyperliquid L1, and the Ethereum treasury (0xBEa9f7FD27f4EE20066F18DEF0bc586eC221055A per docs.hyperunit.xyz key addresses) is an MPC account with no contract code. There is no EVM contract to exercise on a fork.",
  },
  {
    keys: ["maple"],
    category: "lending",
    appUrl: "https://www.maple.finance",
    note: 'Permissioned: no fork test. syrupUSDC and syrupUSDT deposits must go through SyrupRouter, which enforces PoolPermissionManager "P:deposit"; a first deposit needs an authorization signature from Maple, and withdrawals are a queued requestRedeem that Maple processes (docs.maple.finance smart-contract integration). monitor:dex -- maple:lending covers TVL and fees.',
  },
  {
    keys: ["fusion-by-ipor"],
    category: "vaults",
    appUrl: "https://app.ipor.io/fusion",
    note: "No fork test: IPOR Fusion publishes the IporFusionFactoryProxy per chain (docs.ipor.io addresses), not a single permissionless vault. Curator vaults are cloned from the factory with their own fuses and deposit rules, so there is no one ERC-4626 address to assert on a fork. The factory address is listed for verification.",
  },

  {
    keys: ["avalon-superearn"],
    category: "vaults",
    appUrl: "https://app.avalonfinance.xyz/earn",
    note: "No fork test on Ethereum: Avalon SuperEarn user deposits go through SuperEarnRouter on Kaia (chain 8217). Ethereum holds remote aggregation and cooldown vaults that receive bridged assets (docs.superearn.io smart contracts). The repo does not fork Kaia, and the Ethereum remote vaults are not the permissionless user deposit path.",
  },
  {
    keys: ["rsk-bridge"],
    category: "bridge-chain",
    appUrl: "https://rootstock.io/",
    note: "No fork test: almost all of this row is BTC locked in the Rootstock Powpeg on Bitcoin, which an EVM fork cannot run. The only EVM leg is the Ethereum side of the Rootstock Token Bridge (about $1M), which Rootstock sunset at the end of March 2026 (rootstock.io blog: bridging between Ethereum and Rootstock is no longer supported; use Stargate). A deposit test would lock tokens in a retired bridge. Its Ethereum contracts are listed for verification.",
  },
  {
    keys: ["huma"],
    category: "stable-rwa",
    appUrl: "https://app.huma.finance",
    note: "No fork test: PST is minted and redeemed by the Huma program on Solana (docs.huma.finance smart contracts). On Ethereum PST is a Chainlink CCIP cross-chain token used on Fluid, with no Huma deposit or redeem contract to call, so the only on-chain action is an ERC-20 transfer. The Ethereum PST token is listed for verification.",
  },
  {
    keys: ["lombard-vaults"],
    category: "vaults",
    appUrl: "https://www.lombard.finance/app/",
    note: "No fork test: the Lombard DeFi Vault (LBTCv) is a Veda BoringVault entered through a Teller, and Lombard's contract page (docs.lombard.finance smart contracts) does not publish that Teller; the only source for it is a third-party repo, which this repo does not take addresses from. Withdrawals are a queue of up to 14 days. LBTCv, BTCe and LBTC from the official page are listed for verification.",
  },
  {
    keys: ["enzyme-finance"],
    category: "vaults",
    appUrl: "https://app.enzyme.finance/",
    note: "No fork test: Enzyme Blue vaults are each deployed by their manager from the FundDeployer with their own deposit policies (allowed-depositor lists, minimums, share-action timelocks), so there is no single permissionless vault behind this row to assert on a fork. The Sulu FundDeployer, DepositWrapper and ValueInterpreter from Enzyme's SDK deployment file are listed for verification.",
  },
  {
    keys: ["opentrade"],
    category: "stable-rwa",
    appUrl: "https://app.opentrade.io/",
    note: "KYC-gated: no fork test. OpenTrade vaults lend only to onboarded institutions and accredited users who pass KYC/KYB (docs.opentrade.io eligibility requirements), and investments and withdrawal requests come from whitelisted wallets, so there is no permissionless action to run on a fork. Most of the row sits on Avalanche (forkable since 2026-11-02) and Plume, but the KYC gate blocks a permissionless test there too. The four Ethereum vault tokens from the official contract page are listed for verification.",
  },
  {
    keys: ["ssv-network"],
    category: "staking",
    appUrl: "https://app.ssv.network/",
    note: "No JS validator fork: the row is ETH staked in validators run by SSV operator clusters. Registering a validator needs a real validator key split into operator-encrypted key shares and a 32 ETH beacon-chain deposit, and its effect (validator duties) happens on the consensus layer. The Foundry row covers the separate permissionless public operator registration, not validator registration.",
  },
  {
    keys: ["liquid-collective"],
    category: "staking",
    appUrl: "https://liquidcollective.io",
    note: "No fork test: LsETH deposit and redeem are allowlist-gated. River._onDeposit calls allowlist.onlyAllowed(depositor, DEPOSIT_MASK); on Ethereum block 26328497 Allowlist.getPermissions(fresh)=0 and River.deposit() with 1 ETH reverts 0x8e4a23d6 Unauthorized(depositor). The slashing containment flag is false, so the allowlist is the gate, not a pause. Verified 2026-11-03.",
  },
  {
    keys: ["solv-protocol--stable-rwa"],
    category: "stable-rwa",
    appUrl: "https://solv.finance",
    note: "No fork test: the BSC SolvBTC.TRADING pool is whitelisted. At BSC block 131276198 OpenFundMarket.poolInfos(poolId).permissionless is false, SolvBTCRouter.checkPoolPermission(fresh) is false and createSubscription reverts 'pool permission denied'; OpenFundMarket.subscribe is router-only. The only permissionless BSC pool (SolvBTC.BNB) is the SolvBTC product, not this row. Verified 2026-11-03.",
  },
  {
    keys: ["sosovalue-indexes"],
    category: "vaults",
    appUrl: "https://sosovalue.com",
    note: "No fork test: the SSI contracts are deployed on Base only (all 16 documented addresses return getCode=0x on Ethereum; the row's 'Ethereum' TVL is the ETH leg inside the Base baskets) and the mint is gated even there: AssetToken.mint is ISSUER_ROLE, AssetIssuer.addMintRequest rejects non-participants and USSI.applyMint requires PARTICIPANT_ROLE plus a signed order. Verified 2026-11-03.",
  },
  {
    keys: ["avalanche-core-bridge"],
    category: "bridge-chain",
    appUrl: "https://core.app/bridge",
    note: "No fork test: Intel SGX warden custody. The bridge releases funds on Avalanche only after a quorum of wardens signs the withdrawal off-chain, so there is no permissionless on-chain action to assert on a single-chain fork. Recorded 2026-11-03.",
  },

  // Written reasons for remaining top-200 API-only rows (2026-11-06).
  {
    keys: ["sun--dex"],
    category: "dex",
    note: "SUN (SunSwap V1–V4) is a Tron DEX. Its pools and routers live on Tron's TVM, which Anvil cannot fork; the EVM fork suite has no Tron RPC or recipe. Ranking and volume stay on DefiLlama (defillama.com/protocol/sun). App: https://sunswap.com.",
  },
  {
    keys: ["sanctum-validator-lsts"],
    category: "staking",
    note: "Sanctum Validator LSTs are Solana stake-pool tokens. Mint and redeem go through Sanctum programs on Solana; Anvil is EVM-only and cannot fork Solana, so this row stays API-only. App: https://www.sanctum.so.",
  },
  {
    keys: ["kraken-bitcoin"],
    category: "bridge-chain",
    note: "Kraken Bitcoin (kBTC) is Kraken's wrapped BTC. BTC is held in Kraken custody on Bitcoin; mint and burn are custodial, not a permissionless EVM action Anvil can fork. App: https://www.kraken.com/kbtc.",
  },
  {
    keys: ["hyperliquid-earn"],
    category: "lending",
    note: "Hyperliquid Earn holds balances on HyperCore (Hyperliquid L1), not HyperEVM. Deposits and yield settle on HyperCore's non-EVM L1; Anvil cannot fork HyperCore (perps/HyperCore coverage is closed by decision). App: https://app.hyperliquid.xyz/earn.",
  },
  {
    keys: ["nexus-btc"],
    category: "bridge-chain",
    note: "Nexus BTC (bit.com) wraps Bitcoin under exchange custody. The BTC leg settles on Bitcoin / custodian rails; Anvil cannot fork Bitcoin or exercise that mint. App: https://www.bit.com.",
  },
  {
    keys: ["jupiter-lend"],
    category: "lending",
    note: "Jupiter Lend is a Solana lending market in the Jupiter stack. Supply and borrow settle in Solana programs; the fork suite is EVM-only, so Anvil cannot run a Jupiter Lend deposit. App: https://jup.ag.",
  },
  {
    keys: ["pump--other"],
    category: "other",
    note: "Pump (Other) is Pump.fun fees/volume with no chain TVL on DefiLlama. Activity is Solana bonding-curve / off-board volume; there is nothing for Anvil to fork. App: https://www.pump.fun.",
  },
  {
    keys: ["hive-protocol"],
    category: "bridge-chain",
    note: "Hive Protocol bridges on BSquared (hive.bsquared.network). BSquared is not in src/config/chains.js, so there is no Anvil RPC or fork recipe for this row.",
  },
  {
    keys: ["kalshi"],
    category: "other",
    note: "Kalshi is a CFTC-regulated prediction exchange (kalshi.com), not an on-chain AMM. There is no chain TVL on DefiLlama and no EVM contract Anvil can fork for a user trade.",
  },
  {
    keys: ["onre"],
    category: "stable-rwa",
    note: "OnRe is an RWA/stable product on Solana (app.onre.finance). User actions settle in Solana programs; Anvil cannot fork Solana, so there is no EVM fork test for this row.",
  },
  {
    keys: ["ripple-usd"],
    category: "stable-rwa",
    note: "Ripple USD (RLUSD) is issued by Ripple; mint and redeem are issuer/custodial flows (ripple.com/solutions/stablecoin). DefiLlama shows no chain TVL to fork; Anvil cannot exercise RLUSD issuance.",
  },
  {
    keys: ["r25"],
    category: "stable-rwa",
    note: "R25 is an RWA/stable product with TVL on Pharos (and Sui). Pharos is not configured in src/config/chains.js, and Sui is Move VM—neither is Anvil-forkable here. App: https://www.r25.xyz.",
  },
  {
    keys: ["dfdv-staked-sol"],
    category: "staking",
    note: "DFDV Staked SOL is a Solana liquid-staking token from DeFi Development Corp. Stake and redeem are Solana program calls; Anvil cannot fork Solana. App: https://defidevcorp.com.",
  },
  {
    keys: ["kinetiq--staking"],
    category: "staking",
    note: "Kinetiq staking (kinetiq.xyz) stakes on Hyperliquid L1 / HyperCore. Stake and unstake are HyperCore actions; Anvil cannot fork HyperCore. App: https://kinetiq.xyz/stake.",
  },
  {
    keys: ["jito-liquid-staking"],
    category: "staking",
    note: "Jito Liquid Staking (jitoSOL) stakes SOL through Jito's Solana stake pool. Anvil cannot fork Solana, so stake/unstake cannot be asserted here. App: https://jito.network.",
  },
  {
    keys: ["figure-markets-prime"],
    category: "lending",
    note: "Figure Markets Prime is crypto-backed lending on Provenance (figure.com). Provenance is not an EVM chain in src/config/chains.js; Anvil cannot fork it. App: https://www.figure.com/crypto-backed-loan/.",
  },
  {
    keys: ["rhea-lend"],
    category: "lending",
    note: "Rhea Lend is a NEAR lending market (lending.rhea.finance). Markets live on NEAR, not EVM; Anvil cannot fork NEAR. App: https://lending.rhea.finance.",
  },
  {
    keys: ["world-liberty-financial"],
    category: "lending",
    note: "World Liberty Financial is listed with no chain TVL on DefiLlama (fees/volume-style row). There is no forkable on-chain market in this suite; coverage stays API-only. App: https://worldlibertyfinancial.com.",
  },
  {
    keys: ["lighter--perps"],
    category: "perps",
    note: "Lighter Perps trade on Robinhood Chain / zkLighter (robinhoodchain.lighter.xyz). That EVM chain is not in src/config/chains.js (no RPC or fork recipe), so Anvil cannot fork Lighter here. Repo docs also mark Lighter withdraw as not-testable (L1 proof). Docs: https://docs.lighter.xyz.",
  },
  {
    keys: ["dflow-aggregator"],
    category: "aggregator",
    note: "DFlow Aggregator is a Solana intent/RFQ aggregator (dflow.net). Quotes and fills are off the EVM fork suite and DefiLlama shows no chain TVL; Anvil cannot assert a DFlow swap.",
  },
  {
    keys: ["rocketswap-anubis"],
    category: "dex",
    note: "RocketSwap Anubis is a DEX on the Anubis chain. Anubis is not in src/config/chains.js (no RPC or fork recipe), and the row has no appUrl in the board, so Anvil cannot fork it.",
  },
  {
    keys: ["0x-aggregator"],
    category: "aggregator",
    note: "0x Aggregator is the 0x swap API / intent layer (0x.org). Routing is off-chain quote + fill; DefiLlama has no chain TVL for this row, so Anvil has nothing protocol-owned to fork beyond generic DEX venues already covered elsewhere.",
  },
  {
    keys: ["gtbtc"],
    category: "restaking",
    note: "GTBTC is Gate's Bitcoin staking / wrapped-BTC product. BTC is locked or custodied off Anvil's EVM forks; there is no permissionless Bitcoin action to assert here. App: https://www.gate.com/staking/BTC.",
  },
  {
    keys: ["forward-industries-sol"],
    category: "staking",
    note: "Forward Industries SOL is Solana-staked SOL under Forward Industries. The stake path is Solana-native; Anvil's EVM forks cannot exercise it. App: https://www.forwardindustries.com.",
  },
  {
    keys: ["pumpswap"],
    category: "dex",
    note: "PumpSwap is the Pump.fun Solana AMM (swap.pump.fun). Swaps and LP live in Solana programs; Anvil cannot fork Solana, so this DEX row stays API-only.",
  },
  {
    keys: ["chainlink--other"],
    category: "other",
    note: "Chainlink (Other) is DefiLlama's fees/other bucket for Chainlink services, not a single forkable pool. Oracle and CCIP legs that are forkable are covered under Chainlink CCIP recipes; this row has no chain TVL to fork.",
  },
  {
    keys: ["justcryptos"],
    category: "bridge-chain",
    note: "JustCryptos wraps assets on Tron (JUST network). Mint and redeem settle on TVM, not an EVM chain Anvil can fork, so there is no permissionless action to assert in this suite. App: https://just.network/token.",
  },
  {
    keys: ["bitget-bgbtc"],
    category: "bridge-chain",
    note: "Bitget bgBTC is Bitget's wrapped Bitcoin. BTC custody and mint/burn are exchange-side on Bitcoin rails; Anvil cannot fork that path. App: https://www.bitget.com.",
  },
  {
    keys: ["binance-bitcoin"],
    category: "bridge-chain",
    note: "Binance Bitcoin (BTCB and related collateral BTC tokens) is Binance-custodied BTC. Mint and redeem are custodial; Anvil cannot fork Bitcoin or Binance's minter. App: https://www.binance.com/en/collateral-btokens.",
  },
  {
    keys: ["orca-dex"],
    category: "dex",
    note: "Orca is a Solana (and Eclipse) concentrated-liquidity DEX. Whirlpool swaps are Solana program calls; Anvil cannot fork Solana, so there is no Orca fork recipe. App: https://www.orca.so.",
  },
  {
    keys: ["wbtc"],
    category: "bridge-chain",
    note: "WBTC is minted by merchants against BTC locked with custodians on Bitcoin (wbtc.network). The BTC lock and merchant mint are off Anvil; a fork can only move existing WBTC, not exercise the wrap. App: https://wbtc.network.",
  },
  {
    keys: ["uniswap-aggregator"],
    category: "aggregator",
    note: "Uniswap Aggregator is the Uniswap Trading API / aggregator surface, not Uniswap v2/v3/v4 pools. Those pools already have fork tests; this fees-only aggregator row has no chain TVL and no extra Anvil target. App: https://app.uniswap.org.",
  },
  {
    keys: ["justlend-strx"],
    category: "staking",
    note: "JustLend sTRX is liquid-staked TRX on JustLend DAO. Stake and unstake run on Tron TVM; Anvil cannot fork Tron, so this row stays API-only. App: https://app.justlend.org/strx.",
  },
  {
    keys: ["liquidmesh"],
    category: "aggregator",
    note: "LiquidMesh is a cross-venue aggregator (liquidmesh.io). DefiLlama shows no chain TVL; fills are routed off a single forkable pool, so Anvil cannot assert a LiquidMesh-specific action.",
  },
  {
    keys: ["nordstern.finance"],
    category: "aggregator",
    note: "Nordstern.Finance is listed as an aggregator with no chain TVL on DefiLlama. There is no Nordstern pool for Anvil to fork; ranking stays API-only. App: http://nordstern.finance.",
  },
  {
    keys: ["binance-wallet"],
    category: "other",
    note: "Binance Wallet (web3.binance.com) is a custodial/wallet product whose DefiLlama row has no chain TVL. Wallet flows are off Anvil; there is no permissionless protocol action to fork.",
  },
  {
    keys: ["flashnet"],
    category: "dex",
    note: "Flashnet is a Bitcoin Lightning / Spark-style DEX (flashnet.xyz). It is not an EVM AMM and has no chain TVL on DefiLlama for Anvil to fork.",
  },
  {
    keys: ["bebop-aggregator"],
    category: "aggregator",
    note: "Bebop Aggregator is an RFQ/aggregator (bebop.xyz). Quotes come from makers off-chain; DefiLlama shows no chain TVL, so Anvil cannot produce a Bebop fill without their quote service.",
  },
  {
    keys: ["binance-staked-sol"],
    category: "staking",
    note: "Binance Staked SOL (BNSOL) is minted and redeemed through Binance's Solana staking product. Custody and stake sit on Solana / Binance; Anvil cannot fork that path. App: https://www.binance.com/en/solana-staking.",
  },
  {
    keys: ["jupiter-staked-sol"],
    category: "staking",
    note: "Jupiter Staked SOL (JupSOL) is Jupiter's Solana LST. Stake and unstake are Solana program actions; Anvil is EVM-only. App: https://jup.ag.",
  },
  {
    keys: ["titan-exchange"],
    category: "aggregator",
    note: "Titan Exchange is a Solana aggregator (titan.exchange). Routing is Solana/off-chain with no DefiLlama chain TVL; Anvil cannot fork Titan.",
  },
  {
    keys: ["jupiter--perps"],
    category: "perps",
    note: "Jupiter Perps are perpetual markets on Solana via Jupiter. Open/close settle in Solana programs; Anvil cannot fork Solana, so this perps row stays API-only. App: https://jup.ag.",
  },
  {
    keys: ["lorenzo-enzobtc"],
    category: "bridge-chain",
    note: "Lorenzo enzoBTC is a Bitcoin liquid-staking / wrap product (lorenzo-protocol.xyz). The BTC stake leg is on Bitcoin; Anvil cannot fork Bitcoin to assert mint or redeem.",
  },
  {
    keys: ["meteora-dynamic-bonding-curve"],
    category: "other",
    note: "Meteora Dynamic Bonding Curve is a Solana Meteora product surface tracked without chain TVL on this DefiLlama row. Meteora programs are Solana-native; Anvil cannot fork them. App: https://www.meteora.ag.",
  },
  {
    keys: ["sthype"],
    category: "staking",
    note: "stHYPE is liquid-staked HYPE on Hyperliquid L1 (Valantis app). The stake path is HyperCore, not HyperEVM; Anvil cannot fork it. App: https://app.valantis.xyz.",
  },
  {
    keys: ["phantom-sol"],
    category: "staking",
    note: "Phantom SOL is Phantom wallet's Solana liquid staking. Stake flows through Solana programs and Phantom custody UX; Anvil cannot fork Solana. App: https://phantom.com.",
  },
  {
    keys: ["marinade-finance"],
    category: "staking",
    note: "Marinade (mSOL) is Solana liquid staking. Deposit and delayed unstake are Solana program calls; Anvil cannot fork Solana. App: https://app.marinade.finance.",
  },
  {
    keys: ["exsat-staking-btc"],
    category: "bridge-chain",
    note: "exSat Staking BTC bridges and stakes BTC via exSat (exsat.network). The stake and bridge legs settle on Bitcoin / exSat, not an Anvil-forkable EVM user action.",
  },
  {
    keys: ["solfi-v2"],
    category: "dex",
    note: "SolFi V2 is a Solana AMM (@SolFiAMM). DefiLlama lists it without chain TVL in this board snapshot; Anvil cannot fork Solana anyway, so the row stays API-only.",
  },
  {
    keys: ["bybit-staked-sol"],
    category: "staking",
    note: "Bybit Staked SOL (bbSOL) is Bybit's Solana staking product. Mint/redeem are Solana-side and custodial via Bybit; Anvil cannot fork that path. App: https://www.bybit.com/en/web3/staking/BybitSOL.",
  },
  {
    keys: ["justlend-v1"],
    category: "lending",
    note: "JustLend V1 is Tron's primary lending market (supply/borrow TRX and TRC-20s). Markets live on TVM; Anvil has no Tron fork path, so coverage is DefiLlama TVL only. App: https://justlend.org.",
  },
  {
    keys: ["zerofi"],
    category: "dex",
    note: "ZeroFi is listed as a DEX with no chain TVL and no appUrl on the board. There is no ZeroFi pool address in this repo for Anvil to fork; coverage is ranking-only.",
  },
  {
    keys: ["drift-staked-sol"],
    category: "staking",
    note: "Drift Staked SOL is Drift's Solana LST tied to the Drift protocol. Stake actions are Solana programs; Anvil cannot fork Solana. App: https://app.drift.trade.",
  },
  {
    keys: ["risex"],
    category: "perps",
    note: "RISEx is a perps venue on RISE (rise.trade). RISE is not configured in src/config/chains.js, so Anvil has no fork path for RISEx. App: https://www.rise.trade/en.",
  },
  {
    keys: ["bitget-wallet-x"],
    category: "aggregator",
    note: "Bitget Wallet X is a wallet/aggregator product (web3.bitget.com) with no DefiLlama chain TVL. Custodial wallet flows are not Anvil-forkable protocol actions.",
  },
  {
    keys: ["b14g"],
    category: "restaking",
    note: "b14g is Bitcoin restaking across Bitcoin, CORE, and Babylon Genesis (b14g.xyz). Restake settles on those non-EVM / Bitcoin rails; Anvil cannot fork them.",
  },
  {
    keys: ["kamino-lend"],
    category: "lending",
    note: "Kamino Lend is a Solana lending market (kLend). Supply and borrow settle on Solana; Anvil's EVM fork suite cannot exercise Kamino. App: https://kamino.com.",
  },
  {
    keys: ["edgex-spot"],
    category: "dex",
    note: "edgeX Spot is a centralized/hybrid spot venue (pro.edgex.exchange). DefiLlama shows no chain TVL; trades are not permissionless EVM pool swaps Anvil can fork.",
  },
  {
    keys: ["babylon-protocol"],
    category: "restaking",
    note: "Babylon Protocol restakes BTC on Bitcoin for PoS security (babylonlabs.io). Staking locks BTC on Bitcoin; Anvil cannot fork Bitcoin, so this row stays API-only.",
  },
  {
    keys: ["bittensor-dtao"],
    category: "dex",
    note: "Bittensor dTAO is a Bittensor (subnet/tao) market, not EVM. Anvil cannot fork Bittensor; coverage is DefiLlama ranking only. App: https://bittensor.com.",
  },
  {
    keys: ["redotpay-card"],
    category: "other",
    note: "RedotPay Card is a crypto card product (redotpay.com/card), not an on-chain protocol. No chain TVL; Anvil cannot fork card issuance or spend.",
  },
  {
    keys: ["enso"],
    category: "aggregator",
    note: "Enso is a shared-network / shortcut aggregator (enso.build). DefiLlama has no chain TVL for this row; shortcuts are routed off a single forkable venue owned by Enso.",
  },
  {
    keys: ["tbtc"],
    category: "staking",
    note: "tBTC (Threshold) mints against BTC locked in a Threshold wallet on Bitcoin. The BTC deposit and redemption proofs are Bitcoin-side; Anvil cannot complete a tBTC mint on an EVM fork alone. App: https://threshold.network.",
  },
  {
    keys: ["hyperliquid-spot-orderbook"],
    category: "dex",
    note: "Hyperliquid Spot Orderbook is the HyperCore CLOB. Spot trades settle on Hyperliquid L1, not an EVM chain Anvil can fork; HyperCore coverage is closed by decision. App: https://app.hyperliquid.xyz.",
  },
  {
    keys: ["defi-app-aggregator"],
    category: "aggregator",
    note: "Defi App Aggregator (app.defi.app) routes across venues. The row has no chain TVL on DefiLlama; Anvil already covers the underlying DEXes, not this aggregator shell.",
  },
  {
    keys: ["arcus-perps"],
    category: "perps",
    note: "Arcus Perps are perpetual markets on Robinhood Chain (arcus.xyz). Robinhood Chain is not configured in src/config/chains.js, so there is no Anvil fork recipe for Arcus Perps.",
  },
  {
    keys: ["merlins-seal"],
    category: "bridge-chain",
    note: "Merlin's Seal is Merlin Chain's Bitcoin bridge/staking product. BTC is locked on Bitcoin; Anvil cannot fork Bitcoin to assert seal or unseal. App: https://merlinchain.io/bridge/staking.",
  },
  {
    keys: ["m0"],
    category: "stable-rwa",
    note: "M0 ($M) minting is permissioned: only governance-approved, activated Minters can proposeMint/mintM against off-chain SPV collateral verified by Validators (docs.m0.org/protocol/roles, docs.m0.org/protocol/minting-burning). Anvil cannot act as an approved Minter or supply validator attestations, so mint stays not-testable; ordinary $M transfers are not the product action this row ranks. App: https://www.m0.org.",
  },
  {
    keys: ["humidifi"],
    category: "dex",
    note: "HumidiFi is tracked without chain TVL on DefiLlama in this snapshot (humidifi.xyz). There is no HumidiFi pool recipe in the fork suite; the row stays API-only.",
  },
  {
    keys: ["rialto-prop-amm"],
    category: "dex",
    note: "Rialto Prop AMM (rialto.xyz/swap) is a proprietary/AMM surface with no DefiLlama chain TVL in this board. Without a published EVM pool in chains.js venues, Anvil has nothing to fork.",
  },
  {
    keys: ["tokenlon-agg"],
    category: "aggregator",
    note: "Tokenlon Agg is Tokenlon's aggregator (tokenlon.im). Aggregator routing is quote-driven; this DefiLlama row has no chain TVL for Anvil to pin a Tokenlon-owned pool test to.",
  },
  {
    keys: ["lofty"],
    category: "stable-rwa",
    note: "Lofty tokenizes real-estate on Algorand (lofty.ai). Algorand is not EVM; Anvil cannot fork it despite the coverage snapshot wording 'EVM not configured'. App: https://www.lofty.ai.",
  },
  {
    keys: ["0x"],
    category: "aggregator",
    note: "0x (protocol/API row distinct from 0x Aggregator) is the 0x exchange/API surface (0x.org). Settlements need off-chain orders; DefiLlama shows no chain TVL for this row to fork as a pool.",
  },
  {
    keys: ["function-fbtc"],
    category: "bridge-chain",
    note: "Function FBTC wraps Bitcoin under Function's custody model (fxn.xyz). The BTC leg is off EVM; Anvil cannot fork the wrap. App: https://www.fxn.xyz.",
  },
  {
    keys: ["nexo-card"],
    category: "other",
    note: "Nexo Card is a custodial crypto card (nexo.com/crypto-card). Spend and credit are off-chain; Anvil cannot fork card transactions.",
  },
  {
    keys: ["stellar-defi-hub"],
    category: "other",
    note: "Stellar DeFi Hub aggregates Stellar DeFi. Stellar is not EVM (the nonForkable reason text saying 'EVM not configured' is misleading); Anvil cannot fork Stellar. App: https://stellardefihub.com.",
  },
  {
    keys: ["aster-spot"],
    category: "dex",
    note: "Aster Spot is Aster's spot trading surface (asterdex.com). This DefiLlama row has no chain TVL; spot matching is venue-side, not a permissionless Anvil pool swap. (Aster Bridge has a separate fork test.)",
  },
  {
    keys: ["betmoar.fun"],
    category: "other",
    note: "Betmoar.fun is a betting/prediction product (betmoar.fun) with no DefiLlama chain TVL. There is no forkable on-chain market recipe for this row.",
  },
  {
    keys: ["cetus-aggregator"],
    category: "aggregator",
    note: "Cetus Aggregator routes on Sui (cetus.zone). Sui is Move VM and this row has no chain TVL on DefiLlama; Anvil cannot fork Cetus.",
  },
  {
    keys: ["aster-usdf"],
    category: "stable-rwa",
    note: "Aster USDF mints 1:1 with USDT on Aster, then moves USDT into Ceffu custody and delta-neutral strategies on Binance (docs.asterdex.com/usdf-stablecoin/overview/how-usdf-works). The yield and backing leg are custodial/off-exchange; Anvil cannot fork Ceffu or Binance MirrorX, so USDF mint/redeem is not a meaningful local fork test. App: https://www.asterdex.com/en/usdf.",
  },
  {
    keys: ["the-vault-liquid-staking"],
    category: "staking",
    note: "The Vault Liquid Staking is a Solana LST product (thevault.finance). Stake/unstake are Solana-native; Anvil cannot fork Solana.",
  },
  {
    keys: ["suilend"],
    category: "lending",
    note: "Suilend is a Sui Move lending market (suilend.fi). Sui's Move VM is not EVM; Anvil cannot fork Sui. App: https://www.suilend.fi.",
  },
  {
    keys: ["blend-pools-v2"],
    category: "lending",
    note: "Blend Pools V2 is lending on Stellar (blend.capital). Stellar is not EVM; Anvil cannot fork Blend. App: https://www.blend.capital.",
  },
  {
    keys: ["magicmarkets"],
    category: "other",
    note: "MagicMarkets (magicmarkets.com) is listed without chain TVL on DefiLlama. There is no MagicMarkets EVM pool in this repo for Anvil to fork.",
  },
  {
    keys: ["arcus-aggregator"],
    category: "aggregator",
    note: "Arcus Aggregator (arcus.xyz) is the aggregator shell for Arcus. DefiLlama shows no chain TVL; Robinhood Chain perps for Arcus are separately marked chain-not-configured.",
  },
  {
    keys: ["rysk-v12"],
    category: "perps",
    note: "Rysk V12 options trades are RFQ-only: each trade needs a market maker's EIP-712 signed quote from Rysk's off-chain service (docs.rysk.finance; data/feature-gaps.json). Contracts are on Ethereum and HyperEVM, but a fork cannot produce the quote, so options trade is not-testable.",
  },
  {
    keys: ["valos"],
    category: "stable-rwa",
    note: "Valos is an institutional credit vault on Monad (AUSD deposits via Accountable/YieldApp). Vault access requires identity verification / AML screening before deposit (YieldApp vault page; Monad launch notes for institutional allocators). Anvil cannot satisfy that gate, so deposit is not a permissionless fork test. App: https://valos.io; vault: https://yield.accountable.capital/vaults/143/0x8dCE15fc6a98484C995Fc702cBfBdA14A30454af.",
  },
  {
    keys: ["papertrade"],
    category: "perps",
    note: "Papertrade is a perps product on Hyperliquid L1 (papertrade.xyz). Trading settles on HyperCore; Anvil cannot fork HyperCore, so this row stays API-only.",
  },
  {
    keys: ["kyros"],
    category: "restaking",
    note: "Kyros is Solana restaking (kyros.fi). Restake and withdraw run on Solana programs; Anvil cannot fork Solana, so this row stays API-only.",
  },
  {
    keys: ["omenx"],
    category: "other",
    note: "OmenX (omenx.com) is listed with no DefiLlama chain TVL. There is no OmenX contract recipe in the fork suite; the row stays API-only.",
  },
  {
    keys: ["hyperflow"],
    category: "aggregator",
    note: "HyperFlow (hyperflow.fun) is an aggregator/flow product with no DefiLlama chain TVL. Anvil cannot fork a HyperFlow-owned pool that is not listed in chains.js venues.",
  },

  {
    keys: ["realt-tokens", "realt"],
    category: "stable-rwa",
    appUrl: "https://realt.co",
    note: "RealT Tokens are tokenized U.S. real-estate shares on Gnosis (xDAI). Gnosis is configured in src/config/chains.js (chain 100, GNOSIS_RPC_URL, no public fallback). Transfers require per-property address whitelisting (faq.realt.co: YAM secondary market and transferring from a compromised address); unapproved transfers revert, but already-whitelisted holders can transfer to another approved address. No impersonated transfer has been EIP-55/getCode-verified and measured on a pinned fork here, so the row stays API-only rather than shipping an unproven test.",
  },
  {
    keys: ["pinksale"],
    category: "other",
    appUrl: "https://www.pinksale.finance",
    note: "PinkSale is a multi-chain token launchpad (pinksale.finance). This DefiLlama row has no chain TVL map on the board, and there is no single permissionless pool or sale contract in this repo to assert on an Anvil fork; coverage stays API-only until a dedicated recipe exists.",
  },
  {
    keys: ["bedrock-unieth"],
    category: "restaking",
    appUrl: "https://bedrock.rockx.com/unieth",
    note: "Bedrock uniETH is Bedrock's ETH liquid-staking / restaking product. The suite already forks Bedrock uniBTC mint (`fork:bedrock-unibtc:mint`); uniETH deposit/mint is not registered as its own fork recipe yet, so this board row stays API-only rather than claiming the uniBTC test.",
  },
];

const CATEGORY_RECIPES = {
  dex: {
    title: "Generic DEX fork",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run simulate:dex:uniswap:v3`],
    note: "No dedicated fork script. Quote Uniswap V3 on an Ethereum Anvil fork (SIMULATE_ONLY, no wallet).",
  },
  aggregator: {
    title: "Generic aggregator check",
    chain: "ethereum",
    commands: ["npm run simulate:1inch:smoke"],
    note: "Aggregators are API-only here. The smoke hits DefiLlama; there is no on-fork swap.",
  },
  perps: {
    title: "Generic perps check",
    chain: "ethereum",
    commands: ["npm run simulate:gmx:smoke"],
    note: "Perps are not spot routers. Use the DefiLlama smoke. No fork swap.",
  },
  lending: {
    title: "Generic lending fork",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run fork:aave:supply`],
    note: "No dedicated fork script. Aave V3 supply on an Ethereum fork is the lending recipe.",
  },
  vaults: {
    title: "Generic vault fork",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run fork:steakhouse:deposit`],
    note: "No dedicated fork script. Steakhouse USDC deposit and redeem on an Ethereum fork is the vault recipe. A vault with maxDeposit 0 stays read-only.",
  },
  staking: {
    title: "Generic liquid-staking fork",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run fork:lido:submit`],
    note: "No dedicated fork script. Lido submit on an Ethereum fork is the staking recipe.",
  },
  restaking: {
    title: "Generic restaking fork",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run fork:etherfi:deposit`],
    note: "No dedicated fork script. ether.fi deposit on an Ethereum fork is the restaking recipe. EigenLayer deposit and queue are the direct restaking path when a row has them.",
  },
  "stable-rwa": {
    title: "Generic stablecoin check",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run fork:sky:convert`],
    note: "No dedicated fork script. Sky DAI→USDS on an Ethereum fork is the stablecoin recipe. KYC-gated RWA rows stay read-only.",
  },
  "bridge-chain": {
    title: "Generic bridge check",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, `ETHEREUM_RPC_URL=${LOCAL} npm run fork:arbitrum:deposit`],
    note: "No dedicated fork script. An Arbitrum Inbox depositEth on an Ethereum fork is the bridge recipe. Destination delivery needs the rollup.",
  },
  other: {
    title: "Generic API check",
    chain: "ethereum",
    commands: ["npm run simulate:polymarket:smoke"],
    note: "No fork script for this category. Use the protocol’s DefiLlama smoke when it has one.",
  },
  boards: {
    title: "Market board",
    chain: "ethereum",
    commands: ["npm run catalog -- eth"],
    note: "Cross-protocol boards are read-only. They are not fork-tested.",
  },
  tooling: {
    title: "Fork tooling",
    chain: "ethereum",
    commands: [`CHAIN=ethereum node scripts/startFork.js`, "npm run fork:all"],
    note: "npm run fork:all starts one Anvil fork per chain and runs the suite.",
  },
};

function rowKeys(row) {
  const keys = [row.slug, row.id, row.name];
  for (const member of row.members || []) keys.push(member.slug, member.name);
  for (const script of row.scripts || []) {
    const parts = String(script.name || "").split(":");
    if (script.file === "src/simulation/fork/run.js") continue;
    if (parts[0] === "simulate" || parts[0] === "analytics" || parts[0] === "swap" || parts[0] === "fork")
      keys.push(parts[1]);
  }
  return keys.filter(Boolean).map(key => String(key).toLowerCase());
}

function findByKeys(list, keys, category) {
  const set = new Set(keys);
  return (
    list.find(entry => {
      if (entry.category && category && entry.category !== category) return false;
      return entry.keys.some(key => set.has(key));
    }) || null
  );
}

function scriptKind(name) {
  const script = String(name || "");
  if (script.startsWith("fork:")) return "fork";
  if (script.startsWith("swap:")) return "swap";
  if (script.startsWith("monitor:dex")) return "analytics";
  if (script.startsWith("analytics -- ") || script.startsWith("crosschain -- ")) return "analytics";
  if (script.startsWith("analytics:") || script.startsWith("crosschain:")) return "analytics";
  if (script.includes(":smoke")) return "smoke";
  if (/^simulate:(uniswapx:fill|aave:(v3:fork|liquidations|versions)|morpho:fork|lido:fork)/.test(script))
    return "fork";
  if (script.startsWith("simulate:")) return "quote";
  return "other";
}

function withKinds(scripts) {
  return (scripts || []).map(script => {
    const name = typeof script === "string" ? script : script.name;
    const file = typeof script === "string" ? null : script.file || null;
    return { name, file, kind: scriptKind(name) };
  });
}

function attachTesting(row) {
  const keys = rowKeys(row);
  const apiOnly = findByKeys(API_ONLY, keys, row.category);
  const fork = apiOnly ? null : findByKeys(FORK_RECIPES, keys, row.category);
  const categoryRecipe = CATEGORY_RECIPES[row.category] || CATEGORY_RECIPES.other;
  const scripts = withKinds(row.scripts).filter(script => script.file !== "src/simulation/fork/run.js");
  if (fork) {
    const seen = new Set(scripts.map(script => script.name));
    for (const item of fork.tests) {
      if (seen.has(item.script)) continue;
      scripts.push({ name: item.script, file: "src/simulation/fork/run.js", kind: "fork" });
      seen.add(item.script);
    }
  }
  row.scripts = scripts;
  // What each attached fork test does and asserts. Derived from the tests that
  // are actually on this row, so the panel cannot describe a test that is not here.
  const features = fork ? fork.tests.map(item => featuresByScript().get(item.script)).filter(Boolean) : [];
  // The flow is keyed by the recipe's first key, not the DefiLlama row id, so ask with the
  // recipe keys the row was matched through (compound-finance -> compound, cbeth -> ...).
  const flow = fork ? flowForKeys(fork.keys) : null;
  row.testing = fork
    ? {
        mode: "fork",
        flow,
        label: fork.label || null,
        note: fork.note,
        appUrl: fork.appUrl || row.appUrl || null,
        chain: fork.chain,
        rpcEnv: fork.rpcEnv,
        commands: fork.commands,
        tests: fork.tests,
        features,
        contracts: fork.contracts,
        recipe: null,
      }
    : {
        mode: "api-only",
        note: apiOnly ? apiOnly.note : "No fork test for this protocol.",
        appUrl: (apiOnly && apiOnly.appUrl) || row.appUrl || null,
        chain: categoryRecipe.chain,
        rpcEnv: RPC_ENV[categoryRecipe.chain] || null,
        commands: [],
        tests: [],
        features: [],
        flow: null,
        contracts: contractsForKeys(keys),
        recipe: categoryRecipe,
      };
  Object.assign(row.testing, statusFor(row, keys));
  if (!row.appUrl && row.testing.appUrl) row.appUrl = row.testing.appUrl;
  return row;
}

const NOT_A_CHAIN = new Set(["borrowed", "staking", "pool2", "vesting"]);

function cleanChainTvl(chainTvls) {
  const out = {};
  if (!chainTvls || typeof chainTvls !== "object") return out;
  for (const [name, value] of Object.entries(chainTvls)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    if (NOT_A_CHAIN.has(name) || name.includes("-")) continue;
    out[name] = value;
  }
  return out;
}

function topChainTvl(map, limit = 8) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([chain, tvl]) => ({ chain, tvl: Math.round(tvl) }));
}

function applyProtocolMeta(data, protocols) {
  const bySlug = new Map();
  const byParent = new Map();
  for (const protocol of protocols || []) {
    if (!protocol || !protocol.slug) continue;
    const chains = cleanChainTvl(protocol.chainTvls);
    bySlug.set(protocol.slug, { chains, url: protocol.url || null, twitter: protocol.twitter || null });
    const parent = String(protocol.parentProtocol || "").replace(/^parent#/, "");
    if (parent) {
      const acc = byParent.get(parent) || {};
      for (const [name, value] of Object.entries(chains)) acc[name] = (acc[name] || 0) + value;
      byParent.set(parent, acc);
    }
  }
  const visit = row => {
    let map = null;
    if (row.members && row.members.length) {
      map = {};
      for (const member of row.members) {
        const found = bySlug.get(member.slug);
        if (!found) continue;
        for (const [name, value] of Object.entries(found.chains)) map[name] = (map[name] || 0) + value;
      }
    }
    if (!map || !Object.keys(map).length) map = (bySlug.get(row.slug) || {}).chains || byParent.get(row.slug) || null;
    row.chainTvls = map ? topChainTvl(map) : [];
    const direct = bySlug.get(row.slug);
    if (!row.appUrl && direct && direct.url) row.appUrl = direct.url;
    // X handle: the row's own DefiLlama entry, else the first member that has one. Aave's board
    // row is the family aggregate while the handle lives on aave-v3, so the fallback matters.
    if (!row.twitter) {
      row.twitter = (direct && direct.twitter) || null;
      for (const member of row.members || []) {
        if (row.twitter) break;
        const found = bySlug.get(member.slug);
        if (found && found.twitter) row.twitter = found.twitter;
      }
    }
  };
  for (const row of data.overall || []) visit(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) visit(row);
}

function enrichShowcase(data) {
  for (const row of data.overall || []) attachTesting(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) attachTesting(row);
  const forkRows = (data.overall || []).filter(row => row.testing && row.testing.mode === "fork");
  const fork = forkRows.length;
  const apiOnly = (data.overall || []).filter(row => row.testing && row.testing.mode === "api-only").length;
  data.stats = data.stats || {};
  data.stats.forkInTop200 = fork;
  // Rows whose panel can draw the contract flow (data/contract-flows.json). A fork row without
  // one keeps its feature cards; the count is a coverage signal, not a UI switch.
  data.stats.flowInTop200 = forkRows.filter(row => row.testing.flow).length;
  data.stats.apiOnlyInTop200 = apiOnly;
  // forkInTop200 counts every row with a fork recipe. The honest split (direct, linked,
  // failing-paused) and the pinned forkable denominator live in stats.coverage.
  data.stats.coverage = coverageStats(data);
  applyDisputes(data);
  annotatePerps(data);
  require("./rowStatus").applyRowStatus(data);
  data.methodology = data.methodology || {};
  data.methodology.testnets = TESTNETS;
  data.methodology.chainlinkFaucet = CHAINLINK;
  data.methodology.forkSuite = "npm run fork:all";
  return data;
}

/**
 * Flag rows whose DefiLlama figures a claims run found disputed (data/disputes.json).
 * The score is untouched; the flag is shown on the board and counted in stats.
 */
function applyDisputes(data) {
  let file = null;
  try {
    file = JSON.parse(
      require("fs").readFileSync(require("path").join(__dirname, "..", "..", "data", "disputes.json"), "utf8")
    );
  } catch {
    return;
  }
  const open = (file.disputes || []).filter(item => !item.resolved);
  const byRow = new Map();
  for (const item of open) {
    for (const id of item.rowIds || []) {
      if (!byRow.has(id)) byRow.set(id, []);
      byRow
        .get(id)
        .push({
          id: item.id,
          metric: item.metric,
          claim: item.claim,
          defillama: item.defillama,
          recorded: item.recorded,
        });
    }
  }
  const visit = row => {
    const list = byRow.get(row.id) || [];
    row.dataDisputed = list.length > 0;
    row.disputes = list;
  };
  for (const row of data.overall || []) visit(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) visit(row);
  data.stats.disputed = {
    open: open.length,
    rowsInTop200: (data.overall || []).filter(row => row.dataDisputed).length,
    chainLevel: open.filter(item => !(item.rowIds || []).length).length,
  };
  data.methodology.disputes =
    "data/disputes.json: claim-vs-DefiLlama mismatches. Flagged rows show 'data disputed'; scores are not adjusted.";
}

/**
 * Perp volume is DefiLlama Pro-only (/summary/derivatives returns 402 on the free API).
 * Say so on every perps row instead of implying a volume input: volumeMomentum is the
 * neutral 0.5 and size uses 30d fees when TVL is below the floor. Open interest is not a
 * score input (it is read by the claim monitors only).
 */
const PERPS_NOTE =
  "Perp volume is a paid DefiLlama endpoint (/summary/derivatives, HTTP 402 on the free API), so this row has no volume input: volumeMomentum is the neutral 0.5 and the score leans on TVL and fees. Open interest is read by claim monitors (DEFILLAMA_OI) but is not a score input.";

function annotatePerps(data) {
  const visit = row => {
    if (row.category !== "perps") return;
    row.volumeBasis =
      row.components && row.components.volumeMomentum !== 0.5
        ? "spot/aggregator/options volume"
        : "none (perp volume paywalled)";
    row.volumeNote = PERPS_NOTE;
  };
  for (const row of data.overall || []) visit(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) visit(row);
  data.methodology.perps = PERPS_NOTE;
}

function suitePlans(options = {}) {
  // Slow tests (slow: true) stay registered but are left out of the default fork:all.
  // FORK_SLOW=1 or naming one in FORK_ONLY brings it back.
  const includeSlow = options.includeSlow || /^(1|true|yes)$/i.test(process.env.FORK_SLOW || "");
  const plans = [];
  const seen = new Set();
  for (const entry of FORK_RECIPES) {
    for (const item of entry.tests) {
      if (seen.has(item.script)) continue;
      seen.add(item.script);
      if (item.slow && !includeSlow && !(options.only && options.only.has(item.script))) continue;
      plans.push(item);
    }
  }
  return plans;
}

module.exports = {
  RPC_ENV,
  LOCAL,
  FORK_RECIPES,
  API_ONLY,
  CATEGORY_RECIPES,
  TESTNETS,
  scriptKind,
  attachTesting,
  cleanChainTvl,
  topChainTvl,
  applyProtocolMeta,
  enrichShowcase,
  suitePlans,
};
