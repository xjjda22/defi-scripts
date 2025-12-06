// Milestone and Record-Breaking Stats - Track Uniswap Volume/TVL ATHs
// Tracks celebratory, shareable "wow" moments tied to launches or upgrades

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

const DEFILLAMA_API = "https://api.llama.fi";

async function getHistoricalData(version, days = 90) {
  try {
    const response = await axios.get(
      `${DEFILLAMA_API}/protocol/uniswap-${version}`,
      { timeout: 10000 }
    );

    const tvlData = response.data.tvl || [];
    const chainTvls = response.data.chainTvls || {};

    return {
      version: version.toUpperCase(),
      tvlData,
      chainTvls,
      currentTVL: response.data.tvl?.[response.data.tvl?.length - 1]?.totalLiquidityUSD || 0,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch historical data for ${version}:`, error.message);
    return {
      version: version.toUpperCase(),
      tvlData: [],
      chainTvls: {},
      currentTVL: 0,
    };
  }
}

function findATH(tvlData) {
  if (!tvlData || tvlData.length === 0) {
    return { value: 0, date: null };
  }

  let ath = { value: 0, date: null };
  tvlData.forEach((item) => {
    const value = item.totalLiquidityUSD || 0;
    if (value > ath.value) {
      ath = {
        value,
        date: new Date(item.date * 1000).toISOString().split("T")[0],
      };
    }
  });

  return ath;
}

function calculateGrowth(tvlData, period = 30) {
  if (!tvlData || tvlData.length < period) {
    return 0;
  }

  const recent = tvlData[tvlData.length - 1]?.totalLiquidityUSD || 0;
  const past = tvlData[tvlData.length - period]?.totalLiquidityUSD || 0;

  if (past === 0) return 0;
  return ((recent - past) / past) * 100;
}

async function trackMilestones() {
  printUniswapLogo("full");
  console.log(`\n🏆 Uniswap Milestone & Record-Breaking Stats Tracker`);
  console.log(`====================================================\n`);

  const versions = ["v2", "v3", "v4"];
  const milestones = [];

  for (const version of versions) {
    console.log(`📊 Analyzing ${version.toUpperCase()} milestones...`);
    const data = await getHistoricalData(version);
    const ath = findATH(data.tvlData);
    const growth30d = calculateGrowth(data.tvlData, 30);
    const growth7d = calculateGrowth(data.tvlData, 7);

    milestones.push({
      version: data.version,
      currentTVL: data.currentTVL,
      athValue: ath.value,
      athDate: ath.date,
      distanceFromATH:
        ath.value > 0 ? ((data.currentTVL - ath.value) / ath.value) * 100 : 0,
      growth30d,
      growth7d,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Display results
  console.log(`\n💎 All-Time Highs (ATH):\n`);
  milestones.forEach((m) => {
    console.log(`${m.version}:`);
    console.log(`   Current TVL:     ${formatUSD(m.currentTVL)}`);
    console.log(`   ATH:             ${formatUSD(m.athValue)} (${m.athDate || "N/A"})`);
    const athEmoji = m.distanceFromATH >= 0 ? "🚀" : "📉";
    console.log(
      `   Distance from ATH: ${athEmoji} ${m.distanceFromATH > 0 ? "+" : ""}${m.distanceFromATH.toFixed(2)}%`
    );
    console.log(`   7-Day Growth:    ${m.growth7d > 0 ? "+" : ""}${m.growth7d.toFixed(2)}%`);
    console.log(
      `   30-Day Growth:   ${m.growth30d > 0 ? "+" : ""}${m.growth30d.toFixed(2)}%\n`
    );
  });

  // Calculate total ecosystem stats
  const totalCurrentTVL = milestones.reduce((sum, m) => sum + m.currentTVL, 0);
  const totalATH = milestones.reduce((sum, m) => sum + m.athValue, 0);

  console.log(`📈 Ecosystem-Wide Stats:\n`);
  console.log(`   Total Current TVL: ${formatUSD(totalCurrentTVL)}`);
  console.log(`   Combined ATH:      ${formatUSD(totalATH)}\n`);

  // Check for recent milestones
  console.log(`🎯 Recent Milestones:\n`);
  milestones.forEach((m) => {
    if (m.currentTVL > 1e9 && Math.abs(m.distanceFromATH) < 5) {
      console.log(`   ⭐ ${m.version} is near ATH! Only ${Math.abs(m.distanceFromATH).toFixed(2)}% away`);
    }
    if (m.growth7d > 20) {
      console.log(`   🔥 ${m.version} is surging! +${m.growth7d.toFixed(2)}% in 7 days`);
    }
    if (m.currentTVL > 3e9) {
      console.log(`   💰 ${m.version} has over $3B TVL!`);
    }
  });

  // Export to CSV
  const csvData = milestones.map((m) => ({
    version: m.version,
    currentTVL: m.currentTVL,
    athValue: m.athValue,
    athDate: m.athDate || "N/A",
    distanceFromATH: m.distanceFromATH.toFixed(2),
    growth7d: m.growth7d.toFixed(2),
    growth30d: m.growth30d.toFixed(2),
  }));

  await writeCSV(
    "output/uniswap-milestones.csv",
    [
      { id: "version", title: "Version" },
      { id: "currentTVL", title: "Current TVL (USD)" },
      { id: "athValue", title: "ATH Value (USD)" },
      { id: "athDate", title: "ATH Date" },
      { id: "distanceFromATH", title: "Distance from ATH (%)" },
      { id: "growth7d", title: "7-Day Growth (%)" },
      { id: "growth30d", title: "30-Day Growth (%)" },
    ],
    csvData
  );

  console.log(`\n✅ Milestone tracking complete!\n`);
}

if (require.main === module) {
  trackMilestones().catch(console.error);
}

module.exports = { getHistoricalData, trackMilestones };

