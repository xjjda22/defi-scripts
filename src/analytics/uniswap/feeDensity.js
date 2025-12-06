// Fees Generated per Dollar of TVL (Fee Density/Efficiency)
// Shows real profitability, exposing overcapitalized vs efficient protocols

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

const DEFILLAMA_API = "https://api.llama.fi";

// Protocols to compare against Uniswap
const PROTOCOLS = [
  { id: "uniswap-v2", name: "Uniswap V2", category: "AMM" },
  { id: "uniswap-v3", name: "Uniswap V3", category: "AMM" },
  { id: "uniswap-v4", name: "Uniswap V4", category: "AMM" },
  { id: "curve-dex", name: "Curve", category: "AMM" },
  { id: "aave-v3", name: "Aave V3", category: "Lending" },
  { id: "pancakeswap", name: "PancakeSwap", category: "AMM" },
];

async function getProtocolMetrics(protocolId) {
  try {
    // Get protocol data
    const protocolResponse = await axios.get(
      `${DEFILLAMA_API}/protocol/${protocolId}`,
      { timeout: 10000 }
    );

    // Get fees data
    const feesResponse = await axios.get(
      `${DEFILLAMA_API}/summary/fees/${protocolId}`,
      { timeout: 10000 }
    );

    const tvl = protocolResponse.data.tvl || 0;
    const total24h = feesResponse.data.total24h || 0;
    const total7d = feesResponse.data.total7d || 0;
    const total30d = feesResponse.data.total30d || 0;

    // Calculate fee density (fees / TVL)
    const dailyDensity = tvl > 0 ? (total24h / tvl) * 100 : 0;
    const weeklyDensity = tvl > 0 ? (total7d / tvl) * 100 : 0;
    const monthlyDensity = tvl > 0 ? (total30d / tvl) * 100 : 0;
    const annualizedDensity = dailyDensity * 365;

    return {
      protocolId,
      tvl,
      fees24h: total24h,
      fees7d: total7d,
      fees30d: total30d,
      dailyDensity,
      weeklyDensity,
      monthlyDensity,
      annualizedDensity,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch data for ${protocolId}:`, error.message);
    return {
      protocolId,
      tvl: 0,
      fees24h: 0,
      fees7d: 0,
      fees30d: 0,
      dailyDensity: 0,
      weeklyDensity: 0,
      monthlyDensity: 0,
      annualizedDensity: 0,
    };
  }
}

async function analyzeFeeDensity() {
  printUniswapLogo("full");
  console.log(`\n💎 Protocol Fee Density Analysis (Fees per $ of TVL)`);
  console.log(`====================================================\n`);

  const results = [];

  for (const protocol of PROTOCOLS) {
    console.log(`📊 Fetching data for ${protocol.name}...`);
    const metrics = await getProtocolMetrics(protocol.id);
    results.push({
      ...metrics,
      name: protocol.name,
      category: protocol.category,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Sort by monthly fee density
  results.sort((a, b) => b.monthlyDensity - a.monthlyDensity);

  console.log(`\n📈 Fee Density Rankings (30-Day):\n`);
  console.log(
    `${"Rank".padEnd(6)} ${"Protocol".padEnd(18)} ${"TVL".padEnd(18)} ${"30d Fees".padEnd(18)} ${"Density".padEnd(12)} ${"Category".padEnd(10)}`
  );
  console.log(`${"=".repeat(90)}`);

  results.forEach((result, index) => {
    const rank = index + 1;
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";
    const bar = "█".repeat(Math.floor(result.monthlyDensity * 5));

    console.log(
      `${(emoji + " " + rank).padEnd(6)} ${result.name.padEnd(18)} ${formatUSD(result.tvl).padEnd(18)} ${formatUSD(result.fees30d).padEnd(18)} ${result.monthlyDensity.toFixed(3).padStart(6)}%     ${result.category.padEnd(10)}`
    );
    console.log(`       ${bar}\n`);
  });

  // Detailed breakdown for Uniswap versions
  console.log(`\n🔬 Uniswap Version Comparison:\n`);
  const uniswapVersions = results.filter((r) => r.name.includes("Uniswap"));

  uniswapVersions.forEach((v) => {
    console.log(`${v.name}:`);
    console.log(`   TVL:               ${formatUSD(v.tvl)}`);
    console.log(`   24h Fees:          ${formatUSD(v.fees24h)}`);
    console.log(`   30d Fees:          ${formatUSD(v.fees30d)}`);
    console.log(`   Daily Density:     ${v.dailyDensity.toFixed(4)}%`);
    console.log(`   Monthly Density:   ${v.monthlyDensity.toFixed(4)}%`);
    console.log(`   Annualized:        ${v.annualizedDensity.toFixed(2)}%\n`);
  });

  // Calculate efficiency scores
  console.log(`📊 Efficiency Analysis:\n`);

  const avgDensity =
    results.reduce((sum, r) => sum + r.monthlyDensity, 0) / results.length;
  console.log(`   Average Density (All Protocols): ${avgDensity.toFixed(3)}%\n`);

  results.forEach((r) => {
    const vsAverage = ((r.monthlyDensity - avgDensity) / avgDensity) * 100;
    if (Math.abs(vsAverage) > 20) {
      const emoji = vsAverage > 0 ? "🚀" : "📉";
      console.log(
        `   ${emoji} ${r.name}: ${vsAverage > 0 ? "+" : ""}${vsAverage.toFixed(1)}% vs average`
      );
    }
  });

  // Key insights
  console.log(`\n💡 Key Insights:\n`);

  const topProtocol = results[0];
  console.log(
    `   🏆 ${topProtocol.name} has the highest fee density at ${topProtocol.monthlyDensity.toFixed(3)}%`
  );

  const v3 = results.find((r) => r.name === "Uniswap V3");
  const v2 = results.find((r) => r.name === "Uniswap V2");

  if (v3 && v2 && v2.monthlyDensity > 0) {
    const improvement = (v3.monthlyDensity / v2.monthlyDensity).toFixed(2);
    console.log(
      `   ⚡ Uniswap V3 is ${improvement}x more capital efficient than V2`
    );
  }

  console.log(`\n   📌 Fee density reveals true protocol efficiency:`);
  console.log(`      • High density = productive capital`);
  console.log(`      • Low density = overcapitalized or low activity`);
  console.log(`      • AMMs typically outperform lending protocols\n`);

  // Export to CSV
  const csvData = results.map((r) => ({
    protocol: r.name,
    category: r.category,
    tvl: r.tvl,
    fees24h: r.fees24h,
    fees30d: r.fees30d,
    dailyDensity: r.dailyDensity.toFixed(4),
    monthlyDensity: r.monthlyDensity.toFixed(4),
    annualizedDensity: r.annualizedDensity.toFixed(2),
  }));

  await writeCSV(
    "output/fee-density-analysis.csv",
    [
      { id: "protocol", title: "Protocol" },
      { id: "category", title: "Category" },
      { id: "tvl", title: "TVL (USD)" },
      { id: "fees24h", title: "24h Fees (USD)" },
      { id: "fees30d", title: "30d Fees (USD)" },
      { id: "dailyDensity", title: "Daily Density (%)" },
      { id: "monthlyDensity", title: "Monthly Density (%)" },
      { id: "annualizedDensity", title: "Annualized Density (%)" },
    ],
    csvData
  );

  console.log(`✅ Fee density analysis complete!\n`);
}

if (require.main === module) {
  analyzeFeeDensity().catch(console.error);
}

module.exports = { getProtocolMetrics, analyzeFeeDensity };

