/**
 * Pendle depth: chain TVL split plus Ethereum active PT/YT markets (liquidity, implied APY).
 *
 *   npm run analytics:eth:pendle-markets
 *
 * Venue volume stays on `analytics:eth:yield`. This board answers which markets
 * the Pendle DEX print is actually trading (RWA/stables vs LST).
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, fetchFeesSummary } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Ethereum";
const PENDLE_SLUG = "pendle";
const PENDLE_MARKETS_URL = "https://api-v2.pendle.finance/core/v1/1/markets/active";
const MIN_CHAIN_TVL = 1e6;
const TOP_MARKETS = 12;

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatApy(frac) {
  const n = num(frac);
  if (n == null) return "—";
  return formatPct(n * 100);
}

function isMetaChainKey(k) {
  return !k || /-/.test(k) || k === "staking" || k === "pool2" || k === "borrowed";
}

function chainRows(currentChainTvls) {
  const cct = currentChainTvls || {};
  return Object.entries(cct)
    .filter(([k, v]) => !isMetaChainKey(k) && num(v) != null && v >= MIN_CHAIN_TVL)
    .map(([chain, tvl]) => ({ chain, tvl }))
    .sort((a, b) => b.tvl - a.tvl);
}

function tagMarket(categoryIds) {
  const ids = Array.isArray(categoryIds) ? categoryIds.map((s) => String(s).toLowerCase()) : [];
  if (ids.includes("rwa")) return "rwa";
  if (ids.includes("ethena")) return "ethena";
  if (ids.includes("eth") || ids.includes("lido")) return "eth-lst";
  if (ids.includes("stables")) return "stables";
  return "other";
}

function toMarketRow(m) {
  const details = (m && m.details) || {};
  const expiry = m && m.expiry ? String(m.expiry).slice(0, 10) : "—";
  return {
    name: (m && m.name) || "—",
    expiry,
    liquidity: num(details.liquidity),
    impliedApy: num(details.impliedApy),
    underlyingApy: num(details.aggregatedApy),
    tag: tagMarket(m && m.categoryIds),
    isNew: Boolean(m && m.isNew),
  };
}

async function fetchPendleEthMarkets() {
  const { data } = await axios.get(PENDLE_MARKETS_URL, { timeout: 20000 });
  const list = data && Array.isArray(data.markets) ? data.markets : [];
  return list.map(toMarketRow).filter((r) => r.liquidity != null);
}

async function buildPendleMarkets() {
  const [protocol, fees, markets] = await Promise.all([
    fetchDefiLlamaProtocol(PENDLE_SLUG),
    fetchFeesSummary("pendle").catch(() => null),
    fetchPendleEthMarkets().catch(() => []),
  ]);
  const cct = (protocol && protocol.currentChainTvls) || {};
  const chains = chainRows(cct);
  const staking = num(cct["Ethereum-staking"]);
  const ethTvl = num(cct[CHAIN]);
  const sortedMkts = markets.slice().sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
  const byTag = new Map();
  for (const m of markets) {
    const prev = byTag.get(m.tag) || { tag: m.tag, n: 0, liquidity: 0 };
    prev.n += 1;
    prev.liquidity += m.liquidity || 0;
    byTag.set(m.tag, prev);
  }
  const tags = [...byTag.values()].sort((a, b) => b.liquidity - a.liquidity);
  return {
    generatedAt: new Date().toISOString(),
    ethTvl,
    staking,
    chains,
    fees24h: fees && num(fees.total24h),
    feesChange7d: fees && num(fees.change_7d),
    markets: sortedMkts.slice(0, TOP_MARKETS),
    marketCount: markets.length,
    marketLiq: markets.reduce((s, m) => s + (m.liquidity || 0), 0),
    tags,
  };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nPendle chains + Ethereum markets\n"));
  console.log(
    chalk.gray(
      "Llama chain TVL vs Pendle active markets on chain 1. Implied APY is the PT/YT market rate.\n"
    )
  );
  const board = await buildPendleMarkets();

  const chainTable = createTable(["Chain", "TVL"], { colAligns: ["left", "right"] });
  for (const r of board.chains) {
    chainTable.push([r.chain, formatCurrency(r.tvl)]);
  }
  console.log(chalk.yellow("Pendle TVL by chain\n"));
  console.log(chainTable.toString());
  if (board.staking != null) {
    console.log(chalk.gray(`  Ethereum staking ${formatCurrency(board.staking)}`));
  }
  if (board.fees24h != null) {
    console.log(chalk.gray(`  fees 24h ${formatCurrency(board.fees24h)}  7d Δ ${formatPct(board.feesChange7d)}`));
  }

  if (board.tags.length) {
    const tagTable = createTable(["Tag", "Markets", "Liquidity"], {
      colAligns: ["left", "right", "right"],
    });
    for (const t of board.tags) {
      tagTable.push([t.tag, String(t.n), formatCurrency(t.liquidity)]);
    }
    console.log(chalk.yellow(`\nETH market tags (${board.marketCount} markets, ${formatCurrency(board.marketLiq)} AMM liq)\n`));
    console.log(tagTable.toString());
  }

  if (board.markets.length) {
    const mTable = createTable(["Market", "Expiry", "Liquidity", "Implied", "Underlying", "Tag"], {
      colAligns: ["left", "left", "right", "right", "right", "left"],
    });
    for (const m of board.markets) {
      mTable.push([
        m.name + (m.isNew ? " (new)" : ""),
        m.expiry,
        m.liquidity != null ? formatCurrency(m.liquidity) : "—",
        formatApy(m.impliedApy),
        formatApy(m.underlyingApy),
        m.tag,
      ]);
    }
    console.log(chalk.yellow("\nLargest ETH markets\n"));
    console.log(mTable.toString());
  } else {
    console.log(chalk.gray("\n  (Pendle markets API empty or unreachable; chain TVL still listed)\n"));
  }
  console.log("");
}

module.exports = {
  CHAIN,
  PENDLE_SLUG,
  tagMarket,
  toMarketRow,
  chainRows,
  buildPendleMarkets,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
