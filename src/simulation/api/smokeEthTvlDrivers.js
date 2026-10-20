require("dotenv").config();
const chalk = require("chalk");
const { buildEthTvlDrivers } = require("../../analytics/aggregators/ethTvlDrivers");

async function main() {
  const board = await buildEthTvlDrivers();
  if (!board.inflow || board.inflow.length < 3) {
    console.error("eth tvl drivers inflow too small");
    process.exit(1);
  }
  // The large Ethereum venues can sit on either side of the board in a given week (2026-10-21:
  // Lido, Aave V3 and EigenCloud were all outflows), so look for them among inflow + outflow.
  const movers = board.inflow.concat(board.outflow || []);
  const names = movers.map((r) => String(r.name || "").toLowerCase()).join(" ");
  if (!/lido|aave|spark|eigen/.test(names)) {
    console.error("expected Lido, Aave, Spark, or Eigen among the TVL movers (inflow or outflow)");
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
