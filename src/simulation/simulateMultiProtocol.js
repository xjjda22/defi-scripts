/**
 * Multi-Protocol Trade Simulation
 * Simulates trades across all DEX protocols with automatic best-price selection
 *
 * Supported Protocols:
 * - Uniswap V2/V3/V4
 * - SushiSwap V2/V3
 * - Curve
 * - Balancer V2
 *
 * Usage:
 *   npm run simulate:quote                          # Quote all protocols
 *   npm run simulate:swap                           # Execute best protocol on fork
 *   PROTOCOL=uniswap npm run simulate:swap          # Force specific protocol
 *   TOKENS=USDC,DAI npm run simulate:quote          # Custom token pair
 */
require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../utils/web3");
const { detectFork, getForkBlockNumber } = require("../utils/forkDetection");
const { impersonateWhale, getTokenBalance } = require("../utils/impersonate");
const { CHAINS, COMMON_TOKENS } = require("../config/chains");
const { getPair } = require("../config/pairs");

// Import all swap modules
const v2Swap = require("../swaps/v2Swap");
const v3Swap = require("../swaps/v3Swap");
const sushiswapSwap = require("../swaps/sushiswapSwap");
const curveSwap = require("../swaps/curveSwap");
const balancerSwap = require("../swaps/balancerSwap");

// Configuration
const CHAIN = process.env.CHAIN || "ethereum";
const SIMULATE_ONLY = process.env.SIMULATE_ONLY === "true";
const FORCE_PROTOCOL = process.env.PROTOCOL || null; // uniswap, sushiswap, curve, balancer
const PAIR_NAME = process.env.PAIR || "WETH/USDC";

/**
 * Format token amount with decimals
 */
function formatAmount(amount, decimals = 18, symbol = "") {
  const formatted = ethers.formatUnits(amount, decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Print simulation header
 */
function printHeader(title) {
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan("═".repeat(70) + "\n"));
}

/**
 * Print section
 */
function printSection(title) {
  console.log(chalk.yellow(`\n${title}`));
  console.log(chalk.gray("─".repeat(70)));
}

/**
 * Get quote from Uniswap V2
 */
async function getUniswapV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.uniswap?.v2?.router) return null;

    const provider = getProvider(chainKey);
    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)",
    ];
    const router = new ethers.Contract(chain.uniswap.v2.router, routerAbi, provider);
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[1].toString();
  } catch (error) {
    return null;
  }
}

/**
 * Get quote from Uniswap V3 (best fee tier)
 */
async function getUniswapV3Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const bestFee = await v3Swap.findBestFee(chainKey, tokenIn, tokenOut, amountIn);
    return { amountOut: bestFee.amountOut, fee: bestFee.fee };
  } catch (error) {
    return null;
  }
}

/**
 * Get quote from SushiSwap V2
 */
async function getSushiSwapV2Quote(chainKey, tokenIn, tokenOut, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.sushiswap?.v2?.router) return null;

    const provider = getProvider(chainKey);
    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)",
    ];
    const router = new ethers.Contract(chain.sushiswap.v2.router, routerAbi, provider);
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[1].toString();
  } catch (error) {
    return null;
  }
}

/**
 * Get quote from Curve (if pool exists)
 */
async function getCurveQuote(chainKey, tokenInSymbol, tokenOutSymbol, amountIn) {
  try {
    const chain = CHAINS[chainKey];
    if (!chain?.curve?.pools) return null;

    // Find pool that has both tokens
    for (const [poolKey, pool] of Object.entries(chain.curve.pools)) {
      const coins = pool.coins.map((c) => c.toUpperCase());
      const indexIn = coins.indexOf(tokenInSymbol.toUpperCase());
      const indexOut = coins.indexOf(tokenOutSymbol.toUpperCase());

      if (indexIn !== -1 && indexOut !== -1) {
        const quote = await curveSwap.getQuote(chainKey, pool.address, indexIn, indexOut, amountIn);
        return { amountOut: quote, poolAddress: pool.address, poolName: pool.name, i: indexIn, j: indexOut };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Aggregate quotes from all protocols
 */
async function aggregateQuotes(chainKey, tokenInSymbol, tokenOutSymbol, amountIn) {
  const tokenIn = COMMON_TOKENS[tokenInSymbol]?.[chainKey];
  const tokenOut = COMMON_TOKENS[tokenOutSymbol]?.[chainKey];

  if (!tokenIn || !tokenOut) {
    throw new Error(`Tokens ${tokenInSymbol}/${tokenOutSymbol} not configured for ${chainKey}`);
  }

  const quotes = [];

  printSection("Fetching Quotes from All Protocols");
  console.log(chalk.gray("Querying DEX protocols...\n"));

  // Uniswap V2
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

  // Uniswap V3
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
      chalk.green("✓") + ` ${formatAmount(uniV3Quote.amountOut, 6)} ${tokenOutSymbol} (${uniV3Quote.fee / 10000}% fee)`
    );
  } else {
    console.log(chalk.red("✗") + " Not available");
  }

  // SushiSwap V2
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

  // Curve
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
    console.log(chalk.green("✓") + ` ${formatAmount(curveQuote.amountOut, 6)} ${tokenOutSymbol} (${curveQuote.poolName})`);
  } else {
    console.log(chalk.red("✗") + " Not available");
  }

  // Balancer (Note: Requires poolId, skipping for now unless configured)
  // You can add Balancer support here if you have pool IDs configured

  return quotes;
}

/**
 * Find best quote
 */
function findBestQuote(quotes) {
  if (quotes.length === 0) return null;
  return quotes.reduce((best, current) => {
    return BigInt(current.amountOut) > BigInt(best.amountOut) ? current : best;
  });
}

/**
 * Execute swap on best protocol
 */
async function executeSwap(chainKey, signer, bestQuote, tokenInSymbol, tokenOutSymbol, amountIn, slippageBps = 50) {
  const { protocol, version, data } = bestQuote;

  console.log(chalk.gray(`\n  Executing ${protocol} ${version} swap...`));

  if (protocol === "Uniswap" && version === "V2") {
    return await v2Swap.swapExactTokensForTokens(chainKey, signer, data.tokenIn, data.tokenOut, amountIn, slippageBps);
  } else if (protocol === "Uniswap" && version === "V3") {
    return await v3Swap.swapExactInputSingle(
      chainKey,
      signer,
      data.tokenIn,
      data.tokenOut,
      data.fee,
      amountIn,
      slippageBps
    );
  } else if (protocol === "SushiSwap" && version === "V2") {
    const chain = CHAINS[chainKey];
    const provider = getProvider(chainKey);
    const routerAbi = [
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
    ];
    const router = new ethers.Contract(chain.sushiswap.v2.router, routerAbi, signer);

    // Approve
    const ERC20_ABI = ["function approve(address spender, uint256 amount) returns (bool)"];
    const tokenContract = new ethers.Contract(data.tokenIn, ERC20_ABI, signer);
    const approveTx = await tokenContract.approve(chain.sushiswap.v2.router, amountIn);
    await approveTx.wait();
    console.log(chalk.gray("  Token approved"));

    // Swap
    const amountOutMin = (BigInt(bestQuote.amountOut) * BigInt(10000 - slippageBps)) / BigInt(10000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin.toString(),
      [data.tokenIn, data.tokenOut],
      await signer.getAddress(),
      deadline
    );
    const receipt = await tx.wait();
    return { hash: receipt.hash };
  } else if (protocol === "Curve") {
    return await curveSwap.executeSwap(
      chainKey,
      signer,
      data.poolAddress,
      data.tokenIn,
      data.tokenOut,
      data.i,
      data.j,
      amountIn,
      slippageBps
    );
  }

  throw new Error(`Execution not implemented for ${protocol} ${version}`);
}

/**
 * Main simulation function
 */
async function simulateMultiProtocolSwap() {
  printHeader("MULTI-PROTOCOL TRADE SIMULATION");

  // Check fork status
  const { isFork, forkType } = await detectFork(CHAIN);
  const chain = CHAINS[CHAIN];
  const forkBlock = isFork ? await getForkBlockNumber(CHAIN) : null;

  console.log(chalk.bold("Environment:"));
  console.log(`  Chain: ${chalk.green(chain.name)} (${CHAIN})`);
  console.log(`  Fork Status: ${isFork ? chalk.green(`YES (${forkType})`) : chalk.red("NO (Mainnet)")}`);
  if (forkBlock) {
    console.log(`  Fork Block: ${chalk.cyan(forkBlock)}`);
  }
  console.log(`  Mode: ${SIMULATE_ONLY ? chalk.yellow("QUOTE ONLY") : chalk.green("FULL EXECUTION")}`);
  console.log(`  Pair: ${chalk.cyan(PAIR_NAME)}`);
  if (FORCE_PROTOCOL) {
    console.log(`  Protocol Filter: ${chalk.cyan(FORCE_PROTOCOL.toUpperCase())}`);
  }

  // Trading parameters from pairs.js
  const pair = getPair(PAIR_NAME);
  const tokenInSymbol = pair.tokenIn;
  const tokenOutSymbol = pair.tokenOut;
  const tokenInDecimals = ["USDC", "USDT"].includes(tokenInSymbol) ? 6 : 18;
  const tokenOutDecimals = ["USDC", "USDT"].includes(tokenOutSymbol) ? 6 : 18;
  const amountIn = tokenInDecimals === 6 
    ? ethers.parseUnits(pair.amount, 6) 
    : ethers.parseEther(pair.amount);

  printSection("Trade Parameters");
  console.log(`  Token In: ${chalk.cyan(tokenInSymbol)}`);
  console.log(`  Token Out: ${chalk.cyan(tokenOutSymbol)}`);
  console.log(`  Amount In: ${chalk.green(pair.amount + " " + tokenInSymbol)}`);

  // ═══════════════════════════════════════════════════════════════════════
  // PART 1: QUOTE SIMULATION (Works on mainnet or fork)
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("PART 1: QUOTE SIMULATION (All Protocols)");

  const quotes = await aggregateQuotes(CHAIN, tokenInSymbol, tokenOutSymbol, amountIn.toString());

  if (quotes.length === 0) {
    console.error(chalk.red("\n❌ No liquidity found on any protocol"));
    process.exit(1);
  }

  // Filter by protocol if specified
  let filteredQuotes = quotes;
  if (FORCE_PROTOCOL) {
    filteredQuotes = quotes.filter((q) => q.protocol.toLowerCase() === FORCE_PROTOCOL.toLowerCase());
    if (filteredQuotes.length === 0) {
      console.error(chalk.red(`\n❌ No quotes found for protocol: ${FORCE_PROTOCOL}`));
      process.exit(1);
    }
  }

  // Find best quote
  const bestQuote = findBestQuote(filteredQuotes);

  printSection("Best Quote");
  console.log(`  Protocol: ${chalk.cyan(bestQuote.protocol + " " + bestQuote.version)}`);
  console.log(`  Expected Output: ${chalk.green(formatAmount(bestQuote.amountOut, tokenOutDecimals, tokenOutSymbol))}`);

  // Calculate savings vs worst (only if more than one quote)
  if (filteredQuotes.length > 1) {
    const worstQuote = filteredQuotes.reduce((worst, current) => {
      return BigInt(current.amountOut) < BigInt(worst.amountOut) ? current : worst;
    });
    
    // Only calculate if worst quote is not zero
    if (BigInt(worstQuote.amountOut) > 0n) {
      const savings = ((BigInt(bestQuote.amountOut) - BigInt(worstQuote.amountOut)) * BigInt(10000)) / BigInt(worstQuote.amountOut);
      console.log(`  Savings vs Worst: ${chalk.yellow((Number(savings) / 100).toFixed(2) + "%")}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART 2: EXECUTION SIMULATION (Requires fork)
  // ═══════════════════════════════════════════════════════════════════════

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

  // Impersonate whale wallet
  let signer;
  try {
    signer = await impersonateWhale(tokenInSymbol, CHAIN);
    const whaleAddress = await signer.getAddress();
    const tokenIn = COMMON_TOKENS[tokenInSymbol][CHAIN];
    const tokenOut = COMMON_TOKENS[tokenOutSymbol][CHAIN];

    console.log(`  Impersonated Whale: ${chalk.cyan(whaleAddress)}`);

    // Check balances
    const tokenInBalance = await getTokenBalance(tokenIn, whaleAddress, CHAIN);
    const ethBalance = await getProvider(CHAIN).getBalance(whaleAddress);

    console.log(`  ${tokenInSymbol} Balance: ${chalk.green(formatAmount(tokenInBalance, tokenInDecimals, tokenInSymbol))}`);
    console.log(`  ETH Balance: ${chalk.green(formatAmount(ethBalance, 18, "ETH"))}`);

    if (tokenInBalance < amountIn) {
      throw new Error(`Insufficient ${tokenInSymbol} balance in whale wallet`);
    }

    // Get initial output token balance
    const initialBalance = await getTokenBalance(tokenOut, whaleAddress, CHAIN);
    console.log(`\n  Initial ${tokenOutSymbol} Balance: ${chalk.gray(formatAmount(initialBalance, tokenOutDecimals, tokenOutSymbol))}`);

    // Execute swap
    printSection("Executing Swap on Fork");
    const result = await executeSwap(CHAIN, signer, bestQuote, tokenInSymbol, tokenOutSymbol, amountIn.toString());

    console.log(chalk.green(`\n  ✓ Transaction confirmed!`));
    console.log(`  Hash: ${chalk.cyan(result.hash)}`);

    // Get final balance
    const finalBalance = await getTokenBalance(tokenOut, whaleAddress, CHAIN);
    const actualReceived = finalBalance - initialBalance;

    printSection("Execution Results");
    console.log(`  Expected Output: ${chalk.yellow(formatAmount(bestQuote.amountOut, tokenOutDecimals, tokenOutSymbol))}`);
    console.log(`  Actual Received: ${chalk.green(formatAmount(actualReceived, tokenOutDecimals, tokenOutSymbol))}`);

    const priceImpact = ((Number(bestQuote.amountOut) - Number(actualReceived)) / Number(bestQuote.amountOut)) * 100;
    const impactColor = Math.abs(priceImpact) > 1 ? chalk.red : chalk.green;
    console.log(`  Price Impact: ${impactColor(priceImpact.toFixed(4) + "%")}`);

    // Get transaction receipt for gas info
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
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }

  console.log(chalk.cyan("\n" + "═".repeat(70) + "\n"));
}

// Run simulation
if (require.main === module) {
  simulateMultiProtocolSwap()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(chalk.red("\n❌ Simulation failed:"), error.message);
      process.exit(1);
    });
}

module.exports = { simulateMultiProtocolSwap };
