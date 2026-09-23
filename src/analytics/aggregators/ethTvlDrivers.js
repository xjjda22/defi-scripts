/**
 * Ethereum DeFi TVL drivers: implied 7d $ inflow/outflow by protocol and category.
 *
 *   npm run analytics:eth:tvl-drivers
 *
 * change_7d is protocol-wide. Rows require Ethereum share ≥ ETH_SHARE_MIN so the
 * dollar estimate is not a Solana/Tron bleed. CEX omitted (not chain TVL).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaProtocols } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Ethereum";
const MIN_TVL = 2e7;
const ETH_SHARE_MIN = 0.5;
const SKIP_CATS = new Set(["CEX"]);

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function chainTvl(p, chain) {
  const v = p && p.chainTvls && p.chainTvls[chain];
  return num(v);
}

function usdDelta(tvl, pctChange) {
  if (tvl == null || pctChange == null || pctChange <= -100) return null;
  return tvl - tvl / (1 + pctChange / 100);
}

function toRow(p) {
  const tvl = chainTvl(p, CHAIN);
  const total = num(p.tvl);
  const c7 = num(p.change_7d);
  const share = tvl != null && total && total > 0 ? tvl / total : null;
  return {
    name: p.name || "—",
    category: p.category || "—",
    tvl,
    change_7d: c7,
    ethShare: share,
    dUsd: usdDelta(tvl, c7),
  };
}

function keep(r) {
  return (
    r.tvl != null &&
    r.tvl >= MIN_TVL &&
    r.dUsd != null &&
    r.ethShare != null &&
    r.ethShare >= ETH_SHARE_MIN &&
    !SKIP_CATS.has(r.category)
  );
}

async function buildEthTvlDrivers() {
  const protocols = await fetchLlamaProtocols();
  const rows = (Array.isArray(protocols) ? protocols : []).map(toRow).filter(keep);
  const inflow = rows.filter((r) => r.dUsd > 0).sort((a, b) => b.dUsd - a.dUsd).slice(0, 12);
  const outflow = rows.filter((r) => r.dUsd < 0).sort((a, b) => a.dUsd - b.dUsd).slice(0, 8);
  const byCat = new Map();
  for (const r of rows) {
    const k = r.category || "Other";
    const prev = byCat.get(k) || { category: k, dUsd: 0, tvl: 0, n: 0 };
    prev.dUsd += r.dUsd;
    prev.tvl += r.tvl;
    prev.n += 1;
    byCat.set(k, prev);
  }
  const categories = [...byCat.values()].sort((a, b) => b.dUsd - a.dUsd).slice(0, 10);
  return {
    generatedAt: new Date().toISOString(),
    chain: CHAIN,
    count: rows.length,
    inflow,
    outflow,
    categories,
  };
}

function printProto(title, list) {
  const table = createTable(["Name", "Category", "ETH TVL", "7d Δ", "Est. 7d $"], {
    colAligns: ["left", "left", "right", "right", "right"],
  });
  for (const r of list) {
    table.push([
      r.name,
      r.category,
      r.tvl != null ? formatCurrency(r.tvl) : "—",
      formatPct(r.change_7d),
      r.dUsd != null ? formatCurrency(r.dUsd) : "—",
    ]);
  }
  console.log(chalk.yellow(`\n${title}\n`));
  console.log(table.toString());
}

function printCats(list) {
  const table = createTable(["Category", "n", "ETH TVL", "Est. 7d $"], {
    colAligns: ["left", "right", "right", "right"],
  });
  for (const r of list) {
    table.push([
      r.category,
      String(r.n),
      formatCurrency(r.tvl),
      formatCurrency(r.dUsd),
    ]);
  }
  console.log(chalk.yellow("\nCategory rollup (ETH share ≥ 50%, no CEX)\n"));
  console.log(table.toString());
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nEthereum TVL drivers (DefiLlama)\n"));
  console.log(
    chalk.gray(
      "Est. 7d $ applies protocol-wide change_7d to Ethereum TVL. ETH share ≥ 50%.\n"
    )
  );
  const board = await buildEthTvlDrivers();
  printCats(board.categories);
  printProto("Inflow", board.inflow);
  printProto("Outflow", board.outflow);
  console.log("");
}

module.exports = { CHAIN, MIN_TVL, ETH_SHARE_MIN, buildEthTvlDrivers };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
