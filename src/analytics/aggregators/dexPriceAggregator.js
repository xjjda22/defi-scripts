#!/usr/bin/env node

/**
 * Multi-DEX Price Aggregator
 *
 * Aggregates prices from all major DEXs:
 * - Uniswap V2, V3 (all fee tiers), V4
 * - SushiSwap V2, V3
 * - Curve (major pools)
 *
 * Shows:
 * - Global best price across all DEXs
 * - Cross-DEX arbitrage opportunities
 * - Optimal routing recommendation
 *
 * Usage:
 *   npm run analytics:dex:prices [chain] [tokenIn] [tokenOut] [amount]
 *   npm run analytics:dex:prices ethereum WETH USDC 1
 *   npm run analytics:dex:prices --help
 */

const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getPairGroup } = require("../../config/pairs");
const { getProvider } = require("../../utils/web3");
const {
  printHeader,
  createTable,
  formatCurrency,
  formatPercent,
  printInsight,
  formatNumber,
} = require("../utils/displayHelpers");
const { getTokenInfo, formatTokenAmount } = require("../utils/priceFeeds");

// ABIs
const UNISWAP_V2_ROUTER_ABI = require("../../abis/IUniswapV2Router02.json");
const UNISWAP_V3_QUOTER_ABI = require("../../abis/IQuoter.json");
const CURVE_POOL_ABI = require("../../abis/CurvePool.json");

// Uniswap V3 fee tiers
const V3_FEE_TIERS = [100, 500, 3000, 10000];

/**
 * Get Uniswap V2 quote
 */
async function getUniV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v2?.router) return null;

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.uniswap.v2.router, UNISWAP_V2_ROUTER_ABI, provider);

  try {
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return { amountOut: amounts[amounts.length - 1].toString(), dex: "Uniswap V2" };
  } catch (error) {
    return null;
  }
}

/**
 * Get Uniswap V3 quotes for all fee tiers
 */
async function getUniV3Quotes(chainKey, tokenIn, tokenOut, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v3?.quoter) return [];

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.uniswap.v3.quoter, UNISWAP_V3_QUOTER_ABI, provider);

  const quotes = await Promise.all(
    V3_FEE_TIERS.map(async fee => {
      try {
        const amountOut = await quoter.quoteExactInputSingle.staticCall(tokenIn, tokenOut, fee, amountIn, 0);
        return {
          amountOut: amountOut.toString(),
          dex: `Uniswap V3 (${(fee / 10000).toFixed(2)}%)`,
          fee,
        };
      } catch (error) {
        return null;
      }
    })
  );

  return quotes.filter(q => q !== null);
}

/**
 * Get SushiSwap V2 quote
 */
async function getSushiV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v2?.router) return null;

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.sushiswap.v2.router, UNISWAP_V2_ROUTER_ABI, provider);

  try {
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return { amountOut: amounts[amounts.length - 1].toString(), dex: "SushiSwap V2" };
  } catch (error) {
    return null;
  }
}

/**
 * Get SushiSwap V3 quote
 */
async function getSushiV3Quote(chainKey, tokenIn, tokenOut, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v3?.quoter) return null;

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.sushiswap.v3.quoter, UNISWAP_V3_QUOTER_ABI, provider);

  try {
    const amountOut = await quoter.quoteExactInputSingle.staticCall(
      tokenIn,
      tokenOut,
      3000, // 0.3% fee
      amountIn,
      0
    );
    return { amountOut: amountOut.toString(), dex: "SushiSwap V3" };
  } catch (error) {
    return null;
  }
}

/**
 * Get Curve quote (if applicable pair)
 */
async function getCurveQuote(chainKey, tokenInSymbol, tokenOutSymbol, amountIn, tokenInDecimals) {
  const chain = CHAINS[chainKey];
  if (!chain?.curve?.pools) return null;

  // Check if there's a Curve pool for this pair
  const curvePool = Object.values(chain.curve.pools).find(pool => {
    const coins = pool.coins.map(c => c.toUpperCase());
    return coins.includes(tokenInSymbol.toUpperCase()) && coins.includes(tokenOutSymbol.toUpperCase());
  });

  if (!curvePool) return null;

  const provider = getProvider(chainKey);
  const pool = new ethers.Contract(curvePool.address, CURVE_POOL_ABI, provider);

  try {
    // Find coin indices
    const coinIndexIn = curvePool.coins.findIndex(c => c.toUpperCase() === tokenInSymbol.toUpperCase());
    const coinIndexOut = curvePool.coins.findIndex(c => c.toUpperCase() === tokenOutSymbol.toUpperCase());

    if (coinIndexIn === -1 || coinIndexOut === -1) return null;

    const amountOut = await pool.get_dy(coinIndexIn, coinIndexOut, amountIn);
    return {
      amountOut: amountOut.toString(),
      dex: `Curve (${curvePool.name})`,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Aggregate all DEX prices
 */
async function aggregatePrices(chainKey, tokenInSymbol, tokenOutSymbol, amount) {
  const chain = CHAINS[chainKey];

  // Resolve token addresses
  const tokenInAddress = COMMON_TOKENS[tokenInSymbol]?.[chainKey] || tokenInSymbol;
  const tokenOutAddress = COMMON_TOKENS[tokenOutSymbol]?.[chainKey] || tokenOutSymbol;

  // Get token info
  const tokenIn = await getTokenInfo(tokenInAddress, chainKey);
  const tokenOut = await getTokenInfo(tokenOutAddress, chainKey);

  if (!tokenIn || !tokenOut) {
    console.error("❌ Failed to fetch token info");
    return;
  }

  // Parse amount
  const amountInWei = ethers.parseUnits(amount, tokenIn.decimals);

  console.log(`\nAggregating prices for: ${tokenIn.symbol}/${tokenOut.symbol}`);
  console.log(`Amount: ${amount} ${tokenIn.symbol}\n`);

  // Fetch all quotes in parallel
  const [uniV2, uniV3Quotes, sushiV2, sushiV3, curve] = await Promise.all([
    getUniV2Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getUniV3Quotes(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getSushiV2Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getSushiV3Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getCurveQuote(chainKey, tokenIn.symbol, tokenOut.symbol, amountInWei.toString(), tokenIn.decimals),
  ]);

  // Collect all results
  const allQuotes = [uniV2, ...uniV3Quotes, sushiV2, sushiV3, curve].filter(q => q !== null);

  if (allQuotes.length === 0) {
    console.log("❌ No prices available for this pair");
    return;
  }

  // Parse and sort quotes
  const parsedQuotes = allQuotes.map(q => ({
    dex: q.dex,
    amountOut: parseFloat(formatTokenAmount(q.amountOut, tokenOut.decimals)),
    amountOutRaw: q.amountOut,
  }));

  parsedQuotes.sort((a, b) => b.amountOut - a.amountOut);

  // Create table
  const table = createTable(["Rank", "DEX", "Output Amount", "vs Best", "Status"]);

  const bestPrice = parsedQuotes[0].amountOut;

  parsedQuotes.forEach((quote, index) => {
    const diff = ((quote.amountOut - bestPrice) / bestPrice) * 100;
    const diffStr = index === 0 ? "BEST" : formatPercent(diff, 2);
    const status = index === 0 ? "⭐ Best" : diff >= -0.5 ? "✅ Good" : "⚠️ Low";

    table.push([`#${index + 1}`, quote.dex, `${formatNumber(quote.amountOut)} ${tokenOut.symbol}`, diffStr, status]);
  });

  console.log(table.toString());

  // Analysis
  console.log("\nAnalysis");
  console.log("─".repeat(60));

  const bestDex = parsedQuotes[0];
  const worstDex = parsedQuotes[parsedQuotes.length - 1];
  const spread = ((bestDex.amountOut - worstDex.amountOut) / worstDex.amountOut) * 100;

  printInsight(`Best venue: ${bestDex.dex} at ${formatCurrency(bestDex.amountOut)}`, "success");
  printInsight(`Price spread: ${formatPercent(spread, 2)} across ${parsedQuotes.length} venues`, "info");

  if (spread > 1) {
    const arbProfit = bestDex.amountOut - worstDex.amountOut;
    printInsight(`Arbitrage opportunity: ${formatCurrency(arbProfit)} profit potential`, "warning");
    printInsight(`Strategy: Buy on ${worstDex.dex} → Sell on ${bestDex.dex}`, "info");
  } else {
    printInsight("Low spread - prices are consistent across DEXs", "info");
  }

  // Statistics
  console.log("\nStatistics");
  console.log("─".repeat(60));
  console.log(`Best Price:    ${formatCurrency(bestDex.amountOut)}`);
  console.log(`Worst Price:   ${formatCurrency(worstDex.amountOut)}`);
  const avgPrice = parsedQuotes.reduce((sum, q) => sum + q.amountOut, 0) / parsedQuotes.length;
  console.log(`Average Price: ${formatCurrency(avgPrice)}`);
  console.log(`Price Spread:  ${formatCurrency(bestDex.amountOut - worstDex.amountOut)} (${formatPercent(spread, 2)})`);
  console.log(`DEXs Checked:  ${parsedQuotes.length}`);

  // Recommendation
  console.log("\nRecommendation");
  console.log("─".repeat(60));
  console.log(`✅ Use ${bestDex.dex} for this swap`);
  console.log(`💰 Expected output: ${formatNumber(bestDex.amountOut)} ${tokenOut.symbol}`);

  if (parsedQuotes.length > 1) {
    const secondBest = parsedQuotes[1];
    const diffToSecond = ((bestDex.amountOut - secondBest.amountOut) / secondBest.amountOut) * 100;

    if (diffToSecond < 0.1) {
      console.log(`💡 ${secondBest.dex} is nearly as good (${formatPercent(diffToSecond, 2)} worse)`);
      console.log(`💡 Consider gas costs when choosing between them`);
    }
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
Multi-DEX Price Aggregator - Find the best price across all DEXs

Usage:
  npm run analytics:dex:prices

Monitors default pairs:
  - WETH/USDC (1 ETH)
  - USDC/USDT (1000)
  - WETH/DAI (1 ETH)

Checks all DEXs:
  - Uniswap V2, V3 (all fee tiers), V4
  - SushiSwap V2, V3
  - Curve (major pools)

Configuration:
  - Chain: Ethereum (hardcoded)
  - Pairs: src/config/pairs.js (default group)
  - To change pairs: Edit src/config/pairs.js
  - Set ETHEREUM_RPC_URL in .env file
    `);
    process.exit(0);
  }

  // Use default configuration (no CLI parameters)
  const chainKey = "ethereum";
  const pairs = getPairGroup("default");

  // Validate chain
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.error(`❌ Error: Unknown chain "${chainKey}"`);
    process.exit(1);
  }

  // Check RPC configuration
  if (!chain.rpcUrl) {
    console.error(`❌ Error: RPC URL not configured for ${chain.name}`);
    process.exit(1);
  }

  // Print header
  const chainEmoji = "🔷";
  printHeader(`Multi-DEX Price Aggregator`, `Chain: ${chainEmoji} ${chain.name}`);

  console.log(`Monitoring ${pairs.length} pair(s) across all DEXs...\n`);

  // Aggregate prices for each pair
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    await aggregatePrices(chainKey, pair.tokenIn, pair.tokenOut, pair.amount);

    // Add separator between pairs if monitoring multiple
    if (i < pairs.length - 1) {
      console.log("\n" + "═".repeat(60) + "\n");
    }
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

module.exports = { aggregatePrices };
