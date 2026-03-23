require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { getForkContext, printForkContext } = require("../lib/forkSimEnv");
const AaveV2LendingPoolABI = require("../../abis/aave/AaveV2LendingPool.json");
const AaveV3PoolABI = require("../../abis/aave/AaveV3Pool.json");

const CHAIN = process.env.CHAIN || "ethereum";
const ASSET = process.env.AAVE_SIM_ASSET || "USDC";
const RAY = 10n ** 27n;

function formatAPY(rate) {
  const rateNum = Number(rate) / Number(RAY);
  return `${(rateNum * 100).toFixed(2)}%`;
}

async function main() {
  const ctx = await getForkContext(CHAIN);
  printForkContext(CHAIN, ctx, { simulateOnly: true });

  const chain = CHAINS[CHAIN];
  const asset = COMMON_TOKENS[ASSET]?.[CHAIN];
  if (!asset) {
    console.error(chalk.red(`No ${ASSET} on ${CHAIN}`));
    process.exit(1);
  }

  const provider = getProvider(CHAIN);

  if (chain.aave?.v2?.lendingPool) {
    const v2 = new ethers.Contract(chain.aave.v2.lendingPool, AaveV2LendingPoolABI, provider);
    const d = await v2.getReserveData(asset);
    console.log(chalk.cyan("\nAave V2"));
    console.log(`  supply APY (liquidity rate): ${formatAPY(d.currentLiquidityRate)}`);
    console.log(`  borrow APY (variable): ${formatAPY(d.currentVariableBorrowRate)}`);
  } else {
    console.log(chalk.gray("\nNo Aave V2 lendingPool on this chain."));
  }

  if (chain.aave?.v3?.pool) {
    const v3 = new ethers.Contract(chain.aave.v3.pool, AaveV3PoolABI, provider);
    const d = await v3.getReserveData(asset);
    console.log(chalk.cyan("\nAave V3"));
    console.log(`  supply APY (liquidity rate): ${formatAPY(d.currentLiquidityRate)}`);
    console.log(`  borrow APY (variable): ${formatAPY(d.currentVariableBorrowRate)}`);
  } else {
    console.log(chalk.gray("\nNo Aave V3 pool on this chain."));
  }

  console.log("");
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
