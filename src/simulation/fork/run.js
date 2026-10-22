/**
 * One fork action. The npm script sets FORK_TARGET / FORK_PROTOCOL / FORK_ACTION.
 * Requires a local Anvil fork (scripts/startFork.js). Exits 1 on FAIL, 0 on PASS or SKIP.
 */

require("dotenv").config();
const { ethers } = require("ethers");

// Anvil 1.8 can return the hash from eth_sendTransaction before the block is mined. If the
// first receipt lookup misses and the block lands before ethers records its baseline block
// number, TransactionResponse.wait() never sees a "new" block and hangs until the watchdog.
// While the tx is unmined, Anvil also forwards the receipt lookup to the upstream RPC, and a
// public endpoint can answer with an error ("Archive requests require a personal token"),
// which ethers surfaces as "could not coalesce error". Poll for the receipt first, treating
// those errors as "not mined yet", then hand off to ethers so revert handling is unchanged.
// The run watchdog below still bounds the wait.
const RECEIPT_POLL_MS = 100;
const originalWait = ethers.TransactionResponse.prototype.wait;
async function minedReceipt(provider, hash) {
  try {
    return await provider.getTransactionReceipt(hash);
  } catch {
    return null;
  }
}
ethers.TransactionResponse.prototype.wait = async function waitForReceipt(confirms, timeout) {
  if (confirms !== 0) {
    while (!(await minedReceipt(this.provider, this.hash))) {
      await new Promise(resolve => setTimeout(resolve, RECEIPT_POLL_MS));
    }
  }
  return originalWait.call(this, confirms, timeout);
};

// eth_estimateGas on Anvil 1.8 can come back tight enough that a nested call runs out of gas
// when the tx lands in the next second (Aave borrow: inner OutOfGas, outer Revert). Pad
// estimates by 30% for transactions that do not set their own gasLimit.
const GAS_PAD_NUM = 13n;
const GAS_PAD_DEN = 10n;
const originalSendUnchecked = ethers.JsonRpcSigner.prototype.sendUncheckedTransaction;
ethers.JsonRpcSigner.prototype.sendUncheckedTransaction = async function sendPadded(tx) {
  if (tx && tx.gasLimit == null) {
    const estimate = await this.estimateGas(tx);
    tx = { ...tx, gasLimit: (estimate * GAS_PAD_NUM) / GAS_PAD_DEN };
  }
  return originalSendUnchecked.call(this, tx);
};

const TARGETS = {
  dex: () => require("./dexSwap").run(),
  uniswapv4: () => require("./uniswapV4").run(),
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
  sky: () => require("./stableFlows").run(),
  ethena: () => require("./stableFlows").run(),
  circle: () => require("./stableFlows").run(),
  tether: () => require("./stableFlows").run(),
  frax: () => require("./stableFlows").run(),
  buidl: () => require("./stableFlows").run(),
  ondo: () => require("./stableFlows").run(),
  superstate: () => require("./stableFlows").run(),
  arbitrum: () => require("./bridgeFlows").run(),
  robinhood: () => require("./bridgeFlows").run(),
  "world-chain": () => require("./bridgeFlows").run(),
  starknet: () => require("./bridgeFlows").run(),
  polygon: () => require("./bridgeFlows").run(),
  "lighter-bridge": () => require("./bridgeFlows").run(),
  wbeth: () => require("./lstDepositFlows").run(),
  "meta-pool": () => require("./lstDepositFlows").run(),
  stakewise: () => require("./lstDepositFlows").run(),
  "near-bridge": () => require("./bridgeFlows").run(),
  portal: () => require("./bridgeFlows").run(),
  ccip: () => require("./bridgeFlows").run(),
  base: () => require("./bridgeFlows").run(),
  optimism: () => require("./bridgeFlows").run(),
  across: () => require("./bridgeFlows").run(),
  stargate: () => require("./bridgeFlows").run(),
  steakhouse: () => require("./vaultFlows").run(),
  gauntlet: () => require("./vaultFlows").run(),
  sentora: () => require("./vaultFlows").run(),
  veda: () => require("./vaultFlows").run(),
  upshift: () => require("./vaultFlows").run(),
  yearn: () => require("./vaultFlows").run(),
  euler: () => require("./vaultFlows").run(),
  rockawayx: () => require("./vaultFlows").run(),
  llamalend: () => require("./vaultFlows").run(),
  "spark-vaults": () => require("./vaultFlows").run(),
  "lista-dao": () => require("./vaultFlows").run(),
  clearstar: () => require("./vaultFlows").run(),
  hyperithm: () => require("./vaultFlows").run(),
  concrete: () => require("./vaultFlows").run(),
  lista: () => require("./listaStakeFlow").run(),
  venus: () => require("./venusFlow").run(),
  usdai: () => require("./usdaiFlow").run(),
  dolomite: () => require("./dolomiteFlow").run(),
  eigenlayer: () => require("./restakeFlows").run(),
  symbiotic: () => require("./restakeFlows").run(),
  swell: () => require("./restakeFlows").run(),
  puffer: () => require("./restakeFlows").run(),
  gmx: () => require("./perpFlows").run(),
};

// Every fork test has a hard deadline so a stuck RPC call cannot hang the suite.
// FORK_TEST_TIMEOUT_MS (default 180000) is shared with scripts/forkSuite.js.
const TIMEOUT_MS = parseInt(process.env.FORK_TEST_TIMEOUT_MS || "180000", 10);

function armWatchdog() {
  if (!(TIMEOUT_MS > 0)) return;
  const timer = setTimeout(() => {
    console.log(
      `\nFORK_RESULT status=FAIL protocol=${process.env.FORK_PROTOCOL || "-"} action=${process.env.FORK_ACTION || "-"} chain=${process.env.CHAIN || "-"} block=- key=timeout=${TIMEOUT_MS}ms`
    );
    console.error(`Fork test timed out after ${TIMEOUT_MS} ms`);
    process.exit(1);
  }, TIMEOUT_MS);
  timer.unref();
}

async function main() {
  armWatchdog();
  const target = process.env.FORK_TARGET || process.env.FORK_PROTOCOL;
  const run = TARGETS[target];
  if (!run) {
    console.error(`FORK_RESULT status=FAIL protocol=${target || "-"} action=- chain=- block=-`);
    console.error(`Unknown FORK_TARGET ${target || "(unset)"}`);
    process.exit(1);
  }
  if (target !== "dex" && target !== "pancake" && target !== "uniswapv4" && !process.env.FORK_PROTOCOL) {
    process.env.FORK_PROTOCOL = target;
  }
  await run();
}

main().catch(err => {
  console.error(`FORK_RESULT status=FAIL protocol=${process.env.FORK_PROTOCOL || "-"} action=${process.env.FORK_ACTION || "-"} chain=${process.env.CHAIN || "-"} block=-`);
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
