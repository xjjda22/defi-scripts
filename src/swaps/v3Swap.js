// Uniswap V3 token swap implementation
// Supports single and multi-hop swaps with fee tier selection
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
  validateMultiHopPath,
} = require("../utils/validation");
const SWAP_ROUTER_ABI = require("../abis/ISwapRouter.json");
const QUOTER_ABI = require("../abis/IQuoter.json");
const ERC20_ABI = require("../abis/IERC20.json");

// Common V3 fee tiers (in hundredths of basis points)
const FEE_TIERS = {
  LOWEST: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000, // 1%
};

/**
 * Encode path for V3 multi-hop swaps
 * @param {string[]} tokens - Array of token addresses
 * @param {number[]} fees - Array of fee tiers (length should be tokens.length - 1)
 * @returns {string} Encoded path
 */
function encodePath(tokens, fees) {
  if (tokens.length !== fees.length + 1) {
    throw new Error("Invalid path: tokens and fees length mismatch");
  }

  let encoded = "0x";
  for (let i = 0; i < fees.length; i++) {
    // 20 bytes for token address
    encoded += tokens[i].slice(2);
    // 3 bytes for fee
    encoded += fees[i].toString(16).padStart(6, "0");
  }
  // Append last token
  encoded += tokens[tokens.length - 1].slice(2);

  return encoded.toLowerCase();
}

/**
 * Get quote for exact input single swap on Uniswap V3
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} fee - Fee tier (100, 500, 3000, or 10000)
 * @param {string} amountIn - Amount of input token (in wei/smallest unit)
 * @returns {Promise<string>} Expected output amount
 */
async function getQuote(chainKey, tokenIn, tokenOut, fee, amountIn) {
  // Validate inputs
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateFeeTier(fee);
  validateAmount(amountIn, "amountIn");

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v3?.quoter) {
    throw new Error(`Uniswap V3 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.uniswap.v3.quoter, QUOTER_ABI, provider);

  try {
    // sqrtPriceLimitX96 = 0 means no price limit
    const amountOut = await quoter.quoteExactInputSingle.staticCall(tokenIn, tokenOut, fee, amountIn, 0);
    return amountOut.toString();
  } catch (error) {
    throw new Error(`V3 quote failed: ${error.message}`);
  }
}

/**
 * Get quote for multi-hop exact input swap on Uniswap V3
 * @param {string} chainKey - Chain identifier
 * @param {string[]} tokens - Array of token addresses (path)
 * @param {number[]} fees - Array of fee tiers
 * @param {string} amountIn - Amount of input token (in wei/smallest unit)
 * @returns {Promise<string>} Expected output amount
 */
async function getQuoteMultiHop(chainKey, tokens, fees, amountIn) {
  // Validate inputs
  validateChainKey(chainKey);
  validateMultiHopPath(tokens, fees);
  validateAmount(amountIn, "amountIn");

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v3?.quoter) {
    throw new Error(`Uniswap V3 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.uniswap.v3.quoter, QUOTER_ABI, provider);

  const path = encodePath(tokens, fees);

  try {
    const amountOut = await quoter.quoteExactInput.staticCall(path, amountIn);
    return amountOut.toString();
  } catch (error) {
    throw new Error(`V3 multi-hop quote failed: ${error.message}`);
  }
}

/**
 * Find best fee tier for a token pair by checking all common tiers
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount to test with
 * @returns {Promise<{fee: number, amountOut: string}>}
 */
async function findBestFee(chainKey, tokenIn, tokenOut, amountIn) {
  const tiers = [FEE_TIERS.LOWEST, FEE_TIERS.LOW, FEE_TIERS.MEDIUM, FEE_TIERS.HIGH];
  let bestQuote = { fee: FEE_TIERS.MEDIUM, amountOut: "0" };

  for (const fee of tiers) {
    try {
      const amountOut = await getQuote(chainKey, tokenIn, tokenOut, fee, amountIn);
      if (BigInt(amountOut) > BigInt(bestQuote.amountOut)) {
        bestQuote = { fee, amountOut };
      }
    } catch (error) {
      // Pool doesn't exist for this fee tier, skip
      continue;
    }
  }

  if (bestQuote.amountOut === "0") {
    throw new Error("No liquidity found for any fee tier");
  }

  return bestQuote;
}

/**
 * Execute exact input single swap on Uniswap V3
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet with private key for signing
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {number} fee - Fee tier (100, 500, 3000, or 10000)
 * @param {string} amountIn - Amount of input token (in wei/smallest unit)
 * @param {number} slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @param {string} recipient - Recipient address (defaults to wallet address)
 * @returns {Promise<{hash: string, amountOut: string}>}
 */
async function swapExactInputSingle(
  chainKey,
  wallet,
  tokenIn,
  tokenOut,
  fee,
  amountIn,
  slippageBps = 50,
  recipient = null
) {
  // Validate inputs
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateFeeTier(fee);
  validateAmount(amountIn, "amountIn");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v3?.router) {
    throw new Error(`Uniswap V3 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const signer = wallet.connect(provider);
  const recipientAddr = recipient || wallet.address;

  // Get quote to calculate minimum output with slippage
  const quote = await getQuote(chainKey, tokenIn, tokenOut, fee, amountIn);
  const amountOutMin = ((BigInt(quote) * BigInt(10000 - slippageBps)) / BigInt(10000)).toString();

  // Check and approve token if needed
  const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(wallet.address, chain.uniswap.v3.router);

  if (BigInt(allowance.toString()) < BigInt(amountIn)) {
    console.log(`Approving ${tokenIn} for V3 Router...`);
    const approveTx = await tokenContract.approve(chain.uniswap.v3.router, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`Approval confirmed: ${approveTx.hash}`);
  }

  // Execute swap
  const router = new ethers.Contract(chain.uniswap.v3.router, SWAP_ROUTER_ABI, signer);

  // Deadline: 20 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  const params = {
    tokenIn,
    tokenOut,
    fee,
    recipient: recipientAddr,
    deadline,
    amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0, // No price limit
  };

  console.log(`\nExecuting V3 swap on ${chain.name}:`);
  console.log(`  Input: ${amountIn} ${tokenIn}`);
  console.log(`  Min Output: ${amountOutMin} ${tokenOut}`);
  console.log(`  Fee Tier: ${fee / 10000}%`);

  const tx = await router.exactInputSingle(params);

  console.log(`Transaction submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  return {
    hash: tx.hash,
    amountOut: amountOutMin,
  };
}

/**
 * Execute multi-hop exact input swap on Uniswap V3
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet with private key for signing
 * @param {string[]} tokens - Array of token addresses (path)
 * @param {number[]} fees - Array of fee tiers
 * @param {string} amountIn - Amount of input token (in wei/smallest unit)
 * @param {number} slippageBps - Slippage tolerance in basis points
 * @param {string} recipient - Recipient address (defaults to wallet address)
 * @returns {Promise<{hash: string, amountOut: string}>}
 */
async function swapExactInputMultiHop(chainKey, wallet, tokens, fees, amountIn, slippageBps = 50, recipient = null) {
  // Validate inputs
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateMultiHopPath(tokens, fees);
  validateAmount(amountIn, "amountIn");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v3?.router) {
    throw new Error(`Uniswap V3 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const signer = wallet.connect(provider);
  const recipientAddr = recipient || wallet.address;

  // Get quote
  const quote = await getQuoteMultiHop(chainKey, tokens, fees, amountIn);
  const amountOutMin = ((BigInt(quote) * BigInt(10000 - slippageBps)) / BigInt(10000)).toString();

  // Approve input token
  const tokenContract = new ethers.Contract(tokens[0], ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(wallet.address, chain.uniswap.v3.router);

  if (BigInt(allowance.toString()) < BigInt(amountIn)) {
    console.log(`Approving ${tokens[0]} for V3 Router...`);
    const approveTx = await tokenContract.approve(chain.uniswap.v3.router, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`Approval confirmed: ${approveTx.hash}`);
  }

  // Execute swap
  const router = new ethers.Contract(chain.uniswap.v3.router, SWAP_ROUTER_ABI, signer);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const path = encodePath(tokens, fees);

  const params = {
    path,
    recipient: recipientAddr,
    deadline,
    amountIn,
    amountOutMinimum: amountOutMin,
  };

  console.log(`\nExecuting V3 multi-hop swap on ${chain.name}:`);
  console.log(`  Input: ${amountIn} ${tokens[0]}`);
  console.log(`  Min Output: ${amountOutMin} ${tokens[tokens.length - 1]}`);
  console.log(`  Path: ${tokens.join(" -> ")}`);
  console.log(`  Fees: ${fees.map(f => f / 10000 + "%").join(", ")}`);

  const tx = await router.exactInput(params);

  console.log(`Transaction submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  return {
    hash: tx.hash,
    amountOut: amountOutMin,
  };
}

module.exports = {
  FEE_TIERS,
  encodePath,
  getQuote,
  getQuoteMultiHop,
  findBestFee,
  swapExactInputSingle,
  swapExactInputMultiHop,
};
