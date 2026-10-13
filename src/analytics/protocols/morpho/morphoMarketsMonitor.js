/**
 * Morpho Blue market snapshot(s) from Morpho's public GraphQL API (blue-api.morpho.org).
 * Used when a claim names borrow/supply/utilization on a chain Morpho market that is not
 * a single Vault V2 (e.g. Arc cirBTC/USDC).
 *
 * Env:
 *   MORPHO_CHAIN_ID              (required) numeric chain id (e.g. 5042 for Arc)
 *   MORPHO_COLLATERAL_SYMBOL     (optional) filter, e.g. cirBTC
 *   MORPHO_LOAN_SYMBOL           (optional) filter, e.g. USDC
 *   MORPHO_MARKETS_LABEL         (optional) banner title
 *   MORPHO_MARKETS_LIMIT         (optional, default 10) max markets to print
 *   MORPHO_MARKETS_SMOKE=1       (optional) one-line OK; exit non-zero on failure
 *   MORPHO_MARKETS_MIN_BORROW_USD (optional, smoke) fail if top market borrow is below this
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";

const MARKETS_QUERY = `
  query MorphoMarkets($where: MarketFilters, $first: Int!) {
    markets(
      first: $first
      orderBy: BorrowAssetsUsd
      orderDirection: Desc
      where: $where
    ) {
      items {
        marketId
        lltv
        loanAsset { symbol address }
        collateralAsset { symbol address }
        state {
          borrowAssetsUsd
          supplyAssetsUsd
          utilization
          borrowApy
          supplyApy
        }
      }
    }
  }
`;

function numOrNull(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function pct(n) {
  const v = numOrNull(n);
  return v != null ? `${(v * 100).toFixed(2)}%` : "—";
}

/** Morpho LLTV is a WAD (1e18) fraction, e.g. 0.86 → 860000000000000000. */
function lltvPct(n) {
  const v = numOrNull(n);
  if (v == null) return "—";
  const frac = v > 1 ? v / 1e18 : v;
  return `${(frac * 100).toFixed(0)}%`;
}

async function fetchMarkets(chainId, first) {
  const where = { chainId_in: [chainId] };
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    { query: MARKETS_QUERY, variables: { where, first } },
    {
      timeout: 25_000,
      headers: { "Content-Type": "application/json", "User-Agent": "defi-scripts/morpho-markets" },
    }
  );
  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }
  return data.data?.markets?.items || [];
}

function filterMarkets(items, collateralSymbol, loanSymbol) {
  const col = (collateralSymbol || "").trim().toLowerCase();
  const loan = (loanSymbol || "").trim().toLowerCase();
  return items.filter(m => {
    const c = (m.collateralAsset?.symbol || "").toLowerCase();
    const l = (m.loanAsset?.symbol || "").toLowerCase();
    if (col && c !== col) return false;
    if (loan && l !== loan) return false;
    return true;
  });
}

async function main() {
  installCliSafeStdout();
  const chainId = parseInt(process.env.MORPHO_CHAIN_ID || "", 10);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("Set MORPHO_CHAIN_ID (e.g. 5042 for Arc)");
  }
  const collateralSymbol = (process.env.MORPHO_COLLATERAL_SYMBOL || "").trim();
  const loanSymbol = (process.env.MORPHO_LOAN_SYMBOL || "").trim();
  const limit = Math.min(50, Math.max(1, parseInt(process.env.MORPHO_MARKETS_LIMIT || "10", 10) || 10));
  // Fetch a wider page so symbol filters still leave enough rows.
  const fetchN = collateralSymbol || loanSymbol ? 50 : limit;

  const raw = await fetchMarkets(chainId, fetchN);
  const items = filterMarkets(raw, collateralSymbol, loanSymbol).slice(0, limit);
  const label =
    (process.env.MORPHO_MARKETS_LABEL || "").trim() ||
    [
      "Morpho",
      collateralSymbol || null,
      loanSymbol ? `/${loanSymbol}` : null,
      `chain ${chainId}`,
    ]
      .filter(Boolean)
      .join(" ");

  const topBorrow = items.length ? numOrNull(items[0].state?.borrowAssetsUsd) : null;
  const totalBorrow = items.reduce((s, m) => s + (numOrNull(m.state?.borrowAssetsUsd) || 0), 0);
  const totalSupply = items.reduce((s, m) => s + (numOrNull(m.state?.supplyAssetsUsd) || 0), 0);

  if (process.env.MORPHO_MARKETS_SMOKE === "1") {
    const min = parseFloat(process.env.MORPHO_MARKETS_MIN_BORROW_USD || "0") || 0;
    if (!items.length || topBorrow == null || topBorrow <= 0 || topBorrow < min) {
      throw new Error(
        `${label}: top borrow ${topBorrow} below ${min > 0 ? min : "zero"} (${items.length} market(s))`
      );
    }
    console.log(
      chalk.green(
        `OK: ${label} | top borrow $${topBorrow.toFixed(0)} | markets ${items.length} | chain ${chainId}`
      )
    );
    return;
  }

  console.log(chalk.cyan.bold(`\n${label}\n`));
  console.log(chalk.gray(`Morpho Blue GraphQL · chainId ${chainId}\n`));

  const summary = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  summary.push(["Markets shown", String(items.length)]);
  if (collateralSymbol) summary.push(["Collateral filter", collateralSymbol]);
  if (loanSymbol) summary.push(["Loan filter", loanSymbol]);
  summary.push(["Sum borrow (USD)", formatCurrency(totalBorrow)]);
  summary.push(["Sum supply (USD)", formatCurrency(totalSupply)]);
  console.log(summary.toString());

  if (!items.length) {
    console.log(chalk.yellow("\nNo markets matched the filters."));
    return;
  }

  const t = createTable(
    ["Collateral", "Loan", "Borrow", "Supply", "Util", "Borrow APY", "LLTV"],
    { colAligns: ["left", "left", "right", "right", "right", "right", "right"] }
  );
  for (const m of items) {
    const s = m.state || {};
    t.push([
      m.collateralAsset?.symbol || "—",
      m.loanAsset?.symbol || "—",
      numOrNull(s.borrowAssetsUsd) != null ? formatCurrency(s.borrowAssetsUsd) : "—",
      numOrNull(s.supplyAssetsUsd) != null ? formatCurrency(s.supplyAssetsUsd) : "—",
      pct(s.utilization),
      pct(s.borrowApy),
      lltvPct(m.lltv),
    ]);
  }
  console.log(chalk.yellow("\nMarkets (by borrow)\n"));
  console.log(t.toString());
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { fetchMarkets, filterMarkets };
