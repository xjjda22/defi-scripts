require("dotenv").config();
const chalk = require("chalk");
const { fetchLlamaChains, llamaChainNameFromEnv } = require("../../analytics/utils/defiLlamaProtocol");

async function main() {
  const chainName = llamaChainNameFromEnv();
  const minRaw = process.env.LLAMA_CHAIN_MIN_TVL_USD;
  const minTvl = minRaw == null || String(minRaw).trim() === "" ? null : parseFloat(minRaw);
  try {
    const chains = await fetchLlamaChains();
    const row = chains.find(c => c.name === chainName);

    if (!row) {
      console.error(chalk.red(`${chainName} chain not found`));
      process.exit(1);
    }

    if (typeof row.tvl !== "number" || !Number.isFinite(row.tvl)) {
      console.error(chalk.red(`${chainName} TVL is not a finite number`));
      process.exit(1);
    }

    if (minTvl != null && Number.isFinite(minTvl) && row.tvl < minTvl) {
      console.error(chalk.red(`TVL below LLAMA_CHAIN_MIN_TVL_USD (${minTvl})`));
      process.exit(1);
    }

    console.log(chalk.green(`OK: ${row.name} chain | TVL $${row.tvl.toFixed(0)} | chainId ${row.chainId || "?"}`));
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
