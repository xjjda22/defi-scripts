/**
 * Arc chain monitor (Circle L1, chainId 5042).
 * Reuses fetchLlamaChains from defiLlamaProtocol.js (same helper as l2Overview).
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchLlamaChains } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nArc Chain (Circle L1, chainId 5042)\n"));

  try {
    const chains = await fetchLlamaChains();
    const arcRow = chains.find(c => c.name === "Arc");

    if (!arcRow) {
      console.error(chalk.red("Arc chain not found in DefiLlama chains"));
      process.exit(1);
    }

    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["Name", arcRow.name || "—"]);
    t.push(["Chain ID", arcRow.chainId || "—"]);
    t.push(["TVL", typeof arcRow.tvl === "number" ? formatCurrency(arcRow.tvl) : "—"]);
    t.push(["Gecko ID", arcRow.gecko_id || "—"]);
    t.push(["Token Symbol", arcRow.tokenSymbol || "—"]);

    console.log(t.toString());
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
