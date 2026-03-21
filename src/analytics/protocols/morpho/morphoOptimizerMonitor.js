/**
 * Morpho Blue vs Aave V3 — rate comparison (Morpho public GraphQL + on-chain Aave).
 * Surfaces best listed Morpho markets per loan asset vs plain Aave pool rates.
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchMarketDataForChain } = require("../aave/marketMonitor");

const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";
const MONITORED_CHAINS = ["ethereum", "arbitrum", "optimism", "base", "polygon"];
const MONITORED_ASSETS = [
  { symbol: "USDC", name: "USDC" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "DAI", name: "Dai" },
  { symbol: "WETH", name: "WETH" },
  { symbol: "WBTC", name: "WBTC" },
];

const MIN_MARKET_USD = 10_000;

function morphoRateToPercent(rate) {
  if (rate == null || Number.isNaN(rate)) return null;
  return rate * 100;
}

async function morphoGraphql(query, variables) {
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    { query, variables },
    {
      timeout: 25_000,
      headers: {
        "Content-Type": "application/json",
        // Some CDNs reject default axios UA for GraphQL POSTs
        "User-Agent": "defi-scripts/morpho-monitor",
      },
    }
  );
  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }
  return data.data;
}

/**
 * Best Morpho market by borrow-side USD (proxy for liquidity / matching depth).
 * @param {string} chainKey
 * @param {string} loanAssetAddress checksummed or lowercase
 * @returns {Promise<object|null>}
 */
async function fetchTopMorphoMarket(chainKey, loanAssetAddress) {
  const chain = CHAINS[chainKey];
  if (!chain?.chainId || !loanAssetAddress) return null;

  const query = `
    query MorphoMarkets($where: MarketFilters) {
      markets(
        first: 25,
        orderBy: BorrowAssetsUsd,
        orderDirection: Desc,
        where: $where
      ) {
        items {
          uniqueKey
          collateralAsset { symbol }
          loanAsset { symbol address }
          state {
            supplyApy
            borrowApy
            utilization
            supplyAssetsUsd
            borrowAssetsUsd
          }
        }
      }
    }
  `;

  const where = {
    chainId_in: [chain.chainId],
    loanAssetAddress_in: [loanAssetAddress.toLowerCase()],
    listed: true,
    borrowAssetsUsd_gte: MIN_MARKET_USD,
  };

  const result = await morphoGraphql(query, { where });
  const items = result?.markets?.items || [];
  if (!items.length) return null;

  const pick = items[0];
  const s = pick.state;
  const supplyPct = morphoRateToPercent(s.supplyApy);
  const borrowPct = morphoRateToPercent(s.borrowApy);
  if (supplyPct > 500 || borrowPct > 500) return null;

  return {
    uniqueKey: pick.uniqueKey,
    collateral: pick.collateralAsset?.symbol || "?",
    supplyApyPct: supplyPct,
    borrowApyPct: borrowPct,
    utilization: s.utilization,
    borrowUsd: s.borrowAssetsUsd,
    supplyUsd: s.supplyAssetsUsd,
  };
}

/**
 * @param {string} chainKey
 * @returns {Promise<Record<string, object|null>>}
 */
async function fetchMorphoSummaryForChain(chainKey) {
  const entries = await Promise.all(
    MONITORED_ASSETS.map(async asset => {
      const addr = COMMON_TOKENS[asset.symbol]?.[chainKey];
      if (!addr) return [asset.symbol, null];
      try {
        const row = await fetchTopMorphoMarket(chainKey, addr);
        return [asset.symbol, row];
      } catch {
        return [asset.symbol, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

function parseAaveApy(apyStr) {
  const n = parseFloat(String(apyStr).replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

function displayComparison(chainKey, aaveData, morphoData) {
  const chain = CHAINS[chainKey];
  console.log(chalk.bold.cyan(`\n${chain.name}`));
  console.log("━".repeat(92));
  console.log(
    chalk.gray(
      "Asset".padEnd(8) +
        "Aave S%".padEnd(12) +
        "Morpho S%".padEnd(14) +
        "Δ S (pp)".padEnd(12) +
        "Aave B%".padEnd(12) +
        "Morpho B%".padEnd(14) +
        "Δ B (pp)".padEnd(12) +
        "Morpho collat"
    )
  );
  console.log("━".repeat(92));

  for (const asset of MONITORED_ASSETS) {
    const a = aaveData?.[asset.symbol];
    const m = morphoData?.[asset.symbol];
    if (!a && !m) continue;

    const aS = a ? parseAaveApy(a.supplyAPY) : null;
    const aB = a ? parseAaveApy(a.borrowAPY) : null;
    const mS = m?.supplyApyPct ?? null;
    const mB = m?.borrowApyPct ?? null;

    const dS = aS != null && mS != null ? (mS - aS).toFixed(2) : "—";
    const dB = aB != null && mB != null ? (mB - aB).toFixed(2) : "—";

    console.log(
      chalk.white(asset.symbol.padEnd(8)) +
        chalk.yellow((aS != null ? aS.toFixed(2) : "—").padEnd(12)) +
        chalk.yellow((mS != null ? mS.toFixed(2) : "—").padEnd(14)) +
        chalk.green(String(dS).padEnd(12)) +
        chalk.magenta((aB != null ? aB.toFixed(2) : "—").padEnd(12)) +
        chalk.magenta((mB != null ? mB.toFixed(2) : "—").padEnd(14)) +
        chalk.cyan(String(dB).padEnd(12)) +
        chalk.gray(m ? `${m.collateral} (u=${(m.utilization * 100).toFixed(1)}%)` : "—")
    );
  }
  console.log("━".repeat(92));
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nMorpho Blue vs Aave V3 — supply/borrow APY comparison\n"));
  console.log(
    chalk.gray(`Morpho: top listed market by borrow USD per asset (min $${MIN_MARKET_USD.toLocaleString()} borrowed).`)
  );

  for (const chainKey of MONITORED_CHAINS) {
    const chain = CHAINS[chainKey];
    if (!chain?.aave?.v3?.pool) continue;
    if (!chain?.rpcUrl) {
      console.log(chalk.gray(`\nSkipping ${chain.name}: no ${chainKey.toUpperCase()}_RPC_URL`));
      continue;
    }

    console.log(chalk.gray(`\nFetching ${chain.name} (Aave + Morpho)...`));
    const [aaveData, morphoData] = await Promise.all([
      fetchMarketDataForChain(chainKey),
      fetchMorphoSummaryForChain(chainKey),
    ]);

    if (!aaveData && !Object.values(morphoData || {}).some(Boolean)) {
      continue;
    }

    displayComparison(chainKey, aaveData, morphoData);
  }

  console.log(
    chalk.green(
      "\nDone. Positive Δ supply = Morpho higher lender yield; negative Δ borrow = cheaper borrow on Morpho.\n"
    )
  );
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = {
  fetchMorphoSummaryForChain,
  fetchTopMorphoMarket,
  morphoRateToPercent,
  MONITORED_CHAINS,
  MONITORED_ASSETS,
};
