// Example: Uniswap V2 swap
// Demonstrates V2-specific swap functionality including multi-hop routes
require("dotenv").config();
const { ethers } = require("ethers");
const { getCommonToken } = require("../swaps/swap");
const v2 = require("../swaps/v2Swap");

async function main() {
  // Configuration
  const CHAIN = process.env.CHAIN || "ethereum";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY not set in environment");
    console.log("\nUsage:");
    console.log("  export PRIVATE_KEY=0x...");
    console.log("  export CHAIN=ethereum");
    console.log("  node src/examples/v2SwapExample.js");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log(`\n=== Uniswap V2 Swap Example ===`);
  console.log(`Chain: ${CHAIN}`);
  console.log(`Wallet: ${wallet.address}\n`);

  // Example 1: Simple direct swap
  console.log("Example 1: Direct swap (WETH -> USDC)");
  const weth = getCommonToken("WETH", CHAIN);
  const usdc = getCommonToken("USDC", CHAIN);
  const amountIn = ethers.parseEther("0.1");

  try {
    // Get quote
    const quote = await v2.getQuote(CHAIN, weth, usdc, amountIn.toString());
    console.log(`Quote: ${ethers.formatUnits(quote.amountOut, 6)} USDC`);
    console.log(`Path: ${quote.path.join(" -> ")}`);

    // Execute swap (commented out for safety)
    /*
    const result = await v2.swapExactTokensForTokens(
      CHAIN,
      wallet,
      weth,
      usdc,
      amountIn.toString(),
      50, // 0.5% slippage
    );
    console.log(`Transaction: ${result.hash}`);
    */
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // Example 2: Multi-hop swap
  console.log("\n\nExample 2: Multi-hop swap (USDT -> WETH -> USDC)");
  const usdt = getCommonToken("USDT", CHAIN);
  const amountIn2 = ethers.parseUnits("100", 6); // 100 USDT

  try {
    // Custom path: USDT -> WETH -> USDC
    const path = [usdt, weth, usdc];
    const quote = await v2.getQuote(CHAIN, usdt, usdc, amountIn2.toString(), path);
    console.log(`Quote: ${ethers.formatUnits(quote.amountOut, 6)} USDC`);
    console.log(`Path: ${quote.path.join(" -> ")}`);

    // Execute swap (commented out for safety)
    /*
    const result = await v2.swapExactTokensForTokens(
      CHAIN,
      wallet,
      usdt,
      usdc,
      amountIn2.toString(),
      50,
      null,
      path
    );
    console.log(`Transaction: ${result.hash}`);
    */
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // Example 3: Exact output swap
  console.log("\n\nExample 3: Exact output swap (get exactly 1000 USDC)");
  const desiredOutput = ethers.parseUnits("1000", 6); // Want exactly 1000 USDC

  try {
    const quote = await v2.getQuoteForExactOutput(
      CHAIN,
      weth,
      usdc,
      desiredOutput.toString(),
    );
    console.log(`Required input: ${ethers.formatEther(quote.amountIn)} WETH`);

    // Execute swap (commented out for safety)
    /*
    const result = await v2.swapTokensForExactTokens(
      CHAIN,
      wallet,
      weth,
      usdc,
      desiredOutput.toString(),
      50,
    );
    console.log(`Transaction: ${result.hash}`);
    */
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  console.log("\n⚠️  All swap executions are commented out for safety.");
  console.log("Uncomment the execution code to perform actual swaps.");
}

main();
