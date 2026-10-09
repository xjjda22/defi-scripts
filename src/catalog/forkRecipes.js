/**
 * Fork recipes shown on the showcase and executed by `npm run fork:all`.
 * Commands assume Anvil is started with scripts/startFork.js, then the chain RPC
 * env var points at http://127.0.0.1:8545.
 */

const { contractsForKeys } = require("./contracts");
const { TESTNETS, CHAINLINK } = require("./faucets");

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
    ],
  }),
  recipe({
    keys: ["sushiswap", "sushiswap-v3"],
    appUrl: "https://www.sushi.com/swap",
    chain: "ethereum",
    contractKeys: ["sushiswap"],
    tests: [test("fork:sushiswap:v2", "swap", "ethereum"), test("fork:sushiswap:v3", "swap", "ethereum")],
  }),
  recipe({
    keys: ["balancer", "balancer-v2", "balancer-v3"],
    appUrl: "https://balancer.fi",
    chain: "ethereum",
    contractKeys: ["balancer"],
    tests: [test("fork:balancer:swap", "swap", "ethereum")],
  }),
  recipe({
    keys: ["curve", "curve-dex"],
    appUrl: "https://curve.fi",
    chain: "ethereum",
    contractKeys: ["curve"],
    tests: [test("fork:curve:swap", "swap", "ethereum", "USDC/USDT on 3pool")],
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
    tests: [test("fork:pancakeswap:v3", "swap", "ethereum")],
  }),
  recipe({
    keys: ["monad"],
    appUrl: "https://www.monad.xyz",
    chain: "monad",
    note: "Uniswap V3 on Monad from chains.js. Skipped when MONAD_RPC_URL is unset.",
    tests: [test("fork:monad:v3", "swap", "monad")],
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
    ],
  }),
  recipe({
    keys: ["compound", "compound-finance", "compound-v3"],
    appUrl: "https://app.compound.finance",
    chain: "ethereum",
    contractKeys: ["compound"],
    tests: [test("fork:compound:supply", "supply", "ethereum"), test("fork:compound:borrow", "borrow", "ethereum")],
  }),
  recipe({
    keys: ["morpho", "morpho-blue"],
    appUrl: "https://app.morpho.org",
    chain: "ethereum",
    contractKeys: ["morpho"],
    note: "Supply and borrow on the deepest listed WETH/USDC Morpho Blue market (or MORPHO_MARKET_ID).",
    tests: [test("fork:morpho:supply", "supply", "ethereum"), test("fork:morpho:borrow", "borrow", "ethereum")],
  }),
  recipe({
    keys: ["lido"],
    appUrl: "https://stake.lido.fi",
    chain: "ethereum",
    contractKeys: ["lido"],
    tests: [test("fork:lido:submit", "submit", "ethereum"), test("fork:lido:wrap", "wrap", "ethereum")],
  }),
  recipe({
    keys: ["rocketpool", "rocket-pool"],
    appUrl: "https://stake.rocketpool.net",
    chain: "ethereum",
    contractKeys: ["rocketpool"],
    tests: [test("fork:rocketpool:deposit", "deposit", "ethereum")],
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
    tests: [test("fork:etherfi:deposit", "deposit", "ethereum"), test("fork:etherfi:wrap", "wrap", "ethereum")],
  }),
  recipe({
    keys: ["kelp"],
    appUrl: "https://kelpdao.xyz",
    chain: "ethereum",
    contractKeys: ["kelp"],
    tests: [test("fork:kelp:deposit", "deposit", "ethereum")],
  }),
  recipe({
    keys: ["renzo"],
    appUrl: "https://app.renzoprotocol.com",
    chain: "ethereum",
    contractKeys: ["renzo"],
    tests: [test("fork:renzo:deposit", "deposit", "ethereum")],
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
    ],
  }),
  recipe({
    keys: ["ethena", "ethena-usde", "ethena-usdtb"],
    category: "stable-rwa",
    appUrl: "https://ethena.fi",
    chain: "ethereum",
    contractKeys: ["ethena"],
    note: "Minting USDe is whitelisted, so it is not tested. The public path is staking USDe into sUSDe and starting the cooldown.",
    tests: [test("fork:ethena:stake", "stake", "ethereum"), test("fork:ethena:cooldown", "cooldown", "ethereum")],
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
    tests: [test("fork:frax:rate", "rate", "ethereum")],
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
    note: "KYC-gated: read-only. USDY and OUSG mints are allowlisted. The fork test reads the USDY and OUSG oracles and does not mint.",
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
];

const API_ONLY = [
  {
    keys: ["raydium-amm", "raydium", "raydium-amm-v3"],
    appUrl: "https://raydium.io",
    note: "Raydium is a Solana AMM. The fork suite is EVM-only, so this row stays API-only.",
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
    title: "Generic vault check",
    chain: "ethereum",
    commands: ["npm run simulate:morpho:smoke"],
    note: "Vault curators are API-only. Morpho’s GraphQL smoke is the closest read.",
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
    note: "No dedicated fork script. ether.fi deposit on an Ethereum fork is the restaking recipe.",
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
    if (parts[0] === "simulate" || parts[0] === "analytics" || parts[0] === "swap" || parts[0] === "fork") keys.push(parts[1]);
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
  if (script.startsWith("analytics:") || script.startsWith("crosschain:")) return "analytics";
  if (script.includes(":smoke")) return "smoke";
  if (/^simulate:(uniswapx:fill|aave:(v3:fork|liquidations|versions)|morpho:fork|lido:fork)/.test(script)) return "fork";
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
  row.testing = fork
    ? {
        mode: "fork",
        label: fork.label || null,
        note: fork.note,
        appUrl: fork.appUrl || row.appUrl || null,
        chain: fork.chain,
        rpcEnv: fork.rpcEnv,
        commands: fork.commands,
        tests: fork.tests,
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
        contracts: contractsForKeys(keys),
        recipe: categoryRecipe,
      };
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
    bySlug.set(protocol.slug, { chains, url: protocol.url || null });
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
  };
  for (const row of data.overall || []) visit(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) visit(row);
}

function enrichShowcase(data) {
  for (const row of data.overall || []) attachTesting(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) attachTesting(row);
  const fork = (data.overall || []).filter(row => row.testing && row.testing.mode === "fork").length;
  const apiOnly = (data.overall || []).filter(row => row.testing && row.testing.mode === "api-only").length;
  data.stats = data.stats || {};
  data.stats.forkInTop200 = fork;
  data.stats.apiOnlyInTop200 = apiOnly;
  data.methodology = data.methodology || {};
  data.methodology.testnets = TESTNETS;
  data.methodology.chainlinkFaucet = CHAINLINK;
  data.methodology.forkSuite = "npm run fork:all";
  return data;
}

function suitePlans() {
  const plans = [];
  const seen = new Set();
  for (const entry of FORK_RECIPES) {
    for (const item of entry.tests) {
      if (seen.has(item.script)) continue;
      seen.add(item.script);
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
