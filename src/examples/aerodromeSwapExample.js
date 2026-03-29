// Aerodrome Slipstream (Base): Slipstream quoters do not succeed with QuoterV2.staticCall here;
// this example quotes Uniswap V3 on Base for the same WETH/USDC pair as a liquid reference.
require("dotenv").config();
const chalk = require("chalk");
const { ethers } = require("ethers");
const { getCommonToken } = require("../swaps/swap");
const v3 = require("../swaps/v3Swap");

async function main() {
  const CHAIN = process.env.CHAIN || "base";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  console.log(
    chalk.yellow(
      "\n[Aerodrome Slipstream] On-chain Slipstream quoter calls revert with this repo’s QuoterV2 path; " +
        "showing Uniswap V3 quote on Base for WETH→USDC. Execute swaps via Aerodrome UI or extend with a compatible quoter.\n"
    )
  );

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY not set (only needed to execute; quote works without it)");
    console.log("  export CHAIN=base");
    console.log("  node src/examples/aerodromeSwapExample.js\n");
  }

  const weth = getCommonToken("WETH", CHAIN);
  const usdc = getCommonToken("USDC", CHAIN);
  const amountIn = ethers.parseEther("0.05");

  const best = await v3.findBestFee(CHAIN, weth, usdc, amountIn.toString(), "uniswap");
  console.log(`Uniswap V3 (Base) reference — out: ${ethers.formatUnits(best.amountOut, 6)} USDC @ fee ${best.fee}`);

  if (PRIVATE_KEY) {
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log(`Wallet: ${wallet.address}`);
    /*
    await v3.swapExactInputSingle(CHAIN, wallet, weth, usdc, best.fee, amountIn.toString(), 50, null, "uniswap");
    */
    console.log(chalk.gray("(Uncomment swap in source to execute on Uniswap V3, not Slipstream.)\n"));
  }
}

main().catch(e => {
  console.error(e.message || e);
  process.exit(1);
});
