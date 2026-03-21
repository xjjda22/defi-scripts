/**
 * Multi-protocol LST comparison: Lido, StakeStone, Kintsu.
 *
 * Score (0-10, heuristic only): blend = 0.45*normApr + 0.35*normTvl + 0.20*pegScore
 * - normApr = min(aprPct / 5, 1), or 0 if unknown
 * - normTvl = min(log10(tvlUsd + 1) / 12, 1), or 0 if unknown
 * - pegScore = 1 - min(|pegDevPct|, 2) / 2 for Lido (Ethereum stETH peg); 0.65 neutral if unknown
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { createTable, formatCurrency } = require("../utils/displayHelpers");
const { fetchLidoStakingSnapshot } = require("../protocols/lido/stakingMonitor");
const { fetchStakeStoneSnapshot } = require("../protocols/stakestone/stakingMonitor");
const { fetchKintsuSnapshot } = require("../protocols/kintsu/stakingMonitor");

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function normApr(aprPct) {
  if (aprPct == null || !Number.isFinite(aprPct)) return 0;
  return clamp(aprPct / 5, 0, 1);
}

function normTvl(tvlUsd) {
  if (tvlUsd == null || !Number.isFinite(tvlUsd) || tvlUsd <= 0) return 0;
  return clamp(Math.log10(tvlUsd + 1) / 12, 0, 1);
}

function pegScoreFromDevPct(pegDevPct) {
  if (pegDevPct == null || !Number.isFinite(pegDevPct)) return 0.65;
  const d = Math.abs(pegDevPct);
  return clamp(1 - Math.min(d, 2) / 2, 0, 1);
}

/**
 * @param {{ aprPct: number|null, tvlUsd: number|null, pegDevPct?: number|null }} p
 */
function stakingHeuristicScore(p) {
  const a = normApr(p.aprPct);
  const t = normTvl(p.tvlUsd);
  const g = pegScoreFromDevPct(p.pegDevPct ?? null);
  const blend = 0.45 * a + 0.35 * t + 0.2 * g;
  return 10 * blend;
}

async function main() {
  installCliSafeStdout();
  try {
    const [lido, stone, kintsu] = await Promise.all([
      fetchLidoStakingSnapshot(),
      fetchStakeStoneSnapshot(),
      fetchKintsuSnapshot(),
    ]);

    const ethRow = lido.rows?.find(r => r.chainKey === "ethereum");
    const lidoPegDev = ethRow?.pegDevPct ?? null;

    const protocols = [
      {
        id: "Lido",
        aprPct: lido.aprPct,
        tvlUsd: lido.tvlUsdTotal,
        pegNote:
          ethRow?.pegRatio != null
            ? `${ethRow.pegRatio.toFixed(4)} (${lidoPegDev != null ? `${lidoPegDev >= 0 ? "+" : ""}${lidoPegDev.toFixed(2)}%` : "—"})`
            : "—",
        liqNote: "Deep (aggregate, not DEX depth)",
        pegDevPct: lidoPegDev,
      },
      {
        id: "StakeStone",
        aprPct: stone.aprPct,
        tvlUsd: stone.tvlUsd,
        pegNote: "—",
        liqNote: stone.tvlUsd != null && stone.tvlUsd < 5e8 ? "Moderate vs Lido" : "—",
        pegDevPct: null,
      },
      {
        id: "Kintsu",
        aprPct: kintsu.aprPct,
        tvlUsd: kintsu.tvlUsd,
        pegNote: "—",
        liqNote: kintsu.tvlUsd != null && kintsu.tvlUsd < 1e8 ? "Thin vs majors" : "—",
        pegDevPct: null,
      },
    ];

    console.log(chalk.cyan.bold("\nMulti-protocol LST comparison (MVP)\n"));
    console.log(
      chalk.gray(
        "Yield: Lido APR from Lido API; Kintsu APY from DefiLlama yields chart when protocol.apy is missing; StakeStone may use STAKESTONE_YIELDS_POOL_ID. TVL from Llama series.",
      ),
    );
    console.log(
      chalk.gray(
        "Score uses a fixed blend (see file header); it is not financial advice.\n",
      ),
    );

    const overview = createTable(
      ["Protocol", "APR/APY", "TVL", "Peg (Lido only)", "Liquidity note", "Score"],
      { colAligns: ["left", "right", "right", "left", "left", "right"] },
    );

    for (const p of protocols) {
      const aprStr = p.aprPct != null ? `${p.aprPct.toFixed(2)}%` : "—";
      const tvlStr = p.tvlUsd != null ? formatCurrency(p.tvlUsd) : "—";
      const sc = stakingHeuristicScore(p);
      overview.push([p.id, aprStr, tvlStr, p.pegNote, p.liqNote, `${sc.toFixed(1)}/10`]);
    }
    console.log(overview.toString());

    console.log(chalk.yellow("\nHeuristic bands (use your own risk checks)\n"));
    const lidoTvl = lido.tvlUsdTotal ?? 0;
    const stoneTvl = stone.tvlUsd ?? 0;
    const kTvl = kintsu.tvlUsd ?? 0;

    const lines = [];
    lines.push(`Large / institution-sized notionals: favor deep aggregate liquidity — Lido TVL ${lidoTvl ? formatCurrency(lidoTvl) : "—"}.`);
    lines.push(
      `Mid-size (rough $50k–$500k): compare listed APR/APY when available; StakeStone TVL ${stoneTvl ? formatCurrency(stoneTvl) : "—"}.`,
    );
    lines.push(
      `Small / experimental tickets: higher protocol APR (when shown) may not compensate for thin TVL — Kintsu TVL ${kTvl ? formatCurrency(kTvl) : "—"}.`,
    );
    for (const line of lines) console.log(`  • ${line}`);
    if (stone.aprPct == null && kintsu.aprPct == null) {
      console.log(
        chalk.gray(
          "\nNo APY resolved for StakeStone/Kintsu — set STAKESTONE_YIELDS_POOL_ID, check KINTSU_YIELDS_POOL_ID, or use protocol UIs.",
        ),
      );
    }
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { stakingHeuristicScore };
