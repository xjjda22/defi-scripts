/**
 * Aave V3 Market Monitor
 * Tracks supply/borrow rates across all Aave V3 markets on multiple chains
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const AaveV3PoolABI = require("../../../abis/aave/AaveV3Pool.json");

const MONITORED_CHAINS = ["ethereum", "arbitrum", "optimism", "base", "polygon"];

const MONITORED_ASSETS = [
  { symbol: "USDC", name: "USDC" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "DAI", name: "Dai" },
  { symbol: "WETH", name: "WETH" },
  { symbol: "WBTC", name: "WBTC" },
];

const RAY = 10n ** 27n;

function formatAPY(rate) {
  const rateNum = Number(rate) / Number(RAY);
  const apy = (rateNum * 100).toFixed(2);
  return `${apy}%`;
}

function getHealthStatus(utilization) {
  if (utilization > 90) return chalk.red("🔥 Critical");
  if (utilization > 80) return chalk.yellow("⚠️  High util");
  return chalk.green("✅");
}

async function getReserveData(provider, poolAddress, assetAddress) {
  try {
    const pool = new ethers.Contract(poolAddress, AaveV3PoolABI, provider);
    const reserveData = await pool.getReserveData(assetAddress);

    const supplyRate = reserveData.currentLiquidityRate;
    const borrowRate = reserveData.currentVariableBorrowRate;

    return {
      supplyAPY: formatAPY(supplyRate),
      borrowAPY: formatAPY(borrowRate),
      supplyRateRaw: supplyRate,
      borrowRateRaw: borrowRate,
    };
  } catch (error) {
    return null;
  }
}

async function fetchMarketDataForChain(chainKey) {
  const chain = CHAINS[chainKey];
  
  if (!chain.aave?.v3?.pool) {
    return null;
  }

  try {
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const marketData = {};

    for (const asset of MONITORED_ASSETS) {
      const assetAddress = COMMON_TOKENS[asset.symbol]?.[chainKey];
      
      if (!assetAddress) {
        continue;
      }

      const data = await getReserveData(provider, chain.aave.v3.pool, assetAddress);
      
      if (data) {
        marketData[asset.symbol] = data;
      }
    }

    return Object.keys(marketData).length > 0 ? marketData : null;
  } catch (error) {
    console.error(chalk.red(`Error fetching ${chain.name} data:`), error.message);
    return null;
  }
}

function calculateUtilization(supplyRateRaw, borrowRateRaw) {
  if (!supplyRateRaw || !borrowRateRaw || borrowRateRaw === 0n) return 0;
  
  const supplyNum = Number(supplyRateRaw);
  const borrowNum = Number(borrowRateRaw);
  
  if (borrowNum === 0) return 0;
  
  return Math.min(100, (supplyNum / borrowNum) * 100);
}

function displayMarketsByAsset(allMarketsData) {
  console.log("\n" + "=".repeat(80));
  console.log(chalk.cyan.bold("  AAVE V3 MARKET MONITOR"));
  console.log("=".repeat(80) + "\n");

  for (const asset of MONITORED_ASSETS) {
    const assetMarkets = [];
    
    for (const chainKey of MONITORED_CHAINS) {
      const chainData = allMarketsData[chainKey];
      if (chainData && chainData[asset.symbol]) {
        assetMarkets.push({
          chain: CHAINS[chainKey].name,
          ...chainData[asset.symbol],
        });
      }
    }

    if (assetMarkets.length === 0) continue;

    console.log(chalk.bold(`${asset.name} (${asset.symbol}) Markets`));
    console.log("━".repeat(80));
    console.log(
      chalk.gray("Chain".padEnd(15)),
      chalk.gray("Supply APY".padEnd(15)),
      chalk.gray("Borrow APY".padEnd(15)),
      chalk.gray("Utilization".padEnd(15)),
      chalk.gray("Health")
    );
    console.log("━".repeat(80));

    let bestSupply = { apy: 0, chain: "" };
    let cheapestBorrow = { apy: 100, chain: "" };

    for (const market of assetMarkets) {
      const utilization = calculateUtilization(market.supplyRateRaw, market.borrowRateRaw);
      const healthStatus = getHealthStatus(utilization);

      const supplyAPYNum = parseFloat(market.supplyAPY);
      const borrowAPYNum = parseFloat(market.borrowAPY);

      if (supplyAPYNum > bestSupply.apy) {
        bestSupply = { apy: supplyAPYNum, chain: market.chain };
      }

      if (borrowAPYNum < cheapestBorrow.apy) {
        cheapestBorrow = { apy: borrowAPYNum, chain: market.chain };
      }

      console.log(
        chalk.cyan(market.chain.padEnd(15)),
        chalk.yellow(market.supplyAPY.padEnd(15)),
        chalk.magenta(market.borrowAPY.padEnd(15)),
        chalk.white(`${utilization.toFixed(1)}%`.padEnd(15)),
        healthStatus
      );
    }

    console.log("─".repeat(80));
    console.log(
      chalk.green("💡 Best Supply:"),
      chalk.bold(`${asset.symbol} on ${bestSupply.chain} (${bestSupply.apy.toFixed(2)}%)`)
    );
    console.log(
      chalk.green("💡 Cheapest Borrow:"),
      chalk.bold(`${asset.symbol} on ${cheapestBorrow.chain} (${cheapestBorrow.apy.toFixed(2)}%)`)
    );
    console.log();
  }

  console.log("=".repeat(80) + "\n");
}

async function main() {
  console.log(chalk.cyan("\nFetching Aave V3 market data across all chains...\n"));

  const allMarketsData = {};

  for (const chainKey of MONITORED_CHAINS) {
    console.log(chalk.gray(`Fetching ${CHAINS[chainKey].name}...`));
    const marketData = await fetchMarketDataForChain(chainKey);
    if (marketData) {
      allMarketsData[chainKey] = marketData;
    }
  }

  if (Object.keys(allMarketsData).length === 0) {
    console.log(chalk.red("\nNo market data available\n"));
    process.exit(1);
  }

  displayMarketsByAsset(allMarketsData);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchMarketDataForChain, displayMarketsByAsset };
