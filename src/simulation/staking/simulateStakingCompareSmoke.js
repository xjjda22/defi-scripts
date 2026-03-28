require("dotenv").config();
const chalk = require("chalk");
const { fetchLidoStakingSnapshot } = require("../../analytics/protocols/lido/stakingMonitor");
const { fetchStakeStoneSnapshot } = require("../../analytics/protocols/stakestone/stakingMonitor");
const { fetchKintsuSnapshot } = require("../../analytics/protocols/kintsu/stakingMonitor");
const { createTable, formatCurrency } = require("../../analytics/utils/displayHelpers");

async function main() {
  const [lido, stone, kintsu] = await Promise.all([
    fetchLidoStakingSnapshot(),
    fetchStakeStoneSnapshot(),
    fetchKintsuSnapshot(),
  ]);

  console.log(chalk.cyan.bold("\nStaking compare — API smoke (read-only)\n"));
  const t = createTable(["Protocol", "APR/APY", "TVL"], { colAligns: ["left", "right", "right"] });
  t.push([
    "Lido",
    lido.aprPct != null ? `${lido.aprPct.toFixed(2)}%` : "—",
    lido.tvlUsdTotal != null ? formatCurrency(lido.tvlUsdTotal) : "—",
  ]);
  t.push([
    "StakeStone",
    stone.aprPct != null ? `${stone.aprPct.toFixed(2)}%` : "—",
    stone.tvlUsd != null ? formatCurrency(stone.tvlUsd) : "—",
  ]);
  t.push([
    "Kintsu",
    kintsu.aprPct != null ? `${kintsu.aprPct.toFixed(2)}%` : "—",
    kintsu.tvlUsd != null ? formatCurrency(kintsu.tvlUsd) : "—",
  ]);
  console.log(t.toString());
  console.log(chalk.green("\nOK\n"));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
