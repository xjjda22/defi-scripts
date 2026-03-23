/**
 * All liquid staking (LST) category view — same engine as Week 3 compare, Week 4 banner.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { runStakingYieldComparison } = require("./stakingYieldAggregator");

async function main() {
  installCliSafeStdout();
  try {
    await runStakingYieldComparison({
      title: chalk.cyan.bold("\nAll staking protocols — category view (Week 4)\n"),
    });
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
