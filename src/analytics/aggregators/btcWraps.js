/**
 * Bitcoin DeFi wraps and restaking (not CEX custody, not AMM volume).
 *
 *   npm run analytics:btc:wraps
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaProtocols } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Bitcoin";
const MIN_TVL = 5e6;
const FROM_ZERO_PCT = 400;
const SKIP_CATS = new Set(["CEX"]);
const KEEP_CATS = new Set([
  "Bridge",
  "Canonical Bridge",
  "Restaking",
  "Anchor BTC",
  "Restaked BTC",
  "Decentralized BTC",
  "CDP",
]);

function chainTvl(p, chain) {
  const v = p && p.chainTvls && p.chainTvls[chain];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function keepProtocol(p) {
  if (!p || SKIP_CATS.has(p.category)) return false;
  if (p.category && !KEEP_CATS.has(p.category)) return false;
  const tvl = chainTvl(p, CHAIN);
  return tvl != null && tvl >= MIN_TVL;
}

function toRow(p) {
  const tvl = chainTvl(p, CHAIN);
  const c7 = num(p.change_7d);
  return {
    name: p.name || "—",
    category: p.category || "—",
    tvl,
    change_1d: num(p.change_1d),
    change_7d: c7,
    fromZero: c7 != null && c7 >= FROM_ZERO_PCT,
  };
}

async function buildBtcWraps() {
  const protocols = await fetchLlamaProtocols();
  const rows = (Array.isArray(protocols) ? protocols : []).filter(keepProtocol).map(toRow);
  const largest = rows.slice().sort((a, b) => b.tvl - a.tvl).slice(0, 12);
  const weekUp = rows
    .filter((r) => r.change_7d != null && r.change_7d > 0)
    .sort((a, b) => b.change_7d - a.change_7d)
    .slice(0, 10);
  const weekDown = rows
    .filter((r) => r.change_7d != null)
    .sort((a, b) => a.change_7d - b.change_7d)
    .slice(0, 8);
  return {
    generatedAt: new Date().toISOString(),
    chain: CHAIN,
    count: rows.length,
    largest,
    weekUp,
    weekDown,
  };
}

function printWrapTable(title, list) {
  const table = createTable(["Name", "Category", "BTC TVL", "7d Δ"], {
    colAligns: ["left", "left", "right", "right"],
  });
  for (const r of list) {
    table.push([
      r.name + (r.fromZero ? " (new)" : ""),
      r.category,
      r.tvl != null ? formatCurrency(r.tvl) : "—",
      formatPct(r.change_7d),
    ]);
  }
  console.log(chalk.yellow(`\n${title}\n`));
  console.log(table.toString());
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nBitcoin wraps / restaking (DefiLlama)\n"));
  console.log(chalk.gray("CEX rows omitted. Native BTC DEX volume is a separate (tiny) board.\n"));
  const board = await buildBtcWraps();
  printWrapTable("Largest (TVL ≥ $5M)", board.largest);
  printWrapTable("Week up", board.weekUp);
  printWrapTable("Week down", board.weekDown);
  console.log(chalk.gray('\n"(new)" = 7d Δ ≥ 400%. Treat as a listing from near zero.\n'));
}

module.exports = { CHAIN, KEEP_CATS, MIN_TVL, keepProtocol, buildBtcWraps };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
