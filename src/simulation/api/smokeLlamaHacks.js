/**
 * Smoke for `llamaHacksMonitor.js`: fails unless DefiLlama `/hacks` has at least one incident
 * matching LLAMA_HACK_ID / LLAMA_HACK_NAME (and LLAMA_HACK_SINCE) with a positive amount.
 */
require("dotenv").config();
const chalk = require("chalk");
const { fetchLlamaHacks } = require("../../analytics/utils/defiLlamaProtocol");
const { hackFilterFromEnv, matchHacks } = require("../../analytics/protocols/llama/llamaHacksMonitor");

async function main() {
  try {
    const f = hackFilterFromEnv();
    const rows = matchHacks(await fetchLlamaHacks(), f).filter(h => Number(h.amount) > 0);
    if (!rows.length) {
      console.error(chalk.red("No matching incident with a positive amount on /hacks"));
      process.exit(1);
    }
    for (const h of rows) {
      const day = new Date(Number(h.date) * 1000).toISOString().slice(0, 10);
      console.log(chalk.green(`OK: ${h.name} | ${day} | $${Number(h.amount).toFixed(0)}`));
    }
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
