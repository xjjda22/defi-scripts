/**
 * SushiSwap Swap Example
 * Demonstrates token swaps on SushiSwap V2 and V3
 */
require("dotenv").config();
const { ethers } = require("ethers");
const { swapTokens, getV2Quote, getV3Quote } = require("../swaps/sushiswapSwap");
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

  console.log(`\nSushiSwap Swap Example on ${chainKey}`);
  console.log(`Wallet: ${wallet.address}\n`);

  const WETH = COMMON_TOKENS.WETH[chainKey];
  const USDC = COMMON_TOKENS.USDC[chainKey];
  const amountIn = ethers.parseEther("0.01").toString();

  console.log("Getting quotes...\n");

  try {
    const v2Quote = await getV2Quote(chainKey, WETH, USDC, amountIn);
    console.log(`SushiSwap V2 Quote: ${ethers.formatUnits(v2Quote.amountOut, 6)} USDC`);
  } catch (error) {
    console.log(`SushiSwap V2: ${error.message}`);
  }

  try {
    const v3Quote = await getV3Quote(chainKey, WETH, USDC, amountIn, 3000);
    console.log(`SushiSwap V3 Quote: ${ethers.formatUnits(v3Quote.amountOut, 6)} USDC`);
  } catch (error) {
    console.log(`SushiSwap V3: ${error.message}`);
  }

  console.log("\nSwap execution is commented out.");
  console.log("Uncomment the code below to execute a real swap:\n");

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
  // console.log(`Transaction: ${result.hash}`);
  // console.log(`Version used: ${result.version}`);
}

main().catch(console.error);
