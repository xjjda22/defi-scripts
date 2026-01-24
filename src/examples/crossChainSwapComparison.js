// Cross-chain swap comparison
// Compares swap quotes for the same token pair across multiple chains
// Useful for identifying best execution venues and cross-chain arbitrage opportunities
require("dotenv").config();
const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../config/chains");
const { compareQuotes, getCommonToken } = require("../swaps/swap");

/**
 * Compare swap quotes across multiple chains for the same token pair
 * @param {string[]} chains - Array of chain keys to compare
 * @param {string} tokenSymbolIn - Input token symbol (e.g., 'WETH')
 * @param {string} tokenSymbolOut - Output token symbol (e.g., 'USDC')
 * @param {string} amountIn - Amount to swap (in human-readable units)
 * @returns {Promise<Array>} Comparison results
 */
async function compareCrossChain(
  chains,
  tokenSymbolIn,
  tokenSymbolOut,
  amountIn,
) {
  console.log(`\n=== Cross-Chain Swap Comparison ===`);
  console.log(`Swapping ${amountIn} ${tokenSymbolIn} for ${tokenSymbolOut}\n`);

  const results = [];

  for (const chain of chains) {
    const chainConfig = CHAINS[chain];
    if (!chainConfig) {
      console.log(`❌ ${chain}: Unknown chain`);
      continue;
    }

    console.log(`\n📊 ${chainConfig.name}:`);

    try {
      // Get token addresses for this chain
      const tokenIn = getCommonToken(tokenSymbolIn, chain);
      const tokenOut = getCommonToken(tokenSymbolOut, chain);

      // Parse amount based on token decimals (assume 18 for WETH, 6 for stablecoins)
      const decimals = tokenSymbolIn === "WETH" ? 18 : 6;
      const amountInWei = ethers.parseUnits(amountIn, decimals);

      // Get quotes from all versions on this chain
      const quotes = await compareQuotes(
        chain,
        tokenIn,
        tokenOut,
        amountInWei.toString(),
      );

      // Find best quote on this chain
      const availableQuotes = quotes.filter((q) => q.available);
      if (availableQuotes.length === 0) {
        console.log(`  No available quotes`);
        results.push({
          chain,
          chainName: chainConfig.name,
          available: false,
          error: "No liquidity",
        });
        continue;
      }

      const bestQuote = availableQuotes.reduce((best, current) => {
        return BigInt(current.amountOut) > BigInt(best.amountOut)
          ? current
          : best;
      });

      // Format output amount (assume 6 decimals for stablecoins)
      const outDecimals = tokenSymbolOut === "WETH" ? 18 : 6;
      const formattedOut = ethers.formatUnits(bestQuote.amountOut, outDecimals);

      results.push({
        chain,
        chainName: chainConfig.name,
        available: true,
        bestVersion: bestQuote.version,
        bestFee: bestQuote.fee,
        amountOut: bestQuote.amountOut,
        formattedOut,
        allQuotes: quotes,
      });

      console.log(`  ✅ Best: ${bestQuote.version} - ${formattedOut} ${tokenSymbolOut}`);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({
        chain,
        chainName: chainConfig.name,
        available: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Find best execution chain
 */
function findBestChain(results) {
  const available = results.filter((r) => r.available);

  if (available.length === 0) {
    return null;
  }

  return available.reduce((best, current) => {
    return BigInt(current.amountOut) > BigInt(best.amountOut) ? current : best;
  });
}

/**
 * Calculate price impact between chains
 */
function calculatePriceImpact(results) {
  const available = results.filter((r) => r.available);

  if (available.length < 2) {
    return [];
  }

  const impacts = [];
  const sorted = [...available].sort((a, b) =>
    BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : -1,
  );

  const best = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const impactBps =
      ((BigInt(best.amountOut) - BigInt(current.amountOut)) * BigInt(10000)) /
      BigInt(best.amountOut);

    impacts.push({
      chain: current.chainName,
      version: current.bestVersion,
      impactBps: Number(impactBps),
      impactPercent: (Number(impactBps) / 100).toFixed(2),
    });
  }

  return impacts;
}

async function main() {
  // Configuration
  const CHAINS_TO_COMPARE = [
    "ethereum",
    "arbitrum",
    "optimism",
    "base",
    "polygon",
  ];
  const TOKEN_IN = "WETH";
  const TOKEN_OUT = "USDC";
  const AMOUNT = "0.1"; // 0.1 WETH

  try {
    // Compare quotes across chains
    const results = await compareCrossChain(
      CHAINS_TO_COMPARE,
      TOKEN_IN,
      TOKEN_OUT,
      AMOUNT,
    );

    // Find best execution venue
    const bestChain = findBestChain(results);

    if (bestChain) {
      console.log(`\n\n🏆 Best Execution:`);
      console.log(`  Chain: ${bestChain.chainName}`);
      console.log(`  Version: ${bestChain.bestVersion.toUpperCase()}`);
      console.log(`  Output: ${bestChain.formattedOut} ${TOKEN_OUT}`);
      if (bestChain.bestFee) {
        console.log(`  Fee: ${bestChain.bestFee / 10000}%`);
      }
    } else {
      console.log(`\n\n❌ No available execution venues found`);
    }

    // Calculate and display price impact
    const impacts = calculatePriceImpact(results);
    if (impacts.length > 0) {
      console.log(`\n\n💸 Price Impact Comparison (vs best):`);
      impacts.forEach((impact) => {
        console.log(
          `  ${impact.chain} (${impact.version}): -${impact.impactPercent}% worse`,
        );
      });
    }

    // Summary table
    console.log(`\n\n📋 Summary:`);
    console.log(`${"Chain".padEnd(15)} ${"Version".padEnd(8)} ${"Output".padEnd(20)}`);
    console.log("-".repeat(45));

    results.forEach((result) => {
      if (result.available) {
        const isBest = bestChain && result.chain === bestChain.chain;
        const marker = isBest ? "🏆" : "  ";
        console.log(
          `${marker} ${result.chainName.padEnd(15)} ${result.bestVersion.toUpperCase().padEnd(8)} ${result.formattedOut.padEnd(20)}`,
        );
      } else {
        console.log(`  ${result.chainName.padEnd(15)} N/A      ${result.error}`);
      }
    });

    // Arbitrage opportunity detection
    if (impacts.length > 0 && impacts[impacts.length - 1].impactBps > 50) {
      console.log(`\n\n💡 Potential Arbitrage Opportunity Detected!`);
      console.log(
        `  Price difference > 0.5% between ${bestChain.chainName} and ${impacts[impacts.length - 1].chain}`,
      );
      console.log(`  Consider cross-chain arbitrage (account for bridge costs)`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  compareCrossChain,
  findBestChain,
  calculatePriceImpact,
};
