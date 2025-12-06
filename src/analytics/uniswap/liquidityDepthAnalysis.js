// Liquidity Depth and Price Impact Analysis
// Shows real-world V3 benefits (e.g., low slippage) for LPs/traders

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const DEFILLAMA_API = "https://api.llama.fi";

// Popular trading pairs to analyze
const TRADING_PAIRS = [
  { token0: "ETH", token1: "USDC", coingeckoId: "ethereum" },
  { token0: "WBTC", token1: "ETH", coingeckoId: "wrapped-bitcoin" },
  { token0: "DAI", token1: "USDC", coingeckoId: "dai" },
  { token0: "USDT", token1: "USDC", coingeckoId: "tether" },
];

// Simulate price impact for different trade sizes
function calculatePriceImpact(tradeSize, poolLiquidity, priceVolatility = 1.0) {
  // Simplified price impact model: impact increases with trade size relative to liquidity
  // Formula: impact ≈ (tradeSize / liquidity) * volatilityFactor
  if (poolLiquidity === 0) return 100;

  const baseImpact = (tradeSize / poolLiquidity) * 100;
  const adjustedImpact = baseImpact * priceVolatility;

  // Add non-linear component for large trades
  const sizeRatio = tradeSize / poolLiquidity;
  if (sizeRatio > 0.01) {
    return adjustedImpact * (1 + sizeRatio * 10);
  }

  return adjustedImpact;
}

async function getPoolLiquidity(pair) {
  try {
    // Get price data from CoinGecko
    const priceResponse = await axios.get(
      `${COINGECKO_API}/simple/price?ids=${pair.coingeckoId}&vs_currencies=usd`,
      { timeout: 10000 }
    );
    const price = priceResponse.data[pair.coingeckoId]?.usd || 0;

    // Estimate liquidity from DeFiLlama (using Uniswap V3 TVL as proxy)
    const tvlResponse = await axios.get(
      `${DEFILLAMA_API}/protocol/uniswap-v3`,
      { timeout: 10000 }
    );
    const totalTVL = tvlResponse.data.tvl || 0;

    // Estimate pair liquidity as a fraction of total TVL
    // Major pairs typically hold 5-15% of total TVL
    const estimatedPairLiquidity = totalTVL * 0.08;

    return {
      pair: `${pair.token0}/${pair.token1}`,
      price,
      liquidity: estimatedPairLiquidity,
      token: pair.token0,
    };
  } catch (error) {
    console.warn(`⚠️  Could not fetch data for ${pair.token0}/${pair.token1}:`, error.message);
    return {
      pair: `${pair.token0}/${pair.token1}`,
      price: 0,
      liquidity: 0,
      token: pair.token0,
    };
  }
}

async function analyzeLiquidityDepth() {
  printUniswapLogo("full");
  console.log(`\n💧 Uniswap V3 Liquidity Depth & Price Impact Analysis`);
  console.log(`====================================================\n`);

  const results = [];

  for (const pair of TRADING_PAIRS) {
    console.log(`📊 Analyzing ${pair.token0}/${pair.token1}...`);
    const poolData = await getPoolLiquidity(pair);

    // Simulate different trade sizes
    const tradeSizes = [10000, 50000, 100000, 500000, 1000000];
    const impacts = tradeSizes.map((size) => ({
      size,
      impact: calculatePriceImpact(size, poolData.liquidity),
    }));

    results.push({
      ...poolData,
      impacts,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limiting
  }

  // Display results
  console.log(`\n💹 Price Impact Analysis:\n`);

  results.forEach((result) => {
    console.log(`${result.pair}:`);
    console.log(`   Current Price: $${result.price.toFixed(2)}`);
    console.log(`   Pool Liquidity: ${formatUSD(result.liquidity)}\n`);

    console.log(`   Trade Size      Price Impact`);
    console.log(`   ${"=".repeat(35)}`);
    result.impacts.forEach((impact) => {
      const bar = "█".repeat(Math.min(Math.floor(impact.impact * 2), 50));
      const color = impact.impact < 0.5 ? "🟢" : impact.impact < 2 ? "🟡" : "🔴";
      console.log(
        `   ${formatUSD(impact.size).padEnd(15)} ${color} ${impact.impact.toFixed(4)}% ${bar}`
      );
    });
    console.log("");
  });

  // Summary recommendations
  console.log(`📋 Summary & Recommendations:\n`);
  results.forEach((result) => {
    const largeTradeImpact = result.impacts.find((i) => i.size === 1000000);
    if (largeTradeImpact && largeTradeImpact.impact < 1) {
      console.log(`   ✅ ${result.pair}: Excellent for large trades (<1% impact on $1M)`);
    } else if (largeTradeImpact && largeTradeImpact.impact < 3) {
      console.log(`   ⚠️  ${result.pair}: Moderate impact for large trades (~${largeTradeImpact.impact.toFixed(2)}% on $1M)`);
    } else {
      console.log(`   🔴 ${result.pair}: High impact for large trades (consider splitting)`);
    }
  });

  // Export detailed CSV
  const csvData = [];
  results.forEach((result) => {
    result.impacts.forEach((impact) => {
      csvData.push({
        pair: result.pair,
        liquidity: result.liquidity,
        tradeSize: impact.size,
        priceImpact: impact.impact.toFixed(4),
      });
    });
  });

  await writeCSV(
    "output/uniswap-liquidity-depth.csv",
    [
      { id: "pair", title: "Trading Pair" },
      { id: "liquidity", title: "Pool Liquidity (USD)" },
      { id: "tradeSize", title: "Trade Size (USD)" },
      { id: "priceImpact", title: "Price Impact (%)" },
    ],
    csvData
  );

  console.log(`\n✅ Liquidity depth analysis complete!\n`);
}

if (require.main === module) {
  analyzeLiquidityDepth().catch(console.error);
}

module.exports = { calculatePriceImpact, analyzeLiquidityDepth };

