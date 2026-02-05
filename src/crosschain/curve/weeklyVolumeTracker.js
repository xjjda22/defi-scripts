/**
 * Curve Weekly Volume Tracker
 * Tracks daily trading volume stats across Curve Finance for multiple chains
 */

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const chalk = require("chalk");

const DEFILLAMA_API = "https://api.llama.fi";
const CURVE_SLUG = "curve-dex";
const CHAIN_MAPPING = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "BSC",
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
      dateStr: date.toISOString().split("T")[0],
      dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
      timestamp: Math.floor(date.getTime() / 1000),
    });
  }

  return weekDates;
}

async function fetchCurveVolumeHistory() {
  try {
    const response = await axios.get(
      `${DEFILLAMA_API}/summary/dexs/${CURVE_SLUG}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=false`,
      {
        timeout: API_TIMEOUT_MS,
      }
    );
    return response.data;
  } catch (error) {
    console.error(chalk.red("Error fetching Curve volume history:"), error.message);
    return null;
  }
}

function processWeeklyVolumeData(dexData, weekDates) {
  if (!dexData || !dexData.totalDataChartBreakdown) {
    return {};
  }

  const weeklyData = {};
  const chainVolumeData = {};

  for (const dayData of dexData.totalDataChartBreakdown) {
    if (!dayData.date) continue;
    const timestamp = typeof dayData.date === "string" ? Date.parse(dayData.date) / 1000 : dayData.date;
    const date = new Date(timestamp * 1000).toISOString().split("T")[0];

    for (const [chainKey, chainName] of Object.entries(CHAIN_MAPPING)) {
      if (!chainVolumeData[chainKey]) {
        chainVolumeData[chainKey] = [];
      }

      const volume = dayData[chainName] || 0;
      chainVolumeData[chainKey].push({ date, volume });
    }
  }

  for (const [chainKey, chainName] of Object.entries(CHAIN_MAPPING)) {
    const chainData = chainVolumeData[chainKey];
    if (!chainData || chainData.length === 0) continue;

    weeklyData[chainKey] = {
      name: chainName,
      daily: [],
    };

    for (const dayInfo of weekDates) {
      const dayData = chainData.find(d => d.date === dayInfo.dateStr);
      const volumeValue = dayData?.volume || 0;

      weeklyData[chainKey].daily.push({
        date: dayInfo.dateStr,
        dayName: dayInfo.dayName,
        volume: volumeValue,
      });
    }
  }

  return weeklyData;
}

function displayWeeklyVolume(weeklyData, weekDates) {
  console.log("\n" + "=".repeat(80));
  console.log(chalk.cyan.bold("  CURVE FINANCE - WEEKLY VOLUME TRACKER"));
  console.log("=".repeat(80) + "\n");

  const chains = Object.entries(weeklyData);
  if (chains.length === 0) {
    console.log(chalk.yellow("No volume data available\n"));
    return;
  }

  for (const [chainKey, chainInfo] of chains) {
    if (chainInfo.daily.length === 0) continue;

    console.log(chalk.cyan.bold(`\n${chainInfo.name}`));
    console.log("─".repeat(80));

    const maxVolume = Math.max(...chainInfo.daily.map(d => d.volume));
    let weekTotal = 0;

    for (const day of chainInfo.daily) {
      weekTotal += day.volume;
      const barLength = maxVolume > 0 ? Math.floor((day.volume / maxVolume) * MAX_BAR_LENGTH) : 0;
      const bar = "█".repeat(barLength);

      const dayLabel = day.dayName.padEnd(10);
      const dateLabel = day.date.padEnd(12);
      const volumeLabel = formatUSD(day.volume).padStart(18);

      console.log(`${dayLabel} ${dateLabel} ${volumeLabel} ${chalk.green(bar)}`);
    }

    const avgDaily = weekTotal / 7;

    console.log("─".repeat(80));
    console.log(`Week Total: ${chalk.green(formatUSD(weekTotal))} | Daily Avg: ${chalk.cyan(formatUSD(avgDaily))}`);
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
        volume: day.volume,
      });
    }
  }

  if (csvData.length > 0) {
    await writeCSV("output/curve-weekly-volume.csv", csvData, [
      { id: "chain", title: "Chain" },
      { id: "date", title: "Date" },
      { id: "dayOfWeek", title: "Day" },
      { id: "volume", title: "Volume (USD)" },
    ]);
  }
}

async function main() {
  console.log(chalk.cyan("\nFetching Curve weekly volume data from DefiLlama...\n"));

  const weekDates = getThisWeekDates();
  const dexData = await fetchCurveVolumeHistory();

  if (!dexData) {
    console.error(chalk.red("Failed to fetch Curve volume history"));
    process.exit(1);
  }

  const weeklyData = processWeeklyVolumeData(dexData, weekDates);
  displayWeeklyVolume(weeklyData, weekDates);
  await exportToCSV(weeklyData);

  console.log(chalk.green("REPORT COMPLETE: Weekly volume analysis generated successfully"));
  console.log(chalk.gray(`CSV: output/curve-weekly-volume.csv\n`));
}

main().catch(console.error);
