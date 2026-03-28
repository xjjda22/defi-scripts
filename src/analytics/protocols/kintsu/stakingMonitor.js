/**
 * Kintsu — TVL from DefiLlama; compare to Lido and StakeStone snapshots.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { fetchYieldsChartLatest } = require("../../utils/defiLlamaYields");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");
const { fetchLidoStakingSnapshot } = require("../lido/stakingMonitor");
const { fetchStakeStoneSnapshot } = require("../stakestone/stakingMonitor");

const KINTSU_LLAMA_SLUG = "kintsu";

/** SMON liquid staking on Monad — UUID from yields.llama.fi (override with KINTSU_YIELDS_POOL_ID). */
const DEFAULT_KINTSU_YIELDS_POOL_ID = "73c511a9-4dc0-4397-babe-e578fd75f0dd";

/**
 * @returns {Promise<{
 *   protocol: string,
 *   slug: string,
 *   aprPct: number|null,
 *   tvlUsd: number|null,
 *   apyFromLlama: number|null,
 *   apyFromYieldsChart: number|null,
 *   yieldsPoolId: string,
 *   currentChainTvls: Record<string, number>,
 *   source: string,
 * }>}
 */
async function fetchKintsuSnapshot() {
  const yieldsPoolId = (process.env.KINTSU_YIELDS_POOL_ID || "").trim() || DEFAULT_KINTSU_YIELDS_POOL_ID;
  const [data, chart] = await Promise.all([
    fetchDefiLlamaProtocol(KINTSU_LLAMA_SLUG),
    fetchYieldsChartLatest(yieldsPoolId).catch(() => null),
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
    protocol: data.name || "Kintsu",
    slug: KINTSU_LLAMA_SLUG,
    aprPct,
    tvlUsd,
    apyFromLlama,
    apyFromYieldsChart,
    yieldsPoolId,
    currentChainTvls,
    source: "DefiLlama protocol API + yields chart",
  };
}

async function main() {
  installCliSafeStdout();
  try {
    const [k, lido, stone] = await Promise.all([
      fetchKintsuSnapshot(),
      fetchLidoStakingSnapshot(),
      fetchStakeStoneSnapshot(),
    ]);

    console.log(chalk.cyan.bold("\nKintsu liquid staking monitor\n"));
    console.log(chalk.gray(`Data: ${k.source} (${k.slug})`));
    console.log(chalk.gray(`Yields chart pool: ${k.yieldsPoolId} (override with KINTSU_YIELDS_POOL_ID).\n`));

    const t = createTable(["Metric", "Value"], { colAligns: ["left", "right"] });
    t.push(["TVL (latest series)", k.tvlUsd != null ? formatCurrency(k.tvlUsd) : "—"]);
    t.push(["APY (Llama protocol)", k.apyFromLlama != null ? `${k.apyFromLlama.toFixed(2)}%` : "—"]);
    t.push(["APY (yields chart)", k.apyFromYieldsChart != null ? `${k.apyFromYieldsChart.toFixed(2)}%` : "—"]);
    t.push(["APY (effective)", k.aprPct != null ? `${k.aprPct.toFixed(2)}%` : "—"]);
    console.log(t.toString());

    const kChainRows = Object.entries(k.currentChainTvls).filter(([, v]) => typeof v === "number" && v > 0);
    if (kChainRows.length) {
      const ct = createTable(["Chain (Llama)", "TVL"], { colAligns: ["left", "right"] });
      for (const [c, v] of kChainRows) ct.push([c, formatCurrency(v)]);
      console.log(chalk.yellow("\nTVL by chain\n"));
      console.log(ct.toString());
    }

    console.log(chalk.yellow("\nvs Lido / StakeStone\n"));
    const cmp = createTable(["", "Lido", "StakeStone", "Kintsu"], {
      colAligns: ["left", "right", "right", "right"],
    });
    const fmtYield = x => (x != null ? `${x.toFixed(2)}%` : "—");
    cmp.push(["APR / APY", fmtYield(lido.aprPct), fmtYield(stone.aprPct), fmtYield(k.aprPct)]);
    cmp.push([
      "TVL",
      lido.tvlUsdTotal != null ? formatCurrency(lido.tvlUsdTotal) : "—",
      stone.tvlUsd != null ? formatCurrency(stone.tvlUsd) : "—",
      k.tvlUsd != null ? formatCurrency(k.tvlUsd) : "—",
    ]);
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
  fetchKintsuSnapshot,
  KINTSU_LLAMA_SLUG,
  DEFAULT_KINTSU_YIELDS_POOL_ID,
};
