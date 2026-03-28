require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { getForkContext, printForkContext } = require("../lib/forkSimEnv");

const CHAIN = process.env.CHAIN || "ethereum";
const MAX_BLOCKS = Math.min(5000, Math.max(100, parseInt(process.env.AAVE_LIQ_SIM_BLOCKS || "2000", 10) || 2000));

const POOL_IFACE = new ethers.Interface([
  "event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)",
]);

async function main() {
  const ctx = await getForkContext(CHAIN);
  printForkContext(CHAIN, ctx, { simulateOnly: true });

  const pool = CHAINS[CHAIN]?.aave?.v3?.pool;
  if (!pool) {
    console.error(chalk.red("No Aave V3 pool for chain"));
    process.exit(1);
  }

  const provider = getProvider(CHAIN);
  const latest = await provider.getBlockNumber();
  const from = Math.max(0, latest - MAX_BLOCKS);
  const topic = POOL_IFACE.getEvent("LiquidationCall").topicHash;

  console.log(chalk.cyan(`\nScanning LiquidationCall logs blocks ${from}..${latest}\n`));

  const logs = await provider.getLogs({
    address: pool,
    topics: [topic],
    fromBlock: from,
    toBlock: latest,
  });

  console.log(chalk.green(`Found ${logs.length} liquidation event(s) in window`));
  const show = Math.min(5, logs.length);
  for (let i = 0; i < show; i++) {
    const log = logs[i];
    console.log(`  ${i + 1}. block ${log.blockNumber} tx ${log.transactionHash.slice(0, 18)}…`);
  }
  if (logs.length > show) console.log(chalk.gray(`  … ${logs.length - show} more`));
  console.log("");
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
