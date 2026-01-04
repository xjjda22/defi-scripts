/**
 * Uniswap TVL Tracker - Current State Analysis
 *
 * PURPOSE: Tracks current Total Value Locked (TVL) across Uniswap V1-V4
 *          protocols for multiple chains
 *
 * DATA SOURCES:
 * - Primary: DefiLlama Protocol API (https://api.llama.fi)
 * - Chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC
 * - Protocols: uniswap-v1, uniswap-v2, uniswap-v3, uniswap-v4
 *
 * ANALYSIS: Current TVL snapshot across all supported protocols
 *
 * OUTPUT:
 * - Console: Formatted TVL breakdown tables
 * - CSV: Current TVL data by chain and version
 *
 * USAGE: node tvlTracker.js
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
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "Binance",
};

/** @type {number} API request timeout (ms) */
const API_TIMEOUT_MS = 10000;

// ================================================================================================
// DATA FETCHING FUNCTIONS
// ================================================================================================

/**
 * Fetches current TVL data for a specific chain across all Uniswap versions
 * @param {string} chainName - Name of the blockchain (DefiLlama format)
 * @returns {Promise<Object>} TVL data by version and totals
 */
async function getUniswapTVL(chainName) {
  const tvlData = {};

  for (const protocol of UNISWAP_VERSIONS) {
    try {
      const response = await axios.get(`${DEFILLAMA_API}/protocol/${protocol}`, {
        timeout: API_TIMEOUT_MS,
      });

      // DefiLlama uses chain names (capitalized) in currentChainTvls
      const chainTVL = response.data.currentChainTvls?.[chainName] || 0;
      tvlData[protocol] = chainTVL;
    } catch (error) {
      console.warn(`[WARN] Failed to fetch ${protocol} TVL for ${chainName}: ${error.message}`);
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
      timestamp: Math.floor(Date.now() / 1000),
      date: new Date().toISOString().split('T')[0],
      protocolsFetched: Object.keys(tvlData),
    }
  };
}

// ================================================================================================
// MAIN DATA COLLECTION
// ================================================================================================

/**
 * Collects current TVL data for all supported chains
 * @returns {Promise<Array>} TVL data organized by chain
 */
async function getPoolTVLBreakdown() {
  console.log(`[INFO] Starting current TVL data collection across all chains`);

  const tvlData = [];

  for (const [chainKey, defiLlamaChainName] of Object.entries(CHAIN_MAPPING)) {
    const chainConfig = CHAINS[chainKey];
    if (!chainConfig) {
      console.log(`[WARN] Chain config not found for key: ${chainKey}`);
      continue;
    }

    try {
      console.log(`[INFO] Fetching TVL data for ${chainConfig.name}`);
      const chainData = await getUniswapTVL(defiLlamaChainName);
      tvlData.push({
        chain: chainConfig.name,
        chainKey,
        ...chainData,
      });
      console.log(`[DEBUG] Collected ${chainConfig.name}: ${formatUSD(chainData.total)} TVL`);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch TVL for ${chainConfig.name}: ${error.message}`);
      // Add empty data structure to maintain consistency
      tvlData.push({
        chain: chainConfig.name,
        chainKey,
        v1: 0, v2: 0, v3: 0, v4: 0, total: 0,
        metadata: { error: error.message }
      });
    }

    // Rate limiting between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[INFO] TVL data collection completed: ${tvlData.length} chains processed`);
  return tvlData;
}

/**
 * Generates comprehensive TVL analysis report
 * @returns {Promise<void>}
 */
async function generateReport() {
  // Display header
  printUniswapLogo("full");
  console.log(`\n💧 UNISWAP TVL TRACKER - CURRENT STATE`);
  console.log(`══════════════════════════════════════════════`);
  console.log(`Purpose: Current TVL snapshot across Uniswap V1-V4 protocols`);
  console.log(`Chains: ${Object.keys(CHAIN_MAPPING).join(', ')}`);
  console.log(`Data Source: DefiLlama Protocol API`);
  console.log(``);

  // Fetch data
  const tvlData = await getPoolTVLBreakdown();

  if (!tvlData || tvlData.length === 0) {
    console.log(`❌ ERROR: No TVL data available`);
    return;
  }

  // Sort by total TVL (descending)
  tvlData.sort((a, b) => b.total - a.total);

  // Calculate aggregate statistics
  const aggregates = calculateTVLAggregates(tvlData);

  // Generate report sections
  generateTVLSummary(aggregates, tvlData.length);
  generateVersionBreakdown(aggregates);
  generateChainBreakdown(tvlData);

  // Export data
  await exportToCSV(tvlData);

  console.log(`✅ REPORT COMPLETE: Current TVL analysis generated successfully`);
}

/**
 * Calculates aggregate TVL statistics across all chains
 * @param {Array} tvlData - TVL data for all chains
 * @returns {Object} Aggregate statistics
 */
function calculateTVLAggregates(tvlData) {
  const totals = tvlData.reduce((acc, data) => ({
    totalTVL: acc.totalTVL + data.total,
    v1: acc.v1 + data.v1,
    v2: acc.v2 + data.v2,
    v3: acc.v3 + data.v3,
    v4: acc.v4 + data.v4,
  }), { totalTVL: 0, v1: 0, v2: 0, v3: 0, v4: 0 });

  // Calculate percentage shares
  const { totalTVL, v1, v2, v3, v4 } = totals;
  const shares = {
    v1: totalTVL > 0 ? ((v1 / totalTVL) * 100) : 0,
    v2: totalTVL > 0 ? ((v2 / totalTVL) * 100) : 0,
    v3: totalTVL > 0 ? ((v3 / totalTVL) * 100) : 0,
    v4: totalTVL > 0 ? ((v4 / totalTVL) * 100) : 0,
  };

  return { ...totals, shares };
}

/**
 * Generates the executive summary section
 * @param {Object} aggregates - Aggregate TVL statistics
 * @param {number} chainCount - Number of chains analyzed
 */
function generateTVLSummary(aggregates, chainCount) {
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 EXECUTIVE SUMMARY                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);

  console.log(`Total TVL Across All Chains: ${formatUSD(aggregates.totalTVL)}`);
  console.log(`Total Chains Analyzed: ${chainCount}`);
  console.log(`Data Timestamp: ${new Date().toISOString()}`);
  console.log(``);
}

/**
 * Generates version breakdown with visual bars
 * @param {Object} aggregates - Aggregate statistics with shares
 */
function generateVersionBreakdown(aggregates) {
  console.log(`Version Distribution:`);
  const maxVersionBar = 40;

  const versions = [
    { name: 'V1', share: aggregates.shares.v1, value: aggregates.v1 },
    { name: 'V2', share: aggregates.shares.v2, value: aggregates.v2 },
    { name: 'V3', share: aggregates.shares.v3, value: aggregates.v3 },
    { name: 'V4', share: aggregates.shares.v4, value: aggregates.v4 },
  ];

  versions.forEach(({ name, share, value }) => {
    const barLength = Math.floor((share / 100) * maxVersionBar);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxVersionBar - barLength);
    console.log(`  ${name}: ${formatUSD(value).padEnd(15)} │${bar}${emptyBar}│ ${share.toFixed(1)}%`);
  });
  console.log(``);
}

/**
 * Generates chain-by-chain TVL breakdown table
 * @param {Array} tvlData - Sorted TVL data by chain
 */
function generateChainBreakdown(tvlData) {
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 CHAIN-BY-CHAIN TVL BREAKDOWN                                                        ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Chain          │ Total TVL      │ V1 TVL        │ V2 TVL        │ V3 TVL        │ V4 TVL        │ Share    ║`);
  console.log(`╠════════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪══════════╣`);

  const totalTVL = tvlData.reduce((sum, chain) => sum + chain.total, 0);

  tvlData.forEach((chain) => {
    const share = totalTVL > 0 ? ((chain.total / totalTVL) * 100).toFixed(1) : "0.0";
    const row = [
      chain.chain.padEnd(15),
      formatUSD(chain.total).padEnd(14),
      formatUSD(chain.v1).padEnd(13),
      formatUSD(chain.v2).padEnd(13),
      formatUSD(chain.v3).padEnd(13),
      formatUSD(chain.v4).padEnd(13),
      `${share}%`.padEnd(8)
    ];
    console.log(`║ ${row.join(' │ ')} ║`);
  });

  console.log(`╚════════════════╪════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪══════════╝`);
  console.log(``);
}

/**
 * Exports TVL data to CSV file
 * @param {Array} tvlData - TVL data for all chains
 * @returns {Promise<void>}
 */
async function exportToCSV(tvlData) {
  console.log(`[INFO] Exporting TVL data to CSV...`);

  const csvData = tvlData.map(chain => ({
    timestamp: Math.floor(Date.now() / 1000),
    date: new Date().toISOString().split('T')[0],
    chain: chain.chain,
    chainKey: chain.chainKey,
    v1TVL: chain.v1 || 0,
    v2TVL: chain.v2 || 0,
    v3TVL: chain.v3 || 0,
    v4TVL: chain.v4 || 0,
    totalTVL: chain.total || 0,
    tvlSharePercent: tvlData.reduce((sum, c) => sum + c.total, 0) > 0
      ? ((chain.total / tvlData.reduce((sum, c) => sum + c.total, 0)) * 100).toFixed(2)
      : "0.00",
    // Include metadata if available
    ...(chain.metadata && { metadata: JSON.stringify(chain.metadata) })
  }));

  const csvHeaders = [
    { id: "timestamp", title: "Unix Timestamp" },
    { id: "date", title: "Date" },
    { id: "chain", title: "Chain" },
    { id: "chainKey", title: "Chain Key" },
    { id: "v1TVL", title: "V1 TVL (USD)" },
    { id: "v2TVL", title: "V2 TVL (USD)" },
    { id: "v3TVL", title: "V3 TVL (USD)" },
    { id: "v4TVL", title: "V4 TVL (USD)" },
    { id: "totalTVL", title: "Total TVL (USD)" },
    { id: "tvlSharePercent", title: "TVL Share (%)" },
    { id: "metadata", title: "Metadata" },
  ];

  await writeCSV("output/uniswap-tvl-current.csv", csvHeaders, csvData);
  console.log(`[SUCCESS] CSV exported: output/uniswap-tvl-current.csv (${csvData.length} rows)`);
}
  
  console.log(`   V1: ${v1Share.padStart(6)}% │${"█".repeat(v1BarLen)}${" ".repeat(maxVersionBar - v1BarLen)}│ ${formatUSD(totalV1)}`);
  console.log(`   V2: ${v2Share.padStart(6)}% │${"█".repeat(v2BarLen)}${" ".repeat(maxVersionBar - v2BarLen)}│ ${formatUSD(totalV2)}`);
  console.log(`   V3: ${v3Share.padStart(6)}% │${"█".repeat(v3BarLen)}${" ".repeat(maxVersionBar - v3BarLen)}│ ${formatUSD(totalV3)}`);
  console.log(`   V4: ${v4Share.padStart(6)}% │${"█".repeat(v4BarLen)}${" ".repeat(maxVersionBar - v4BarLen)}│ ${formatUSD(totalV4)}\n`);

  // Detailed Chain Table
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 TVL BY CHAIN - DETAILED BREAKDOWN                                                    ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Rank │ Chain        │ Total TVL      │ Market Share │ V1 TVL        │ V2 TVL        │ V3 TVL        │ V4 TVL        ║`);
  console.log(`╠══════╪══════════════╪════════════════╪══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╣`);

  tvlData.forEach((data, index) => {
    const rank = index + 1;
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";
    const share = totalTVL > 0 ? ((data.total / totalTVL) * 100).toFixed(2) : "0.00";
    
    // Format values to fit in table
    const totalStr = formatUSD(data.total).padEnd(14);
    const shareStr = `${share}%`.padEnd(12);
    const v1Str = formatUSD(data.v1).padEnd(13);
    const v2Str = formatUSD(data.v2).padEnd(13);
    const v3Str = formatUSD(data.v3).padEnd(13);
    const v4Str = formatUSD(data.v4).padEnd(13);
    const chainStr = data.chain.padEnd(12);
    const rankStr = `${emoji} ${rank}`.padEnd(5);

    console.log(`║ ${rankStr} │ ${chainStr} │ ${totalStr} │ ${shareStr} │ ${v1Str} │ ${v2Str} │ ${v3Str} │ ${v4Str} ║`);
  });

  console.log(`╚══════╪══════════════╪════════════════╪══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╝\n`);

  // Market Share Visualization
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              📈 MARKET SHARE BY CHAIN                          ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  const maxBarLength = 50;
  tvlData.forEach((data) => {
    const share = totalTVL > 0 ? ((data.total / totalTVL) * 100).toFixed(2) : "0.00";
    const shareNum = parseFloat(share);
    const barLength = Math.floor((shareNum / 100) * maxBarLength);
    const bar = "█".repeat(barLength);
    const emptyBar = "░".repeat(maxBarLength - barLength);
    console.log(`   ${data.chain.padEnd(12)} ${share.padStart(6)}% │${bar}${emptyBar}│`);
  });

  console.log(`\n`);

  // Export to CSV
  const csvData = tvlData.map((data) => ({
    chain: data.chain,
    v1TVL: data.v1,
    v2TVL: data.v2,
    v3TVL: data.v3,
    v4TVL: data.v4,
    totalTVL: data.total,
    marketShare: totalTVL > 0 ? ((data.total / totalTVL) * 100).toFixed(2) : "0.00",
  }));

  await writeCSV(
    "output/uniswap-tvl-aggregator.csv",
    [
      { id: "chain", title: "Chain" },
      { id: "v1TVL", title: "V1 TVL (USD)" },
      { id: "v2TVL", title: "V2 TVL (USD)" },
      { id: "v3TVL", title: "V3 TVL (USD)" },
      { id: "v4TVL", title: "V4 TVL (USD)" },
      { id: "totalTVL", title: "Total TVL (USD)" },
      { id: "marketShare", title: "Market Share (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getUniswapTVL, generateReport };

