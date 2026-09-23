require("dotenv").config();
const chalk = require("chalk");
const { buildRwaOverview } = require("../../analytics/aggregators/rwaOverview");

async function main() {
  const board = await buildRwaOverview();
  if (!board.largest || board.largest.length < 3) {
    console.error("rwa overview largest list too small");
    process.exit(1);
  }
  console.log(chalk.green(`  RWA board ${board.count}  top ${board.largest[0].name}`));
  console.log(chalk.green("\nOK (rwa overview)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
