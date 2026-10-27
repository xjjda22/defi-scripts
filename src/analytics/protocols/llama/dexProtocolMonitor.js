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
 * Optional: DEFILLAMA_MONTHS=N (1-24) adds UTC calendar-month totals for the last N months from the
 * daily charts: fees + revenue when DEFILLAMA_FEES=1, volume when DEFILLAMA_VOLUME is set. For
 * "revenue in September" / "Q3 volume" / "12-month revenue" claims. The current month is partial.
 * Optional: DEFILLAMA_TVL_DATES=YYYY-MM-DD,YYYY-MM-DD[,...] prints TVL on each UTC date (last daily point on
 * or before it) and the change from the first to the last date, for "TVL grew X% in Q3" claims.
 * Optional: DEFILLAMA_TVL_DATES_BORROWED=1 (with DEFILLAMA_TVL_DATES) adds borrowed and TVL + borrowed columns
 * from the `borrowed` chainTvls series, for lenders quoted as "deposits" (e.g. Morpho).
 * Optional: DEFILLAMA_CHAIN=<DefiLlama chain name> (percent-encoded in npm scripts, e.g. `Robinhood%20Chain`)
 * prints the protocol's TVL and borrowed on that chain, its 7d/30d change and first point, the chain's total TVL
 * (/v2/chains) with its 7d/30d change, and the protocol's share of it. For "X holds 55% of chain TVL" or
 * "TVL on chain up 32% in 30 days" claims.
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
  fetchFeesChart,
  fetchVolumeChart,
  monthlyTotals,
  lastTvlUsdFromSeries,
  llamaDeadLabel,
  fetchLlamaChains,
  fetchHistoricalChainTvl,
  decodeLlamaToken,
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

/**
 * @param {string|undefined} raw - comma-separated YYYY-MM-DD dates
 * @returns {string[]} valid dates in ascending order (max 12)
 */
function tvlDatesFromEnv(raw) {
  return [...new Set(String(raw || "").split(","))]
    .map(x => x.trim())
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`)))
    .sort()
    .slice(0, 12);
}

/**
 * Last TVL point on or before the end of a UTC day.
 * @param {Array<{date:number,totalLiquidityUSD:number}>|undefined} series
 * @param {string} day - YYYY-MM-DD
 * @returns {{ date: number, usd: number }|null}
 */
function tvlOnOrBefore(series, day) {
  const end = Date.parse(`${day}T23:59:59Z`) / 1000;
  let best = null;
  for (const p of Array.isArray(series) ? series : []) {
    const t = Number(p && p.date);
    const v = Number(p && p.totalLiquidityUSD);
    if (!Number.isFinite(t) || !Number.isFinite(v) || t > end) continue;
    if (!best || t >= best.date) best = { date: t, usd: v };
  }
  return best;
}

function printTvlOnDates(series, dates, borrowedSeries) {
  const withBorrowed = Array.isArray(borrowedSeries) && borrowedSeries.length > 0;
  const rows = dates.map(day => [day, tvlOnOrBefore(series, day), withBorrowed ? tvlOnOrBefore(borrowedSeries, day) : null]);
  const head = ["Date (UTC)", "TVL", ...(withBorrowed ? ["Borrowed", "TVL + borrowed"] : []), "Point used"];
  const t = createTable(head, { colAligns: ["left", ...head.slice(1).map(() => "right")] });
  for (const [day, p, b] of rows) {
    const extra = withBorrowed ? [b ? formatCurrency(b.usd) : "n/a", p && b ? formatCurrency(p.usd + b.usd) : "n/a"] : [];
    t.push([day, p ? formatCurrency(p.usd) : "n/a", ...extra, p ? new Date(p.date * 1000).toISOString().slice(0, 10) : "—"]);
  }
  const pct = (a, b) => (a > 0 ? `${(((b - a) / a) * 100).toFixed(1)}%` : "n/a");
  const [, first, firstB] = rows[0] || [];
  const [, last, lastB] = rows.length > 1 ? rows[rows.length - 1] : [];
  if (first && last && first.usd > 0) {
    const extra = withBorrowed
      ? [
          firstB && lastB ? pct(firstB.usd, lastB.usd) : "n/a",
          firstB && lastB ? pct(first.usd + firstB.usd, last.usd + lastB.usd) : "n/a",
        ]
      : [];
    t.push([`Change ${rows[0][0]} → ${rows[rows.length - 1][0]}`, pct(first.usd, last.usd), ...extra, ""]);
  }
  console.log(chalk.yellow("\nTVL on dates (DefiLlama daily TVL series)\n"));
  console.log(t.toString());
}

/**
 * Change from the last point on or before (latest - days) to the latest point.
 * @param {Array<{date:number,usd:number}>} pts - ascending
 * @param {number} days
 * @returns {{ abs: number, pct: number|null, from: number }|null}
 */
function changeOverDays(pts, days) {
  if (!Array.isArray(pts) || !pts.length) return null;
  const last = pts[pts.length - 1];
  const target = last.date - days * 86400;
  let prior = null;
  for (const p of pts) if (p.date <= target) prior = p;
  if (!prior) return null;
  const abs = last.usd - prior.usd;
  return { abs, pct: prior.usd ? (abs / prior.usd) * 100 : null, from: prior.date };
}

function seriesPoints(series, key = "totalLiquidityUSD") {
  return (Array.isArray(series) ? series : [])
    .map(p => ({ date: Number(p && p.date), usd: Number(p && p[key]) }))
    .filter(p => Number.isFinite(p.date) && Number.isFinite(p.usd))
    .sort((a, b) => a.date - b.date);
}

function fmtChange(c) {
  if (!c) return "—";
  const day = new Date(c.from * 1000).toISOString().slice(0, 10);
  const money = `${c.abs >= 0 ? "+" : ""}${formatCurrency(c.abs)}`;
  return `${money} (${c.pct == null ? "from $0" : `${c.pct >= 0 ? "+" : ""}${c.pct.toFixed(2)}%`}, vs ${day})`;
}

async function printChainShare(d, label, chain) {
  const cct = d.currentChainTvls || {};
  const pts = seriesPoints(d.chainTvls && d.chainTvls[chain] && d.chainTvls[chain].tvl);
  const onChain = numOrNull(cct[chain]);
  const borrowed = numOrNull(cct[`${chain}-borrowed`]);
  let chainRow = null;
  let chainPts = [];
  try {
    const chains = await fetchLlamaChains();
    chainRow = chains.find(c => c.name === chain) || null;
  } catch (e) {
    console.log(chalk.gray(`  /v2/chains unavailable: ${e.message || e}`));
  }
  try {
    chainPts = seriesPoints(await fetchHistoricalChainTvl(chain), "tvl");
  } catch (e) {
    console.log(chalk.gray(`  historical chain TVL unavailable: ${e.message || e}`));
  }
  const chainTvl = chainRow && numOrNull(chainRow.tvl);
  const day = s => new Date(s * 1000).toISOString().slice(0, 10);
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push([`${label} TVL on ${chain}`, onChain != null ? formatCurrency(onChain) : "n/a"]);
  t.push([`${label} borrowed on ${chain}`, borrowed != null ? formatCurrency(borrowed) : "—"]);
  t.push([`${label} TVL change 7d`, fmtChange(changeOverDays(pts, 7))]);
  t.push([`${label} TVL change 30d`, fmtChange(changeOverDays(pts, 30))]);
  t.push([`${label} first point on ${chain}`, pts.length ? `${formatCurrency(pts[0].usd)} (${day(pts[0].date)})` : "n/a"]);
  t.push([`${chain} chain TVL (/v2/chains)`, chainTvl != null ? formatCurrency(chainTvl) : "n/a"]);
  t.push([`${chain} chain TVL change 7d`, fmtChange(changeOverDays(chainPts, 7))]);
  t.push([`${chain} chain TVL change 30d`, fmtChange(changeOverDays(chainPts, 30))]);
  t.push([
    `${label} share of ${chain} TVL`,
    onChain != null && chainTvl ? `${((onChain / chainTvl) * 100).toFixed(1)}%` : "n/a",
  ]);
  console.log(chalk.yellow(`\n${label} on ${chain} (DefiLlama chainTvls + /v2/chains)\n`));
  console.log(t.toString());
}

function monthsFromEnv(env = process.env) {
  const raw = (env.DEFILLAMA_MONTHS || "").trim();
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : 0;
}

async function printMonthly(slug, months, { fees, volumeKind }) {
  const loaders = [];
  if (fees) {
    loaders.push(["Fees", () => fetchFeesChart(slug)]);
    loaders.push(["Revenue", () => fetchFeesChart(slug, "dailyRevenue")]);
  }
  if (volumeKind) loaders.push(["Volume", () => fetchVolumeChart(slug, volumeKind)]);
  if (!loaders.length) return;
  const series = await Promise.all(
    loaders.map(async ([name, load]) => {
      try {
        const d = await load();
        return [name, monthlyTotals(d && d.totalDataChart, months)];
      } catch (e) {
        console.log(chalk.gray(`  ${name.toLowerCase()} history unavailable: ${e.message || e}`));
        return [name, []];
      }
    })
  );
  const monthKeys = [...new Set(series.flatMap(([, rows]) => rows.map(r => r.month)))].sort();
  if (!monthKeys.length) return;
  const t = createTable(["Month (UTC)", ...series.map(([n]) => n)], {
    colAligns: ["left", ...series.map(() => "right")],
  });
  const totals = series.map(() => 0);
  for (const m of monthKeys) {
    const cells = series.map(([, rows], i) => {
      const r = rows.find(x => x.month === m);
      if (!r) return "—";
      totals[i] += r.total;
      return formatCurrency(r.total);
    });
    const partial = series.some(([, rows]) => rows.find(x => x.month === m && x.partial));
    t.push([partial ? `${m} (to date)` : m, ...cells]);
  }
  t.push([`Total (${monthKeys.length} months)`, ...totals.map(v => formatCurrency(v))]);
  console.log(chalk.yellow(`\nMonthly totals (DefiLlama daily charts, last ${months} months)\n`));
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
    const tvlDates = tvlDatesFromEnv(process.env.DEFILLAMA_TVL_DATES);
    if (tvlDates.length) {
      const borrowedSeries =
        process.env.DEFILLAMA_TVL_DATES_BORROWED === "1" ? d.chainTvls && d.chainTvls.borrowed && d.chainTvls.borrowed.tvl : null;
      printTvlOnDates(d.tvl, tvlDates, borrowedSeries);
    }
    const shareChain = decodeLlamaToken(process.env.DEFILLAMA_CHAIN);
    if (shareChain) await printChainShare(d, d.name || label, shareChain);
    const volumeKind = (process.env.DEFILLAMA_VOLUME || "").trim();
    if (volumeKind === "dexs" || volumeKind === "aggregators") {
      await printVolume(slug, volumeKind);
    }
    if (process.env.DEFILLAMA_FEES === "1") {
      await printFeesAndRevenue(slug);
    }
    const months = monthsFromEnv();
    if (months) {
      await printMonthly(slug, months, {
        fees: process.env.DEFILLAMA_FEES === "1",
        volumeKind: volumeKind === "dexs" || volumeKind === "aggregators" ? volumeKind : "",
      });
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

module.exports = { yearToDateHigh, monthsFromEnv, tvlDatesFromEnv, tvlOnOrBefore, changeOverDays, seriesPoints };
