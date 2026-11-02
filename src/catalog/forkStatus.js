/**
 * Honest fork-coverage status per showcase row.
 *
 *   direct          the row's own product is exercised by a fork test
 *   linked          the row reuses another product's fork test (counted separately,
 *                   never in the headline)
 *   failing-paused  every fork test on the row FAILs on purpose because the protocol
 *                   is paused, frozen or closing; the pre-check sends no tx
 *   none            API-only (no fork test)
 *
 * The health routine updates PAUSED when a pause pre-check starts or stops failing
 * (Aave/Spark reserve frozen, Compound pause guardian, Dolomite price/closing, Swell
 * core methods, Puffer). Aave V3 Core and Compound cUSDCv3 were paused 2026-10-29 and
 * PASS again on 2026-11-02, so they are not listed.
 *
 * Coverage is counted against a pinned snapshot (data/coverage-snapshot.json) so the
 * denominator does not move with each ranking rebuild.
 */

const fs = require("fs");
const path = require("path");

const PAUSED = {
  "fork:dolomite:supply": {
    since: "2026-10-29",
    reason:
      "Dolomite oracle price went to zero after the 2026-10-29 Binance hot-wallet drain; since 2026-11-02 every Ethereum market (WETH, USD1, USDC, LINK) has getMarketIsClosing=true.",
  },
  "fork:swell:deposit": {
    since: "2026-10-21",
    reason: "Swell AccessControlManager has core methods, bot methods and withdrawals paused after the 2026-10-21 incident.",
  },
};

// Row keys (slug, id or name, lower case) whose fork test belongs to another product.
const LINKED = {
  "ether.fi-liquid": {
    via: "fork:veda:deposit",
    reason: "Shares the Veda recipe: deposits WETH into the Liquid ETH BoringVault Teller (deposit only). Liquid USD/BTC are not exercised.",
  },
  "nonce-capital": {
    via: "fork:veda:deposit",
    reason: "Curator of the ether.fi Liquid vaults; the test exercises the Veda Teller, not anything Nonce deploys.",
  },
};

// Chains the repo can fork (src/config/chains.js + forkRecipes RPC_ENV), as DefiLlama names them.
const FORKABLE_CHAINS = [
  "ethereum",
  "arbitrum",
  "optimism",
  "op mainnet",
  "base",
  "polygon",
  "bsc",
  "binance",
  "zksync era",
  "era",
  "scroll",
  "unichain",
  "monad",
  "avalanche",
];

// Why a chain cannot be forked with Anvil here. Unlisted non-EVM or unconfigured chains
// fall back to the generic reason.
const NON_FORKABLE_REASONS = {
  solana: "Not EVM; Anvil cannot fork it.",
  hyperliquid: "HyperCore is not EVM (HyperEVM is not configured); Hyperliquid Bridge perps fork coverage is closed by decision.",
  "hyperliquid l1": "HyperCore is not EVM; Hyperliquid perps fork coverage is closed by decision.",
  tron: "TVM, not EVM-equivalent; Anvil cannot fork it.",
  bitcoin: "Not EVM; custody/bridge rows settle on Bitcoin.",
  sui: "Move VM; not EVM.",
  aptos: "Move VM; not EVM.",
  near: "Not EVM.",
  ton: "Not EVM.",
  starknet: "Cairo VM; not EVM.",
  cardano: "Not EVM.",
  xrpl: "Not EVM.",
  "off chain": "No chain TVL on DefiLlama (fees/volume-only, off-chain or custodial row); nothing to fork.",
  bittensor: "Not EVM.",
};
const GENERIC_REASON = "EVM chain not configured in src/config/chains.js (no RPC or fork recipe yet).";

const SNAPSHOT_FILE = path.join(__dirname, "..", "..", "data", "coverage-snapshot.json");

function loadSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function isForkable(row, chains = FORKABLE_CHAINS) {
  const set = new Set(chains);
  return (row.chainTvls || []).some(item => set.has(String(item.chain).toLowerCase()));
}

function primaryChain(row) {
  const first = (row.chainTvls || [])[0];
  return first ? String(first.chain).toLowerCase() : "off chain";
}

function linkFor(keys) {
  for (const key of keys) if (LINKED[key]) return LINKED[key];
  return null;
}

/**
 * @param {object} row showcase row after attachTesting
 * @param {string[]} keys lower-case row keys
 */
function statusFor(row, keys) {
  const testing = row.testing || {};
  if (testing.mode !== "fork" || !(testing.tests || []).length) return { status: "none" };
  const scripts = testing.tests.map(item => item.script);
  const paused = scripts.filter(script => PAUSED[script]);
  if (paused.length === scripts.length) {
    return { status: "failing-paused", paused: paused.map(script => ({ script, ...PAUSED[script] })) };
  }
  const link = linkFor(keys);
  if (link) return { status: "linked", via: link.via, reason: link.reason };
  return { status: "direct" };
}

function countStatuses(rows) {
  const out = { direct: 0, linked: 0, "failing-paused": 0, none: 0 };
  for (const row of rows) out[(row.testing && row.testing.status) || "none"] += 1;
  return out;
}

/**
 * Coverage stats: pinned forkable denominator, top-50 and non-forkable chains.
 */
function coverageStats(data, snapshot = loadSnapshot()) {
  const overall = data.overall || [];
  const chains = (snapshot && snapshot.forkableChains) || FORKABLE_CHAINS;
  const pinned = snapshot && Array.isArray(snapshot.forkable) ? new Set(snapshot.forkable) : null;
  const forkableRows = pinned ? overall.filter(row => pinned.has(row.id)) : overall.filter(row => isForkable(row, chains));
  const top50 = overall.slice(0, 50);
  const nonForkable = {};
  for (const row of overall) {
    if (isForkable(row, chains)) continue;
    const chain = primaryChain(row);
    const entry = nonForkable[chain] || (nonForkable[chain] = { count: 0, reason: NON_FORKABLE_REASONS[chain] || GENERIC_REASON, rows: [] });
    entry.count += 1;
    entry.rows.push(row.name);
  }
  const forkable = countStatuses(forkableRows);
  return {
    snapshot: snapshot
      ? { id: snapshot.id, pinnedAt: snapshot.pinnedAt, dataGeneratedAt: snapshot.dataGeneratedAt, size: snapshot.forkable.length }
      : null,
    forkableChains: chains,
    forkableRows: forkableRows.length,
    missingFromBuild: pinned ? pinned.size - forkableRows.length : 0,
    forkable,
    headline: { direct: forkable.direct, of: forkableRows.length },
    top200: countStatuses(overall),
    top50: countStatuses(top50),
    nonForkable: {
      rows: Object.values(nonForkable).reduce((sum, entry) => sum + entry.count, 0),
      byChain: Object.fromEntries(Object.entries(nonForkable).sort((a, b) => b[1].count - a[1].count)),
    },
  };
}

module.exports = {
  PAUSED,
  LINKED,
  FORKABLE_CHAINS,
  NON_FORKABLE_REASONS,
  SNAPSHOT_FILE,
  loadSnapshot,
  isForkable,
  statusFor,
  coverageStats,
};
