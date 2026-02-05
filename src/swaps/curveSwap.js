/**
 * Curve Finance token swap implementation
 * Supports swaps through Curve pools across all configured chains
 */
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getProvider } = require("../utils/web3");
const { validateChainKey, validateWallet, validateAddress, validateAmount, validateSlippage } = require("../utils/validation");
const POOL_ABI = require("../abis/CurvePool.json");
const ERC20_ABI = require("../abis/IERC20.json");

/**
 * Get quote from Curve pool
 * @param {string} chainKey - Chain identifier
 * @param {string} poolAddress - Curve pool address
 * @param {number} i - Index of input token in pool
 * @param {number} j - Index of output token in pool
 * @param {string} amountIn - Amount to swap (in wei)
 * @returns {Promise<string>} Expected output amount
 */
async function getQuote(chainKey, poolAddress, i, j, amountIn) {
  validateChainKey(chainKey);
  validateAddress(poolAddress, 'poolAddress');
  validateAmount(amountIn, 'amountIn');

  const provider = getProvider(chainKey);
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);

  try {
    const amountOut = await pool.get_dy(i, j, amountIn);
    return amountOut.toString();
  } catch (error) {
    throw new Error(`Curve quote failed: ${error.message}`);
  }
}

/**
 * Get pool information
 * @param {string} chainKey - Chain identifier
 * @param {string} poolAddress - Curve pool address
 * @param {number} numCoins - Number of coins in the pool
 * @returns {Promise<object>} Pool info including coins, balances, fee, A parameter
 */
async function getPoolInfo(chainKey, poolAddress, numCoins = 2) {
  validateChainKey(chainKey);
  validateAddress(poolAddress, 'poolAddress');

  const provider = getProvider(chainKey);
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);

  try {
    const coins = [];
    const balances = [];
    
    for (let i = 0; i < numCoins; i++) {
      const coin = await pool.coins(i);
      const balance = await pool.balances(i);
      coins.push(coin);
      balances.push(balance.toString());
    }

    const fee = await pool.fee();
    const virtualPrice = await pool.get_virtual_price();
    
    let amplification = null;
    try {
      amplification = await pool.A();
    } catch (e) {
      // Some pools don't have A parameter (crypto pools)
    }

    return {
      coins,
      balances,
      fee: fee.toString(),
      virtualPrice: virtualPrice.toString(),
      amplification: amplification ? amplification.toString() : null,
    };
  } catch (error) {
    throw new Error(`Failed to get pool info: ${error.message}`);
  }
}

/**
 * Execute Curve swap with automatic pool selection (if multiple pools available)
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet for signing
 * @param {string} poolAddress - Curve pool address (or array of pool addresses to compare)
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} i - Index of input token in pool
 * @param {number} j - Index of output token in pool
 * @param {string} amountIn - Amount to swap (in wei)
 * @param {number} slippageBps - Slippage tolerance in basis points (default: 50 = 0.5%)
 * @returns {Promise<{hash: string, amountOut: string}>}
 */
async function swapTokens(chainKey, wallet, poolAddress, tokenIn, tokenOut, i, j, amountIn, slippageBps = 50) {
  // If multiple pools provided, compare and pick best
  if (Array.isArray(poolAddress)) {
    console.log(`Comparing ${poolAddress.length} Curve pools...`);
    
    let bestPool = null;
    let bestQuote = BigInt(0);
    
    for (const pool of poolAddress) {
      try {
        const quote = await getQuote(chainKey, pool, i, j, amountIn);
        if (BigInt(quote) > bestQuote) {
          bestQuote = BigInt(quote);
          bestPool = pool;
        }
      } catch (e) {
        console.log(`Pool ${pool}: Failed to get quote`);
      }
    }
    
    if (!bestPool) {
      throw new Error("No valid Curve pools found");
    }
    
    console.log(`Best Curve pool: ${bestPool}`);
    poolAddress = bestPool;
  }
  
  return await executeSwap(chainKey, wallet, poolAddress, tokenIn, tokenOut, i, j, amountIn, slippageBps);
}

/**
 * Internal swap execution function
 */
async function executeSwap(chainKey, wallet, poolAddress, tokenIn, tokenOut, i, j, amountIn, slippageBps) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(poolAddress, 'poolAddress');
  validateAddress(tokenIn, 'tokenIn');
  validateAddress(tokenOut, 'tokenOut');
  validateAmount(amountIn, 'amountIn');
  validateSlippage(slippageBps);

  const provider = wallet.provider || getProvider(chainKey);
  const walletWithProvider = wallet.connect(provider);
  
  const pool = new ethers.Contract(poolAddress, POOL_ABI, walletWithProvider);
  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, walletWithProvider);
  
  const allowance = await tokenInContract.allowance(wallet.address, poolAddress);
  if (BigInt(allowance) < BigInt(amountIn)) {
    console.log("Approving Curve pool...");
    const approveTx = await tokenInContract.approve(poolAddress, amountIn);
    await approveTx.wait();
  }

  const quote = await getQuote(chainKey, poolAddress, i, j, amountIn);
  const minAmountOut = (BigInt(quote) * BigInt(10000 - slippageBps)) / BigInt(10000);

  console.log(`Executing Curve swap on ${CHAINS[chainKey].name}...`);
  console.log(`Expected output: ${quote}`);
  console.log(`Minimum output: ${minAmountOut.toString()}`);

  const tx = await pool.exchange(i, j, amountIn, minAmountOut);
  const receipt = await tx.wait();
  
  return {
    hash: receipt.hash,
    amountOut: quote,
    poolAddress: poolAddress,
  };
}

// Keep swapTokens exported with the new name
module.exports = {
  swapTokens,
  executeSwap,
  getQuote,
  getPoolInfo,
  findTokenIndices,
};

/**
 * Find token indices in pool
 * Helper function to find which indices correspond to tokenIn and tokenOut
 */
async function findTokenIndices(chainKey, poolAddress, tokenIn, tokenOut, numCoins = 2) {
  const poolInfo = await getPoolInfo(chainKey, poolAddress, numCoins);
  
  let indexIn = -1;
  let indexOut = -1;
  
  for (let i = 0; i < poolInfo.coins.length; i++) {
    if (poolInfo.coins[i].toLowerCase() === tokenIn.toLowerCase()) {
      indexIn = i;
    }
    if (poolInfo.coins[i].toLowerCase() === tokenOut.toLowerCase()) {
      indexOut = i;
    }
  }
  
  if (indexIn === -1 || indexOut === -1) {
    throw new Error("Tokens not found in pool");
  }
  
  return { i: indexIn, j: indexOut };
}

