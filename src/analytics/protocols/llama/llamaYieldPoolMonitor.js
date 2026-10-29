/**
 * One DefiLlama yields pool (vault) from the small per-pool chart endpoint
 * (yields.llama.fi/chart/{pool}); the full /pools list is ~12MB and is not fetched.
 * For "vault X passed $Y deposits with a 30-day APY of Z%" claims.
 *
 * Env:
 *   LLAMA_YIELD_POOL          (required) DefiLlama yields pool UUID
 *   LLAMA_YIELD_LABEL         (optional) banner title
 *   LLAMA_YIELD_SMOKE=1       (optional) print one OK line; exit non-zero unless latest TVL > LLAMA_YIELD_MIN_TVL_USD
 *   LLAMA_YIELD_MIN_TVL_USD   (optional, smoke only, default 0)
 *   LLAMA_YIELD_PROJECT       (optional, off unless set) DefiLlama yields project (e.g. strata-markets): also fetch
 *                             the full /pools list (~12MB) and rank that project's pools by current APY, marking this
 *                             pool. For "the highest senior yield on Strata" claims.
 *   LLAMA_YIELD_SYMBOL_PREFIX (optional, with LLAMA_YIELD_PROJECT) only rank pools whose symbol starts with it (e.g. SR)
 *
 * Prints latest TVL and APY (base / reward), the 30-day mean of the daily APY points, the 30-day
 * realized APY from pricePerShare when DefiLlama records it, TVL 7d/30d change and the TVL high.
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { YIELDS_BASE } = require("../../utils/defiLlamaYields");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const DAY = 86400;

function num(v) {
  const n = typeof v === "number" ? v : Number(v);
  return v != null && Number.isFinite(n) ? n : null;
}

/**
 * @param {Array<{timestamp:string,tvlUsd:number,apy:number,apyBase:number,apyReward:number,pricePerShare:number}>} rows
 */
function poolPoints(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(p => ({
      date: Math.floor(Date.parse(p && p.timestamp) / 1000),
      tvl: num(p && p.tvlUsd),
      apy: num(p && p.apy),
      apyBase: num(p && p.apyBase),
      apyReward: num(p && p.apyReward),
      pps: num(p && p.pricePerShare),
    }))
    .filter(p => Number.isFinite(p.date))
    .sort((a, b) => a.date - b.date);
}

/**
 * @param {ReturnType<typeof poolPoints>} pts
 * @param {number} [days]
 */
function poolStats(pts, days = 30) {
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const since = last.date - days * DAY;
  const win = pts.filter(p => p.date > since && p.apy != null);
  const meanApy = win.length ? win.reduce((a, p) => a + p.apy, 0) / win.length : null;
  const before = (d, key) => {
    let prior = null;
    for (const p of pts) if (p.date <= last.date - d * DAY && p[key] != null) prior = p;
    return prior;
  };
  const change = d => {
    const prior = before(d, "tvl");
    if (!prior || last.tvl == null || !prior.tvl) return null;
    return { abs: last.tvl - prior.tvl, pct: ((last.tvl - prior.tvl) / prior.tvl) * 100, from: prior.date };
  };
  let realized = null;
  const ppsPrior = before(days, "pps");
  if (ppsPrior && last.pps && ppsPrior.pps > 0 && last.date > ppsPrior.date) {
    const span = (last.date - ppsPrior.date) / DAY;
    realized = { apy: (Math.pow(last.pps / ppsPrior.pps, 365 / span) - 1) * 100, from: ppsPrior.date };
  }
  const high = pts.filter(p => p.tvl != null).reduce((a, b) => (a == null || b.tvl > a.tvl ? b : a), null);
  return { last, meanApy, samples: win.length, change7d: change(7), change30d: change(days), realized, high };
}

async function main() {
  installCliSafeStdout();
  const pool = (process.env.LLAMA_YIELD_POOL || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(pool)) throw new Error("Set LLAMA_YIELD_POOL (DefiLlama yields pool UUID)");
  const label = (process.env.LLAMA_YIELD_LABEL || pool).trim();
  const { data } = await axios.get(`${YIELDS_BASE}/chart/${encodeURIComponent(pool)}`, { timeout: 20000 });
  const stats = poolStats(poolPoints(data && data.data));
  if (!stats) throw new Error(`${label}: no points on /chart/${pool}`);
  const { last } = stats;

  if (process.env.LLAMA_YIELD_SMOKE === "1") {
    const min = parseFloat(process.env.LLAMA_YIELD_MIN_TVL_USD || "0") || 0;
    if (!(last.tvl > min)) {
      console.error(chalk.red(`${label}: TVL ${formatCurrency(last.tvl || 0)} is not above ${formatCurrency(min)}`));
      process.exit(1);
    }
    console.log(
      chalk.green(
        `OK: ${label} | TVL ${formatCurrency(last.tvl)} | APY ${last.apy != null ? last.apy.toFixed(2) : "?"}%`
      )
    );
    return;
  }

  const day = s => new Date(s * 1000).toISOString().slice(0, 10);
  const pct = v => (v == null ? "—" : `${v.toFixed(2)}%`);
  const chg = c =>
    c
      ? `${c.abs >= 0 ? "+" : ""}${formatCurrency(c.abs)} (${c.pct >= 0 ? "+" : ""}${c.pct.toFixed(2)}%, vs ${day(c.from)})`
      : "—";
  console.log(chalk.cyan.bold(`\n${label} (DefiLlama yields)\n`));
  console.log(chalk.gray(`Pool: ${pool} (LLAMA_YIELD_POOL)\n`));
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Latest point", day(last.date)]);
  t.push(["TVL", last.tvl != null ? formatCurrency(last.tvl) : "—"]);
  t.push(["APY (latest)", pct(last.apy)]);
  t.push(["APY base / reward", `${pct(last.apyBase)} / ${pct(last.apyReward)}`]);
  t.push([`APY 30d mean (${stats.samples} daily points)`, pct(stats.meanApy)]);
  t.push([
    "APY 30d realized (pricePerShare)",
    stats.realized ? `${pct(stats.realized.apy)} (vs ${day(stats.realized.from)})` : "—",
  ]);
  t.push(["TVL change 7d", chg(stats.change7d)]);
  t.push(["TVL change 30d", chg(stats.change30d)]);
  t.push(["TVL high", stats.high ? `${formatCurrency(stats.high.tvl)} (${day(stats.high.date)})` : "—"]);
  console.log(t.toString());
  const project = (process.env.LLAMA_YIELD_PROJECT || "").trim();
  if (project) await printProjectRank(pool, project, (process.env.LLAMA_YIELD_SYMBOL_PREFIX || "").trim());
}

/**
 * @param {Array<{pool:string,project:string,symbol:string,chain:string,apy:number,tvlUsd:number}>} pools
 * @param {string} project
 * @param {string} prefix
 */
function rankProjectPools(pools, project, prefix) {
  return (Array.isArray(pools) ? pools : [])
    .filter(
      p =>
        p &&
        p.project === project &&
        (!prefix ||
          String(p.symbol || "")
            .toUpperCase()
            .startsWith(prefix.toUpperCase()))
    )
    .sort((a, b) => (num(b.apy) ?? -Infinity) - (num(a.apy) ?? -Infinity));
}

async function printProjectRank(pool, project, prefix) {
  let rows;
  try {
    const { data } = await axios.get(`${YIELDS_BASE}/pools`, { timeout: 60000 });
    rows = rankProjectPools(data && data.data, project, prefix);
  } catch (e) {
    console.log(chalk.gray(`  /pools unavailable: ${e.message || e}`));
    return;
  }
  const scope = prefix ? `${project} pools with symbol ${prefix}*` : `${project} pools`;
  if (!rows.length) {
    console.log(chalk.yellow(`\nNo ${scope} on DefiLlama /pools.`));
    return;
  }
  const t = createTable(["#", "Symbol", "Chain", "APY", "TVL", ""], {
    colAligns: ["right", "left", "left", "right", "right", "left"],
  });
  rows.forEach((p, i) => {
    const apy = num(p.apy);
    t.push([
      i + 1,
      p.symbol || "—",
      p.chain || "—",
      apy == null ? "—" : `${apy.toFixed(2)}%`,
      formatCurrency(num(p.tvlUsd) || 0),
      p.pool === pool ? "<- this pool" : "",
    ]);
  });
  const idx = rows.findIndex(p => p.pool === pool);
  console.log(chalk.yellow(`\n${scope} ranked by current APY (DefiLlama /pools)\n`));
  console.log(t.toString());
  console.log(
    idx === 0
      ? chalk.green("This pool has the highest current APY in that set.")
      : chalk.gray(`This pool ranks ${idx >= 0 ? idx + 1 : "n/a"} of ${rows.length}.`)
  );
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  });
}

module.exports = { poolPoints, poolStats, rankProjectPools };
