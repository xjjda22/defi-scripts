// Extreme Capital Efficiency in Custom/Low-Fee V4 Pools
// Shows V4's flexibility with ultra-low fees generating massive volume on tiny TVL

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

const DEFILLAMA_API = "https://api.llama.fi";

// Fee tiers to analyze
const FEE_TIERS = [
  { tier: "0.01%", bps: 1 },
  { tier: "0.05%", bps: 5 },
  { tier: "0.30%", bps: 30 },
  { tier: "1.00%", bps: 100 },
];

async function getV4PoolData() {
  try {
    const response = await axios.get(`${DEFILLAMA_API}/protocol/uniswap-v4`, {
      timeout: 10000,
    });

    return {
      tvl: response.data.tvl || 0,
      volume24h: response.data.volume24h || 0,
      chainTvls: response.data.currentChainTvls || {},
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch V4 data:`, error.message);
    return { tvl: 0, volume24h: 0, chainTvls: {} };
  }
}

// Simulate pool efficiency across different fee tiers
function simulatePoolEfficiency(tvl, feeTier) {
  // V4's hooks allow for dynamic fees and concentrated liquidity
  // Lower fees typically attract more volume
  const baseVolume = tvl * 2; // Base 2x TVL daily volume

  // Volume multipliers based on fee tier
  const volumeMultipliers = {
    1: 15.0, // 0.01% - extreme efficiency for stablecoins
    5: 8.0, // 0.05%
    30: 4.0, // 0.30% - standard
    100: 2.0, // 1.00% - volatile pairs
  };

  const multiplier = volumeMultipliers[feeTier.bps] || 4.0;
  const volume24h = baseVolume * multiplier;
  const efficiencyRatio = tvl > 0 ? (volume24h / tvl) * 100 : 0;

  // Calculate APR for LPs
  const dailyFees = volume24h * (feeTier.bps / 10000);
  const annualFees = dailyFees * 365;
  const apr = tvl > 0 ? (annualFees / tvl) * 100 : 0;

  return {
    feeTier: feeTier.tier,
    volume24h,
    efficiencyRatio,
    dailyFees,
    apr,
  };
}

async function analyzeV4Efficiency() {
  printUniswapLogo("full");
  console.log(`\n⚡ Uniswap V4 Capital Efficiency Analysis`);
  console.log(`=========================================\n`);

  const v4Data = await getV4PoolData();

  console.log(`📊 Current V4 Stats:`);
  console.log(`   Total TVL:    ${formatUSD(v4Data.tvl)}`);
  console.log(`   24h Volume:   ${formatUSD(v4Data.volume24h)}\n`);

  // Analyze efficiency by chain
  const chainEntries = Object.entries(v4Data.chainTvls);
  if (chainEntries.length > 0) {
    console.log(`🌐 V4 TVL by Chain:\n`);
    chainEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([chain, tvl], index) => {
        const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
        const percentage = v4Data.tvl > 0 ? ((tvl / v4Data.tvl) * 100).toFixed(2) : "0.00";
        console.log(`${emoji} ${(index + 1)}. ${chain.padEnd(15)}: ${formatUSD(tvl)} (${percentage}%)`);
      });
  }

  // Simulate different pool configurations
  console.log(`\n💡 Simulated Pool Efficiency by Fee Tier:\n`);
  console.log(
    `${"Fee Tier".padEnd(12)} ${"Est. Volume".padEnd(18)} ${"Efficiency".padEnd(15)} ${"LP APR".padEnd(12)}`
  );
  console.log(`${"=".repeat(70)}`);

  const poolTVL = Math.max(v4Data.tvl / 10, 5000000); // Simulate 10% of TVL per pool
  const simulations = [];

  FEE_TIERS.forEach((tier) => {
    const sim = simulatePoolEfficiency(poolTVL, tier);
    simulations.push({ ...sim, poolTVL });

    const bar = "█".repeat(Math.floor(sim.efficiencyRatio / 50));
    console.log(
      `${tier.tier.padEnd(12)} ${formatUSD(sim.volume24h).padEnd(18)} ${sim.efficiencyRatio.toFixed(2).padStart(6)}%       ${sim.apr.toFixed(2).padStart(7)}%`
    );
  });

  // Highlight best performing configurations
  console.log(`\n🏆 Key Insights:\n`);
  const bestEfficiency = simulations.reduce((max, sim) =>
    sim.efficiencyRatio > max.efficiencyRatio ? sim : max
  );
  console.log(
    `   Highest Efficiency: ${bestEfficiency.feeTier} tier with ${bestEfficiency.efficiencyRatio.toFixed(2)}% ratio`
  );

  const bestAPR = simulations.reduce((max, sim) => (sim.apr > max.apr ? sim : max));
  console.log(`   Best LP Returns:    ${bestAPR.feeTier} tier with ${bestAPR.apr.toFixed(2)}% APR`);

  console.log(`\n💎 V4 Advantages:`);
  console.log(`   ✅ Custom fee tiers allow optimal price discovery`);
  console.log(`   ✅ Hooks enable dynamic strategies`);
  console.log(`   ✅ Singleton design reduces gas costs`);
  console.log(`   ✅ Ultra-low fees attract high-frequency traders\n`);

  // Real-world example
  console.log(`📈 Example: Hypothetical USDC/USDT 0.01% Pool:`);
  const stablecoinPool = simulatePoolEfficiency(6000000, FEE_TIERS[0]);
  console.log(`   TVL:          ${formatUSD(6000000)}`);
  console.log(`   Est. Volume:  ${formatUSD(stablecoinPool.volume24h)}`);
  console.log(`   Efficiency:   ${stablecoinPool.efficiencyRatio.toFixed(2)}%`);
  console.log(`   Daily Fees:   ${formatUSD(stablecoinPool.dailyFees)}`);
  console.log(`   LP APR:       ${stablecoinPool.apr.toFixed(2)}%`);
  console.log(`   Volume/TVL:   ${(stablecoinPool.volume24h / 6000000).toFixed(2)}x\n`);

  // Export to CSV
  const csvData = simulations.map((sim) => ({
    feeTier: sim.feeTier,
    poolTVL: sim.poolTVL,
    volume24h: sim.volume24h,
    efficiencyRatio: sim.efficiencyRatio.toFixed(2),
    dailyFees: sim.dailyFees,
    apr: sim.apr.toFixed(2),
  }));

  await writeCSV(
    "output/v4-capital-efficiency.csv",
    [
      { id: "feeTier", title: "Fee Tier" },
      { id: "poolTVL", title: "Pool TVL (USD)" },
      { id: "volume24h", title: "Estimated 24h Volume (USD)" },
      { id: "efficiencyRatio", title: "Efficiency Ratio (%)" },
      { id: "dailyFees", title: "Daily Fees (USD)" },
      { id: "apr", title: "LP APR (%)" },
    ],
    csvData
  );

  console.log(`✅ V4 capital efficiency analysis complete!\n`);
}

if (require.main === module) {
  analyzeV4Efficiency().catch(console.error);
}

module.exports = { simulatePoolEfficiency, analyzeV4Efficiency };

