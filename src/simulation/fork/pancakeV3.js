/**
 * PancakeSwap V3 exact-input swap on a fork.
 * Addresses: https://developer.pancakeswap.finance/contracts/v3/addresses
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { PANCAKE_V3 } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)",
];
const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];
const FEES = [100, 500, 2500, 10000];

async function bestQuote(provider, tokenIn, tokenOut, amountIn) {
  const quoter = new ethers.Contract(PANCAKE_V3.quoter, QUOTER_ABI, provider);
  let best = null;
  for (const fee of FEES) {
    try {
      const quoted = await quoter.quoteExactInputSingle.staticCall({
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0,
      });
      const amountOut = quoted[0];
      if (!best || amountOut > best.amountOut) best = { fee, amountOut };
    } catch {
      // fee tier has no pool
    }
  }
  return best;
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = "pancakeswap";
  const action = "swap";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const tokenInSymbol = "WETH";
  const tokenIn = COMMON_TOKENS.WETH?.[chain];
  const tokenOut = COMMON_TOKENS.USDC?.[chain];
  if (!tokenIn || !tokenOut) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `WETH/USDC is not configured on ${chain}`,
    });
  }
  const amountIn = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const provider = getProvider(chain);
  const quote = await bestQuote(provider, tokenIn, tokenOut, amountIn);
  if (!quote) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `No PancakeSwap V3 WETH/USDC quote on ${chain}`,
    });
  }
  let signer;
  try {
    signer = await impersonateFunded(chain, tokenInSymbol, tokenIn, amountIn);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: err.message });
  }
  const user = await signer.getAddress();
  const erc20 = new ethers.Contract(
    tokenOut,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const token = new ethers.Contract(tokenIn, ["function approve(address,uint256) returns (bool)"], signer);
  const before = await erc20.balanceOf(user);
  try {
    const approved = await token.approve(PANCAKE_V3.router, amountIn);
    await approved.wait();
    const router = new ethers.Contract(PANCAKE_V3.router, ROUTER_ABI, signer);
    const minOut = (quote.amountOut * 99n) / 100n;
    const tx = await router.exactInputSingle({
      tokenIn,
      tokenOut,
      fee: quote.fee,
      recipient: user,
      deadline: Math.floor(Date.now() / 1000) + 600,
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0,
    });
    const receipt = await tx.wait();
    const after = await erc20.balanceOf(user);
    const received = after - before;
    const ok = received > 0n;
    return finish({
      ok,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      key: `out=${formatUnits(received, 6)}USDC`,
      detail: `fee ${quote.fee}\nin 0.05 WETH\nout ${formatUnits(received, 6)} USDC\nexpected ${formatUnits(quote.amountOut, 6)} USDC\ntx ${receipt.hash}`,
      error: ok ? null : "USDC balance did not increase",
    });
  } catch (err) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: err.shortMessage || err.message,
    });
  }
}

module.exports = { run };
