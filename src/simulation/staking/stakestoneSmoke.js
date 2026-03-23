require("dotenv").config();
const chalk = require("chalk");
const { fetchStakeStoneSnapshot } = require("../../analytics/protocols/stakestone/stakingMonitor");

async function main() {
  const s = await fetchStakeStoneSnapshot();
  if (s.slug !== "stakestone-stone") {
    console.error(chalk.red("Unexpected slug"));
    process.exit(1);
  }
  console.log(chalk.green(`OK: ${s.protocol} | TVL ${s.tvlUsd != null ? `$${s.tvlUsd.toFixed(0)}` : "—"}`));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
