/**
 * DefiLlama chain TVL monitor (no protocol slug).
 * LLAMA_CHAIN_NAME defaults to "Arc" (Circle L1, chainId 5042), so `analytics:arc:chain` is unchanged.
 * Also prints 7d/30d TVL change from /v2/historicalChainTvl/<name> when that series is available.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchLlamaChains, fetchHistoricalChainTvl } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency, formatPercent } = require("../../utils/displayHelpers");

function chainNameFromEnv() {
  return (process.env.LLAMA_CHAIN_NAME || "Arc").trim() || "Arc";
}

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

async function main() {
  installCliSafeStdout();
  const chainName = chainNameFromEnv();
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
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
