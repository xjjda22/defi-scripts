require("dotenv").config();
const chalk = require("chalk");
const { buildEthAaveMix } = require("../../analytics/aggregators/ethAaveMix");

async function main() {
  const board = await buildEthAaveMix();
  const v3 = (board.books || []).find((b) => /v3/i.test(b.label));
  const v4 = (board.books || []).find((b) => /v4/i.test(b.label));
  if (!v3 || v3.tvl == null || v3.tvl < 1e9) {
    console.error("expected Aave V3 Ethereum TVL ≥ $1B");
    process.exit(1);
  }
  if (!v4 || v4.tvl == null || v4.tvl < 1e7) {
    console.error("expected Aave V4 Ethereum TVL ≥ $10M");
    process.exit(1);
  }
  if (!v3.tokens || v3.tokens.length < 3) {
    console.error("expected Aave V3 collateral tokens");
    process.exit(1);
  }
  console.log(chalk.green(`  v3 ${v3.tvl}  v4 ${v4.tvl}  v3 tokens ${v3.tokens.length}`));
  console.log(chalk.green("\nOK (eth aave mix)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
