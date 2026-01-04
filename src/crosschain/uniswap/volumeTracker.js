/**
 * Uniswap Volume Tracker - Current Trading Volume Analysis
 *
 * PURPOSE: Tracks current 24-hour trading volume across Uniswap V1-V4
 *          protocols for multiple chains
 *
 * DATA SOURCES:
 * - Primary: DefiLlama Fees API (https://api.llama.fi)
 * - Chains: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC
 * - Protocols: uniswap-v1, uniswap-v2, uniswap-v3, uniswap-v4
 *
 * ANALYSIS: Latest 24h volume snapshot across all supported protocols
 *
 * OUTPUT:
 * - Console: Formatted volume breakdown tables
 * - CSV: Current volume data by chain and version
 *
 * USAGE: node volumeTracker.js
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
  optimism: "OP Mainnet", // Note: Different from TVL tracker
  base: "Base",
  polygon: "Polygon",
  bsc: "BSC", // Note: Different from TVL tracker ("Binance")
};

/** @type {number} API request timeout (ms) */
const API_TIMEOUT_MS = 10000;

// ================================================================================================
// DATA FETCHING FUNCTIONS
// ================================================================================================

/**
 * Fetches current 24h volume data for a specific chain across all Uniswap versions
 * @param {string} chainName - Name of the blockchain (DefiLlama format)
 * @returns {Promise<Object>} Volume and TVL data by version and totals
 */
async function getUniswapVolume(chainName) {
  const volumeData = {};
  const tvlData = {};

  for (const version of UNISWAP_VERSIONS) {
    try {
      const protocolName = `uniswap-${version}`;

      // Get volume data from fees endpoint
      const feesResponse = await axios.get(
        `${DEFILLAMA_API}/summary/fees/${protocolName}`,
        { timeout: API_TIMEOUT_MS }
      );

      // Extract latest volume data point
      const latestData = feesResponse.data.totalDataChartBreakdown?.slice(-1)?.[0];
      if (latestData) {
        const chainData = latestData[1]?.[chainName] || {};
        const versionNum = version.charAt(1); // "1", "2", "3", "4"
        const versionName = `Uniswap V${versionNum}`;
        volumeData[version] = chainData[versionName] || 0;
      } else {
        volumeData[version] = 0;
      }

      // Get TVL data from protocol endpoint
      const tvlResponse = await axios.get(
        `${DEFILLAMA_API}/protocol/${protocolName}`,
        { timeout: API_TIMEOUT_MS }
      );
      tvlData[version] = tvlResponse.data.currentChainTvls?.[chainName] || 0;

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
      timestamp: Math.floor(Date.now() / 1000),
      date: new Date().toISOString().split('T')[0],
      protocolsFetched: Object.keys(volumeData),
      dataType: "24h_volume_with_tvl"
    }
  };
}

// ================================================================================================
// MAIN DATA COLLECTION
// ================================================================================================

/**
 * Collects current 24h volume data for all supported chains
 * @returns {Promise<Array>} Volume data organized by chain
 */
async function getChainVolumeFromDefiLlama() {
  console.log(`[INFO] Starting current volume data collection across all chains`);

  const volumes = [];

  for (const [chainKey, defiLlamaChainName] of Object.entries(CHAIN_MAPPING)) {
    const chainConfig = CHAINS[chainKey];
    if (!chainConfig) {
      console.log(`[WARN] Chain config not found for key: ${chainKey}`);
      continue;
    }

    try {
      console.log(`[INFO] Fetching volume data for ${chainConfig.name}`);
      const chainData = await getUniswapVolume(defiLlamaChainName);
      volumes.push({
        chain: chainConfig.name,
        chainKey,
        ...chainData,
      });
      console.log(`[DEBUG] Collected ${chainConfig.name}: ${formatUSD(chainData.volume24h)} 24h volume`);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch volume for ${chainConfig.name}: ${error.message}`);
      // Add empty data structure to maintain consistency
      volumes.push({
        chain: chainConfig.name,
        chainKey,
        v1Volume: 0, v2Volume: 0, v3Volume: 0, v4Volume: 0, volume24h: 0,
        v1TVL: 0, v2TVL: 0, v3TVL: 0, v4TVL: 0, tvl: 0,
        metadata: { error: error.message }
      });
    }

    // Rate limiting between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[INFO] Volume data collection completed: ${volumes.length} chains processed`);
  return volumes;
}

/**
 * Generates comprehensive volume analysis report
 * @returns {Promise<void>}
 */
async function generateReport() {
  // Display header
  printUniswapLogo("full");
  console.log(`\n📈 UNISWAP VOLUME TRACKER - 24H TRADING VOLUME`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Purpose: Current 24h trading volume across Uniswap V1-V4 protocols`);
  console.log(`Chains: ${Object.keys(CHAIN_MAPPING).join(', ')}`);
  console.log(`Data Source: DefiLlama Fees API`);
  console.log(``);

  // Fetch data
  const volumes = await getChainVolumeFromDefiLlama();

  if (!volumes || volumes.length === 0) {
    console.log(`❌ ERROR: No volume data available`);
    return;
  }

  // Sort by total volume (descending)
  volumes.sort((a, b) => b.volume24h - a.volume24h);

  // Calculate aggregate statistics
  const aggregates = calculateVolumeAggregates(volumes);

  // Generate report sections
  generateVolumeSummary(aggregates, volumes.length);
  generateVersionVolumeBreakdown(aggregates);
  generateChainVolumeBreakdown(volumes);

  // Export data
  await exportVolumeToCSV(volumes);

  console.log(`✅ REPORT COMPLETE: Current volume analysis generated successfully`);
}

/**
 * Calculates aggregate volume statistics across all chains
 * @param {Array} volumes - Volume data for all chains
 * @returns {Object} Aggregate statistics
 */
function calculateVolumeAggregates(volumes) {
  const totals = volumes.reduce((acc, data) => ({
    totalVolume: acc.totalVolume + data.volume24h,
    totalTVL: acc.totalTVL + data.tvl,
    v1Volume: acc.v1Volume + data.v1Volume,
    v2Volume: acc.v2Volume + data.v2Volume,
    v3Volume: acc.v3Volume + data.v3Volume,
    v4Volume: acc.v4Volume + data.v4Volume,
  }), { totalVolume: 0, totalTVL: 0, v1Volume: 0, v2Volume: 0, v3Volume: 0, v4Volume: 0 });

  // Calculate percentage shares for volume
  const { totalVolume, v1Volume, v2Volume, v3Volume, v4Volume } = totals;
  const volumeShares = {
    v1: totalVolume > 0 ? ((v1Volume / totalVolume) * 100) : 0,
    v2: totalVolume > 0 ? ((v2Volume / totalVolume) * 100) : 0,
    v3: totalVolume > 0 ? ((v3Volume / totalVolume) * 100) : 0,
    v4: totalVolume > 0 ? ((v4Volume / totalVolume) * 100) : 0,
  };

  return { ...totals, volumeShares };
}

/**
 * Generates the volume summary section
 * @param {Object} aggregates - Aggregate volume statistics
 * @param {number} chainCount - Number of chains analyzed
 */
function generateVolumeSummary(aggregates, chainCount) {
  console.log(`╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 VOLUME SUMMARY                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);

  console.log(`Total 24h Volume Across All Chains: ${formatUSD(aggregates.totalVolume)}`);
  console.log(`Total TVL Across All Chains: ${formatUSD(aggregates.totalTVL)}`);
  console.log(`Total Chains Analyzed: ${chainCount}`);
  console.log(`Data Timestamp: ${new Date().toISOString()}`);

  // Calculate volume to TVL ratio
  const volumeToTVLRatio = aggregates.totalTVL > 0
    ? ((aggregates.totalVolume / aggregates.totalTVL) * 100).toFixed(2)
    : "0.00";
  console.log(`Volume/TVL Ratio: ${volumeToTVLRatio}% (24h volume as % of TVL)`);
  console.log(``);
}

/**
 * Generates version volume breakdown with visual bars
 * @param {Object} aggregates - Aggregate statistics with volume shares
 */
function generateVersionVolumeBreakdown(aggregates) {
  console.log(`Version Volume Distribution:`);
  const maxVersionBar = 40;

  const versions = [
    { name: 'V1', share: aggregates.volumeShares.v1, value: aggregates.v1Volume },
    { name: 'V2', share: aggregates.volumeShares.v2, value: aggregates.v2Volume },
    { name: 'V3', share: aggregates.volumeShares.v3, value: aggregates.v3Volume },
    { name: 'V4', share: aggregates.volumeShares.v4, value: aggregates.v4Volume },
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
 * Generates chain-by-chain volume breakdown table
 * @param {Array} volumes - Sorted volume data by chain
 */
function generateChainVolumeBreakdown(volumes) {
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                          💰 CHAIN-BY-CHAIN VOLUME BREAKDOWN                                                     ║`);
  console.log(`╠════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ Chain          │ 24h Volume    │ V1 Volume     │ V2 Volume     │ V3 Volume     │ V4 Volume     │ Share    ║`);
  console.log(`╠════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪══════════╣`);

  const totalVolume = volumes.reduce((sum, chain) => sum + chain.volume24h, 0);

  volumes.forEach((chain) => {
    const share = totalVolume > 0 ? ((chain.volume24h / totalVolume) * 100).toFixed(1) : "0.0";
    const row = [
      chain.chain.padEnd(15),
      formatUSD(chain.volume24h).padEnd(13),
      formatUSD(chain.v1Volume).padEnd(13),
      formatUSD(chain.v2Volume).padEnd(13),
      formatUSD(chain.v3Volume).padEnd(13),
      formatUSD(chain.v4Volume).padEnd(13),
      `${share}%`.padEnd(8)
    ];
    console.log(`║ ${row.join(' │ ')} ║`);
  });

  console.log(`╚════════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪═══════════════╪══════════╝`);
  console.log(``);
}

/**
 * Exports volume data to CSV file
 * @param {Array} volumes - Volume data for all chains
 * @returns {Promise<void>}
 */
async function exportVolumeToCSV(volumes) {
  console.log(`[INFO] Exporting volume data to CSV...`);

  const csvData = volumes.map(chain => ({
    timestamp: Math.floor(Date.now() / 1000),
    date: new Date().toISOString().split('T')[0],
    chain: chain.chain,
    chainKey: chain.chainKey,
    v1Volume24h: chain.v1Volume || 0,
    v2Volume24h: chain.v2Volume || 0,
    v3Volume24h: chain.v3Volume || 0,
    v4Volume24h: chain.v4Volume || 0,
    totalVolume24h: chain.volume24h || 0,
    volumeSharePercent: volumes.reduce((sum, c) => sum + c.volume24h, 0) > 0
      ? ((chain.volume24h / volumes.reduce((sum, c) => sum + c.volume24h, 0)) * 100).toFixed(2)
      : "0.00",
    // Current TVL data
    v1TVL: chain.v1TVL || 0,
    v2TVL: chain.v2TVL || 0,
    v3TVL: chain.v3TVL || 0,
    v4TVL: chain.v4TVL || 0,
    totalTVL: chain.tvl || 0,
    // Include metadata if available
    ...(chain.metadata && { metadata: JSON.stringify(chain.metadata) })
  }));

  const csvHeaders = [
    { id: "timestamp", title: "Unix Timestamp" },
    { id: "date", title: "Date" },
    { id: "chain", title: "Chain" },
    { id: "chainKey", title: "Chain Key" },
    { id: "v1Volume24h", title: "V1 24h Volume (USD)" },
    { id: "v2Volume24h", title: "V2 24h Volume (USD)" },
    { id: "v3Volume24h", title: "V3 24h Volume (USD)" },
    { id: "v4Volume24h", title: "V4 24h Volume (USD)" },
    { id: "totalVolume24h", title: "Total 24h Volume (USD)" },
    { id: "volumeSharePercent", title: "Volume Share (%)" },
    { id: "v1TVL", title: "V1 TVL (USD)" },
    { id: "v2TVL", title: "V2 TVL (USD)" },
    { id: "v3TVL", title: "V3 TVL (USD)" },
    { id: "v4TVL", title: "V4 TVL (USD)" },
    { id: "totalTVL", title: "Total TVL (USD)" },
    { id: "metadata", title: "Metadata" },
  ];

  await writeCSV("output/uniswap-volume-current.csv", csvHeaders, csvData);
  console.log(`[SUCCESS] CSV exported: output/uniswap-volume-current.csv (${csvData.length} rows)`);
}

  // Sort by volume
  volumes.sort((a, b) => b.volume24h - a.volume24h);

  console.log(`\n💰 24h Trading Volume by Chain:\n`);
  let totalVolume = 0;
  let totalV1Volume = 0;
  let totalV2Volume = 0;
  let totalV3Volume = 0;
  let totalV4Volume = 0;

  volumes.forEach((v, index) => {
    totalVolume += v.volume24h;
    totalV1Volume += v.v1Volume;
    totalV2Volume += v.v2Volume;
    totalV3Volume += v.v3Volume;
    totalV4Volume += v.v4Volume;
    const rank = index + 1;
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";
    const versionStr = `V1: ${formatUSD(v.v1Volume)}, V2: ${formatUSD(v.v2Volume)}, V3: ${formatUSD(v.v3Volume)}, V4: ${formatUSD(v.v4Volume)}`;
    console.log(
      `${emoji} ${rank}. ${v.chain.padEnd(12)}: ${formatUSD(v.volume24h)} | TVL: ${formatUSD(v.tvl)}`,
    );
    console.log(`      ${versionStr}`);
  });

  console.log(`\n📊 Total Volume (All Chains): ${formatUSD(totalVolume)}`);
  console.log(`   V1 Volume: ${formatUSD(totalV1Volume)}`);
  console.log(`   V2 Volume: ${formatUSD(totalV2Volume)}`);
  console.log(`   V3 Volume: ${formatUSD(totalV3Volume)}`);
  console.log(`   V4 Volume: ${formatUSD(totalV4Volume)}\n`);

  // Calculate market share
  console.log(`📈 Market Share by Chain:\n`);
  volumes.forEach((v) => {
    const share = totalVolume > 0 ? ((v.volume24h / totalVolume) * 100).toFixed(2) : "0.00";
    const shareNum = parseFloat(share);
    const bar = "█".repeat(Math.floor(shareNum / 2));
    console.log(`   ${v.chain.padEnd(12)}: ${share.padStart(6)}% ${bar}`);
  });

  // Export to CSV
  const csvData = volumes.map((v) => ({
    chain: v.chain,
    v1Volume: v.v1Volume,
    v2Volume: v.v2Volume,
    v3Volume: v.v3Volume,
    v4Volume: v.v4Volume,
    volume24h: v.volume24h,
    v1TVL: v.v1TVL,
    v2TVL: v.v2TVL,
    v3TVL: v.v3TVL,
    v4TVL: v.v4TVL,
    tvl: v.tvl,
    marketShare: totalVolume > 0 ? ((v.volume24h / totalVolume) * 100).toFixed(2) : "0.00",
  }));

  await writeCSV(
    "output/uniswap-volume-comparison.csv",
    [
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
      { id: "marketShare", title: "Market Share (%)" },
    ],
    csvData,
  );

  console.log(`\n✅ Report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { getUniswapVolume, generateReport };

