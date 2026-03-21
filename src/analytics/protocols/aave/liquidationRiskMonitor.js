/**
 * Aave V3 liquidation activity + optional watch-list health factors.
 *
 * - Scans recent LiquidationCall events (RPC chunking; narrow window on L2s).
 * - If AAVE_WATCH_ADDRESSES is set (comma-separated), prints live HF from the pool.
 *
 * Env:
 *   AAVE_WATCH_ADDRESSES=0xabc...,0xdef...
 *   AAVE_LIQ_MAX_BLOCKS=15000   (default; per-chain cap for log range)
 *   AAVE_LIQ_POLYGON_MAX_BLOCKS=4000  (Polygon: smaller default window — fast blocks + RPC log limits)
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../../config/chains");
const { getProvider } = require("../../../utils/web3");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const AaveV3PoolABI = require("../../../abis/aave/AaveV3Pool.json");

const MONITORED_CHAINS = ["ethereum", "arbitrum", "optimism", "base", "polygon"];

const POOL_IFACE = new ethers.Interface([
  ...AaveV3PoolABI,
  "event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)",
]);

const LIQ_TOPIC = POOL_IFACE.getEvent("LiquidationCall").topicHash;

const DEFAULT_MAX_BLOCKS = Number(process.env.AAVE_LIQ_MAX_BLOCKS || 15000);
const POLYGON_LIQ_MAX_BLOCKS = Number(process.env.AAVE_LIQ_POLYGON_MAX_BLOCKS || 4000);
const CHUNK = 2000;

function effectiveLiquidationBlockWindow(chainKey, requestedMax) {
  if (chainKey === "polygon") {
    return Math.min(requestedMax, POLYGON_LIQ_MAX_BLOCKS);
  }
  return requestedMax;
}

function formatHF(hf) {
  const max = 2n ** 256n - 1n;
  if (hf >= max - 1000n) return "∞ (no debt)";
  const n = Number(ethers.formatUnits(hf, 18));
  if (!Number.isFinite(n) || n > 1e9) return "∞";
  return n.toFixed(4);
}

function hfBucket(hf) {
  const max = 2n ** 256n - 1n;
  if (hf >= max - 1000n) return "n/a";
  const n = Number(ethers.formatUnits(hf, 18));
  if (n < 1.02) return "< 1.02 (critical)";
  if (n < 1.05) return "1.02 – 1.05";
  if (n < 1.1) return "1.05 – 1.10";
  if (n < 1.2) return "1.10 – 1.20";
  return "≥ 1.20";
}

async function getLogsChunked(provider, pool, fromBlock, toBlock) {
  const all = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + CHUNK - 1, toBlock);
    try {
      const part = await provider.getLogs({
        address: pool,
        topics: [LIQ_TOPIC],
        fromBlock: start,
        toBlock: end,
      });
      all.push(...part);
    } catch {
      // Retry smaller chunk once
      const mid = Math.floor((start + end) / 2);
      if (mid >= start) {
        try {
          const a = await provider.getLogs({
            address: pool,
            topics: [LIQ_TOPIC],
            fromBlock: start,
            toBlock: mid,
          });
          const b = await provider.getLogs({
            address: pool,
            topics: [LIQ_TOPIC],
            fromBlock: mid + 1,
            toBlock: end,
          });
          all.push(...a, ...b);
        } catch {
          // skip range
        }
      }
    }
    start = end + 1;
  }
  return all;
}

function addressLabel(addr, symbolByLower) {
  const s = symbolByLower[addr.toLowerCase()];
  return s || `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function buildSymbolMap(chainKey) {
  const m = {};
  for (const [sym, byChain] of Object.entries(COMMON_TOKENS)) {
    const a = byChain[chainKey];
    if (a) m[a.toLowerCase()] = sym;
  }
  return m;
}

async function fetchLiquidationsForChain(chainKey, maxBlocks) {
  const chain = CHAINS[chainKey];
  if (!chain?.aave?.v3?.pool) return null;
  if (!chain?.rpcUrl) return null;

  const window = effectiveLiquidationBlockWindow(chainKey, maxBlocks);
  const provider = getProvider(chainKey);
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - window);

  const logs = await getLogsChunked(provider, chain.aave.v3.pool, fromBlock, latest);
  let totalDebt = 0n;
  const users = new Set();
  /** @type {Map<string, { count: number, debtSum: bigint }>} */
  const pairStats = new Map();
  const symMap = buildSymbolMap(chainKey);

  for (const log of logs) {
    const parsed = POOL_IFACE.parseLog(log);
    if (parsed?.name !== "LiquidationCall") continue;
    const { collateralAsset, debtAsset, user, debtToCover } = parsed.args;
    totalDebt += debtToCover;
    users.add(user.toLowerCase());
    const c = collateralAsset.toLowerCase();
    const d = debtAsset.toLowerCase();
    const key = `${c}|${d}`;
    const cur = pairStats.get(key) || { count: 0, debtSum: 0n };
    cur.count += 1;
    cur.debtSum += debtToCover;
    pairStats.set(key, cur);
  }

  const pairs = [...pairStats.entries()]
    .map(([key, v]) => {
      const [coll, debt] = key.split("|");
      return {
        collateral: coll,
        debt: debt,
        label: `${addressLabel(coll, symMap)} / ${addressLabel(debt, symMap)}`,
        count: v.count,
        debtSum: v.debtSum,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    chain: chain.name,
    chainKey,
    blockWindow: window,
    fromBlock,
    toBlock: latest,
    count: logs.length,
    uniqueUsers: users.size,
    totalDebtToCover: totalDebt,
    pairs,
  };
}

async function printWatchList() {
  const raw = process.env.AAVE_WATCH_ADDRESSES;
  if (!raw?.trim()) {
    console.log(chalk.gray("\nSet AAVE_WATCH_ADDRESSES (comma-separated) to print live health factors.\n"));
    return;
  }

  const addrs = raw
    .split(",")
    .map(a => a.trim())
    .filter(Boolean);

  console.log(chalk.bold.cyan("\nWatch-list health factors (Aave V3 Pool)"));
  console.log("━".repeat(88));
  console.log(chalk.gray("Address".padEnd(44) + "Chain".padEnd(14) + "HF".padEnd(14) + "Bucket"));
  console.log("━".repeat(88));

  for (const chainKey of MONITORED_CHAINS) {
    const chain = CHAINS[chainKey];
    if (!chain?.rpcUrl || !chain?.aave?.v3?.pool) continue;

    const provider = getProvider(chainKey);
    const pool = new ethers.Contract(chain.aave.v3.pool, AaveV3PoolABI, provider);

    for (const addr of addrs) {
      if (!ethers.isAddress(addr)) continue;
      try {
        const data = await pool.getUserAccountData(addr);
        const hf = data.healthFactor;
        const debt = data.totalDebtBase;
        if (debt === 0n) {
          console.log(
            chalk.white(addr.padEnd(44)) +
              chalk.cyan(chain.name.padEnd(14)) +
              chalk.gray("—".padEnd(14)) +
              chalk.gray("no debt")
          );
          continue;
        }
        const bucket = hfBucket(hf);
        const col = bucket.includes("critical") ? chalk.red : bucket.includes("1.02") ? chalk.yellow : chalk.green;
        console.log(
          chalk.white(addr.padEnd(44)) +
            chalk.cyan(chain.name.padEnd(14)) +
            chalk.white(formatHF(hf).padEnd(14)) +
            col(bucket)
        );
      } catch {
        console.log(chalk.gray(`${addr} on ${chain.name}: (rpc error)`));
      }
    }
  }
  console.log("━".repeat(88) + "\n");
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nAave V3 — liquidation activity (recent window)\n"));
  console.log(
    chalk.gray(
      `Scanning up to ${DEFAULT_MAX_BLOCKS} blocks per chain (AAVE_LIQ_MAX_BLOCKS). Polygon uses min(that, ${POLYGON_LIQ_MAX_BLOCKS}) unless AAVE_LIQ_POLYGON_MAX_BLOCKS is set.`
    )
  );

  const rows = [];
  for (const chainKey of MONITORED_CHAINS) {
    const ch = CHAINS[chainKey];
    const label = ch?.name || chainKey;
    process.stdout.write(chalk.gray(`  ${label}... `));
    try {
      if (!ch?.aave?.v3?.pool) {
        console.log(chalk.gray("no V3 pool"));
        continue;
      }
      if (!ch?.rpcUrl) {
        console.log(chalk.gray(`no RPC (${chainKey.toUpperCase()}_RPC_URL)`));
        continue;
      }
      const r = await fetchLiquidationsForChain(chainKey, DEFAULT_MAX_BLOCKS);
      if (r) rows.push(r);
      console.log(chalk.green(r ? `${r.count} events` : "0 events"));
    } catch (e) {
      const msg = e.shortMessage || e.message || "error";
      const hint =
        /coalesce|limit|range too large|timeout/i.test(msg) && chainKey === "polygon"
          ? " — try AAVE_LIQ_POLYGON_MAX_BLOCKS=2000 or a dedicated Polygon RPC"
          : "";
      console.log(chalk.red(msg + hint));
    }
  }

  console.log("\n" + chalk.bold.cyan("Summary"));
  console.log("━".repeat(92));
  console.log(
    chalk.gray(
      "Chain".padEnd(14) +
        "Blocks".padEnd(22) +
        "Liquidations".padEnd(14) +
        "Unique users".padEnd(16) +
        "Debt units (raw)"
    )
  );
  console.log("━".repeat(92));

  for (const r of rows) {
    const range = `${r.fromBlock}–${r.toBlock}`;
    console.log(
      chalk.cyan(r.chain.padEnd(14)) +
        chalk.white(range.padEnd(22)) +
        chalk.yellow(String(r.count).padEnd(14)) +
        chalk.white(String(r.uniqueUsers).padEnd(16)) +
        chalk.magenta(r.totalDebtToCover.toString())
    );
  }
  console.log("━".repeat(92));
  console.log(
    chalk.gray("debtToCover is raw token min units per reserve; sums across assets are not USD-normalized.\n")
  );

  const withPairs = rows.filter(r => r.pairs?.length);
  if (withPairs.length) {
    console.log(chalk.bold.cyan("Liquidations by collateral / debt asset (recent window)"));
    console.log("━".repeat(92));
    console.log(
      chalk.gray("Chain".padEnd(14) + "Pair (collateral / debt)".padEnd(36) + "Events".padEnd(10) + "Debt (raw sum)")
    );
    console.log("━".repeat(92));
    for (const r of withPairs) {
      for (const p of r.pairs.slice(0, 8)) {
        console.log(
          chalk.cyan(r.chain.padEnd(14)) +
            chalk.white(p.label.padEnd(36)) +
            chalk.yellow(String(p.count).padEnd(10)) +
            chalk.magenta(p.debtSum.toString())
        );
      }
      if (r.pairs.length > 8) {
        console.log(chalk.gray(`  … +${r.pairs.length - 8} more pairs on ${r.chain}`));
      }
    }
    console.log("━".repeat(92) + "\n");
  }

  await printWatchList();
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { fetchLiquidationsForChain, formatHF, hfBucket, buildSymbolMap };
