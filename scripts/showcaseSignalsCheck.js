#!/usr/bin/env node
/**
 * Offline check for the external signal plumbing. No network, no API keys.
 *
 *   node scripts/showcaseSignalsCheck.js
 *
 * Covers the three pure steps that decide a row's signal value:
 *   CoinGecko markets -> turnover, Nansen netflow -> intensity, then the join.
 * Also checks that a disabled source drops out of the weight set and leaves the
 * remaining weights summing to 1.
 */

const path = require("path");
const fs = require("fs");

const coingecko = require("../src/analytics/ranking/sources/coingecko");
const nansen = require("../src/analytics/ranking/sources/nansen");
const { mergeSignals } = require("../src/analytics/ranking/sources");
const { activeWeights, roundWeights, CORE_WEIGHTS, SIGNAL_WEIGHTS } = require("../src/analytics/ranking/weights");

const fixtures = path.join(__dirname, "..", "test", "fixtures");
const problems = [];

function check(label, condition, detail) {
  if (!condition) problems.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function close(actual, expected, epsilon = 1e-9) {
  return Number.isFinite(actual) && Math.abs(actual - expected) < epsilon;
}

const markets = coingecko.parseMarkets(
  JSON.parse(fs.readFileSync(path.join(fixtures, "coingecko-markets.json"), "utf8"))
);
const netflowRows = nansen.parseNetflow(
  JSON.parse(fs.readFileSync(path.join(fixtures, "nansen-netflow.json"), "utf8"))
);

const targets = [
  { rowId: "row-a", token: { coingeckoId: "token-a", addresses: { ethereum: "0xaaa" } } },
  { rowId: "row-b", token: { coingeckoId: "token-b", addresses: { ethereum: "0xBBB" } } },
  {
    rowId: "row-c",
    token: { coingeckoId: "token-c", addresses: { solana: "SoLCaseMint111111111111111111111111111111" } },
  },
  { rowId: "row-d", token: { coingeckoId: "token-d", addresses: { ethereum: "0xDDD" } } },
  { rowId: "row-e", token: { coingeckoId: "token-missing", addresses: { ethereum: "0xEEE" } } },
];

const cgByRow = new Map(targets.map(target => [target.rowId, markets[target.token.coingeckoId]]));
const nanByRow = nansen.matchNetflow(targets, netflowRows);
const merged = mergeSignals(targets, cgByRow, nanByRow);

check("markets parsed", Object.keys(markets).length === 4, `${Object.keys(markets).length}`);
check("netflow parsed", netflowRows.length === 3, `${netflowRows.length}`);
check("EVM address normalised", netflowRows[0].address === "0xaaa", netflowRows[0].address);
check(
  "Solana address preserved",
  netflowRows[2].address === "SoLCaseMint111111111111111111111111111111",
  netflowRows[2].address
);

check("four rows carry a signal", merged.size === 4, `${merged.size}`);
check("unmapped row absent", !merged.has("row-e"));
check("zero turnover is kept", merged.get("row-d").attention === 0, String(merged.get("row-d").attention));

check("attention a", close(merged.get("row-a").attention, 0.1), String(merged.get("row-a").attention));
check("attention b", close(merged.get("row-b").attention, 0.5), String(merged.get("row-b").attention));
check("smart money a", close(merged.get("row-a").smartMoney, 0.1), String(merged.get("row-a").smartMoney));
check("smart money b is negative", close(merged.get("row-b").smartMoney, -0.2), String(merged.get("row-b").smartMoney));
check("row c has no market cap", merged.get("row-c").attention == null);
check("row c smart money", close(merged.get("row-c").smartMoney, 0.25), String(merged.get("row-c").smartMoney));
check("token snapshot", merged.get("row-a").token.symbol === "TA", JSON.stringify(merged.get("row-a").token));

const both = activeWeights(["attention", "smartMoney"]);
const bothSum = Object.values(both).reduce((sum, value) => sum + value, 0);
check("both weights sum to 1", close(bothSum, 1), String(bothSum));
check("attention weight", close(both.attention, SIGNAL_WEIGHTS.attention), String(both.attention));
check("smart money weight", close(both.smartMoney, SIGNAL_WEIGHTS.smartMoney), String(both.smartMoney));

const onlyOne = activeWeights(["attention"]);
const oneSum = Object.values(onlyOne).reduce((sum, value) => sum + value, 0);
check("one source still sums to 1", close(oneSum, 1), String(oneSum));
check("smart money dropped", onlyOne.smartMoney == null);
check("core ratio preserved", close(onlyOne.size / onlyOne.growth, CORE_WEIGHTS.size / CORE_WEIGHTS.growth), "ratio");

const rounded = roundWeights(both);
const roundedSum = Object.values(rounded).reduce((sum, value) => sum + value, 0);
check("rounded weights sum to 1", Math.abs(roundedSum - 1) < 0.001, String(roundedSum));

if (problems.length) {
  console.error(`showcase signals: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log("showcase signals: ok (turnover, netflow intensity, join, weight renormalisation)");
