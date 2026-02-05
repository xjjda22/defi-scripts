// Input validation utilities for swap functions
const { CHAINS } = require("../config/chains");

/**
 * Validates chain key exists in configuration
 * @param {string} chainKey - Chain identifier to validate
 * @throws {Error} If chain key is invalid
 */
function validateChainKey(chainKey) {
  if (!chainKey || typeof chainKey !== "string") {
    throw new Error("Chain key must be a non-empty string");
  }

  if (!CHAINS[chainKey]) {
    const validChains = Object.keys(CHAINS).join(", ");
    throw new Error(`Invalid chain: "${chainKey}". Valid chains: ${validChains}`);
  }
}

/**
 * Validates Ethereum address format
 * @param {string} address - Address to validate
 * @param {string} name - Parameter name for error messages
 * @throws {Error} If address is invalid
 */
function validateAddress(address, name = "address") {
  if (!address || typeof address !== "string") {
    throw new Error(`${name} must be a non-empty string`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid ${name}: "${address}". Must be a valid Ethereum address (0x...)`);
  }
}

/**
 * Validates amount is positive
 * @param {string|number|bigint} amount - Amount to validate
 * @param {string} name - Parameter name for error messages
 * @throws {Error} If amount is invalid
 */
function validateAmount(amount, name = "amount") {
  if (amount === null || amount === undefined || amount === "") {
    throw new Error(`${name} must be provided`);
  }

  let amountBigInt;
  try {
    amountBigInt = BigInt(amount);
  } catch (error) {
    throw new Error(`${name} must be a valid number or string representation`);
  }

  if (amountBigInt <= 0n) {
    throw new Error(`${name} must be greater than 0`);
  }
}

/**
 * Validates slippage tolerance in basis points
 * @param {number} slippageBps - Slippage in basis points
 * @throws {Error} If slippage is invalid
 */
function validateSlippage(slippageBps) {
  if (typeof slippageBps !== "number") {
    throw new Error("Slippage must be a number");
  }

  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error(`Slippage must be between 0 and 10000 basis points (0-100%). Got: ${slippageBps}`);
  }

  if (slippageBps > 1000) {
    console.warn(
      `⚠️  Warning: High slippage tolerance (${slippageBps / 100}%). This may result in unfavorable trades.`
    );
  }
}

/**
 * Validates V3/V4 fee tier
 * @param {number} fee - Fee tier in hundredths of bps
 * @throws {Error} If fee tier is invalid
 */
function validateFeeTier(fee) {
  const validFees = [100, 500, 3000, 10000];

  if (typeof fee !== "number") {
    throw new Error("Fee tier must be a number");
  }

  if (!validFees.includes(fee)) {
    throw new Error(`Invalid fee tier: ${fee}. Valid tiers: ${validFees.join(", ")} (0.01%, 0.05%, 0.3%, 1%)`);
  }
}

/**
 * Validates wallet has private key
 * @param {object} wallet - ethers.Wallet instance
 * @throws {Error} If wallet is invalid
 */
function validateWallet(wallet) {
  if (!wallet || typeof wallet !== "object") {
    throw new Error("Wallet must be an ethers.Wallet instance");
  }

  if (!wallet.address || !wallet.privateKey) {
    throw new Error("Invalid wallet: must have address and privateKey properties");
  }
}

/**
 * Validates multi-hop path
 * @param {string[]} tokens - Array of token addresses
 * @param {number[]} fees - Array of fee tiers (optional)
 * @throws {Error} If path is invalid
 */
function validateMultiHopPath(tokens, fees = null) {
  if (!Array.isArray(tokens)) {
    throw new Error("Tokens must be an array");
  }

  if (tokens.length < 2) {
    throw new Error("Path must contain at least 2 tokens");
  }

  tokens.forEach((token, idx) => {
    validateAddress(token, `token[${idx}]`);
  });

  if (fees !== null) {
    if (!Array.isArray(fees)) {
      throw new Error("Fees must be an array");
    }

    if (fees.length !== tokens.length - 1) {
      throw new Error(`Invalid path: ${tokens.length} tokens requires ${tokens.length - 1} fees, got ${fees.length}`);
    }

    fees.forEach((fee, idx) => {
      try {
        validateFeeTier(fee);
      } catch (error) {
        throw new Error(`fees[${idx}]: ${error.message}`);
      }
    });
  }
}

module.exports = {
  validateChainKey,
  validateAddress,
  validateAmount,
  validateSlippage,
  validateFeeTier,
  validateWallet,
  validateMultiHopPath,
};
