/**
 * UniswapX — scan recent Fill events on configured reactor(s).
 * Addresses: https://docs.uniswap.org/contracts/uniswapx/deployment
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS } = require("../../../config/chains");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { createTable } = require("../../utils/displayHelpers");

const FILL_ABI = [
  "event Fill(bytes32 indexed orderHash, address indexed filler, address indexed swapper, uint256 nonce)",
];
const iface = new ethers.Interface(FILL_ABI);
const FILL_TOPIC = iface.getEvent("Fill").topicHash;

/** Mainnet V2 Dutch Order Reactor (default). Override with UNISWAPX_REACTOR. */
const DEFAULT_REACTOR = "0x00000011f84b9aa48e5f8aa8b9897600006289be";

const REACTORS_BY_CHAIN = {
  ethereum: DEFAULT_REACTOR,
  arbitrum: "0xB274d5F4b833b61B340b654d600A864fB604a87c",
  base: "0x000000001Ec5656dcdB24D90DFa42742738De729",
  unichain: "0x00000006021a6Bce796be7ba509BBBA71e956e37",
};

function parseChainKey() {
  return (process.env.CHAIN || "ethereum").toLowerCase().trim();
}

async function main() {
  installCliSafeStdout();
  const chainKey = parseChainKey();
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.error(chalk.red(`Unknown chain: ${chainKey}`));
    process.exit(1);
  }
  const reactor = (process.env.UNISWAPX_REACTOR || REACTORS_BY_CHAIN[chainKey] || "").trim();
  if (!reactor) {
    console.error(
      chalk.red(
        `No default UniswapX reactor for ${chainKey}. Set UNISWAPX_REACTOR (see https://docs.uniswap.org/contracts/uniswapx/deployment).`
      )
    );
    process.exit(1);
  }

  const maxBlocks = Math.min(Math.max(parseInt(process.env.UNISWAPX_MAX_BLOCKS || "3000", 10) || 3000, 100), 50_000);

  console.log(chalk.cyan.bold("\nUniswapX — recent Fill events\n"));
  console.log(chalk.gray(`Chain: ${chain.name} (${chainKey})`));
  console.log(chalk.gray(`Reactor: ${reactor}`));
  console.log(chalk.gray(`Block window: last ${maxBlocks} blocks (UNISWAPX_MAX_BLOCKS)\n`));

  const provider = getProvider(chainKey);
  const head = await provider.getBlockNumber();
  const fromBlock = Math.max(0, head - maxBlocks);

  const logs = await provider.getLogs({
    address: reactor,
    topics: [FILL_TOPIC],
    fromBlock,
    toBlock: head,
  });

  console.log(chalk.yellow(`Fill count: ${logs.length}\n`));
  if (!logs.length) {
    return;
  }

  const rows = logs.slice(-25).map(log => {
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    return {
      block: log.blockNumber,
      tx: log.transactionHash,
      filler: parsed.args.filler,
      swapper: parsed.args.swapper,
      nonce: parsed.args.nonce.toString(),
    };
  });

  const t = createTable(["Block", "Filler", "Swapper", "Nonce", "Tx"], {
    colAligns: ["right", "left", "left", "right", "left"],
  });
  for (const r of rows) {
    t.push([String(r.block), r.filler, r.swapper, r.nonce, r.tx]);
  }
  console.log(t.toString());
  if (logs.length > 25) {
    console.log(chalk.gray(`\n(showing last 25 of ${logs.length} fills)`));
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
