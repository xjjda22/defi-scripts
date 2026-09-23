/**
 * Aave on Ethereum: V3 vs V4 vs Horizon collateral mix and borrowed.
 *
 *   npm run analytics:eth:aave-mix
 *
 * On-chain V2/V3 rates remain `analytics:aave:markets` / `simulate:aave:versions`.
 * This board is Llama TVL + token breakdown (V4 is not in the rate aggregator).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const CHAIN = "Ethereum";
const SLUGS = [
  { slug: "aave-v3", label: "Aave V3" },
  { slug: "aave-v4", label: "Aave V4" },
  { slug: "aave-horizon-rwa", label: "Aave Horizon RWA" },
];
const TOP_TOKENS = 8;

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function lastTokens(protocol, chain) {
  const ct = protocol && protocol.chainTvls && protocol.chainTvls[chain];
  const series = ct && ct.tokensInUsd;
  let tokens = null;
  if (Array.isArray(series) && series.length) {
    const last = series[series.length - 1];
    tokens = last && last.tokens ? last.tokens : last;
  }
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return [];
  return Object.entries(tokens)
    .map(([token, usd]) => ({ token, usd: num(usd) }))
    .filter((r) => r.usd != null)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, TOP_TOKENS);
}

function extraChains(protocol) {
  const cct = (protocol && protocol.currentChainTvls) || {};
  return Object.entries(cct)
    .filter(([k, v]) => {
      if (!k || /-/.test(k) || k === "borrowed" || k === CHAIN) return false;
      return num(v) != null && v >= 1e6;
    })
    .map(([chain, tvl]) => ({ chain, tvl }))
    .sort((a, b) => b.tvl - a.tvl);
}

function bookFromProtocol(meta, protocol) {
  const cct = (protocol && protocol.currentChainTvls) || {};
  const tvl = num(cct[CHAIN]);
  const borrowed = num(cct[`${CHAIN}-borrowed`]);
  const tokens = lastTokens(protocol, CHAIN);
  const tokenUsd = tokens.reduce((s, t) => s + t.usd, 0);
  return {
    label: meta.label,
    slug: meta.slug,
    tvl,
    borrowed,
    util: tvl && tvl > 0 && borrowed != null ? (borrowed / tvl) * 100 : null,
    tokens,
    tokenUsd,
    extraChains: extraChains(protocol),
  };
}

async function buildEthAaveMix() {
  const packs = await Promise.all(
    SLUGS.map(async (meta) => {
      const protocol = await fetchDefiLlamaProtocol(meta.slug);
      return bookFromProtocol(meta, protocol);
    })
  );
  return {
    generatedAt: new Date().toISOString(),
    chain: CHAIN,
    books: packs,
  };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nAave Ethereum mix (DefiLlama)\n"));
  console.log(chalk.gray("Collateral is latest Ethereum tokensInUsd. Borrowed is chainTvls Ethereum-borrowed.\n"));
  const board = await buildEthAaveMix();

  const summary = createTable(["Book", "ETH TVL", "Borrowed", "Borrow / TVL"], {
    colAligns: ["left", "right", "right", "right"],
  });
  for (const b of board.books) {
    summary.push([
      b.label,
      b.tvl != null ? formatCurrency(b.tvl) : "—",
      b.borrowed != null ? formatCurrency(b.borrowed) : "—",
      formatPct(b.util),
    ]);
  }
  console.log(chalk.yellow("Books\n"));
  console.log(summary.toString());

  for (const b of board.books) {
    if (!b.tokens.length) continue;
    const table = createTable(["Token", "USD", "Share of listed"], {
      colAligns: ["left", "right", "right"],
    });
    for (const t of b.tokens) {
      const share = b.tokenUsd > 0 ? (t.usd / b.tokenUsd) * 100 : null;
      table.push([t.token, formatCurrency(t.usd), formatPct(share)]);
    }
    console.log(chalk.yellow(`\n${b.label} collateral (top ${b.tokens.length})\n`));
    console.log(table.toString());
    if (b.extraChains.length) {
      const extra = b.extraChains.map((c) => `${c.chain} ${formatCurrency(c.tvl)}`).join("  ");
      console.log(chalk.gray(`  other chains: ${extra}`));
    }
  }
  console.log("");
}

module.exports = { CHAIN, SLUGS, lastTokens, bookFromProtocol, buildEthAaveMix };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
