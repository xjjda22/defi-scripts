require("dotenv").config();
const chalk = require("chalk");
const { fetchLlamaChains, llamaChainNameFromEnv } = require("../../analytics/utils/defiLlamaProtocol");
const { stablecoinSeries, fetchChainStablecoins } = require("../../analytics/protocols/llama/arcChainMonitor");

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

    // Optional LLAMA_CHAIN_STABLES_MIN_USD: also require the chain's stablecoin market cap
    // (stablecoins.llama.fi/stablecoincharts/<name>, latest point) above this value.
    const stablesRaw = process.env.LLAMA_CHAIN_STABLES_MIN_USD;
    let stablesNote = "";
    if (stablesRaw != null && String(stablesRaw).trim() !== "") {
      const minStables = parseFloat(stablesRaw);
      const series = stablecoinSeries(await fetchChainStablecoins(chainName));
      const last = series[series.length - 1];
      if (!last || !(last.tvl > (Number.isFinite(minStables) ? minStables : 0))) {
        console.error(chalk.red(`${chainName} stablecoin market cap is not above LLAMA_CHAIN_STABLES_MIN_USD (${stablesRaw})`));
        process.exit(1);
      }
      stablesNote = ` | stablecoins $${last.tvl.toFixed(0)}`;
    }

    console.log(chalk.green(`OK: ${row.name} chain | TVL $${row.tvl.toFixed(0)} | chainId ${row.chainId || "?"}${stablesNote}`));
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
