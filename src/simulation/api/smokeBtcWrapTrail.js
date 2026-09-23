require("dotenv").config();
const chalk = require("chalk");
const { buildBtcWrapTrail } = require("../../analytics/aggregators/btcWrapTrail");

async function main() {
  const board = await buildBtcWrapTrail();
  if (!board.trail || board.trail.length < 5) {
    console.error("circle bitcoin trail too short");
    process.exit(1);
  }
  if (!board.now || board.now.tvl == null || board.now.tvl < 1e6) {
    console.error("expected Circle Bitcoin TVL ≥ $1M");
    process.exit(1);
  }
  const names = (board.peers || []).map((r) => String(r.name || "").toLowerCase()).join(" ");
  if (!/circle|wbtc|babylon|kraken|nexus/.test(names)) {
    console.error("expected Circle or wrap peers");
    process.exit(1);
  }
  console.log(chalk.green(`  circle ${board.now.date} ${board.now.tvl}  peers ${board.peers.length}`));
  console.log(chalk.green("\nOK (btc wrap trail)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
