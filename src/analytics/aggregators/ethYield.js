/**
 * Pendle / Ethereum yield tape: DEX volume for Pendle V2 plus yield TVL movers.
 *
 *   npm run analytics:eth:yield
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDexOverview, fetchLlamaProtocols } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Ethereum";
const MIN_TVL = 8e6;
const FROM_ZERO_PCT = 400;

function protoName(p) {
  return (p && (p.displayName || p.name)) || "—";
}

function vol(p, key) {
  const n = p && p[key];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

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

function preferredTvl(p) {
  const eth = chainTvl(p, CHAIN);
  if (eth != null) return { chain: CHAIN, tvl: eth };
  return { chain: CHAIN, tvl: null };
}

function isYield(p) {
  return p && typeof p.category === "string" && /yield/i.test(p.category);
}

function isPendle(p) {
  return /pendle/i.test(protoName(p));
}

async function buildEthYield() {
  const [dex, protocols] = await Promise.all([fetchDexOverview(CHAIN), fetchLlamaProtocols()]);
  const dexList = Array.isArray(dex && dex.protocols) ? dex.protocols : [];
  const pendleDex = dexList.filter(isPendle).map((p) => ({
    name: protoName(p),
    total24h: vol(p, "total24h"),
    total7d: vol(p, "total7d"),
    change_7d: vol(p, "change_7d"),
    change_1m: vol(p, "change_1m"),
    fromZero: (vol(p, "change_7d") || 0) >= FROM_ZERO_PCT,
  }));
  const rows = (Array.isArray(protocols) ? protocols : [])
    .filter(isYield)
    .map((p) => {
      const pref = preferredTvl(p);
      const c7 = num(p.change_7d);
      return {
        name: p.name || "—",
        category: p.category || "—",
        chain: pref.chain,
        tvl: pref.tvl,
        change_7d: c7,
        fromZero: c7 != null && c7 >= FROM_ZERO_PCT,
        pendle: /pendle/i.test(p.name || ""),
      };
    })
    .filter((r) => r.tvl != null && r.tvl >= MIN_TVL);
  const pendleTvl = rows.filter((r) => r.pendle).sort((a, b) => b.tvl - a.tvl);
  const weekUp = rows
    .filter((r) => r.change_7d != null && r.change_7d > 0)
    .sort((a, b) => b.change_7d - a.change_7d)
    .slice(0, 10);
  return {
    generatedAt: new Date().toISOString(),
    pendleDex,
    pendleTvl,
    weekUp,
    count: rows.length,
  };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nEthereum yield / Pendle (DefiLlama)\n"));
  const board = await buildEthYield();

  const dexTable = createTable(["Venue", "24h", "7d", "7d Δ", "30d Δ"], {
    colAligns: ["left", "right", "right", "right", "right"],
  });
  for (const r of board.pendleDex) {
    dexTable.push([
      r.name + (r.fromZero ? " (new)" : ""),
      r.total24h != null ? formatCurrency(r.total24h) : "—",
      r.total7d != null ? formatCurrency(r.total7d) : "—",
      formatPct(r.change_7d),
      formatPct(r.change_1m),
    ]);
  }
  console.log(chalk.yellow("Pendle on Ethereum DEX volume\n"));
  console.log(dexTable.toString());
  if (!board.pendleDex.length) {
    console.log(chalk.gray("  (no Pendle row on /overview/dexs/Ethereum)\n"));
  }

  if (board.pendleTvl.length) {
    const t = createTable(["Name", "Category", "Chain", "TVL", "7d Δ"], {
      colAligns: ["left", "left", "left", "right", "right"],
    });
    for (const r of board.pendleTvl) {
      t.push([
        r.name,
        r.category,
        r.chain,
        formatCurrency(r.tvl),
        formatPct(r.change_7d),
      ]);
    }
    console.log(chalk.yellow("\nPendle protocol TVL\n"));
    console.log(t.toString());
  }

  const up = createTable(["Name", "Category", "Chain", "TVL", "7d Δ"], {
    colAligns: ["left", "left", "left", "right", "right"],
  });
  for (const r of board.weekUp) {
    up.push([
      r.name + (r.fromZero ? " (new)" : ""),
      r.category,
      r.chain,
      formatCurrency(r.tvl),
      formatPct(r.change_7d),
    ]);
  }
  console.log(chalk.yellow("\nYield TVL week up (TVL ≥ $8M)\n"));
  console.log(up.toString());
  console.log(chalk.gray('\n"(new)" = 7d Δ ≥ 400%. Treat as a listing from near zero.\n'));
}

module.exports = { CHAIN, isPendle, isYield, protoName, buildEthYield };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
