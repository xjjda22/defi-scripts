#!/usr/bin/env node

/**
 * SushiSwap Pool Monitor
 *
 * Monitors SushiSwap pools and compares to Uniswap:
 * - V2 pool prices vs Uniswap V2
 * - V3 pool prices vs Uniswap V3
 * - Shows when to use SushiSwap (LP incentives) vs Uniswap (better prices)
 *
 * Usage:
 *   npm run analytics:sushiswap:pools [chain] [tokenIn] [tokenOut] [amount]
 *   npm run analytics:sushiswap:pools ethereum WETH USDC 1
 *   npm run analytics:sushiswap:pools --help
 */

const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const { getPairGroup } = require("../../../config/pairs");
const { getProvider } = require("../../../utils/web3");
const { printHeader, createTable, formatCurrency, formatPercent, printInsight } = require("../../utils/displayHelpers");
const { getTokenInfo, formatTokenAmount } = require("../../utils/priceFeeds");

// Reuse Uniswap ABIs since SushiSwap is a fork
const UNISWAP_V2_ROUTER_ABI = require("../../../abis/IUniswapV2Router02.json");
const UNISWAP_V3_QUOTER_ABI = require("../../../abis/IQuoter.json");

/**
 * Get SushiSwap V2 quote
 */
async function getSushiV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v2?.router) {
    return null;
  }

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.sushiswap.v2.router, UNISWAP_V2_ROUTER_ABI, provider);

  try {
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[amounts.length - 1].toString();
  } catch (error) {
    return null;
  }
}

/**
 * Get SushiSwap V3 quote (0.3% fee tier)
 */
async function getSushiV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee = 3000) {
  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v3?.quoter) {
    return null;
  }

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.sushiswap.v3.quoter, UNISWAP_V3_QUOTER_ABI, provider);

  try {
    const amountOut = await quoter.quoteExactInputSingle.staticCall(tokenIn, tokenOut, fee, amountIn, 0);
    return amountOut.toString();
  } catch (error) {
    return null;
  }
}

/**
 * Get Uniswap V2 quote for comparison
 */
async function getUniV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v2?.router) {
    return null;
  }

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.uniswap.v2.router, UNISWAP_V2_ROUTER_ABI, provider);

  try {
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[amounts.length - 1].toString();
  } catch (error) {
    return null;
  }
}

/**
 * Get Uniswap V3 quote for comparison (0.3% fee tier)
 */
async function getUniV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee = 3000) {
  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v3?.quoter) {
    return null;
  }

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.uniswap.v3.quoter, UNISWAP_V3_QUOTER_ABI, provider);

  try {
    const amountOut = await quoter.quoteExactInputSingle.staticCall(tokenIn, tokenOut, fee, amountIn, 0);
    return amountOut.toString();
  } catch (error) {
    return null;
  }
}

/**
 * Compare SushiSwap and Uniswap prices
 */
async function comparePrices(chainKey, tokenInSymbol, tokenOutSymbol, amount) {
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

  console.log(`\nComparing: ${tokenIn.symbol}/${tokenOut.symbol}`);
  console.log(`Amount: ${amount} ${tokenIn.symbol}`);
  console.log(`Versions: SushiSwap V2/V3 vs Uniswap V2/V3\n`);

  // Fetch all quotes in parallel
  const [sushiV2Quote, sushiV3Quote, uniV2Quote, uniV3Quote] = await Promise.all([
    getSushiV2Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getSushiV3Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getUniV2Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
    getUniV3Quote(chainKey, tokenInAddress, tokenOutAddress, amountInWei.toString()),
  ]);

  // Create comparison table
  const table = createTable(["DEX", "Version", "Price", "vs Uniswap", "Recommendation"]);

  const results = [];

  // Add V2 results
  if (sushiV2Quote && uniV2Quote) {
    const sushiPrice = parseFloat(formatTokenAmount(sushiV2Quote, tokenOut.decimals));
    const uniPrice = parseFloat(formatTokenAmount(uniV2Quote, tokenOut.decimals));
    const diff = ((sushiPrice - uniPrice) / uniPrice) * 100;
    const diffStr = diff >= 0 ? `+${formatPercent(diff, 2)}` : formatPercent(diff, 2);
    const recommendation = diff >= 0 ? "✅ Better" : "⚠️ Worse";

    table.push(["SushiSwap", "V2 (fork)", formatCurrency(sushiPrice), diffStr, recommendation]);

    results.push({
      dex: "SushiSwap V2",
      price: sushiPrice,
      diffPct: diff,
    });
  }

  // Add V3 results
  if (sushiV3Quote && uniV3Quote) {
    const sushiPrice = parseFloat(formatTokenAmount(sushiV3Quote, tokenOut.decimals));
    const uniPrice = parseFloat(formatTokenAmount(uniV3Quote, tokenOut.decimals));
    const diff = ((sushiPrice - uniPrice) / uniPrice) * 100;
    const diffStr = diff >= 0 ? `+${formatPercent(diff, 2)}` : formatPercent(diff, 2);
    const recommendation = diff >= 0 ? "✅ Better" : "⚠️ Worse";

    table.push(["SushiSwap", "V3 (fork, 0.3%)", formatCurrency(sushiPrice), diffStr, recommendation]);

    results.push({
      dex: "SushiSwap V3",
      price: sushiPrice,
      diffPct: diff,
    });
  }

  // Add Uniswap baseline
  if (uniV2Quote) {
    const uniPrice = parseFloat(formatTokenAmount(uniV2Quote, tokenOut.decimals));
    table.push(["Uniswap", "V2", formatCurrency(uniPrice), "baseline", "📊 Compare"]);
  }

  if (uniV3Quote) {
    const uniPrice = parseFloat(formatTokenAmount(uniV3Quote, tokenOut.decimals));
    table.push(["Uniswap", "V3 (0.3%)", formatCurrency(uniPrice), "baseline", "📊 Compare"]);
  }

  console.log(table.toString());

  // Insights
  console.log("\nInsights");
  console.log("─".repeat(50));

  const betterOnSushi = results.filter(r => r.diffPct >= 0);
  const worseOnSushi = results.filter(r => r.diffPct < 0);

  if (betterOnSushi.length > 0) {
    printInsight(`SushiSwap has ${betterOnSushi.length} better price(s) vs Uniswap`, "info");
    betterOnSushi.forEach(r => {
      printInsight(`${r.dex}: ${formatPercent(r.diffPct, 2)} better`, "success");
    });
  }

  if (worseOnSushi.length > 0) {
    printInsight(`SushiSwap has ${worseOnSushi.length} worse price(s) vs Uniswap`, "warning");
    worseOnSushi.forEach(r => {
      printInsight(`${r.dex}: ${formatPercent(Math.abs(r.diffPct), 2)} worse`, "error");
    });
  }

  // Strategic recommendation
  console.log("\nRecommendation");
  console.log("─".repeat(50));

  const avgDiff = results.reduce((sum, r) => sum + r.diffPct, 0) / results.length;

  if (avgDiff < -1) {
    console.log("⚠️  Use Uniswap for swaps (better prices)");
    console.log("💡 Consider SushiSwap for LP (SUSHI incentives may compensate)");
  } else if (avgDiff > 1) {
    console.log("✅ Use SushiSwap for swaps (better prices!)");
    console.log("💡 Also good for LP (better prices + SUSHI incentives)");
  } else {
    console.log("💡 Prices are similar (~within 1%)");
    console.log("💡 Choose based on incentives & gas costs");
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
SushiSwap Pool Monitor - Compare SushiSwap and Uniswap prices

Usage:
  npm run analytics:sushiswap:pools

Monitors default pairs:
  - WETH/USDC (1 ETH)
  - USDC/USDT (1000)
  - WETH/DAI (1 ETH)

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

  // Check if chain has SushiSwap config
  if (!chain.sushiswap) {
    console.error(`❌ Error: SushiSwap not configured for ${chain.name}`);
    process.exit(1);
  }

  // Print header
  const chainEmoji = "🔷";
  printHeader(`SushiSwap Pool Monitor`, `Chain: ${chainEmoji} ${chain.name}`);

  console.log(`Monitoring ${pairs.length} pair(s)...\n`);

  // Compare prices for each pair
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    await comparePrices(chainKey, pair.tokenIn, pair.tokenOut, pair.amount);

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

module.exports = { comparePrices, getSushiV2Quote, getSushiV3Quote };
