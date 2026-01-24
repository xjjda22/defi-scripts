// Example: Unified swap across all Uniswap versions
// This script demonstrates auto-routing to find the best swap route
require("dotenv").config();
const { ethers } = require("ethers");
const { swapTokens, compareQuotes, getCommonToken } = require("../swaps/swap");

async function main() {
  // Configuration
  const CHAIN = process.env.CHAIN || "ethereum";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY not set in environment");
    console.log("\nSet your private key:");
    console.log("  export PRIVATE_KEY=0x...");
    process.exit(1);
  }

  // Create wallet
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log(`Using wallet: ${wallet.address}`);

  // Example: Swap 0.1 WETH for USDC
  const tokenIn = getCommonToken("WETH", CHAIN);
  const tokenOut = getCommonToken("USDC", CHAIN);
  const amountIn = ethers.parseEther("0.1"); // 0.1 WETH

  console.log(`\n=== Swap Example on ${CHAIN} ===`);
  console.log(`Swapping 0.1 WETH for USDC\n`);

  try {
    // Step 1: Compare quotes across all versions
    console.log("Step 1: Comparing quotes across V2, V3, and V4...");
    const quotes = await compareQuotes(CHAIN, tokenIn, tokenOut, amountIn.toString());

    // Step 2: Execute swap with auto-routing (finds best price)
    console.log("\nStep 2: Executing swap with best route...");

    // Uncomment to execute actual swap:
    /*
    const result = await swapTokens(
      CHAIN,
      wallet,
      tokenIn,
      tokenOut,
      amountIn.toString(),
      {
        slippageBps: 50, // 0.5% slippage
        recipient: null, // Send to wallet address
        version: null,   // Auto-detect best version (or specify: 'v2', 'v3', 'v4')
      }
    );

    console.log(`\n✅ Swap completed!`);
    console.log(`Version: ${result.version}`);
    console.log(`Transaction: ${result.hash}`);
    console.log(`Output amount: ${result.amountOut}`);
    */

    console.log("\n⚠️  Swap execution is commented out. Uncomment to execute.");
    console.log("Quotes retrieved successfully!");
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
