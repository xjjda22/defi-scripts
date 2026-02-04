#!/usr/bin/env node

// Uniswap Price Monitor - Real-time price tracking across V2, V3, V4
// Shows best execution venue, liquidity depth, and fee tier comparison
require("dotenv").config();
const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const v2Swap = require("../../../swaps/v2Swap");
const v3Swap = require("../../../swaps/v3Swap");
const v4Swap = require("../../../swaps/v4Swap");
const {
  printHeader,
  printSection,
  createTable,
  formatPrice,
  formatCurrency,
  formatPercent,
  formatChain,
  printInsights,
} = require("../../utils/displayHelpers");
const {
  getTokenInfo,
  formatTokenAmount,
  calculatePercentageDiff,
  isValidPrice,
} = require("../../utils/priceFeeds");

// Configuration
const DEFAULT_CHAIN = process.env.CHAIN || "ethereum";
const DEFAULT_AMOUNT_IN = "1"; // 1 token

/**
 * Get Uniswap V2 price
 * @param {string} chainKey - Chain key
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount in (formatted)
 * @param {number} decimalsIn - Input token decimals
 * @returns {Promise<Object>} Price info
 */
async function getV2Price(chainKey, tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut) {
  try {
    const amountInWei = ethers.parseUnits(amountIn, decimalsIn);
    const quote = await v2Swap.getQuote(chainKey, tokenIn, tokenOut, amountInWei.toString());
    
    if (!quote || !quote.amountOut) {
      return null;
    }

    const amountOut = formatTokenAmount(quote.amountOut, decimalsOut);
    const price = parseFloat(amountOut);

    return {
      version: "V2",
      price,
      amountOut,
      path: quote.path,
      available: true,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get Uniswap V3 price for a specific fee tier
 * @param {string} chainKey - Chain key
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} fee - Fee tier
 * @param {string} amountIn - Amount in (formatted)
 * @param {number} decimalsIn - Input token decimals
 * @returns {Promise<Object>} Price info
 */
async function getV3Price(chainKey, tokenIn, tokenOut, fee, amountIn, decimalsIn, decimalsOut) {
  try {
    const amountInWei = ethers.parseUnits(amountIn, decimalsIn);
    const quote = await v3Swap.getQuote(chainKey, tokenIn, tokenOut, fee, amountInWei.toString());
    
    // V3 getQuote returns just a string (the amountOut)
    if (!quote) {
      return null;
    }

    const amountOut = formatTokenAmount(quote, decimalsOut);
    const price = parseFloat(amountOut);

    return {
      version: `V3 (${(fee / 10000).toFixed(2)}%)`,
      fee,
      price,
      amountOut,
      available: true,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get Uniswap V4 price
 * @param {string} chainKey - Chain key
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} fee - Fee tier
 * @param {string} amountIn - Amount in (formatted)
 * @param {number} decimalsIn - Input token decimals
 * @returns {Promise<Object>} Price info
 */
async function getV4Price(chainKey, tokenIn, tokenOut, fee, amountIn, decimalsIn, decimalsOut) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.uniswap?.v4?.poolManager) {
      return null;
    }

    const amountInWei = ethers.parseUnits(amountIn, decimalsIn);
    const estimate = await v4Swap.estimateSwapOutput(
      chainKey,
      tokenIn,
      tokenOut,
      fee,
      amountInWei.toString()
    );
    
    if (!estimate || !estimate.amountOut) {
      return null;
    }

    const amountOut = formatTokenAmount(estimate.amountOut, decimalsOut);
    const price = parseFloat(amountOut);

    return {
      version: "V4",
      fee,
      price,
      amountOut,
      available: true,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Monitor Uniswap prices across all versions
 * @param {string} chainKey - Chain key
 * @param {string} tokenInAddress - Input token address
 * @param {string} tokenOutAddress - Output token address
 * @param {string} amountIn - Amount to swap
 */
async function monitorUniswapPrices(chainKey, tokenInAddress, tokenOutAddress, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.error(`Unknown chain: ${chainKey}`);
    return;
  }

  // Get token info
  const [tokenIn, tokenOut] = await Promise.all([
    getTokenInfo(tokenInAddress, chainKey),
    getTokenInfo(tokenOutAddress, chainKey),
  ]);

  printHeader(
    `Uniswap Price Monitor - ${tokenIn.symbol}/${tokenOut.symbol}`,
    `Chain: ${formatChain(chain.name)} | Amount: ${amountIn} ${tokenIn.symbol}`
  );

  if (tokenIn.symbol === "UNKNOWN" || tokenOut.symbol === "UNKNOWN") {
    console.error("⚠️  Warning: Could not fetch token info from RPC");
    console.error("This usually means:");
    console.error("  1. RPC URL not configured in .env");
    console.error("  2. RPC URL is invalid or rate-limited");
    console.error("  3. Token addresses are incorrect\n");
  }

  console.log(`Fetching prices across all Uniswap versions...\n`);

  // Fetch all prices in parallel
  const V3_FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
  const V4_FEE_TIER = 3000; // Default to 0.3% for V4

  const pricePromises = [
    // V2
    getV2Price(chainKey, tokenInAddress, tokenOutAddress, amountIn, tokenIn.decimals, tokenOut.decimals),
    
    // V3 - all fee tiers
    ...V3_FEE_TIERS.map((fee) =>
      getV3Price(chainKey, tokenInAddress, tokenOutAddress, fee, amountIn, tokenIn.decimals, tokenOut.decimals)
    ),
    
    // V4
    getV4Price(chainKey, tokenInAddress, tokenOutAddress, V4_FEE_TIER, amountIn, tokenIn.decimals, tokenOut.decimals),
  ];

  const results = await Promise.all(pricePromises);
  
  // Debug output
  if (process.env.DEBUG || process.env.VERBOSE) {
    console.log("\n🔍 Debug: Raw Results:");
    results.forEach((r, i) => {
      if (r === null) {
        console.log(`  ${i}: null`);
      } else {
        console.log(`  ${i}: ${r.version} - ${r.price || 'no price'}`);
      }
    });
  }
  
  const prices = results.filter((p) => p !== null && isValidPrice(p.price));

  if (prices.length === 0) {
    console.error("\n❌ No prices available for this pair on this chain");
    console.log("This could mean:");
    console.log("  1. No liquidity pools exist for this pair");
    console.log("  2. The pair exists but quotes are failing");
    console.log("  3. Try a different token pair\n");
    
    if (!process.env.DEBUG) {
      console.log("💡 Run with DEBUG=1 for more details");
    }
    return;
  }

  // Sort by price (descending - best price first)
  prices.sort((a, b) => b.price - a.price);

  // Create results table
  const table = createTable(["Version", "Price", "Output Amount", "vs Best", "Status"]);

  const bestPrice = prices[0].price;

  prices.forEach((price) => {
    const diffPercent = calculatePercentageDiff(price.price, bestPrice);
    const diffFormatted = diffPercent === 0 ? "BEST" : formatPercent(diffPercent, 2, true);
    const status = diffPercent === 0 ? "⭐ Best" : diffPercent > -2 ? "✅ Good" : "⚠️ Low";

    table.push([
      price.version,
      formatPrice(price.price, 6),
      `${parseFloat(price.amountOut).toFixed(6)} ${tokenOut.symbol}`,
      diffFormatted,
      status,
    ]);
  });

  console.log(table.toString());

  // Calculate statistics
  const worstPrice = prices[prices.length - 1].price;
  const spread = bestPrice - worstPrice;
  const spreadPercent = (spread / worstPrice) * 100;
  const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;

  // Print insights
  printSection("Analysis");
  
  const insights = [];

  // Best venue
  insights.push({
    message: `Best price: ${prices[0].version} at ${formatPrice(prices[0].price, 6)}`,
    type: "success",
  });

  // Spread analysis
  if (spreadPercent > 1) {
    insights.push({
      message: `High price spread: ${formatPercent(spreadPercent, 2)} - significant difference between venues`,
      type: "warning",
    });
  } else {
    insights.push({
      message: `Low price spread: ${formatPercent(spreadPercent, 2)} - prices are consistent`,
      type: "info",
    });
  }

  // V3 fee tier recommendation
  const v3Prices = prices.filter((p) => p.version.startsWith("V3"));
  if (v3Prices.length > 0) {
    const bestV3 = v3Prices[0];
    insights.push({
      message: `Best V3 tier: ${bestV3.version} - use for most trades`,
      type: "rocket",
    });
  }

  // V4 availability
  const v4Price = prices.find((p) => p.version === "V4");
  if (v4Price) {
    const v4VsBest = calculatePercentageDiff(v4Price.price, bestPrice);
    if (Math.abs(v4VsBest) < 0.5) {
      insights.push({
        message: `V4 is competitive (${formatPercent(v4VsBest, 2)} vs best)`,
        type: "fire",
      });
    }
  } else {
    insights.push({
      message: "V4 not available for this pair",
      type: "info",
    });
  }

  // Arbitrage opportunity
  if (spreadPercent > 0.5) {
    const arbProfit = spread * parseFloat(amountIn);
    insights.push({
      message: `Potential arb: Buy ${prices[prices.length - 1].version} → Sell ${prices[0].version} = ${formatPrice(arbProfit, 4)} profit`,
      type: "fire",
    });
  }

  printInsights(insights);

  // Summary stats
  printSection("Statistics");
  console.log(`Best Price:    ${formatPrice(bestPrice, 6)}`);
  console.log(`Worst Price:   ${formatPrice(worstPrice, 6)}`);
  console.log(`Average Price: ${formatPrice(avgPrice, 6)}`);
  console.log(`Price Spread:  ${formatPrice(spread, 6)} (${formatPercent(spreadPercent, 2)})`);
  console.log(`Versions Available: ${prices.length}`);
  console.log();
}

/**
 * Main execution
 */
async function main() {
  try {
    // Show help if requested
    if (process.argv[2] === "--help" || process.argv[2] === "-h") {
      console.log(`
Uniswap Price Monitor - Compare prices across V2, V3, V4

Usage:
  npm run analytics:uniswap:price [chain] [tokenIn] [tokenOut] [amount]

Parameters:
  chain     - Chain name (default: ethereum)
  tokenIn   - Input token symbol (default: WETH)
  tokenOut  - Output token symbol (default: USDC)
  amount    - Amount to swap (default: 1)

Available Chains:
  ${Object.keys(CHAINS).join(", ")}

Available Tokens:
  ${Object.keys(COMMON_TOKENS).join(", ")}

Examples:
  npm run analytics:uniswap:price
  npm run analytics:uniswap:price ethereum WETH USDC 1
  npm run analytics:uniswap:price arbitrum WETH DAI 0.5
  npm run analytics:uniswap:price optimism USDC DAI 1000

Setup:
  1. Get free RPC URL from https://www.alchemy.com
  2. Add to .env: ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
`);
      process.exit(0);
    }

    // Get parameters from command line or use defaults
    const chainKey = process.argv[2] || DEFAULT_CHAIN;
    const tokenInSymbol = process.argv[3] || "WETH";
    const tokenOutSymbol = process.argv[4] || "USDC";
    const amountIn = process.argv[5] || DEFAULT_AMOUNT_IN;

    // Get token addresses
    const chain = CHAINS[chainKey];
    if (!chain) {
      console.error(`❌ Unknown chain: ${chainKey}`);
      console.log(`Available chains: ${Object.keys(CHAINS).join(", ")}`);
      process.exit(1);
    }

    // Check RPC configuration
    if (!chain.rpcUrl) {
      console.error(`❌ No RPC URL configured for ${chainKey}`);
      console.log(`\nPlease update your .env file with:`);
      console.log(`${chainKey.toUpperCase()}_RPC_URL=https://your-rpc-url-here`);
      console.log(`\nGet free RPC URLs from:`);
      console.log(`- Alchemy: https://www.alchemy.com`);
      console.log(`- Infura: https://infura.io`);
      process.exit(1);
    }

    const tokenInAddress = COMMON_TOKENS[tokenInSymbol]?.[chainKey];
    const tokenOutAddress = COMMON_TOKENS[tokenOutSymbol]?.[chainKey];

    if (!tokenInAddress || !tokenOutAddress) {
      console.error(`❌ Tokens not available on ${chainKey}`);
      console.log(`\nRequested: ${tokenInSymbol}/${tokenOutSymbol}`);
      console.log(`Available tokens: ${Object.keys(COMMON_TOKENS).join(", ")}`);
      console.log(`\nExample: npm run analytics:uniswap:price ethereum WETH USDC 1`);
      process.exit(1);
    }

    console.log(`Using: ${tokenInSymbol} (${tokenInAddress})`);
    console.log(`      ${tokenOutSymbol} (${tokenOutAddress})\n`);

    await monitorUniswapPrices(chainKey, tokenInAddress, tokenOutAddress, amountIn);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (process.env.DEBUG || process.env.VERBOSE) {
      console.error("\nFull error:");
      console.error(error);
    } else {
      console.log("\n💡 Tip: Run with DEBUG=1 for more details");
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { monitorUniswapPrices };
