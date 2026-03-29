/**
 * Replay a historical UniswapX fill transaction via eth_call at the same block.
 * Use UNISWAPX_REPLAY_TX or leave unset to pick the latest Fill from the reactor log window.
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");

const FILL_ABI = [
  "event Fill(bytes32 indexed orderHash, address indexed filler, address indexed swapper, uint256 nonce)",
];
const iface = new ethers.Interface(FILL_ABI);
const FILL_TOPIC = iface.getEvent("Fill").topicHash;

const REACTORS_BY_CHAIN = {
  ethereum: "0x00000011f84b9aa48e5f8aa8b9897600006289be",
  arbitrum: "0xB274d5F4b833b61B340b654d600A864fB604a87c",
  base: "0x000000001Ec5656dcdB24D90DFa42742738De729",
  unichain: "0x00000006021a6Bce796be7ba509BBBA71e956e37",
};

async function main() {
  const chainKey = (process.env.CHAIN || "ethereum").toLowerCase().trim();
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.error(chalk.red(`Unknown chain: ${chainKey}`));
    process.exit(1);
  }
  const reactor = (process.env.UNISWAPX_REACTOR || REACTORS_BY_CHAIN[chainKey] || "").trim();
  if (!reactor) {
    console.error(
      chalk.red("Set UNISWAPX_REACTOR or use chain ethereum|arbitrum|base|unichain (defaults in script).")
    );
    process.exit(1);
  }

  const provider = getProvider(chainKey);
  const replayTxHash = (process.env.UNISWAPX_REPLAY_TX || "").trim();
  let tx;

  if (replayTxHash) {
    tx = await provider.getTransaction(replayTxHash);
    if (!tx || !tx.to || tx.to.toLowerCase() !== reactor.toLowerCase()) {
      console.error(chalk.red("UNISWAPX_REPLAY_TX must be a transaction to the configured reactor."));
      process.exit(1);
    }
  } else {
    const head = await provider.getBlockNumber();
    const span = Math.min(Math.max(parseInt(process.env.UNISWAPX_MAX_BLOCKS || "200", 10) || 200, 10), 50_000);
    const fromBlock = Math.max(0, head - span);
    const chunk = Math.min(
      Math.max(parseInt(process.env.UNISWAPX_LOG_CHUNK || "10", 10) || 10, 1),
      2000
    );
    const logs = [];
    for (let start = fromBlock; start <= head; start += chunk) {
      const end = Math.min(start + chunk - 1, head);
      const part = await provider.getLogs({
        address: reactor,
        topics: [FILL_TOPIC],
        fromBlock: start,
        toBlock: end,
      });
      logs.push(...part);
    }
    if (!logs.length) {
      console.log(
        chalk.yellow(
          "No Fill events in window; set UNISWAPX_REPLAY_TX=0x… (a fill tx hash) or widen UNISWAPX_MAX_BLOCKS."
        )
      );
      process.exit(0);
    }
    const last = logs[logs.length - 1];
    tx = await provider.getTransaction(last.transactionHash);
  }

  const receipt = await provider.getTransactionReceipt(tx.hash);
  const blockTag = receipt.blockNumber;

  console.log(chalk.cyan.bold("\nUniswapX — eth_call replay at fill block\n"));
  console.log(chalk.gray(`Chain: ${chain.name} (${chainKey})`));
  console.log(chalk.gray(`Reactor: ${reactor}`));
  console.log(chalk.gray(`Tx: ${tx.hash}`));
  console.log(chalk.gray(`Block: ${blockTag}\n`));

  const strict = process.env.UNISWAPX_REPLAY_STRICT === "1";
  try {
    const out = await provider.call(
      {
        to: tx.to,
        data: tx.data,
        from: tx.from,
      },
      blockTag
    );
    console.log(chalk.green("OK: static call succeeded at historical block"));
    if (out && out !== "0x") console.log(chalk.gray(`Return data (truncated): ${String(out).slice(0, 74)}…`));
  } catch (e) {
    const msg = e.shortMessage || e.message;
    console.log(
      chalk.yellow(
        `Replay eth_call reverted at block ${blockTag} (${msg}). ` +
          `This is common without archive state or when calldata depends on transient context. ` +
          `Set UNISWAPX_REPLAY_STRICT=1 to fail the script on revert.\n`
      )
    );
    if (strict) process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
