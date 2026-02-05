// Example: Uniswap V4 swap
// Demonstrates V4 singleton PoolManager architecture
require("dotenv").config();
const { ethers } = require("ethers");
const { getCommonToken } = require("../swaps/swap");
const v4 = require("../swaps/v4Swap");

async function main() {
  // Configuration
  const CHAIN = process.env.CHAIN || "ethereum";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY not set in environment");
    console.log("\nUsage:");
    console.log("  export PRIVATE_KEY=0x...");
    console.log("  export CHAIN=ethereum");
    console.log("  node src/examples/v4SwapExample.js");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log(`\n=== Uniswap V4 Swap Example ===`);
  console.log(`Chain: ${CHAIN}`);
  console.log(`Wallet: ${wallet.address}\n`);

  // Display V4 info
  const v4Info = v4.getV4Info();
  console.log("V4 Architecture:", v4Info.architecture);
  console.log("Launched:", v4Info.launched);
  console.log("\nKey Differences from V3:");
  v4Info.differences.forEach(diff => console.log(`  - ${diff}`));
  console.log("\n⚠️  Important:", v4Info.notes);

  // Example 1: Create pool key
  console.log("\n\nExample 1: Creating PoolKey");
  const weth = getCommonToken("WETH", CHAIN);
  const usdc = getCommonToken("USDC", CHAIN);

  const poolKey = v4.createPoolKey(
    weth,
    usdc,
    v4.FEE_TIERS.MEDIUM,
    v4.TICK_SPACING[v4.FEE_TIERS.MEDIUM],
    v4.ADDRESS_ZERO // No hooks
  );

  console.log("PoolKey created:");
  console.log(`  Currency0: ${poolKey.currency0}`);
  console.log(`  Currency1: ${poolKey.currency1}`);
  console.log(`  Fee: ${poolKey.fee / 10000}%`);
  console.log(`  Tick Spacing: ${poolKey.tickSpacing}`);
  console.log(`  Hooks: ${poolKey.hooks}`);

  // Example 2: Get pool state
  console.log("\n\nExample 2: Querying pool state");
  try {
    const poolState = await v4.getPoolState(CHAIN, poolKey);
    console.log("Pool state:");
    console.log(`  SqrtPriceX96: ${poolState.sqrtPriceX96}`);
    console.log(`  Current Tick: ${poolState.tick}`);
    console.log(`  Protocol Fee: ${poolState.protocolFee}`);
    console.log(`  LP Fee: ${poolState.lpFee}`);
  } catch (error) {
    console.error(`Error querying pool: ${error.message}`);
    console.log("Pool may not be initialized yet.");
  }

  // Example 3: Estimate swap output
  console.log("\n\nExample 3: Estimating swap output");
  const amountIn = ethers.parseEther("0.1");

  try {
    const estimate = await v4.estimateSwapOutput(CHAIN, weth, usdc, v4.FEE_TIERS.MEDIUM, amountIn.toString());
    console.log(`Estimated output: ${ethers.formatUnits(estimate, 6)} USDC`);
    console.log("Note: This is a simplified estimate");
  } catch (error) {
    console.error(`Error estimating: ${error.message}`);
  }

  // Example 4: Execute swap (VERY CAUTIOUS - commented out)
  console.log("\n\nExample 4: Execute V4 swap");
  console.log("⚠️  WARNING: V4 direct PoolManager interaction is advanced.");
  console.log("Production apps should use V4 Router contracts.");

  /*
  try {
    const result = await v4.swapV4(
      CHAIN,
      wallet,
      weth,
      usdc,
      v4.FEE_TIERS.MEDIUM,
      amountIn.toString(),
      50, // 0.5% slippage
    );
    console.log(`Transaction: ${result.hash}`);
    console.log(`Delta: ${result.delta}`);
  } catch (error) {
    console.error(`Swap failed: ${error.message}`);
  }
  */

  console.log("\n⚠️  Swap execution is commented out.");
  console.log("\n📚 V4 Production Recommendations:");
  console.log("  1. Use official V4 Router contracts for swaps");
  console.log("  2. Implement proper settle/take logic");
  console.log("  3. Handle hooks if pools use them");
  console.log("  4. Use flash accounting patterns");
  console.log("\nDirect PoolManager interaction shown here is for educational purposes.");
}

main();
