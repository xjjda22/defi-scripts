require("dotenv").config();
const chalk = require("chalk");
const { fetchHistoricalChainTvl } = require("../../analytics/utils/defiLlamaProtocol");
const { CHAINS, windowDates, nearest, buildEthBtcTvl } = require("../../analytics/aggregators/ethBtcTvl");

async function main() {
  const series = await fetchHistoricalChainTvl("Ethereum");
  if (!Array.isArray(series) || series.length < 30) {
    console.error("expected historicalChainTvl Ethereum series");
    process.exit(1);
  }
  const byDate = {};
  for (const p of series) {
    if (typeof p.tvl === "number") {
      byDate[new Date((p.date || 0) * 1000).toISOString().slice(0, 10)] = p.tvl;
    }
  }
  const dates = windowDates(new Date());
  const latest = nearest(byDate, dates.today);
  if (!latest) {
    console.error("no Ethereum TVL point on or before today");
    process.exit(1);
  }
  const board = await buildEthBtcTvl();
  if (!board.rows || board.rows.length !== CHAINS.length) {
    console.error("eth/btc tvl row count mismatch");
    process.exit(1);
  }
  const named = board.rows.filter((r) => r.liveTvl != null || (r.latest && r.latest.tvl != null));
  if (named.length < 2) {
    console.error("missing Ethereum or Bitcoin TVL");
    process.exit(1);
  }
  console.log(chalk.green(`  Ethereum latest ${latest.date}  $${Math.round(latest.tvl)}`));
  console.log(chalk.green("\nOK (eth/btc chain tvl)\n"));
}

main().catch((e) => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
