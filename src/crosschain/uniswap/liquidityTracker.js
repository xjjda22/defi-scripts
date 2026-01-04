/**
 * Uniswap Liquidity Tracker - On-Chain Analysis
 *
 * PURPOSE: Tracks real-time liquidity flows across Uniswap V2, V3, and V4
 *          by analyzing on-chain events and contract states
 *
 * DATA SOURCES:
 * - Primary: Direct blockchain RPC calls (ethers.js)
 * - Events: Mint/Burn (V2), Increase/DecreaseLiquidity (V3), ModifyLiquidity (V4)
 * - Chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC
 * - Protocols: Uniswap V2, V3, and V4
 *
 * ANALYSIS: Real-time liquidity provision and removal tracking
 *
 * OUTPUT:
 * - Console: Live liquidity flow monitoring
 * - CSV: Historical liquidity event data
 *
 * USAGE: node liquidityTracker.js
 */

require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getProvider, getBlockNumber } = require("../../utils/web3");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

// ================================================================================================
// CONFIGURATION CONSTANTS
// ================================================================================================

/** @type {number} Number of blocks to look back for event analysis */
const BLOCKS_TO_ANALYZE = 1000;

/** @type {number} Maximum number of events to process per run */
const MAX_EVENTS_PER_RUN = 10000;

/** @type {number} Rate limiting delay between contract calls (ms) */
const CONTRACT_CALL_DELAY_MS = 100;

/** @type {Object.<string, Object>} Contract addresses by chain and protocol */
const CONTRACT_ADDRESSES = {
  ethereum: {
    v2Factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    v3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    v3PositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    v4PoolManager: "0x0000000000041264aecF49f4585974C1c1f1C3a3",
  },
  // Add other chains as needed
};

/** @type {Object.<string, number>} Default gas limits for different operations */
const GAS_LIMITS = {
  getReserves: 30000,
  getPool: 50000,
  positions: 100000,
};

// ============================================================================
// ABIs
// ============================================================================

// Uniswap V2 Pair ABI
const PAIR_ABI = [
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

// Uniswap V2 Factory ABI
const V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
];

// Uniswap V3 NFT Position Manager ABI
const POSITION_MANAGER_ABI = [
  "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
];

// Uniswap V3 Factory ABI
const V3_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
];

// Uniswap V4 PoolManager ABI
const POOL_MANAGER_ABI = [
  "event ModifyLiquidity(bytes32 indexed poolId, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta)",
  "event Initialize(bytes32 indexed poolId, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks)",
  "event Swap(bytes32 indexed poolId, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "function getPoolId(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) pure returns (bytes32)",
];

// ERC20 ABI
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

// ================================================================================================
// ANALYSIS CONFIGURATION
// ================================================================================================

/** @type {number} Number of recent blocks to analyze for events */
const BLOCKS_TO_ANALYZE = process.env.BLOCKS_TO_ANALYZE ? parseInt(process.env.BLOCKS_TO_ANALYZE) : 1000;

/** @type {number} Chunk size for processing events in batches */
const CHUNK_SIZE = process.env.CHUNK_SIZE ? parseInt(process.env.CHUNK_SIZE) : 10;

/** @type {number|null} Specific starting block for analysis (optional) */
const START_BLOCK = process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : null;

/** @type {Array<number>} V3 fee tiers in basis points */
const V3_FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

/** @type {Array<number>} V4 fee tiers in basis points */
const V4_FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

// ================================================================================================
// UTILITY FUNCTIONS
// ================================================================================================

/**
 * Retrieves token information (symbol, decimals, name) from contract
 * @param {string} tokenAddress - ERC20 token contract address
 * @param {ethers.Provider} provider - Ethers provider instance
 * @returns {Promise<Object>} Token information object
 */
async function getTokenInfo(tokenAddress, provider) {
  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);
    return { symbol, decimals };
  } catch (error) {
    return { symbol: "UNKNOWN", decimals: 18 };
  }
}

// ============================================================================
// Uniswap V2 Tracking
// ============================================================================

/**
 * Tracks Uniswap V2 liquidity events for a token pair on a specific chain
 * @param {string} chainKey - Chain configuration key
 * @param {string} token0Address - First token contract address
 * @param {string} token1Address - Second token contract address
 * @returns {Promise<Array>} Array of liquidity events
 */
async function trackV2Liquidity(chainKey, token0Address, token1Address) {
  console.log(`[INFO] Analyzing V2 liquidity for ${token0Address}/${token1Address} on ${chainKey}`);

  const chain = CHAINS[chainKey];
  if (!chain || !chain.rpcUrl || !chain.uniswap?.v2?.factory) {
    console.log(`[WARN] V2 not configured for chain: ${chainKey}`);
    return [];
  }

  try {
    const provider = getProvider(chainKey);
    const factory = new ethers.Contract(chain.uniswap.v2.factory, V2_FACTORY_ABI, provider);

    // Get the pair address
    const pairAddress = await factory.getPair(token0Address, token1Address);
    if (pairAddress === ethers.ZeroAddress) {
      console.log(`[INFO] No V2 pair exists for ${token0Address}/${token1Address} on ${chain.name}`);
      return [];
    }

    console.log(`[DEBUG] V2 Pair found: ${pairAddress}`);

    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const currentBlock = await getBlockNumber(chainKey);
    const startBlock = START_BLOCK || Math.max(0, currentBlock - BLOCKS_TO_ANALYZE);
    const endBlock = START_BLOCK ? Math.min(START_BLOCK + BLOCKS_TO_ANALYZE, currentBlock) : currentBlock;

    console.log(`[DEBUG] Analyzing blocks ${startBlock} to ${endBlock}`);

  // Get token info
  const [token0Info, token1Info] = await Promise.all([
    getTokenInfo(token0Address, provider),
    getTokenInfo(token1Address, provider),
  ]);

  const flows = [];
  const allMints = [];
  const allBurns = [];

  for (let fromBlock = startBlock; fromBlock < endBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, endBlock);

    try {
      const [mints, burns] = await Promise.all([
        pair.queryFilter(pair.filters.Mint(), fromBlock, toBlock),
        pair.queryFilter(pair.filters.Burn(), fromBlock, toBlock),
      ]);

      allMints.push(...mints);
      allBurns.push(...burns);

      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (chunkError) {
      console.warn(`      ⚠️  Error querying blocks ${fromBlock}-${toBlock}: ${chunkError.message}`);
    }
  }

  // Process Mint events
  for (const mint of allMints) {
    const amount0 = parseFloat(ethers.formatUnits(mint.args.amount0, token0Info.decimals));
    const amount1 = parseFloat(ethers.formatUnits(mint.args.amount1, token1Info.decimals));
    const block = await provider.getBlock(mint.blockNumber);
    
    flows.push({
      chain: chain.name,
      chainId: chain.chainId,
      version: "V2",
      type: "mint",
      direction: "add",
      pairAddress,
      token0: token0Info.symbol,
      token1: token1Info.symbol,
      amount0,
      amount1,
      txHash: mint.transactionHash,
      block: mint.blockNumber,
      timestamp: block.timestamp,
      explorer: chain.explorer,
    });
  }

  // Process Burn events
  for (const burn of allBurns) {
    const amount0 = parseFloat(ethers.formatUnits(burn.args.amount0, token0Info.decimals));
    const amount1 = parseFloat(ethers.formatUnits(burn.args.amount1, token1Info.decimals));
    const block = await provider.getBlock(burn.blockNumber);
    
    flows.push({
      chain: chain.name,
      chainId: chain.chainId,
      version: "V2",
      type: "burn",
      direction: "remove",
      pairAddress,
      token0: token0Info.symbol,
      token1: token1Info.symbol,
      amount0,
      amount1,
      txHash: burn.transactionHash,
      block: burn.blockNumber,
      timestamp: block.timestamp,
      explorer: chain.explorer,
    });
  }

  return flows;
}

// ============================================================================
// Uniswap V3 Tracking
// ============================================================================

async function trackV3Liquidity(chainKey, token0Address, token1Address, feeTier) {
  const chain = CHAINS[chainKey];
  if (!chain || !chain.rpcUrl || !chain.uniswap?.v3?.factory || !chain.uniswap?.v3?.nftPositionManager) {
    return [];
  }

  const provider = getProvider(chainKey);
  const factory = new ethers.Contract(chain.uniswap.v3.factory, V3_FACTORY_ABI, provider);

  // Get the pool address for this fee tier
  const poolAddress = await factory.getPool(token0Address, token1Address, feeTier);
  if (poolAddress === ethers.ZeroAddress) {
    return [];
  }

  console.log(`   📍 V3 Pool: ${poolAddress} (Fee: ${feeTier / 10000}%)`);

  const positionManager = new ethers.Contract(
    chain.uniswap.v3.nftPositionManager,
    POSITION_MANAGER_ABI,
    provider
  );

  const currentBlock = await getBlockNumber(chainKey);
  const startBlock = START_BLOCK || Math.max(0, currentBlock - BLOCKS_TO_ANALYZE);
  const endBlock = START_BLOCK ? Math.min(START_BLOCK + BLOCKS_TO_ANALYZE, currentBlock) : currentBlock;

  // Get token info
  const [token0Info, token1Info] = await Promise.all([
    getTokenInfo(token0Address, provider),
    getTokenInfo(token1Address, provider),
  ]);

  const flows = [];
  const allIncreases = [];
  const allDecreases = [];

  for (let fromBlock = startBlock; fromBlock < endBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, endBlock);

    try {
      const [increases, decreases] = await Promise.all([
        positionManager.queryFilter(
          positionManager.filters.IncreaseLiquidity(),
          fromBlock,
          toBlock
        ),
        positionManager.queryFilter(
          positionManager.filters.DecreaseLiquidity(),
          fromBlock,
          toBlock
        ),
      ]);

      allIncreases.push(...increases);
      allDecreases.push(...decreases);

      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (chunkError) {
      console.warn(`      ⚠️  Error querying blocks ${fromBlock}-${toBlock}: ${chunkError.message}`);
    }
  }

  // Process IncreaseLiquidity events
  for (const increase of allIncreases) {
    const amount0 = parseFloat(ethers.formatUnits(increase.args.amount0, token0Info.decimals));
    const amount1 = parseFloat(ethers.formatUnits(increase.args.amount1, token1Info.decimals));
    const liquidity = increase.args.liquidity.toString();
    const block = await provider.getBlock(increase.blockNumber);

    flows.push({
      chain: chain.name,
      chainId: chain.chainId,
      version: "V3",
      type: "increase",
      direction: "add",
      poolAddress,
      feeTier: feeTier / 10000,
      tokenId: increase.args.tokenId.toString(),
      token0: token0Info.symbol,
      token1: token1Info.symbol,
      amount0,
      amount1,
      liquidity,
      txHash: increase.transactionHash,
      block: increase.blockNumber,
      timestamp: block.timestamp,
      explorer: chain.explorer,
    });
  }

  // Process DecreaseLiquidity events
  for (const decrease of allDecreases) {
    const amount0 = parseFloat(ethers.formatUnits(decrease.args.amount0, token0Info.decimals));
    const amount1 = parseFloat(ethers.formatUnits(decrease.args.amount1, token1Info.decimals));
    const liquidity = decrease.args.liquidity.toString();
    const block = await provider.getBlock(decrease.blockNumber);

    flows.push({
      chain: chain.name,
      chainId: chain.chainId,
      version: "V3",
      type: "decrease",
      direction: "remove",
      poolAddress,
      feeTier: feeTier / 10000,
      tokenId: decrease.args.tokenId.toString(),
      token0: token0Info.symbol,
      token1: token1Info.symbol,
      amount0,
      amount1,
      liquidity,
      txHash: decrease.transactionHash,
      block: decrease.blockNumber,
      timestamp: block.timestamp,
      explorer: chain.explorer,
    });
  }

  return flows;
}

async function trackV3AllFeeTiers(chainKey, token0Address, token1Address) {
  const allFlows = [];
  
  for (const feeTier of V3_FEE_TIERS) {
    try {
      const flows = await trackV3Liquidity(chainKey, token0Address, token1Address, feeTier);
      allFlows.push(...flows);
    } catch (error) {
      console.warn(`   ⚠️  Error tracking V3 fee tier ${feeTier}:`, error.message);
    }
  }
  
  return allFlows;
}

// ============================================================================
// Uniswap V4 Tracking
// ============================================================================

async function trackV4Liquidity(chainKey, token0Address, token1Address) {
  const chain = CHAINS[chainKey];
  if (!chain || !chain.rpcUrl || !chain.uniswap?.v4?.poolManager) {
    return [];
  }

  const provider = getProvider(chainKey);
  const poolManager = new ethers.Contract(
    chain.uniswap.v4.poolManager,
    POOL_MANAGER_ABI,
    provider
  );

  const currentBlock = await getBlockNumber(chainKey);
  const startBlock = START_BLOCK || Math.max(0, currentBlock - BLOCKS_TO_ANALYZE);
  const endBlock = START_BLOCK ? Math.min(START_BLOCK + BLOCKS_TO_ANALYZE, currentBlock) : currentBlock;

  console.log(`   📍 V4 PoolManager: ${chain.uniswap.v4.poolManager}`);

  // Get token info
  const [token0Info, token1Info] = await Promise.all([
    getTokenInfo(token0Address, provider),
    getTokenInfo(token1Address, provider),
  ]);

  const flows = [];
  const allModifyLiquidity = [];

  for (let fromBlock = startBlock; fromBlock < endBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, endBlock);

    try {
      const modifyEvents = await poolManager.queryFilter(
        poolManager.filters.ModifyLiquidity(),
        fromBlock,
        toBlock
      );

      allModifyLiquidity.push(...modifyEvents);

      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (chunkError) {
      console.warn(`      ⚠️  Error querying blocks ${fromBlock}-${toBlock}: ${chunkError.message}`);
    }
  }

  // Process ModifyLiquidity events
  for (const event of allModifyLiquidity) {
    const liquidityDelta = event.args.liquidityDelta;
    const isIncrease = liquidityDelta > 0n;
    const block = await provider.getBlock(event.blockNumber);

    flows.push({
      chain: chain.name,
      chainId: chain.chainId,
      version: "V4",
      type: isIncrease ? "increase" : "decrease",
      direction: isIncrease ? "add" : "remove",
      poolId: event.args.poolId,
      sender: event.args.sender,
      tickLower: event.args.tickLower,
      tickUpper: event.args.tickUpper,
      liquidityDelta: liquidityDelta.toString(),
      token0: token0Info.symbol,
      token1: token1Info.symbol,
      txHash: event.transactionHash,
      block: event.blockNumber,
      timestamp: block.timestamp,
      explorer: chain.explorer,
    });
  }

  return flows;
}

async function trackV4Initialize(chainKey) {
  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v4?.poolManager) {
    return [];
  }

  const provider = getProvider(chainKey);
  const poolManager = new ethers.Contract(
    chain.uniswap.v4.poolManager,
    POOL_MANAGER_ABI,
    provider
  );

  const currentBlock = await getBlockNumber(chainKey);
  const startBlock = START_BLOCK || Math.max(0, currentBlock - BLOCKS_TO_ANALYZE);
  const endBlock = START_BLOCK ? Math.min(START_BLOCK + BLOCKS_TO_ANALYZE, currentBlock) : currentBlock;

  const allInitializations = [];

  for (let fromBlock = startBlock; fromBlock < endBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, endBlock);

    try {
      const initEvents = await poolManager.queryFilter(
        poolManager.filters.Initialize(),
        fromBlock,
        toBlock
      );

      allInitializations.push(...initEvents);
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (chunkError) {
      console.warn(`      ⚠️  Error querying blocks ${fromBlock}-${toBlock}: ${chunkError.message}`);
    }
  }

  const pools = [];
  for (const event of allInitializations) {
    const block = await provider.getBlock(event.blockNumber);
    const token0Info = await getTokenInfo(event.args.currency0, provider);
    const token1Info = await getTokenInfo(event.args.currency1, provider);

    pools.push({
      chain: chain.name,
      poolId: event.args.poolId,
      token0: token0Info.symbol,
      token1: token1Info.symbol,
      token0Address: event.args.currency0,
      token1Address: event.args.currency1,
      fee: event.args.fee,
      feeTier: event.args.fee / 10000,
      tickSpacing: event.args.tickSpacing,
      hooks: event.args.hooks,
      txHash: event.transactionHash,
      block: event.blockNumber,
      timestamp: block.timestamp,
    });
  }

  return pools;
}

// ============================================================================
// Unified Tracking
// ============================================================================

async function trackAllVersions(chainKey, token0Address, token1Address) {
  console.log(`\n   🔄 Processing ${CHAINS[chainKey]?.name || chainKey}...`);

  const allFlows = [];

  // Track V2
  try {
    console.log(`      📦 V2...`);
    const v2Flows = await trackV2Liquidity(chainKey, token0Address, token1Address);
    allFlows.push(...v2Flows);
    console.log(`      ✅ V2: ${v2Flows.length} events`);
  } catch (error) {
    console.warn(`      ⚠️  V2 Error: ${error.message}`);
  }

  // Track V3 (all fee tiers)
  try {
    console.log(`      📦 V3...`);
    const v3Flows = await trackV3AllFeeTiers(chainKey, token0Address, token1Address);
    allFlows.push(...v3Flows);
    console.log(`      ✅ V3: ${v3Flows.length} events`);
  } catch (error) {
    console.warn(`      ⚠️  V3 Error: ${error.message}`);
  }

  // Track V4
  try {
    console.log(`      📦 V4...`);
    const v4Flows = await trackV4Liquidity(chainKey, token0Address, token1Address);
    allFlows.push(...v4Flows);
    console.log(`      ✅ V4: ${v4Flows.length} events`);
  } catch (error) {
    console.warn(`      ⚠️  V4 Error: ${error.message}`);
  }

  return allFlows;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generates comprehensive liquidity tracking report
 * @returns {Promise<void>}
 */
async function generateReport() {
  // Display header
  printUniswapLogo("full");
  console.log(`\n🦄 UNISWAP LIQUIDITY TRACKER - ON-CHAIN ANALYSIS`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Purpose: Real-time liquidity flow tracking via blockchain events`);
  console.log(`Protocols: Uniswap V2, V3, V4`);
  console.log(`Data Source: Direct blockchain RPC calls`);
  console.log(`Analysis: ${BLOCKS_TO_ANALYZE} blocks back from latest`);
  console.log(``);

  console.log(`[INFO] Starting comprehensive liquidity analysis across all chains`);
  console.log(`ℹ️  Analyzing last ${BLOCKS_TO_ANALYZE} blocks per chain\n`);

  const allFlows = [];
  const chainsToTrack = ["ethereum", "arbitrum", "optimism", "base", "polygon", "bsc"];

  // Track WETH/USDC pair as primary example
  const tokenPair = { symbol: "WETH/USDC", token0: "WETH", token1: "USDC" };
  
  console.log(`\n💎 Tracking ${tokenPair.symbol} Liquidity Flows...\n`);

  for (const chainKey of chainsToTrack) {
    const chain = CHAINS[chainKey];
    if (!chain?.rpcUrl) {
      console.log(`⏭️  Skipping ${chainKey} (no RPC configured)`);
      continue;
    }

    const token0Address = COMMON_TOKENS[tokenPair.token0]?.[chainKey];
    const token1Address = COMMON_TOKENS[tokenPair.token1]?.[chainKey];

    if (!token0Address || !token1Address) {
      console.log(`⏭️  Skipping ${chain.name} (tokens not configured)`);
      continue;
    }

    try {
      const flows = await trackAllVersions(chainKey, token0Address, token1Address);
      allFlows.push(...flows.map((f) => ({ ...f, pair: tokenPair.symbol })));
      console.log(`   ✅ ${chain.name}: ${flows.length} total liquidity events\n`);
    } catch (error) {
      console.error(`   ❌ Error on ${chain.name}:`, error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    }
  }

  if (allFlows.length === 0) {
    console.log(`\n✅ No liquidity flows detected in analyzed blocks.\n`);
    console.log(`💡 Try increasing BLOCKS_TO_ANALYZE or using START_BLOCK to analyze different periods.\n`);
    return;
  }

  // Get token prices for USD valuation
  const prices = await axios
    .get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: "ethereum,usd-coin",
        vs_currencies: "usd",
      },
    })
    .then((res) => ({
      WETH: res.data.ethereum.usd,
      USDC: res.data["usd-coin"].usd,
    }))
    .catch(() => ({ WETH: 3000, USDC: 1 }));

  console.log(`\n💰 Current Prices: WETH $${prices.WETH.toLocaleString()}, USDC $${prices.USDC}\n`);

  // Calculate comprehensive statistics
  const stats = {
    total: allFlows.length,
    byVersion: {},
    byChain: {},
    byDirection: { add: 0, remove: 0 },
    totalValueUSD: 0,
  };

  // Group by version
  for (const flow of allFlows) {
    const version = flow.version || "Unknown";
    if (!stats.byVersion[version]) {
      stats.byVersion[version] = { add: 0, remove: 0, count: 0 };
    }
    stats.byVersion[version][flow.direction]++;
    stats.byVersion[version].count++;

    // Group by chain
    if (!stats.byChain[flow.chain]) {
      stats.byChain[flow.chain] = { add: 0, remove: 0, count: 0 };
    }
    stats.byChain[flow.chain][flow.direction]++;
    stats.byChain[flow.chain].count++;

    // Overall direction
    stats.byDirection[flow.direction]++;

    // Calculate USD value (simplified)
    if (flow.amount0 && flow.amount1) {
      const value0 = flow.amount0 * prices[flow.token0] || 0;
      const value1 = flow.amount1 * prices[flow.token1] || 0;
      stats.totalValueUSD += (value0 + value1) / 2; // Average to avoid double counting
    }
  }

  // Print Summary
  console.log(`\n📈 Liquidity Flow Summary:\n`);
  console.log(`   Total Events: ${stats.total}`);
  console.log(`   Add Liquidity: ${stats.byDirection.add}`);
  console.log(`   Remove Liquidity: ${stats.byDirection.remove}`);
  console.log(`   Net Flow: ${stats.byDirection.add - stats.byDirection.remove > 0 ? "+" : ""}${stats.byDirection.add - stats.byDirection.remove}`);
  console.log(`   Total Volume: ${formatUSD(stats.totalValueUSD)}\n`);

  // Print by Version
  console.log(`📊 By Uniswap Version:\n`);
  const versionOrder = ["V2", "V3", "V4"];
  for (const version of versionOrder) {
    const data = stats.byVersion[version];
    if (data) {
      const netFlow = data.add - data.remove;
      console.log(`   ${version}:`);
      console.log(`      Events: ${data.count}`);
      console.log(`      Add: ${data.add}, Remove: ${data.remove}`);
      console.log(`      Net: ${netFlow > 0 ? "+" : ""}${netFlow}\n`);
    }
  }

  // Print by Chain
  console.log(`🌐 By Chain:\n`);
  const sortedChains = Object.entries(stats.byChain)
    .sort((a, b) => b[1].count - a[1].count);

  for (const [chain, data] of sortedChains) {
    const netFlow = data.add - data.remove;
    console.log(`   ${chain}:`);
    console.log(`      Events: ${data.count}`);
    console.log(`      Add: ${data.add}, Remove: ${data.remove}`);
    console.log(`      Net: ${netFlow > 0 ? "+" : ""}${netFlow}\n`);
  }

  // Print Version-Chain Matrix
  console.log(`📋 Version × Chain Matrix:\n`);
  const matrix = {};
  for (const flow of allFlows) {
    const key = `${flow.chain}-${flow.version}`;
    matrix[key] = (matrix[key] || 0) + 1;
  }

  const matrixTable = {};
  for (const chain of Object.keys(stats.byChain)) {
    matrixTable[chain] = {};
    for (const version of versionOrder) {
      matrixTable[chain][version] = matrix[`${chain}-${version}`] || 0;
    }
  }

  for (const [chain, versions] of Object.entries(matrixTable)) {
    console.log(`   ${chain}: V2=${versions.V2}, V3=${versions.V3}, V4=${versions.V4}`);
  }

  // Export to CSV
  const csvData = allFlows.map((flow) => ({
    chain: flow.chain,
    chainId: flow.chainId,
    version: flow.version,
    pair: flow.pair || `${flow.token0}/${flow.token1}`,
    type: flow.type,
    direction: flow.direction,
    token0: flow.token0,
    token1: flow.token1,
    amount0: flow.amount0 || "",
    amount1: flow.amount1 || "",
    liquidity: flow.liquidity || flow.liquidityDelta || "",
    feeTier: flow.feeTier || "",
    tokenId: flow.tokenId || "",
    poolId: flow.poolId || "",
    pairAddress: flow.pairAddress || flow.poolAddress || "",
    txHash: flow.txHash,
    block: flow.block,
    timestamp: new Date(flow.timestamp * 1000).toISOString(),
    explorerLink: `${flow.explorer}/tx/${flow.txHash}`,
  }));

  await writeCSV(
    "output/uniswap-liquidity-flows-all.csv",
    [
      { id: "chain", title: "Chain" },
      { id: "chainId", title: "Chain ID" },
      { id: "version", title: "Version" },
      { id: "pair", title: "Pair" },
      { id: "type", title: "Type" },
      { id: "direction", title: "Direction" },
      { id: "token0", title: "Token0" },
      { id: "token1", title: "Token1" },
      { id: "amount0", title: "Amount0" },
      { id: "amount1", title: "Amount1" },
      { id: "liquidity", title: "Liquidity" },
      { id: "feeTier", title: "Fee Tier" },
      { id: "tokenId", title: "Token ID" },
      { id: "poolId", title: "Pool ID" },
      { id: "pairAddress", title: "Pair/Pool Address" },
      { id: "txHash", title: "Tx Hash" },
      { id: "block", title: "Block" },
      { id: "timestamp", title: "Timestamp" },
      { id: "explorerLink", title: "Explorer Link" },
    ],
    csvData
  );

  console.log(`\n✅ Unified report generated: output/uniswap-liquidity-flows-all.csv\n`);

  // Generate summary CSV
  const summaryData = [
    ...Object.entries(stats.byChain).map(([chain, data]) => ({
      category: "Chain",
      name: chain,
      add: data.add,
      remove: data.remove,
      net: data.add - data.remove,
      total: data.count,
    })),
    ...Object.entries(stats.byVersion).map(([version, data]) => ({
      category: "Version",
      name: version,
      add: data.add,
      remove: data.remove,
      net: data.add - data.remove,
      total: data.count,
    })),
  ];

  await writeCSV(
    "output/uniswap-liquidity-summary.csv",
    [
      { id: "category", title: "Category" },
      { id: "name", title: "Name" },
      { id: "add", title: "Add Liquidity" },
      { id: "remove", title: "Remove Liquidity" },
      { id: "net", title: "Net Flow" },
      { id: "total", title: "Total Events" },
    ],
    summaryData
  );

  console.log(`✅ Summary report: output/uniswap-liquidity-summary.csv\n`);
}

// ============================================================================
// Main
// ============================================================================

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = {
  // V2 exports
  trackV2Liquidity,
  
  // V3 exports
  trackV3Liquidity,
  trackV3AllFeeTiers,
  
  // V4 exports
  trackV4Liquidity,
  trackV4Initialize,
  
  // Unified exports
  trackAllVersions,
  generateReport,
};
