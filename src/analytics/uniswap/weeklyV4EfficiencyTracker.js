// Uniswap Weekly V4 Efficiency Tracker - Tracks daily V4 capital efficiency for each day of this week

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

// Get V4 data for a specific day
async function getV4DataForDay(targetTimestamp) {
  try {
    const response = await axios.get(`${DEFILLAMA_API}/protocol/uniswap-v4`, {
      timeout: 10000,
    });

    // Try to get historical TVL
    const historicalTVL = response.data.tvl || [];
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
      if (typeof response.data.tvl === 'number') {
        tvl = response.data.tvl;
      } else {
        const chainTvls = response.data.currentChainTvls || {};
        tvl = Object.values(chainTvls).reduce(
          (sum, val) => sum + (typeof val === 'number' ? val : 0), 0
        );
      }
    }

    // Try to get historical volume
    let volume24h = 0;
    if (response.data.volume24h) {
      volume24h = response.data.volume24h;
    } else {
      // Try to estimate from fees
      try {
        const feesResponse = await axios.get(
          `${DEFILLAMA_API}/summary/fees/uniswap-v4`,
          { timeout: 10000 }
        );
        const feesChart = feesResponse.data.totalDataChart || [];
        if (Array.isArray(feesChart) && feesChart.length > 0) {
          const closestPoint = findClosestDataPoint(feesChart, targetTimestamp);
          if (closestPoint && Array.isArray(closestPoint) && closestPoint.length >= 2) {
            const fees24h = closestPoint[1] || 0;
            volume24h = fees24h * 100; // Approximate volume from fees
          }
        }
        if (volume24h === 0) {
          volume24h = (feesResponse.data.total24h || 0) * 100;
        }
      } catch (error) {
        // Silently fail
      }
    }

    // Get chain breakdown
    const chainTvls = response.data.currentChainTvls || {};
    const chainBreakdown = Object.entries(chainTvls)
      .map(([chain, value]) => ({ chain, tvl: typeof value === 'number' ? value : 0 }))
      .filter((item) => item.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl);

    const efficiencyRatio = tvl > 0 ? (volume24h / tvl) * 100 : 0;

    return {
      tvl,
      volume24h,
      efficiencyRatio,
      chainBreakdown,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch V4 data on timestamp ${targetTimestamp}:`, error.message);
    return {
      tvl: 0,
      volume24h: 0,
      efficiencyRatio: 0,
      chainBreakdown: [],
    };
  }
}

// Get weekly stats
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`📅 Fetching V4 efficiency data for ${dayInfo.dayName} (${dayInfo.dateStr})...`);
    const data = await getV4DataForDay(dayInfo.timestamp);
    
    weeklyData.push({
      date: dayInfo.dateStr,
      dayName: dayInfo.dayName,
      timestamp: dayInfo.timestamp,
      ...data,
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return weeklyData;
}

async function generateReport() {
  printUniswapLogo("full");
  console.log(`\n⚡ Uniswap Weekly V4 Efficiency Tracker`);
  console.log(`=====================================\n`);

  const weeklyData = await getWeeklyStats();

  if (weeklyData.length === 0) {
    console.log(`❌ No weekly data available.\n`);
    return;
  }

  // Summary Section
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const weekStart = weeklyData[0].date;
  const weekEnd = weeklyData[weeklyData.length - 1].date;
  console.log(`   Week: ${weekStart} to ${weekEnd}\n`);

  // Find min and max
  const maxTVLDay = weeklyData.reduce((max, day) => 
    day.tvl > max.tvl ? day : max, weeklyData[0]);
  const minTVLDay = weeklyData.reduce((min, day) => 
    day.tvl < min.tvl ? day : min, weeklyData[0]);
  const maxEfficiencyDay = weeklyData.reduce((max, day) => 
    day.efficiencyRatio > max.efficiencyRatio ? day : max, weeklyData[0]);

  console.log(`   Highest TVL: ${formatUSD(maxTVLDay.tvl)} (${maxTVLDay.dayName}, ${maxTVLDay.date})`);
  console.log(`   Lowest TVL:  ${formatUSD(minTVLDay.tvl)} (${minTVLDay.dayName}, ${minTVLDay.date})`);
  console.log(`   Highest Efficiency: ${maxEfficiencyDay.efficiencyRatio.toFixed(2)}% (${maxEfficiencyDay.dayName}, ${maxEfficiencyDay.date})\n`);

  // Calculate weekly growth
  const mondayTVL = weeklyData[0].tvl;
  const sundayTVL = weeklyData[weeklyData.length - 1].tvl;
  const weeklyGrowth = mondayTVL > 0 
    ? ((sundayTVL - mondayTVL) / mondayTVL) * 100 
    : 0;
  console.log(`   Weekly TVL Growth: ${weeklyGrowth >= 0 ? "+" : ""}${weeklyGrowth.toFixed(2)}%\n`);

  // Daily Breakdown Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY V4 EFFICIENCY BREAKDOWN                                                          ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ TVL            │ Volume 24h    │ Efficiency    │ Change        ║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╣`);

  let previousEfficiency = null;
  weeklyData.forEach((day) => {
    const change = previousEfficiency !== null 
      ? day.efficiencyRatio - previousEfficiency 
      : 0;
    const changePercent = previousEfficiency !== null && previousEfficiency > 0
      ? ((change / previousEfficiency) * 100).toFixed(2)
      : "0.00";
    const changeStr = previousEfficiency !== null
      ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}% (${changePercent}%)`
      : "—";

    const dayNameStr = day.dayName.substring(0, 9).padEnd(9);
    const dateStr = day.date.padEnd(10);
    const tvlStr = formatUSD(day.tvl).padEnd(14);
    const volumeStr = formatUSD(day.volume24h).padEnd(13);
    const efficiencyStr = `${day.efficiencyRatio.toFixed(2)}%`.padEnd(13);
    const changeStrFormatted = changeStr.padEnd(13);

    console.log(`║ ${dayNameStr} │ ${dateStr} │ ${tvlStr} │ ${volumeStr} │ ${efficiencyStr} │ ${changeStrFormatted} ║`);

    previousEfficiency = day.efficiencyRatio;
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╝\n`);

  // Chain Breakdown (using latest day's data)
  const latestDay = weeklyData[weeklyData.length - 1];
  if (latestDay.chainBreakdown.length > 0) {
    console.log(`╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║              🌐 V4 TVL BY CHAIN (Latest: ${latestDay.date})              ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
    
    latestDay.chainBreakdown.slice(0, 5).forEach((chain, index) => {
      const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
      const percentage = latestDay.tvl > 0 
        ? ((chain.tvl / latestDay.tvl) * 100).toFixed(2) 
        : "0.00";
      console.log(`${emoji} ${(index + 1)}. ${chain.chain.padEnd(15)}: ${formatUSD(chain.tvl)} (${percentage}%)`);
    });
    console.log(``);
  }

  // Weekly Trend Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY V4 EFFICIENCY TREND                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const maxEfficiency = Math.max(...weeklyData.map(d => d.efficiencyRatio));
  const minEfficiency = Math.min(...weeklyData.map(d => d.efficiencyRatio));
  const range = maxEfficiency - minEfficiency;
  const maxBarLength = 50;

  weeklyData.forEach((day) => {
    const share = range > 0 ? ((day.efficiencyRatio - minEfficiency) / range) * 100 : 0;
    const barLength = Math.floor((share / 100) * maxBarLength);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxBarLength - barLength);
    console.log(`   ${day.dayName.padEnd(9)} ${day.efficiencyRatio.toFixed(2)}% ${formatUSD(day.tvl).padEnd(15)} │${bar}${emptyBar}│`);
  });

  console.log(`\n`);

  // Export to CSV
  const csvData = weeklyData.map((day) => ({
    date: day.date,
    dayName: day.dayName,
    tvl: day.tvl,
    volume24h: day.volume24h,
    efficiencyRatio: day.efficiencyRatio.toFixed(2),
  }));

  await writeCSV(
    "output/uniswap-weekly-v4-efficiency.csv",
    [
      { id: "date", title: "Date" },
      { id: "dayName", title: "Day" },
      { id: "tvl", title: "TVL (USD)" },
      { id: "volume24h", title: "24h Volume (USD)" },
      { id: "efficiencyRatio", title: "Efficiency Ratio (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Weekly V4 efficiency report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
