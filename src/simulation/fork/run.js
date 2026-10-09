/**
 * One fork action. The npm script sets FORK_TARGET / FORK_PROTOCOL / FORK_ACTION.
 * Requires a local Anvil fork (scripts/startFork.js). Exits 1 on FAIL, 0 on PASS or SKIP.
 */

require("dotenv").config();

const TARGETS = {
  dex: () => require("./dexSwap").run(),
  pancake: () => require("./pancakeV3").run(),
  aave: () => require("./aaveFlow").run(),
  spark: () => require("./aaveFlow").run(),
  compound: () => require("./compoundV3").run(),
  morpho: () => require("./morphoBlue").run(),
  lido: () => require("./stakingFlows").run(),
  rocketpool: () => require("./stakingFlows").run(),
  cbeth: () => require("./stakingFlows").run(),
  etherfi: () => require("./stakingFlows").run(),
  kelp: () => require("./stakingFlows").run(),
  renzo: () => require("./stakingFlows").run(),
};

async function main() {
  const target = process.env.FORK_TARGET || process.env.FORK_PROTOCOL;
  const run = TARGETS[target];
  if (!run) {
    console.error(`FORK_RESULT status=FAIL protocol=${target || "-"} action=- chain=- block=-`);
    console.error(`Unknown FORK_TARGET ${target || "(unset)"}`);
    process.exit(1);
  }
  if (target !== "dex" && target !== "pancake" && !process.env.FORK_PROTOCOL) {
    process.env.FORK_PROTOCOL = target;
  }
  await run();
}

main().catch(err => {
  console.error(`FORK_RESULT status=FAIL protocol=${process.env.FORK_PROTOCOL || "-"} action=${process.env.FORK_ACTION || "-"} chain=${process.env.CHAIN || "-"} block=-`);
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
