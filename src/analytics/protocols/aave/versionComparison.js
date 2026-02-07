/**
 * Aave Version Comparison Monitor
 * Compares V2 vs V3 rates across L1 (Ethereum) and L2 chains
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const AaveV2LendingPoolABI = require("../../../abis/aave/AaveV2LendingPool.json");
const AaveV3PoolABI = require("../../../abis/aave/AaveV3Pool.json");

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

function getChainType(chainKey) {
  return chainKey === "ethereum" ? "L1" : "L2";
}

async function getV2ReserveData(provider, poolAddress, assetAddress) {
  try {
    const pool = new ethers.Contract(poolAddress, AaveV2LendingPoolABI, provider);
    const reserveData = await pool.getReserveData(assetAddress);

    return {
      supplyAPY: formatAPY(reserveData.currentLiquidityRate),
      borrowAPY: formatAPY(reserveData.currentVariableBorrowRate),
      supplyRateRaw: reserveData.currentLiquidityRate,
      borrowRateRaw: reserveData.currentVariableBorrowRate,
    };
  } catch (error) {
    return null;
  }
}

async function getV3ReserveData(provider, poolAddress, assetAddress) {
  try {
    const pool = new ethers.Contract(poolAddress, AaveV3PoolABI, provider);
    const reserveData = await pool.getReserveData(assetAddress);

    return {
      supplyAPY: formatAPY(reserveData.currentLiquidityRate),
      borrowAPY: formatAPY(reserveData.currentVariableBorrowRate),
      supplyRateRaw: reserveData.currentLiquidityRate,
      borrowRateRaw: reserveData.currentVariableBorrowRate,
    };
  } catch (error) {
    return null;
  }
}

async function fetchAllMarkets() {
  const allData = {};

  for (const [chainKey, chain] of Object.entries(CHAINS)) {
    if (!chain.aave) continue;

    console.log(chalk.gray(`Fetching ${chain.name}...`));
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    allData[chainKey] = { name: chain.name, type: getChainType(chainKey), versions: {} };

    try {
      // Fetch V2 data if available
      if (chain.aave.v2?.lendingPool) {
        allData[chainKey].versions.v2 = {};
        for (const asset of MONITORED_ASSETS) {
          const assetAddress = COMMON_TOKENS[asset.symbol]?.[chainKey];
          if (!assetAddress) continue;

          const data = await getV2ReserveData(provider, chain.aave.v2.lendingPool, assetAddress);
          if (data) {
            allData[chainKey].versions.v2[asset.symbol] = data;
          }
        }
      }

      // Fetch V3 data if available
      if (chain.aave.v3?.pool) {
        allData[chainKey].versions.v3 = {};
        for (const asset of MONITORED_ASSETS) {
          const assetAddress = COMMON_TOKENS[asset.symbol]?.[chainKey];
          if (!assetAddress) continue;

          const data = await getV3ReserveData(provider, chain.aave.v3.pool, assetAddress);
          if (data) {
            allData[chainKey].versions.v3[asset.symbol] = data;
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error fetching ${chain.name}:`), error.message);
    }
  }

  return allData;
}

function displayVersionComparison(allData) {
  console.log("\n" + "=".repeat(80));
  console.log(chalk.cyan.bold("  AAVE VERSION COMPARISON - L1 vs L2"));
  console.log("=".repeat(80) + "\n");

  // Group by asset
  for (const asset of MONITORED_ASSETS) {
    const assetData = [];

    for (const [, chainData] of Object.entries(allData)) {
      const v2Data = chainData.versions.v2?.[asset.symbol];
      const v3Data = chainData.versions.v3?.[asset.symbol];

      if (v2Data || v3Data) {
        assetData.push({
          chain: chainData.name,
          type: chainData.type,
          v2: v2Data,
          v3: v3Data,
        });
      }
    }

    if (assetData.length === 0) continue;

    console.log(chalk.bold(`${asset.name} (${asset.symbol})`));
    console.log("━".repeat(80));
    console.log(
      chalk.gray("Chain".padEnd(15)),
      chalk.gray("Type".padEnd(6)),
      chalk.gray("Version".padEnd(10)),
      chalk.gray("Supply APY".padEnd(15)),
      chalk.gray("Borrow APY".padEnd(15)),
      chalk.gray("Improvement")
    );
    console.log("━".repeat(80));

    for (const row of assetData) {
      const typeColor = row.type === "L1" ? chalk.blue : chalk.cyan;
      
      if (row.v2) {
        console.log(
          typeColor(row.chain.padEnd(15)),
          typeColor(row.type.padEnd(6)),
          chalk.yellow("V2".padEnd(10)),
          chalk.green(row.v2.supplyAPY.padEnd(15)),
          chalk.red(row.v2.borrowAPY.padEnd(15)),
          chalk.gray("-")
        );
      }

      if (row.v3) {
        let improvement = "";
        if (row.v2 && row.v3) {
          const v2Supply = parseFloat(row.v2.supplyAPY);
          const v3Supply = parseFloat(row.v3.supplyAPY);
          const diff = ((v3Supply - v2Supply) / v2Supply * 100).toFixed(1);
          improvement = diff > 0 ? chalk.green(`+${diff}%`) : chalk.red(`${diff}%`);
        }

        console.log(
          typeColor(row.chain.padEnd(15)),
          typeColor(row.type.padEnd(6)),
          chalk.yellow("V3".padEnd(10)),
          chalk.green(row.v3.supplyAPY.padEnd(15)),
          chalk.red(row.v3.borrowAPY.padEnd(15)),
          improvement
        );
      }
    }

    console.log();
  }

  console.log("=".repeat(80));
  console.log(chalk.gray("Legend:"));
  console.log(chalk.blue("  L1") + chalk.gray(" = Ethereum Mainnet"));
  console.log(chalk.cyan("  L2") + chalk.gray(" = Layer 2 chains (Arbitrum, Optimism, Base, Polygon)"));
  console.log(chalk.gray("  Improvement = V3 supply APY vs V2 supply APY\n"));
}

function displayBestRates(allData) {
  console.log(chalk.bold.cyan("BEST RATES SUMMARY"));
  console.log("━".repeat(80) + "\n");

  for (const asset of MONITORED_ASSETS) {
    let bestSupply = { apy: 0, chain: "", version: "", type: "" };
    let cheapestBorrow = { apy: 100, chain: "", version: "", type: "" };

    for (const [, chainData] of Object.entries(allData)) {
      for (const [version, versionData] of Object.entries(chainData.versions)) {
        const assetData = versionData[asset.symbol];
        if (!assetData) continue;

        const supplyAPY = parseFloat(assetData.supplyAPY);
        const borrowAPY = parseFloat(assetData.borrowAPY);

        if (supplyAPY > bestSupply.apy) {
          bestSupply = {
            apy: supplyAPY,
            chain: chainData.name,
            version: version.toUpperCase(),
            type: chainData.type,
          };
        }

        if (borrowAPY < cheapestBorrow.apy && borrowAPY > 0) {
          cheapestBorrow = {
            apy: borrowAPY,
            chain: chainData.name,
            version: version.toUpperCase(),
            type: chainData.type,
          };
        }
      }
    }

    if (bestSupply.apy > 0) {
      const typeLabel = bestSupply.type === "L1" ? chalk.blue("[L1]") : chalk.cyan("[L2]");
      console.log(
        chalk.green("💰 Best Supply:"),
        chalk.bold(`${asset.symbol}`),
        "→",
        chalk.yellow(`${bestSupply.chain} ${bestSupply.version}`),
        typeLabel,
        chalk.bold.green(`${bestSupply.apy.toFixed(2)}%`)
      );
    }

    if (cheapestBorrow.apy < 100) {
      const typeLabel = cheapestBorrow.type === "L1" ? chalk.blue("[L1]") : chalk.cyan("[L2]");
      console.log(
        chalk.magenta("💸 Cheapest Borrow:"),
        chalk.bold(`${asset.symbol}`),
        "→",
        chalk.yellow(`${cheapestBorrow.chain} ${cheapestBorrow.version}`),
        typeLabel,
        chalk.bold.magenta(`${cheapestBorrow.apy.toFixed(2)}%`)
      );
    }

    console.log();
  }

  console.log("=".repeat(80) + "\n");
}

async function main() {
  console.log(chalk.cyan("\nFetching Aave V2 and V3 data across all chains...\n"));

  const allData = await fetchAllMarkets();

  const hasData = Object.values(allData).some(
    (chain) => Object.keys(chain.versions).length > 0
  );

  if (!hasData) {
    console.log(chalk.red("\nNo market data available\n"));
    process.exit(1);
  }

  displayVersionComparison(allData);
  displayBestRates(allData);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchAllMarkets, displayVersionComparison, displayBestRates };
