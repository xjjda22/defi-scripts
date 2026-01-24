// Token helper utilities for swap operations
// Provides functions to check balances, allowances, and token info
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getProvider } = require("./web3");
const ERC20_ABI = require("../abis/IERC20.json");

/**
 * Get token balance for an address
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenAddress - Token contract address
 * @param {string} walletAddress - Wallet address to check
 * @returns {Promise<{balance: string, decimals: number, symbol: string}>}
 */
async function getTokenBalance(chainKey, tokenAddress, walletAddress) {
  const provider = getProvider(chainKey);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  try {
    const [balance, decimals, symbol] = await Promise.all([
      token.balanceOf(walletAddress),
      token.decimals(),
      token.symbol(),
    ]);

    return {
      balance: balance.toString(),
      decimals: Number(decimals),
      symbol,
      formatted: ethers.formatUnits(balance, decimals),
    };
  } catch (error) {
    throw new Error(`Failed to get token balance: ${error.message}`);
  }
}

/**
 * Get token allowance for a spender
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenAddress - Token contract address
 * @param {string} ownerAddress - Token owner address
 * @param {string} spenderAddress - Spender address (usually router)
 * @returns {Promise<{allowance: string, decimals: number}>}
 */
async function getTokenAllowance(
  chainKey,
  tokenAddress,
  ownerAddress,
  spenderAddress,
) {
  const provider = getProvider(chainKey);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  try {
    const [allowance, decimals] = await Promise.all([
      token.allowance(ownerAddress, spenderAddress),
      token.decimals(),
    ]);

    return {
      allowance: allowance.toString(),
      decimals: Number(decimals),
      formatted: ethers.formatUnits(allowance, decimals),
      isUnlimited: allowance >= ethers.MaxUint256 / BigInt(2),
    };
  } catch (error) {
    throw new Error(`Failed to get token allowance: ${error.message}`);
  }
}

/**
 * Check if wallet has sufficient balance for swap
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenAddress - Token to check
 * @param {string} walletAddress - Wallet address
 * @param {string} requiredAmount - Required amount in wei
 * @returns {Promise<{sufficient: boolean, balance: string, required: string}>}
 */
async function checkSufficientBalance(
  chainKey,
  tokenAddress,
  walletAddress,
  requiredAmount,
) {
  const balanceInfo = await getTokenBalance(chainKey, tokenAddress, walletAddress);

  return {
    sufficient: BigInt(balanceInfo.balance) >= BigInt(requiredAmount),
    balance: balanceInfo.balance,
    required: requiredAmount,
    decimals: balanceInfo.decimals,
    symbol: balanceInfo.symbol,
  };
}

/**
 * Check if approval is needed for a swap
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenAddress - Token to check
 * @param {string} ownerAddress - Token owner
 * @param {string} spenderAddress - Spender (router)
 * @param {string} requiredAmount - Required amount in wei
 * @returns {Promise<{needsApproval: boolean, currentAllowance: string, required: string}>}
 */
async function checkNeedsApproval(
  chainKey,
  tokenAddress,
  ownerAddress,
  spenderAddress,
  requiredAmount,
) {
  const allowanceInfo = await getTokenAllowance(
    chainKey,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  );

  return {
    needsApproval: BigInt(allowanceInfo.allowance) < BigInt(requiredAmount),
    currentAllowance: allowanceInfo.allowance,
    required: requiredAmount,
    isUnlimited: allowanceInfo.isUnlimited,
  };
}

/**
 * Get comprehensive token info
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<{symbol: string, decimals: number, address: string}>}
 */
async function getTokenInfo(chainKey, tokenAddress) {
  const provider = getProvider(chainKey);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  try {
    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);

    return {
      symbol,
      decimals: Number(decimals),
      address: tokenAddress,
      chain: chainKey,
      chainName: CHAINS[chainKey].name,
    };
  } catch (error) {
    throw new Error(`Failed to get token info: ${error.message}`);
  }
}

/**
 * Get native token (ETH) balance
 * @param {string} chainKey - Chain identifier
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<{balance: string, formatted: string}>}
 */
async function getNativeBalance(chainKey, walletAddress) {
  const provider = getProvider(chainKey);

  try {
    const balance = await provider.getBalance(walletAddress);

    return {
      balance: balance.toString(),
      formatted: ethers.formatEther(balance),
      symbol: "ETH",
    };
  } catch (error) {
    throw new Error(`Failed to get native balance: ${error.message}`);
  }
}

/**
 * Pre-flight check before executing a swap
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} walletAddress - Wallet address
 * @param {string} spenderAddress - Spender address (router)
 * @param {string} amountIn - Amount to swap
 * @returns {Promise<{ready: boolean, checks: object}>}
 */
async function preFlightCheck(
  chainKey,
  tokenIn,
  walletAddress,
  spenderAddress,
  amountIn,
) {
  const checks = {
    balance: { passed: false },
    allowance: { passed: false },
    gas: { passed: false },
  };

  try {
    // Check balance
    const balanceCheck = await checkSufficientBalance(
      chainKey,
      tokenIn,
      walletAddress,
      amountIn,
    );
    checks.balance = {
      passed: balanceCheck.sufficient,
      ...balanceCheck,
    };

    // Check allowance
    const approvalCheck = await checkNeedsApproval(
      chainKey,
      tokenIn,
      walletAddress,
      spenderAddress,
      amountIn,
    );
    checks.allowance = {
      passed: !approvalCheck.needsApproval || approvalCheck.isUnlimited,
      ...approvalCheck,
    };

    // Check native balance for gas
    const gasBalance = await getNativeBalance(chainKey, walletAddress);
    const minGasBalance = ethers.parseEther("0.001"); // Require at least 0.001 ETH for gas
    checks.gas = {
      passed: BigInt(gasBalance.balance) >= minGasBalance,
      balance: gasBalance.balance,
      formatted: gasBalance.formatted,
    };

    const ready =
      checks.balance.passed && checks.allowance.passed && checks.gas.passed;

    return { ready, checks };
  } catch (error) {
    throw new Error(`Pre-flight check failed: ${error.message}`);
  }
}

/**
 * Format amount with token symbol
 * @param {string} amount - Amount in wei
 * @param {number} decimals - Token decimals
 * @param {string} symbol - Token symbol
 * @returns {string} Formatted string
 */
function formatTokenAmount(amount, decimals, symbol) {
  const formatted = ethers.formatUnits(amount, decimals);
  return `${formatted} ${symbol}`;
}

module.exports = {
  getTokenBalance,
  getTokenAllowance,
  checkSufficientBalance,
  checkNeedsApproval,
  getTokenInfo,
  getNativeBalance,
  preFlightCheck,
  formatTokenAmount,
};
