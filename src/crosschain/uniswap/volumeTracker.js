// Uniswap Volume Tracker - Tracks Uniswap trading volume across multiple chains

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

// DefiLlama API for volume data
const DEFILLAMA_API = "https://api.llama.fi";

async function getUniswapVolume(chainName) {
  try {
    // Get volume for all Uniswap versions
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

        const latestData = feesResponse.data.totalDataChartBreakdown?.slice(-1)?.[0];
        if (latestData) {
          const chainData = latestData[1]?.[chainName] || {};
          // DefiLlama uses "Uniswap V1", "Uniswap V2", etc.
          const versionNum = version.charAt(1); // Extract "1", "2", "3", "4" from "v1", "v2", etc.
          const versionName = `Uniswap V${versionNum}`;
          volumeData[version] = chainData[versionName] || 0;
        }

        // Get TVL data
        const tvlResponse = await axios.get(
          `${DEFILLAMA_API}/protocol/uniswap-${version}`,
          { timeout: 10000 },
        );
        tvlData[version] = tvlResponse.data.currentChainTvls?.[chainName] || 0;
      } catch (err) {
        // Silently skip if version doesn't exist or has no data
      }
    }

    const totalVolume =
      volumeData.v1 + volumeData.v2 + volumeData.v3 + volumeData.v4;
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
    console.warn(`⚠️  Could not fetch volume for ${chainName}:`, error.message);
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

async function getChainVolumeFromDefiLlama() {
  // DefiLlama uses capitalized chain names, and "OP Mainnet" for Optimism
  const chainMapping = {
    ethereum: "Ethereum",
    arbitrum: "Arbitrum",
    optimism: "OP Mainnet",
    base: "Base",
    polygon: "Polygon",
    bsc: "BSC",
  };

  const volumes = [];

  for (const [chainKey, chainName] of Object.entries(chainMapping)) {
    const chain = CHAINS[chainKey];
    if (!chain) continue;

    console.log(`📊 Fetching volume data for ${chain.name}...`);
    const data = await getUniswapVolume(chainName);
    volumes.push({
      chain: chain.name,
      chainKey,
      ...data,
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return volumes;
}

async function generateReport() {
  printUniswapLogo("full");
  console.log(`\n📈 Uniswap Volume Tracker`);
  console.log(`=========================\n`);

  const volumes = await getChainVolumeFromDefiLlama();

  if (volumes.length === 0) {
    console.log(`❌ No volume data available.\n`);
    return;
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

