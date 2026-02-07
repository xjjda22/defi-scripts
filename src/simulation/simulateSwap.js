/**
 * Trade Simulation Script
 * Demonstrates both quote simulation (read-only) and execution simulation (on fork)
 *
 * Usage:
 *   SIMULATE_ONLY=true node src/simulation/simulateSwap.js   # Quote only
 *   node src/simulation/simulateSwap.js                       # Full execution on fork
 */
require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../utils/web3");
const { detectFork, getForkBlockNumber } = require("../utils/forkDetection");
const { impersonateWhale, getTokenBalance } = require("../utils/impersonate");
const { CHAINS, COMMON_TOKENS } = require("../config/chains");
const { getPair } = require("../config/pairs");
const v3Swap = require("../swaps/v3Swap");

// Configuration
const CHAIN = process.env.CHAIN || "ethereum";
const SIMULATE_ONLY = process.env.SIMULATE_ONLY === "true";
const PAIR_NAME = process.env.PAIR || "WETH/USDC";

/**
 * Calculate price impact
 */
function calculatePriceImpact(expectedOut, actualOut) {
  const impact = ((Number(expectedOut) - Number(actualOut)) / Number(expectedOut)) * 100;
  return impact.toFixed(4);
}

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
 * Main simulation function
 */
async function simulateSwap() {
  printHeader("UNISWAP V3 TRADE SIMULATION");

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

  // Trading parameters from pairs.js
  const pair = getPair(PAIR_NAME);
  const tokenIn = COMMON_TOKENS[pair.tokenIn][CHAIN];
  const tokenOut = COMMON_TOKENS[pair.tokenOut][CHAIN];
  
  // Determine decimals based on token
  const tokenInDecimals = ["USDC", "USDT"].includes(pair.tokenIn) ? 6 : 18;
  const tokenOutDecimals = ["USDC", "USDT"].includes(pair.tokenOut) ? 6 : 18;
  
  const amountIn = tokenInDecimals === 6 
    ? ethers.parseUnits(pair.amount, 6) 
    : ethers.parseEther(pair.amount);

  printSection("Trade Parameters");
  console.log(`  Token In: ${chalk.cyan(pair.tokenIn)} (${tokenIn})`);
  console.log(`  Token Out: ${chalk.cyan(pair.tokenOut)} (${tokenOut})`);
  console.log(`  Amount In: ${chalk.green(pair.amount + " " + pair.tokenIn)}`);

  // ═══════════════════════════════════════════════════════════════════════
  // PART 1: QUOTE SIMULATION (Works on mainnet or fork)
  // ═══════════════════════════════════════════════════════════════════════
  printHeader("PART 1: QUOTE SIMULATION (Read-Only)");

  console.log(chalk.gray("Fetching quotes from all fee tiers...\n"));

  const feeTiers = [
    { name: "0.01%", value: v3Swap.FEE_TIERS.LOWEST },
    { name: "0.05%", value: v3Swap.FEE_TIERS.LOW },
    { name: "0.3%", value: v3Swap.FEE_TIERS.MEDIUM },
    { name: "1%", value: v3Swap.FEE_TIERS.HIGH },
  ];

  const quotes = [];

  for (const tier of feeTiers) {
    try {
      const quote = await v3Swap.getQuote(CHAIN, tokenIn, tokenOut, tier.value, amountIn.toString());
      const quoteFormatted = ethers.formatUnits(quote, tokenOutDecimals);
      quotes.push({ tier: tier.name, value: tier.value, quote, quoteFormatted });
      console.log(`  ${tier.name.padEnd(6)} ${chalk.green("✓")} ${chalk.cyan(quoteFormatted)} ${pair.tokenOut}`);
    } catch (error) {
      console.log(`  ${tier.name.padEnd(6)} ${chalk.red("✗")} Pool not available`);
    }
  }

  if (quotes.length === 0) {
    console.error(chalk.red("\n❌ No liquidity found on any fee tier"));
    process.exit(1);
  }

  // Find best quote
  const bestQuote = quotes.reduce((best, current) => {
    return BigInt(current.quote) > BigInt(best.quote) ? current : best;
  });

  printSection("Best Quote");
  console.log(`  Fee Tier: ${chalk.cyan(bestQuote.tier)}`);
  console.log(`  Expected Output: ${chalk.green(bestQuote.quoteFormatted + " " + pair.tokenOut)}`);
  console.log(`  Exchange Rate: ${chalk.yellow(pair.amount + " " + pair.tokenIn)} = ${chalk.yellow(bestQuote.quoteFormatted + " " + pair.tokenOut)}`);

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
    signer = await impersonateWhale(pair.tokenIn, CHAIN);
    const whaleAddress = await signer.getAddress();
    console.log(`  Impersonated Whale: ${chalk.cyan(whaleAddress)}`);

    // Check balances
    const tokenInBalance = await getTokenBalance(tokenIn, whaleAddress, CHAIN);
    const ethBalance = await getProvider(CHAIN).getBalance(whaleAddress);

    console.log(`  ${pair.tokenIn} Balance: ${chalk.green(formatAmount(tokenInBalance, tokenInDecimals, pair.tokenIn))}`);
    console.log(`  ETH Balance: ${chalk.green(formatAmount(ethBalance, 18, "ETH"))}`);

    if (tokenInBalance < amountIn) {
      throw new Error(`Insufficient ${pair.tokenIn} balance in whale wallet`);
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to set up test wallet: ${error.message}`));
    return;
  }

  printSection("Executing Swap on Fork");

  try {
    // Get initial token out balance
    const initialBalance = await getTokenBalance(tokenOut, await signer.getAddress(), CHAIN);
    console.log(`  Initial ${pair.tokenOut} Balance: ${chalk.gray(formatAmount(initialBalance, tokenOutDecimals, pair.tokenOut))}`);

    // Execute swap
    console.log(chalk.gray("\n  Submitting transaction..."));
    const result = await v3Swap.swapExactInputSingle(
      CHAIN,
      signer,
      tokenIn,
      tokenOut,
      bestQuote.value,
      amountIn.toString(),
      50 // 0.5% slippage
    );

    console.log(chalk.green(`\n  ✓ Transaction confirmed!`));
    console.log(`  Hash: ${chalk.cyan(result.hash)}`);

    // Get final token out balance
    const finalBalance = await getTokenBalance(tokenOut, await signer.getAddress(), CHAIN);
    const actualReceived = finalBalance - initialBalance;

    printSection("Execution Results");
    console.log(`  Expected Output: ${chalk.yellow(bestQuote.quoteFormatted + " " + pair.tokenOut)}`);
    console.log(`  Actual Received: ${chalk.green(formatAmount(actualReceived, tokenOutDecimals, pair.tokenOut))}`);

    const priceImpact = calculatePriceImpact(bestQuote.quote, actualReceived);
    const impactColor = Math.abs(parseFloat(priceImpact)) > 1 ? chalk.red : chalk.green;
    console.log(`  Price Impact: ${impactColor(priceImpact + "%")}`);

    // Get transaction receipt for gas info
    const provider = getProvider(CHAIN);
    const receipt = await provider.getTransactionReceipt(result.hash);

    printSection("Gas Analysis");
    console.log(`  Gas Used: ${chalk.cyan(receipt.gasUsed.toString())}`);
    const gasPrice = receipt.gasPrice || ethers.parseUnits("25", "gwei");
    const gasCost = receipt.gasUsed * gasPrice;
    console.log(`  Gas Cost: ${chalk.yellow(formatAmount(gasCost, 18, "ETH"))}`);

    printSection("Summary");
    console.log(chalk.green("  ✓ Trade executed successfully on fork"));
    console.log(`  ✓ Simulation complete - no real funds were moved`);
    console.log(`  ✓ Transaction hash: ${chalk.cyan(result.hash)}`);
  } catch (error) {
    console.error(chalk.red(`\n❌ Swap execution failed: ${error.message}`));
    if (error.data) {
      console.error(chalk.gray("Error data:"), error.data);
    }
  }

  console.log(chalk.cyan("\n" + "═".repeat(70) + "\n"));
}

// Run simulation
if (require.main === module) {
  simulateSwap()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(chalk.red("\n❌ Simulation failed:"), error.message);
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    });
}

module.exports = { simulateSwap };
