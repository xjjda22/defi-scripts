require("dotenv").config();
const chalk = require("chalk");
const { fetchLlamaChains } = require("../../analytics/utils/defiLlamaProtocol");
const { L2_CHAINS, matchChainRow } = require("../../analytics/aggregators/l2Overview");

async function main() {
  const chains = await fetchLlamaChains();
  if (!Array.isArray(chains) || chains.length < 10) {
    console.error("expected llama /v2/chains array");
    process.exit(1);
  }
  let ok = 0;
  for (const spec of L2_CHAINS) {
    const row = matchChainRow(chains, spec.llamaNames);
    if (row) {
      console.log(chalk.green(`  ${spec.key}: ${row.name} TVL $${Math.round(row.tvl || 0)}`));
      ok++;
    } else {
      console.log(chalk.red(`  ${spec.key}: missing`));
    }
  }
  if (ok < 5) process.exit(1);
  console.log(chalk.green(`\nOK (${ok}/${L2_CHAINS.length} L2s on DefiLlama chains)\n`));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
