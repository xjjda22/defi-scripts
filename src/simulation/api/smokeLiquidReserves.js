/**
 * Smoke for `src/analytics/protocols/liquid/pegReserveMonitor.js`: fails unless the liquid.network
 * audit API returns a positive L-BTC supply and a positive federation reserve. A shortfall is
 * reported, not failed on, because the claim being tracked is that the shortfall exists.
 */
require("dotenv").config();
const chalk = require("chalk");
const { fetchPegReserve } = require("../../analytics/protocols/liquid/pegReserveMonitor");

async function main() {
  try {
    const s = await fetchPegReserve();
    if (!(s.supplyBtc > 0) || !(s.reserveBtc > 0)) {
      console.error(chalk.red(`Non-positive amount: supply ${s.supplyBtc} BTC, reserve ${s.reserveBtc} BTC`));
      process.exit(1);
    }
    console.log(
      chalk.green(
        `OK: L-BTC supply ${s.supplyBtc.toFixed(2)} BTC | reserve ${s.reserveBtc.toFixed(2)} BTC | gap ${s.gapBtc.toFixed(2)} BTC | coverage ${(s.coverage * 100).toFixed(1)}%`
      )
    );
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
