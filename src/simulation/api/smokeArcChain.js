require("dotenv").config();
const chalk = require("chalk");
const { fetchLlamaChains } = require("../../analytics/utils/defiLlamaProtocol");

async function main() {
  try {
    const chains = await fetchLlamaChains();
    const arcRow = chains.find(c => c.name === "Arc");

    if (!arcRow) {
      console.error(chalk.red("Arc chain not found"));
      process.exit(1);
    }

    if (typeof arcRow.tvl !== "number" || !Number.isFinite(arcRow.tvl)) {
      console.error(chalk.red("Arc TVL is not a finite number"));
      process.exit(1);
    }

    console.log(chalk.green(`OK: Arc chain | TVL $${arcRow.tvl.toFixed(0)} | chainId ${arcRow.chainId || "?"}`));
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
