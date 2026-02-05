/**
 * Balancer Volume Tracker - Cross-Chain Analysis
 * Tracks 24h trading volume across Balancer deployments
 */

require("dotenv").config();
const axios = require("axios");
const { CHAINS } = require("../../config/chains");
const { formatUSD } = require("../../utils/prices");
const { writeCSV } = require("../../utils/csv");
const chalk = require("chalk");

const DEFILLAMA_API = "https://api.llama.fi";
const BALANCER_PROTOCOL_SLUG = "balancer";
const API_TIMEOUT_MS = 10000;

const CHAIN_MAPPING = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "Binance",
};

async function fetchBalancerVolume() {
  try {
    const response = await axios.get(`${DEFILLAMA_API}/summary/dexs/${BALANCER_PROTOCOL_SLUG}`, {
      timeout: API_TIMEOUT_MS,
    });
    return response.data;
  } catch (error) {
    console.error(chalk.red("Error fetching Balancer volume:"), error.message);
    return null;
  }
}

function processVolumeData(data) {
  if (!data || !data.chains) {
    return {};
  }

  const volumeByChain = {};

  for (const [chainKey, chainName] of Object.entries(CHAIN_MAPPING)) {
    if (data.chains[chainName]) {
      volumeByChain[chainKey] = {
        name: chainName,
        volume24h: data.chains[chainName] || 0,
      };
    }
  }

  return volumeByChain;
}

function displayVolume(volumeByChain, totalVolume) {
  console.log("\n" + "=".repeat(80));
  console.log(chalk.cyan.bold("  BALANCER - CROSS-CHAIN 24H VOLUME"));
  console.log("=".repeat(80) + "\n");

  const sortedChains = Object.entries(volumeByChain).sort((a, b) => b[1].volume24h - a[1].volume24h);

  console.log(chalk.bold("24h Volume by Chain:"));
  console.log("─".repeat(80));

  for (const [chainKey, data] of sortedChains) {
    const percentage = totalVolume > 0 ? ((data.volume24h / totalVolume) * 100).toFixed(2) : "0.00";
    const bar = "█".repeat(Math.floor(parseFloat(percentage) / 2));

    console.log(
      chalk.cyan(`${data.name.padEnd(15)}`),
      chalk.yellow(formatUSD(data.volume24h).padStart(15)),
      chalk.gray(`(${percentage}%)`.padStart(10)),
      chalk.green(bar)
    );
  }

  console.log("─".repeat(80));
  console.log(
    chalk.bold("Total 24h Volume:".padEnd(19)),
    chalk.yellow.bold(formatUSD(totalVolume).padStart(15))
  );
  console.log("=".repeat(80) + "\n");
}

async function main() {
  console.log(chalk.cyan("\nFetching Balancer 24h volume data...\n"));

  const data = await fetchBalancerVolume();

  if (!data) {
    console.error(chalk.red("Failed to fetch Balancer volume data"));
    process.exit(1);
  }

  const volumeByChain = processVolumeData(data);
  const totalVolume = data.total24h || 0;

  displayVolume(volumeByChain, totalVolume);

  const csvData = Object.entries(volumeByChain).map(([chainKey, data]) => ({
    chain: data.name,
    volume24h: data.volume24h,
    percentage: totalVolume > 0 ? ((data.volume24h / totalVolume) * 100).toFixed(2) : "0.00",
  }));

  if (csvData.length > 0) {
    await writeCSV("balancer_volume_crosschain.csv", csvData);
  } else {
    console.log(chalk.yellow("No chain-specific volume data available"));
  }
  console.log(chalk.green("Data exported to balancer_volume_crosschain.csv\n"));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchBalancerVolume, processVolumeData };
