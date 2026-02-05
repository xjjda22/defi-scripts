/**
 * DEX Aggregator Example
 * Demonstrates auto-routing across all protocols (Uniswap, SushiSwap, Curve, Balancer)
 * Finds and executes on the protocol with the best price
 */
require("dotenv").config();
const { ethers } = require("ethers");
const { swapTokens, getBestQuote } = require("../swaps/dexAggregator");
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

  console.log(`\nDEX Aggregator - Auto-Route Swap Example on ${chainKey}`);
  console.log(`Wallet: ${wallet.address}\n`);

  const WETH = COMMON_TOKENS.WETH[chainKey];
  const USDC = COMMON_TOKENS.USDC[chainKey];
  const amountIn = ethers.parseEther("0.01").toString();

  console.log(`Swapping 0.01 WETH for USDC`);
  console.log(`Input token: ${WETH}`);
  console.log(`Output token: ${USDC}`);

  // Example 1: Basic auto-routing (Uniswap + SushiSwap only)
  try {
    const bestQuote = await getBestQuote(chainKey, WETH, USDC, amountIn);
    console.log(`\nBest price found:`);
    console.log(`Protocol: ${bestQuote.protocol.toUpperCase()} ${bestQuote.version.toUpperCase()}`);
    console.log(`Expected output: ${ethers.formatUnits(bestQuote.amountOut, 6)} USDC`);
  } catch (error) {
    console.log(`Error getting quotes: ${error.message}`);
  }

  // Example 2: Include Curve pool (if you have a WETH/USDC Curve pool)
  // const curvePoolAddress = "0x..."; // Your Curve pool address
  // const curveIndices = { i: 0, j: 1 }; // Token indices in the pool
  // 
  // const bestQuoteWithCurve = await getBestQuote(chainKey, WETH, USDC, amountIn, {
  //   curvePoolAddress,
  //   curveTokenIndices: curveIndices,
  // });

  // Example 3: Include Balancer pool (if you have a WETH/USDC Balancer pool)
  // const balancerPoolId = "0x..."; // Your Balancer pool ID
  // 
  // const bestQuoteWithBalancer = await getBestQuote(chainKey, WETH, USDC, amountIn, {
  //   balancerPoolId,
  // });

  console.log("\nSwap execution is commented out.");
  console.log("Uncomment the code below to execute a real swap:\n");

  // Execute auto-routed swap
  // const result = await swapTokens(
  //   chainKey,
  //   wallet,
  //   WETH,
  //   USDC,
  //   amountIn,
  //   {
  //     slippageBps: 50,
  //   }
  // );
  // console.log(`\nSwap successful!`);
  // console.log(`Protocol used: ${result.protocol} ${result.version}`);
  // console.log(`Transaction: ${result.hash}`);

  // Force specific protocol
  // const result = await swapTokens(
  //   chainKey,
  //   wallet,
  //   WETH,
  //   USDC,
  //   amountIn,
  //   {
  //     slippageBps: 50,
  //     forceProtocol: 'sushiswap', // Force SushiSwap
  //   }
  // );
}

main().catch(console.error);
