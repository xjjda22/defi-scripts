// Velodrome Slipstream (Optimism): same Slipstream quoter limitation as Aerodrome; Uniswap V3 reference quote.
require("dotenv").config();
const chalk = require("chalk");
const { ethers } = require("ethers");
const { getCommonToken } = require("../swaps/swap");
const v3 = require("../swaps/v3Swap");

async function main() {
  const CHAIN = process.env.CHAIN || "optimism";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  console.log(
    chalk.yellow(
      "\n[Velodrome Slipstream] Showing Uniswap V3 on Optimism as a liquid WETH→USDC reference (see Aerodrome example notes).\n"
    )
  );

  const weth = getCommonToken("WETH", CHAIN);
  const usdc = getCommonToken("USDC", CHAIN);
  const amountIn = ethers.parseEther("0.05");

  const best = await v3.findBestFee(CHAIN, weth, usdc, amountIn.toString(), "uniswap");
  console.log(`Uniswap V3 (Optimism) reference — out: ${ethers.formatUnits(best.amountOut, 6)} USDC @ fee ${best.fee}`);

  if (PRIVATE_KEY) {
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log(`Wallet: ${wallet.address}`);
    console.log(chalk.gray("(Uncomment a v3.swapExactInputSingle(..., \"uniswap\") call to execute on Uniswap V3.)\n"));
  }
}

main().catch(e => {
  console.error(e.message || e);
  process.exit(1);
});
