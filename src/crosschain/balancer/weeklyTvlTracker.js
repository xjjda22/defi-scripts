/**
 * Balancer Weekly TVL Tracker
 * Tracks daily TVL stats across Balancer for multiple chains
 */

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const chalk = require("chalk");

const DEFILLAMA_API = "https://api.llama.fi";
const BALANCER_PROTOCOL_SLUG = "balancer";
const CHAIN_MAPPING = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "Binance",
};
const API_TIMEOUT_MS = 10000;
const MAX_BAR_LENGTH = 50;

function getThisWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  const monday = new Date(today);
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push({
      date: date,
      dateStr: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      timestamp: Math.floor(date.getTime() / 1000),
    });
  }
  
  return weekDates;
}

function findClosestDataPoint(dataArray, targetTimestamp, toleranceSeconds = 86400) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return null;
  }

  let closest = null;
  let minDiff = Infinity;

  for (const point of dataArray) {
    if (!point.date) continue;
    const timestamp = point.date;
    const diff = Math.abs(timestamp - targetTimestamp);

    if (timestamp <= targetTimestamp + toleranceSeconds && diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  if (!closest) {
    for (const point of dataArray) {
      if (!point.date) continue;
      const diff = Math.abs(point.date - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
  }

  return closest;
}

async function fetchBalancerTVLHistory() {
  try {
    const response = await axios.get(`${DEFILLAMA_API}/protocol/${BALANCER_PROTOCOL_SLUG}`, {
      timeout: API_TIMEOUT_MS,
    });
    return response.data;
  } catch (error) {
    console.error(chalk.red("Error fetching Balancer TVL history:"), error.message);
    return null;
  }
}

function processWeeklyTVLData(protocolData, weekDates) {
  if (!protocolData || !protocolData.chainTvls) {
    return {};
  }

  const weeklyData = {};

  for (const [chainKey, chainName] of Object.entries(CHAIN_MAPPING)) {
    const chainData = protocolData.chainTvls[chainName];
    if (!chainData || !Array.isArray(chainData.tvl)) continue;

    weeklyData[chainKey] = {
      name: chainName,
      daily: []
    };

    for (const dayInfo of weekDates) {
      const closestPoint = findClosestDataPoint(chainData.tvl, dayInfo.timestamp);
      const tvlValue = closestPoint?.totalLiquidityUSD || 0;

      weeklyData[chainKey].daily.push({
        date: dayInfo.dateStr,
        dayName: dayInfo.dayName,
        tvl: tvlValue,
      });
    }
  }

  return weeklyData;
}

function displayWeeklyTVL(weeklyData, weekDates) {
  console.log("\n" + "=".repeat(80));
  console.log(chalk.cyan.bold("  BALANCER - WEEKLY TVL TRACKER"));
  console.log("=".repeat(80) + "\n");

  const chains = Object.entries(weeklyData);
  if (chains.length === 0) {
    console.log(chalk.yellow("No TVL data available\n"));
    return;
  }

  for (const [chainKey, chainInfo] of chains) {
    if (chainInfo.daily.length === 0) continue;

    console.log(chalk.cyan.bold(`\n${chainInfo.name}`));
    console.log("─".repeat(80));

    const maxTVL = Math.max(...chainInfo.daily.map(d => d.tvl));

    for (const day of chainInfo.daily) {
      const barLength = maxTVL > 0 ? Math.floor((day.tvl / maxTVL) * MAX_BAR_LENGTH) : 0;
      const bar = "█".repeat(barLength);
      
      const dayLabel = day.dayName.padEnd(10);
      const dateLabel = day.date.padEnd(12);
      const tvlLabel = formatUSD(day.tvl).padStart(18);
      
      console.log(`${dayLabel} ${dateLabel} ${tvlLabel} ${chalk.green(bar)}`);
    }

    const weekStart = chainInfo.daily[0]?.tvl || 0;
    const weekEnd = chainInfo.daily[chainInfo.daily.length - 1]?.tvl || 0;
    const weekChange = weekStart > 0 ? ((weekEnd - weekStart) / weekStart) * 100 : 0;
    const changeColor = weekChange >= 0 ? chalk.green : chalk.red;
    const changeSymbol = weekChange >= 0 ? "+" : "";

    console.log("─".repeat(80));
    console.log(
      `Week Change: ${changeColor(`${changeSymbol}${weekChange.toFixed(2)}%`)} ` +
      `(${formatUSD(weekStart)} → ${formatUSD(weekEnd)})`
    );
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

async function exportToCSV(weeklyData) {
  const csvData = [];

  for (const [chainKey, chainInfo] of Object.entries(weeklyData)) {
    for (const day of chainInfo.daily) {
      csvData.push({
        chain: chainInfo.name,
        date: day.date,
        dayOfWeek: day.dayName,
        tvl: day.tvl,
      });
    }
  }

  if (csvData.length > 0) {
    await writeCSV("output/balancer-weekly-tvl.csv", csvData, [
      { id: "chain", title: "Chain" },
      { id: "date", title: "Date" },
      { id: "dayOfWeek", title: "Day" },
      { id: "tvl", title: "TVL (USD)" },
    ]);
  }
}

async function main() {
  console.log(chalk.cyan("\nFetching Balancer weekly TVL data from DefiLlama...\n"));

  const weekDates = getThisWeekDates();
  const protocolData = await fetchBalancerTVLHistory();

  if (!protocolData) {
    console.error(chalk.red("Failed to fetch Balancer TVL history"));
    process.exit(1);
  }

  const weeklyData = processWeeklyTVLData(protocolData, weekDates);
  displayWeeklyTVL(weeklyData, weekDates);
  await exportToCSV(weeklyData);

  console.log(chalk.green("REPORT COMPLETE: Weekly TVL analysis generated successfully"));
  console.log(chalk.gray(`CSV: output/balancer-weekly-tvl.csv\n`));
}

main().catch(console.error);
