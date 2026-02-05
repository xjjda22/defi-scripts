/**
 * Curve TVL Tracker - Cross-Chain Analysis
 * Tracks TVL across Curve Finance deployments on multiple chains
 */

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const chalk = require("chalk");

const DEFILLAMA_API = "https://api.llama.fi";
const CURVE_PROTOCOL_SLUG = "curve-dex";
const CHAIN_MAPPING = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "Binance",
};
const API_TIMEOUT_MS = 10000;
async function fetchCurveTVL() {
  try {
    const response = await axios.get(`${DEFILLAMA_API}/protocol/${CURVE_PROTOCOL_SLUG}`, {
      timeout: API_TIMEOUT_MS,
    });
    return response.data;
  } catch (error) {
    console.error(chalk.red("Error fetching Curve TVL:"), error.message);
    return null;
  }
}

function processTVLData(protocolData) {
  if (!protocolData || !protocolData.chainTvls) {
    return {};
  }

  const tvlByChain = {};
  const chainTvls = protocolData.chainTvls;

  for (const [chainKey, chainName] of Object.entries(CHAIN_MAPPING)) {
    if (chainTvls[chainName]) {
      const chainData = chainTvls[chainName];
      let tvlValue = 0;
      
      if (Array.isArray(chainData.tvl) && chainData.tvl.length > 0) {
        tvlValue = chainData.tvl[chainData.tvl.length - 1].totalLiquidityUSD || 0;
      } else if (typeof chainData.tvl === 'number') {
        tvlValue = chainData.tvl;
      } else if (typeof chainData === 'number') {
        tvlValue = chainData;
      }
      
      tvlByChain[chainKey] = {
        name: chainName,
        tvl: tvlValue,
      };
    }
  }

  return tvlByChain;
}

function displayTVL(tvlByChain, totalTVL) {
  console.log("\n" + "=".repeat(80));
  console.log(chalk.cyan.bold("  CURVE FINANCE - CROSS-CHAIN TVL TRACKER"));
  console.log("=".repeat(80) + "\n");

  const sortedChains = Object.entries(tvlByChain).sort((a, b) => b[1].tvl - a[1].tvl);

  console.log(chalk.bold("TVL by Chain:"));
  console.log("─".repeat(80));

  for (const [chainKey, data] of sortedChains) {
    const percentage = totalTVL > 0 ? ((data.tvl / totalTVL) * 100).toFixed(2) : "0.00";
    const bar = "█".repeat(Math.floor(parseFloat(percentage) / 2));

    console.log(
      chalk.cyan(`${data.name.padEnd(15)}`),
      chalk.yellow(formatUSD(data.tvl).padStart(15)),
      chalk.gray(`(${percentage}%)`.padStart(10)),
      chalk.green(bar)
    );
  }

  console.log("─".repeat(80));
  console.log(
    chalk.bold("Total TVL:".padEnd(15)),
    chalk.yellow.bold(formatUSD(totalTVL).padStart(15))
  );
  console.log("=".repeat(80) + "\n");
}

async function main() {
  console.log(chalk.cyan("\nFetching Curve Finance TVL data from DefiLlama...\n"));

  const protocolData = await fetchCurveTVL();
  if (!protocolData) {
    console.error(chalk.red("Failed to fetch Curve TVL data"));
    process.exit(1);
  }

  const tvlByChain = processTVLData(protocolData);
  
  let totalTVL = 0;
  if (Array.isArray(protocolData.tvl) && protocolData.tvl.length > 0) {
    totalTVL = protocolData.tvl[protocolData.tvl.length - 1].totalLiquidityUSD || 0;
  } else if (typeof protocolData.tvl === 'number') {
    totalTVL = protocolData.tvl;
  }

  displayTVL(tvlByChain, totalTVL);

  const csvData = Object.entries(tvlByChain).map(([chainKey, data]) => ({
    chain: data.name,
    tvl: data.tvl,
    percentage: totalTVL > 0 ? ((data.tvl / totalTVL) * 100).toFixed(2) : "0.00",
  }));

  await writeCSV("curve_tvl_crosschain.csv", csvData);
  console.log(chalk.green("Data exported to curve_tvl_crosschain.csv\n"));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchCurveTVL, processTVLData };
