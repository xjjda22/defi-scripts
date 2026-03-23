require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { CHAINS } = require("../../config/chains");

const MORPHO_GRAPHQL = "https://blue-api.morpho.org/graphql";

async function morphoGraphql(query, variables) {
  const { data } = await axios.post(
    MORPHO_GRAPHQL,
    { query, variables },
    {
      timeout: 25_000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "defi-scripts/morpho-smoke",
      },
    },
  );
  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }
  return data.data;
}

async function main() {
  const chainKey = process.env.CHAIN || "ethereum";
  const chain = CHAINS[chainKey];
  if (!chain?.chainId) {
    console.error(chalk.red(`Unknown chain ${chainKey}`));
    process.exit(1);
  }

  const query = `
    query Smoke($where: MarketFilters) {
      markets(first: 3, orderBy: BorrowAssetsUsd, orderDirection: Desc, where: $where) {
        items { uniqueKey loanAsset { symbol } state { borrowAssetsUsd } }
      }
    }
  `;
  const where = { chainId_in: [chain.chainId], listed: true };
  const result = await morphoGraphql(query, { where });
  const items = result?.markets?.items || [];
  if (!items.length) {
    console.error(chalk.red("No markets returned"));
    process.exit(1);
  }
  console.log(chalk.green(`OK: ${items.length} market(s) on ${chain.name}`));
  for (const m of items) {
    console.log(chalk.gray(`  ${m.uniqueKey?.slice(0, 20)}… ${m.loanAsset?.symbol}`));
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
