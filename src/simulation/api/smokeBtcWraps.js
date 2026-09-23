require("dotenv").config();
const chalk = require("chalk");
const { CHAIN, buildBtcWraps } = require("../../analytics/aggregators/btcWraps");

async function main() {
  const board = await buildBtcWraps();
  if (!board.largest || board.largest.length < 3) {
    console.error("btc wraps largest list too small");
    process.exit(1);
  }
  const names = board.largest.map((r) => String(r.name || "").toLowerCase()).join(" ");
  const hit = /wbtc|babylon|nexus|lombard|tbtc|citrea/.test(names);
  if (!hit) {
    console.error("expected a known BTC wrap in largest list");
    process.exit(1);
  }
  console.log(chalk.green(`  ${CHAIN} wrap rows ${board.count}  largest ${board.largest[0].name}`));
  console.log(chalk.green("\nOK (bitcoin wraps)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
