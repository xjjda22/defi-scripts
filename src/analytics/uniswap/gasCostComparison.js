// Gas Cost Savings - V3 vs. V4 Pool Creation and Swaps
// Demonstrates V4's technical leap with 10-20x gas reductions

require("dotenv").config();
const axios = require("axios");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const { printUniswapLogo } = require("../../utils/ascii");

// Historical gas data for different operations
const GAS_BENCHMARKS = {
  poolCreation: {
    v2: { gas: 2500000, description: "V2 Factory.createPair()" },
    v3: { gas: 5200000, description: "V3 Factory.createPool()" },
    v4: { gas: 431000, description: "V4 Singleton.initialize()" },
  },
  singleSwap: {
    v2: { gas: 120000, description: "V2 Router.swapExactTokensForTokens()" },
    v3: { gas: 180000, description: "V3 Router.exactInputSingle()" },
    v4: { gas: 95000, description: "V4 PoolManager.swap() with hooks" },
  },
  multiHopSwap: {
    v2: { gas: 220000, description: "V2 3-hop swap" },
    v3: { gas: 350000, description: "V3 3-hop swap" },
    v4: { gas: 180000, description: "V4 3-hop swap (singleton)" },
  },
  addLiquidity: {
    v2: { gas: 130000, description: "V2 add liquidity" },
    v3: { gas: 250000, description: "V3 mint position" },
    v4: { gas: 150000, description: "V4 add liquidity with hooks" },
  },
};

async function getGasPrice() {
  try {
    // Get current gas price from Etherscan or similar
    // Placeholder: use average mainnet gas price
    const response = await axios.get(
      "https://api.etherscan.io/api?module=gastracker&action=gasoracle",
      { timeout: 10000 }
    );

    const gasPrice = response.data?.result?.ProposeGasPrice || 30; // gwei
    return parseFloat(gasPrice);
  } catch (error) {
    console.warn("⚠️  Could not fetch gas price, using default 30 gwei");
    return 30;
  }
}

async function getETHPrice() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { timeout: 10000 }
    );
    return response.data?.ethereum?.usd || 2000;
  } catch (error) {
    console.warn("⚠️  Could not fetch ETH price, using default $2000");
    return 2000;
  }
}

function calculateGasCost(gasUnits, gasPriceGwei, ethPriceUSD) {
  const gasCostETH = (gasUnits * gasPriceGwei) / 1e9;
  const gasCostUSD = gasCostETH * ethPriceUSD;
  return { eth: gasCostETH, usd: gasCostUSD };
}

async function compareGasCosts() {
  printUniswapLogo("full");
  console.log(`\n⛽ Uniswap Gas Cost Comparison: V2 vs V3 vs V4`);
  console.log(`==============================================\n`);

  const gasPrice = await getGasPrice();
  const ethPrice = await getETHPrice();

  console.log(`📊 Current Conditions:`);
  console.log(`   Gas Price: ${gasPrice} gwei`);
  console.log(`   ETH Price: ${formatUSD(ethPrice)}\n`);

  const results = [];

  for (const [operation, versions] of Object.entries(GAS_BENCHMARKS)) {
    console.log(`🔧 ${operation.replace(/([A-Z])/g, " $1").trim()}:\n`);

    const operationResults = [];
    for (const [version, data] of Object.entries(versions)) {
      const cost = calculateGasCost(data.gas, gasPrice, ethPrice);
      operationResults.push({
        version: version.toUpperCase(),
        gas: data.gas,
        costETH: cost.eth,
        costUSD: cost.usd,
      });

      console.log(`   ${version.toUpperCase().padEnd(4)}: ${data.description}`);
      console.log(`         Gas Used: ${data.gas.toLocaleString()} units`);
      console.log(`         Cost:     ${cost.eth.toFixed(6)} ETH (${formatUSD(cost.usd)})\n`);
    }

    // Calculate savings
    const v2Cost = operationResults.find((r) => r.version === "V2")?.costUSD || 0;
    const v3Cost = operationResults.find((r) => r.version === "V3")?.costUSD || 0;
    const v4Cost = operationResults.find((r) => r.version === "V4")?.costUSD || 0;

    if (v2Cost > 0 && v4Cost > 0) {
      const savingsVsV2 = ((v2Cost - v4Cost) / v2Cost) * 100;
      console.log(`   💰 V4 saves ${savingsVsV2.toFixed(1)}% vs V2`);
    }
    if (v3Cost > 0 && v4Cost > 0) {
      const savingsVsV3 = ((v3Cost - v4Cost) / v3Cost) * 100;
      const multiplier = v3Cost / v4Cost;
      console.log(
        `   💰 V4 saves ${savingsVsV3.toFixed(1)}% vs V3 (${multiplier.toFixed(1)}x cheaper)\n`
      );
    }

    results.push({
      operation,
      ...operationResults.reduce((acc, r) => {
        acc[`${r.version}_gas`] = r.gas;
        acc[`${r.version}_cost`] = r.costUSD;
        return acc;
      }, {}),
    });
  }

  // Summary
  console.log(`\n📈 Key Takeaways:\n`);

  const poolCreationV3 = GAS_BENCHMARKS.poolCreation.v3.gas;
  const poolCreationV4 = GAS_BENCHMARKS.poolCreation.v4.gas;
  const poolSavings = ((poolCreationV3 - poolCreationV4) / poolCreationV3) * 100;
  console.log(
    `   🏭 Pool Creation: V4 uses ${poolSavings.toFixed(0)}% less gas than V3`
  );
  console.log(
    `      ${formatUSD(calculateGasCost(poolCreationV3 - poolCreationV4, gasPrice, ethPrice).usd)} saved per deployment!`
  );

  const swapV3 = GAS_BENCHMARKS.singleSwap.v3.gas;
  const swapV4 = GAS_BENCHMARKS.singleSwap.v4.gas;
  const swapSavings = ((swapV3 - swapV4) / swapV3) * 100;
  console.log(`\n   💱 Single Swap: V4 uses ${swapSavings.toFixed(0)}% less gas than V3`);
  console.log(
    `      ${formatUSD(calculateGasCost(swapV3 - swapV4, gasPrice, ethPrice).usd)} saved per swap`
  );

  const multiV3 = GAS_BENCHMARKS.multiHopSwap.v3.gas;
  const multiV4 = GAS_BENCHMARKS.multiHopSwap.v4.gas;
  const multiSavings = ((multiV3 - multiV4) / multiV3) * 100;
  console.log(`\n   🔀 Multi-Hop: V4 uses ${multiSavings.toFixed(0)}% less gas than V3`);
  console.log(`      Singleton architecture eliminates redundant checks`);

  console.log(`\n   ⚡ V4's singleton design is a game-changer:`);
  console.log(`      • All pools in one contract = less overhead`);
  console.log(`      • Native ETH support = no WETH wrapping`);
  console.log(`      • Hook efficiency = customizable without bloat\n`);

  // Export to CSV
  const csvData = [];
  for (const [operation, versions] of Object.entries(GAS_BENCHMARKS)) {
    for (const [version, data] of Object.entries(versions)) {
      const cost = calculateGasCost(data.gas, gasPrice, ethPrice);
      csvData.push({
        operation: operation.replace(/([A-Z])/g, " $1").trim(),
        version: version.toUpperCase(),
        description: data.description,
        gasUnits: data.gas,
        costETH: cost.eth.toFixed(6),
        costUSD: cost.usd.toFixed(2),
      });
    }
  }

  await writeCSV(
    "output/gas-cost-comparison.csv",
    [
      { id: "operation", title: "Operation" },
      { id: "version", title: "Version" },
      { id: "description", title: "Description" },
      { id: "gasUnits", title: "Gas Units" },
      { id: "costETH", title: "Cost (ETH)" },
      { id: "costUSD", title: "Cost (USD)" },
    ],
    csvData
  );

  console.log(`✅ Gas cost comparison complete!\n`);
}

if (require.main === module) {
  compareGasCosts().catch(console.error);
}

module.exports = { calculateGasCost, compareGasCosts };

