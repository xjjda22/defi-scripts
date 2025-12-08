// Uniswap Weekly Milestone Tracker - Tracks daily growth and milestone progress for each day of this week

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

// Find ATH from historical data
function findATH(tvlData) {
  if (!tvlData || tvlData.length === 0) {
    return { value: 0, date: null };
  }

  let ath = { value: 0, date: null };
  tvlData.forEach((item) => {
    const value = item.totalLiquidityUSD || (Array.isArray(item) ? item[1] : 0) || item.value || 0;
    const timestamp = item.date || (Array.isArray(item) ? item[0] : null);
    if (value > ath.value && timestamp) {
      ath = {
        value,
        date: new Date(timestamp * 1000).toISOString().split("T")[0],
      };
    }
  });

  return ath;
}

// Get version data for a specific day
async function getVersionDataForDay(version, targetTimestamp) {
  try {
    const response = await axios.get(
      `${DEFILLAMA_API}/protocol/uniswap-${version}`,
      { timeout: 10000 }
    );

    const tvlData = response.data.tvl || [];
    const chainTvls = response.data.chainTvls || {};
    
    // Find TVL for the target day
    let dayTVL = 0;
    
    if (Array.isArray(tvlData) && tvlData.length > 0) {
      const closestPoint = findClosestDataPoint(tvlData, targetTimestamp);
      if (closestPoint) {
        dayTVL = closestPoint.totalLiquidityUSD || 
                (Array.isArray(closestPoint) ? closestPoint[1] : 0) ||
                closestPoint.value || 0;
      }
    }
    
    // Fallback to current TVL
    if (dayTVL === 0) {
      const currentChainTvls = response.data.currentChainTvls || {};
      dayTVL = Object.values(currentChainTvls).reduce(
        (sum, val) => sum + (typeof val === 'number' ? val : 0), 0
      );
    }

    // Get ATH from all historical data
    const ath = findATH(tvlData);

    return {
      version: version.toUpperCase(),
      tvl: dayTVL,
      athValue: ath.value,
      athDate: ath.date,
      distanceFromATH: ath.value > 0 ? ((dayTVL - ath.value) / ath.value) * 100 : 0,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch data for ${version} on timestamp ${targetTimestamp}:`, error.message);
    return {
      version: version.toUpperCase(),
      tvl: 0,
      athValue: 0,
      athDate: null,
      distanceFromATH: 0,
    };
  }
}

// Get weekly stats for all versions
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  const versions = ["v2", "v3", "v4"];
  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`📅 Fetching milestone data for ${dayInfo.dayName} (${dayInfo.dateStr})...`);
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
  console.log(`\n🏆 Uniswap Weekly Milestone Tracker`);
  console.log(`===================================\n`);

  const weeklyData = await getWeeklyStats();

  if (weeklyData.length === 0) {
    console.log(`❌ No weekly data available.\n`);
    return;
  }

  // Calculate daily totals and growth
  const dailyTotals = weeklyData.map((dayData, index) => {
    const totalTVL = dayData.versions.reduce((sum, v) => sum + v.tvl, 0);
    const previousDay = index > 0 ? weeklyData[index - 1] : null;
    const previousTotal = previousDay 
      ? previousDay.versions.reduce((sum, v) => sum + v.tvl, 0) 
      : 0;
    
    const dailyGrowth = previousTotal > 0 
      ? ((totalTVL - previousTotal) / previousTotal) * 100 
      : 0;

    return {
      date: dayData.date,
      dayName: dayData.dayName,
      totalTVL,
      dailyGrowth,
      versions: dayData.versions,
    };
  });

  // Summary Section
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const weekStart = weeklyData[0].date;
  const weekEnd = weeklyData[weeklyData.length - 1].date;
  console.log(`   Week: ${weekStart} to ${weekEnd}\n`);

  const mondayTVL = dailyTotals[0].totalTVL;
  const sundayTVL = dailyTotals[dailyTotals.length - 1].totalTVL;
  const weeklyGrowth = mondayTVL > 0 
    ? ((sundayTVL - mondayTVL) / mondayTVL) * 100 
    : 0;

  console.log(`   Monday TVL: ${formatUSD(mondayTVL)}`);
  console.log(`   Sunday TVL: ${formatUSD(sundayTVL)}`);
  console.log(`   Weekly Growth: ${weeklyGrowth >= 0 ? "+" : ""}${weeklyGrowth.toFixed(2)}%\n`);

  // Find highest and lowest days
  const maxDay = dailyTotals.reduce((max, day) => 
    day.totalTVL > max.totalTVL ? day : max, dailyTotals[0]);
  const minDay = dailyTotals.reduce((min, day) => 
    day.totalTVL < min.totalTVL ? day : min, dailyTotals[0]);

  console.log(`   Highest TVL: ${formatUSD(maxDay.totalTVL)} (${maxDay.dayName}, ${maxDay.date})`);
  console.log(`   Lowest TVL:  ${formatUSD(minDay.totalTVL)} (${minDay.dayName}, ${minDay.date})\n`);

  // Daily Breakdown Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY MILESTONE BREAKDOWN                                                              ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ Total TVL      │ Daily Growth   │ V2 TVL        │ V3 TVL        │ V4 TVL        ║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╣`);

  dailyTotals.forEach((day) => {
    const v2 = day.versions.find(v => v.version === "V2")?.tvl || 0;
    const v3 = day.versions.find(v => v.version === "V3")?.tvl || 0;
    const v4 = day.versions.find(v => v.version === "V4")?.tvl || 0;
    
    const growthStr = day.dailyGrowth !== 0
      ? `${day.dailyGrowth >= 0 ? "+" : ""}${day.dailyGrowth.toFixed(2)}%`
      : "—";

    const dayNameStr = day.dayName.substring(0, 9).padEnd(9);
    const dateStr = day.date.padEnd(10);
    const totalStr = formatUSD(day.totalTVL).padEnd(14);
    const growthStrFormatted = growthStr.padEnd(13);
    const v2Str = formatUSD(v2).padEnd(13);
    const v3Str = formatUSD(v3).padEnd(13);
    const v4Str = formatUSD(v4).padEnd(13);

    console.log(`║ ${dayNameStr} │ ${dateStr} │ ${totalStr} │ ${growthStrFormatted} │ ${v2Str} │ ${v3Str} │ ${v4Str} ║`);
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╝\n`);

  // Version Breakdown by Day
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          🏆 VERSION MILESTONES - DAILY BREAKDOWN                                                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n`);

  const versions = ["V2", "V3", "V4"];
  for (const version of versions) {
    console.log(`   ${version}:`);
    let previousTVL = null;
    weeklyData.forEach((dayData) => {
      const versionData = dayData.versions.find(v => v.version === version);
      if (versionData) {
        const change = previousTVL !== null 
          ? versionData.tvl - previousTVL 
          : 0;
        const changePercent = previousTVL !== null && previousTVL > 0
          ? ((change / previousTVL) * 100).toFixed(2)
          : "0.00";
        const changeStr = previousTVL !== null
          ? ` (${change >= 0 ? "+" : ""}${formatUSD(change)}, ${changePercent}%)`
          : "";
        const flowEmoji = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";
        const athEmoji = versionData.distanceFromATH >= -5 ? "🚀" : "📉";
        
        console.log(`      ${dayData.dayName.padEnd(9)} (${dayData.date}): ${formatUSD(versionData.tvl).padEnd(15)} ${flowEmoji}${changeStr}`);
        if (versionData.athValue > 0) {
          console.log(`         ATH: ${formatUSD(versionData.athValue)} | Distance: ${athEmoji} ${versionData.distanceFromATH >= 0 ? "+" : ""}${versionData.distanceFromATH.toFixed(2)}%`);
        }
        previousTVL = versionData.tvl;
      }
    });
    console.log(``);
  }

  // Weekly Trend Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY TVL TREND                               ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const maxTVL = Math.max(...dailyTotals.map(d => d.totalTVL));
  const minTVL = Math.min(...dailyTotals.map(d => d.totalTVL));
  const range = maxTVL - minTVL;
  const maxBarLength = 50;

  dailyTotals.forEach((day) => {
    const share = range > 0 ? ((day.totalTVL - minTVL) / range) * 100 : 0;
    const barLength = Math.floor((share / 100) * maxBarLength);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxBarLength - barLength);
    console.log(`   ${day.dayName.padEnd(9)} ${formatUSD(day.totalTVL).padEnd(15)} │${bar}${emptyBar}│ ${day.dailyGrowth >= 0 ? "+" : ""}${day.dailyGrowth.toFixed(2)}%`);
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
        tvl: version.tvl,
        athValue: version.athValue,
        athDate: version.athDate || "N/A",
        distanceFromATH: version.distanceFromATH.toFixed(2),
      });
    });
  });

  await writeCSV(
    "output/uniswap-weekly-milestones.csv",
    [
      { id: "date", title: "Date" },
      { id: "dayName", title: "Day" },
      { id: "version", title: "Version" },
      { id: "tvl", title: "TVL (USD)" },
      { id: "athValue", title: "ATH Value (USD)" },
      { id: "athDate", title: "ATH Date" },
      { id: "distanceFromATH", title: "Distance from ATH (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Weekly milestone report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
