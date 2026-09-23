require("dotenv").config();
const chalk = require("chalk");
const { buildPendleMarkets } = require("../../analytics/aggregators/pendleMarkets");

async function main() {
  const board = await buildPendleMarkets();
  const hasChain = board.chains && board.chains.some((c) => c.chain === "Ethereum" && c.tvl > 1e8);
  const hasMkts = board.markets && board.markets.length >= 3;
  if (!hasChain && !hasMkts) {
    console.error("expected Pendle Ethereum TVL or active markets");
    process.exit(1);
  }
  console.log(
    chalk.green(
      `  chains ${board.chains.length}  markets ${board.marketCount}  eth ${board.ethTvl}`
    )
  );
  console.log(chalk.green("\nOK (pendle markets)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
