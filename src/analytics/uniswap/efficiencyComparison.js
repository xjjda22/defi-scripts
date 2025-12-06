// Efficiency Comparisons - Volume/TVL Ratios Across Uniswap Versions
// Demonstrates V3's concentrated liquidity superiority over V2 (up to 4x more efficient)

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

// DefiLlama API for volume and TVL data
const DEFILLAMA_API = "https://api.llama.fi";

async function getVersionData(version) {
  try {
    // Get fees/volume data
    const feesResponse = await axios.get(
      `${DEFILLAMA_API}/summary/fees/uniswap-${version}`,
      { timeout: 10000 }
    );

    // Get TVL data
    const tvlResponse = await axios.get(
      `${DEFILLAMA_API}/protocol/uniswap-${version}`,
      { timeout: 10000 }
    );

    const latestFees = feesResponse.data.total24h || 0;
    const latestVolume = latestFees * 100; // Approximate volume from fees (assuming 1% fee)
    
    // TVL can be an array of historical data or a number
    // Extract the latest TVL value from the array if it's an array
    let tvl = 0;
    if (Array.isArray(tvlResponse.data.tvl)) {
      const latestTvlEntry = tvlResponse.data.tvl[tvlResponse.data.tvl.length - 1];
      tvl = latestTvlEntry?.totalLiquidityUSD || latestTvlEntry?.value || 0;
    } else if (typeof tvlResponse.data.tvl === 'number') {
      tvl = tvlResponse.data.tvl;
    } else {
      // Fallback: sum up currentChainTvls if available
      const chainTvls = tvlResponse.data.currentChainTvls || {};
      tvl = Object.values(chainTvls).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }

    // Get breakdown by chain if available
    const chainTvls = tvlResponse.data.currentChainTvls || {};
    const chainBreakdown = Object.entries(chainTvls)
      .map(([chain, value]) => ({ chain, tvl: typeof value === 'number' ? value : 0 }))
      .filter((item) => item.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl);

    return {
      version: version.toUpperCase(),
      volume24h: latestVolume,
      tvl,
      efficiencyRatio: tvl > 0 ? (latestVolume / tvl) * 100 : 0,
      chainBreakdown,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch data for ${version}:`, error.message);
    return {
      version: version.toUpperCase(),
      volume24h: 0,
      tvl: 0,
      efficiencyRatio: 0,
      chainBreakdown: [],
    };
  }
}

async function compareVersions() {
  printUniswapLogo("full");
  console.log(`\n📊 Uniswap Efficiency Comparison: Volume/TVL Ratios`);
  console.log(`=====================================================\n`);

  const versions = ["v2", "v3", "v4"];
  const results = [];

  for (const version of versions) {
    console.log(`📈 Fetching data for Uniswap ${version.toUpperCase()}...`);
    const data = await getVersionData(version);
    results.push(data);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limiting
  }

  console.log(`\n💰 Capital Efficiency Comparison:\n`);
  console.log(`${"Version".padEnd(10)} ${"24h Volume".padEnd(18)} ${"TVL".padEnd(18)} ${"Efficiency %".padEnd(15)} ${"Bar"}`);
  console.log(`${"=".repeat(80)}`);

  results.forEach((data) => {
    const bar = "█".repeat(Math.floor(data.efficiencyRatio / 2));
    console.log(
      `${data.version.padEnd(10)} ${formatUSD(data.volume24h).padEnd(18)} ${formatUSD(data.tvl).padEnd(18)} ${data.efficiencyRatio.toFixed(2).padStart(6)}%       ${bar}`
    );
  });

  // Calculate relative efficiency
  const v2Data = results.find((r) => r.version === "V2");
  const v3Data = results.find((r) => r.version === "V3");
  const v4Data = results.find((r) => r.version === "V4");

  if (v2Data && v3Data && v2Data.efficiencyRatio > 0) {
    const v3Improvement = (v3Data.efficiencyRatio / v2Data.efficiencyRatio).toFixed(2);
    console.log(`\n🚀 V3 is ${v3Improvement}x more efficient than V2!`);
  }

  if (v3Data && v4Data && v3Data.efficiencyRatio > 0) {
    const v4Improvement = (v4Data.efficiencyRatio / v3Data.efficiencyRatio).toFixed(2);
    console.log(`🚀 V4 is ${v4Improvement}x more efficient than V3!`);
  }

  // Top chains by TVL for V3
  if (v3Data.chainBreakdown.length > 0) {
    console.log(`\n🌐 Top V3 Chains by TVL:\n`);
    v3Data.chainBreakdown.slice(0, 5).forEach((item, index) => {
      const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
      console.log(`${emoji} ${(index + 1)}. ${item.chain.padEnd(15)}: ${formatUSD(item.tvl)}`);
    });
  }

  // Export to CSV
  const csvData = results.map((r) => ({
    version: r.version,
    volume24h: r.volume24h,
    tvl: r.tvl,
    efficiencyRatio: r.efficiencyRatio.toFixed(2),
  }));

  await writeCSV(
    "output/uniswap-efficiency-comparison.csv",
    [
      { id: "version", title: "Version" },
      { id: "volume24h", title: "24h Volume (USD)" },
      { id: "tvl", title: "TVL (USD)" },
      { id: "efficiencyRatio", title: "Efficiency Ratio (%)" },
    ],
    csvData
  );

  console.log(`\n✅ Efficiency comparison complete!\n`);
}

if (require.main === module) {
  compareVersions().catch(console.error);
}

module.exports = { getVersionData, compareVersions };

