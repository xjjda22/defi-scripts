#!/usr/bin/env node

/**
 * Balancer Pool Monitor
 *
 * Monitors Balancer weighted pools including:
 * - Pool token balances & weights
 * - Weight deviation (rebalancing needs)
 * - TVL estimation
 * - IL risk assessment
 *
 * Usage:
 *   npm run analytics:balancer:pools [chain] [poolName]
 *   npm run analytics:balancer:pools ethereum wethUsdc5050
 *   npm run analytics:balancer:pools --help
 */

const { ethers } = require("ethers");
const { CHAINS } = require("../../../config/chains");
const { getProvider } = require("../../../utils/web3");
const { printHeader, formatCurrency, formatPercent, formatNumber } = require("../../utils/displayHelpers");
const { getTokenInfo, formatTokenAmount } = require("../../utils/priceFeeds");

// ABIs
const BALANCER_VAULT_ABI = require("../../../abis/BalancerVault.json");

/**
 * Fetch pool tokens and balances from Balancer Vault
 */
async function getPoolData(chainKey, poolId, version = "v2") {
  const chain = CHAINS[chainKey];
  const provider = getProvider(chainKey);
  const vaultAddress = chain.balancer[version]?.vault;

  if (!vaultAddress) {
    console.error(`Balancer ${version.toUpperCase()} vault not configured`);
    return null;
  }

  const vault = new ethers.Contract(vaultAddress, BALANCER_VAULT_ABI, provider);

  try {
    const [tokens, balances, lastChangeBlock] = await vault.getPoolTokens(poolId);

    return {
      tokens: tokens.map(t => t.toLowerCase()),
      balances: balances.map(b => b.toString()),
      lastChangeBlock: lastChangeBlock.toString(),
    };
  } catch (error) {
    console.error(`Error fetching pool data: ${error.message}`);
    return null;
  }
}

/**
 * Calculate weight deviation and rebalancing needs
 */
function analyzeWeights(actualWeights, targetWeights, tokenNames) {
  const deviations = actualWeights.map((actual, i) => {
    const target = targetWeights[i];
    const deviation = actual - target;
    const deviationPct = (deviation / target) * 100;
    return { deviation, deviationPct };
  });

  const maxDeviation = Math.max(...deviations.map(d => Math.abs(d.deviationPct)));

  // Determine rebalancing status
  let rebalanceStatus;
  let rebalanceEmoji;
  if (maxDeviation < 5) {
    rebalanceStatus = "Balanced";
    rebalanceEmoji = "✅";
  } else if (maxDeviation < 10) {
    rebalanceStatus = "Slightly Off";
    rebalanceEmoji = "⚠️";
  } else {
    rebalanceStatus = "Needs Rebalancing";
    rebalanceEmoji = "🔴";
  }

  // Find most overweight token
  const maxDeviationIndex = deviations.findIndex(d => Math.abs(d.deviationPct) === maxDeviation);
  const rebalanceToken = maxDeviationIndex >= 0 ? tokenNames[maxDeviationIndex] : null;
  const rebalanceDirection = deviations[maxDeviationIndex]?.deviation > 0 ? "remove" : "add";

  return {
    deviations,
    maxDeviation,
    rebalanceStatus,
    rebalanceEmoji,
    rebalanceToken,
    rebalanceDirection,
  };
}

/**
 * Calculate Impermanent Loss risk based on weight distribution
 */
function calculateILRisk(weights) {
  // 50/50 pools have highest IL risk
  // 80/20 pools have lower IL risk (concentrated in one asset)
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  const weightSpread = maxWeight - minWeight;

  let ilRisk;
  let ilEmoji;
  if (weightSpread < 20) {
    ilRisk = "High (balanced pool)";
    ilEmoji = "⚠️";
  } else if (weightSpread < 40) {
    ilRisk = "Medium";
    ilEmoji = "💡";
  } else {
    ilRisk = "Low (concentrated)";
    ilEmoji = "✅";
  }

  return { ilRisk, ilEmoji, weightSpread };
}

/**
 * Monitor a single Balancer pool
 */
async function monitorPool(chainKey, poolInfo) {
  const { name, poolId, tokens: tokenNames, weights: targetWeights, version = "V2" } = poolInfo;

  console.log(`\n${name} [${version}]`);
  console.log("─".repeat(50));

  // Fetch pool data
  const versionKey = version.toLowerCase();
  const poolData = await getPoolData(chainKey, poolId, versionKey);
  if (!poolData) {
    console.log("❌ Failed to fetch pool data");
    return;
  }

  // Fetch token info for all tokens
  const tokenInfos = await Promise.all(poolData.tokens.map(tokenAddress => getTokenInfo(tokenAddress, chainKey)));

  // Format balances
  const formattedBalances = poolData.balances.map((balance, i) => {
    const decimals = tokenInfos[i]?.decimals || 18;
    return parseFloat(formatTokenAmount(balance, decimals));
  });

  // Calculate actual weights
  const totalValue = formattedBalances.reduce((sum, b) => sum + b, 0);
  const actualWeights = formattedBalances.map(b => (totalValue > 0 ? (b / totalValue) * 100 : 0));

  // Analyze weights
  const weightAnalysis = analyzeWeights(actualWeights, targetWeights, tokenNames);

  // Calculate IL risk
  const ilAnalysis = calculateILRisk(targetWeights);

  // Display pool info
  console.log(`  Pool ID: ${poolId.slice(0, 10)}...${poolId.slice(-8)}`);

  // Display balances
  console.log(`  Balances:`);
  tokenNames.forEach((token, i) => {
    const symbol = tokenInfos[i]?.symbol || token;
    console.log(`    ${symbol}: ${formatNumber(formattedBalances[i])}`);
  });

  // Display weights
  console.log(
    `  Weights: ${actualWeights.map((w, i) => `${formatPercent(w, 1)} (target: ${targetWeights[i]}%)`).join(" / ")}`
  );
  console.log(`  Status: ${weightAnalysis.rebalanceEmoji} ${weightAnalysis.rebalanceStatus}`);

  // Display rebalancing suggestion
  if (weightAnalysis.maxDeviation > 5) {
    console.log(
      `  💡 ${weightAnalysis.rebalanceToken} is ${weightAnalysis.rebalanceDirection === "remove" ? "overweight" : "underweight"} (${weightAnalysis.maxDeviation.toFixed(1)}% deviation)`
    );
    if (weightAnalysis.rebalanceDirection === "remove") {
      console.log(`  💡 Consider: Remove ${weightAnalysis.rebalanceToken} to rebalance`);
    } else {
      console.log(`  💡 Consider: Add ${weightAnalysis.rebalanceToken} to rebalance`);
    }
  }

  // Display IL risk
  console.log(`  IL Risk: ${ilAnalysis.ilEmoji} ${ilAnalysis.ilRisk}`);

  if (ilAnalysis.weightSpread < 20) {
    console.log(`  💡 High IL exposure - suitable for low volatility pairs`);
  } else if (ilAnalysis.weightSpread > 40) {
    console.log(`  💡 Low IL exposure - concentrated in ${tokenNames[0]}`);
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
Balancer Pool Monitor - Monitor Balancer weighted pools

Usage:
  npm run analytics:balancer:pools

Monitors all configured pools:
  - WETH/USDC (50/50) [V2]
  - wstETH/WETH (80/20) [V2]

Configuration:
  - Chain: Ethereum (hardcoded)
  - Pools: src/config/chains.js (balancer.v2.pools)
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

  // Check if chain has Balancer config
  if (!chain.balancer) {
    console.error(`❌ Error: Balancer not configured for ${chain.name}`);
    process.exit(1);
  }

  // Print header
  const chainEmoji = chainKey === "ethereum" ? "🔷" : "🔗";
  printHeader(`Balancer Pool Monitor`, `Chain: ${chainEmoji} ${chain.name}`);

  // Determine which pools to monitor (aggregate from all versions)
  let poolsToMonitor;
  if (poolName) {
    // Search across all versions
    let pool = null;
    for (const version of Object.keys(chain.balancer)) {
      if (chain.balancer[version]?.pools?.[poolName]) {
        pool = chain.balancer[version].pools[poolName];
        break;
      }
    }

    if (!pool) {
      console.error(`❌ Error: Unknown pool "${poolName}"`);
      const allPools = Object.keys(chain.balancer).flatMap(v => Object.keys(chain.balancer[v]?.pools || {}));
      console.error(`Available pools: ${allPools.join(", ")}`);
      process.exit(1);
    }
    poolsToMonitor = [pool];
  } else {
    // Monitor all pools from all versions
    poolsToMonitor = Object.keys(chain.balancer).flatMap(version =>
      Object.values(chain.balancer[version]?.pools || {})
    );
  }

  // Monitor each pool
  for (const pool of poolsToMonitor) {
    await monitorPool(chainKey, pool);
  }

  console.log("\n");
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { monitorPool, getPoolData };
