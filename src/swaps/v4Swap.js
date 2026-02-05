// Uniswap V4 token swap implementation
// V4 uses singleton PoolManager architecture with hooks
// NOTE: V4 requires interaction through router contracts or direct PoolManager calls
// This implementation provides base functionality; production use should implement proper router logic
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getProvider } = require("../utils/web3");
const {
  validateChainKey,
  validateWallet,
  validateAddress,
  validateAmount,
  validateSlippage,
  validateFeeTier,
} = require("../utils/validation");
const POOL_MANAGER_ABI = require("../abis/IPoolManager.json");
const ERC20_ABI = require("../abis/IERC20.json");

// V4 uses same fee tiers as V3
const FEE_TIERS = {
  LOWEST: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000, // 1%
};

// Common tick spacings for different fee tiers
const TICK_SPACING = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

// Zero address used for native ETH in V4
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Create a PoolKey struct for V4
 * @param {string} token0 - First token address (lower address)
 * @param {string} token1 - Second token address (higher address)
 * @param {number} fee - Fee tier
 * @param {number} tickSpacing - Tick spacing
 * @param {string} hooks - Hooks contract address (ADDRESS_ZERO for no hooks)
 * @returns {object} PoolKey object
 */
function createPoolKey(token0, token1, fee, tickSpacing, hooks = ADDRESS_ZERO) {
  // Ensure tokens are in correct order (token0 < token1)
  const [currency0, currency1] = token0.toLowerCase() < token1.toLowerCase() ? [token0, token1] : [token1, token0];

  return {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
  };
}

/**
 * Get pool state from PoolManager
 * @param {string} chainKey - Chain identifier
 * @param {object} poolKey - PoolKey struct
 * @returns {Promise<{sqrtPriceX96: bigint, tick: number, protocolFee: number, lpFee: number}>}
 */
async function getPoolState(chainKey, poolKey) {
  // Validate inputs
  validateChainKey(chainKey);
  validateAddress(poolKey.currency0, "poolKey.currency0");
  validateAddress(poolKey.currency1, "poolKey.currency1");
  validateFeeTier(poolKey.fee);

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v4?.poolManager) {
    throw new Error(`Uniswap V4 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const poolManager = new ethers.Contract(chain.uniswap.v4.poolManager, POOL_MANAGER_ABI, provider);

  try {
    const slot0 = await poolManager.getSlot0(poolKey);
    return {
      sqrtPriceX96: slot0[0],
      tick: slot0[1],
      protocolFee: slot0[2],
      lpFee: slot0[3],
    };
  } catch (error) {
    throw new Error(`Failed to get pool state: ${error.message}`);
  }
}

/**
 * Calculate expected output for V4 swap
 * Note: This is a simplified approximation. Production should use proper math libraries
 * or query actual swap through static call
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} fee - Fee tier
 * @param {string} amountIn - Amount of input token
 * @returns {Promise<string>} Estimated output amount
 */
async function estimateSwapOutput(chainKey, tokenIn, tokenOut, fee, amountIn) {
  // Validate inputs
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateFeeTier(fee);
  validateAmount(amountIn, "amountIn");

  const tickSpacing = TICK_SPACING[fee] || 60;
  const poolKey = createPoolKey(tokenIn, tokenOut, fee, tickSpacing);

  try {
    const poolState = await getPoolState(chainKey, poolKey);

    // Simple approximation: deduct fee from input
    // In production, use proper sqrt price math or static call
    const feeAmount = (BigInt(amountIn) * BigInt(fee)) / BigInt(1000000);
    const amountInAfterFee = BigInt(amountIn) - feeAmount;

    // This is a rough estimate; actual amount depends on current pool price
    // For production, implement proper V4 quote logic or use router
    return amountInAfterFee.toString();
  } catch (error) {
    throw new Error(`Failed to estimate swap: ${error.message}`);
  }
}

/**
 * Execute swap on Uniswap V4 PoolManager
 * WARNING: This is a low-level function. For production, use V4 router contracts
 * that handle proper encoding, multi-step actions, and hook interactions
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet with private key
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} fee - Fee tier
 * @param {string} amountIn - Amount of input token (negative for exact output)
 * @param {number} slippageBps - Slippage tolerance in basis points
 * @param {string} recipient - Recipient address
 * @returns {Promise<{hash: string, delta: string}>}
 */
async function swapV4(chainKey, wallet, tokenIn, tokenOut, fee, amountIn, slippageBps = 50, recipient = null) {
  // Validate inputs
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateFeeTier(fee);
  validateAmount(amountIn, "amountIn");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v4?.poolManager) {
    throw new Error(`Uniswap V4 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const signer = wallet.connect(provider);
  const recipientAddr = recipient || wallet.address;

  // Determine swap direction
  const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
  const tickSpacing = TICK_SPACING[fee] || 60;

  // Create pool key
  const poolKey = createPoolKey(tokenIn, tokenOut, fee, tickSpacing);

  // Check and approve token if needed
  const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(wallet.address, chain.uniswap.v4.poolManager);

  if (BigInt(allowance.toString()) < BigInt(amountIn)) {
    console.log(`Approving ${tokenIn} for V4 PoolManager...`);
    const approveTx = await tokenContract.approve(chain.uniswap.v4.poolManager, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`Approval confirmed: ${approveTx.hash}`);
  }

  // Estimate output for slippage protection
  const estimatedOut = await estimateSwapOutput(chainKey, tokenIn, tokenOut, fee, amountIn);

  // Prepare swap params
  const swapParams = {
    zeroForOne,
    amountSpecified: amountIn, // Positive for exact input
    sqrtPriceLimitX96: 0, // No price limit (in production, calculate based on slippage)
  };

  const poolManager = new ethers.Contract(chain.uniswap.v4.poolManager, POOL_MANAGER_ABI, signer);

  console.log(`\nExecuting V4 swap on ${chain.name}:`);
  console.log(`  Input: ${amountIn} ${tokenIn}`);
  console.log(`  Estimated Output: ${estimatedOut} ${tokenOut}`);
  console.log(`  Fee Tier: ${fee / 10000}%`);
  console.log(`  Direction: ${zeroForOne ? "0->1" : "1->0"}`);
  console.log(`\n⚠️  NOTE: V4 requires router contract for production use. This is direct PoolManager interaction.`);

  try {
    // V4 swaps require additional steps (settle/take) that are typically handled by routers
    // This is a simplified example showing the swap call structure
    const tx = await poolManager.swap(
      poolKey,
      swapParams,
      "0x" // Hook data (empty for no hooks)
    );

    console.log(`Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    return {
      hash: tx.hash,
      delta: estimatedOut,
    };
  } catch (error) {
    throw new Error(`V4 swap failed: ${error.message}`);
  }
}

/**
 * Get information about V4 availability and requirements
 * @returns {object} V4 implementation notes
 */
function getV4Info() {
  return {
    architecture: "Singleton PoolManager with Hooks",
    launched: "January 31, 2025",
    requirements: [
      "Direct PoolManager interaction requires manual settle/take calls",
      "Production apps should use V4 Router contracts",
      "Hooks can customize swap behavior",
      "Uses flash accounting for gas efficiency",
    ],
    differences: [
      "Single PoolManager contract vs. factory pattern",
      "Hooks enable custom logic per pool",
      "More gas efficient through singleton design",
      "Native ETH support without WETH wrapping",
    ],
    notes:
      "This implementation provides low-level PoolManager access. For production swaps, use official V4 router contracts that handle multi-step operations and proper token accounting.",
  };
}

module.exports = {
  FEE_TIERS,
  TICK_SPACING,
  ADDRESS_ZERO,
  createPoolKey,
  getPoolState,
  estimateSwapOutput,
  swapV4,
  getV4Info,
};
