/**
 * Uniswap Weekly Liquidity Tracker - Optimized for AI Analysis
 *
 * PURPOSE: Tracks daily liquidity changes (flows) across Uniswap V1-V4
 *          for multiple chains over the current week (Monday-Sunday)
 *
 * DATA SOURCES:
 * - Primary: DefiLlama Protocol API (https://api.llama.fi)
 * - Chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC
 * - Protocols: uniswap-v1, uniswap-v2, uniswap-v3, uniswap-v4
 *
 * ANALYSIS: Focuses on liquidity movements rather than static TVL values
 *
 * OUTPUT:
 * - Console: Formatted tables and flow visualizations
 * - CSV: Detailed daily breakdown with change calculations
 *
 * USAGE: node weeklyLiquidityTracker.js
 */

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

// ================================================================================================
// CONFIGURATION CONSTANTS
// ================================================================================================

/** @type {string} Base URL for DefiLlama API */
const DEFILLAMA_API = "https://api.llama.fi";

/** @type {string[]} Supported Uniswap protocol versions */
const UNISWAP_VERSIONS = ["uniswap-v1", "uniswap-v2", "uniswap-v3", "uniswap-v4"];

/** @type {Object.<string, string>} Maps internal chain keys to DefiLlama chain names */
const CHAIN_MAPPING = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism", // Note: Different from volume tracker ("OP Mainnet")
  base: "Base",
  polygon: "Polygon",
  bsc: "Binance", // Note: Different from volume tracker ("BSC")
};

/** @type {number} Rate limiting delay between API calls (ms) */
const API_RATE_LIMIT_MS = 500;

/** @type {number} API request timeout (ms) */
const API_TIMEOUT_MS = 10000;

/** @type {number} Maximum bar length for trend visualization */
const MAX_BAR_LENGTH = 50;

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

// ================================================================================================
// DATA PROCESSING UTILITIES
// ================================================================================================

/**
 * Finds the closest data point to a target timestamp
 * @param {Array} dataArray - Array of data points with timestamps
 * @param {number} targetTimestamp - Target timestamp to find closest point for
 * @param {number} toleranceSeconds - Maximum age difference allowed (default: 1 day)
 * @returns {Object|null} Closest data point or null if none found
 */
function findClosestDataPoint(dataArray, targetTimestamp, toleranceSeconds = 86400) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return null;
  }

  let closest = null;
  let minDiff = Infinity;

  // First pass: prefer points within tolerance (on or before target date)
  for (const point of dataArray) {
    const timestamp = extractTimestamp(point);
    if (!timestamp) continue;

    const diff = Math.abs(timestamp - targetTimestamp);

    if (timestamp <= targetTimestamp + toleranceSeconds && diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  // Second pass: if no point within tolerance, use absolute closest
  if (!closest) {
    for (const point of dataArray) {
      const timestamp = extractTimestamp(point);
      if (!timestamp) continue;

      const diff = Math.abs(timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
  }

  return closest;
}

/**
 * Extracts timestamp from various data point formats
 * @param {Object|Array} point - Data point in various formats
 * @returns {number|null} Extracted timestamp or null
 */
function extractTimestamp(point) {
  if (!point) return null;

  // Format 1: { date: timestamp, ... }
  if (point.date) return point.date;

  // Format 2: [timestamp, value, ...]
  if (Array.isArray(point) && point.length > 0) return point[0];

  return null;
}

/**
 * Extracts liquidity/TVL value from a data point (handles both array and object formats)
 * @param {Object|Array} point - Data point containing liquidity information
 * @returns {number} Liquidity value
 */
function extractLiquidityValue(point) {
  if (!point) return 0;

  // Array format: [timestamp, value]
  if (Array.isArray(point) && point.length >= 2) {
    return point[1] || 0;
  }

  // Object format: check various possible fields
  return point.totalLiquidityUSD || point.value || point.tvl || 0;
}

// ================================================================================================
// DATA FETCHING FUNCTIONS
// ================================================================================================

/**
 * Fetches protocol data from DefiLlama API
 * @param {string} protocol - Protocol name (e.g., "uniswap-v3")
 * @returns {Promise<Object>} Protocol data from API
 * @throws {Error} If API request fails
 */
async function fetchProtocolData(protocol) {
  const url = `${DEFILLAMA_API}/protocol/${protocol}`;
  const response = await axios.get(url, { timeout: API_TIMEOUT_MS });
  return response.data;
}

/**
 * Calculates chain-specific TVL using historical data and fallback strategies
 * @param {Object} protocolData - Protocol data from DefiLlama API
 * @param {string} chainName - Target chain name
 * @param {number} targetTimestamp - Target timestamp
 * @returns {number} Chain-specific TVL value
 */
function calculateChainTVL(protocolData, chainName, targetTimestamp) {
  // Strategy 1: Direct chain-specific historical data
  const chainSpecificTVL = getChainSpecificHistoricalTVL(protocolData, chainName, targetTimestamp);
  if (chainSpecificTVL > 0) {
    return chainSpecificTVL;
  }

  // Strategy 2: Proportional allocation from total historical TVL
  const proportionalTVL = getProportionalHistoricalTVL(protocolData, chainName, targetTimestamp);
  if (proportionalTVL > 0) {
    return proportionalTVL;
  }

  // Strategy 3: Current chain TVL as fallback
  return protocolData.currentChainTvls?.[chainName] || 0;
}

/**
 * Gets chain-specific historical TVL data
 * @param {Object} protocolData - Protocol data
 * @param {string} chainName - Chain name
 * @param {number} targetTimestamp - Target timestamp
 * @returns {number} Chain-specific TVL or 0 if not available
 */
function getChainSpecificHistoricalTVL(protocolData, chainName, targetTimestamp) {
  const chainTvls = protocolData.chainTvls || {};

  if (!chainTvls[chainName] || !Array.isArray(chainTvls[chainName])) {
    return 0;
  }

  const closestPoint = findClosestDataPoint(chainTvls[chainName], targetTimestamp);
  if (!closestPoint) return 0;

  // Handle array format [timestamp, value]
  if (Array.isArray(closestPoint) && closestPoint.length >= 2) {
    return closestPoint[1] || 0;
  }

  // Handle object format
  return extractLiquidityValue(closestPoint);
}

/**
 * Estimates chain TVL using proportional allocation from total historical TVL
 * @param {Object} protocolData - Protocol data
 * @param {string} chainName - Chain name
 * @param {number} targetTimestamp - Target timestamp
 * @returns {number} Estimated chain TVL
 */
function getProportionalHistoricalTVL(protocolData, chainName, targetTimestamp) {
  const historicalTVL = protocolData.tvl || [];
  const closestPoint = findClosestDataPoint(historicalTVL, targetTimestamp);

  if (!closestPoint) return 0;

  const totalHistoricalTVL = extractLiquidityValue(closestPoint);
  if (totalHistoricalTVL === 0) return 0;

  // Calculate current proportion of this chain
  const currentChainTVL = protocolData.currentChainTvls?.[chainName] || 0;
  const currentTotalTVL = Object.values(protocolData.currentChainTvls || {})
    .filter(val => typeof val === 'number')
    .reduce((sum, val) => sum + val, 0);

  if (currentTotalTVL === 0) return currentChainTVL;

  const proportion = currentChainTVL / currentTotalTVL;
  return totalHistoricalTVL * proportion;
}

/**
 * Fetches liquidity/TVL data for a specific chain and timestamp across all Uniswap versions
 * @param {string} chainName - Name of the blockchain
 * @param {number} targetTimestamp - Unix timestamp for the target date
 * @returns {Promise<Object>} Liquidity data by version and totals
 */
async function getUniswapLiquidityForDay(chainName, targetTimestamp) {
  const tvlData = {};

  for (const protocol of UNISWAP_VERSIONS) {
    try {
      const protocolData = await fetchProtocolData(protocol);
      const chainTVL = calculateChainTVL(protocolData, chainName, targetTimestamp);
      tvlData[protocol] = chainTVL;

      // Rate limiting to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS));
    } catch (error) {
      console.warn(`[WARN] Failed to fetch ${protocol} liquidity for ${chainName}: ${error.message}`);
      tvlData[protocol] = 0;
    }
  }

  // Extract individual versions for cleaner return structure
  const v1 = tvlData["uniswap-v1"] || 0;
  const v2 = tvlData["uniswap-v2"] || 0;
  const v3 = tvlData["uniswap-v3"] || 0;
  const v4 = tvlData["uniswap-v4"] || 0;

  return {
    chain: chainName,
    v1,
    v2,
    v3,
    v4,
    total: v1 + v2 + v3 + v4,
    metadata: {
      timestamp: targetTimestamp,
      date: new Date(targetTimestamp * 1000).toISOString().split('T')[0],
      protocolsFetched: Object.keys(tvlData),
      note: "Liquidity tracker focuses on TVL changes and flows over time"
    }
  };
}

// ================================================================================================
// MAIN DATA COLLECTION
// ================================================================================================

/**
 * Collects weekly liquidity data for all supported chains
 * @returns {Promise<Array>} Weekly data organized by day and chain
 */
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  console.log(`[INFO] Starting weekly liquidity flow analysis for ${weekDates.length} days`);

  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`[INFO] Analyzing liquidity flows for ${dayInfo.dayName} (${dayInfo.dateStr})`);
    const dayData = {
      date: dayInfo.dateStr,
      dayName: dayInfo.dayName,
      timestamp: dayInfo.timestamp,
      chains: [],
    };

    for (const [chainKey, defiLlamaChainName] of Object.entries(CHAIN_MAPPING)) {
      const chainConfig = CHAINS[chainKey];
      if (!chainConfig) {
        console.log(`[WARN] Chain config not found for key: ${chainKey}`);
        continue;
      }

      try {
        const chainData = await getUniswapLiquidityForDay(defiLlamaChainName, dayInfo.timestamp);
        dayData.chains.push({
          chain: chainConfig.name,
          chainKey,
          ...chainData,
        });
        console.log(`[DEBUG] Analyzed ${chainConfig.name}: ${formatUSD(chainData.total)} liquidity`);
      } catch (error) {
        console.error(`[ERROR] Failed to analyze liquidity for ${chainConfig.name}: ${error.message}`);
        // Add empty data structure to maintain consistency
        dayData.chains.push({
          chain: chainConfig.name,
          chainKey,
          v1: 0, v2: 0, v3: 0, v4: 0, total: 0,
          metadata: { error: error.message }
        });
      }

      // Rate limiting between requests
      await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS));
    }

    weeklyData.push(dayData);
    console.log(`[INFO] Completed liquidity analysis for ${dayData.dayName} with ${dayData.chains.length} chains`);
  }

  console.log(`[INFO] Weekly liquidity flow analysis completed: ${weeklyData.length} days processed`);
  return weeklyData;
}

/**
 * Generates comprehensive weekly liquidity flow report with tables, charts, and CSV export
 * @returns {Promise<void>}
 */
async function generateReport() {
  // Display header
  printUniswapLogo("full");
  console.log(`\n💧 UNISWAP WEEKLY LIQUIDITY TRACKER`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Purpose: Analyze liquidity flows and changes across Uniswap V1-V4 protocols`);
  console.log(`Chains: ${Object.keys(CHAIN_MAPPING).join(', ')}`);
  console.log(`Period: Current week (Monday - Sunday)\n`);

  // Fetch data
  const weeklyData = await getWeeklyStats();

  if (!weeklyData || weeklyData.length === 0) {
    console.log(`❌ ERROR: No weekly data available`);
    return;
  }

  // Calculate daily totals and changes (liquidity flows)
  const dailyChanges = calculateDailyTotalsAndChanges(weeklyData);

  // Generate report sections
  generateSummarySection(dailyChanges);
  generateDailyBreakdownTable(dailyChanges);
  generateChainBreakdownSection(weeklyData);
  generateTrendVisualization(dailyChanges);

  // Export data
  await exportToCSV(weeklyData);

  console.log(`✅ REPORT COMPLETE: Weekly liquidity flow analysis generated successfully`);
}

/**
 * Calculates total TVL by version for each day and computes daily changes (flows)
 * @param {Array} weeklyData - Raw weekly data
 * @returns {Array} Daily totals with change calculations
 */
function calculateDailyTotalsAndChanges(weeklyData) {
  // First calculate daily totals
  const dailyTotals = weeklyData.map(dayData => {
    const totals = {
      date: dayData.date,
      dayName: dayData.dayName,
      totalTVL: 0,
      v1: 0,
      v2: 0,
      v3: 0,
      v4: 0,
    };

    dayData.chains.forEach(chain => {
      totals.totalTVL += chain.total || 0;
      totals.v1 += chain.v1 || 0;
      totals.v2 += chain.v2 || 0;
      totals.v3 += chain.v3 || 0;
      totals.v4 += chain.v4 || 0;
    });

    return totals;
  });

  // Then calculate daily changes (liquidity flows)
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

  return dailyChanges;
}
/**
 * Generates the weekly summary section with key metrics for liquidity flows
 * @param {Array} dailyChanges - Daily totals with change calculations
 */
function generateSummarySection(dailyChanges) {
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);

  const weekStart = dailyChanges[0].date;
  const weekEnd = dailyChanges[dailyChanges.length - 1].date;
  console.log(`Week Period: ${weekStart} to ${weekEnd}`);

  // Calculate key metrics
  const maxDay = dailyChanges.reduce((max, day) => day.totalTVL > max.totalTVL ? day : max, dailyChanges[0]);
  const minDay = dailyChanges.reduce((min, day) => day.totalTVL < min.totalTVL ? day : min, dailyChanges[0]);

  const weeklyRange = maxDay.totalTVL - minDay.totalTVL;
  const weeklyRangePercent = minDay.totalTVL > 0 ? ((weeklyRange / minDay.totalTVL) * 100).toFixed(2) : "0.00";

  const avgDailyTVL = dailyChanges.reduce((sum, day) => sum + day.totalTVL, 0) / dailyChanges.length;

  console.log(`Highest TVL: ${formatUSD(maxDay.totalTVL)} (${maxDay.dayName}, ${maxDay.date})`);
  console.log(`Lowest TVL:  ${formatUSD(minDay.totalTVL)} (${minDay.dayName}, ${minDay.date})`);
  console.log(`Weekly Range: ${formatUSD(weeklyRange)} (${weeklyRangePercent}%)`);
  console.log(`Average Daily TVL: ${formatUSD(avgDailyTVL)}`);

  // Calculate net weekly flow
  const mondayTVL = dailyChanges[0].totalTVL;
  const sundayTVL = dailyChanges[dailyChanges.length - 1].totalTVL;
  const netFlow = sundayTVL - mondayTVL;
  const netFlowPercent = mondayTVL > 0 ? ((netFlow / mondayTVL) * 100).toFixed(2) : "0.00";

  console.log(`Net Weekly Flow: ${netFlow >= 0 ? '+' : ''}${formatUSD(netFlow)} (${netFlowPercent}%)`);

  // Analyze flow patterns
  const inflows = dailyChanges.filter(day => day.change > 0).length;
  const outflows = dailyChanges.filter(day => day.change < 0).length;
  const stableDays = dailyChanges.filter(day => day.change === 0).length;

  console.log(`Flow Pattern: ${inflows} inflow days, ${outflows} outflow days, ${stableDays} stable days`);
  console.log(``);
}

/**
 * Generates the daily liquidity breakdown table with flow indicators
 * @param {Array} dailyChanges - Daily totals with change calculations
 */
function generateDailyBreakdownTable(dailyChanges) {
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

    const row = [
      day.dayName.substring(0, 9).padEnd(9),
      day.date.padEnd(10),
      formatUSD(day.totalTVL).padEnd(14),
      formatUSD(day.v1).padEnd(13),
      formatUSD(day.v2).padEnd(13),
      formatUSD(day.v3).padEnd(13),
      formatUSD(day.v4).padEnd(13),
      `${flowEmoji} ${flowStr}`.padEnd(9)
    ];

    console.log(`║ ${row.join(' │ ')} ║`);
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╝`);
  console.log(``);
}

/**
 * Generates the chain-by-chain liquidity breakdown section with flow indicators
 * @param {Array} weeklyData - Raw weekly data by day and chain
 */
function generateChainBreakdownSection(weeklyData) {
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 LIQUIDITY BY CHAIN - DAILY BREAKDOWN                                                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝`);
  console.log(``);

  // Get all unique chains
  const allChains = [...new Set(weeklyData.flatMap(day => day.chains.map(c => c.chain)))];

  for (const chain of allChains) {
    console.log(`${chain}:`);
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
          ? ` (${change >= 0 ? "+" : ""}${changePercent}%)`
          : "";
        const flowEmoji = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";

        console.log(`  ${dayData.dayName.padEnd(9)} (${dayData.date}): ${formatUSD(chainData.total).padEnd(15)} ${flowEmoji}${changeStr}`);
        previousChainTVL = chainData.total;
      }
    });
    console.log(``);
  }
}

/**
 * Generates ASCII bar chart visualization of weekly liquidity trends
 * @param {Array} dailyChanges - Daily totals with change calculations
 */
function generateTrendVisualization(dailyChanges) {
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY LIQUIDITY TREND                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  console.log(``);

  const maxTVL = Math.max(...dailyChanges.map(d => d.totalTVL));
  const minTVL = Math.min(...dailyChanges.map(d => d.totalTVL));
  const range = maxTVL - minTVL;

  dailyChanges.forEach((day) => {
    const normalizedValue = range > 0 ? ((day.totalTVL - minTVL) / range) * 100 : 0;
    const barLength = Math.floor((normalizedValue / 100) * MAX_BAR_LENGTH);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(MAX_BAR_LENGTH - barLength);

    console.log(`   ${day.dayName.padEnd(9)} ${formatUSD(day.totalTVL).padEnd(15)} │${bar}${emptyBar}│`);
  });

  console.log(``);
}

/**
 * Exports weekly liquidity data to CSV file
 * @param {Array} weeklyData - Raw weekly data
 * @returns {Promise<void>}
 */
async function exportToCSV(weeklyData) {
  console.log(`[INFO] Exporting liquidity data to CSV...`);

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
        timestamp: dayData.timestamp,
        chain: chain.chain,
        chainKey: chain.chainKey,
        v1TVL: chain.v1 || 0,
        v2TVL: chain.v2 || 0,
        v3TVL: chain.v3 || 0,
        v4TVL: chain.v4 || 0,
        totalTVL: chain.total || 0,
        dailyChange: change,
        dailyChangePercent: changePercent,
        // Include metadata if available
        ...(chain.metadata && { metadata: JSON.stringify(chain.metadata) })
      });
    });
  });

  const csvHeaders = [
    { id: "date", title: "Date" },
    { id: "dayName", title: "Day" },
    { id: "timestamp", title: "Unix Timestamp" },
    { id: "chain", title: "Chain" },
    { id: "chainKey", title: "Chain Key" },
    { id: "v1TVL", title: "V1 TVL (USD)" },
    { id: "v2TVL", title: "V2 TVL (USD)" },
    { id: "v3TVL", title: "V3 TVL (USD)" },
    { id: "v4TVL", title: "V4 TVL (USD)" },
    { id: "totalTVL", title: "Total TVL (USD)" },
    { id: "dailyChange", title: "Daily Change (USD)" },
    { id: "dailyChangePercent", title: "Daily Change (%)" },
    { id: "metadata", title: "Metadata" },
  ];

  await writeCSV("output/uniswap-weekly-liquidity.csv", csvHeaders, csvData);
  console.log(`[SUCCESS] CSV exported: output/uniswap-weekly-liquidity.csv (${csvData.length} rows)`);
}
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
