/**
 * Fluid DEX (FluidDexT1) WETH -> USDC swap on an Ethereum fork.
 *
 * Fluid DEX has no router contract. The documented integration path is calling swapIn() on the
 * pool itself: https://docs.fluid.instadapp.io/integrate/dex-swaps.html ("Execute the swapIn()
 * (or swapOut) method at the respective Dex pool"). That call is permissionless, so an
 * impersonated EOA can swap directly; quotes come from Fluid's own DexResolver, which the same
 * page documents as the pricing path (estimateSwapIn).
 *
 * Pools are deployed by FluidDexFactory and enumerated by DexResolver.getAllDexAddresses().
 * Fluid's ETH pairs use the native-ETH sentinel 0xEeee...EEeE instead of WETH (see the DEX V2
 * page: "The native token is 0xEeee...EEeE"), and FluidDexT1 accepts the input as msg.value for
 * that side. So the WETH input is unwrapped 1:1 right before the swap; the swap then spends
 * exactly that ETH from the same account.
 *
 * Asserts on-chain state, not just a successful call:
 *   - the user's WETH falls by exactly the input (1 WETH by default),
 *   - the pool's Swap event reports the USDC amount that lands in the wallet, and it is > 0,
 *   - that amount is within 0.01% of the DexResolver quote,
 *   - only gas leaves the ETH balance (the unwrapped ETH is spent exactly in the swap).
 *
 * Addresses: Fluid deployment repo (linked from the docs)
 * https://github.com/instadapp/fluid-contracts-public/blob/main/deployments/deployments.md
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";

// Tokens. https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// Fluid's native-ETH sentinel for ETH-sided pools.
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// FluidDexT1 USDC/ETH pool, resolved from DexResolver.getAllDexAddresses()/getDexTokens();
// the check below re-verifies the pair on every run.
const POOL = "0x836951EB21F3Df98273517B7249dCEFF270d34bf";
// https://github.com/instadapp/fluid-contracts-public/blob/main/deployments/deployments.md
const RESOLVER = "0x11D80CfF056Cef4F9E6d23da8672fE9873e5cC07";
const FACTORY = "0x91716C4EDA1Fb55e84Bf8b4c7085f84285c19085";
const LIQUIDITY = "0x52Aa899454998Be5b000Ad077a46Bbe360F4e497";

const GAS = { gasLimit: 1_500_000n };

const ERC_ABI = ["function balanceOf(address) view returns (uint256)", "function withdraw(uint256)"];

const POOL_ABI = [
  "function swapIn(bool swap0to1_, uint256 amountIn_, uint256 amountOutMin_, address to_) payable returns (uint256 amountOut_)",
  "event Swap(bool swap0to1, uint256 amountIn, uint256 amountOut, address to)",
];

const RESOLVER_ABI = [
  "function estimateSwapIn(address dex_, bool swap0to1_, uint256 amountIn_, uint256 amountOutMin_) payable returns (uint256 amountOut_)",
  "function getDexTokens(address dex_) view returns (address token0_, address token1_)",
  "function getAllDexAddresses() view returns (address[] dexes_)",
];

function explain(err) {
  return `${(err && (err.shortMessage || err.reason || err.message)) || err}`.trim();
}

function ethBalance(provider, address, blockTag = "latest") {
  const tag = typeof blockTag === "number" ? ethers.toQuantity(blockTag) : blockTag;
  return provider.send("eth_getBalance", [address, tag]).then(b => BigInt(b));
}

async function run() {
  const chain = process.env.CHAIN || CHAIN;
  const protocol = process.env.FORK_PROTOCOL || "fluid-dex";
  const action = process.env.FORK_ACTION || "swap";
  const base = { protocol, action, chain };

  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ...base, ok: false, block: null, error: err.message });
  }
  base.block = ctx.forkBlock;

  if (chain !== CHAIN) {
    return finish({ ...base, ok: false, error: `Fluid DEX ETH/USDC is wired for ${CHAIN} only (got ${chain})` });
  }

  const provider = getProvider(chain);
  try {
    // Every address used must be a contract on the fork: a typo'd address can still "succeed".
    for (const [name, address] of [
      ["FluidDexResolver", RESOLVER],
      ["FluidDexFactory", FACTORY],
      ["Fluid Liquidity", LIQUIDITY],
      ["FluidDexT1 pool", POOL],
      ["WETH", WETH],
      ["USDC", USDC],
    ]) {
      const code = await provider.getCode(address);
      if (!code || code === "0x") {
        return finish({ ...base, ok: false, error: `${name} ${address} has no code on the fork` });
      }
    }

    // The pool must be a factory-deployed Fluid pool and the documented USDC/native-ETH pair.
    const resolver = new ethers.Contract(RESOLVER, RESOLVER_ABI, provider);
    const listed = (await resolver.getAllDexAddresses()).map(a => a.toLowerCase());
    if (!listed.includes(POOL.toLowerCase())) {
      return finish({ ...base, ok: false, error: `${POOL} is not returned by FluidDexResolver.getAllDexAddresses()` });
    }
    const [token0, token1] = await resolver.getDexTokens(POOL);
    if (token0.toLowerCase() !== USDC.toLowerCase() || token1.toLowerCase() !== NATIVE.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `pool ${POOL} tokens are ${token0}/${token1}, expected USDC/${NATIVE}`,
      });
    }

    const amountIn = ethers.parseUnits(process.env.FORK_AMOUNT || "1", 18);
    const signer = await impersonateFunded(chain, "WETH", WETH, amountIn);
    const user = await signer.getAddress();

    const weth = new ethers.Contract(WETH, ERC_ABI, signer);
    if ((await weth.balanceOf(user)) < amountIn) {
      if (!(await dealErc20(chain, WETH, user, amountIn))) {
        return finish({
          ...base,
          ok: false,
          error: `could not fund ${user} with ${formatUnits(amountIn, 18)} WETH`,
        });
      }
    }

    // Route the swap token1 (native ETH) -> token0 (USDC), i.e. swap0to1 = false.
    const quote = ethers.toBigInt(
      await provider.call({
        from: user,
        to: RESOLVER,
        value: amountIn,
        data: resolver.interface.encodeFunctionData("estimateSwapIn", [POOL, false, amountIn, 0]),
      })
    );
    if (quote === 0n) {
      return finish({
        ...base,
        ok: false,
        error: `FluidDexResolver.estimateSwapIn returned 0 USDC for ${formatUnits(amountIn, 18)} ETH`,
      });
    }

    const usdc = new ethers.Contract(USDC, ERC_ABI, provider);
    const startBlock = await provider.getBlockNumber();
    const wethBefore = await weth.balanceOf(user, { blockTag: startBlock });
    const usdcBefore = await usdc.balanceOf(user, { blockTag: startBlock });
    const ethBefore = await ethBalance(provider, user, startBlock);

    // WETH -> ETH is 1:1; the pool then pulls exactly that ETH as msg.value.
    const withdrawTx = await weth.withdraw(amountIn, GAS);
    const withdrawRc = await withdrawTx.wait();

    const pool = new ethers.Contract(POOL, POOL_ABI, signer);
    const amountOutMin = (quote * 999n) / 1000n; // 0.1% guard on the resolver quote
    const swapTx = await pool.swapIn(false, amountIn, amountOutMin, user, { ...GAS, value: amountIn });
    const swapRc = await swapTx.wait();

    const iface = new ethers.Interface(POOL_ABI);
    const swapLog = swapRc.logs.find(
      log => log.address.toLowerCase() === POOL.toLowerCase() && log.topics[0] === iface.getEvent("Swap").topicHash
    );
    if (!swapLog) {
      return finish({ ...base, ok: false, error: `no Swap event from ${POOL} in tx ${swapTx.hash}` });
    }
    const swapArgs = iface.parseLog(swapLog).args;

    const endBlock = swapRc.blockNumber;
    const wethAfter = await weth.balanceOf(user, { blockTag: endBlock });
    const usdcAfter = await usdc.balanceOf(user, { blockTag: endBlock });
    const ethAfter = await ethBalance(provider, user, endBlock);

    const wethSpent = wethBefore - wethAfter;
    const usdcOut = usdcAfter - usdcBefore;
    const ethSpent = ethBefore - ethAfter;
    const fees =
      (withdrawRc.fee ?? withdrawRc.gasUsed * withdrawRc.gasPrice) + (swapRc.fee ?? swapRc.gasUsed * swapRc.gasPrice);
    // Quote drift in 1e5 units (10 = 0.01%): the block after the quote accrues interest.
    const diff = swapArgs.amountOut > quote ? swapArgs.amountOut - quote : quote - swapArgs.amountOut;
    const drift = (diff * 100_000n) / quote;
    const quoteOk = drift <= 10n;

    const wethOk = wethSpent === amountIn;
    const outOk = usdcOut > 0n && usdcOut === swapArgs.amountOut;
    const inOk = swapArgs.amountIn === amountIn && swapArgs.swap0to1 === false;
    const ethOk = ethSpent === fees;
    const ok = withdrawRc.status === 1 && swapRc.status === 1 && wethOk && outOk && inOk && quoteOk && ethOk;

    return finish({
      ...base,
      ok,
      key: `WETH=${formatUnits(wethBefore, 18)}->${formatUnits(wethAfter, 18)} USDC=${formatUnits(
        usdcBefore,
        6
      )}->${formatUnits(usdcAfter, 6)} out=${formatUnits(swapArgs.amountOut, 6)} quote=${formatUnits(
        quote,
        6
      )} pool=${POOL}`,
      detail: [
        `unwrapped ${formatUnits(amountIn, 18)} WETH -> ETH, then FluidDexT1.swapIn on ${POOL}`,
        `quote ${formatUnits(quote, 6)} USDC (FluidDexResolver.estimateSwapIn), pool reported ${formatUnits(
          swapArgs.amountOut,
          6
        )} USDC`,
        `WETH ${formatUnits(wethBefore, 18)} -> ${formatUnits(wethAfter, 18)} (spent ${formatUnits(wethSpent, 18)})`,
        `USDC ${formatUnits(usdcBefore, 6)} -> ${formatUnits(usdcAfter, 6)} (received ${formatUnits(usdcOut, 6)})`,
        `ETH spent ${formatUnits(ethSpent, 18)} = gas ${formatUnits(fees, 18)}`,
        `withdraw ${withdrawTx.hash}`,
        `swap ${swapTx.hash}`,
      ].join("\n"),
      error: ok
        ? null
        : `Fluid DEX swap assertions failed: WETHdelta=${wethOk} (${wethSpent}/${amountIn}) ` +
          `USDCout=${outOk} (${usdcOut}/${swapArgs.amountOut}) swapIn=${inOk} quoteDrift=${quoteOk} (${drift}/1e5) ` +
          `ETHdelta=${ethOk} (${ethSpent}/${fees})`,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
