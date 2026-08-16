const chalk = require("chalk");
const { loadWatchlist } = require("../../analytics/airdrop/airdropWatch");

function main() {
  const watch = loadWatchlist();
  if (!watch.campaigns || watch.campaigns.length < 4) {
    console.error("airdrop watchlist too small");
    process.exit(1);
  }
  const statuses = new Set(watch.campaigns.map(c => c.status));
  if (![...statuses].some(s => s === "watch" || s === "farming" || s === "ended")) {
    console.error("expected status labels");
    process.exit(1);
  }
  console.log(chalk.green(`  campaigns: ${watch.campaigns.length}`));
  watch.campaigns.slice(0, 3).forEach(c => {
    console.log(chalk.gray(`    ${c.protocol} (${c.chain}) ${c.status}`));
  });
  console.log(chalk.green("\nOK (airdrop watchlist offline)\n"));
}

main();
