/**
 * Generic DefiLlama protocol summary (TVL + per-chain breakdown).
 * Set DEFILLAMA_SLUG (required). Optional: DEFILLAMA_LABEL for the banner title.
 * Optional: DEFILLAMA_FEES=1 adds fees + revenue (24h / 7d / 30d) from /summary/fees/{slug},
 * for protocols whose claim is about fees/revenue rather than TVL (e.g. pump.fun, $0 TVL).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const {
  fetchDefiLlamaProtocol,
  fetchFeesSummary,
  lastTvlUsdFromSeries,
} = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function printFeesAndRevenue(slug) {
  const [fees, revenue] = await Promise.all([
    fetchFeesSummary(slug).catch(e => ({ error: e })),
    fetchFeesSummary(slug, undefined, "dailyRevenue").catch(e => ({ error: e })),
  ]);
  const cell = (d, k) => {
    if (!d || d.error) return "n/a";
    const n = numOrNull(d[k]);
    return n != null ? formatCurrency(n) : "—";
  };
  const ft = createTable(["Window", "Fees", "Revenue"], { colAligns: ["left", "right", "right"] });
  ft.push(["24h", cell(fees, "total24h"), cell(revenue, "total24h")]);
  ft.push(["7d", cell(fees, "total7d"), cell(revenue, "total7d")]);
  ft.push(["30d", cell(fees, "total30d"), cell(revenue, "total30d")]);
  console.log(chalk.yellow("\nFees / revenue (DefiLlama /summary/fees)\n"));
  console.log(ft.toString());
  if (fees?.error && revenue?.error) {
    console.log(chalk.gray(`  fees unavailable: ${fees.error.message || fees.error}`));
  }
}

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
    if (process.env.DEFILLAMA_FEES === "1") {
      await printFeesAndRevenue(slug);
    }
  } catch (e) {
    console.error(chalk.red((e && e.response?.status === 404 && "Protocol not found on DefiLlama") || e.message));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
