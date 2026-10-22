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
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchLlamaJson } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency, formatPercent } = require("../../utils/displayHelpers");

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
  const change = d => {
    const target = last.date - d * 86400;
    const prior = [...pts].reverse().find(p => p.date <= target);
    if (!prior || !prior.v) return null;
    return { abs: last.v - prior.v, pct: ((last.v - prior.v) / prior.v) * 100 };
  };
  return { last, high, change7d: change(7), change30d: change(days) };
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

  if (process.env.LLAMA_STABLECOIN_SMOKE === "1") {
    const min = parseFloat(process.env.LLAMA_STABLECOIN_MIN_USD || "0") || 0;
    if (!(current > min)) {
      console.error(chalk.red(`${name}: circulating ${formatCurrency(current)} is not above ${formatCurrency(min)}`));
      process.exit(1);
    }
    console.log(chalk.green(`OK: ${name} | circulating ${formatCurrency(current)}`));
    return;
  }

  const fmtChange = c => (c ? `${c.abs >= 0 ? "+" : ""}${formatCurrency(c.abs)} (${formatPercent(c.pct)})` : "—");
  const day = s => new Date(s * 1000).toISOString().slice(0, 10);
  console.log(chalk.cyan.bold(`\n${name} supply (DefiLlama stablecoins)\n`));
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Circulating (current)", formatCurrency(current)]);
  t.push(["Peg type", d?.pegType || "—"]);
  t.push(["Change 7d (daily series)", fmtChange(stats?.change7d)]);
  t.push(["Change 30d (daily series)", fmtChange(stats?.change30d)]);
  t.push(["All-time high (daily series)", stats ? `${formatCurrency(stats.high.v)} (${day(stats.high.date)})` : "—"]);
  console.log(t.toString());
  if (chains.length) {
    const ct = createTable(["Chain", "Circulating"], { colAligns: ["left", "right"] });
    for (const [c, v] of chains) ct.push([c, formatCurrency(v)]);
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

module.exports = { supplyStats, pegged };
