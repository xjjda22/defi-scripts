// Uniswap Weekly Volume Tracker - Tracks daily volume stats for each day of this week

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

// Get volume data for a specific day
async function getUniswapVolumeForDay(chainName, targetTimestamp) {
  try {
    const versions = ["v1", "v2", "v3", "v4"];
    const volumeData = { v1: 0, v2: 0, v3: 0, v4: 0 };
    const tvlData = { v1: 0, v2: 0, v3: 0, v4: 0 };

    for (const version of versions) {
      try {
        // Get fees/volume data
        const feesResponse = await axios.get(
          `${DEFILLAMA_API}/summary/fees/uniswap-${version}`,
          { timeout: 10000 },
        );

        // Try to get historical volume data
        const totalDataChart = feesResponse.data.totalDataChart || [];
        const totalDataChartBreakdown = feesResponse.data.totalDataChartBreakdown || [];
        
        let chainVolume = 0;
        
        // Try to find historical data point
        const closestPoint = findClosestDataPoint(totalDataChartBreakdown, targetTimestamp);
        
        if (closestPoint && Array.isArray(closestPoint) && closestPoint.length >= 2) {
          const chainData = closestPoint[1]?.[chainName] || {};
          const versionNum = version.charAt(1);
          const versionName = `Uniswap V${versionNum}`;
          chainVolume = chainData[versionName] || 0;
        } else {
          // Fallback to latest data
          const latestData = totalDataChartBreakdown?.slice(-1)?.[0];
          if (latestData && Array.isArray(latestData) && latestData.length >= 2) {
            const chainData = latestData[1]?.[chainName] || {};
            const versionNum = version.charAt(1);
            const versionName = `Uniswap V${versionNum}`;
            chainVolume = chainData[versionName] || 0;
          }
        }
        
        volumeData[version] = chainVolume;

        // Get TVL data for context
        const tvlResponse = await axios.get(
          `${DEFILLAMA_API}/protocol/uniswap-${version}`,
          { timeout: 10000 },
        );
        
        // Try to get historical TVL
        const historicalTVL = tvlResponse.data.tvl || [];
        const chainTvls = tvlResponse.data.chainTvls || {};
        
        let chainTVL = 0;
        
        if (chainTvls[chainName] && Array.isArray(chainTvls[chainName])) {
          const closestTvlPoint = findClosestDataPoint(chainTvls[chainName], targetTimestamp);
          if (closestTvlPoint && Array.isArray(closestTvlPoint) && closestTvlPoint.length >= 2) {
            chainTVL = closestTvlPoint[1] || 0;
          }
        }
        
        // Fallback to current TVL
        if (chainTVL === 0) {
          chainTVL = tvlResponse.data.currentChainTvls?.[chainName] || 0;
        }
        
        tvlData[version] = chainTVL;
      } catch (err) {
        // Silently skip if version doesn't exist or has no data
        volumeData[version] = 0;
        tvlData[version] = 0;
      }
    }

    const totalVolume = volumeData.v1 + volumeData.v2 + volumeData.v3 + volumeData.v4;
    const totalTVL = tvlData.v1 + tvlData.v2 + tvlData.v3 + tvlData.v4;

    return {
      chain: chainName,
      v1Volume: volumeData.v1,
      v2Volume: volumeData.v2,
      v3Volume: volumeData.v3,
      v4Volume: volumeData.v4,
      volume24h: totalVolume,
      v1TVL: tvlData.v1,
      v2TVL: tvlData.v2,
      v3TVL: tvlData.v3,
      v4TVL: tvlData.v4,
      tvl: totalTVL,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch volume for ${chainName} on timestamp ${targetTimestamp}:`, error.message);
    return {
      chain: chainName,
      v1Volume: 0,
      v2Volume: 0,
      v3Volume: 0,
      v4Volume: 0,
      volume24h: 0,
      v1TVL: 0,
      v2TVL: 0,
      v3TVL: 0,
      v4TVL: 0,
      tvl: 0,
    };
  }
}

// Get weekly stats for all chains
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  const chainMapping = {
    ethereum: "Ethereum",
    arbitrum: "Arbitrum",
    optimism: "OP Mainnet",
    base: "Base",
    polygon: "Polygon",
    bsc: "BSC",
  };

  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`📅 Fetching volume data for ${dayInfo.dayName} (${dayInfo.dateStr})...`);
    const dayData = {
      date: dayInfo.dateStr,
      dayName: dayInfo.dayName,
      timestamp: dayInfo.timestamp,
      chains: [],
    };

    for (const [chainKey, chainName] of Object.entries(chainMapping)) {
      const chain = CHAINS[chainKey];
      if (!chain) continue;

      const data = await getUniswapVolumeForDay(chainName, dayInfo.timestamp);
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
  console.log(`\n📈 Uniswap Weekly Volume Tracker`);
  console.log(`=================================\n`);

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
      totalVolume: 0,
      totalTVL: 0,
      v1Volume: 0,
      v2Volume: 0,
      v3Volume: 0,
      v4Volume: 0,
    };

    dayData.chains.forEach((chain) => {
      totals.totalVolume += chain.volume24h;
      totals.totalTVL += chain.tvl;
      totals.v1Volume += chain.v1Volume;
      totals.v2Volume += chain.v2Volume;
      totals.v3Volume += chain.v3Volume;
      totals.v4Volume += chain.v4Volume;
    });

    return totals;
  });

  // Summary Section
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const weekStart = weeklyData[0].date;
  const weekEnd = weeklyData[weeklyData.length - 1].date;
  console.log(`   Week: ${weekStart} to ${weekEnd}\n`);

  // Find min and max volume
  const maxDay = dailyTotals.reduce((max, day) => 
    day.totalVolume > max.totalVolume ? day : max, dailyTotals[0]);
  const minDay = dailyTotals.reduce((min, day) => 
    day.totalVolume < min.totalVolume ? day : min, dailyTotals[0]);

  console.log(`   Highest Volume: ${formatUSD(maxDay.totalVolume)} (${maxDay.dayName}, ${maxDay.date})`);
  console.log(`   Lowest Volume:  ${formatUSD(minDay.totalVolume)} (${minDay.dayName}, ${minDay.date})`);
  
  const change = maxDay.totalVolume - minDay.totalVolume;
  const changePercent = minDay.totalVolume > 0 
    ? ((change / minDay.totalVolume) * 100).toFixed(2) 
    : "0.00";
  console.log(`   Weekly Range: ${formatUSD(change)} (${changePercent}%)\n`);

  // Calculate average daily volume
  const avgVolume = dailyTotals.reduce((sum, day) => sum + day.totalVolume, 0) / dailyTotals.length;
  console.log(`   Average Daily Volume: ${formatUSD(avgVolume)}\n`);

  // Daily Breakdown Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY VOLUME BREAKDOWN                                                                    ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ Total Volume   │ V1 Volume     │ V2 Volume     │ V3 Volume     │ V4 Volume     │ Change    ║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╣`);

  let previousTotal = null;
  dailyTotals.forEach((day) => {
    const change = previousTotal !== null 
      ? day.totalVolume - previousTotal 
      : 0;
    const changePercent = previousTotal !== null && previousTotal > 0
      ? ((change / previousTotal) * 100).toFixed(2)
      : "0.00";
    const changeStr = previousTotal !== null
      ? `${change >= 0 ? "+" : ""}${formatUSD(change)} (${changePercent}%)`
      : "—";

    const dayNameStr = day.dayName.substring(0, 9).padEnd(9);
    const dateStr = day.date.padEnd(10);
    const totalStr = formatUSD(day.totalVolume).padEnd(14);
    const v1Str = formatUSD(day.v1Volume).padEnd(13);
    const v2Str = formatUSD(day.v2Volume).padEnd(13);
    const v3Str = formatUSD(day.v3Volume).padEnd(13);
    const v4Str = formatUSD(day.v4Volume).padEnd(13);
    const changeStrFormatted = changeStr.padEnd(9);

    console.log(`║ ${dayNameStr} │ ${dateStr} │ ${totalStr} │ ${v1Str} │ ${v2Str} │ ${v3Str} │ ${v4Str} │ ${changeStrFormatted} ║`);

    previousTotal = day.totalVolume;
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╝\n`);

  // Chain Breakdown by Day
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 VOLUME BY CHAIN - DAILY BREAKDOWN                                                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n`);

  // Get all unique chains
  const allChains = [...new Set(weeklyData.flatMap(day => day.chains.map(c => c.chain)))];
  
  for (const chain of allChains) {
    console.log(`   ${chain}:`);
    weeklyData.forEach((dayData) => {
      const chainData = dayData.chains.find(c => c.chain === chain);
      if (chainData) {
        const mondayVolume = weeklyData[0].chains.find(c => c.chain === chain)?.volume24h || 0;
        const change = chainData.volume24h - mondayVolume;
        const changePercent = mondayVolume > 0
          ? ((change / mondayVolume) * 100).toFixed(2)
          : "0.00";
        console.log(`      ${dayData.dayName.padEnd(9)} (${dayData.date}): ${formatUSD(chainData.volume24h).padEnd(15)} (${change >= 0 ? "+" : ""}${changePercent}% vs Monday)`);
      }
    });
    console.log(``);
  }

  // Weekly Trend Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY VOLUME TREND                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  const maxVolume = Math.max(...dailyTotals.map(d => d.totalVolume));
  const maxBarLength = 50;

  dailyTotals.forEach((day) => {
    const share = maxVolume > 0 ? (day.totalVolume / maxVolume) * 100 : 0;
    const barLength = Math.floor((share / 100) * maxBarLength);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxBarLength - barLength);
    console.log(`   ${day.dayName.padEnd(9)} ${formatUSD(day.totalVolume).padEnd(15)} │${bar}${emptyBar}│ ${share.toFixed(1)}%`);
  });

  console.log(`\n`);

  // Export to CSV
  const csvData = [];
  weeklyData.forEach((dayData) => {
    dayData.chains.forEach((chain) => {
      csvData.push({
        date: dayData.date,
        dayName: dayData.dayName,
        chain: chain.chain,
        v1Volume: chain.v1Volume,
        v2Volume: chain.v2Volume,
        v3Volume: chain.v3Volume,
        v4Volume: chain.v4Volume,
        volume24h: chain.volume24h,
        v1TVL: chain.v1TVL,
        v2TVL: chain.v2TVL,
        v3TVL: chain.v3TVL,
        v4TVL: chain.v4TVL,
        tvl: chain.tvl,
      });
    });
  });

  await writeCSV(
    "output/uniswap-weekly-volume.csv",
    [
      { id: "date", title: "Date" },
      { id: "dayName", title: "Day" },
      { id: "chain", title: "Chain" },
      { id: "v1Volume", title: "V1 24h Volume (USD)" },
      { id: "v2Volume", title: "V2 24h Volume (USD)" },
      { id: "v3Volume", title: "V3 24h Volume (USD)" },
      { id: "v4Volume", title: "V4 24h Volume (USD)" },
      { id: "volume24h", title: "Total 24h Volume (USD)" },
      { id: "v1TVL", title: "V1 TVL (USD)" },
      { id: "v2TVL", title: "V2 TVL (USD)" },
      { id: "v3TVL", title: "V3 TVL (USD)" },
      { id: "v4TVL", title: "V4 TVL (USD)" },
      { id: "tvl", title: "Total TVL (USD)" },
    ],
    csvData,
  );

  console.log(`\n✅ Weekly volume report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
