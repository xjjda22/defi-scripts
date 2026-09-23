require("dotenv").config();
const chalk = require("chalk");
const { buildEthLendingMovers } = require("../../analytics/aggregators/ethLendingMovers");

async function main() {
  const board = await buildEthLendingMovers();
  if (!board.largest || board.largest.length < 3) {
    console.error("eth lending movers largest list too small");
    process.exit(1);
  }
  const names = board.largest.map((r) => String(r.name || "").toLowerCase()).join(" ");
  if (!/aave|spark|morpho/.test(names)) {
    console.error("expected Aave, Spark, or Morpho on lending board");
    process.exit(1);
  }
  console.log(chalk.green(`  lending rows ${board.count}  top ${board.largest[0].name}`));
  console.log(chalk.green("\nOK (eth lending movers)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
