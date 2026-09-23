/**
 * RWA / tokenization TVL board (Ethereum first).
 *
 *   npm run analytics:rwa:overview
 *
 * Complements one-off Ondo / BUIDL slug monitors with DigiFT, Huma, thBill, etc.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaProtocols } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const PREFER_CHAIN = "Ethereum";
const MIN_TVL = 5e6;
const FROM_ZERO_PCT = 400;

function chainTvl(p, chain) {
  const v = p && p.chainTvls && p.chainTvls[chain];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function preferredTvl(p) {
  const eth = chainTvl(p, PREFER_CHAIN);
  if (eth != null) return { chain: PREFER_CHAIN, tvl: eth };
  const n = typeof p.tvl === "number" && Number.isFinite(p.tvl) ? p.tvl : null;
  return { chain: "all", tvl: n };
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function isRwa(p) {
  return p && typeof p.category === "string" && /rwa/i.test(p.category);
}

function toRow(p) {
  const pref = preferredTvl(p);
  const c7 = num(p.change_7d);
  return {
    name: p.name || "—",
    category: p.category || "—",
    chain: pref.chain,
    tvl: pref.tvl,
    change_1d: num(p.change_1d),
    change_7d: c7,
    fromZero: c7 != null && c7 >= FROM_ZERO_PCT,
  };
}

async function buildRwaOverview() {
  const protocols = await fetchLlamaProtocols();
  const rows = (Array.isArray(protocols) ? protocols : [])
    .filter(isRwa)
    .map(toRow)
    .filter((r) => r.tvl != null && r.tvl >= MIN_TVL);
  const largest = rows.slice().sort((a, b) => b.tvl - a.tvl).slice(0, 12);
  const weekUp = rows
    .filter((r) => r.change_7d != null && r.change_7d > 0)
    .sort((a, b) => b.change_7d - a.change_7d)
    .slice(0, 10);
  return {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    largest,
    weekUp,
  };
}

function printTable(title, list) {
  const table = createTable(["Name", "Category", "Chain", "TVL", "7d Δ"], {
    colAligns: ["left", "left", "left", "right", "right"],
  });
  for (const r of list) {
    table.push([
      r.name + (r.fromZero ? " (new)" : ""),
      r.category,
      r.chain,
      r.tvl != null ? formatCurrency(r.tvl) : "—",
      formatPct(r.change_7d),
    ]);
  }
  console.log(chalk.yellow(`\n${title}\n`));
  console.log(table.toString());
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nRWA / tokenization — TVL (DefiLlama)\n"));
  console.log(chalk.gray("Ethereum chain TVL when listed; otherwise protocol total. Ondo/BUIDL one-offs still exist.\n"));
  const board = await buildRwaOverview();
  printTable("Largest (TVL ≥ $5M)", board.largest);
  printTable("Week up", board.weekUp);
  console.log(chalk.gray('\n"(new)" = 7d Δ ≥ 400%. Treat as a listing from near zero.\n'));
}

module.exports = { PREFER_CHAIN, MIN_TVL, isRwa, buildRwaOverview };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
