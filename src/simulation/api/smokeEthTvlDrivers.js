require("dotenv").config();
const chalk = require("chalk");
const { buildEthTvlDrivers } = require("../../analytics/aggregators/ethTvlDrivers");

async function main() {
  const board = await buildEthTvlDrivers();
  if (!board.inflow || board.inflow.length < 3) {
    console.error("eth tvl drivers inflow too small");
    process.exit(1);
  }
  const names = board.inflow.map((r) => String(r.name || "").toLowerCase()).join(" ");
  if (!/lido|aave|spark|eigen/.test(names)) {
    console.error("expected Lido, Aave, Spark, or Eigen in TVL inflow");
    process.exit(1);
  }
  const cex = (board.inflow || []).concat(board.outflow || []).some((r) => r.category === "CEX");
  if (cex) {
    console.error("CEX rows should be omitted from TVL drivers");
    process.exit(1);
  }
  console.log(chalk.green(`  inflow ${board.inflow.length}  top ${board.inflow[0].name}`));
  console.log(chalk.green("\nOK (eth tvl drivers)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
