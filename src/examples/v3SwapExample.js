// Example: Uniswap V3 swap
// Demonstrates V3-specific features including fee tier selection and multi-hop
require("dotenv").config();
const { ethers } = require("ethers");
const { getCommonToken } = require("../swaps/swap");
const v3 = require("../swaps/v3Swap");

async function main() {
  // Configuration
  const CHAIN = process.env.CHAIN || "ethereum";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY not set in environment");
    console.log("\nUsage:");
    console.log("  export PRIVATE_KEY=0x...");
    console.log("  export CHAIN=ethereum");
    console.log("  node src/examples/v3SwapExample.js");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log(`\n=== Uniswap V3 Swap Example ===`);
  console.log(`Chain: ${CHAIN}`);
  console.log(`Wallet: ${wallet.address}\n`);

  const weth = getCommonToken("WETH", CHAIN);
  const usdc = getCommonToken("USDC", CHAIN);
  const usdt = getCommonToken("USDT", CHAIN);
  const amountIn = ethers.parseEther("0.1");

  // Example 1: Single swap with specific fee tier
  console.log("Example 1: Single swap with 0.3% fee tier");
  try {
    const quote = await v3.getQuote(
      CHAIN,
      weth,
      usdc,
      v3.FEE_TIERS.MEDIUM, // 0.3%
      amountIn.toString()
    );
    console.log(`Quote: ${ethers.formatUnits(quote, 6)} USDC`);

    // Execute swap (commented out for safety)
    /*
    const result = await v3.swapExactInputSingle(
      CHAIN,
      wallet,
      weth,
      usdc,
      v3.FEE_TIERS.MEDIUM,
      amountIn.toString(),
      50, // 0.5% slippage
    );
    console.log(`Transaction: ${result.hash}`);
    */
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // Example 2: Auto-detect best fee tier
  console.log("\n\nExample 2: Auto-detect best fee tier");
  try {
    const bestFee = await v3.findBestFee(CHAIN, weth, usdc, amountIn.toString());
    console.log(`Best fee tier: ${bestFee.fee / 10000}%`);
    console.log(`Expected output: ${ethers.formatUnits(bestFee.amountOut, 6)} USDC`);

    // Execute swap with best fee (commented out for safety)
    /*
    const result = await v3.swapExactInputSingle(
      CHAIN,
      wallet,
      weth,
      usdc,
      bestFee.fee,
      amountIn.toString(),
      50,
    );
    console.log(`Transaction: ${result.hash}`);
    */
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

  // Example 3: Compare all fee tiers
  console.log("\n\nExample 3: Compare all fee tiers");
  const tiers = [
    { name: "0.01%", value: v3.FEE_TIERS.LOWEST },
    { name: "0.05%", value: v3.FEE_TIERS.LOW },
    { name: "0.3%", value: v3.FEE_TIERS.MEDIUM },
    { name: "1%", value: v3.FEE_TIERS.HIGH },
  ];

  for (const tier of tiers) {
    try {
      const quote = await v3.getQuote(CHAIN, weth, usdc, tier.value, amountIn.toString());
      console.log(`  ${tier.name}: ${ethers.formatUnits(quote, 6)} USDC`);
    } catch (error) {
      console.log(`  ${tier.name}: Pool not available`);
    }
  }

  // Example 4: Multi-hop swap
  console.log("\n\nExample 4: Multi-hop swap (USDT -> WETH -> USDC)");
  const amountIn2 = ethers.parseUnits("100", 6); // 100 USDT

  try {
    const tokens = [usdt, weth, usdc];
    const fees = [v3.FEE_TIERS.MEDIUM, v3.FEE_TIERS.MEDIUM]; // 0.3% for both hops

    const quote = await v3.getQuoteMultiHop(CHAIN, tokens, fees, amountIn2.toString());
    console.log(`Quote: ${ethers.formatUnits(quote, 6)} USDC`);
    console.log(`Path: ${tokens.join(" -> ")}`);

    // Execute multi-hop swap (commented out for safety)
    /*
    const result = await v3.swapExactInputMultiHop(
      CHAIN,
      wallet,
      tokens,
      fees,
      amountIn2.toString(),
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
