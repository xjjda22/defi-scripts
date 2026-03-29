/**
 * Ethena — DefiLlama TVL + public asset-availability + mainnet USDe / sUSDe totalSupply.
 */

require("dotenv").config();
const axios = require("axios");
const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

// https://docs.ethena.fi/api-documentation/overview
const USDE_MAINNET = "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3";
const SUSDE_MAINNET = "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497";

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nEthena monitor\n"));

  const slug = (process.env.ETHENA_LLAMA_SLUG || "ethena").trim();
  try {
    const d = await fetchDefiLlamaProtocol(slug);
    const tvl = lastTvlUsdFromSeries(d.tvl);
    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["DefiLlama slug", slug]);
    t.push(["Name", d.name || "—"]);
    t.push(["TVL (latest)", tvl != null ? formatCurrency(tvl) : "—"]);
    t.push(["URL", d.url || "—"]);
    console.log(chalk.yellow("DefiLlama\n"));
    console.log(t.toString());
    if (d.currentChainTvls && typeof d.currentChainTvls === "object") {
      const rows = Object.entries(d.currentChainTvls).filter(([, v]) => typeof v === "number" && v > 0);
      if (rows.length) {
        const ct = createTable(["Chain", "TVL"], { colAligns: ["left", "right"] });
        for (const [c, v] of rows) ct.push([c, formatCurrency(v)]);
        console.log(chalk.yellow("\nTVL by chain\n"));
        console.log(ct.toString());
      }
    }
  } catch (e) {
    console.log(chalk.red(`DefiLlama: ${e.message || e}`));
  }

  try {
    const { data } = await axios.get("https://public.api.ethena.fi/asset-availability", {
      timeout: 15_000,
      headers: { Accept: "application/json", "User-Agent": "defi-scripts/ethena-monitor" },
    });
    const a = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    a.push(["mint pairs", JSON.stringify(data.mint || [])]);
    a.push(["redeem pairs", JSON.stringify(data.redeem || [])]);
    console.log(chalk.yellow("\nMint / redeem pairs (public API)\n"));
    console.log(a.toString());
  } catch (e) {
    console.log(chalk.gray(`asset-availability: ${e.message || e}`));
  }

  const provider = getProvider("ethereum");
  for (const addr of [USDE_MAINNET, SUSDE_MAINNET]) {
    try {
      const c = new ethers.Contract(addr, ERC20_ABI, provider);
      const [sym, dec, sup] = await Promise.all([c.symbol(), c.decimals(), c.totalSupply()]);
      const human = ethers.formatUnits(sup, dec);
      const tb = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
      tb.push(["Token", `${sym} (${addr})`]);
      tb.push(["totalSupply", `${human} ${sym}`]);
      console.log(chalk.yellow(`\nOn-chain ${sym}\n`));
      console.log(tb.toString());
    } catch (e) {
      console.log(chalk.gray(`On-chain ${addr}: ${e.message || e}`));
    }
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
