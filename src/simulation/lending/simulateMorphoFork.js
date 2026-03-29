/**
 * Read Morpho Blue market state on-chain. Same Morpho address on supported EVM chains.
 * There is no swap:morpho — use Aave-style supply/borrow only if you extend this script.
 */

require("dotenv").config();
const axios = require("axios");
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { getForkContext, printForkContext } = require("../lib/forkSimEnv");

const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";

const MARKET_ABI = [
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)",
];

async function fetchTopMarketUniqueKey(chainId) {
  const query = `
    query Q($w: MarketFilters) {
      markets(first: 1, orderBy: BorrowAssetsUsd, orderDirection: Desc, where: $w) {
        items { uniqueKey }
      }
    }
  `;
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    { query, variables: { w: { chainId_in: [chainId], listed: true } } },
    {
      timeout: 25_000,
      headers: { "Content-Type": "application/json", "User-Agent": "defi-scripts/morpho-fork" },
    }
  );
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join("; "));
  const k = data.data?.markets?.items?.[0]?.uniqueKey;
  if (!k) throw new Error("No Morpho markets returned for this chain");
  return k;
}

async function main() {
  const CHAIN = process.env.CHAIN || "ethereum";
  const chain = CHAINS[CHAIN];
  if (!chain?.chainId) {
    console.error(chalk.red(`Unknown chain: ${CHAIN}`));
    process.exit(1);
  }

  const ctx = await getForkContext(CHAIN);
  printForkContext(CHAIN, ctx, { simulateOnly: true });

  let marketId = (process.env.MORPHO_MARKET_ID || "").trim();
  if (!marketId) {
    console.log(chalk.gray("Fetching top market uniqueKey from Morpho API…"));
    marketId = await fetchTopMarketUniqueKey(chain.chainId);
  }

  const idBytes = marketId.startsWith("0x") ? marketId : `0x${marketId}`;
  if (!ethers.isHexString(idBytes, 32)) {
    console.error(chalk.red("MORPHO_MARKET_ID must be a 32-byte hex string (uniqueKey from Morpho API)."));
    process.exit(1);
  }

  const provider = getProvider(CHAIN);
  const morpho = new ethers.Contract(MORPHO_BLUE, MARKET_ABI, provider);
  const m = await morpho.market(idBytes);

  console.log(chalk.cyan.bold("\nMorpho Blue — market() (read-only)\n"));
  console.log(chalk.gray(`  chain: ${chain.name} (${CHAIN})`));
  console.log(chalk.gray(`  marketId: ${idBytes}`));
  console.log(`  totalSupplyAssets: ${m[0]}`);
  console.log(`  totalSupplyShares: ${m[1]}`);
  console.log(`  totalBorrowAssets: ${m[2]}`);
  console.log(`  totalBorrowShares: ${m[3]}`);
  console.log(chalk.gray("\nNo npm swap:morpho — lending, not a DEX.\n"));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
