require("dotenv").config();
const chalk = require("chalk");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../analytics/utils/defiLlamaProtocol");
const { AMM_PROTOCOLS } = require("../../analytics/aggregators/allAmmDexAggregator");

const SLUGS = AMM_PROTOCOLS.map(([, slug]) => slug);

async function main() {
  let ok = 0;
  for (const slug of SLUGS) {
    try {
      const d = await fetchDefiLlamaProtocol(slug);
      const tvl = lastTvlUsdFromSeries(d.tvl);
      if (d.name) {
        console.log(chalk.green(`  ${slug}: ${d.name} TVL ${tvl != null ? `$${Math.round(tvl)}` : "—"}`));
        ok++;
      }
    } catch {
      console.log(chalk.red(`  ${slug}: failed`));
    }
  }
  if (ok === 0) process.exit(1);
  console.log(chalk.green(`\nOK (${ok}/${SLUGS.length} slugs)\n`));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
