const chalk = require("chalk");
const { detectFork, getForkBlockNumber } = require("../../utils/forkDetection");
const { CHAINS } = require("../../config/chains");

async function getForkContext(chainKey) {
  const { isFork, forkType } = await detectFork(chainKey);
  const chain = CHAINS[chainKey];
  const forkBlock = isFork ? await getForkBlockNumber(chainKey) : null;
  return { isFork, forkType, forkBlock, chain };
}

function printForkContext(chainKey, ctx, extra = {}) {
  const { isFork, forkType, forkBlock, chain } = ctx;
  console.log(chalk.bold("Environment:"));
  console.log(`  Chain: ${chalk.green(chain?.name || chainKey)} (${chainKey})`);
  console.log(`  Fork Status: ${isFork ? chalk.green(`YES (${forkType})`) : chalk.red("NO (Mainnet)")}`);
  if (forkBlock != null) console.log(`  Fork Block: ${chalk.cyan(String(forkBlock))}`);
  if (extra.simulateOnly != null) {
    console.log(
      `  Mode: ${extra.simulateOnly ? chalk.yellow("READ / API ONLY") : chalk.green("INCLUDES FORK TX")}`,
    );
  }
}

function exitUnlessFork(isFork) {
  if (!isFork) {
    console.error(chalk.red("\nThis script requires a local fork (Anvil/Hardhat)."));
    console.error(chalk.gray("  anvil --fork-url $ETHEREUM_RPC_URL"));
    console.error(chalk.gray("  export ETHEREUM_RPC_URL=http://127.0.0.1:8545\n"));
    process.exit(1);
  }
}

module.exports = {
  getForkContext,
  printForkContext,
  exitUnlessFork,
};
