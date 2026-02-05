/**
 * Curve Finance Swap Example
 * Demonstrates token swaps through Curve pools
 */
require("dotenv").config();
const { ethers } = require("ethers");
const { swapTokens, getQuote, getPoolInfo, findTokenIndices } = require("../swaps/curveSwap");
const { COMMON_TOKENS } = require("../config/chains");

async function main() {
  const chainKey = process.env.CHAIN || "ethereum";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("Error: PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`\nCurve Finance Swap Example on ${chainKey}`);
  console.log(`Wallet: ${wallet.address}\n`);

  const USDC = COMMON_TOKENS.USDC[chainKey];
  const USDT = COMMON_TOKENS.USDT[chainKey];
  const amountIn = ethers.parseUnits("100", 6).toString();

  // Example: 3pool (USDC/USDT/DAI) on Ethereum
  const poolAddress = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

  console.log("Curve auto-routes between multiple pools if provided as array");
  console.log(`Example pool address: ${poolAddress}\n`);

  try {
    const poolInfo = await getPoolInfo(chainKey, poolAddress, 3);
    console.log("\nPool information:");
    console.log(`Virtual price: ${poolInfo.virtualPrice}`);
    console.log(`Fee: ${poolInfo.fee}`);
    console.log(`Amplification (A): ${poolInfo.amplification}`);
    console.log("\nPool tokens:");
    poolInfo.coins.forEach((coin, i) => {
      console.log(`  Index ${i}: ${coin}`);
      console.log(`    Balance: ${poolInfo.balances[i]}`);
    });

    // Find token indices automatically
    const indices = await findTokenIndices(chainKey, poolAddress, USDC, USDT, 3);
    console.log(`\nToken indices: USDC is index ${indices.i}, USDT is index ${indices.j}`);

    // Get quote
    const quote = await getQuote(chainKey, poolAddress, indices.i, indices.j, amountIn);
    console.log(`\nQuote for swapping 100 USDC to USDT:`);
    console.log(`Expected output: ${ethers.formatUnits(quote, 6)} USDT`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log("\nSwap execution is commented out.");
  console.log("Uncomment the code below to execute a real swap:\n");

  // const indices = await findTokenIndices(chainKey, poolAddress, USDC, USDT, 3);
  //
  // const result = await swapTokens(
  //   chainKey,
  //   wallet,
  //   poolAddress,
  //   USDC,
  //   USDT,
  //   indices.i,
  //   indices.j,
  //   amountIn,
  //   50 // 0.5% slippage
  // );
  // console.log(`\nSwap successful!`);
  // console.log(`Transaction: ${result.hash}`);
  // console.log(`Pool: ${result.poolAddress}`);
}

main().catch(console.error);
