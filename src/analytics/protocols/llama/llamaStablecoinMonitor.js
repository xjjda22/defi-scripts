/**
 * One stablecoin's circulating supply from the free DefiLlama stablecoins API
 * (stablecoins.llama.fi/stablecoin/{id}). For "stablecoin X hit a record $Y supply" claims.
 *
 * Env:
 *   LLAMA_STABLECOIN_ID       (required) DefiLlama stablecoin id (e.g. 373 for USDsui)
 *   LLAMA_STABLECOIN_SMOKE=1  (optional) print a one-line OK and exit non-zero on failure (simulate:*:smoke)
 *   LLAMA_STABLECOIN_MIN_USD  (optional, smoke only) fail if circulating supply is below this value
 *
 * Prints current circulating supply by chain, the 7d / 30d change and the all-time high (date).
 * If the series has a gap of more than 3 days at the 7d/30d target, the first point after it is used (or "—"),
 * and a series younger than 30 days also prints the change since its first point.
 * Non-USD pegs (e.g. peggedEUR for EURC) print amounts in the peg currency (€) plus a USD value at
 * DefiLlama's price; LLAMA_STABLECOIN_MIN_USD is then compared in peg units. peggedUSD output is unchanged.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchLlamaJson } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency, formatPercent } = require("../../utils/displayHelpers");

const PEG_SYMBOLS = { peggedEUR: "€", peggedGBP: "£", peggedJPY: "¥", peggedCHF: "CHF " };

/**
 * Formatter for amounts in the peg currency. peggedUSD (or unknown) keeps formatCurrency ($).
 * @param {string|undefined} pegType
 */
function pegFormatter(pegType) {
  const sym = PEG_SYMBOLS[pegType];
  if (!sym) return formatCurrency;
  return v => formatCurrency(v).replace(/^(-?)\$/, `$1${sym}`);
}

function pegged(v) {
  if (!v || typeof v !== "object") return null;
  const key = Object.keys(v).find(k => k.startsWith("pegged"));
  const n = key ? Number(v[key]) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Array<{ date: number, circulating: object }>} tokens
 * @param {number} days
 */
function supplyStats(tokens, days) {
  const pts = (Array.isArray(tokens) ? tokens : [])
    .map(p => ({ date: Number(p?.date), v: pegged(p?.circulating) }))
    .filter(p => Number.isFinite(p.date) && p.v != null)
    .sort((a, b) => a.date - b.date);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const high = pts.reduce((a, b) => (b.v > a.v ? b : a), pts[0]);
  const GAP = 3 * 86400;
  const change = d => {
    const target = last.date - d * 86400;
    let prior = [...pts].reverse().find(p => p.date <= target);
    // DefiLlama series can have multi-week gaps: if the last point before the target is more than 3 days
    // older, use the first point after the target (within 3 days) instead of a stale one.
    if (prior && target - prior.date > GAP) {
      const next = pts.find(p => p.date > target);
      prior = next && next.date - target <= GAP && next.date < last.date ? next : null;
    }
    if (!prior || !prior.v) return null;
    return { abs: last.v - prior.v, pct: ((last.v - prior.v) / prior.v) * 100, from: prior.date };
  };
  const first = pts[0];
  // Series shorter than the window (new listings): change since the first point instead.
  const sinceFirst =
    first.date > last.date - days * 86400 && first.v && first !== last
      ? { abs: last.v - first.v, pct: ((last.v - first.v) / first.v) * 100, from: first.date }
      : null;
  return { last, high, change7d: change(7), change30d: change(days), sinceFirst };
}

async function main() {
  installCliSafeStdout();
  const id = (process.env.LLAMA_STABLECOIN_ID || "").trim();
  if (!/^\d+$/.test(id)) throw new Error("Set LLAMA_STABLECOIN_ID (DefiLlama stablecoin id, e.g. 373)");
  const d = await fetchLlamaJson(`https://stablecoins.llama.fi/stablecoin/${id}`);
  const name = `${d?.name || "?"} (${d?.symbol || id})`;
  const chains = Object.entries(d?.currentChainBalances || {})
    .map(([c, v]) => [c, pegged(v)])
    .filter(([, v]) => v != null && v > 0);
  const current = chains.reduce((a, [, v]) => a + v, 0);
  const stats = supplyStats(d?.tokens, 30);
  const fmt = pegFormatter(d?.pegType);
  const price = Number(d?.price);
  const nonUsd = Boolean(PEG_SYMBOLS[d?.pegType]);

  if (process.env.LLAMA_STABLECOIN_SMOKE === "1") {
    const min = parseFloat(process.env.LLAMA_STABLECOIN_MIN_USD || "0") || 0;
    if (!(current > min)) {
      console.error(chalk.red(`${name}: circulating ${fmt(current)} is not above ${fmt(min)}`));
      process.exit(1);
    }
    console.log(chalk.green(`OK: ${name} | circulating ${fmt(current)}`));
    return;
  }

  const fmtChange = c => (c ? `${c.abs >= 0 ? "+" : ""}${fmt(c.abs)} (${formatPercent(c.pct)})` : "—");
  const day = s => new Date(s * 1000).toISOString().slice(0, 10);
  console.log(chalk.cyan.bold(`\n${name} supply (DefiLlama stablecoins)\n`));
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Circulating (current)", fmt(current)]);
  if (nonUsd && Number.isFinite(price) && price > 0) {
    t.push(["Circulating in USD (DefiLlama price)", `${formatCurrency(current * price)} (@ $${price.toFixed(4)})`]);
  }
  t.push(["Peg type", d?.pegType || "—"]);
  t.push(["Change 7d (daily series)", fmtChange(stats?.change7d)]);
  t.push(["Change 30d (daily series)", fmtChange(stats?.change30d)]);
  if (stats?.sinceFirst) {
    t.push([`Change since first point (${day(stats.sinceFirst.from)})`, fmtChange(stats.sinceFirst)]);
  }
  t.push(["All-time high (daily series)", stats ? `${fmt(stats.high.v)} (${day(stats.high.date)})` : "—"]);
  console.log(t.toString());
  if (chains.length) {
    const ct = createTable(["Chain", "Circulating"], { colAligns: ["left", "right"] });
    for (const [c, v] of chains) ct.push([c, fmt(v)]);
    console.log(chalk.yellow("\nBy chain\n"));
    console.log(ct.toString());
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  });
}

module.exports = { supplyStats, pegged, pegFormatter };
