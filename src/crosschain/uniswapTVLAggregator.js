// Uniswap TVL Aggregator - Aggregates Uniswap pool TVL across multiple chains

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../config/chains");
const { formatUSD } = require("../utils/prices");
const { writeCSV } = require("../utils/csv");
const { printUniswapLogo } = require("../utils/ascii");

// DefiLlama API endpoints
const DEFILLAMA_API = "https://api.llama.fi";

async function getUniswapTVL(chainName) {
  try {
    // Get all Uniswap versions TVL from DefiLlama
    const protocols = ["uniswap-v1", "uniswap-v2", "uniswap-v3", "uniswap-v4"];
    const tvlData = {};

    for (const protocol of protocols) {
      try {
        const response = await axios.get(`${DEFILLAMA_API}/protocol/${protocol}`, {
          timeout: 10000,
        });

        // DefiLlama uses chain names (capitalized) in currentChainTvls
        const chainTVL = response.data.currentChainTvls?.[chainName] || 0;
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
    console.warn(`⚠️  Could not fetch TVL for ${chainName}:`, error.message);
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

async function getPoolTVLBreakdown() {
  // DefiLlama uses capitalized chain names
  const chainMapping = {
    ethereum: "Ethereum",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    base: "Base",
    polygon: "Polygon",
    bsc: "Binance", // BSC is called "Binance" in DefiLlama
  };

  const tvlData = [];

  for (const [chainKey, chainName] of Object.entries(chainMapping)) {
    const chain = CHAINS[chainKey];
    if (!chain) continue;

    console.log(`📊 Fetching TVL data for ${chain.name}...`);
    const data = await getUniswapTVL(chainName);
    tvlData.push({
      chain: chain.name,
      chainKey,
      ...data,
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return tvlData;
}

async function generateReport() {
  printUniswapLogo("full");
  console.log(`\n💧 Uniswap Pool TVL Aggregator`);
  console.log(`==============================\n`);

  const tvlData = await getPoolTVLBreakdown();

  if (tvlData.length === 0) {
    console.log(`❌ No TVL data available.\n`);
    return;
  }

  // Sort by total TVL
  tvlData.sort((a, b) => b.total - a.total);

  let totalTVL = 0;
  let totalV1 = 0;
  let totalV2 = 0;
  let totalV3 = 0;
  let totalV4 = 0;

  tvlData.forEach((data) => {
    totalTVL += data.total;
    totalV1 += data.v1;
    totalV2 += data.v2;
    totalV3 += data.v3;
    totalV4 += data.v4;
  });

  // Calculate shares
  const v1Share = totalTVL > 0 ? ((totalV1 / totalTVL) * 100).toFixed(2) : "0.00";
  const v2Share = totalTVL > 0 ? ((totalV2 / totalTVL) * 100).toFixed(2) : "0.00";
  const v3Share = totalTVL > 0 ? ((totalV3 / totalTVL) * 100).toFixed(2) : "0.00";
  const v4Share = totalTVL > 0 ? ((totalV4 / totalTVL) * 100).toFixed(2) : "0.00";

  // Summary Section
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    📊 EXECUTIVE SUMMARY                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  console.log(`   Total TVL Across All Chains: ${formatUSD(totalTVL)}`);
  console.log(`   Total Chains Tracked: ${tvlData.length}\n`);

  // Version Overview
  console.log(`   Version Breakdown:`);
  const maxVersionBar = 40;
  const v1BarLen = Math.floor((parseFloat(v1Share) / 100) * maxVersionBar);
  const v2BarLen = Math.floor((parseFloat(v2Share) / 100) * maxVersionBar);
  const v3BarLen = Math.floor((parseFloat(v3Share) / 100) * maxVersionBar);
  const v4BarLen = Math.floor((parseFloat(v4Share) / 100) * maxVersionBar);
  
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

