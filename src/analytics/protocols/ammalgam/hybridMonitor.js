/**
 * Ammalgam — DefiLlama protocol summary when listed. Set AMMALGAM_LLAMA_SLUG (required).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const SLUG = (process.env.AMMALGAM_LLAMA_SLUG || "").trim();

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nAmmalgam monitor (DefiLlama)\n"));
  if (!SLUG) {
    console.log(
      chalk.yellow(
        "Set AMMALGAM_LLAMA_SLUG to a DefiLlama protocol slug when the project is listed (api.llama.fi/protocols)."
      )
    );
    process.exit(0);
  }
  console.log(chalk.gray(`Slug: ${SLUG}\n`));
  try {
    const d = await fetchDefiLlamaProtocol(SLUG);
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
