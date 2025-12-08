// Uniswap Weekly Efficiency Tracker - Tracks daily efficiency ratios (volume/TVL) for each day of this week

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

const DEFILLAMA_API = "https://api.llama.fi";

// Get dates for this week (Monday to Sunday)
function getThisWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday of this week
  const monday = new Date(today);
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  // Generate all 7 days of the week
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

// Find the closest data point for a given timestamp
function findClosestDataPoint(dataArray, targetTimestamp) {
  if (!dataArray || dataArray.length === 0) return null;
  
  let closest = null;
  let minDiff = Infinity;
  
  for (const point of dataArray) {
    const pointTimestamp = point.date || point[0];
    if (!pointTimestamp) continue;
    
    const diff = Math.abs(pointTimestamp - targetTimestamp);
    
    if (pointTimestamp <= targetTimestamp + 86400) { // Allow 1 day tolerance
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
  }
  
  if (!closest) {
    for (const point of dataArray) {
      const pointTimestamp = point.date || point[0];
      if (!pointTimestamp) continue;
      const diff = Math.abs(pointTimestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
  }
  
  return closest;
}

// Get version data for a specific day
async function getVersionDataForDay(version, targetTimestamp) {
  try {
    // Get fees/volume data
    const feesResponse = await axios.get(
      `${DEFILLAMA_API}/summary/fees/uniswap-${version}`,
      { timeout: 10000 }
    );

    // Get TVL data
    const tvlResponse = await axios.get(
      `${DEFILLAMA_API}/protocol/uniswap-${version}`,
      { timeout: 10000 }
    );

    // Try to get historical fees/volume
    const feesChart = feesResponse.data.totalDataChart || [];
    let fees24h = 0;
    
    if (Array.isArray(feesChart) && feesChart.length > 0) {
      const closestPoint = findClosestDataPoint(feesChart, targetTimestamp);
      if (closestPoint && Array.isArray(closestPoint) && closestPoint.length >= 2) {
        fees24h = closestPoint[1] || 0;
      }
    }
    
    // Fallback to current fees
    if (fees24h === 0) {
      fees24h = feesResponse.data.total24h || 0;
    }
    
    const volume24h = fees24h * 100; // Approximate volume from fees (assuming 1% fee)
    
    // Try to get historical TVL
    const historicalTVL = tvlResponse.data.tvl || [];
    let tvl = 0;
    
    if (Array.isArray(historicalTVL) && historicalTVL.length > 0) {
      const closestPoint = findClosestDataPoint(historicalTVL, targetTimestamp);
      if (closestPoint) {
        tvl = closestPoint.totalLiquidityUSD || 
              (Array.isArray(closestPoint) ? closestPoint[1] : 0) ||
              closestPoint.value || 0;
      }
    }
    
    // Fallback to current TVL
    if (tvl === 0) {
      if (typeof tvlResponse.data.tvl === 'number') {
        tvl = tvlResponse.data.tvl;
      } else {
        const chainTvls = tvlResponse.data.currentChainTvls || {};
        tvl = Object.values(chainTvls).reduce(
          (sum, val) => sum + (typeof val === 'number' ? val : 0), 0
        );
      }
    }

    const efficiencyRatio = tvl > 0 ? (volume24h / tvl) * 100 : 0;

    return {
      version: version.toUpperCase(),
      volume24h,
      tvl,
      efficiencyRatio,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch data for ${version} on timestamp ${targetTimestamp}:`, error.message);
    return {
      version: version.toUpperCase(),
      volume24h: 0,
      tvl: 0,
      efficiencyRatio: 0,
    };
  }
}

// Get weekly stats for all versions
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  const versions = ["v2", "v3", "v4"];
  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`📅 Fetching efficiency data for ${dayInfo.dayName} (${dayInfo.dateStr})...`);
    const dayData = {
      date: dayInfo.dateStr,
      dayName: dayInfo.dayName,
      timestamp: dayInfo.timestamp,
      versions: [],
    };

    for (const version of versions) {
      const data = await getVersionDataForDay(version, dayInfo.timestamp);
      dayData.versions.push(data);

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    weeklyData.push(dayData);
  }

  return weeklyData;
}

async function generateReport() {
  printUniswapLogo("full");
  console.log(`\n📊 Uniswap Weekly Efficiency Tracker`);
  console.log(`===================================\n`);

  const weeklyData = await getWeeklyStats();

  if (weeklyData.length === 0) {
    console.log(`❌ No weekly data available.\n`);
    return;
  }

  // Calculate daily totals
  const dailyTotals = weeklyData.map((dayData) => {
    const totals = {
      date: dayData.date,
      dayName: dayData.dayName,
      totalVolume: 0,
      totalTVL: 0,
      avgEfficiency: 0,
    };

    dayData.versions.forEach((version) => {
      totals.totalVolume += version.volume24h;
      totals.totalTVL += version.tvl;
    });

    totals.avgEfficiency = totals.totalTVL > 0 
      ? (totals.totalVolume / totals.totalTVL) * 100 
      : 0;

    return totals;
  });

  // Summary Section
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const weekStart = weeklyData[0].date;
  const weekEnd = weeklyData[weeklyData.length - 1].date;
  console.log(`   Week: ${weekStart} to ${weekEnd}\n`);

  // Find best and worst efficiency days
  const maxEfficiencyDay = dailyTotals.reduce((max, day) => 
    day.avgEfficiency > max.avgEfficiency ? day : max, dailyTotals[0]);
  const minEfficiencyDay = dailyTotals.reduce((min, day) => 
    day.avgEfficiency < min.avgEfficiency ? day : min, dailyTotals[0]);

  console.log(`   Highest Efficiency: ${maxEfficiencyDay.avgEfficiency.toFixed(2)}% (${maxEfficiencyDay.dayName}, ${maxEfficiencyDay.date})`);
  console.log(`   Lowest Efficiency:  ${minEfficiencyDay.avgEfficiency.toFixed(2)}% (${minEfficiencyDay.dayName}, ${minEfficiencyDay.date})\n`);

  // Daily Breakdown Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY EFFICIENCY BREAKDOWN                                                              ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ Total Volume   │ Total TVL     │ Avg Efficiency │ V2 Eff.      │ V3 Eff.      │ V4 Eff.      ║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╣`);

  dailyTotals.forEach((day, index) => {
    const dayData = weeklyData[index];
    const v2 = dayData.versions.find(v => v.version === "V2")?.efficiencyRatio || 0;
    const v3 = dayData.versions.find(v => v.version === "V3")?.efficiencyRatio || 0;
    const v4 = dayData.versions.find(v => v.version === "V4")?.efficiencyRatio || 0;

    const dayNameStr = day.dayName.substring(0, 9).padEnd(9);
    const dateStr = day.date.padEnd(10);
    const volumeStr = formatUSD(day.totalVolume).padEnd(14);
    const tvlStr = formatUSD(day.totalTVL).padEnd(13);
    const avgEffStr = `${day.avgEfficiency.toFixed(2)}%`.padEnd(13);
    const v2Str = `${v2.toFixed(2)}%`.padEnd(13);
    const v3Str = `${v3.toFixed(2)}%`.padEnd(13);
    const v4Str = `${v4.toFixed(2)}%`.padEnd(13);

    console.log(`║ ${dayNameStr} │ ${dateStr} │ ${volumeStr} │ ${tvlStr} │ ${avgEffStr} │ ${v2Str} │ ${v3Str} │ ${v4Str} ║`);
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╝\n`);

  // Version Breakdown by Day
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📈 EFFICIENCY BY VERSION - DAILY BREAKDOWN                                                ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n`);

  const versions = ["V2", "V3", "V4"];
  for (const version of versions) {
    console.log(`   ${version}:`);
    let previousEfficiency = null;
    weeklyData.forEach((dayData) => {
      const versionData = dayData.versions.find(v => v.version === version);
      if (versionData) {
        const change = previousEfficiency !== null 
          ? versionData.efficiencyRatio - previousEfficiency 
          : 0;
        const changeStr = previousEfficiency !== null
          ? ` (${change >= 0 ? "+" : ""}${change.toFixed(2)}%)`
          : "";
        const flowEmoji = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";
        
        console.log(`      ${dayData.dayName.padEnd(9)} (${dayData.date}): ${versionData.efficiencyRatio.toFixed(2)}% ${flowEmoji}${changeStr} | Vol: ${formatUSD(versionData.volume24h)} | TVL: ${formatUSD(versionData.tvl)}`);
        previousEfficiency = versionData.efficiencyRatio;
      }
    });
    console.log(``);
  }

  // Weekly Trend Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY EFFICIENCY TREND                       ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const maxEfficiency = Math.max(...dailyTotals.map(d => d.avgEfficiency));
  const minEfficiency = Math.min(...dailyTotals.map(d => d.avgEfficiency));
  const range = maxEfficiency - minEfficiency;
  const maxBarLength = 50;

  dailyTotals.forEach((day) => {
    const share = range > 0 ? ((day.avgEfficiency - minEfficiency) / range) * 100 : 0;
    const barLength = Math.floor((share / 100) * maxBarLength);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxBarLength - barLength);
    console.log(`   ${day.dayName.padEnd(9)} ${day.avgEfficiency.toFixed(2)}% ${formatUSD(day.totalVolume).padEnd(15)} │${bar}${emptyBar}│`);
  });

  console.log(`\n`);

  // Export to CSV
  const csvData = [];
  weeklyData.forEach((dayData) => {
    dayData.versions.forEach((version) => {
      csvData.push({
        date: dayData.date,
        dayName: dayData.dayName,
        version: version.version,
        volume24h: version.volume24h,
        tvl: version.tvl,
        efficiencyRatio: version.efficiencyRatio.toFixed(2),
      });
    });
  });

  await writeCSV(
    "output/uniswap-weekly-efficiency.csv",
    [
      { id: "date", title: "Date" },
      { id: "dayName", title: "Day" },
      { id: "version", title: "Version" },
      { id: "volume24h", title: "24h Volume (USD)" },
      { id: "tvl", title: "TVL (USD)" },
      { id: "efficiencyRatio", title: "Efficiency Ratio (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Weekly efficiency report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
