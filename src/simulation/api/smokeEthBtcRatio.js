require("dotenv").config();
const chalk = require("chalk");
const { buildEthBtcRatio } = require("../../analytics/aggregators/ethBtcRatio");

async function main() {
  const board = await buildEthBtcRatio();
  const eth = board.spot && board.spot.eth;
  const btc = board.spot && board.spot.btc;
  if (!(eth > 100 && btc > 1000)) {
    console.error("expected ETH and BTC spot prices");
    process.exit(1);
  }
  if (board.spot.ratio == null || board.spot.ratio <= 0) {
    console.error("expected ETH/BTC ratio");
    process.exit(1);
  }
  console.log(chalk.green(`  ETH $${Math.round(eth)}  BTC $${Math.round(btc)}  ratio ${board.spot.ratio.toFixed(4)}`));
  console.log(chalk.green("\nOK (eth/btc ratio)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
