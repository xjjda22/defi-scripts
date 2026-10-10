require("dotenv").config();
const chalk = require("chalk");
const { readRwaTokens, tokenKeysFromEnv } = require("../../analytics/protocols/onchain/rwaSupplyMonitor");

async function main() {
  const rows = await readRwaTokens(tokenKeysFromEnv());
  const bad = rows.filter(r => !(r.valueUsd > 0));
  for (const r of rows) {
    const value = r.valueUsd != null ? `$${r.valueUsd.toFixed(0)}` : "no price";
    console.log(`${bad.includes(r) ? chalk.red("FAIL") : chalk.green("OK")}: ${r.symbol} | ${value}`);
  }
  if (bad.length) process.exit(1);
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
