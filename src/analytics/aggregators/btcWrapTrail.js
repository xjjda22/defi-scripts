/**
 * Bitcoin wrap listing trail: Circle Bitcoin daily TVL plus peer 7d $ delta.
 *
 *   npm run analytics:btc:wrap-trail
 *
 * Snapshot largest/week-up stays on `analytics:btc:wraps`. This board is the
 * from-zero path (Circle listed mid-September) vs Kraken / Babylon / Nexus.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, fetchLlamaProtocols } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Bitcoin";
const CIRCLE_SLUG = "circle-bitcoin";
const PEER_SLUGS = ["wbtc", "babylon-protocol", "kraken-bitcoin", "nexus-btc"];
const TRAIL_DAYS = 14;
const FROM_ZERO_PCT = 400;

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function ymd(tsSec) {
  return new Date(tsSec * 1000).toISOString().slice(0, 10);
}

function usdDelta(tvl, pctChange) {
  if (tvl == null || pctChange == null || pctChange <= -100) return null;
  return tvl - tvl / (1 + pctChange / 100);
}

function trailFromSeries(tvlSeries, days) {
  const arr = Array.isArray(tvlSeries) ? tvlSeries : [];
  const byDate = new Map();
  for (const p of arr) {
    const usd = num(p && p.totalLiquidityUSD);
    const d = p && p.date;
    if (usd == null || !d) continue;
    byDate.set(ymd(d), usd);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([date, tvl]) => ({ date, tvl }));
}

function peerRow(p) {
  const tvl = p && p.chainTvls ? num(p.chainTvls[CHAIN]) : num(p && p.tvl);
  const c7 = num(p && p.change_7d);
  return {
    name: (p && p.name) || "—",
    slug: (p && p.slug) || "—",
    category: (p && p.category) || "—",
    tvl,
    change_7d: c7,
    dUsd: usdDelta(tvl, c7),
    fromZero: c7 != null && c7 >= FROM_ZERO_PCT,
  };
}

async function buildBtcWrapTrail() {
  const [circle, protocols] = await Promise.all([
    fetchDefiLlamaProtocol(CIRCLE_SLUG),
    fetchLlamaProtocols(),
  ]);
  const trail = trailFromSeries(circle && circle.tvl, TRAIL_DAYS);
  const listed = trail.filter((p) => p.tvl > 1e5);
  const bySlug = new Map((Array.isArray(protocols) ? protocols : []).map((p) => [p.slug, p]));
  const peers = [CIRCLE_SLUG, ...PEER_SLUGS]
    .map((slug) => bySlug.get(slug))
    .filter(Boolean)
    .map(peerRow);
  return {
    generatedAt: new Date().toISOString(),
    slug: CIRCLE_SLUG,
    now: trail.length ? trail[trail.length - 1] : null,
    firstListed: listed.length ? listed[0] : null,
    trail,
    peers,
  };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nBitcoin wrap trail (DefiLlama)\n"));
  console.log(chalk.gray("Circle daily TVL. Peers use protocol 7d Δ on Bitcoin chain TVL.\n"));
  const board = await buildBtcWrapTrail();

  const trailTable = createTable(["Date", "Circle BTC TVL"], { colAligns: ["left", "right"] });
  for (const p of board.trail) {
    trailTable.push([p.date, formatCurrency(p.tvl)]);
  }
  console.log(chalk.yellow("Circle Bitcoin daily\n"));
  console.log(trailTable.toString());
  if (board.firstListed && board.now) {
    console.log(
      chalk.gray(
        `  listed ${board.firstListed.date} ${formatCurrency(board.firstListed.tvl)} → ${board.now.date} ${formatCurrency(board.now.tvl)}\n`
      )
    );
  }

  const peerTable = createTable(["Name", "Category", "BTC TVL", "7d Δ", "Est. 7d $"], {
    colAligns: ["left", "left", "right", "right", "right"],
  });
  for (const r of board.peers) {
    peerTable.push([
      r.name + (r.fromZero ? " (new)" : ""),
      r.category,
      r.tvl != null ? formatCurrency(r.tvl) : "—",
      formatPct(r.change_7d),
      r.dUsd != null ? formatCurrency(r.dUsd) : "—",
    ]);
  }
  console.log(chalk.yellow("Peers\n"));
  console.log(peerTable.toString());
  console.log(chalk.gray('\n"(new)" = 7d Δ ≥ 400%. Treat as a listing from near zero.\n'));
}

module.exports = {
  CHAIN,
  CIRCLE_SLUG,
  trailFromSeries,
  peerRow,
  buildBtcWrapTrail,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
