/**
 * DefiLlama chain TVL monitor (no protocol slug).
 * LLAMA_CHAIN_NAME defaults to "Arc" (Circle L1, chainId 5042), so `analytics:arc:chain` is unchanged.
 * Names with spaces are percent-encoded in the npm script (`Robinhood%20Chain`) and decoded here;
 * request paths are encoded again via encodeURIComponent.
 * Also prints 7d/30d TVL change from /v2/historicalChainTvl/<name> when that series is available.
 * Optional, off unless set to "1" so Arc/Blast stay TVL-only:
 *   LLAMA_CHAIN_DEX=1  — /overview/dexs/<name> 24h/7d/30d
 *   LLAMA_CHAIN_FEES=1 — /overview/fees/<name> 24h/7d/30d
 * Optional LLAMA_CHAIN_NOTE (percent-encoded) is printed after the tables.
 * Optional, off unless set (existing chain scripts unchanged):
 *   LLAMA_CHAIN_FEES_SLUG=<slug> — chain-level gas fees + revenue (24h/7d/30d) from /summary/fees/<slug>
 *                                  (e.g. `bsc`, `ethereum`); DefiLlama chain "revenue" is the burned/kept part of gas
 *   LLAMA_CHAIN_MONTHS=N (1-24)  — UTC calendar-month totals for the last N months, plus calendar-quarter totals
 *                                  and QoQ change, for every series enabled above (DEX volume, app fees/revenue,
 *                                  chain fees/revenue). For "Q3 network revenue / DEX volume" claims.
 *   LLAMA_CHAIN_STABLES=1         — stablecoin market cap on the chain (all pegs, USD) with 7d/30d change from
 *                                  stablecoins.llama.fi/stablecoincharts/<name>. For "chain X added $Y of
 *                                  stablecoins in 30 days" claims.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const {
  fetchLlamaChains,
  fetchHistoricalChainTvl,
  fetchDexOverview,
  fetchChainFeesOverview,
  decodeLlamaToken,
  llamaChainNameFromEnv,
  fetchLlamaJson,
  fetchFeesSummary,
  fetchFeesChart,
  monthlyTotals,
} = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency, formatPercent } = require("../../utils/displayHelpers");

function chainBanner(name) {
  if (name === "Arc") return "\nArc Chain (Circle L1, chainId 5042)\n";
  return `\n${name} (DefiLlama /v2/chains)\n`;
}

function changeOverDays(series, days) {
  if (!Array.isArray(series)) return null;
  const points = [];
  for (const p of series) {
    const tvl = p?.tvl;
    const date = p?.date;
    if (typeof tvl !== "number" || !Number.isFinite(tvl)) continue;
    if (typeof date !== "number" || !Number.isFinite(date)) continue;
    points.push({ date, tvl });
  }
  if (!points.length) return null;
  const latest = points[points.length - 1];
  const target = latest.date - days * 86400;
  let prior = null;
  for (const p of points) {
    if (p.date <= target) prior = p;
  }
  if (!prior) return null;
  const abs = latest.tvl - prior.tvl;
  const pct = prior.tvl !== 0 ? (abs / prior.tvl) * 100 : null;
  return { abs, pct };
}

function formatChange(change) {
  if (!change) return "—";
  const money = change.abs > 0 ? `+${formatCurrency(change.abs)}` : formatCurrency(change.abs);
  if (change.pct == null || !Number.isFinite(change.pct)) return `${money} (from $0)`;
  return `${money} (${formatPercent(change.pct)})`;
}

function moneyCell(row, key) {
  const n = row?.[key];
  return typeof n === "number" && Number.isFinite(n) ? formatCurrency(n) : "—";
}

/**
 * stablecoincharts points -> [{ date, tvl }] with tvl = sum of totalCirculatingUSD across pegs.
 * @param {Array<{date:string|number,totalCirculatingUSD:object}>} rows
 */
function stablecoinSeries(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(p => {
      const c = p && p.totalCirculatingUSD;
      const vals = c && typeof c === "object" ? Object.values(c).map(Number).filter(Number.isFinite) : [];
      return { date: Number(p && p.date), tvl: vals.length ? vals.reduce((a, b) => a + b, 0) : NaN };
    })
    .filter(p => Number.isFinite(p.date) && Number.isFinite(p.tvl))
    .sort((a, b) => a.date - b.date);
}

function fetchChainStablecoins(chainName) {
  return fetchLlamaJson(`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chainName)}`);
}

async function printChainStablecoins(chainName) {
  let series = [];
  let error = null;
  try {
    series = stablecoinSeries(await fetchChainStablecoins(chainName));
  } catch (e) {
    error = e;
  }
  const last = series[series.length - 1];
  const day = s => new Date(s * 1000).toISOString().slice(0, 10);
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Stablecoin market cap", last ? `${formatCurrency(last.tvl)} (${day(last.date)})` : "—"]);
  t.push(["Change 7d", formatChange(changeOverDays(series, 7))]);
  t.push(["Change 30d", formatChange(changeOverDays(series, 30))]);
  console.log(chalk.yellow(`\nStablecoins on ${chainName} (DefiLlama /stablecoincharts)\n`));
  console.log(t.toString());
  if (error) console.log(chalk.gray(`  unavailable: ${error.message || error}`));
}

async function printWindows(title, loader) {
  let data = null;
  let error = null;
  try {
    data = await loader();
  } catch (e) {
    error = e;
  }
  const t = createTable(["Window", "Value"], { colAligns: ["left", "right"] });
  t.push(["24h", moneyCell(data, "total24h")]);
  t.push(["7d", moneyCell(data, "total7d")]);
  t.push(["30d", moneyCell(data, "total30d")]);
  console.log(chalk.yellow(`\n${title}\n`));
  console.log(t.toString());
  if (error) console.log(chalk.gray(`  unavailable: ${error.message || error}`));
}

function chainMonthsFromEnv(env = process.env) {
  const raw = String(env.LLAMA_CHAIN_MONTHS || "").trim();
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : 0;
}

/**
 * Group monthly rows into calendar quarters. A quarter is `complete` only when all three months are in
 * `rows` and none is partial.
 * @param {Array<{ month: string, total: number, partial: boolean }>} rows
 * @returns {Array<{ quarter: string, total: number, months: number, complete: boolean }>}
 */
function quarterlyTotals(rows) {
  const byQ = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const [y, m] = String(r.month).split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    const quarter = `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    const q = byQ.get(quarter) || { quarter, total: 0, months: 0, partial: false };
    q.total += Number(r.total) || 0;
    q.months += 1;
    q.partial = q.partial || Boolean(r.partial);
    byQ.set(quarter, q);
  }
  return [...byQ.values()]
    .sort((a, b) => (a.quarter < b.quarter ? -1 : 1))
    .map(q => ({ quarter: q.quarter, total: q.total, months: q.months, complete: q.months === 3 && !q.partial }));
}

async function printChainFeesSlug(slug) {
  const [fees, revenue] = await Promise.all([
    fetchFeesSummary(slug).catch(e => ({ error: e })),
    fetchFeesSummary(slug, undefined, "dailyRevenue").catch(e => ({ error: e })),
  ]);
  const cell = (d, k) => (d && !d.error ? moneyCell(d, k) : "n/a");
  const t = createTable(["Window", "Chain fees", "Chain revenue"], { colAligns: ["left", "right", "right"] });
  t.push(["24h", cell(fees, "total24h"), cell(revenue, "total24h")]);
  t.push(["7d", cell(fees, "total7d"), cell(revenue, "total7d")]);
  t.push(["30d", cell(fees, "total30d"), cell(revenue, "total30d")]);
  console.log(chalk.yellow(`\nChain gas fees / revenue (DefiLlama /summary/fees/${slug})\n`));
  console.log(t.toString());
  if (fees?.error) console.log(chalk.gray(`  unavailable: ${fees.error.message || fees.error}`));
}

async function printChainMonthly(chainName, months, { dex, fees, feesSlug }) {
  const enc = encodeURIComponent(chainName);
  const q = "excludeTotalDataChartBreakdown=true";
  const loaders = [];
  if (dex) loaders.push(["DEX volume", () => fetchLlamaJson(`/overview/dexs/${enc}?${q}`)]);
  if (fees) {
    loaders.push(["App fees", () => fetchLlamaJson(`/overview/fees/${enc}?${q}`)]);
    loaders.push(["App revenue", () => fetchLlamaJson(`/overview/fees/${enc}?${q}&dataType=dailyRevenue`)]);
  }
  if (feesSlug) {
    loaders.push(["Chain fees", () => fetchFeesChart(feesSlug)]);
    loaders.push(["Chain revenue", () => fetchFeesChart(feesSlug, "dailyRevenue")]);
  }
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
  const aligns = { colAligns: ["left", ...series.map(() => "right")] };
  const mt = createTable(["Month (UTC)", ...series.map(([n]) => n)], aligns);
  for (const m of monthKeys) {
    const partial = series.some(([, rows]) => rows.find(x => x.month === m && x.partial));
    mt.push([
      partial ? `${m} (to date)` : m,
      ...series.map(([, rows]) => {
        const r = rows.find(x => x.month === m);
        return r ? formatCurrency(r.total) : "—";
      }),
    ]);
  }
  console.log(chalk.yellow(`\nMonthly totals (DefiLlama daily charts, last ${months} months)\n`));
  console.log(mt.toString());

  const qSeries = series.map(([name, rows]) => [name, quarterlyTotals(rows)]);
  const qKeys = [...new Set(qSeries.flatMap(([, rows]) => rows.map(r => r.quarter)))].sort();
  if (!qKeys.length) return;
  const qt = createTable(["Quarter (UTC)", ...series.map(([n]) => n)], aligns);
  const prev = series.map(() => null);
  for (const k of qKeys) {
    const complete = qSeries.every(([, rows]) => rows.find(x => x.quarter === k && x.complete));
    qt.push([
      complete ? k : `${k} (partial)`,
      ...qSeries.map(([, rows], i) => {
        const r = rows.find(x => x.quarter === k);
        if (!r) return "—";
        const p = prev[i];
        prev[i] = r.complete ? r.total : null;
        const qoq = r.complete && p != null && p > 0 ? ` (${formatPercent(((r.total - p) / p) * 100)} QoQ)` : "";
        return `${formatCurrency(r.total)}${qoq}`;
      }),
    ]);
  }
  console.log(chalk.yellow("\nQuarterly totals (sum of the monthly rows; QoQ only between complete quarters)\n"));
  console.log(qt.toString());
}

async function main() {
  installCliSafeStdout();
  const chainName = llamaChainNameFromEnv();
  console.log(chalk.cyan.bold(chainBanner(chainName)));

  try {
    const chains = await fetchLlamaChains();
    const row = chains.find(c => c.name === chainName);

    if (!row) {
      console.error(chalk.red(`${chainName} chain not found in DefiLlama chains`));
      process.exit(1);
    }

    let histError = null;
    let series = null;
    try {
      series = await fetchHistoricalChainTvl(chainName);
    } catch (e) {
      histError = e;
    }

    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["Name", row.name || "—"]);
    t.push(["Chain ID", row.chainId || "—"]);
    t.push(["TVL", typeof row.tvl === "number" ? formatCurrency(row.tvl) : "—"]);
    t.push(["TVL change 7d", formatChange(changeOverDays(series, 7))]);
    t.push(["TVL change 30d", formatChange(changeOverDays(series, 30))]);
    t.push(["Gecko ID", row.gecko_id || "—"]);
    t.push(["Token Symbol", row.tokenSymbol || "—"]);

    console.log(t.toString());
    if (histError) {
      console.log(chalk.gray(`  historical TVL unavailable: ${histError.message || histError}`));
    }

    if (process.env.LLAMA_CHAIN_DEX === "1") {
      await printWindows(`DEX volume (DefiLlama /overview/dexs/${chainName})`, () => fetchDexOverview(chainName));
    }
    if (process.env.LLAMA_CHAIN_FEES === "1") {
      await printWindows(`Fees (DefiLlama /overview/fees/${chainName})`, () => fetchChainFeesOverview(chainName));
    }
    if (process.env.LLAMA_CHAIN_STABLES === "1") await printChainStablecoins(chainName);
    const feesSlug = String(process.env.LLAMA_CHAIN_FEES_SLUG || "").trim();
    if (feesSlug) await printChainFeesSlug(feesSlug);
    const months = chainMonthsFromEnv();
    if (months) {
      await printChainMonthly(chainName, months, {
        dex: process.env.LLAMA_CHAIN_DEX === "1",
        fees: process.env.LLAMA_CHAIN_FEES === "1",
        feesSlug,
      });
    }
    const note = decodeLlamaToken(process.env.LLAMA_CHAIN_NOTE);
    if (note) console.log(chalk.gray(`\nNote: ${note}\n`));
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { quarterlyTotals, chainMonthsFromEnv, stablecoinSeries, fetchChainStablecoins, changeOverDays };
