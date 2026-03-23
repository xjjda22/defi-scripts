const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../utils/web3");
const { detectFork, getForkBlockNumber } = require("../utils/forkDetection");
const { impersonateWhale, getTokenBalance } = require("../utils/impersonate");
const { CHAINS, COMMON_TOKENS } = require("../config/chains");
const { getPair } = require("../config/pairs");

const v2Swap = require("../swaps/v2Swap");
const v3Swap = require("../swaps/v3Swap");
const v4Swap = require("../swaps/v4Swap");
const sushiswapSwap = require("../swaps/sushiswapSwap");
const curveSwap = require("../swaps/curveSwap");
const balancerSwap = require("../swaps/balancerSwap");

const FEE_TIERS_V3 = [100, 500, 3000, 10000];

const MIN_WETH_USDC_RAW = 50n * 10n ** 6n;
const MAX_WETH_USDC_RAW = 20_000_000n * 10n ** 6n;

function isSaneWethUsdcQuote(tokenInSymbol, tokenOutSymbol, amountOutRaw) {
  if (tokenInSymbol.toUpperCase() !== "WETH" || tokenOutSymbol.toUpperCase() !== "USDC") return true;
  try {
    const v = BigInt(amountOutRaw);
    return v >= MIN_WETH_USDC_RAW && v <= MAX_WETH_USDC_RAW;
  } catch {
    return false;
  }
}

function dexVariantMatches(v, protocol, version) {
  if (!v) return true;
  const p = protocol.toLowerCase();
  const ver = String(version).toLowerCase();
  const map = {
    "uniswap-v2": () => p === "uniswap" && ver === "v2",
    "uniswap-v3": () => p === "uniswap" && ver === "v3",
    "uniswap-v4": () => p === "uniswap" && ver === "v4",
    "sushiswap-v2": () => p === "sushiswap" && ver === "v2",
    "sushiswap-v3": () => p === "sushiswap" && ver === "v3",
    "balancer-v2": () => p === "balancer",
    curve: () => p === "curve",
  };
  const fn = map[v.toLowerCase()];
  return fn ? fn() : true;
}

function formatAmount(amount, decimals = 18, symbol = "") {
  const formatted = ethers.formatUnits(amount, decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

function printHeader(title) {
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan("═".repeat(70) + "\n"));
}

function printSection(title) {
  console.log(chalk.yellow(`\n${title}`));
  console.log(chalk.gray("─".repeat(70)));
}

async function getUniswapV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.uniswap?.v2?.router) return null;
    const provider = getProvider(chainKey);
    const router = new ethers.Contract(
      chain.uniswap.v2.router,
      ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)"],
      provider,
    );
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[1].toString();
  } catch {
    return null;
  }
}

async function getUniswapV3Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const bestFee = await v3Swap.findBestFee(chainKey, tokenIn, tokenOut, amountIn);
    return { amountOut: bestFee.amountOut, fee: bestFee.fee };
  } catch {
    return null;
  }
}

async function getUniswapV4Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    if (!CHAINS[chainKey]?.uniswap?.v4?.poolManager) return null;
    let best = { amountOut: "0", fee: 3000 };
    for (const fee of FEE_TIERS_V3) {
      try {
        const out = await v4Swap.estimateSwapOutput(chainKey, tokenIn, tokenOut, fee, amountIn);
        if (BigInt(out) > BigInt(best.amountOut)) best = { amountOut: out, fee };
      } catch {
        continue;
      }
    }
    if (best.amountOut === "0") return null;
    return best;
  } catch {
    return null;
  }
}

async function getSushiSwapV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.sushiswap?.v2?.router) return null;
    const provider = getProvider(chainKey);
    const router = new ethers.Contract(
      chain.sushiswap.v2.router,
      ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)"],
      provider,
    );
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[1].toString();
  } catch {
    return null;
  }
}

async function getSushiSwapV3QuoteBest(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    if (!CHAINS[chainKey]?.sushiswap?.v3?.quoter) return null;
    let best = { amountOut: "0", fee: 3000 };
    for (const fee of FEE_TIERS_V3) {
      try {
        const q = await sushiswapSwap.getV3Quote(chainKey, tokenIn, tokenOut, amountIn, fee);
        if (BigInt(q.amountOut) > BigInt(best.amountOut)) best = { amountOut: q.amountOut, fee };
      } catch {
        continue;
      }
    }
    if (best.amountOut === "0") return null;
    return best;
  } catch {
    return null;
  }
}

async function getCurveQuote(chainKey, tokenInSymbol, tokenOutSymbol, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.curve?.pools) return null;
    for (const [, pool] of Object.entries(chain.curve.pools)) {
      const coins = pool.coins.map(c => c.toUpperCase());
      const indexIn = coins.indexOf(tokenInSymbol.toUpperCase());
      const indexOut = coins.indexOf(tokenOutSymbol.toUpperCase());
      if (indexIn !== -1 && indexOut !== -1) {
        const quote = await curveSwap.getQuote(chainKey, pool.address, indexIn, indexOut, amountIn);
        return {
          amountOut: quote,
          poolAddress: pool.address,
          poolName: pool.name,
          i: indexIn,
          j: indexOut,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function findBalancerPoolEntry(chainKey, tokenInSymbol, tokenOutSymbol) {
  const pools = CHAINS[chainKey]?.balancer?.v2?.pools;
  if (!pools) return null;
  const a = tokenInSymbol.toUpperCase();
  const b = tokenOutSymbol.toUpperCase();
  for (const [, p] of Object.entries(pools)) {
    const tokens = (p.tokens || []).map(t => t.toUpperCase());
    if (tokens.includes(a) && tokens.includes(b)) {
      return { poolId: p.poolId, name: p.name };
    }
  }
  return null;
}

async function getBalancerV2Quote(chainKey, poolId, tokenIn, tokenOut, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.balancer?.v2?.vault) return null;
    const provider = getProvider(chainKey);
    const iface = new ethers.Interface([
      "function queryBatchSwap(uint8 kind, tuple(bytes32 poolId,uint256 assetInIndex,uint256 assetOutIndex,uint256 amount,bytes userData)[] swaps, address[] assets, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds) view returns (int256[])",
    ]);
    const vault = new ethers.Contract(chain.balancer.v2.vault, iface, provider);
    const assets =
      tokenIn.toLowerCase() < tokenOut.toLowerCase() ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
    const assetInIndex = assets.findIndex(a => a.toLowerCase() === tokenIn.toLowerCase());
    const assetOutIndex = assets.findIndex(a => a.toLowerCase() === tokenOut.toLowerCase());
    const swaps = [
      {
        poolId,
        assetInIndex,
        assetOutIndex,
        amount: amountIn,
        userData: "0x",
      },
    ];
    const funds = {
      sender: ethers.ZeroAddress,
      fromInternalBalance: false,
      recipient: ethers.ZeroAddress,
      toInternalBalance: false,
    };
    const deltas = await vault.queryBatchSwap.staticCall(0, swaps, assets, funds);
    const outDelta = deltas[assetOutIndex];
    const amt = outDelta >= 0n ? outDelta : -outDelta;
    return amt.toString();
  } catch {
    return null;
  }
}

async function aggregateQuotes(chainKey, tokenInSymbol, tokenOutSymbol, amountIn, opts = {}) {
  const dexVariant = opts.dexVariant || null;
  const includeV4 = opts.includeV4 === true;

  const tokenIn = COMMON_TOKENS[tokenInSymbol]?.[chainKey];
  const tokenOut = COMMON_TOKENS[tokenOutSymbol]?.[chainKey];
  if (!tokenIn || !tokenOut) {
    throw new Error(`Tokens ${tokenInSymbol}/${tokenOutSymbol} not configured for ${chainKey}`);
  }

  const quotes = [];
  const want = v => dexVariantMatches(dexVariant, ...v);

  printSection("Fetching Quotes from All Protocols");
  console.log(chalk.gray("Querying DEX protocols...\n"));

  if (want(["Uniswap", "V2"])) {
    process.stdout.write(chalk.gray("  Uniswap V2        "));
    const uniV2Quote = await getUniswapV2Quote(chainKey, tokenIn, tokenOut, amountIn);
    if (uniV2Quote) {
      quotes.push({
        protocol: "Uniswap",
        version: "V2",
        amountOut: uniV2Quote,
        data: { tokenIn, tokenOut },
      });
      console.log(chalk.green("✓") + ` ${formatAmount(uniV2Quote, 6)} ${tokenOutSymbol}`);
    } else {
      console.log(chalk.red("✗") + " Not available");
    }
  }

  if (want(["Uniswap", "V3"])) {
    process.stdout.write(chalk.gray("  Uniswap V3        "));
    const uniV3Quote = await getUniswapV3Quote(chainKey, tokenIn, tokenOut, amountIn);
    if (uniV3Quote) {
      quotes.push({
        protocol: "Uniswap",
        version: "V3",
        amountOut: uniV3Quote.amountOut,
        data: { tokenIn, tokenOut, fee: uniV3Quote.fee },
      });
      console.log(
        chalk.green("✓") +
          ` ${formatAmount(uniV3Quote.amountOut, 6)} ${tokenOutSymbol} (${uniV3Quote.fee / 10000}% fee)`,
      );
    } else {
      console.log(chalk.red("✗") + " Not available");
    }
  }

  if (includeV4 && want(["Uniswap", "V4"])) {
    process.stdout.write(chalk.gray("  Uniswap V4        "));
    const uniV4Quote = await getUniswapV4Quote(chainKey, tokenIn, tokenOut, amountIn);
    if (uniV4Quote) {
      quotes.push({
        protocol: "Uniswap",
        version: "V4",
        amountOut: uniV4Quote.amountOut,
        data: { tokenIn, tokenOut, fee: uniV4Quote.fee },
      });
      console.log(
        chalk.green("✓") +
          ` ${formatAmount(uniV4Quote.amountOut, 6)} ${tokenOutSymbol} (${uniV4Quote.fee / 10000}% fee)`,
      );
    } else {
      console.log(chalk.red("✗") + " Not available");
    }
  }

  if (want(["SushiSwap", "V2"])) {
    process.stdout.write(chalk.gray("  SushiSwap V2      "));
    const sushiV2Quote = await getSushiSwapV2Quote(chainKey, tokenIn, tokenOut, amountIn);
    if (sushiV2Quote) {
      quotes.push({
        protocol: "SushiSwap",
        version: "V2",
        amountOut: sushiV2Quote,
        data: { tokenIn, tokenOut },
      });
      console.log(chalk.green("✓") + ` ${formatAmount(sushiV2Quote, 6)} ${tokenOutSymbol}`);
    } else {
      console.log(chalk.red("✗") + " Not available");
    }
  }

  if (want(["SushiSwap", "V3"])) {
    process.stdout.write(chalk.gray("  SushiSwap V3      "));
    const sushiV3 = await getSushiSwapV3QuoteBest(chainKey, tokenIn, tokenOut, amountIn);
    if (sushiV3) {
      quotes.push({
        protocol: "SushiSwap",
        version: "V3",
        amountOut: sushiV3.amountOut,
        data: { tokenIn, tokenOut, fee: sushiV3.fee },
      });
      console.log(
        chalk.green("✓") +
          ` ${formatAmount(sushiV3.amountOut, 6)} ${tokenOutSymbol} (${sushiV3.fee / 10000}% fee)`,
      );
    } else {
      console.log(chalk.red("✗") + " Not available");
    }
  }

  if (want(["Curve", ""])) {
    process.stdout.write(chalk.gray("  Curve             "));
    const curveQuote = await getCurveQuote(chainKey, tokenInSymbol, tokenOutSymbol, amountIn);
    if (curveQuote) {
      quotes.push({
        protocol: "Curve",
        version: curveQuote.poolName,
        amountOut: curveQuote.amountOut,
        data: {
          poolAddress: curveQuote.poolAddress,
          tokenIn,
          tokenOut,
          i: curveQuote.i,
          j: curveQuote.j,
        },
      });
      console.log(
        chalk.green("✓") + ` ${formatAmount(curveQuote.amountOut, 6)} ${tokenOutSymbol} (${curveQuote.poolName})`,
      );
    } else {
      console.log(chalk.red("✗") + " Not available");
    }
  }

  if (want(["Balancer", "V2"])) {
    process.stdout.write(chalk.gray("  Balancer V2       "));
    const poolEntry = findBalancerPoolEntry(chainKey, tokenInSymbol, tokenOutSymbol);
    if (poolEntry) {
      const bq = await getBalancerV2Quote(chainKey, poolEntry.poolId, tokenIn, tokenOut, amountIn);
      if (bq) {
        quotes.push({
          protocol: "Balancer",
          version: poolEntry.name,
          amountOut: bq,
          data: { poolId: poolEntry.poolId, tokenIn, tokenOut },
        });
        console.log(chalk.green("✓") + ` ${formatAmount(bq, 6)} ${tokenOutSymbol} (${poolEntry.name})`);
      } else {
        console.log(chalk.red("✗") + " Quote failed");
      }
    } else {
      console.log(chalk.red("✗") + " No pool in config");
    }
  }

  const filtered = quotes.filter(q =>
    isSaneWethUsdcQuote(tokenInSymbol, tokenOutSymbol, q.amountOut),
  );
  if (filtered.length < quotes.length) {
    console.log(
      chalk.yellow(
        `\n  Dropped ${quotes.length - filtered.length} implausible WETH→USDC quote(s) (sanity band).`,
      ),
    );
  }
  return filtered;
}

function findBestQuote(quotes) {
  if (quotes.length === 0) return null;
  return quotes.reduce((best, current) =>
    BigInt(current.amountOut) > BigInt(best.amountOut) ? current : best,
  );
}

async function executeSwap(chainKey, signer, bestQuote, amountIn, slippageBps = 50) {
  const { protocol, version, data } = bestQuote;
  console.log(chalk.gray(`\n  Executing ${protocol} ${version} swap...`));

  if (protocol === "Uniswap" && version === "V2") {
    return await v2Swap.swapExactTokensForTokens(
      chainKey,
      signer,
      data.tokenIn,
      data.tokenOut,
      amountIn,
      slippageBps,
    );
  }
  if (protocol === "Uniswap" && version === "V3") {
    return await v3Swap.swapExactInputSingle(
      chainKey,
      signer,
      data.tokenIn,
      data.tokenOut,
      data.fee,
      amountIn,
      slippageBps,
    );
  }
  if (protocol === "Uniswap" && version === "V4") {
    const r = await v4Swap.swapV4(
      chainKey,
      signer,
      data.tokenIn,
      data.tokenOut,
      data.fee,
      amountIn,
      slippageBps,
    );
    return { hash: r.hash };
  }
  if (protocol === "SushiSwap" && version === "V2") {
    const chain = CHAINS[chainKey];
    const router = new ethers.Contract(
      chain.sushiswap.v2.router,
      [
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
      ],
      signer,
    );
    const ERC20_ABI = ["function approve(address spender, uint256 amount) returns (bool)"];
    const tokenContract = new ethers.Contract(data.tokenIn, ERC20_ABI, signer);
    const approveTx = await tokenContract.approve(chain.sushiswap.v2.router, amountIn);
    await approveTx.wait();
    const amountOutMin = (BigInt(bestQuote.amountOut) * BigInt(10000 - slippageBps)) / BigInt(10000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin.toString(),
      [data.tokenIn, data.tokenOut],
      await signer.getAddress(),
      deadline,
    );
    const receipt = await tx.wait();
    return { hash: receipt.hash };
  }
  if (protocol === "SushiSwap" && version === "V3") {
    const r = await sushiswapSwap.swapV3(
      chainKey,
      signer,
      data.tokenIn,
      data.tokenOut,
      amountIn,
      slippageBps,
      data.fee,
    );
    return { hash: r.hash };
  }
  if (protocol === "Curve") {
    return await curveSwap.executeSwap(
      chainKey,
      signer,
      data.poolAddress,
      data.tokenIn,
      data.tokenOut,
      data.i,
      data.j,
      amountIn,
      slippageBps,
    );
  }
  if (protocol === "Balancer") {
    const r = await balancerSwap.swapV2(
      chainKey,
      signer,
      data.poolId,
      data.tokenIn,
      data.tokenOut,
      amountIn,
      slippageBps,
    );
    return { hash: r.hash };
  }

  throw new Error(`Execution not implemented for ${protocol} ${version}`);
}

async function runDexForkSimulation(options = {}) {
  const CHAIN = options.chain || process.env.CHAIN || "ethereum";
  const SIMULATE_ONLY = options.simulateOnly ?? process.env.SIMULATE_ONLY === "true";
  const FORCE_PROTOCOL = options.forceProtocol ?? process.env.PROTOCOL ?? null;
  const DEX_VARIANT = options.dexVariant ?? process.env.DEX_VARIANT ?? null;
  const PAIR_NAME = options.pairName || process.env.PAIR || "WETH/USDC";
  const includeV4 = options.includeV4 ?? process.env.SIMULATE_V4 === "1";

  const title = options.title || "MULTI-PROTOCOL TRADE SIMULATION";
  printHeader(title);

  const { isFork, forkType } = await detectFork(CHAIN);
  const chain = CHAINS[CHAIN];
  const forkBlock = isFork ? await getForkBlockNumber(CHAIN) : null;

  console.log(chalk.bold("Environment:"));
  console.log(`  Chain: ${chalk.green(chain.name)} (${CHAIN})`);
  console.log(`  Fork Status: ${isFork ? chalk.green(`YES (${forkType})`) : chalk.red("NO (Mainnet)")}`);
  if (forkBlock) console.log(`  Fork Block: ${chalk.cyan(forkBlock)}`);
  console.log(`  Mode: ${SIMULATE_ONLY ? chalk.yellow("QUOTE ONLY") : chalk.green("FULL EXECUTION")}`);
  console.log(`  Pair: ${chalk.cyan(PAIR_NAME)}`);
  if (includeV4) console.log(`  Uniswap V4: ${chalk.cyan("enabled (SIMULATE_V4=1)")}`);
  if (FORCE_PROTOCOL) console.log(`  Protocol Filter: ${chalk.cyan(FORCE_PROTOCOL.toUpperCase())}`);
  if (DEX_VARIANT) console.log(`  DEX_VARIANT: ${chalk.cyan(DEX_VARIANT)}`);

  const pair = getPair(PAIR_NAME);
  const tokenInSymbol = pair.tokenIn;
  const tokenOutSymbol = pair.tokenOut;
  const tokenInDecimals = ["USDC", "USDT"].includes(tokenInSymbol) ? 6 : 18;
  const tokenOutDecimals = ["USDC", "USDT"].includes(tokenOutSymbol) ? 6 : 18;
  const amountIn =
    tokenInDecimals === 6 ? ethers.parseUnits(pair.amount, 6) : ethers.parseEther(pair.amount);

  printSection("Trade Parameters");
  console.log(`  Token In: ${chalk.cyan(tokenInSymbol)}`);
  console.log(`  Token Out: ${chalk.cyan(tokenOutSymbol)}`);
  console.log(`  Amount In: ${chalk.green(pair.amount + " " + tokenInSymbol)}`);

  printHeader("PART 1: QUOTE SIMULATION (All Protocols)");

  let quotes = await aggregateQuotes(CHAIN, tokenInSymbol, tokenOutSymbol, amountIn.toString(), {
    dexVariant: DEX_VARIANT,
    includeV4,
  });

  if (quotes.length === 0) {
    console.error(chalk.red("\n❌ No liquidity found on any protocol"));
    if (SIMULATE_ONLY) {
      console.log(chalk.yellow("\n(QUOTE-ONLY: no sane quotes; exiting 0.)\n"));
      return;
    }
    process.exit(1);
  }

  if (FORCE_PROTOCOL) {
    const fp = FORCE_PROTOCOL.toLowerCase();
    quotes = quotes.filter(q => q.protocol.toLowerCase() === fp);
    if (quotes.length === 0) {
      console.error(chalk.red(`\n❌ No quotes found for protocol: ${FORCE_PROTOCOL}`));
      process.exit(1);
    }
  }

  const bestQuote = findBestQuote(quotes);

  printSection("Best Quote");
  console.log(`  Protocol: ${chalk.cyan(bestQuote.protocol + " " + bestQuote.version)}`);
  console.log(
    `  Expected Output: ${chalk.green(formatAmount(bestQuote.amountOut, tokenOutDecimals, tokenOutSymbol))}`,
  );

  if (quotes.length > 1) {
    const worstQuote = quotes.reduce((worst, current) =>
      BigInt(current.amountOut) < BigInt(worst.amountOut) ? current : worst,
    );
    if (BigInt(worstQuote.amountOut) > 0n) {
      const savings =
        ((BigInt(bestQuote.amountOut) - BigInt(worstQuote.amountOut)) * BigInt(10000)) /
        BigInt(worstQuote.amountOut);
      console.log(`  Savings vs Worst: ${chalk.yellow((Number(savings) / 100).toFixed(2) + "%")}`);
    }
  }

  if (SIMULATE_ONLY) {
    console.log(chalk.yellow("\n⚠️  SIMULATE_ONLY mode - skipping execution simulation"));
    console.log(chalk.gray("Run without SIMULATE_ONLY=true to test execution on fork\n"));
    return;
  }

  if (!isFork) {
    console.log(chalk.red("\n⚠️  Not on a fork - cannot simulate execution"));
    console.log(chalk.gray("Start Anvil fork: anvil --fork-url $ETHEREUM_RPC_URL"));
    console.log(chalk.gray("Then update .env: ETHEREUM_RPC_URL=http://127.0.0.1:8545\n"));
    return;
  }

  printHeader("PART 2: EXECUTION SIMULATION (On Fork)");
  console.log(chalk.gray("Setting up test wallet with tokens...\n"));

  try {
    const signer = await impersonateWhale(tokenInSymbol, CHAIN);
    const whaleAddress = await signer.getAddress();
    const tokenIn = COMMON_TOKENS[tokenInSymbol][CHAIN];
    const tokenOut = COMMON_TOKENS[tokenOutSymbol][CHAIN];

    console.log(`  Impersonated Whale: ${chalk.cyan(whaleAddress)}`);

    const tokenInBalance = await getTokenBalance(tokenIn, whaleAddress, CHAIN);
    const ethBalance = await getProvider(CHAIN).getBalance(whaleAddress);
    console.log(
      `  ${tokenInSymbol} Balance: ${chalk.green(formatAmount(tokenInBalance, tokenInDecimals, tokenInSymbol))}`,
    );
    console.log(`  ETH Balance: ${chalk.green(formatAmount(ethBalance, 18, "ETH"))}`);

    if (tokenInBalance < amountIn) {
      throw new Error(`Insufficient ${tokenInSymbol} balance in whale wallet`);
    }

    const initialBalance = await getTokenBalance(tokenOut, whaleAddress, CHAIN);
    console.log(
      `\n  Initial ${tokenOutSymbol} Balance: ${chalk.gray(formatAmount(initialBalance, tokenOutDecimals, tokenOutSymbol))}`,
    );

    printSection("Executing Swap on Fork");
    const result = await executeSwap(CHAIN, signer, bestQuote, amountIn.toString());

    console.log(chalk.green(`\n  ✓ Transaction confirmed!`));
    console.log(`  Hash: ${chalk.cyan(result.hash)}`);

    const finalBalance = await getTokenBalance(tokenOut, whaleAddress, CHAIN);
    const actualReceived = finalBalance - initialBalance;

    printSection("Execution Results");
    console.log(
      `  Expected Output: ${chalk.yellow(formatAmount(bestQuote.amountOut, tokenOutDecimals, tokenOutSymbol))}`,
    );
    console.log(
      `  Actual Received: ${chalk.green(formatAmount(actualReceived, tokenOutDecimals, tokenOutSymbol))}`,
    );

    const priceImpact =
      ((Number(bestQuote.amountOut) - Number(actualReceived)) / Number(bestQuote.amountOut)) * 100;
    const impactColor = Math.abs(priceImpact) > 1 ? chalk.red : chalk.green;
    console.log(`  Price Impact: ${impactColor(priceImpact.toFixed(4) + "%")}`);

    const provider = getProvider(CHAIN);
    const receipt = await provider.getTransactionReceipt(result.hash);

    printSection("Gas Analysis");
    console.log(`  Gas Used: ${chalk.cyan(receipt.gasUsed.toString())}`);
    const gasPrice = receipt.gasPrice || ethers.parseUnits("25", "gwei");
    const gasCost = receipt.gasUsed * gasPrice;
    console.log(`  Gas Cost: ${chalk.yellow(formatAmount(gasCost, 18, "ETH"))}`);

    printSection("Summary");
    console.log(chalk.green(`  ✓ Trade executed successfully on fork`));
    console.log(chalk.green(`  ✓ Protocol used: ${bestQuote.protocol} ${bestQuote.version}`));
    console.log(`  ✓ Simulation complete - no real funds were moved`);
  } catch (error) {
    console.error(chalk.red(`\n❌ Execution failed: ${error.message}`));
    if (error.stack) console.error(chalk.gray(error.stack));
  }

  console.log(chalk.cyan("\n" + "═".repeat(70) + "\n"));
}

module.exports = {
  runDexForkSimulation,
  aggregateQuotes,
  executeSwap,
  findBestQuote,
  formatAmount,
  printHeader,
  printSection,
  dexVariantMatches,
};
