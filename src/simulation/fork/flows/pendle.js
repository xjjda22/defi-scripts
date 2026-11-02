/**
 * Pendle V2 - buy PT with the market's underlying token through Router V4 on an Ethereum fork.
 *
 * Pendle's documented "buy PT" path is Router V4 `swapExactTokenForPt`: it pulls the input token,
 * mints SY from it (SY.deposit), then swaps that SY for PT on the market's AMM
 * (https://docs.pendle.finance/pendle-v2-dev/Contracts/PendleRouter/ApiReference/PtFunctions).
 * TokenInput is the "direct SY token input" form from the Types page - tokenIn = tokenMintSy,
 * pendleSwap = address(0), empty SwapData - because the SY lists the input in getTokensIn(), so no
 * external aggregator is involved. ApproxParams/LimitOrderData are the documented defaults
 * (createDefaultApproxParams / createEmptyLimitOrderData):
 * https://docs.pendle.finance/pendle-v2-dev/Contracts/PendleRouter/ApiReference/Types
 *
 * Market: the highest-liquidity market in the API list that is still long-dated and whose SY takes
 * the market's own underlying asset directly. Resolved from
 * https://api-v2.pendle.finance/core/v1/1/markets/active (entry name "wstETH", underlyingAsset
 * 0x7f39...2Ca0, expiry 2027-12-30). Every run re-checks it on-chain: readTokens() must return the
 * expected SY/PT, the market must not be expired, and SY.getTokensIn() must contain the input.
 *
 * Asserts on-chain state, not just a successful call:
 *   - the wstETH balance falls by exactly the input (1 wstETH by default) and the router's
 *     allowance is fully consumed,
 *   - PT received is > 0 and equals the router's own return value `netPtOut` (decoded from the
 *     executed transaction with debug_traceTransaction's callTracer output),
 *   - the router reports `netSyInterm` > 0, i.e. SY was really minted from the input token,
 *   - PT received is within 0.5% of RouterStatic.swapExactTokenForPtStatic quoted before the swap.
 *
 * Addresses: Router/ RouterStatic from Pendle's deployment file linked by the Deployments page
 * (https://github.com/pendle-finance/pendle-core-v2-public/blob/main/deployments/1-core.json);
 * market/SY/PT from the Pendle API above; wstETH from the market's own underlyingAsset field and
 * SY.getTokensIn().
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";

// https://github.com/pendle-finance/pendle-core-v2-public/blob/main/deployments/1-core.json
const ROUTER = "0x888888888889758F76e7103c6CbF23ABbF58F946";
const ROUTER_STATIC = "0x263833d47eA3fA4a30f269323aba6a107f9eB14C";

// PT-stETH-30DEC2027 market ("wstETH" in the API), resolved 2026-11-03 from
// https://api-v2.pendle.finance/core/v1/1/markets/active
const MARKET = "0x34280882267ffa6383b363e278b027be083bbe3b";
const SY = "0xcbC72d92b2dc8187414F6734718563898740C0BC";
const PT = "0xb253Eff1104802b97aC7E3aC9FdD73AecE295a2c";
// wstETH: the market's underlyingAsset in the API, and one of SY.getTokensIn().
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";

const GAS = { gasLimit: 3_000_000n };
// RouterStatic quote tolerance: 500/1e5 = 0.5% (observed drift is a few 1e-5, the swap lands in a
// later block than the quote).
const MAX_QUOTE_DRIFT = 500n;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const MARKET_ABI = [
  "function readTokens() view returns (address _SY, address _PT, address _YT)",
  "function expiry() view returns (uint256)",
  "function isExpired() view returns (bool)",
];

const SY_ABI = ["function getTokensIn() view returns (address[])"];

const ROUTER_STATIC_ABI = [
  "function swapExactTokenForPtStatic(address market, address tokenIn, uint256 amountTokenIn) view returns (uint256 netPtOut, uint256 netSyMinted, uint256 netSyFee, uint256 priceImpact, uint256 exchangeRateAfter)",
];

// FillOrderParams (empty here) is `{ Order order; bytes signature; uint256 makingAmount; }`, so the
// selector only matches when the 12-field Order tuple is spelled out.
const ORDER =
  "(uint256 salt, uint256 expiry, uint256 nonce, uint8 orderType, address token, address YT, address maker, address receiver, uint256 makingAmount, uint256 lnImpliedRate, uint256 failSafeRate, bytes permit)";
const FILL = `((${ORDER.slice(1, -1)}) order, bytes signature, uint256 makingAmount)`;

const ROUTER_ABI = [
  `function swapExactTokenForPt(address receiver, address market, uint256 minPtOut, (uint256 guessMin, uint256 guessMax, uint256 guessOffchain, uint256 maxIteration, uint256 eps) guessPtOut, (address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) input, (address limitRouter, uint256 epsSkipMarket, ${FILL}[] normalFills, ${FILL}[] flashFills, bytes optData) limit) payable returns (uint256 netPtOut, uint256 netSyFee, uint256 netSyInterm)`,
];

function explain(err) {
  return `${(err && (err.shortMessage || err.reason || err.message)) || err}`.trim();
}

/**
 * The router's own return value for a mined transaction. Anvil's callTracer keeps the top-level
 * call's return data, so this is the `(netPtOut, netSyFee, netSyInterm)` the router actually
 * returned - not a re-simulation. Returns null if the node cannot trace.
 */
async function tracedRouterReturn(provider, hash) {
  try {
    const trace = await provider.send("debug_traceTransaction", [hash, { tracer: "callTracer" }]);
    if (!trace || typeof trace.output !== "string" || trace.output === "0x") return null;
    const [netPtOut, netSyFee, netSyInterm] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint256", "uint256", "uint256"],
      trace.output
    );
    return { netPtOut, netSyFee, netSyInterm };
  } catch {
    return null;
  }
}

async function run() {
  const chain = process.env.CHAIN || CHAIN;
  const protocol = process.env.FORK_PROTOCOL || "pendle";
  const action = process.env.FORK_ACTION || "buy-pt";
  const base = { protocol, action, chain };

  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ...base, ok: false, block: null, error: err.message });
  }
  base.block = ctx.forkBlock;

  if (chain !== CHAIN) {
    return finish({ ...base, ok: false, error: `Pendle Router V4 buy-PT is wired for ${CHAIN} only (got ${chain})` });
  }

  const provider = getProvider(chain);
  try {
    // Every address used must be a contract on the fork: a typo'd address can still "succeed".
    for (const [name, address] of [
      ["Pendle Router V4", ROUTER],
      ["Pendle RouterStatic", ROUTER_STATIC],
      ["PT-stETH-30DEC2027 market", MARKET],
      ["SY stETH", SY],
      ["PT-stETH-30DEC2027", PT],
      ["wstETH", WSTETH],
    ]) {
      const code = await provider.getCode(address);
      if (!code || code === "0x") {
        return finish({ ...base, ok: false, error: `${name} ${address} has no code on the fork` });
      }
    }

    // The hardcoded market must still be the PT-stETH market, open, and mintable from wstETH.
    const market = new ethers.Contract(MARKET, MARKET_ABI, provider);
    const [sy, pt] = await market.readTokens();
    if (sy.toLowerCase() !== SY.toLowerCase() || pt.toLowerCase() !== PT.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `market ${MARKET} readTokens() is SY=${sy} PT=${pt}, expected SY=${SY} PT=${PT}`,
      });
    }
    const expiry = await market.expiry();
    if (await market.isExpired()) {
      return finish({
        ...base,
        ok: false,
        error: `market ${MARKET} expired at ${new Date(Number(expiry) * 1000).toISOString()}`,
      });
    }
    const tokensIn = (await new ethers.Contract(SY, SY_ABI, provider).getTokensIn()).map(t => t.toLowerCase());
    if (!tokensIn.includes(WSTETH.toLowerCase())) {
      return finish({
        ...base,
        ok: false,
        error: `SY ${SY} getTokensIn() does not accept wstETH (${tokensIn.join(", ")})`,
      });
    }

    const wsteth = new ethers.Contract(WSTETH, ERC20_ABI, provider);
    const ptToken = new ethers.Contract(PT, ERC20_ABI, provider);
    const [tokenDecimals, ptDecimals, tokenSymbol, ptSymbol] = await Promise.all([
      wsteth.decimals(),
      ptToken.decimals(),
      wsteth.symbol(),
      ptToken.symbol(),
    ]);

    const amountIn = ethers.parseUnits(process.env.FORK_AMOUNT || "1", tokenDecimals);
    const signer = await impersonateFunded(chain, "wstETH", WSTETH, amountIn);
    const user = await signer.getAddress();

    const wstethSigner = new ethers.Contract(WSTETH, ERC20_ABI, signer);
    if ((await wstethSigner.balanceOf(user)) < amountIn) {
      // impersonateFunded already deals when no whale holds wstETH; this is the explicit top-up
      // (same pattern as fluid-dex.js) for a fork where the configured whale comes up short.
      if (!(await dealErc20(chain, WSTETH, user, amountIn))) {
        return finish({
          ...base,
          ok: false,
          error: `could not fund ${user} with ${formatUnits(amountIn, tokenDecimals)} ${tokenSymbol}`,
        });
      }
    }

    // Quote with Pendle's own RouterStatic before touching the market.
    const routerStatic = new ethers.Contract(ROUTER_STATIC, ROUTER_STATIC_ABI, provider);
    const quote = await routerStatic.swapExactTokenForPtStatic(MARKET, WSTETH, amountIn);
    if (quote.netPtOut === 0n) {
      return finish({
        ...base,
        ok: false,
        error: `RouterStatic.swapExactTokenForPtStatic returned 0 PT for ${formatUnits(amountIn, tokenDecimals)} ${tokenSymbol}`,
      });
    }

    const startBlock = await provider.getBlockNumber();
    const wstethBefore = await wsteth.balanceOf(user, { blockTag: startBlock });
    const ptBefore = await ptToken.balanceOf(user, { blockTag: startBlock });

    const approveTx = await wstethSigner.approve(ROUTER, amountIn, GAS);
    const approveRc = await approveTx.wait();

    const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
    const input = {
      tokenIn: WSTETH,
      netTokenIn: amountIn,
      tokenMintSy: WSTETH,
      pendleSwap: ethers.ZeroAddress,
      swapData: { swapType: 0, extRouter: ethers.ZeroAddress, extCalldata: "0x", needScale: false },
    };
    const guessPtOut = {
      guessMin: 0n,
      guessMax: ethers.MaxUint256,
      guessOffchain: 0n,
      maxIteration: 256n,
      eps: 10n ** 14n,
    };
    const limit = {
      limitRouter: ethers.ZeroAddress,
      epsSkipMarket: 0n,
      normalFills: [],
      flashFills: [],
      optData: "0x",
    };
    const minPtOut = (quote.netPtOut * (10_000n - MAX_QUOTE_DRIFT)) / 10_000n;

    // Same-state simulation: the fallback return value if the node cannot trace the mined tx.
    const [simPtOut, simSyFee, simSyInterm] = await router.swapExactTokenForPt.staticCall(
      user,
      MARKET,
      minPtOut,
      guessPtOut,
      input,
      limit
    );

    const swapTx = await router.swapExactTokenForPt(user, MARKET, minPtOut, guessPtOut, input, limit, GAS);
    const swapRc = await swapTx.wait();

    const endBlock = swapRc.blockNumber;
    const wstethAfter = await wsteth.balanceOf(user, { blockTag: endBlock });
    const ptAfter = await ptToken.balanceOf(user, { blockTag: endBlock });
    const allowanceAfter = await wstethSigner.allowance(user, ROUTER, { blockTag: endBlock });

    const traced = await tracedRouterReturn(provider, swapTx.hash);
    const routerReturn = traced || { netPtOut: simPtOut, netSyFee: simSyFee, netSyInterm: simSyInterm };
    const returnSource = traced ? "callTracer on the mined tx" : "pre-tx eth_call simulation";

    const spent = wstethBefore - wstethAfter;
    const ptOut = ptAfter - ptBefore;
    const diff = routerReturn.netPtOut > ptOut ? routerReturn.netPtOut - ptOut : ptOut - routerReturn.netPtOut;
    const drift = (diff * 100_000n) / routerReturn.netPtOut;
    const quoteDiff = quote.netPtOut > ptOut ? quote.netPtOut - ptOut : ptOut - quote.netPtOut;
    const quoteDrift = (quoteDiff * 100_000n) / quote.netPtOut;

    const spentOk = spent === amountIn;
    // Traced return is the executed call's own return value, so it must match exactly; the
    // simulation fallback may trail by a few wei if interest accrued in the same block.
    const returnOk = traced ? ptOut === routerReturn.netPtOut : drift <= 1n;
    const ptOk = ptOut > 0n && returnOk;
    const syOk = routerReturn.netSyInterm > 0n;
    const approveOk = allowanceAfter === 0n;
    const quoteOk = quoteDrift <= MAX_QUOTE_DRIFT;
    const ok = approveRc.status === 1 && swapRc.status === 1 && spentOk && ptOk && syOk && approveOk && quoteOk;

    return finish({
      ...base,
      ok,
      key: `${tokenSymbol}=${formatUnits(wstethBefore, tokenDecimals)}->${formatUnits(
        wstethAfter,
        tokenDecimals
      )} PT=${formatUnits(ptBefore, ptDecimals)}->${formatUnits(ptAfter, ptDecimals)} out=${formatUnits(
        routerReturn.netPtOut,
        ptDecimals
      )} quote=${formatUnits(quote.netPtOut, ptDecimals)} market=${MARKET}`,
      detail: [
        `bought ${ptSymbol} with ${formatUnits(amountIn, tokenDecimals)} ${tokenSymbol} on market ${MARKET} through Router V4 swapExactTokenForPt`,
        `router returned netPtOut=${formatUnits(routerReturn.netPtOut, ptDecimals)} netSyFee=${formatUnits(
          routerReturn.netSyFee,
          18
        )} netSyInterm=${formatUnits(routerReturn.netSyInterm, 18)} SY (${returnSource})`,
        `RouterStatic quote ${formatUnits(quote.netPtOut, ptDecimals)} PT (netSyMinted ${formatUnits(
          quote.netSyMinted,
          18
        )}), drift ${quoteDrift}/1e5`,
        `${tokenSymbol} ${formatUnits(wstethBefore, tokenDecimals)} -> ${formatUnits(wstethAfter, tokenDecimals)} (spent ${formatUnits(spent, tokenDecimals)})`,
        `PT ${formatUnits(ptBefore, ptDecimals)} -> ${formatUnits(ptAfter, ptDecimals)} (received ${formatUnits(ptOut, ptDecimals)})`,
        `router allowance left ${allowanceAfter.toString()}`,
        `approve ${approveTx.hash}`,
        `swap ${swapTx.hash}`,
      ].join("\n"),
      error: ok
        ? null
        : `Pendle buy-PT assertions failed: ${tokenSymbol}delta=${spentOk} (${spent}/${amountIn}) ` +
          `PTout=${ptOk} (${ptOut}/${routerReturn.netPtOut}, drift ${drift}/1e5) netSyInterm=${syOk} ` +
          `allowance=${approveOk} (${allowanceAfter}) quote=${quoteOk} (${quoteDrift}/1e5)`,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
