/**
 * Generic ERC-20 balanceOf read for a watched holder contract (e.g. a bridge / vault after an exploit).
 * Used when a protocol has no DefiLlama slug but the claim is checkable on-chain.
 *
 * Env:
 *   ERC20_TOKEN   (required) token address
 *   ERC20_HOLDER  (required) holder / contract address to read
 *   ERC20_CHAIN   (optional) chain key from src/config/chains.js (default: ethereum; needs *_RPC_URL)
 *   ERC20_LABEL   (optional) banner title
 *   ERC20_SMOKE=1 (optional) print a one-line OK and exit non-zero on failure (used by simulate:*:smoke)
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { createTable } = require("../../utils/displayHelpers");

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

function normalizeAddress(raw, name) {
  const v = (raw || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
    throw new Error(`Set ${name} to a 0x-prefixed 20-byte address`);
  }
  return ethers.getAddress(v.toLowerCase());
}

async function readBalance({ token, holder, chain }) {
  const provider = getProvider(chain);
  const c = new ethers.Contract(token, ERC20_ABI, provider);
  const [sym, dec, bal, block, code] = await Promise.all([
    c.symbol(),
    c.decimals(),
    c.balanceOf(holder),
    provider.getBlockNumber(),
    provider.getCode(holder),
  ]);
  return { sym, human: ethers.formatUnits(bal, dec), block, isContract: code && code !== "0x" };
}

async function main() {
  installCliSafeStdout();
  const smoke = process.env.ERC20_SMOKE === "1";
  const chain = (process.env.ERC20_CHAIN || "ethereum").trim();
  const token = normalizeAddress(process.env.ERC20_TOKEN, "ERC20_TOKEN");
  const holder = normalizeAddress(process.env.ERC20_HOLDER, "ERC20_HOLDER");
  const label = (process.env.ERC20_LABEL || `${holder} balance`).trim();

  const r = await readBalance({ token, holder, chain });

  if (smoke) {
    console.log(chalk.green(`OK: ${label} | ${r.human} ${r.sym} @ block ${r.block} (${chain})`));
    return;
  }

  console.log(chalk.cyan.bold(`\n${label} (on-chain)\n`));
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Chain", chain]);
  t.push(["Token", `${r.sym} (${token})`]);
  t.push(["Holder", `${holder}${r.isContract ? " (contract)" : " (EOA)"}`]);
  t.push(["Balance", `${r.human} ${r.sym}`]);
  t.push(["Block", String(r.block)]);
  console.log(t.toString());
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { readBalance };
