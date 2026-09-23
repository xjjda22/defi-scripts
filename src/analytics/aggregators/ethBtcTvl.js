/**
 * Ethereum vs Bitcoin chain TVL across last month / this month / this week.
 *
 *   npm run analytics:ethbtc:tvl
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaChains, fetchHistoricalChainTvl } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAINS = ["Ethereum", "Bitcoin"];

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function utcDay(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function windowDates(now) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const thisMonthStart = utcDay(y, m, 1);
  const lastMonthStart = utcDay(y, m - 1, 1);
  const lastMonthEnd = utcDay(y, m, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    lastMonthStart: ymd(lastMonthStart),
    lastMonthEnd: ymd(lastMonthEnd),
    thisMonthStart: ymd(thisMonthStart),
    thisWeekStart: ymd(weekStart),
    today: ymd(now),
  };
}

function nearest(byDate, date) {
  if (byDate[date] != null) return { date, tvl: byDate[date] };
  const keys = Object.keys(byDate).sort();
  const le = keys.filter((k) => k <= date).pop();
  return le ? { date: le, tvl: byDate[le] } : null;
}

function pct(from, to) {
  if (!from || !to || !from.tvl) return null;
  return ((to.tvl - from.tvl) / from.tvl) * 100;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

async function histFor(name) {
  const series = await fetchHistoricalChainTvl(name);
  const pts = (Array.isArray(series) ? series : []).map((p) => ({
    date: new Date((p.date || 0) * 1000).toISOString().slice(0, 10),
    tvl: p.tvl,
  }));
  const byDate = {};
  for (const p of pts) {
    if (typeof p.tvl === "number" && Number.isFinite(p.tvl)) byDate[p.date] = p.tvl;
  }
  return byDate;
}

async function buildEthBtcTvl(now) {
  const when = now || new Date();
  const dates = windowDates(when);
  const chainsLive = await fetchLlamaChains();
  const rows = [];
  for (const name of CHAINS) {
    const live = (chainsLive || []).find((c) => String(c.name) === name);
    const byDate = await histFor(name);
    const a = nearest(byDate, dates.lastMonthStart);
    const b = nearest(byDate, dates.lastMonthEnd);
    const c = nearest(byDate, dates.thisMonthStart);
    const d = nearest(byDate, dates.thisWeekStart);
    const e = nearest(byDate, dates.today);
    rows.push({
      name,
      liveTvl: live && typeof live.tvl === "number" ? live.tvl : e && e.tvl,
      lastMonthStart: a,
      lastMonthEnd: b,
      thisMonthStart: c,
      thisWeekStart: d,
      latest: e,
      lastMonthPct: pct(a, b),
      thisMonthPct: pct(c, e),
      thisWeekPct: pct(d, e),
    });
  }
  return { generatedAt: when.toISOString(), dates, rows };
}

function point(p) {
  if (!p || p.tvl == null) return "—";
  return `${formatCurrency(p.tvl)} (${p.date})`;
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nEthereum / Bitcoin chain TVL windows (DefiLlama)\n"));
  const board = await buildEthBtcTvl();
  const d = board.dates;
  console.log(
    chalk.gray(
      `Last month ${d.lastMonthStart} → ${d.lastMonthEnd}` +
        `  |  this month ${d.thisMonthStart} → ${d.today}` +
        `  |  this week ${d.thisWeekStart} → ${d.today}\n`
    )
  );
  const table = createTable(["Chain", "Now", "Last month", "This month", "This week"], {
    colAligns: ["left", "right", "right", "right", "right"],
  });
  for (const r of board.rows) {
    table.push([
      r.name,
      r.liveTvl != null ? formatCurrency(r.liveTvl) : "—",
      formatPct(r.lastMonthPct),
      formatPct(r.thisMonthPct),
      formatPct(r.thisWeekPct),
    ]);
  }
  console.log(table.toString());
  for (const r of board.rows) {
    console.log(
      chalk.gray(
        `\n${r.name}  start ${point(r.lastMonthStart)}  month-end ${point(r.lastMonthEnd)}` +
          `  week ${point(r.thisWeekStart)}  latest ${point(r.latest)}`
      )
    );
  }
  console.log("");
}

module.exports = { CHAINS, windowDates, nearest, pct, buildEthBtcTvl };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
