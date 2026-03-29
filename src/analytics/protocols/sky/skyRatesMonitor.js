/**
 * Sky / Maker — DSR from Maker Pot (mainnet) + DefiLlama TVL rows for Maker & Sky.
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

// Sky / Maker Pot (DSR) — https://etherscan.io/address/0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7
const POT = "0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7";
const RAY = 10n ** 27n;
const SECONDS_PER_YEAR = 365n * 24n * 3600n;

const POT_ABI = [
  "function dsr() view returns (uint256)",
  "function chi() view returns (uint256)",
  "function rho() view returns (uint256)",
  "function Pie() view returns (uint256)",
];

function approxDsrApyPercent(dsrBig) {
  const base = Number(dsrBig) / Number(RAY);
  if (!Number.isFinite(base) || base <= 0 || base > 2) return null;
  return (Math.pow(base, Number(SECONDS_PER_YEAR)) - 1) * 100;
}

function savingsDaiFromPot(pie, chi) {
  try {
    const v = (pie * chi) / RAY;
    return ethers.formatUnits(v, 18);
  } catch {
    return null;
  }
}

async function llamaRow(label, slug) {
  try {
    const d = await fetchDefiLlamaProtocol(slug);
    const tvl = lastTvlUsdFromSeries(d.tvl);
    return { name: d.name || label, tvl, url: d.url || "—", slug };
  } catch (e) {
    return { name: label, tvl: null, url: "—", slug, err: e.message };
  }
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nSky / Maker monitor\n"));

  const provider = getProvider("ethereum");
  const pot = new ethers.Contract(POT, POT_ABI, provider);

  const [dsr, chi, rho, pie] = await Promise.all([pot.dsr(), pot.chi(), pot.rho(), pot.Pie()]);
  const apy = approxDsrApyPercent(dsr);
  const savingsDai = savingsDaiFromPot(pie, chi);
  const now = Math.floor(Date.now() / 1000);
  const rhoLag = now - Number(rho);

  const onchain = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  onchain.push(["Pot", POT]);
  onchain.push(["dsr (ray)", dsr.toString()]);
  onchain.push(["chi (ray)", chi.toString()]);
  onchain.push(["rho", `${rho.toString()} (${rhoLag}s ago)`]);
  onchain.push(["Pie (wad)", pie.toString()]);
  if (savingsDai != null) onchain.push(["~DAI in Pot (Pie*chi/RAY)", savingsDai]);
  onchain.push(["DSR ~APY (compound approx.)", apy != null ? `${apy.toFixed(4)}%` : "—"]);
  console.log(chalk.yellow("Maker Pot (DSR)\n"));
  console.log(onchain.toString());

  const makerSlug = (process.env.MAKER_LLAMA_SLUG || "makerdao").trim();
  const skySlug = (process.env.SKY_LLAMA_SLUG || "sky").trim();

  console.log(chalk.yellow("\nDefiLlama\n"));
  for (const [label, slug] of [
    ["MakerDAO", makerSlug],
    ["Sky", skySlug],
  ]) {
    const row = await llamaRow(label, slug);
    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["Slug", row.slug]);
    t.push(["Name", row.name]);
    t.push(["TVL (latest)", row.tvl != null ? formatCurrency(row.tvl) : row.err || "—"]);
    t.push(["URL", row.url]);
    console.log(chalk.gray(`\n${label}`));
    console.log(t.toString());
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
