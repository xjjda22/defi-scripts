/**
 * Curvy / curves-style — DefiLlama protocol summary (MVP).
 * Roadmap “Curvy v2” may not match a slug; default CURVY_LLAMA_SLUG=curves-protocol (placeholder).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const DEFAULT_SLUG = process.env.CURVY_LLAMA_SLUG || "curves-protocol";

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nCurvy / curves monitor (DefiLlama)\n"));
  console.log(chalk.gray(`Slug: ${DEFAULT_SLUG} — set CURVY_LLAMA_SLUG if a dedicated Curvy listing exists.\n`));
  try {
    const d = await fetchDefiLlamaProtocol(DEFAULT_SLUG);
    const tvl = lastTvlUsdFromSeries(d.tvl);
    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["Name", d.name || "—"]);
    t.push(["TVL (latest)", tvl != null ? formatCurrency(tvl) : "—"]);
    t.push(["Category", d.category || "—"]);
    console.log(t.toString());
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
