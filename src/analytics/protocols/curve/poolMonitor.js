#!/usr/bin/env node

/**
 * Curve Pool Monitor
 * 
 * Monitors Curve pool states including:
 * - Virtual price (LP token value)
 * - Pool balances & composition
 * - APY (base fees + CRV rewards)
 * - Balance health & arbitrage opportunities
 * 
 * Usage:
 *   npm run analytics:curve:pools [chain] [poolName]
 *   npm run analytics:curve:pools ethereum 3pool
 *   npm run analytics:curve:pools --help
 */

const { ethers } = require("ethers");
const axios = require("axios");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const { getProvider, getContract } = require("../../../utils/web3");
const {
  printHeader,
  printSection,
  createTable,
  formatCurrency,
  formatPercent,
  printInsight,
  formatNumber,
} = require("../../utils/displayHelpers");

// ABIs
const CURVE_POOL_ABI = require("../../../abis/CurvePool.json");
const ERC20_ABI = require("../../../abis/IERC20.json");

// Curve API endpoints
const CURVE_API_BASE = "https://api.curve.fi/api";

/**
 * Fetch pool state from on-chain
 */
async function getPoolState(chainKey, poolAddress, numCoins) {
  const provider = getProvider(chainKey);
  const pool = new ethers.Contract(poolAddress, CURVE_POOL_ABI, provider);

  try {
    // Fetch pool data in parallel
    const [virtualPrice, fee, adminFee, ...balances] = await Promise.all([
      pool.get_virtual_price(),
      pool.fee().catch(() => null),
      pool.admin_fee().catch(() => null),
      ...Array.from({ length: numCoins }, (_, i) => 
        pool.balances(i).catch(() => BigInt(0))
      ),
    ]);

    return {
      virtualPrice: virtualPrice.toString(),
      fee: fee ? fee.toString() : null,
      adminFee: adminFee ? adminFee.toString() : null,
      balances: balances.map(b => b.toString()),
    };
  } catch (error) {
    console.error(`Error fetching pool state: ${error.message}`);
    return null;
  }
}

/**
 * Fetch coin decimals for balance formatting
 */
async function getCoinDecimals(chainKey, poolAddress, numCoins) {
  const provider = getProvider(chainKey);
  const pool = new ethers.Contract(poolAddress, CURVE_POOL_ABI, provider);

  try {
    const coins = await Promise.all(
      Array.from({ length: numCoins }, (_, i) => pool.coins(i))
    );

    const decimals = await Promise.all(
      coins.map(async (coinAddress) => {
        // Handle ETH (native) - Curve uses 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
        if (coinAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
          return 18;
        }
        
        try {
          const token = new ethers.Contract(coinAddress, ERC20_ABI, provider);
          return await token.decimals();
        } catch (err) {
          // If decimals() call fails, default to 18
          return 18;
        }
      })
    );

    return decimals;
  } catch (error) {
    console.error(`Error fetching coin decimals: ${error.message}`);
    return Array(numCoins).fill(18); // Default to 18 decimals
  }
}

/**
 * Fetch APY data from Curve API
 */
async function getPoolAPY(chainKey, poolAddress) {
  try {
    const response = await axios.get(`${CURVE_API_BASE}/getPools/${chainKey}/main`, {
      timeout: 10000,
    });

    const poolData = response.data?.data?.poolData?.find(
      (p) => p.address?.toLowerCase() === poolAddress.toLowerCase()
    );

    if (!poolData) {
      return { baseApy: null, crvApy: null, totalApy: null };
    }

    return {
      baseApy: poolData.baseApy || poolData.apy || null,
      crvApy: poolData.rewardApy || poolData.crvApy || null,
      totalApy: poolData.totalApy || null,
    };
  } catch (error) {
    // API failures are non-critical, continue without APY
    return { baseApy: null, crvApy: null, totalApy: null };
  }
}

/**
 * Calculate balance percentages and detect imbalances
 */
function analyzeBalances(balances, decimals, coinNames) {
  const formattedBalances = balances.map((balance, i) => 
    parseFloat(ethers.formatUnits(balance, decimals[i]))
  );

  const totalValue = formattedBalances.reduce((sum, b) => sum + b, 0);
  
  const percentages = formattedBalances.map((balance) => 
    totalValue > 0 ? (balance / totalValue) * 100 : 0
  );

  // Ideal percentage for equal-weight pools
  const idealPercentage = 100 / balances.length;
  const maxDeviation = Math.max(...percentages.map(p => Math.abs(p - idealPercentage)));

  // Determine balance health
  let balanceStatus;
  let balanceEmoji;
  if (maxDeviation < 5) {
    balanceStatus = "Balanced";
    balanceEmoji = "✅";
  } else if (maxDeviation < 10) {
    balanceStatus = "Slightly Imbalanced";
    balanceEmoji = "⚠️";
  } else {
    balanceStatus = "Imbalanced";
    balanceEmoji = "🔴";
  }

  // Find most overweight coin
  const maxPercentageIndex = percentages.indexOf(Math.max(...percentages));
  const overweightCoin = maxPercentageIndex >= 0 ? coinNames[maxPercentageIndex] : null;

  return {
    percentages,
    formattedBalances,
    totalValue,
    balanceStatus,
    balanceEmoji,
    maxDeviation,
    overweightCoin,
    idealPercentage,
  };
}

/**
 * Monitor a single Curve pool
 */
async function monitorPool(chainKey, poolInfo) {
  const { name, address, coins } = poolInfo;
  
  const version = poolInfo.version || "V1";
  const poolType = poolInfo.type || "Unknown";
  
  console.log(`\n${name} [${version} - ${poolType}]`);
  console.log("─".repeat(50));

  // Fetch pool state
  const poolState = await getPoolState(chainKey, address, coins.length);
  if (!poolState) {
    console.log("❌ Failed to fetch pool state");
    return;
  }

  // Fetch coin decimals
  const decimals = await getCoinDecimals(chainKey, address, coins.length);

  // Fetch APY data
  const apyData = await getPoolAPY(chainKey, address);

  // Analyze balances
  const balanceAnalysis = analyzeBalances(poolState.balances, decimals, coins);

  // Display virtual price
  const virtualPrice = parseFloat(ethers.formatUnits(poolState.virtualPrice, 18));
  console.log(`  Virtual Price: ${virtualPrice.toFixed(4)}`);

  // Display APY
  if (apyData.baseApy !== null || apyData.crvApy !== null) {
    const baseStr = apyData.baseApy !== null ? formatPercent(apyData.baseApy, 2) : "N/A";
    const crvStr = apyData.crvApy !== null ? formatPercent(apyData.crvApy, 2) : "N/A";
    console.log(`  APY: ${baseStr} (base) + ${crvStr} (CRV)`);
  } else {
    console.log(`  APY: Data unavailable`);
  }

  // Display balance composition
  console.log(`  Balance: ${coins.map((coin, i) => 
    `${formatPercent(balanceAnalysis.percentages[i], 1)}`
  ).join(" / ")} ${balanceAnalysis.balanceEmoji} ${balanceAnalysis.balanceStatus}`);

  // Display insights
  if (balanceAnalysis.maxDeviation > 5) {
    const deviationPct = (balanceAnalysis.maxDeviation / balanceAnalysis.idealPercentage) * 100;
    console.log(`  💡 ${balanceAnalysis.overweightCoin} is overweight (+${deviationPct.toFixed(1)}%)`);
    console.log(`  💡 Arb: Sell ${balanceAnalysis.overweightCoin} to pool for premium`);
  }

  // Display fee
  if (poolState.fee) {
    const feePercent = (parseInt(poolState.fee) / 1e10).toFixed(2);
    console.log(`  Fee: ${feePercent}%`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // Help command
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Curve Pool Monitor - Monitor Curve pool states and APYs

Usage:
  npm run analytics:curve:pools

Monitors all configured pools:
  - 3pool (USDC/USDT/DAI) [V1 - StableSwap]
  - TriCrypto2 (USDT/WBTC/WETH) [V2 - Crypto]
  - stETH/ETH [V1 - StableSwap]

Configuration:
  - Chain: Ethereum (hardcoded)
  - Pools: src/config/chains.js (curve.pools)
  - To add pools: Edit src/config/chains.js
  - Set ETHEREUM_RPC_URL in .env file
    `);
    process.exit(0);
  }

  // Use default configuration (no CLI parameters)
  const chainKey = "ethereum";
  const poolName = null; // Monitor all pools

  // Validate chain
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.error(`❌ Error: Unknown chain "${chainKey}"`);
    console.error(`Supported chains: ${Object.keys(CHAINS).join(", ")}`);
    process.exit(1);
  }

  // Check RPC configuration
  if (!chain.rpcUrl) {
    console.error(`❌ Error: RPC URL not configured for ${chain.name}`);
    console.error(`Set ${chainKey.toUpperCase()}_RPC_URL in your .env file`);
    process.exit(1);
  }

  // Check if chain has Curve config
  if (!chain.curve) {
    console.error(`❌ Error: Curve not configured for ${chain.name}`);
    process.exit(1);
  }

  // Print header
  const chainEmoji = chainKey === "ethereum" ? "🔷" : "🔗";
  printHeader(`Curve Pool Monitor`, `Chain: ${chainEmoji} ${chain.name}`);

  // Determine which pools to monitor
  let poolsToMonitor;
  if (poolName) {
    const pool = chain.curve.pools[poolName];
    if (!pool) {
      console.error(`❌ Error: Unknown pool "${poolName}"`);
      console.error(`Available pools: ${Object.keys(chain.curve.pools).join(", ")}`);
      process.exit(1);
    }
    poolsToMonitor = [pool];
  } else {
    // Monitor all pools
    poolsToMonitor = Object.values(chain.curve.pools);
  }

  // Monitor each pool
  for (const pool of poolsToMonitor) {
    await monitorPool(chainKey, pool);
  }

  console.log("\n");
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { monitorPool, getPoolState, getPoolAPY };
