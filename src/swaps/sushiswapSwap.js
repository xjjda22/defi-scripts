/**
 * SushiSwap token swap implementation
 * Supports V2 and V3 swaps across all configured chains
 */
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getProvider, getContract } = require("../utils/web3");
const {
  validateChainKey,
  validateWallet,
  validateAddress,
  validateAmount,
  validateSlippage,
} = require("../utils/validation");
const V2_ROUTER_ABI = require("../abis/IUniswapV2Router02.json");
const V3_ROUTER_ABI = require("../abis/ISwapRouter.json");
const QUOTER_ABI = require("../abis/IQuoter.json");
const ERC20_ABI = require("../abis/IERC20.json");

/**
 * Get quote for SushiSwap V2 swap
 */
async function getV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v2?.router) {
    throw new Error(`SushiSwap V2 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const router = new ethers.Contract(chain.sushiswap.v2.router, V2_ROUTER_ABI, provider);

  try {
    const path = [tokenIn, tokenOut];
    const amounts = await router.getAmountsOut(amountIn, path);
    return {
      amountOut: amounts[amounts.length - 1].toString(),
      path,
    };
  } catch (error) {
    throw new Error(`SushiSwap V2 quote failed: ${error.message}`);
  }
}

/**
 * Get quote for SushiSwap V3 swap
 */
async function getV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee = 3000) {
  validateChainKey(chainKey);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v3?.quoter) {
    throw new Error(`SushiSwap V3 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const quoter = new ethers.Contract(chain.sushiswap.v3.quoter, QUOTER_ABI, provider);

  try {
    const params = {
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      sqrtPriceLimitX96: 0,
    };

    const result = await quoter.quoteExactInputSingle.staticCall(params);
    return {
      amountOut: result.toString(),
      fee,
    };
  } catch (error) {
    throw new Error(`SushiSwap V3 quote failed: ${error.message}`);
  }
}

/**
 * Execute SushiSwap V2 swap
 */
async function swapV2(chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps = 50, recipient = null) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v2?.router) {
    throw new Error(`SushiSwap V2 not available on ${chainKey}`);
  }

  const provider = wallet.provider || getProvider(chainKey);
  const walletWithProvider = wallet.connect(provider);

  const router = new ethers.Contract(chain.sushiswap.v2.router, V2_ROUTER_ABI, walletWithProvider);

  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, walletWithProvider);

  const allowance = await tokenInContract.allowance(wallet.address, chain.sushiswap.v2.router);
  if (BigInt(allowance) < BigInt(amountIn)) {
    console.log("Approving SushiSwap V2 Router...");
    const approveTx = await tokenInContract.approve(chain.sushiswap.v2.router, amountIn);
    await approveTx.wait();
  }

  const quote = await getV2Quote(chainKey, tokenIn, tokenOut, amountIn);
  const minAmountOut = (BigInt(quote.amountOut) * BigInt(10000 - slippageBps)) / BigInt(10000);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const to = recipient || wallet.address;

  const tx = await router.swapExactTokensForTokens(amountIn, minAmountOut, quote.path, to, deadline);

  const receipt = await tx.wait();
  return {
    version: "v2",
    hash: receipt.hash,
    amountOut: quote.amountOut,
  };
}

/**
 * Execute SushiSwap V3 swap
 */
async function swapV3(chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps = 50, fee = 3000, recipient = null) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.sushiswap?.v3?.router) {
    throw new Error(`SushiSwap V3 not available on ${chainKey}`);
  }

  const provider = wallet.provider || getProvider(chainKey);
  const walletWithProvider = wallet.connect(provider);

  const router = new ethers.Contract(chain.sushiswap.v3.router, V3_ROUTER_ABI, walletWithProvider);

  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, walletWithProvider);

  const allowance = await tokenInContract.allowance(wallet.address, chain.sushiswap.v3.router);
  if (BigInt(allowance) < BigInt(amountIn)) {
    console.log("Approving SushiSwap V3 Router...");
    const approveTx = await tokenInContract.approve(chain.sushiswap.v3.router, amountIn);
    await approveTx.wait();
  }

  const quote = await getV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee);
  const minAmountOut = (BigInt(quote.amountOut) * BigInt(10000 - slippageBps)) / BigInt(10000);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const to = recipient || wallet.address;

  const params = {
    tokenIn,
    tokenOut,
    fee,
    recipient: to,
    deadline,
    amountIn,
    amountOutMinimum: minAmountOut,
    sqrtPriceLimitX96: 0,
  };

  const tx = await router.exactInputSingle(params);
  const receipt = await tx.wait();

  return {
    version: "v3",
    hash: receipt.hash,
    amountOut: quote.amountOut,
  };
}

/**
 * Auto-select best SushiSwap version and execute swap
 */
async function swapTokens(chainKey, wallet, tokenIn, tokenOut, amountIn, options = {}) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, "tokenIn");
  validateAddress(tokenOut, "tokenOut");
  validateAmount(amountIn, "amountIn");

  const { slippageBps = 50, recipient = null, version = null, fee = 3000 } = options;

  validateSlippage(slippageBps);

  if (version === "v2") {
    return await swapV2(chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps, recipient);
  }

  if (version === "v3") {
    return await swapV3(chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps, fee, recipient);
  }

  const quotes = await Promise.allSettled([
    getV2Quote(chainKey, tokenIn, tokenOut, amountIn),
    getV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee),
  ]);

  let bestVersion = null;
  let bestAmountOut = BigInt(0);

  quotes.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      const versions = ["v2", "v3"];
      const amountOut = BigInt(result.value.amountOut);
      if (amountOut > bestAmountOut) {
        bestAmountOut = amountOut;
        bestVersion = versions[idx];
      }
    }
  });

  if (!bestVersion) {
    throw new Error("No valid swap routes found");
  }

  console.log(`Best route: SushiSwap ${bestVersion.toUpperCase()}`);
  console.log(`Expected output: ${bestAmountOut.toString()}`);

  if (bestVersion === "v2") {
    return await swapV2(chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps, recipient);
  } else {
    return await swapV3(chainKey, wallet, tokenIn, tokenOut, amountIn, slippageBps, fee, recipient);
  }
}

module.exports = {
  swapTokens,
  swapV2,
  swapV3,
  getV2Quote,
  getV3Quote,
};
