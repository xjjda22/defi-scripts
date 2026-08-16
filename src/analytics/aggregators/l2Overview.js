/**
 * Live L2 rollup board: DefiLlama chain TVL + DEX 30d volume.
 * Reuses chains.js keys; does not duplicate RPC maps.
 *
 *   npm run analytics:l2:overview
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaChains, fetchDexOverview } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

/** Llama v2/chains `name` plus /overview/dexs/{chain} aliases. */
const L2_CHAINS = [
  { key: "arbitrum", label: "Arbitrum", llamaNames: ["Arbitrum"], dexs: ["Arbitrum"] },
  { key: "optimism", label: "Optimism", llamaNames: ["OP Mainnet", "Optimism"], dexs: ["OP Mainnet", "Optimism"] },
  { key: "base", label: "Base", llamaNames: ["Base"], dexs: ["Base"] },
  { key: "polygon", label: "Polygon", llamaNames: ["Polygon"], dexs: ["Polygon"] },
  { key: "scroll", label: "Scroll", llamaNames: ["Scroll"], dexs: ["Scroll"] },
  { key: "zksync", label: "zkSync Era", llamaNames: ["ZKsync Era", "zkSync Era"], dexs: ["ZKsync Era", "zkSync Era"] },
  { key: "linea", label: "Linea", llamaNames: ["Linea"], dexs: ["Linea"] },
  { key: "unichain", label: "Unichain", llamaNames: ["Unichain"], dexs: ["Unichain"] },
];

function matchChainRow(rows, names) {
  for (const name of names) {
    const want = String(name).toLowerCase();
    const hit = (rows || []).find(r => String(r.name || "").toLowerCase() === want);
    if (hit) return hit;
  }
  return null;
}

function uniShare(protocols) {
  const list = protocols || [];
  const uni = list.filter(p => /uniswap/i.test(p.displayName || p.name || ""));
  const vol = p => (typeof p.total30d === "number" ? p.total30d : 0);
  const uni30 = uni.reduce((n, p) => n + vol(p), 0);
  const all30 = list.reduce((n, p) => n + vol(p), 0);
  const v3 = uni.filter(p => /v3/i.test(p.displayName || p.name || "")).reduce((n, p) => n + vol(p), 0);
  const v4 = uni.filter(p => /v4/i.test(p.displayName || p.name || "")).reduce((n, p) => n + vol(p), 0);
  return { uni30, all30, v3, v4, pct: all30 > 0 ? (uni30 / all30) * 100 : null };
}

async function fetchDexWithAliases(aliases) {
  let lastErr = null;
  for (const name of aliases) {
    try {
      const d = await fetchDexOverview(name);
      if (d && (d.total30d != null || d.total24h != null || Array.isArray(d.protocols))) return d;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

async function buildL2Overview() {
  const chains = await fetchLlamaChains();
  const rows = [];
  for (const spec of L2_CHAINS) {
    const tvlRow = matchChainRow(chains, spec.llamaNames);
    let dex = null;
    let dexError = null;
    try {
      dex = await fetchDexWithAliases(spec.dexs);
    } catch (e) {
      dexError = e.message || String(e);
    }
    const share = uniShare(dex && dex.protocols);
    rows.push({
      key: spec.key,
      label: spec.label,
      llamaName: tvlRow ? tvlRow.name : spec.llamaNames[0],
      tvl: tvlRow && typeof tvlRow.tvl === "number" ? tvlRow.tvl : null,
      vol24h: dex && typeof dex.total24h === "number" ? dex.total24h : null,
      vol30d: dex && typeof dex.total30d === "number" ? dex.total30d : null,
      change1m: dex && typeof dex.change_1m === "number" ? dex.change_1m : null,
      uniPct: share.pct,
      uniV3: share.v3,
      uniV4: share.v4,
      dexError,
    });
  }
  return { generatedAt: new Date().toISOString(), rows };
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nL2 landscape — TVL + DEX volume (DefiLlama)\n"));
  const { rows } = await buildL2Overview();
  const table = createTable(["L2", "TVL", "DEX 24h", "DEX 30d", "30d Δ", "Uni share"], {
    colAligns: ["left", "right", "right", "right", "right", "right"],
  });
  let ok = 0;
  for (const r of rows) {
    if (r.tvl != null || r.vol30d != null) ok++;
    table.push([
      r.label,
      r.tvl != null ? formatCurrency(r.tvl) : "—",
      r.vol24h != null ? formatCurrency(r.vol24h) : "—",
      r.vol30d != null ? formatCurrency(r.vol30d) : "—",
      formatPct(r.change1m),
      r.uniPct != null ? `${r.uniPct.toFixed(0)}%` : "—",
    ]);
  }
  console.log(table.toString());
  const missingDex = rows.filter(r => r.dexError);
  if (missingDex.length) {
    console.log(chalk.gray(`\nDEX overview missing: ${missingDex.map(r => r.label).join(", ")}`));
  }
  console.log(chalk.gray("\nLive quotes: CHAIN=base|arbitrum|unichain npm run analytics:dex:prices"));
  if (ok === 0) process.exit(1);
}

module.exports = { L2_CHAINS, matchChainRow, uniShare, buildL2Overview };

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
