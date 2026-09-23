/**
 * Ethereum DEX venue share: Uniswap V4 vs V3 vs aggregators vs long-tail.
 *
 *   npm run analytics:eth:dex-share
 *
 * 7d Δ above FROM_ZERO_PCT is labeled "new" (listing from near zero), not organic.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDexOverview } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Ethereum";
const FROM_ZERO_PCT = 400;
const MIN_7D_VOL = 1e6;
const TOP_N = 12;
const RISER_N = 8;

function protoName(p) {
  return p.displayName || p.name || "—";
}

function vol(p, key) {
  const n = p && p[key];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatShare(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function isFromZero(p) {
  const c7 = vol(p, "change_7d");
  return c7 != null && c7 >= FROM_ZERO_PCT;
}

function toRow(p) {
  return {
    name: protoName(p),
    total24h: vol(p, "total24h"),
    total7d: vol(p, "total7d"),
    total30d: vol(p, "total30d"),
    change_1d: vol(p, "change_1d"),
    change_7d: vol(p, "change_7d"),
    change_1m: vol(p, "change_1m"),
    fromZero: isFromZero(p),
  };
}

function sharePct(part, whole) {
  if (part == null || whole == null || whole <= 0) return null;
  return (part / whole) * 100;
}

async function buildEthDexShare() {
  const dex = await fetchDexOverview(CHAIN);
  const protocols = Array.isArray(dex && dex.protocols) ? dex.protocols : [];
  const top24h = protocols
    .slice()
    .sort((a, b) => (vol(b, "total24h") || 0) - (vol(a, "total24h") || 0))
    .slice(0, TOP_N)
    .map(toRow);
  const risers7d = protocols
    .filter((p) => {
      const c7 = vol(p, "change_7d");
      const v7 = vol(p, "total7d") || 0;
      return c7 != null && v7 >= MIN_7D_VOL;
    })
    .sort((a, b) => (vol(b, "change_7d") || 0) - (vol(a, "change_7d") || 0))
    .slice(0, RISER_N)
    .map(toRow);
  const uniV3 = protocols.find((p) => /uniswap\s*v3/i.test(protoName(p)));
  const uniV4 = protocols.find((p) => /uniswap\s*v4/i.test(protoName(p)));
  const aqua = protocols.find((p) => /1inch\s*aqua/i.test(protoName(p)));
  const all24 = vol(dex, "total24h");
  return {
    generatedAt: new Date().toISOString(),
    chain: CHAIN,
    totals: {
      total24h: all24,
      total7d: vol(dex, "total7d"),
      total30d: vol(dex, "total30d"),
      change_1d: vol(dex, "change_1d"),
      change_7d: vol(dex, "change_7d"),
      change_1m: vol(dex, "change_1m"),
    },
    headline: {
      v3: uniV3 ? toRow(uniV3) : null,
      v4: uniV4 ? toRow(uniV4) : null,
      aqua: aqua ? toRow(aqua) : null,
      v4Share24h: uniV4 ? sharePct(vol(uniV4, "total24h"), all24) : null,
      v3Share24h: uniV3 ? sharePct(vol(uniV3, "total24h"), all24) : null,
      aquaShare24h: aqua ? sharePct(vol(aqua, "total24h"), all24) : null,
    },
    top24h,
    risers7d,
  };
}

function printRow(table, r, extra) {
  table.push([
    r.name + (r.fromZero ? " (new)" : ""),
    r.total24h != null ? formatCurrency(r.total24h) : "—",
    r.total7d != null ? formatCurrency(r.total7d) : "—",
    formatPct(r.change_7d),
    extra != null ? extra : formatPct(r.change_1m),
  ]);
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nEthereum DEX share — venue volume (DefiLlama)\n"));
  const board = await buildEthDexShare();
  const t = board.totals;
  console.log(
    chalk.gray(
      `${CHAIN}  24h ${t.total24h != null ? formatCurrency(t.total24h) : "—"}` +
        `  7d ${t.total7d != null ? formatCurrency(t.total7d) : "—"} (${formatPct(t.change_7d)})` +
        `  30d ${t.total30d != null ? formatCurrency(t.total30d) : "—"} (${formatPct(t.change_1m)})\n`
    )
  );
  const h = board.headline;
  if (h.v4 || h.v3 || h.aqua) {
    console.log(
      chalk.gray(
        `Share 24h: V4 ${formatShare(h.v4Share24h)}  V3 ${formatShare(h.v3Share24h)}  1inch Aqua ${formatShare(h.aquaShare24h)}\n`
      )
    );
  }

  const top = createTable(["Venue", "24h", "7d", "7d Δ", "30d Δ"], {
    colAligns: ["left", "right", "right", "right", "right"],
  });
  for (const r of board.top24h) printRow(top, r);
  console.log(chalk.yellow("Top 24h volume\n"));
  console.log(top.toString());

  const rise = createTable(["Venue", "24h", "7d", "7d Δ", "30d Δ"], {
    colAligns: ["left", "right", "right", "right", "right"],
  });
  for (const r of board.risers7d) printRow(rise, r);
  console.log(chalk.yellow("\n7d risers (vol ≥ $1M)\n"));
  console.log(rise.toString());
  console.log(chalk.gray('\n"(new)" = 7d Δ ≥ 400%. Treat as a listing from near zero, not organic growth.'));
  console.log(chalk.gray("Live quotes: CHAIN=ethereum npm run analytics:dex:prices\n"));
}

module.exports = { FROM_ZERO_PCT, CHAIN, buildEthDexShare, protoName, isFromZero };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
