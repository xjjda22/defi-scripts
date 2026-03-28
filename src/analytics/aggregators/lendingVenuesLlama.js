/**
 * BSC + L2 lending TVL snapshot from DefiLlama (Compound-class + Venus).
 * Uses on-chain Aave/Morpho rates via `npm run analytics:lending:rates` for live APYs.
 *
 * Env:
 *   LENDING_LLAMA_CHAINS — comma-separated DefiLlama chain names (default: BSC, Arbitrum, Base)
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const PROTOCOLS = [
  ["Compound V3", "compound-v3"],
  ["Venus", "venus"],
];

function parseChainNeedles() {
  const raw = (process.env.LENDING_LLAMA_CHAINS || "bsc,arbitrum,base").trim();
  return raw
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function chainMatchesLlamaName(name, needles) {
  const n = String(name).toLowerCase();
  for (const needle of needles) {
    if (n.includes(needle)) return true;
    if (needle === "bsc" && n.includes("binance")) return true;
  }
  return false;
}

async function main() {
  installCliSafeStdout();
  const needles = parseChainNeedles();

  console.log(chalk.cyan.bold("\nLending venues — TVL by chain (DefiLlama)\n"));
  console.log(chalk.gray(`Chain filter: ${needles.join(", ")} — set LENDING_LLAMA_CHAINS=bsc,arbitrum,base\n`));

  for (const [label, slug] of PROTOCOLS) {
    try {
      const d = await fetchDefiLlamaProtocol(slug);
      const tvl = lastTvlUsdFromSeries(d.tvl);
      console.log(chalk.bold.white(`\n${label} (${slug})`));
      console.log(chalk.gray(`Headline TVL: ${tvl != null ? formatCurrency(tvl) : "—"}`));

      const byChain = d.currentChainTvls && typeof d.currentChainTvls === "object" ? d.currentChainTvls : {};
      const pick = Object.entries(byChain).filter(
        ([name, v]) => typeof v === "number" && v > 0 && chainMatchesLlamaName(name, needles)
      );
      if (!pick.length) {
        console.log(chalk.yellow("  (no matching chain rows — check LENDING_LLAMA_CHAINS vs Llama labels)"));
        continue;
      }
      const tb = createTable(["Chain (Llama)", "TVL"], { colAligns: ["left", "right"] });
      for (const [c, v] of pick.sort((a, b) => b[1] - a[1])) tb.push([c, formatCurrency(v)]);
      console.log(tb.toString());
    } catch (e) {
      console.log(chalk.red(`  fetch failed: ${slug} — ${e.message || e}`));
    }
  }

  console.log(chalk.gray("\nLive supply/borrow APYs: npm run analytics:lending:rates\n"));
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
