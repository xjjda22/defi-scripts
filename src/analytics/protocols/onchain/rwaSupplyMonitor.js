/**
 * Tokenized-fund value on Ethereum: on-chain totalSupply x DefiLlama coins price.
 * DefiLlama's protocol endpoints return an empty TVL for RWA listings (Ondo, BUIDL),
 * so this reads the tokens directly. Other chains (Solana, Aptos, ...) are not summed.
 *
 * Env:
 *   RWA_TOKENS (required) comma-separated keys of `RWA` in src/catalog/contracts.js (e.g. "usdy,ousg")
 *   RWA_LABEL  (optional) banner title
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { RWA } = require("../../../catalog/contracts");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchCoinPrices } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

function tokenKeysFromEnv() {
  const keys = (process.env.RWA_TOKENS || "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);
  if (!keys.length) throw new Error("Set RWA_TOKENS (e.g. usdy,ousg)");
  for (const k of keys) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(RWA[k] || "")) throw new Error(`Unknown RWA token key "${k}"`);
  }
  return keys;
}

/**
 * @param {string[]} keys
 * @returns {Promise<{ key: string, symbol: string, supply: number, price: number|null, valueUsd: number|null }[]>}
 */
async function readRwaTokens(keys) {
  const provider = getProvider("ethereum");
  const prices = await fetchCoinPrices(keys.map(k => `ethereum:${RWA[k]}`));
  return Promise.all(
    keys.map(async key => {
      const c = new ethers.Contract(RWA[key], ERC20_ABI, provider);
      const [symbol, decimals, raw] = await Promise.all([c.symbol(), c.decimals(), c.totalSupply()]);
      const supply = Number(ethers.formatUnits(raw, decimals));
      const price = prices[`ethereum:${RWA[key]}`]?.price ?? null;
      return { key, symbol, supply, price, valueUsd: price != null ? supply * price : null };
    })
  );
}

async function main() {
  installCliSafeStdout();
  const keys = tokenKeysFromEnv();
  const label = (process.env.RWA_LABEL || keys.join(", ")).trim();
  console.log(chalk.cyan.bold(`\n${label} (Ethereum supply x DefiLlama price)\n`));

  const rows = await readRwaTokens(keys);
  const t = createTable(["Token", "Supply", "Price", "Value"], { colAligns: ["left", "right", "right", "right"] });
  for (const r of rows) {
    t.push([
      r.symbol,
      r.supply.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      r.price != null ? `$${r.price.toFixed(4)}` : "n/a",
      r.valueUsd != null ? formatCurrency(r.valueUsd) : "n/a",
    ]);
  }
  const total = rows.reduce((a, r) => a + (r.valueUsd || 0), 0);
  t.push([chalk.bold("Total"), "", "", chalk.bold(formatCurrency(total))]);
  console.log(t.toString());
  console.log(chalk.gray("\nEthereum only. Issuers also mint on other chains, so this is a floor, not total AUM."));
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { readRwaTokens, tokenKeysFromEnv };
