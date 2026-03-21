/**
 * Aave V3 Market Monitor
 * Tracks supply/borrow rates across all Aave V3 markets on multiple chains
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const AaveV3PoolABI = require("../../../abis/aave/AaveV3Pool.json");

const ERC20_BALANCE_ABI = ["function balanceOf(address account) view returns (uint256)"];
const ERC20_TOTAL_SUPPLY_ABI = ["function totalSupply() view returns (uint256)"];

/** Full pool reserve tuple (addresses + indexes for utilization). */
const AAVE_POOL_RESERVE_FULL_ABI = [
  "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
];

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

/**
 * Utilization = totalDebt / (availableLiquidity + totalDebt).
 * Available underlying sits on the aToken contract, not the pool address.
 * Variable debt = rayMul(scaledTotalSupply, variableBorrowIndex).
 */
async function getReserveUtilizationPct(provider, poolAddress, assetAddress) {
  try {
    const poolFull = new ethers.Contract(poolAddress, AAVE_POOL_RESERVE_FULL_ABI, provider);
    const r = await poolFull.getReserveData(assetAddress);
    const vd = new ethers.Contract(r.variableDebtTokenAddress, ERC20_TOTAL_SUPPLY_ABI, provider);
    const sd = new ethers.Contract(r.stableDebtTokenAddress, ERC20_TOTAL_SUPPLY_ABI, provider);
    const underlying = new ethers.Contract(assetAddress, ERC20_BALANCE_ABI, provider);
    const [vSup, sSup, cash] = await Promise.all([
      vd.totalSupply(),
      sd.totalSupply(),
      underlying.balanceOf(r.aTokenAddress),
    ]);
    const variableBorrowIndex = BigInt(r.variableBorrowIndex);
    const totalVariableDebt = (vSup * variableBorrowIndex) / RAY;
    const totalStableDebt = sSup;
    const totalDebt = totalVariableDebt + totalStableDebt;
    const denom = cash + totalDebt;
    if (denom === 0n) return 0;
    return Number((totalDebt * 10000n) / denom) / 100;
  } catch {
    return null;
  }
}

async function getReserveData(provider, poolAddress, assetAddress) {
  try {
    const pool = new ethers.Contract(poolAddress, AaveV3PoolABI, provider);
    const reserveData = await pool.getReserveData(assetAddress);

    const supplyRate = reserveData.currentLiquidityRate;
    const borrowRate = reserveData.currentVariableBorrowRate;

    const utilizationPct = await getReserveUtilizationPct(provider, poolAddress, assetAddress);

    return {
      supplyAPY: formatAPY(supplyRate),
      borrowAPY: formatAPY(borrowRate),
      supplyRateRaw: supplyRate,
      borrowRateRaw: borrowRate,
      utilizationPct,
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

  if (!chain.rpcUrl) {
    console.warn(chalk.gray(`Skipping ${chain.name}: set ${chainKey.toUpperCase()}_RPC_URL in .env`));
    return null;
  }

  try {
    const provider = getProvider(chainKey);
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

/** Fallback if Protocol Data Provider read fails (not meaningful vs on-chain U). */
function calculateUtilizationFallback(supplyRateRaw, borrowRateRaw) {
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
      const utilization =
        market.utilizationPct != null
          ? market.utilizationPct
          : calculateUtilizationFallback(market.supplyRateRaw, market.borrowRateRaw);
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
  installCliSafeStdout();
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
  main().catch(err => {
    console.error(chalk.red(err.message || err));
    process.exit(1);
  });
}

module.exports = { fetchMarketDataForChain, displayMarketsByAsset };
