require("dotenv").config();
const chalk = require("chalk");
const { fetchFeesSummary } = require("../../analytics/utils/defiLlamaProtocol");
const { loadWatchlist } = require("../../analytics/nft/nftMarkets");

async function main() {
  const watch = loadWatchlist();
  if (!watch.collections || watch.collections.length < 5) {
    console.error("nft watchlist too small");
    process.exit(1);
  }
  console.log(chalk.gray(`  watchlist collections: ${watch.collections.length}`));

  const d = await fetchFeesSummary("blur");
  if (!d || !(d.name || d.displayName)) {
    console.error("blur fees summary missing name");
    process.exit(1);
  }
  console.log(chalk.green(`  blur: ${d.displayName || d.name} 30d fees ${d.total30d != null ? d.total30d : "—"}`));
  console.log(chalk.green("\nOK (nft watchlist + blur fees)\n"));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
