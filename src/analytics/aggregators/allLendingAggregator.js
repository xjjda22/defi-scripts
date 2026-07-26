/**
 * Category view: headline TVL from DefiLlama for major lending families (MVP).
 * On-chain rates: npm run analytics:lending:rates
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const LENDING_PROTOCOLS = [
  ["Aave V3", "aave-v3"],
  ["Morpho", "morpho-v1"],
  ["Compound V3", "compound-v3"],
  ["Spark", "spark"],
  ["Venus", "venus"],
  ["Euler v2", "euler-v2"],
  ["Curvance", "curvance"],
  ["Resolv", "resolv"],
];

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nAll lending protocols — TVL snapshot (DefiLlama)\n"));

  const table = createTable(["Protocol", "Slug", "TVL (latest)"], {
    colAligns: ["left", "left", "right"],
  });

  for (const [label, slug] of LENDING_PROTOCOLS) {
    try {
      const d = await fetchDefiLlamaProtocol(slug);
      const tvl = lastTvlUsdFromSeries(d.tvl);
      table.push([label, slug, tvl != null ? formatCurrency(tvl) : "—"]);
    } catch {
      table.push([label, slug, chalk.red("fetch failed")]);
    }
  }
  console.log(table.toString());
  console.log(chalk.gray("\nRates: npm run analytics:lending:rates"));
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
