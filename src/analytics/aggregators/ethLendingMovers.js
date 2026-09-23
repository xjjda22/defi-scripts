/**
 * Ethereum lending / CDP TVL movers (7d). Catches Aave V4, Spark, Morpho, new books.
 *
 *   npm run analytics:eth:lending-movers
 *
 * Snapshot TVL without Δ is still `analytics:lending:aggregate`.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaProtocols } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const PREFER_CHAIN = "Ethereum";
const MIN_TVL = 2e7;
const FROM_ZERO_PCT = 400;

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

function isLending(p) {
  return p && typeof p.category === "string" && /^(lending|cdp)$/i.test(p.category.trim());
}

function toRow(p) {
  const tvl = chainTvl(p, PREFER_CHAIN);
  const c7 = num(p.change_7d);
  return {
    name: p.name || "—",
    category: p.category || "—",
    chain: PREFER_CHAIN,
    tvl,
    change_7d: c7,
    fromZero: c7 != null && c7 >= FROM_ZERO_PCT,
  };
}

async function buildEthLendingMovers() {
  const protocols = await fetchLlamaProtocols();
  const rows = (Array.isArray(protocols) ? protocols : [])
    .filter(isLending)
    .map(toRow)
    .filter((r) => r.tvl != null && r.tvl >= MIN_TVL);
  const largest = rows.slice().sort((a, b) => b.tvl - a.tvl).slice(0, 12);
  const weekUp = rows
    .filter((r) => r.change_7d != null && r.change_7d > 0)
    .sort((a, b) => b.change_7d - a.change_7d)
    .slice(0, 10);
  const weekDown = rows
    .filter((r) => r.change_7d != null && r.change_7d < 0)
    .sort((a, b) => a.change_7d - b.change_7d)
    .slice(0, 8);
  return {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    largest,
    weekUp,
    weekDown,
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
  console.log(chalk.cyan.bold("\nEthereum lending / CDP movers (DefiLlama)\n"));
  console.log(chalk.gray("Ethereum chain TVL when listed. 7d Δ is the point of this board.\n"));
  const board = await buildEthLendingMovers();
  printTable("Largest (TVL ≥ $20M)", board.largest);
  printTable("Week up", board.weekUp);
  printTable("Week down", board.weekDown);
  console.log(chalk.gray('\n"(new)" = 7d Δ ≥ 400%. Treat as a listing from near zero.\n'));
  console.log(chalk.gray("On-chain rates: npm run analytics:lending:rates\n"));
}

module.exports = { MIN_TVL, isLending, buildEthLendingMovers };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
