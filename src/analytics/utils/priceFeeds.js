// Price feed utilities for fetching and formatting token prices
// Shared across all analytics scripts
const { ethers } = require("ethers");
const { getProvider, getContract } = require("../../utils/web3");
const ERC20_ABI = require("../../abis/IERC20.json");

/**
 * Get token decimals
 * @param {string} tokenAddress - Token contract address
 * @param {string} chainKey - Chain key (ethereum, arbitrum, etc.)
 * @returns {Promise<number>} Token decimals
 */
async function getTokenDecimals(tokenAddress, chainKey) {
  try {
    const provider = getProvider(chainKey);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await token.decimals();
  } catch (error) {
    console.warn(`Could not fetch decimals for ${tokenAddress}, using 18`);
    return 18;
  }
}

/**
 * Get token symbol
 * @param {string} tokenAddress - Token contract address
 * @param {string} chainKey - Chain key
 * @returns {Promise<string>} Token symbol
 */
async function getTokenSymbol(tokenAddress, chainKey) {
  try {
    const provider = getProvider(chainKey);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await token.symbol();
  } catch (error) {
    return "UNKNOWN";
  }
}

/**
 * Get token info (symbol, decimals, name)
 * @param {string} tokenAddress - Token contract address
 * @param {string} chainKey - Chain key
 * @returns {Promise<Object>} Token info
 */
async function getTokenInfo(tokenAddress, chainKey) {
  try {
    const provider = getProvider(chainKey);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    // Add timeout to prevent hanging
    const timeout = ms => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

    const [symbol, decimals, name] = await Promise.race([
      Promise.all([
        token.symbol().catch(e => {
          console.error(`Symbol error: ${e.message}`);
          return "UNKNOWN";
        }),
        token.decimals().catch(e => {
          console.error(`Decimals error: ${e.message}`);
          return 18;
        }),
        token.name().catch(e => {
          console.error(`Name error: ${e.message}`);
          return "Unknown Token";
        }),
      ]),
      timeout(10000), // 10 second timeout
    ]).catch(e => {
      console.error(`getTokenInfo error for ${tokenAddress}: ${e.message}`);
      return ["UNKNOWN", 18, "Unknown Token"];
    });

    return { symbol, decimals, name, address: tokenAddress };
  } catch (error) {
    console.error(`getTokenInfo catch error: ${error.message}`);
    return {
      symbol: "UNKNOWN",
      decimals: 18,
      name: "Unknown Token",
      address: tokenAddress,
    };
  }
}

/**
 * Format token amount from wei to decimal
 * @param {bigint|string} amount - Amount in wei
 * @param {number} decimals - Token decimals
 * @returns {string} Formatted amount
 */
function formatTokenAmount(amount, decimals) {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Parse token amount from decimal to wei
 * @param {string} amount - Amount in decimal
 * @param {number} decimals - Token decimals
 * @returns {bigint} Amount in wei
 */
function parseTokenAmount(amount, decimals) {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Calculate price impact
 * @param {number} expectedOutput - Expected output amount
 * @param {number} actualOutput - Actual output amount
 * @returns {number} Price impact as percentage
 */
function calculatePriceImpact(expectedOutput, actualOutput) {
  if (expectedOutput === 0) return 0;
  return ((expectedOutput - actualOutput) / expectedOutput) * 100;
}

/**
 * Calculate price from token amounts
 * @param {string} amountIn - Input amount (formatted)
 * @param {string} amountOut - Output amount (formatted)
 * @returns {number} Price (output per input)
 */
function calculatePrice(amountIn, amountOut) {
  const input = parseFloat(amountIn);
  const output = parseFloat(amountOut);
  if (input === 0) return 0;
  return output / input;
}

/**
 * Calculate inverse price
 * @param {number} price - Original price
 * @returns {number} Inverse price
 */
function calculateInversePrice(price) {
  if (price === 0) return 0;
  return 1 / price;
}

/**
 * Format price with appropriate decimals
 * @param {number} price - Price value
 * @returns {string} Formatted price
 */
function formatPriceValue(price) {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toExponential(2);
}

/**
 * Calculate percentage difference between two values
 * @param {number} value1 - First value
 * @param {number} value2 - Second value
 * @returns {number} Percentage difference
 */
function calculatePercentageDiff(value1, value2) {
  if (value2 === 0) return 0;
  return ((value1 - value2) / value2) * 100;
}

/**
 * Get best price from multiple sources
 * @param {Array<{source: string, price: number}>} prices - Array of price sources
 * @param {boolean} isBuy - True if buying (want highest output), false if selling
 * @returns {Object} Best price source
 */
function getBestPrice(prices, isBuy = true) {
  if (!prices || prices.length === 0) return null;

  return prices.reduce((best, current) => {
    if (!best) return current;
    // When buying, we want the highest output (best price)
    // When selling, we want the lowest input (best price)
    if (isBuy) {
      return current.price > best.price ? current : best;
    } else {
      return current.price < best.price ? current : best;
    }
  });
}

/**
 * Format liquidity amount
 * @param {number} liquidity - Liquidity value
 * @returns {string} Formatted liquidity
 */
function formatLiquidity(liquidity) {
  if (liquidity >= 1e9) return `$${(liquidity / 1e9).toFixed(2)}B`;
  if (liquidity >= 1e6) return `$${(liquidity / 1e6).toFixed(2)}M`;
  if (liquidity >= 1e3) return `$${(liquidity / 1e3).toFixed(2)}K`;
  return `$${liquidity.toFixed(2)}`;
}

/**
 * Validate price data
 * @param {number} price - Price to validate
 * @returns {boolean} True if valid
 */
function isValidPrice(price) {
  return price !== null && price !== undefined && !isNaN(price) && price > 0 && isFinite(price);
}

/**
 * Calculate spread between bid and ask
 * @param {number} bid - Bid price
 * @param {number} ask - Ask price
 * @returns {Object} Spread info
 */
function calculateSpread(bid, ask) {
  const spread = ask - bid;
  const spreadPercent = (spread / bid) * 100;
  return {
    spread,
    spreadPercent,
    midPrice: (bid + ask) / 2,
  };
}

module.exports = {
  getTokenDecimals,
  getTokenSymbol,
  getTokenInfo,
  formatTokenAmount,
  parseTokenAmount,
  calculatePrice,
  calculateInversePrice,
  calculatePriceImpact,
  calculatePercentageDiff,
  formatPriceValue,
  getBestPrice,
  formatLiquidity,
  isValidPrice,
  calculateSpread,
};
