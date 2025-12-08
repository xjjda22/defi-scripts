// Uniswap Weekly Fee Density Tracker - Tracks daily fee density stats for each day of this week

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

const DEFILLAMA_API = "https://api.llama.fi";

// Protocols to track
const PROTOCOLS = [
  { id: "uniswap-v2", name: "Uniswap V2", category: "AMM" },
  { id: "uniswap-v3", name: "Uniswap V3", category: "AMM" },
  { id: "uniswap-v4", name: "Uniswap V4", category: "AMM" },
  { id: "curve-dex", name: "Curve", category: "AMM" },
  { id: "aave-v3", name: "Aave V3", category: "Lending" },
  { id: "pancakeswap", name: "PancakeSwap", category: "AMM" },
];

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

// Get protocol metrics for a specific day
async function getProtocolMetricsForDay(protocolId, targetTimestamp) {
  try {
    // Get protocol data
    const protocolResponse = await axios.get(
      `${DEFILLAMA_API}/protocol/${protocolId}`,
      { timeout: 10000 }
    );

    // Get fees data
    const feesResponse = await axios.get(
      `${DEFILLAMA_API}/summary/fees/${protocolId}`,
      { timeout: 10000 }
    );

    // Try to get historical TVL
    const historicalTVL = protocolResponse.data.tvl || [];
    const chainTvls = protocolResponse.data.chainTvls || {};
    
    let tvl = 0;
    
    // Try chain-specific historical data first
    if (chainTvls && Object.keys(chainTvls).length > 0) {
      const firstChain = Object.keys(chainTvls)[0];
      if (Array.isArray(chainTvls[firstChain])) {
        const closestPoint = findClosestDataPoint(chainTvls[firstChain], targetTimestamp);
        if (closestPoint && Array.isArray(closestPoint) && closestPoint.length >= 2) {
          // Sum all chains for total TVL estimate
          let totalChainTVL = 0;
          for (const chainKey of Object.keys(chainTvls)) {
            if (Array.isArray(chainTvls[chainKey])) {
              const chainPoint = findClosestDataPoint(chainTvls[chainKey], targetTimestamp);
              if (chainPoint && Array.isArray(chainPoint) && chainPoint.length >= 2) {
                totalChainTVL += chainPoint[1] || 0;
              }
            }
          }
          tvl = totalChainTVL || closestPoint[1] || 0;
        }
      }
    }
    
    // Fallback to overall TVL array
    if (tvl === 0 && Array.isArray(historicalTVL)) {
      const closestPoint = findClosestDataPoint(historicalTVL, targetTimestamp);
      if (closestPoint) {
        tvl = closestPoint.totalLiquidityUSD || 
              (Array.isArray(closestPoint) ? closestPoint[1] : 0) ||
              closestPoint.value || 0;
      }
    }
    
    // Last fallback to current TVL
    if (tvl === 0) {
      tvl = protocolResponse.data.tvl || 0;
      if (typeof tvl !== 'number') {
        const currentChainTvls = protocolResponse.data.currentChainTvls || {};
        tvl = Object.values(currentChainTvls).reduce(
          (sum, val) => sum + (typeof val === 'number' ? val : 0), 0
        );
      }
    }

    // Get fees data - try historical if available
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

    // Calculate fee density (fees / TVL)
    const dailyDensity = tvl > 0 ? (fees24h / tvl) * 100 : 0;
    const annualizedDensity = dailyDensity * 365;

    return {
      protocolId,
      tvl,
      fees24h,
      dailyDensity,
      annualizedDensity,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch data for ${protocolId} on timestamp ${targetTimestamp}:`, error.message);
    return {
      protocolId,
      tvl: 0,
      fees24h: 0,
      dailyDensity: 0,
      annualizedDensity: 0,
    };
  }
}

// Get weekly stats for all protocols
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`📅 Fetching fee density data for ${dayInfo.dayName} (${dayInfo.dateStr})...`);
    const dayData = {
      date: dayInfo.dateStr,
      dayName: dayInfo.dayName,
      timestamp: dayInfo.timestamp,
      protocols: [],
    };

    for (const protocol of PROTOCOLS) {
      const metrics = await getProtocolMetricsForDay(protocol.id, dayInfo.timestamp);
      dayData.protocols.push({
        ...metrics,
        name: protocol.name,
        category: protocol.category,
      });

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    weeklyData.push(dayData);
  }

  return weeklyData;
}

async function generateReport() {
  printUniswapLogo("full");
  console.log(`\n💎 Uniswap Weekly Fee Density Tracker`);
  console.log(`====================================\n`);

  const weeklyData = await getWeeklyStats();

  if (weeklyData.length === 0) {
    console.log(`❌ No weekly data available.\n`);
    return;
  }

  // Calculate totals for each day
  const dailyTotals = weeklyData.map((dayData) => {
    const totals = {
      date: dayData.date,
      dayName: dayData.dayName,
      totalFees: 0,
      totalTVL: 0,
      avgDensity: 0,
    };

    dayData.protocols.forEach((protocol) => {
      totals.totalFees += protocol.fees24h;
      totals.totalTVL += protocol.tvl;
    });

    totals.avgDensity = totals.totalTVL > 0 
      ? (totals.totalFees / totals.totalTVL) * 100 
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

  // Find min and max
  const maxFeesDay = dailyTotals.reduce((max, day) => 
    day.totalFees > max.totalFees ? day : max, dailyTotals[0]);
  const minFeesDay = dailyTotals.reduce((min, day) => 
    day.totalFees < min.totalFees ? day : min, dailyTotals[0]);
  const maxDensityDay = dailyTotals.reduce((max, day) => 
    day.avgDensity > max.avgDensity ? day : max, dailyTotals[0]);

  console.log(`   Highest Daily Fees: ${formatUSD(maxFeesDay.totalFees)} (${maxFeesDay.dayName}, ${maxFeesDay.date})`);
  console.log(`   Lowest Daily Fees:  ${formatUSD(minFeesDay.totalFees)} (${minFeesDay.dayName}, ${minFeesDay.date})`);
  console.log(`   Highest Avg Density: ${maxDensityDay.avgDensity.toFixed(4)}% (${maxDensityDay.dayName}, ${maxDensityDay.date})\n`);

  // Daily Breakdown Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY FEE DENSITY BREAKDOWN                                                           ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ Total Fees    │ Total TVL     │ Avg Density   │ Change        ║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╣`);

  let previousDensity = null;
  dailyTotals.forEach((day) => {
    const change = previousDensity !== null 
      ? day.avgDensity - previousDensity 
      : 0;
    const changePercent = previousDensity !== null && previousDensity > 0
      ? ((change / previousDensity) * 100).toFixed(2)
      : "0.00";
    const changeStr = previousDensity !== null
      ? `${change >= 0 ? "+" : ""}${change.toFixed(4)}% (${changePercent}%)`
      : "—";

    const dayNameStr = day.dayName.substring(0, 9).padEnd(9);
    const dateStr = day.date.padEnd(10);
    const feesStr = formatUSD(day.totalFees).padEnd(14);
    const tvlStr = formatUSD(day.totalTVL).padEnd(13);
    const densityStr = `${day.avgDensity.toFixed(4)}%`.padEnd(13);
    const changeStrFormatted = changeStr.padEnd(13);

    console.log(`║ ${dayNameStr} │ ${dateStr} │ ${feesStr} │ ${tvlStr} │ ${densityStr} │ ${changeStrFormatted} ║`);

    previousDensity = day.avgDensity;
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╝\n`);

  // Protocol Breakdown by Day
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 FEE DENSITY BY PROTOCOL - DAILY BREAKDOWN                                               ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n`);

  for (const protocol of PROTOCOLS) {
    console.log(`   ${protocol.name}:`);
    let previousDensity = null;
    weeklyData.forEach((dayData) => {
      const protocolData = dayData.protocols.find(p => p.name === protocol.name);
      if (protocolData) {
        const change = previousDensity !== null 
          ? protocolData.dailyDensity - previousDensity 
          : 0;
        const changeStr = previousDensity !== null
          ? ` (${change >= 0 ? "+" : ""}${change.toFixed(4)}%)`
          : "";
        const flowEmoji = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";
        
        console.log(`      ${dayData.dayName.padEnd(9)} (${dayData.date}): Density ${protocolData.dailyDensity.toFixed(4)}% ${flowEmoji}${changeStr} | Fees: ${formatUSD(protocolData.fees24h)} | TVL: ${formatUSD(protocolData.tvl)}`);
        previousDensity = protocolData.dailyDensity;
      }
    });
    console.log(``);
  }

  // Weekly Trend Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY FEE DENSITY TREND                       ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const maxDensity = Math.max(...dailyTotals.map(d => d.avgDensity));
  const minDensity = Math.min(...dailyTotals.map(d => d.avgDensity));
  const range = maxDensity - minDensity;
  const maxBarLength = 50;

  dailyTotals.forEach((day) => {
    const share = range > 0 ? ((day.avgDensity - minDensity) / range) * 100 : 0;
    const barLength = Math.floor((share / 100) * maxBarLength);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxBarLength - barLength);
    console.log(`   ${day.dayName.padEnd(9)} ${day.avgDensity.toFixed(4)}% ${formatUSD(day.totalFees).padEnd(15)} │${bar}${emptyBar}│`);
  });

  console.log(`\n`);

  // Export to CSV
  const csvData = [];
  weeklyData.forEach((dayData) => {
    dayData.protocols.forEach((protocol) => {
      csvData.push({
        date: dayData.date,
        dayName: dayData.dayName,
        protocol: protocol.name,
        category: protocol.category,
        fees24h: protocol.fees24h,
        tvl: protocol.tvl,
        dailyDensity: protocol.dailyDensity,
        annualizedDensity: protocol.annualizedDensity,
      });
    });
  });

  await writeCSV(
    "output/uniswap-weekly-fee-density.csv",
    [
      { id: "date", title: "Date" },
      { id: "dayName", title: "Day" },
      { id: "protocol", title: "Protocol" },
      { id: "category", title: "Category" },
      { id: "fees24h", title: "24h Fees (USD)" },
      { id: "tvl", title: "TVL (USD)" },
      { id: "dailyDensity", title: "Daily Density (%)" },
      { id: "annualizedDensity", title: "Annualized Density (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Weekly fee density report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
