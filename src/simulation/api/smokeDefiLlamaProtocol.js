require("dotenv").config();
const chalk = require("chalk");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../analytics/utils/defiLlamaProtocol");

const slug = (process.env.SMOKE_SLUG || "").trim();
const minTvl = parseFloat(process.env.SMOKE_MIN_TVL_USD || "0") || 0;

async function main() {
  if (!slug) {
    console.error(chalk.red("Set SMOKE_SLUG (e.g. reya-perps)"));
    process.exit(1);
  }
  try {
    const d = await fetchDefiLlamaProtocol(slug);
    const tvl = lastTvlUsdFromSeries(d.tvl);
    if (d.name == null && tvl == null) {
      console.error(chalk.red("Unexpected payload"));
      process.exit(1);
    }
    console.log(chalk.green(`OK: ${d.name || slug} | TVL ${tvl != null ? `$${tvl.toFixed(0)}` : "—"}`));
    if (minTvl > 0 && (tvl == null || tvl < minTvl)) {
      console.error(chalk.red(`TVL below SMOKE_MIN_TVL_USD (${minTvl})`));
      process.exit(1);
    }
  } catch (e) {
    const status = e.response?.status;
    if (process.env.SMOKE_ALLOW_NOT_LISTED === "1" && (status === 404 || status === 400)) {
      console.log(
        chalk.yellow(`skip: protocol not listed or invalid slug (HTTP ${status}) — ${slug}`),
      );
      process.exit(0);
    }
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
