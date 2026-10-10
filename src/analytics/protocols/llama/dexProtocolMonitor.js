/**
 * Generic DefiLlama protocol summary (TVL + per-chain breakdown).
 * Set DEFILLAMA_SLUG (required). Optional: DEFILLAMA_LABEL for the banner title.
 * Optional: DEFILLAMA_FEES=1 adds fees + revenue (24h / 7d / 30d) from /summary/fees/{slug},
 * for protocols whose claim is about fees/revenue rather than TVL (e.g. pump.fun, $0 TVL).
 * Optional: DEFILLAMA_OI=1 adds open interest (`total24h`) from /summary/open-interest/{slug}.
 * Optional: DEFILLAMA_OI_HIGH=1 (with DEFILLAMA_OI=1) also prints the year-to-date open-interest high
 * and its date from the same endpoint's daily chart, for "OI at a yearly high" claims.
 * Optional: DEFILLAMA_VOLUME=dexs|aggregators adds 24h / 7d / 30d volume from /summary/{kind}/{slug},
 * for venues that hold no TVL (aggregators, prop AMMs).
 * Off unless set, so existing scripts are unchanged. Do not use /summary/derivatives (paywalled).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const {
  fetchDefiLlamaProtocol,
  fetchFeesSummary,
  fetchOpenInterestSummary,
  fetchOpenInterestChart,
  fetchVolumeSummary,
  lastTvlUsdFromSeries,
  llamaDeadLabel,
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

async function printOpenInterest(slug) {
  let oi;
  try {
    oi = await fetchOpenInterestSummary(slug);
  } catch (e) {
    oi = { error: e };
  }
  const n = oi && !oi.error ? numOrNull(oi.total24h) : null;
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Open interest (total24h)", n != null ? formatCurrency(n) : "n/a"]);
  console.log(chalk.yellow("\nOpen interest (DefiLlama /summary/open-interest)\n"));
  console.log(t.toString());
  if (oi?.error) {
    console.log(chalk.gray(`  open interest unavailable: ${oi.error.message || oi.error}`));
  }
}

async function printVolume(slug, kind) {
  let v;
  try {
    v = await fetchVolumeSummary(slug, kind);
  } catch (e) {
    console.log(chalk.gray(`\n  volume unavailable on /summary/${kind}/${slug}: ${e.message || e}`));
    return;
  }
  const cell = k => {
    const n = numOrNull(v?.[k]);
    return n != null ? formatCurrency(n) : "—";
  };
  const t = createTable(["Window", "Volume"], { colAligns: ["left", "right"] });
  t.push(["24h", cell("total24h")]);
  t.push(["7d", cell("total7d")]);
  t.push(["30d", cell("total30d")]);
  console.log(chalk.yellow(`\nVolume (DefiLlama /summary/${kind})\n`));
  console.log(t.toString());
}

/**
 * @param {Array<[number, number]>|undefined} chart - [unixSeconds, usd][]
 * @param {number} [nowMs]
 * @returns {{ high: [number, number]|null, latest: [number, number]|null }}
 */
function yearToDateHigh(chart, nowMs = Date.now()) {
  const pts = Array.isArray(chart)
    ? chart.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    : [];
  const yearStart = Date.UTC(new Date(nowMs).getUTCFullYear(), 0, 1) / 1000;
  const ytd = pts.filter(p => p[0] >= yearStart);
  const high = ytd.reduce((a, b) => (a == null || b[1] > a[1] ? b : a), null);
  return { high, latest: pts.length ? pts[pts.length - 1] : null };
}

async function printOpenInterestHigh(slug) {
  let d;
  try {
    d = await fetchOpenInterestChart(slug);
  } catch (e) {
    console.log(chalk.gray(`  open interest history unavailable: ${e.message || e}`));
    return;
  }
  const { high, latest } = yearToDateHigh(d && d.totalDataChart);
  const day = p => new Date(p[0] * 1000).toISOString().slice(0, 10);
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Year-to-date high", high ? `${formatCurrency(high[1])} (${day(high)})` : "n/a"]);
  t.push(["Latest daily point", latest ? `${formatCurrency(latest[1])} (${day(latest)})` : "n/a"]);
  if (high && latest && high[1] > 0) {
    t.push(["Latest vs YTD high", `${(((latest[1] - high[1]) / high[1]) * 100).toFixed(1)}%`]);
  }
  console.log(chalk.yellow("\nOpen interest year-to-date high (daily chart)\n"));
  console.log(t.toString());
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
    const dead = llamaDeadLabel(d);
    if (dead) console.log(chalk.red(`\nDefiLlama marks this listing ${dead}.`));
    if (d.currentChainTvls && typeof d.currentChainTvls === "object") {
      const rows = Object.entries(d.currentChainTvls).filter(([, v]) => typeof v === "number" && v > 0);
      if (rows.length) {
        const ct = createTable(["Chain", "TVL"], { colAligns: ["left", "right"] });
        for (const [c, v] of rows) ct.push([c, formatCurrency(v)]);
        console.log(chalk.yellow("\nTVL by chain\n"));
        console.log(ct.toString());
      }
    }
    const volumeKind = (process.env.DEFILLAMA_VOLUME || "").trim();
    if (volumeKind === "dexs" || volumeKind === "aggregators") {
      await printVolume(slug, volumeKind);
    }
    if (process.env.DEFILLAMA_FEES === "1") {
      await printFeesAndRevenue(slug);
    }
    if (process.env.DEFILLAMA_OI === "1") {
      await printOpenInterest(slug);
      if (process.env.DEFILLAMA_OI_HIGH === "1") {
        await printOpenInterestHigh(slug);
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

module.exports = { yearToDateHigh };
