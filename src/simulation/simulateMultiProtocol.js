require("dotenv").config();
const chalk = require("chalk");
const { runDexForkSimulation } = require("./dexForkRunner");

if (require.main === module) {
  runDexForkSimulation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(chalk.red("\n❌ Simulation failed:"), error.message);
      process.exit(1);
    });
}

module.exports = { runDexForkSimulation, simulateMultiProtocolSwap: runDexForkSimulation };
