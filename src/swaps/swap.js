// Unified Uniswap swap interface across V2, V3, and V4
// Provides a simple API for token swaps regardless of protocol version
const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../config/chains");
const {
  validateChainKey,
  validateWallet,
  validateAddress,
  validateAmount,
  validateSlippage,
} = require("../utils/validation");
const v2Swap = require("./v2Swap");
const v3Swap = require("./v3Swap");
const v4Swap = require("./v4Swap");

/**
 * Auto-detect and execute the best swap across all Uniswap versions
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet for signing
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount to swap (in wei/smallest unit)
 * @param {object} options - Optional parameters
 * @param {number} options.slippageBps - Slippage tolerance (default: 50 = 0.5%)
 * @param {string} options.recipient - Recipient address (default: wallet address)
 * @param {string} options.version - Force specific version: 'v2', 'v3', 'v4'
 * @param {number} options.v3Fee - V3/V4 fee tier (default: auto-detect best)
 * @returns {Promise<{version: string, hash: string, amountOut: string}>}
 */
async function swapTokens(chainKey, wallet, tokenIn, tokenOut, amountIn, options = {}) {
  // Validate inputs
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const { slippageBps = 50, recipient = null, version = null, v3Fee = null } = options;

  // Validate slippage if provided
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainKey}`);
  }

  // If version is specified, use that version
  if (version) {
    return await swapWithVersion(version, chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps, recipient, v3Fee);
  }

  // Auto-detect best version by comparing quotes
  console.log(`\nFinding best swap route on ${chain.name}...`);

  const quotes = await Promise.allSettled([
    getV2Quote(chainKey, tokenIn, tokenOut, amountIn),
    getV3Quote(chainKey, tokenIn, tokenOut, amountIn, v3Fee),
    getV4Quote(chainKey, tokenIn, tokenOut, amountIn, v3Fee || 3000),
  ]);

  // Find best quote
  let bestVersion = null;
  let bestQuote = { version: null, amountOut: "0", fee: null };

  quotes.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      const versions = ["v2", "v3", "v4"];
      const quote = result.value;
      if (BigInt(quote.amountOut) > BigInt(bestQuote.amountOut)) {
        bestQuote = {
          version: versions[idx],
          amountOut: quote.amountOut,
          fee: quote.fee,
        };
      }
    }
  });

  if (!bestQuote.version) {
    throw new Error("No valid swap routes found");
  }

  console.log(`Best route: ${bestQuote.version.toUpperCase()}`);
  console.log(`Expected output: ${bestQuote.amountOut}`);

  return await swapWithVersion(
    bestQuote.version,
    chainKey,
    wallet,
    tokenIn,
    tokenOut,
    amountIn,
    slippageBps,
    recipient,
    bestQuote.fee
  );
}

/**
 * Execute swap with specific version
 */
async function swapWithVersion(version, chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps, recipient, fee) {
  switch (version.toLowerCase()) {
    case "v2":
      const v2Result = await v2Swap.swapExactTokensForTokens(
        chainKey,
        wallet,
        tokenIn,
        tokenOut,
        amountIn,
        slippageBps,
        recipient
      );
      return { version: "v2", ...v2Result };

    case "v3":
      const v3Fee = fee || 3000; // Default to 0.3%
      const v3Result = await v3Swap.swapExactInputSingle(
        chainKey,
        wallet,
        tokenIn,
        tokenOut,
        v3Fee,
        amountIn,
        slippageBps,
        recipient
      );
      return { version: "v3", ...v3Result };

    case "v4":
      const v4Fee = fee || 3000;
      const v4Result = await v4Swap.swapV4(
        chainKey,
        wallet,
        tokenIn,
        tokenOut,
        v4Fee,
        amountIn,
        slippageBps,
        recipient
      );
      return { version: "v4", ...v4Result };

    default:
      throw new Error(`Unknown version: ${version}`);
  }
}

/**
 * Get V2 quote
 */
async function getV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const quote = await v2Swap.getQuote(chainKey, tokenIn, tokenOut, amountIn);
    return { amountOut: quote.amountOut, fee: null };
  } catch (error) {
    throw new Error(`V2 quote failed: ${error.message}`);
  }
}

/**
 * Get V3 quote (finds best fee if not specified)
 */
async function getV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee = null) {
  try {
    if (fee) {
      const amountOut = await v3Swap.getQuote(chainKey, tokenIn, tokenOut, fee, amountIn);
      return { amountOut, fee };
    } else {
      const bestFee = await v3Swap.findBestFee(chainKey, tokenIn, tokenOut, amountIn);
      return { amountOut: bestFee.amountOut, fee: bestFee.fee };
    }
  } catch (error) {
    throw new Error(`V3 quote failed: ${error.message}`);
  }
}

/**
 * Get V4 quote (estimate)
 */
async function getV4Quote(chainKey, tokenIn, tokenOut, amountIn, fee) {
  try {
    const amountOut = await v4Swap.estimateSwapOutput(chainKey, tokenIn, tokenOut, fee, amountIn);
    return { amountOut, fee };
  } catch (error) {
    throw new Error(`V4 quote failed: ${error.message}`);
  }
}

/**
 * Get quotes from all available versions
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount to swap
 * @returns {Promise<Array>} Array of quote results
 */
async function compareQuotes(chainKey, tokenIn, tokenOut, amountIn) {
  // Validate inputs
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const chain = CHAINS[chainKey];
  console.log(`\nComparing quotes on ${chain.name}:`);
  console.log(`  Input: ${amountIn} ${tokenIn}`);
  console.log(`  Output token: ${tokenOut}\n`);

  const results = [];

  // V2 quote
  try {
    const v2Quote = await getV2Quote(chainKey, tokenIn, tokenOut, amountIn);
    results.push({
      version: "v2",
      amountOut: v2Quote.amountOut,
      available: true,
    });
    console.log(`  V2: ${v2Quote.amountOut}`);
  } catch (error) {
    results.push({ version: "v2", error: error.message, available: false });
    console.log(`  V2: Not available`);
  }

  // V3 quote
  try {
    const v3Quote = await getV3Quote(chainKey, tokenIn, tokenOut, amountIn);
    results.push({
      version: "v3",
      amountOut: v3Quote.amountOut,
      fee: v3Quote.fee,
      available: true,
    });
    console.log(`  V3: ${v3Quote.amountOut} (fee: ${v3Quote.fee / 10000}%)`);
  } catch (error) {
    results.push({ version: "v3", error: error.message, available: false });
    console.log(`  V3: Not available`);
  }

  // V4 quote
  try {
    const v4Quote = await getV4Quote(chainKey, tokenIn, tokenOut, amountIn, 3000);
    results.push({
      version: "v4",
      amountOut: v4Quote.amountOut,
      fee: v4Quote.fee,
      available: true,
    });
    console.log(`  V4: ${v4Quote.amountOut} (fee: ${v4Quote.fee / 10000}%)`);
  } catch (error) {
    results.push({ version: "v4", error: error.message, available: false });
    console.log(`  V4: Not available`);
  }

  return results;
}

/**
 * Helper to get common token addresses
 */
function getCommonToken(symbol, chainKey) {
  const token = COMMON_TOKENS[symbol];
  if (!token) {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }
  const address = token[chainKey];
  if (!address) {
    throw new Error(`Token ${symbol} not available on ${chainKey}`);
  }
  return address;
}

module.exports = {
  swapTokens,
  compareQuotes,
  getCommonToken,
  // Re-export version-specific functions for advanced usage
  v2: v2Swap,
  v3: v3Swap,
  v4: v4Swap,
};
