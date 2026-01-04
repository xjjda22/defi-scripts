/**
 * Uniswap Weekly Volume Tracker - Optimized for AI Analysis
 *
 * PURPOSE: Tracks daily trading volume stats across Uniswap V1-V4
 *          for multiple chains over the current week (Monday-Sunday)
 *
 * DATA SOURCES:
 * - Primary: DefiLlama Protocol API (https://api.llama.fi)
 * - Chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC
 * - Protocols: uniswap-v1, uniswap-v2, uniswap-v3, uniswap-v4
 *
 * OUTPUT:
 * - Console: Formatted tables and visualizations
 * - CSV: Detailed daily breakdown by chain and version
 *
 * USAGE: node weeklyVolumeTracker.js
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
const UNISWAP_VERSIONS = ["v1", "v2", "v3", "v4"];

/** @type {Object.<string, string>} Maps internal chain keys to DefiLlama chain names */
const CHAIN_MAPPING = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "OP Mainnet", // Note: Different from TVL tracker ("Optimism")
  base: "Base",
  polygon: "Polygon",
  bsc: "BSC", // Note: Different from TVL tracker ("Binance")
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
 * Extracts volume value from a data point (handles both array and object formats)
 * @param {Object|Array} point - Data point containing volume information
 * @returns {number} Volume value
 */
function extractVolumeValue(point) {
  if (!point) return 0;

  // Array format: [timestamp, value]
  if (Array.isArray(point) && point.length >= 2) {
    return point[1] || 0;
  }

  // Object format: check various possible fields
  return point.volume || point.value || point.totalVolume || 0;
}

// ================================================================================================
// DATA FETCHING FUNCTIONS
// ================================================================================================

/**
 * Fetches fees/volume data from DefiLlama API
 * @param {string} protocol - Protocol name (e.g., "uniswap-v3")
 * @returns {Promise<Object>} Fees data from API
 * @throws {Error} If API request fails
 */
async function fetchFeesData(protocol) {
  const url = `${DEFILLAMA_API}/summary/fees/${protocol}`;
  const response = await axios.get(url, { timeout: API_TIMEOUT_MS });
  return response.data;
}

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
 * Extracts chain-specific volume from fees data
 * @param {Object} feesData - Fees data from DefiLlama
 * @param {string} chainName - Chain name
 * @param {number} targetTimestamp - Target timestamp
 * @param {string} version - Protocol version (e.g., "v3")
 * @returns {number} Chain-specific volume
 */
function extractChainVolume(feesData, chainName, targetTimestamp, version) {
  const totalDataChartBreakdown = feesData.totalDataChartBreakdown || [];

  // Try historical data first
  const closestPoint = findClosestDataPoint(totalDataChartBreakdown, targetTimestamp);
  if (closestPoint && Array.isArray(closestPoint) && closestPoint.length >= 2) {
    const chainData = closestPoint[1]?.[chainName] || {};
    const versionNum = version.charAt(1);
    const versionName = `Uniswap V${versionNum}`;
    return chainData[versionName] || 0;
  }

  // Fallback to latest data
  const latestData = totalDataChartBreakdown?.slice(-1)?.[0];
  if (latestData && Array.isArray(latestData) && latestData.length >= 2) {
    const chainData = latestData[1]?.[chainName] || {};
    const versionNum = version.charAt(1);
    const versionName = `Uniswap V${versionNum}`;
    return chainData[versionName] || 0;
  }

  return 0;
}

/**
 * Calculates chain-specific TVL using historical data
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

  // Strategy 2: Current chain TVL as fallback
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

  return 0;
}

/**
 * Fetches volume and TVL data for a specific chain and timestamp across all Uniswap versions
 * @param {string} chainName - Name of the blockchain
 * @param {number} targetTimestamp - Unix timestamp for the target date
 * @returns {Promise<Object>} Volume and TVL data by version and totals
 */
async function getUniswapVolumeForDay(chainName, targetTimestamp) {
  const volumeData = {};
  const tvlData = {};

  for (const version of UNISWAP_VERSIONS) {
    try {
      const protocolName = `uniswap-${version}`;

      // Get volume data from fees endpoint
      const feesData = await fetchFeesData(protocolName);
      const chainVolume = extractChainVolume(feesData, chainName, targetTimestamp, version);
      volumeData[version] = chainVolume;

      // Get TVL data from protocol endpoint
      const protocolData = await fetchProtocolData(protocolName);
      const chainTVL = calculateChainTVL(protocolData, chainName, targetTimestamp);
      tvlData[version] = chainTVL;

      // Rate limiting to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS));
    } catch (error) {
      console.warn(`[WARN] Failed to fetch ${version} data for ${chainName}: ${error.message}`);
      volumeData[version] = 0;
      tvlData[version] = 0;
    }
  }

  // Extract individual versions for cleaner return structure
  const v1 = volumeData.v1 || 0, v2 = volumeData.v2 || 0, v3 = volumeData.v3 || 0, v4 = volumeData.v4 || 0;
  const t1 = tvlData.v1 || 0, t2 = tvlData.v2 || 0, t3 = tvlData.v3 || 0, t4 = tvlData.v4 || 0;

  return {
    chain: chainName,
    v1Volume: v1, v2Volume: v2, v3Volume: v3, v4Volume: v4,
    volume24h: v1 + v2 + v3 + v4,
    v1TVL: t1, v2TVL: t2, v3TVL: t3, v4TVL: t4,
    tvl: t1 + t2 + t3 + t4,
    metadata: {
      timestamp: targetTimestamp,
      date: new Date(targetTimestamp * 1000).toISOString().split('T')[0],
      protocolsFetched: Object.keys(volumeData),
    }
  };
}

// ================================================================================================
// MAIN DATA COLLECTION
// ================================================================================================

/**
 * Collects weekly volume data for all supported chains
 * @returns {Promise<Array>} Weekly data organized by day and chain
 */
async function getWeeklyStats() {
  const weekDates = getThisWeekDates();
  console.log(`[INFO] Starting weekly volume data collection for ${weekDates.length} days`);

  const weeklyData = [];

  for (const dayInfo of weekDates) {
    console.log(`[INFO] Processing ${dayInfo.dayName} (${dayInfo.dateStr})`);
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
        const chainData = await getUniswapVolumeForDay(defiLlamaChainName, dayInfo.timestamp);
        dayData.chains.push({
          chain: chainConfig.name,
          chainKey,
          ...chainData,
        });
        console.log(`[DEBUG] Fetched ${chainConfig.name}: ${formatUSD(chainData.volume24h)} volume`);
      } catch (error) {
        console.error(`[ERROR] Failed to fetch data for ${chainConfig.name}: ${error.message}`);
        // Add empty data structure to maintain consistency
        dayData.chains.push({
          chain: chainConfig.name,
          chainKey,
          v1Volume: 0, v2Volume: 0, v3Volume: 0, v4Volume: 0, volume24h: 0,
          v1TVL: 0, v2TVL: 0, v3TVL: 0, v4TVL: 0, tvl: 0,
          metadata: { error: error.message }
        });
      }

      // Rate limiting between requests
      await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS));
    }

    weeklyData.push(dayData);
    console.log(`[INFO] Completed ${dayData.dayName} with ${dayData.chains.length} chains`);
  }

  console.log(`[INFO] Weekly volume data collection completed: ${weeklyData.length} days processed`);
  return weeklyData;
}

// ================================================================================================
// REPORT GENERATION
// ================================================================================================

/**
 * Generates comprehensive weekly volume report with tables, charts, and CSV export
 * @returns {Promise<void>}
 */
async function generateReport() {
  // Display header
  printUniswapLogo("full");
  console.log(`\n📈 UNISWAP WEEKLY VOLUME TRACKER`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Purpose: Track daily trading volume across Uniswap V1-V4 protocols`);
  console.log(`Chains: ${Object.keys(CHAIN_MAPPING).join(', ')}`);
  console.log(`Period: Current week (Monday - Sunday)\n`);

  // Fetch data
  const weeklyData = await getWeeklyStats();

  if (!weeklyData || weeklyData.length === 0) {
    console.log(`❌ ERROR: No weekly data available`);
    return;
  }

  // Calculate daily totals
  const dailyTotals = calculateDailyTotals(weeklyData);

  // Generate report sections
  generateSummarySection(dailyTotals);
  generateDailyBreakdownTable(dailyTotals);
  generateChainBreakdownSection(weeklyData);
  generateTrendVisualization(dailyTotals);

  // Export data
  await exportToCSV(weeklyData);

  console.log(`✅ REPORT COMPLETE: Weekly volume analysis generated successfully`);
}

/**
 * Calculates total volume and TVL by version for each day
 * @param {Array} weeklyData - Raw weekly data
 * @returns {Array} Daily totals with aggregated volume and TVL
 */
function calculateDailyTotals(weeklyData) {
  return weeklyData.map(dayData => {
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

    dayData.chains.forEach(chain => {
      totals.totalVolume += chain.volume24h || 0;
      totals.totalTVL += chain.tvl || 0;
      totals.v1Volume += chain.v1Volume || 0;
      totals.v2Volume += chain.v2Volume || 0;
      totals.v3Volume += chain.v3Volume || 0;
      totals.v4Volume += chain.v4Volume || 0;
    });

    return totals;
  });
}

/**
 * Generates the weekly summary section with key metrics
 * @param {Array} dailyTotals - Daily aggregated totals
 */
function generateSummarySection(dailyTotals) {
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 WEEKLY SUMMARY                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);

  const weekStart = dailyTotals[0].date;
  const weekEnd = dailyTotals[dailyTotals.length - 1].date;
  console.log(`Week Period: ${weekStart} to ${weekEnd}`);

  // Calculate key metrics
  const maxDay = dailyTotals.reduce((max, day) => day.totalVolume > max.totalVolume ? day : max, dailyTotals[0]);
  const minDay = dailyTotals.reduce((min, day) => day.totalVolume < min.totalVolume ? day : min, dailyTotals[0]);

  const weeklyRange = maxDay.totalVolume - minDay.totalVolume;
  const weeklyRangePercent = minDay.totalVolume > 0 ? ((weeklyRange / minDay.totalVolume) * 100).toFixed(2) : "0.00";

  const avgDailyVolume = dailyTotals.reduce((sum, day) => sum + day.totalVolume, 0) / dailyTotals.length;

  console.log(`Highest Volume: ${formatUSD(maxDay.totalVolume)} (${maxDay.dayName}, ${maxDay.date})`);
  console.log(`Lowest Volume:  ${formatUSD(minDay.totalVolume)} (${minDay.dayName}, ${minDay.date})`);
  console.log(`Weekly Range: ${formatUSD(weeklyRange)} (${weeklyRangePercent}%)`);
  console.log(`Average Daily Volume: ${formatUSD(avgDailyVolume)}`);

  // Calculate week-over-week change if data allows
  const mondayVolume = dailyTotals[0].totalVolume;
  const sundayVolume = dailyTotals[dailyTotals.length - 1].totalVolume;
  const netChange = sundayVolume - mondayVolume;
  const netChangePercent = mondayVolume > 0 ? ((netChange / mondayVolume) * 100).toFixed(2) : "0.00";

  console.log(`Net Weekly Change: ${netChange >= 0 ? '+' : ''}${formatUSD(netChange)} (${netChangePercent}%)`);
  console.log(``);
}

/**
 * Generates the daily volume breakdown table
 * @param {Array} dailyTotals - Daily aggregated totals
 */
function generateDailyBreakdownTable(dailyTotals) {
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          📅 DAILY VOLUME BREAKDOWN                                                                   ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Day       │ Date       │ Total Volume   │ V1 Volume     │ V2 Volume     │ V3 Volume     │ V4 Volume     │ Day Change║`);
  console.log(`╠═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╣`);

  let previousTotal = null;
  dailyTotals.forEach((day) => {
    const dayChange = previousTotal !== null ? day.totalVolume - previousTotal : 0;
    const dayChangePercent = previousTotal !== null && previousTotal > 0
      ? ((dayChange / previousTotal) * 100).toFixed(2)
      : "0.00";
    const dayChangeStr = previousTotal !== null
      ? `${dayChange >= 0 ? "+" : ""}${formatUSD(dayChange)} (${dayChangePercent}%)`
      : "—";

    const row = [
      day.dayName.substring(0, 9).padEnd(9),
      day.date.padEnd(10),
      formatUSD(day.totalVolume).padEnd(14),
      formatUSD(day.v1Volume).padEnd(13),
      formatUSD(day.v2Volume).padEnd(13),
      formatUSD(day.v3Volume).padEnd(13),
      formatUSD(day.v4Volume).padEnd(13),
      dayChangeStr.padEnd(9)
    ];

    console.log(`║ ${row.join(' │ ')} ║`);
    previousTotal = day.totalVolume;
  });

  console.log(`╚═══════════╪════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════╝`);
  console.log(``);
}

/**
 * Generates the chain-by-chain volume breakdown section
 * @param {Array} weeklyData - Raw weekly data by day and chain
 */
function generateChainBreakdownSection(weeklyData) {
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 VOLUME BY CHAIN - DAILY BREAKDOWN                                                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝`);
  console.log(``);

  // Get all unique chains
  const allChains = [...new Set(weeklyData.flatMap(day => day.chains.map(c => c.chain)))];

  for (const chain of allChains) {
    console.log(`${chain}:`);
    weeklyData.forEach((dayData) => {
      const chainData = dayData.chains.find(c => c.chain === chain);
      if (chainData) {
        const mondayData = weeklyData[0].chains.find(c => c.chain === chain);
        const mondayVolume = mondayData?.volume24h || 0;
        const change = chainData.volume24h - mondayVolume;
        const changePercent = mondayVolume > 0
          ? ((change / mondayVolume) * 100).toFixed(2)
          : "0.00";

        const changeIndicator = change >= 0 ? "+" : "";
        console.log(`  ${dayData.dayName.padEnd(9)} (${dayData.date}): ${formatUSD(chainData.volume24h).padEnd(15)} (${changeIndicator}${changePercent}% vs Monday)`);
      }
    });
    console.log(``);
  }
}

/**
 * Generates ASCII bar chart visualization of weekly volume trends
 * @param {Array} dailyTotals - Daily aggregated totals
 */
function generateTrendVisualization(dailyTotals) {
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 WEEKLY VOLUME TREND                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  console.log(``);

  const maxVolume = Math.max(...dailyTotals.map(d => d.totalVolume));
  const minVolume = Math.min(...dailyTotals.map(d => d.totalVolume));

  dailyTotals.forEach((day) => {
    const normalizedValue = maxVolume - minVolume > 0
      ? ((day.totalVolume - minVolume) / (maxVolume - minVolume)) * 100
      : 0;
    const barLength = Math.floor((normalizedValue / 100) * MAX_BAR_LENGTH);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(MAX_BAR_LENGTH - barLength);

    console.log(`   ${day.dayName.padEnd(9)} ${formatUSD(day.totalVolume).padEnd(15)} │${bar}${emptyBar}│ ${normalizedValue.toFixed(1)}%`);
  });

  console.log(``);
}

/**
 * Exports weekly data to CSV file
 * @param {Array} weeklyData - Raw weekly data
 * @returns {Promise<void>}
 */
async function exportToCSV(weeklyData) {
  console.log(`[INFO] Exporting data to CSV...`);

  const csvData = [];
  weeklyData.forEach((dayData) => {
    dayData.chains.forEach((chain) => {
      csvData.push({
        date: dayData.date,
        dayName: dayData.dayName,
        timestamp: dayData.timestamp,
        chain: chain.chain,
        chainKey: chain.chainKey,
        v1Volume: chain.v1Volume || 0,
        v2Volume: chain.v2Volume || 0,
        v3Volume: chain.v3Volume || 0,
        v4Volume: chain.v4Volume || 0,
        volume24h: chain.volume24h || 0,
        v1TVL: chain.v1TVL || 0,
        v2TVL: chain.v2TVL || 0,
        v3TVL: chain.v3TVL || 0,
        v4TVL: chain.v4TVL || 0,
        tvl: chain.tvl || 0,
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
    { id: "metadata", title: "Metadata" },
  ];

  await writeCSV("output/uniswap-weekly-volume.csv", csvHeaders, csvData);
  console.log(`[SUCCESS] CSV exported: output/uniswap-weekly-volume.csv (${csvData.length} rows)`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getWeeklyStats, generateReport };
