/**
 * BUIDL (or any ERC-20) — totalSupply when BUIDL_TOKEN_ADDRESS is set.
 * Default Llama slug for fund TVL: blackrock-buidl (see analytics:buidl:markets).
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
  "function totalSupply() view returns (uint256)",
];

async function main() {
  installCliSafeStdout();
  const addr = (process.env.BUIDL_TOKEN_ADDRESS || "").trim();
  console.log(chalk.cyan.bold("\nBUIDL / ERC-20 supply (optional)\n"));

  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    console.log(
      chalk.yellow(
        "Set BUIDL_TOKEN_ADDRESS to an ERC-20 (e.g. BlackRock BUIDL on Ethereum) to read totalSupply. Skipping on-chain read."
      )
    );
    console.log(chalk.gray("DefiLlama: npm run analytics:buidl:markets\n"));
    return;
  }

  const provider = getProvider("ethereum");
  const c = new ethers.Contract(addr, ERC20_ABI, provider);
  const [sym, dec, sup] = await Promise.all([c.symbol(), c.decimals(), c.totalSupply()]);
  const human = ethers.formatUnits(sup, dec);
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Token", `${sym} (${addr})`]);
  t.push(["totalSupply", `${human} ${sym}`]);
  console.log(t.toString());
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
