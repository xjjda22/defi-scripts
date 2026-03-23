require("dotenv").config();
const chalk = require("chalk");
const { runDexForkSimulation } = require("./dexForkRunner");

if (require.main === module) {
  runDexForkSimulation({
    title: "UNISWAP V3 TRADE SIMULATION",
    dexVariant: process.env.DEX_VARIANT || "uniswap-v3",
  })
    .then(() => process.exit(0))
    .catch(error => {
      console.error(chalk.red("\n❌ Simulation failed:"), error.message);
      process.exit(1);
    });
}

module.exports = { runDexForkSimulation };
