// Trading pair configurations for analytics scripts
// All pairs are predefined here for consistency

/**
 * Major trading pairs for analytics
 * Each pair has a name and the tokens involved
 */
const MAJOR_PAIRS = {
  // === ETH Pairs (Most Liquid) ===
  "WETH/USDC": {
    name: "WETH/USDC",
    tokenIn: "WETH",
    tokenOut: "USDC",
    amount: "1",
    category: "eth",
    description: "Main ETH/USD pair",
  },
  "WETH/USDT": {
    name: "WETH/USDT",
    tokenIn: "WETH",
    tokenOut: "USDT",
    amount: "1",
    category: "eth",
    description: "Alternative ETH/USD pair",
  },
  "WETH/DAI": {
    name: "WETH/DAI",
    tokenIn: "WETH",
    tokenOut: "DAI",
    amount: "1",
    category: "eth",
    description: "ETH/DAI pair",
  },

  // === Stablecoin Pairs ===
  "USDC/USDT": {
    name: "USDC/USDT",
    tokenIn: "USDC",
    tokenOut: "USDT",
    amount: "1000",
    category: "stable",
    description: "Main stablecoin pair",
  },
  "USDC/DAI": {
    name: "USDC/DAI",
    tokenIn: "USDC",
    tokenOut: "DAI",
    amount: "1000",
    category: "stable",
    description: "USDC/DAI stablecoin pair",
  },
  "USDT/DAI": {
    name: "USDT/DAI",
    tokenIn: "USDT",
    tokenOut: "DAI",
    amount: "1000",
    category: "stable",
    description: "USDT/DAI stablecoin pair",
  },

  // === BTC Pairs ===
  "WBTC/USDC": {
    name: "WBTC/USDC",
    tokenIn: "WBTC",
    tokenOut: "USDC",
    amount: "0.1",
    category: "btc",
    description: "Bitcoin/USD pair",
  },
  "WBTC/WETH": {
    name: "WBTC/WETH",
    tokenIn: "WBTC",
    tokenOut: "WETH",
    amount: "0.1",
    category: "btc",
    description: "Bitcoin/Ethereum pair",
  },
  "WBTC/USDT": {
    name: "WBTC/USDT",
    tokenIn: "WBTC",
    tokenOut: "USDT",
    amount: "0.1",
    category: "btc",
    description: "Bitcoin/USDT pair",
  },

  // === DeFi Blue Chips vs USD ===
  "UNI/USDC": {
    name: "UNI/USDC",
    tokenIn: "UNI",
    tokenOut: "USDC",
    amount: "100",
    category: "defi",
    description: "Uniswap token/USD",
  },
  "UNI/WETH": {
    name: "UNI/WETH",
    tokenIn: "UNI",
    tokenOut: "WETH",
    amount: "100",
    category: "defi",
    description: "Uniswap token/ETH",
  },
  "LINK/USDC": {
    name: "LINK/USDC",
    tokenIn: "LINK",
    tokenOut: "USDC",
    amount: "50",
    category: "defi",
    description: "Chainlink/USD pair",
  },
  "LINK/WETH": {
    name: "LINK/WETH",
    tokenIn: "LINK",
    tokenOut: "WETH",
    amount: "50",
    category: "defi",
    description: "Chainlink/ETH pair",
  },
  "AAVE/USDC": {
    name: "AAVE/USDC",
    tokenIn: "AAVE",
    tokenOut: "USDC",
    amount: "5",
    category: "defi",
    description: "Aave/USD pair",
  },
  "AAVE/WETH": {
    name: "AAVE/WETH",
    tokenIn: "AAVE",
    tokenOut: "WETH",
    amount: "5",
    category: "defi",
    description: "Aave/ETH pair",
  },
  "MKR/USDC": {
    name: "MKR/USDC",
    tokenIn: "MKR",
    tokenOut: "USDC",
    amount: "0.5",
    category: "defi",
    description: "Maker/USD pair",
  },
  "CRV/USDC": {
    name: "CRV/USDC",
    tokenIn: "CRV",
    tokenOut: "USDC",
    amount: "500",
    category: "defi",
    description: "Curve/USD pair",
  },
  "CRV/WETH": {
    name: "CRV/WETH",
    tokenIn: "CRV",
    tokenOut: "WETH",
    amount: "500",
    category: "defi",
    description: "Curve/ETH pair",
  },
  "LDO/USDC": {
    name: "LDO/USDC",
    tokenIn: "LDO",
    tokenOut: "USDC",
    amount: "200",
    category: "defi",
    description: "Lido/USD pair",
  },
  "LDO/WETH": {
    name: "LDO/WETH",
    tokenIn: "LDO",
    tokenOut: "WETH",
    amount: "200",
    category: "defi",
    description: "Lido/ETH pair",
  },

  // === Liquid Staking Derivatives ===
  "wstETH/WETH": {
    name: "wstETH/WETH",
    tokenIn: "wstETH",
    tokenOut: "WETH",
    amount: "1",
    category: "lst",
    description: "Lido staked ETH/ETH",
  },
  "wstETH/USDC": {
    name: "wstETH/USDC",
    tokenIn: "wstETH",
    tokenOut: "USDC",
    amount: "1",
    category: "lst",
    description: "Lido staked ETH/USD",
  },
  "rETH/WETH": {
    name: "rETH/WETH",
    tokenIn: "rETH",
    tokenOut: "WETH",
    amount: "1",
    category: "lst",
    description: "Rocket Pool ETH/ETH",
  },
  // Note: rETH/USDC removed - no direct liquidity (use rETH/WETH instead)
};

/**
 * Quick access pair groups
 */
const PAIR_GROUPS = {
  // Most important pairs for daily monitoring (8 pairs: major liquidity)
  default: ["WETH/USDC", "WETH/USDT", "WETH/DAI", "WBTC/USDC", "WBTC/WETH", "USDC/USDT", "USDC/DAI", "wstETH/WETH"],

  // ETH pairs (3 pairs)
  eth: ["WETH/USDC", "WETH/USDT", "WETH/DAI"],

  // Stablecoin pairs (3 pairs)
  stable: ["USDC/USDT", "USDC/DAI", "USDT/DAI"],

  // BTC pairs (3 pairs)
  btc: ["WBTC/USDC", "WBTC/WETH", "WBTC/USDT"],

  // DeFi blue chips (10 pairs)
  defi: [
    "UNI/USDC",
    "UNI/WETH",
    "LINK/USDC",
    "LINK/WETH",
    "AAVE/USDC",
    "AAVE/WETH",
    "MKR/USDC",
    "CRV/USDC",
    "CRV/WETH",
    "LDO/USDC",
    "LDO/WETH",
  ],

  // Liquid staking tokens (3 pairs - removed rETH/USDC, no direct liquidity)
  lst: ["wstETH/WETH", "wstETH/USDC", "rETH/WETH"],

  // Major pairs (ETH + BTC + top 2 stables = 8 pairs)
  major: ["WETH/USDC", "WETH/USDT", "WETH/DAI", "WBTC/USDC", "WBTC/WETH", "USDC/USDT", "USDC/DAI", "USDT/DAI"],

  // All pairs (25 total)
  all: Object.keys(MAJOR_PAIRS),
};

/**
 * Get pair configuration by name
 */
function getPair(pairName) {
  const pair = MAJOR_PAIRS[pairName];
  if (!pair) {
    throw new Error(`Unknown pair: ${pairName}. Available pairs: ${Object.keys(MAJOR_PAIRS).join(", ")}`);
  }
  return pair;
}

/**
 * Get multiple pairs by group name
 */
function getPairGroup(groupName = "default") {
  const group = PAIR_GROUPS[groupName];
  if (!group) {
    throw new Error(`Unknown group: ${groupName}. Available groups: ${Object.keys(PAIR_GROUPS).join(", ")}`);
  }
  return group.map(pairName => MAJOR_PAIRS[pairName]);
}

/**
 * Get all pairs
 */
function getAllPairs() {
  return Object.values(MAJOR_PAIRS);
}

/**
 * Get pairs by category
 */
function getPairsByCategory(category) {
  return Object.values(MAJOR_PAIRS).filter(pair => pair.category === category);
}

/**
 * Check if pair exists
 */
function hasPair(pairName) {
  return MAJOR_PAIRS.hasOwnProperty(pairName);
}

module.exports = {
  MAJOR_PAIRS,
  PAIR_GROUPS,
  getPair,
  getPairGroup,
  getAllPairs,
  getPairsByCategory,
  hasPair,
};
