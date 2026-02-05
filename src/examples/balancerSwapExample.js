/**
 * Balancer Swap Example
 * Demonstrates token swaps through Balancer V2 Vault
 */
require("dotenv").config();
const { ethers } = require("ethers");
const { swapTokens, getPoolInfo } = require("../swaps/balancerSwap");
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

  console.log(`\nBalancer Swap Example on ${chainKey}`);
  console.log(`Wallet: ${wallet.address}\n`);

  const WETH = COMMON_TOKENS.WETH[chainKey];
  const USDC = COMMON_TOKENS.USDC[chainKey];
  const amountIn = ethers.parseEther("0.01").toString();

  // Example pool ID - Replace with actual Balancer pool ID for your token pair
  // You can find pool IDs on https://app.balancer.fi/
  const examplePoolId = "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014";

  console.log("Note: Balancer swaps require a valid pool ID.");
  console.log("Find pool IDs at https://app.balancer.fi/");
  console.log("\nBalancer auto-routes between V2 and V3 vaults (V2 is default)");
  console.log(`Example pool ID: ${examplePoolId}\n`);
  
  try {
    const poolInfo = await getPoolInfo(chainKey, examplePoolId);
    console.log("Pool tokens:");
    poolInfo.tokens.forEach((token, i) => {
      console.log(`  ${i}: ${token} (balance: ${poolInfo.balances[i]})`);
    });
    console.log(`Fee: ${poolInfo.fee}`);
  } catch (error) {
    console.log(`Could not fetch pool info: ${error.message}`);
  }

  console.log("\nSwap execution is commented out.");
  console.log("Uncomment the code below to execute a real swap:\n");

  // const result = await swapTokens(
  //   chainKey,
  //   wallet,
  //   examplePoolId,
  //   WETH,
  //   USDC,
  //   amountIn,
  //   {
  //     slippageBps: 50,
  //   }
  // );
  // console.log(`\nSwap successful!`);
  // console.log(`Transaction: ${result.hash}`);
  // console.log(`Pool: ${result.poolId}`);
}

main().catch(console.error);
