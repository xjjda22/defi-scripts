/**
 * DEX Aggregator - Auto-route across all supported protocols
 * Compares quotes from Uniswap, SushiSwap, Curve, and Balancer
 * Automatically executes on the protocol with the best price
 */
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const {
  validateChainKey,
  validateWallet,
  validateAddress,
  validateAmount,
  validateSlippage,
} = require("../utils/validation");
const uniswapSwap = require("./swap");
const sushiswapSwap = require("./sushiswapSwap");
const curveSwap = require("./curveSwap");
const balancerSwap = require("./balancerSwap");

/**
 * Get best quote across all DEX protocols
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount to swap (in wei)
 * @param {object} options - Optional protocol-specific parameters
 * @returns {Promise<{protocol: string, version: string, amountOut: string, details: object}>}
 */
async function getBestQuote(chainKey, tokenIn, tokenOut, amountIn, options = {}) {
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const { curvePoolAddress = null, curveTokenIndices = null, balancerPoolId = null } = options;

  console.log(`\nComparing quotes across all DEX protocols on ${CHAINS[chainKey].name}...`);

  const quotes = [];

  // Try Uniswap (V2, V3, V4)
  try {
    const uniV2 = await uniswapSwap.getV2Quote(chainKey, tokenIn, tokenOut, amountIn);
    quotes.push({
      protocol: "uniswap",
      version: "v2",
      amountOut: uniV2.amountOut,
      details: { path: uniV2.path },
    });
  } catch (e) {
    console.log(`Uniswap V2: Not available`);
  }

  try {
    const uniV3 = await uniswapSwap.getV3Quote(chainKey, tokenIn, tokenOut, amountIn);
    quotes.push({
      protocol: "uniswap",
      version: "v3",
      amountOut: uniV3.amountOut,
      details: { fee: uniV3.fee },
    });
  } catch (e) {
    console.log(`Uniswap V3: Not available`);
  }

  try {
    const uniV4 = await uniswapSwap.getV4Quote(chainKey, tokenIn, tokenOut, amountIn, 3000);
    quotes.push({
      protocol: "uniswap",
      version: "v4",
      amountOut: uniV4.amountOut,
      details: { fee: uniV4.fee },
    });
  } catch (e) {
    console.log(`Uniswap V4: Not available`);
  }

  // Try SushiSwap (V2, V3)
  try {
    const sushiV2 = await sushiswapSwap.getV2Quote(chainKey, tokenIn, tokenOut, amountIn);
    quotes.push({
      protocol: "sushiswap",
      version: "v2",
      amountOut: sushiV2.amountOut,
      details: { path: sushiV2.path },
    });
  } catch (e) {
    console.log(`SushiSwap V2: Not available`);
  }

  try {
    const sushiV3 = await sushiswapSwap.getV3Quote(chainKey, tokenIn, tokenOut, amountIn, 3000);
    quotes.push({
      protocol: "sushiswap",
      version: "v3",
      amountOut: sushiV3.amountOut,
      details: { fee: sushiV3.fee },
    });
  } catch (e) {
    console.log(`SushiSwap V3: Not available`);
  }

  // Try Curve (if pool address provided)
  if (curvePoolAddress && curveTokenIndices) {
    try {
      const curveQuote = await curveSwap.getQuote(
        chainKey,
        curvePoolAddress,
        curveTokenIndices.i,
        curveTokenIndices.j,
        amountIn
      );
      quotes.push({
        protocol: "curve",
        version: "pool",
        amountOut: curveQuote,
        details: {
          poolAddress: curvePoolAddress,
          indices: curveTokenIndices,
        },
      });
    } catch (e) {
      console.log(`Curve: ${e.message}`);
    }
  }

  // Note: Balancer requires pool ID and doesn't have a quote function in the current implementation
  // Would need to add querySwap to the Balancer Vault ABI for proper quotes

  if (quotes.length === 0) {
    throw new Error("No valid swap routes found across any protocol");
  }

  // Find best quote
  let bestQuote = quotes[0];
  for (const quote of quotes) {
    if (BigInt(quote.amountOut) > BigInt(bestQuote.amountOut)) {
      bestQuote = quote;
    }
  }

  return bestQuote;
}

/**
 * Display all quotes for comparison
 */
function displayQuotes(quotes, bestQuote) {
  console.log("\n" + "=".repeat(80));
  console.log("QUOTE COMPARISON");
  console.log("=".repeat(80));

  quotes.forEach(quote => {
    const isBest = quote.protocol === bestQuote.protocol && quote.version === bestQuote.version;
    const marker = isBest ? " ← BEST" : "";
    const protocolName = `${quote.protocol.toUpperCase()} ${quote.version.toUpperCase()}`;
    console.log(`${protocolName.padEnd(25)} ${quote.amountOut}${marker}`);
  });

  console.log("=".repeat(80) + "\n");
}

/**
 * Auto-route swap across all DEX protocols
 * Finds best price and executes swap on optimal protocol
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet for signing
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount to swap (in wei)
 * @param {object} options - Optional parameters
 * @returns {Promise<{protocol: string, version: string, hash: string, amountOut: string}>}
 */
async function swapTokens(chainKey, wallet, tokenIn, tokenOut, amountIn, options = {}) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const {
    slippageBps = 50,
    recipient = null,
    curvePoolAddress = null,
    curveTokenIndices = null,
    balancerPoolId = null,
    forceProtocol = null,
  } = options;

  validateSlippage(slippageBps);

  // If protocol is forced, skip quote comparison
  if (forceProtocol) {
    console.log(`Forcing ${forceProtocol} protocol...`);
    return await executeSwapOnProtocol(
      forceProtocol,
      chainKey,
      wallet,
      tokenIn,
      tokenOut,
      amountIn,
      slippageBps,
      recipient,
      { curvePoolAddress, curveTokenIndices, balancerPoolId }
    );
  }

  // Get all quotes and find best
  const bestQuote = await getBestQuote(chainKey, tokenIn, tokenOut, amountIn, {
    curvePoolAddress,
    curveTokenIndices,
    balancerPoolId,
  });

  console.log(`\nBest route found: ${bestQuote.protocol.toUpperCase()} ${bestQuote.version.toUpperCase()}`);
  console.log(`Expected output: ${bestQuote.amountOut}\n`);

  // Execute swap on best protocol
  return await executeSwapOnProtocol(
    bestQuote.protocol,
    chainKey,
    wallet,
    tokenIn,
    tokenOut,
    amountIn,
    slippageBps,
    recipient,
    {
      version: bestQuote.version,
      curvePoolAddress: bestQuote.details?.poolAddress,
      curveTokenIndices: bestQuote.details?.indices,
      balancerPoolId,
      fee: bestQuote.details?.fee,
    }
  );
}

/**
 * Execute swap on specific protocol
 */
async function executeSwapOnProtocol(
  protocol,
  chainKey,
  wallet,
  tokenIn,
  tokenOut,
  amountIn,
  slippageBps,
  recipient,
  details = {}
) {
  switch (protocol.toLowerCase()) {
    case "uniswap":
      return await uniswapSwap.swapTokens(chainKey, wallet, tokenIn, tokenOut, amountIn, {
        slippageBps,
        recipient,
        version: details.version,
        v3Fee: details.fee,
      });

    case "sushiswap":
      return await sushiswapSwap.swapTokens(chainKey, wallet, tokenIn, tokenOut, amountIn, {
        slippageBps,
        recipient,
        version: details.version,
        fee: details.fee,
      });

    case "curve":
      if (!details.curvePoolAddress || !details.curveTokenIndices) {
        throw new Error("Curve swaps require poolAddress and tokenIndices");
      }
      return await curveSwap.swapTokens(
        chainKey,
        wallet,
        details.curvePoolAddress,
        tokenIn,
        tokenOut,
        details.curveTokenIndices.i,
        details.curveTokenIndices.j,
        amountIn,
        slippageBps
      );

    case "balancer":
      if (!details.balancerPoolId) {
        throw new Error("Balancer swaps require poolId");
      }
      return await balancerSwap.swapTokens(chainKey, wallet, details.balancerPoolId, tokenIn, tokenOut, amountIn, {
        slippageBps,
        recipient,
      });

    default:
      throw new Error(`Unknown protocol: ${protocol}`);
  }
}

module.exports = {
  swapTokens,
  getBestQuote,
  displayQuotes,
  executeSwapOnProtocol,
};
