/**
 * Execute one DEX swap on a local fork and assert the output balance increased.
 * Quotes and execution go through src/simulation/dexForkRunner.js.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getPair } = require("../../config/pairs");
const { aggregateQuotes, executeSwap, findBestQuote } = require("../dexForkRunner");
const { requireFork, impersonateFunded, formatUnits, decimalsOf, finish } = require("./runtime");

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "dex";
  const action = process.env.FORK_ACTION || "swap";
  const variant = process.env.DEX_VARIANT || null;
  const pairName = process.env.PAIR || (variant === "curve" ? "USDC/USDT" : "WETH/USDC");
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }

  if (process.env.DEFI_SLIPSTREAM_PROXY === "1") {
    const label = process.env.DEFI_SLIPSTREAM_LABEL || "Slipstream";
    console.log(
      `${label}: Slipstream quoter reverts in this stack. Swapping Uniswap V3 on ${chain} as the liquid reference.`
    );
  }

  const pair = getPair(pairName);
  const tokenInSymbol = pair.tokenIn;
  const tokenOutSymbol = pair.tokenOut;
  const tokenIn = COMMON_TOKENS[tokenInSymbol]?.[chain];
  const tokenOut = COMMON_TOKENS[tokenOutSymbol]?.[chain];
  if (!tokenIn || !tokenOut) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `${tokenInSymbol}/${tokenOutSymbol} is not configured on ${chain}`,
    });
  }

  const inDecimals = decimalsOf(tokenInSymbol);
  const outDecimals = decimalsOf(tokenOutSymbol);
  const amountHuman = process.env.FORK_AMOUNT || (inDecimals === 6 ? "100" : "0.1");
  const amountIn = ethers.parseUnits(amountHuman, inDecimals);

  let quotes;
  try {
    quotes = await aggregateQuotes(chain, tokenInSymbol, tokenOutSymbol, amountIn.toString(), {
      dexVariant: variant,
      includeV4: process.env.SIMULATE_V4 === "1" || variant === "uniswap-v4",
    });
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: err.message });
  }
  if (!quotes.length) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `No ${variant || "DEX"} quote for ${pairName} on ${chain}`,
    });
  }

  const best = findBestQuote(quotes);
  let signer;
  try {
    signer = await impersonateFunded(chain, tokenInSymbol, tokenIn, amountIn);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: err.message });
  }
  const user = await signer.getAddress();
  const out = new ethers.Contract(
    tokenOut,
    ["function balanceOf(address) view returns (uint256)"],
    signer.provider
  );
  const before = await out.balanceOf(user);
  let receiptHash = null;
  try {
    const result = await executeSwap(chain, signer, best, amountIn.toString());
    receiptHash = result && result.hash ? result.hash : null;
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
  const after = await out.balanceOf(user);
  const received = after - before;
  const ok = received > 0n;
  const detail = [
    `pair ${pairName}`,
    `venue ${best.protocol} ${best.version}`,
    `in ${amountHuman} ${tokenInSymbol}`,
    `out ${formatUnits(received, outDecimals)} ${tokenOutSymbol}`,
    `expected ${formatUnits(best.amountOut, outDecimals)} ${tokenOutSymbol}`,
    receiptHash ? `tx ${receiptHash}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `out=${formatUnits(received, outDecimals)}${tokenOutSymbol}`,
    detail,
    error: ok ? null : "output balance did not increase",
  });
}

module.exports = { run };
