require("dotenv").config();
const chalk = require("chalk");
const { CHAIN, buildEthDexShare } = require("../../analytics/aggregators/ethDexShare");

async function main() {
  const board = await buildEthDexShare();
  if (!board.top24h || board.top24h.length < 3) {
    console.error("eth dex share top24h too small");
    process.exit(1);
  }
  if (!board.headline.v3 && !board.headline.v4) {
    console.error("expected Uniswap V3 or V4 on Ethereum DEX share board");
    process.exit(1);
  }
  const v4 = board.headline.v4 ? board.headline.v4.name : "—";
  console.log(chalk.green(`  ${CHAIN} 24h ${board.totals.total24h != null ? Math.round(board.totals.total24h) : "—"}`));
  console.log(chalk.green(`  venues ${board.top24h.length}  v4 ${v4}`));
  console.log(chalk.green("\nOK (ethereum dex share)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
