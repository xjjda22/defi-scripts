require("dotenv").config();
const chalk = require("chalk");
const { buildEthYield } = require("../../analytics/aggregators/ethYield");

async function main() {
  const board = await buildEthYield();
  const hasDex = board.pendleDex && board.pendleDex.length > 0;
  const hasTvl = board.pendleTvl && board.pendleTvl.length > 0;
  const hasYield = board.weekUp && board.weekUp.length >= 3;
  if (!hasDex && !hasTvl && !hasYield) {
    console.error("expected Pendle DEX, Pendle TVL, or yield movers");
    process.exit(1);
  }
  const pendle = hasDex ? board.pendleDex[0].name : hasTvl ? board.pendleTvl[0].name : "yield-only";
  console.log(chalk.green(`  pendle ${pendle}  yield movers ${board.weekUp.length}`));
  console.log(chalk.green("\nOK (eth yield / pendle)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
