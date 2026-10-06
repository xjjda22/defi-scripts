/**
 * DefiLlama chain TVL monitor (no protocol slug).
 * LLAMA_CHAIN_NAME defaults to "Arc" (Circle L1, chainId 5042), so `analytics:arc:chain` is unchanged.
 * Names with spaces are percent-encoded in the npm script (`Robinhood%20Chain`) and decoded here;
 * request paths are encoded again via encodeURIComponent.
 * Also prints 7d/30d TVL change from /v2/historicalChainTvl/<name> when that series is available.
 * Optional, off unless set to "1" so Arc/Blast stay TVL-only:
 *   LLAMA_CHAIN_DEX=1  — /overview/dexs/<name> 24h/7d/30d
 *   LLAMA_CHAIN_FEES=1 — /overview/fees/<name> 24h/7d/30d
 * Optional LLAMA_CHAIN_NOTE (percent-encoded) is printed after the tables.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const {
  fetchLlamaChains,
  fetchHistoricalChainTvl,
  fetchDexOverview,
  fetchChainFeesOverview,
  decodeLlamaToken,
  llamaChainNameFromEnv,
} = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency, formatPercent } = require("../../utils/displayHelpers");

function chainBanner(name) {
  if (name === "Arc") return "\nArc Chain (Circle L1, chainId 5042)\n";
  return `\n${name} (DefiLlama /v2/chains)\n`;
}

function changeOverDays(series, days) {
  if (!Array.isArray(series)) return null;
  const points = [];
  for (const p of series) {
    const tvl = p?.tvl;
    const date = p?.date;
    if (typeof tvl !== "number" || !Number.isFinite(tvl)) continue;
    if (typeof date !== "number" || !Number.isFinite(date)) continue;
    points.push({ date, tvl });
  }
  if (!points.length) return null;
  const latest = points[points.length - 1];
  const target = latest.date - days * 86400;
  let prior = null;
  for (const p of points) {
    if (p.date <= target) prior = p;
  }
  if (!prior) return null;
  const abs = latest.tvl - prior.tvl;
  const pct = prior.tvl !== 0 ? (abs / prior.tvl) * 100 : null;
  return { abs, pct };
}

function formatChange(change) {
  if (!change) return "—";
  const money = change.abs > 0 ? `+${formatCurrency(change.abs)}` : formatCurrency(change.abs);
  if (change.pct == null || !Number.isFinite(change.pct)) return `${money} (from $0)`;
  return `${money} (${formatPercent(change.pct)})`;
}

function moneyCell(row, key) {
  const n = row?.[key];
  return typeof n === "number" && Number.isFinite(n) ? formatCurrency(n) : "—";
}

async function printWindows(title, loader) {
  let data = null;
  let error = null;
  try {
    data = await loader();
  } catch (e) {
    error = e;
  }
  const t = createTable(["Window", "Value"], { colAligns: ["left", "right"] });
  t.push(["24h", moneyCell(data, "total24h")]);
  t.push(["7d", moneyCell(data, "total7d")]);
  t.push(["30d", moneyCell(data, "total30d")]);
  console.log(chalk.yellow(`\n${title}\n`));
  console.log(t.toString());
  if (error) console.log(chalk.gray(`  unavailable: ${error.message || error}`));
}

async function main() {
  installCliSafeStdout();
  const chainName = llamaChainNameFromEnv();
  console.log(chalk.cyan.bold(chainBanner(chainName)));

  try {
    const chains = await fetchLlamaChains();
    const row = chains.find(c => c.name === chainName);

    if (!row) {
      console.error(chalk.red(`${chainName} chain not found in DefiLlama chains`));
      process.exit(1);
    }

    let histError = null;
    let series = null;
    try {
      series = await fetchHistoricalChainTvl(chainName);
    } catch (e) {
      histError = e;
    }

    const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
    t.push(["Name", row.name || "—"]);
    t.push(["Chain ID", row.chainId || "—"]);
    t.push(["TVL", typeof row.tvl === "number" ? formatCurrency(row.tvl) : "—"]);
    t.push(["TVL change 7d", formatChange(changeOverDays(series, 7))]);
    t.push(["TVL change 30d", formatChange(changeOverDays(series, 30))]);
    t.push(["Gecko ID", row.gecko_id || "—"]);
    t.push(["Token Symbol", row.tokenSymbol || "—"]);

    console.log(t.toString());
    if (histError) {
      console.log(chalk.gray(`  historical TVL unavailable: ${histError.message || histError}`));
    }

    if (process.env.LLAMA_CHAIN_DEX === "1") {
      await printWindows(`DEX volume (DefiLlama /overview/dexs/${chainName})`, () => fetchDexOverview(chainName));
    }
    if (process.env.LLAMA_CHAIN_FEES === "1") {
      await printWindows(`Fees (DefiLlama /overview/fees/${chainName})`, () => fetchChainFeesOverview(chainName));
    }
    const note = decodeLlamaToken(process.env.LLAMA_CHAIN_NOTE);
    if (note) console.log(chalk.gray(`\nNote: ${note}\n`));
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
