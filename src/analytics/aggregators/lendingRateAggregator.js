/**
 * Multi-protocol lending view: Aave V3 (on-chain) + Morpho Blue (API).
 * Per-chain best supply/borrow, runner-up spread, and cross-chain winners.
 */

require("dotenv").config();
const chalk = require("chalk");
const { CHAINS } = require("../../config/chains");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchMarketDataForChain } = require("../protocols/aave/marketMonitor");
const {
  fetchMorphoSummaryForChain,
  MONITORED_CHAINS,
  MONITORED_ASSETS,
} = require("../protocols/morpho/morphoOptimizerMonitor");

function parseAaveApy(apyStr) {
  const n = parseFloat(String(apyStr).replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Usable supply/borrow quotes for one asset on one chain. Paused/frozen/borrow-disabled Aave reserves and
 * all-zero rate pairs (unlisted reserve signature) are excluded so they never win best-rate selection.
 * @returns {{ aS: number|null, aB: number|null, mS: number|null, mB: number|null }}
 */
function usableRates(rowA, rowM) {
  let aS = null;
  let aB = null;
  if (rowA && !rowA.isPaused) {
    const s = parseAaveApy(rowA.supplyAPY);
    const b = parseAaveApy(rowA.borrowAPY);
    if (!(s === 0 && b === 0)) {
      aS = rowA.isFrozen ? null : s;
      aB = rowA.borrowingEnabled === false || rowA.isFrozen ? null : b;
    }
  }
  let mS = rowM?.supplyApyPct ?? null;
  let mB = rowM?.borrowApyPct ?? null;
  if (mS === 0 && mB === 0) {
    mS = null;
    mB = null;
  }
  return { aS, aB, mS, mB };
}

function bestTwoSupply(aS, mS) {
  const opts = [
    { v: aS, label: "Aave" },
    { v: mS, label: "Morpho" },
  ].filter(x => x.v != null && Number.isFinite(x.v));
  opts.sort((x, y) => y.v - x.v);
  return { best: opts[0], second: opts[1] || null };
}

function bestTwoBorrow(aB, mB) {
  const opts = [
    { v: aB, label: "Aave" },
    { v: mB, label: "Morpho" },
  ].filter(x => x.v != null && Number.isFinite(x.v));
  opts.sort((x, y) => x.v - y.v);
  return { best: opts[0], second: opts[1] || null };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nLending rate aggregator — Aave V3 vs Morpho Blue\n"));

  /** @type {{ chainKey: string, name: string, aave: any, morpho: any }[]} */
  const chainSnapshots = [];

  for (const chainKey of MONITORED_CHAINS) {
    const chain = CHAINS[chainKey];
    if (!chain?.aave?.v3?.pool) continue;
    if (!chain?.rpcUrl) {
      console.log(chalk.gray(`Skipping ${chain.name}: no ${chainKey.toUpperCase()}_RPC_URL`));
      continue;
    }

    const [aave, morpho] = await Promise.all([fetchMarketDataForChain(chainKey), fetchMorphoSummaryForChain(chainKey)]);
    chainSnapshots.push({ chainKey, name: chain.name, aave, morpho });
  }

  for (const { name, aave, morpho } of chainSnapshots) {
    const rows = [];
    for (const asset of MONITORED_ASSETS) {
      const sym = asset.symbol;
      const rowA = aave?.[sym];
      const rowM = morpho?.[sym];
      const { aS, aB, mS, mB } = usableRates(rowA, rowM);
      if ([aS, aB, mS, mB].every(v => v == null)) continue;

      const s2 = bestTwoSupply(aS, mS);
      const b2 = bestTwoBorrow(aB, mB);

      const bestSupplyStr = s2.best ? `${s2.best.label} ${s2.best.v.toFixed(2)}%` : "—";
      const bestBorrowStr = b2.best ? `${b2.best.label} ${b2.best.v.toFixed(2)}%` : "—";
      const dSup = s2.best && s2.second != null ? (s2.best.v - s2.second.v).toFixed(2) : "—";
      const dBor = b2.best && b2.second != null ? (b2.second.v - b2.best.v).toFixed(2) : "—";

      rows.push({
        sym,
        bestSupplyStr,
        bestBorrowStr,
        dSup,
        dBor,
        morphoCollat: rowM ? rowM.collateral : "—",
      });
    }

    if (!rows.length) continue;

    console.log(chalk.bold.white(`\n${name}`));
    console.log("━".repeat(96));
    console.log(
      chalk.gray(
        "Asset".padEnd(8) +
          "Best supply".padEnd(22) +
          "Δ pp".padEnd(8) +
          "Best borrow".padEnd(22) +
          "Δ pp".padEnd(8) +
          "Morpho collat"
      )
    );
    console.log("━".repeat(96));
    for (const r of rows) {
      console.log(
        chalk.cyan(r.sym.padEnd(8)) +
          chalk.green(r.bestSupplyStr.padEnd(22)) +
          chalk.gray(String(r.dSup).padEnd(8)) +
          chalk.magenta(r.bestBorrowStr.padEnd(22)) +
          chalk.gray(String(r.dBor).padEnd(8)) +
          chalk.gray(r.morphoCollat)
      );
    }
    console.log("━".repeat(96));
    console.log(chalk.gray("Δ pp = supply: edge vs runner-up; borrow: runner-up minus best (cheaper is better).\n"));
  }

  console.log(chalk.bold.cyan("Cross-chain — best supply & borrow per asset (all chains scanned)"));
  console.log("━".repeat(88));
  console.log(chalk.gray("Asset".padEnd(8) + "Best supply".padEnd(28) + "Best borrow".padEnd(28) + "Notes"));
  console.log("━".repeat(88));

  for (const asset of MONITORED_ASSETS) {
    const sym = asset.symbol;
    let bestS = { v: -Infinity, label: "", chain: "" };
    let bestB = { v: Infinity, label: "", chain: "" };

    for (const snap of chainSnapshots) {
      const { aS, aB, mS, mB } = usableRates(snap.aave?.[sym], snap.morpho?.[sym]);

      if (aS != null && aS > bestS.v) bestS = { v: aS, label: "Aave", chain: snap.name };
      if (mS != null && mS > bestS.v) bestS = { v: mS, label: "Morpho", chain: snap.name };
      if (aB != null && aB < bestB.v) bestB = { v: aB, label: "Aave", chain: snap.name };
      if (mB != null && mB < bestB.v) bestB = { v: mB, label: "Morpho", chain: snap.name };
    }

    const sOk = bestS.v > -Infinity;
    const bOk = bestB.v < Infinity;
    const supplyStr = sOk ? `${bestS.label} ${bestS.v.toFixed(2)}% @ ${bestS.chain}` : "—";
    const borrowStr = bOk ? `${bestB.label} ${bestB.v.toFixed(2)}% @ ${bestB.chain}` : "—";
    let notes = "";
    if (sOk && bOk && bestS.chain === bestB.chain && bestS.label === bestB.label) {
      notes = "same chain+protocol";
    }

    console.log(
      chalk.cyan(sym.padEnd(8)) +
        chalk.green(supplyStr.padEnd(28)) +
        chalk.magenta(borrowStr.padEnd(28)) +
        chalk.gray(notes)
    );
  }
  console.log("━".repeat(88));
  console.log(chalk.gray("\nBest supply = max APY; best borrow = min APY across scanned chains.\n"));
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { main };
