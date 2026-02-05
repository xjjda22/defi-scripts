// Uniswap V2 token swap implementation
// Supports exact input and output swaps across all configured chains
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getProvider } = require("../utils/web3");
const {
  validateChainKey,
  validateWallet,
  validateAddress,
  validateAmount,
  validateSlippage,
} = require("../utils/validation");
const V2_ROUTER_ABI = require("../abis/IUniswapV2Router02.json");
const ERC20_ABI = require("../abis/IERC20.json");

/**
 * Get quote for exact input swap on Uniswap V2
 * @param {string} chainKey - Chain identifier (ethereum, arbitrum, etc.)
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount of input token (in wei/smallest unit)
 * @param {string[]} path - Optional custom path for multi-hop swaps
 * @returns {Promise<{amountOut: string, path: string[]}>}
 */
async function getQuote(chainKey, tokenIn, tokenOut, amountIn, path = null) {
  // Validate inputs
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v2?.router) {
    throw new Error(`Uniswap V2 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.uniswap.v2.router, V2_ROUTER_ABI, provider);

  // Use provided path or default to direct swap
  const swapPath = path || [tokenIn, tokenOut];

  try {
    const amounts = await router.getAmountsOut(amountIn, swapPath);
    return {
      amountOut: amounts[amounts.length - 1].toString(),
      path: swapPath,
    };
  } catch (error) {
    throw new Error(`V2 quote failed: ${error.message}`);
  }
}

/**
 * Get quote for exact output swap on Uniswap V2
 * @param {string} chainKey - Chain identifier
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountOut - Desired amount of output token (in wei/smallest unit)
 * @param {string[]} path - Optional custom path for multi-hop swaps
 * @returns {Promise<{amountIn: string, path: string[]}>}
 */
async function getQuoteForExactOutput(chainKey, tokenIn, tokenOut, amountOut, path = null) {
  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v2?.router) {
    throw new Error(`Uniswap V2 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.uniswap.v2.router, V2_ROUTER_ABI, provider);

  const swapPath = path || [tokenIn, tokenOut];

  try {
    const amounts = await router.getAmountsIn(amountOut, swapPath);
    return {
      amountIn: amounts[0].toString(),
      path: swapPath,
    };
  } catch (error) {
    throw new Error(`V2 quote for exact output failed: ${error.message}`);
  }
}

/**
 * Execute exact input swap on Uniswap V2
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet with private key for signing
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount of input token (in wei/smallest unit)
 * @param {number} slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @param {string} recipient - Recipient address (defaults to wallet address)
 * @param {string[]} path - Optional custom path for multi-hop swaps
 * @returns {Promise<{hash: string, amountOut: string}>}
 */
async function swapExactTokensForTokens(
  chainKey,
  wallet,
  tokenIn,
  tokenOut,
  amountIn,
  slippageBps = 50,
  recipient = null,
  path = null
) {
  // Validate inputs
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v2?.router) {
    throw new Error(`Uniswap V2 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const signer = wallet.connect(provider);
  const recipientAddr = recipient || wallet.address;

  // Get quote to calculate minimum output with slippage
  const quote = await getQuote(chainKey, tokenIn, tokenOut, amountIn, path);
  const amountOutMin = ((BigInt(quote.amountOut) * BigInt(10000 - slippageBps)) / BigInt(10000)).toString();

  // Check and approve token if needed
  const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(wallet.address, chain.uniswap.v2.router);

  if (BigInt(allowance.toString()) < BigInt(amountIn)) {
    console.log(`Approving ${tokenIn} for V2 Router...`);
    const approveTx = await tokenContract.approve(chain.uniswap.v2.router, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`Approval confirmed: ${approveTx.hash}`);
  }

  // Execute swap
  const router = new ethers.Contract(chain.uniswap.v2.router, V2_ROUTER_ABI, signer);

  // Deadline: 20 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  console.log(`\nExecuting V2 swap on ${chain.name}:`);
  console.log(`  Input: ${amountIn} ${tokenIn}`);
  console.log(`  Min Output: ${amountOutMin} ${tokenOut}`);
  console.log(`  Path: ${quote.path.join(" -> ")}`);

  const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, quote.path, recipientAddr, deadline);

  console.log(`Transaction submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  return {
    hash: tx.hash,
    amountOut: amountOutMin,
  };
}

/**
 * Execute exact output swap on Uniswap V2
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet with private key for signing
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountOut - Desired amount of output token (in wei/smallest unit)
 * @param {number} slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @param {string} recipient - Recipient address (defaults to wallet address)
 * @param {string[]} path - Optional custom path for multi-hop swaps
 * @returns {Promise<{hash: string, amountIn: string}>}
 */
async function swapTokensForExactTokens(
  chainKey,
  wallet,
  tokenIn,
  tokenOut,
  amountOut,
  slippageBps = 50,
  recipient = null,
  path = null
) {
  // Validate inputs
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountOut, "amountOut");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.uniswap?.v2?.router) {
    throw new Error(`Uniswap V2 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const signer = wallet.connect(provider);
  const recipientAddr = recipient || wallet.address;

  // Get quote to calculate maximum input with slippage
  const quote = await getQuoteForExactOutput(chainKey, tokenIn, tokenOut, amountOut, path);
  const amountInMax = ((BigInt(quote.amountIn) * BigInt(10000 + slippageBps)) / BigInt(10000)).toString();

  // Check and approve token if needed
  const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(wallet.address, chain.uniswap.v2.router);

  if (BigInt(allowance.toString()) < BigInt(amountInMax)) {
    console.log(`Approving ${tokenIn} for V2 Router...`);
    const approveTx = await tokenContract.approve(chain.uniswap.v2.router, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`Approval confirmed: ${approveTx.hash}`);
  }

  // Execute swap
  const router = new ethers.Contract(chain.uniswap.v2.router, V2_ROUTER_ABI, signer);

  // Deadline: 20 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  console.log(`\nExecuting V2 exact output swap on ${chain.name}:`);
  console.log(`  Max Input: ${amountInMax} ${tokenIn}`);
  console.log(`  Output: ${amountOut} ${tokenOut}`);
  console.log(`  Path: ${quote.path.join(" -> ")}`);

  const tx = await router.swapTokensForExactTokens(amountOut, amountInMax, quote.path, recipientAddr, deadline);

  console.log(`Transaction submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  return {
    hash: tx.hash,
    amountIn: amountInMax,
  };
}

module.exports = {
  getQuote,
  getQuoteForExactOutput,
  swapExactTokensForTokens,
  swapTokensForExactTokens,
};
