/**
 * Category view: headline TVL from DefiLlama for major AMM families (MVP).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const AMM_PROTOCOLS = [
  ["Uniswap V3", "uniswap-v3"],
  ["Curve DEX", "curve-dex"],
  ["Balancer", "balancer"],
  ["SushiSwap", "sushiswap"],
  ["Aerodrome", "aerodrome"],
  ["Velodrome", "velodrome"],
  ["PancakeSwap AMM v3", "pancakeswap-amm-v3"],
  ["Ambient", "ambient"],
  ["Camelot", "camelot"],
  ["Fluid DEX", "fluid-dex"],
  ["Hashflow", "hashflow"],
  ["Maverick", "maverick-protocol"],
  ["QuickSwap V3", "quickswap-v3"],
  ["SyncSwap", "syncswap"],
  ["THENA", "thena"],
  ["Thruster", "thruster"],
  ["1inch", "1inch"],
  ["CoW Protocol", "cowswap"],
  ["KyberSwap", "kyberswap"],
  ["Matcha", "matcha"],
  ["Odos", "odos"],
  ["ParaSwap", "paraswap"],
];

module.exports = { AMM_PROTOCOLS };

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nAll AMM protocols — TVL snapshot (DefiLlama)\n"));
  console.log(
    chalk.gray(
      "Core AMMs plus day-trading catalog spot venues and major aggregators (see docs/03-protocol-catalog-2026.md).\n"
    )
  );

  const table = createTable(["Protocol", "Slug", "TVL (latest)"], {
    colAligns: ["left", "left", "right"],
  });

  for (const [label, slug] of AMM_PROTOCOLS) {
    try {
      const d = await fetchDefiLlamaProtocol(slug);
      const tvl = lastTvlUsdFromSeries(d.tvl);
      table.push([label, slug, tvl != null ? formatCurrency(tvl) : "—"]);
    } catch {
      table.push([label, slug, chalk.red("fetch failed")]);
    }
  }
  console.log(table.toString());
  console.log(chalk.gray("\nDetail: npm run analytics:dex:prices"));
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
