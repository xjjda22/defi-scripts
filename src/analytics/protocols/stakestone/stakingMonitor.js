/**
 * StakeStone STONE — TVL from DefiLlama; compare headline metrics to Lido where available.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { fetchYieldsChartLatest } = require("../../utils/defiLlamaYields");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");
const { fetchLidoStakingSnapshot } = require("../lido/stakingMonitor");

const STAKESTONE_LLAMA_SLUG = "stakestone-stone";

/**
 * @returns {Promise<{
 *   protocol: string,
 *   slug: string,
 *   aprPct: number|null,
 *   tvlUsd: number|null,
 *   apyFromLlama: number|null,
 *   apyFromYieldsChart: number|null,
 *   yieldsPoolId: string|null,
 *   currentChainTvls: Record<string, number>,
 *   source: string,
 * }>}
 */
async function fetchStakeStoneSnapshot() {
  const yieldsPoolId = (process.env.STAKESTONE_YIELDS_POOL_ID || "").trim() || null;
  const [data, chart] = await Promise.all([
    fetchDefiLlamaProtocol(STAKESTONE_LLAMA_SLUG),
    yieldsPoolId ? fetchYieldsChartLatest(yieldsPoolId).catch(() => null) : Promise.resolve(null),
  ]);
  const tvlUsd = lastTvlUsdFromSeries(data.tvl);
  const apy = data.apy;
  const apyFromLlama = typeof apy === "number" && Number.isFinite(apy) ? apy : null;
  const apyFromYieldsChart =
    chart != null && chart.apy != null && Number.isFinite(chart.apy)
      ? chart.apy
      : chart != null && chart.apyBase != null && Number.isFinite(chart.apyBase)
        ? chart.apyBase
        : null;
  const currentChainTvls =
    data.currentChainTvls && typeof data.currentChainTvls === "object" ? { ...data.currentChainTvls } : {};

  const aprPct = apyFromLlama ?? apyFromYieldsChart ?? null;

  return {
    protocol: data.name || "StakeStone",
    slug: STAKESTONE_LLAMA_SLUG,
    aprPct,
    tvlUsd,
    apyFromLlama,
    apyFromYieldsChart,
    yieldsPoolId,
    currentChainTvls,
    source: "DefiLlama protocol API",
  };
}

async function main() {
  installCliSafeStdout();
  try {
    const [stone, lido] = await Promise.all([fetchStakeStoneSnapshot(), fetchLidoStakingSnapshot()]);

    console.log(chalk.cyan.bold("\nStakeStone liquid staking monitor\n"));
    console.log(chalk.gray(`Data: ${stone.source} (${stone.slug})`));
    console.log(
      chalk.gray(
        "APY: protocol payload often omits apy; set STAKESTONE_YIELDS_POOL_ID for yields.llama.fi chart fallback.\n",
      ),
    );

    const t = createTable(["Metric", "Value"], { colAligns: ["left", "right"] });
    t.push(["TVL (latest series)", stone.tvlUsd != null ? formatCurrency(stone.tvlUsd) : "—"]);
    t.push(["APY (Llama protocol)", stone.apyFromLlama != null ? `${stone.apyFromLlama.toFixed(2)}%` : "—"]);
    t.push([
      "APY (yields chart)",
      stone.apyFromYieldsChart != null ? `${stone.apyFromYieldsChart.toFixed(2)}%` : "—",
    ]);
    t.push(["APY (effective)", stone.aprPct != null ? `${stone.aprPct.toFixed(2)}%` : "—"]);
    console.log(t.toString());

    const stoneChainRows = Object.entries(stone.currentChainTvls).filter(
      ([, v]) => typeof v === "number" && v > 0,
    );
    if (stoneChainRows.length) {
      const ct = createTable(["Chain (Llama)", "TVL"], { colAligns: ["left", "right"] });
      for (const [c, v] of stoneChainRows) ct.push([c, formatCurrency(v)]);
      console.log(chalk.yellow("\nTVL by chain\n"));
      console.log(ct.toString());
    }

    console.log(chalk.yellow("\nvs Lido (reference)\n"));
    const cmp = createTable(["", "Lido", "StakeStone"], { colAligns: ["left", "right", "right"] });
    cmp.push([
      "APR / APY",
      lido.aprPct != null ? `${lido.aprPct.toFixed(2)}%` : "—",
      stone.aprPct != null ? `${stone.aprPct.toFixed(2)}%` : "—",
    ]);
    cmp.push([
      "TVL",
      lido.tvlUsdTotal != null ? formatCurrency(lido.tvlUsdTotal) : "—",
      stone.tvlUsd != null ? formatCurrency(stone.tvlUsd) : "—",
    ]);
    if (lido.aprPct != null && stone.aprPct != null) {
      const d = stone.aprPct - lido.aprPct;
      cmp.push(["Δ (Stone − Lido)", "—", `${d >= 0 ? "+" : ""}${d.toFixed(2)} pp`]);
    }
    console.log(cmp.toString());
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchStakeStoneSnapshot,
  STAKESTONE_LLAMA_SLUG,
};
