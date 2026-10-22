/**
 * Morpho Blue borrowing against one collateral family on one chain, from Morpho's public
 * GraphQL API (blue-api.morpho.org). For "loans against bitcoin on Morpho's Base markets
 * are $1.6B" style claims: sums `borrowAssetsUsd` over every market whose collateral symbol
 * matches, and lists the largest markets with supply, utilization and borrow APY.
 *
 * Env:
 *   MORPHO_CHAIN_ID          (required) numeric chain id (e.g. 8453 for Base)
 *   MORPHO_COLLATERAL_MATCH  (required) case-insensitive substring of the collateral symbol (e.g. BTC
 *                            matches cbBTC, LBTC, WBTC, tBTC)
 *   MORPHO_LABEL             (optional) banner title
 *   MORPHO_BORROW_SMOKE=1    (optional) print a one-line OK and exit non-zero on failure (simulate:*:smoke)
 *   MORPHO_BORROW_MIN_USD    (optional, smoke only) fail if the summed borrow is below this value
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";
const PAGE = 500;
const MIN_ROW_USD = 1_000;

const MARKETS_QUERY = `
  query Markets($first: Int!, $skip: Int!, $where: MarketFilters) {
    markets(first: $first, skip: $skip, where: $where, orderBy: BorrowAssetsUsd, orderDirection: Desc) {
      items {
        marketId
        listed
        loanAsset { symbol }
        collateralAsset { symbol }
        state { borrowAssetsUsd supplyAssetsUsd utilization borrowApy }
      }
    }
  }
`;

function numOrNull(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

async function fetchMarkets(chainId) {
  const out = [];
  for (let skip = 0; skip < 20 * PAGE; skip += PAGE) {
    const { data } = await axios.post(
      MORPHO_GRAPHQL,
      {
        query: MARKETS_QUERY,
        variables: { first: PAGE, skip, where: { chainId_in: [chainId], borrowAssetsUsd_gte: MIN_ROW_USD } },
      },
      {
        timeout: 25_000,
        headers: { "Content-Type": "application/json", "User-Agent": "defi-scripts/morpho-collateral" },
      }
    );
    if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join("; "));
    const items = data.data?.markets?.items || [];
    out.push(...items);
    if (items.length < PAGE) break;
  }
  return out;
}

/**
 * @param {Array<object>} markets
 * @param {string} match
 */
function summarize(markets, match) {
  const m = match.toLowerCase();
  const rows = markets
    .filter(x => String(x?.collateralAsset?.symbol || "").toLowerCase().includes(m))
    .map(x => ({
      marketId: x.marketId,
      listed: Boolean(x.listed),
      pair: `${x.collateralAsset?.symbol || "?"} / ${x.loanAsset?.symbol || "?"}`,
      borrowUsd: numOrNull(x.state?.borrowAssetsUsd) || 0,
      supplyUsd: numOrNull(x.state?.supplyAssetsUsd) || 0,
      utilization: numOrNull(x.state?.utilization),
      borrowApy: numOrNull(x.state?.borrowApy),
    }))
    .sort((a, b) => b.borrowUsd - a.borrowUsd);
  const totalBorrow = rows.reduce((a, r) => a + r.borrowUsd, 0);
  const totalSupply = rows.reduce((a, r) => a + r.supplyUsd, 0);
  return { rows, totalBorrow, totalSupply };
}

async function main() {
  installCliSafeStdout();
  const chainId = parseInt(process.env.MORPHO_CHAIN_ID || "", 10);
  const match = (process.env.MORPHO_COLLATERAL_MATCH || "").trim();
  if (!Number.isInteger(chainId) || !match) {
    throw new Error("Set MORPHO_CHAIN_ID (e.g. 8453) and MORPHO_COLLATERAL_MATCH (e.g. BTC)");
  }
  const { rows, totalBorrow, totalSupply } = summarize(await fetchMarkets(chainId), match);
  const label = (process.env.MORPHO_LABEL || `Morpho ${match} collateral, chain ${chainId}`).trim();

  if (process.env.MORPHO_BORROW_SMOKE === "1") {
    const min = parseFloat(process.env.MORPHO_BORROW_MIN_USD || "0") || 0;
    if (!rows.length || !(totalBorrow > min)) {
      console.error(chalk.red(`${label}: borrow ${formatCurrency(totalBorrow)} is not above ${formatCurrency(min)}`));
      process.exit(1);
    }
    console.log(chalk.green(`OK: ${label} | ${rows.length} markets | borrowed ${formatCurrency(totalBorrow)}`));
    return;
  }

  console.log(chalk.cyan.bold(`\n${label} (Morpho GraphQL)\n`));
  const s = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  s.push(["Markets with this collateral", String(rows.length)]);
  s.push(["Borrowed (sum)", formatCurrency(totalBorrow)]);
  s.push(["Supplied (sum)", formatCurrency(totalSupply)]);
  if (rows[0] && totalBorrow > 0) {
    s.push(["Largest market share of borrow", `${((rows[0].borrowUsd / totalBorrow) * 100).toFixed(1)}%`]);
  }
  console.log(s.toString());

  const t = createTable(["Market", "Listed", "Borrowed", "Supplied", "Utilization", "Borrow APY", "Market id"], {
    colAligns: ["left", "left", "right", "right", "right", "right", "left"],
  });
  for (const r of rows.slice(0, 10)) {
    t.push([
      r.pair,
      r.listed ? "yes" : "no",
      formatCurrency(r.borrowUsd),
      formatCurrency(r.supplyUsd),
      r.utilization == null ? "—" : `${(r.utilization * 100).toFixed(1)}%`,
      r.borrowApy == null ? "—" : `${(r.borrowApy * 100).toFixed(2)}%`,
      `${r.marketId.slice(0, 10)}…`,
    ]);
  }
  console.log(chalk.yellow("\nLargest markets by borrow\n"));
  console.log(t.toString());
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  });
}

module.exports = { summarize };
