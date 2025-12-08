// Uniswap Weekly Liquidity Tracker - Tracks daily liquidity/TVL changes for each day of this week

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

// DefiLlama API endpoints
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
    // Handle different data structures: { date: timestamp, ... } or [timestamp, value]
    const pointTimestamp = point.date || point[0];
    if (!pointTimestamp) continue;
    
    const diff = Math.abs(pointTimestamp - targetTimestamp);
    
    // Prefer points on or before the target date, but allow 1 day tolerance
    if (pointTimestamp <= targetTimestamp + 86400) {
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
  }
  
  // If no point found within tolerance, use the absolute closest
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

// Get liquidity/TVL data for a specific day
async function getUniswapLiquidityForDay(chainName, targetTimestamp) {
  try {
    const protocols = ["uniswap-v1", "uniswap-v2", "uniswap-v3", "uniswap-v4"];
    const tvlData = {};

    for (const protocol of protocols) {
      try {
        const response = await axios.get(`${DEFILLAMA_API}/protocol/${protocol}`, {
          timeout: 10000,
        });

        // Try to get chain-specific historical data from chainTvls
        const chainTvls = response.data.chainTvls || {};
        let chainTVL = 0;
        
        if (chainTvls[chainName] && Array.isArray(chainTvls[chainName])) {
          // Chain-specific historical data available
          const closestPoint = findClosestDataPoint(chainTvls[chainName], targetTimestamp);
          if (closestPoint) {
            // If array format [timestamp, value], extract value
            if (Array.isArray(closestPoint) && closestPoint.length >= 2) {
              chainTVL = closestPoint[1] || 0;
            } else if (closestPoint.totalLiquidityUSD) {
              chainTVL = closestPoint.totalLiquidityUSD;
            } else if (closestPoint.value) {
              chainTVL = closestPoint.value;
            }
          }
        }
        
        // Fallback: try overall TVL array and use current chain proportion
        if (chainTVL === 0) {
          const historicalTVL = response.data.tvl || [];
          const closestPoint = findClosestDataPoint(historicalTVL, targetTimestamp);
          
          if (closestPoint) {
            const totalTVL = closestPoint.totalLiquidityUSD || 
                           (Array.isArray(closestPoint) ? closestPoint[1] : 0) ||
                           closestPoint.value || 0;
            
            // Estimate chain proportion based on current chain TVL ratio
            const currentChainTVL = response.data.currentChainTvls?.[chainName] || 0;
            const currentTotalTVL = Object.values(response.data.currentChainTvls || {}).reduce(
              (sum, val) => sum + (typeof val === 'number' ? val : 0), 0
            );
            
            if (currentTotalTVL > 0 && totalTVL > 0) {
              const chainProportion = currentChainTVL / currentTotalTVL;
              chainTVL = totalTVL * chainProportion;
            } else {
              // Last fallback: use current chain TVL
              chainTVL = currentChainTVL;
            }
          } else {
            // No historical data found, use current chain TVL
            chainTVL = response.data.currentChainTvls?.[chainName] || 0;
          }
        }
        
        tvlData[protocol] = chainTVL;
      } catch (error) {
        // Silently skip if protocol doesn't exist or has no data
        tvlData[protocol] = 0;
      }
    }

    const v1 = tvlData["uniswap-v1"] || 0;
    const v2 = tvlData["uniswap-v2"] || 0;
    const v3 = tvlData["uniswap-v3"] || 0;
    const v4 = tvlData["uniswap-v4"] || 0;

    return {
      chain: chainName,
      v1: v1,
      v2: v2,
      v3: v3,
      v4: v4,
      total: v1 + v2 + v3 + v4,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch liquidity for ${chainName} on timestamp ${targetTimestamp}:`, error.message);
    return {
      chain: chainName,
      v1: 0,
      v2: 0,
      v3: 0,
      v4: 0,
      total: 0,
    };
  }
}

// Get weekly stats for all chains
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  const chainMapping = {
    ethereum: "Ethereum",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    base: "Base",
    polygon: "Polygon",
    bsc: "Binance",
  };

  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`📅 Fetching liquidity data for ${dayInfo.dayName} (${dayInfo.dateStr})...`);
    const dayData = {
      date: dayInfo.dateStr,
      dayName: dayInfo.dayName,
      timestamp: dayInfo.timestamp,
      chains: [],
    };

    for (const [chainKey, chainName] of Object.entries(chainMapping)) {
      const chain = CHAINS[chainKey];
      if (!chain) continue;

      const data = await getUniswapLiquidityForDay(chainName, dayInfo.timestamp);
      dayData.chains.push({
        chain: chain.name,
        chainKey,
        ...data,
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
  console.log(`\n💧 Uniswap Weekly Liquidity Tracker`);
  console.log(`===================================\n`);

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
      totalTVL: 0,
      v1: 0,
      v2: 0,
      v3: 0,
      v4: 0,
    };

    dayData.chains.forEach((chain) => {
      totals.totalTVL += chain.total;
      totals.v1 += chain.v1;
      totals.v2 += chain.v2;
      totals.v3 += chain.v3;
      totals.v4 += chain.v4;
    });

    return totals;
  });

  // Calculate daily changes (liquidity flows)
  const dailyChanges = [];
  for (let i = 0; i < dailyTotals.length; i++) {
    const current = dailyTotals[i];
    const previous = i > 0 ? dailyTotals[i - 1] : null;
    
    const change = previous ? current.totalTVL - previous.totalTVL : 0;
    const changePercent = previous && previous.totalTVL > 0
      ? ((change / previous.totalTVL) * 100).toFixed(2)
      : "0.00";
    
    dailyChanges.push({
      ...current,
      change,
      changePercent,
      isInflow: change > 0,
    });
  }

  // Summary Section
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const weekStart = weeklyData[0].date;
  const weekEnd = weeklyData[weeklyData.length - 1].date;
  console.log(`   Week: ${weekStart} to ${weekEnd}\n`);

  // Find min and max TVL
  const maxDay = dailyTotals.reduce((max, day) => 
    day.totalTVL > max.totalTVL ? day : max, dailyTotals[0]);
  const minDay = dailyTotals.reduce((min, day) => 
    day.totalTVL < min.totalTVL ? day : min, dailyTotals[0]);

  console.log(`   Highest TVL: ${formatUSD(maxDay.totalTVL)} (${maxDay.dayName}, ${maxDay.date})`);
  console.log(`   Lowest TVL:  ${formatUSD(minDay.totalTVL)} (${minDay.dayName}, ${minDay.date})`);
  
  const change = maxDay.totalTVL - minDay.totalTVL;
  const changePercent = minDay.totalTVL > 0 
    ? ((change / minDay.totalTVL) * 100).toFixed(2) 
    : "0.00";
  console.log(`   Weekly Range: ${formatUSD(change)} (${changePercent}%)\n`);

  // Calculate net weekly flow
  const mondayTVL = dailyTotals[0].totalTVL;
  const sundayTVL = dailyTotals[dailyTotals.length - 1].totalTVL;
  const netFlow = sundayTVL - mondayTVL;
  const netFlowPercent = mondayTVL > 0 ? ((netFlow / mondayTVL) * 100).toFixed(2) : "0.00";
  console.log(`   Net Weekly Flow: ${netFlow >= 0 ? "+" : ""}${formatUSD(netFlow)} (${netFlowPercent}%)\n`);

  // Daily Breakdown Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY LIQUIDITY BREAKDOWN                                                               ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ Total TVL      │ V1 TVL        │ V2 TVL        │ V3 TVL        │ V4 TVL        │ Flow      ║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╣`);

  dailyChanges.forEach((day) => {
    const flowStr = day.change !== 0
      ? `${day.change >= 0 ? "+" : ""}${formatUSD(day.change)} (${day.changePercent}%)`
      : "—";
    const flowEmoji = day.isInflow ? "📈" : day.change < 0 ? "📉" : "➡️";

    const dayNameStr = day.dayName.substring(0, 9).padEnd(9);
    const dateStr = day.date.padEnd(10);
    const totalStr = formatUSD(day.totalTVL).padEnd(14);
    const v1Str = formatUSD(day.v1).padEnd(13);
    const v2Str = formatUSD(day.v2).padEnd(13);
    const v3Str = formatUSD(day.v3).padEnd(13);
    const v4Str = formatUSD(day.v4).padEnd(13);
    const flowStrFormatted = `${flowEmoji} ${flowStr}`.padEnd(9);

    console.log(`║ ${dayNameStr} │ ${dateStr} │ ${totalStr} │ ${v1Str} │ ${v2Str} │ ${v3Str} │ ${v4Str} │ ${flowStrFormatted} ║`);
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╝\n`);

  // Chain Breakdown by Day
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 LIQUIDITY BY CHAIN - DAILY BREAKDOWN                                                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n`);

  // Get all unique chains
  const allChains = [...new Set(weeklyData.flatMap(day => day.chains.map(c => c.chain)))];
  
  for (const chain of allChains) {
    console.log(`   ${chain}:`);
    let previousChainTVL = null;
    weeklyData.forEach((dayData) => {
      const chainData = dayData.chains.find(c => c.chain === chain);
      if (chainData) {
        const change = previousChainTVL !== null 
          ? chainData.total - previousChainTVL 
          : 0;
        const changePercent = previousChainTVL !== null && previousChainTVL > 0
          ? ((change / previousChainTVL) * 100).toFixed(2)
          : "0.00";
        const changeStr = previousChainTVL !== null
          ? ` (${change >= 0 ? "+" : ""}${formatUSD(change)}, ${changePercent}%)`
          : "";
        const flowEmoji = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";
        
        console.log(`      ${dayData.dayName.padEnd(9)} (${dayData.date}): ${formatUSD(chainData.total).padEnd(15)} ${flowEmoji}${changeStr}`);
        previousChainTVL = chainData.total;
      }
    });
    console.log(``);
  }

  // Weekly Trend Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY LIQUIDITY TREND                        ║`);
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
    console.log(`   ${day.dayName.padEnd(9)} ${formatUSD(day.totalTVL).padEnd(15)} │${bar}${emptyBar}│`);
  });

  console.log(`\n`);

  // Export to CSV
  const csvData = [];
  weeklyData.forEach((dayData, dayIndex) => {
    dayData.chains.forEach((chain) => {
      const previousDay = dayIndex > 0 
        ? weeklyData[dayIndex - 1].chains.find(c => c.chain === chain.chain)
        : null;
      const change = previousDay ? chain.total - previousDay.total : 0;
      const changePercent = previousDay && previousDay.total > 0
        ? ((change / previousDay.total) * 100).toFixed(2)
        : "0.00";
      
      csvData.push({
        date: dayData.date,
        dayName: dayData.dayName,
        chain: chain.chain,
        v1TVL: chain.v1,
        v2TVL: chain.v2,
        v3TVL: chain.v3,
        v4TVL: chain.v4,
        totalTVL: chain.total,
        dailyChange: change,
        dailyChangePercent: changePercent,
      });
    });
  });

  await writeCSV(
    "output/uniswap-weekly-liquidity.csv",
    [
      { id: "date", title: "Date" },
      { id: "dayName", title: "Day" },
      { id: "chain", title: "Chain" },
      { id: "v1TVL", title: "V1 TVL (USD)" },
      { id: "v2TVL", title: "V2 TVL (USD)" },
      { id: "v3TVL", title: "V3 TVL (USD)" },
      { id: "v4TVL", title: "V4 TVL (USD)" },
      { id: "totalTVL", title: "Total TVL (USD)" },
      { id: "dailyChange", title: "Daily Change (USD)" },
      { id: "dailyChangePercent", title: "Daily Change (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Weekly liquidity report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
