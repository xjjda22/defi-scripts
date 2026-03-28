/**
 * Generic DefiLlama protocol summary (TVL + per-chain breakdown).
 * Set DEFILLAMA_SLUG (required). Optional: DEFILLAMA_LABEL for the banner title.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

async function main() {
  installCliSafeStdout();
  const slug = (process.env.DEFILLAMA_SLUG || "").trim();
  if (!slug) {
    console.error(chalk.red("Set DEFILLAMA_SLUG (e.g. aerodrome)"));
    process.exit(1);
  }
  const label = (process.env.DEFILLAMA_LABEL || slug).trim();

  console.log(chalk.cyan.bold(`\n${label} (DefiLlama)\n`));
  console.log(chalk.gray(`Slug: ${slug} (DEFILLAMA_SLUG)\n`));
  try {
    const d = await fetchDefiLlamaProtocol(slug);
    const tvl = lastTvlUsdFromSeries(d.tvl);
    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["Name", d.name || "—"]);
    t.push(["TVL (latest)", tvl != null ? formatCurrency(tvl) : "—"]);
    t.push(["Category", d.category || "—"]);
    t.push(["URL", d.url || "—"]);
    console.log(t.toString());
    if (d.currentChainTvls && typeof d.currentChainTvls === "object") {
      const rows = Object.entries(d.currentChainTvls).filter(([, v]) => typeof v === "number" && v > 0);
      if (rows.length) {
        const ct = createTable(["Chain", "TVL"], { colAligns: ["left", "right"] });
        for (const [c, v] of rows) ct.push([c, formatCurrency(v)]);
        console.log(chalk.yellow("\nTVL by chain\n"));
        console.log(ct.toString());
      }
    }
  } catch (e) {
    console.error(chalk.red((e && e.response?.status === 404 && "Protocol not found on DefiLlama") || e.message));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
