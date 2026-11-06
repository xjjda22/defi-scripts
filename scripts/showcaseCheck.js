/**
 * Offline sanity check for showcase/data.json (no network).
 *
 *   node scripts/showcaseCheck.js
 *
 * Fails when the board is not 200 rows, a category tab is empty, ranks are not
 * 1..N, a number is NaN/Infinity, ids repeat, a row has no category, or a
 * script link points at a file that is not in the repo.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "showcase", "data.json");
const NUMERIC = ["tvl", "tvl6mAgo", "tvlAdded6m", "tvlChange6m", "fees30d", "volume30d", "xMentions", "score"];

function checkSignals(row, label, problems) {
  if (row.signals) {
    for (const key of ["attention", "smartMoney"]) {
      const value = row.signals[key];
      if (value == null) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        problems.push(`${label}/${row.id}: signals.${key} is ${value}`);
      }
    }
  }
  if (row.token) {
    for (const key of ["marketCap", "volume24h", "turnover"]) {
      const value = row.token[key];
      if (value != null && (typeof value !== "number" || !Number.isFinite(value))) {
        problems.push(`${label}/${row.id}: token.${key} is ${value}`);
      }
    }
    if (!row.token.coingeckoId) problems.push(`${label}/${row.id}: token without coingeckoId`);
  }
  // Icons are optional (placeholder when CoinGecko has no honest match), but a present
  // icon must be a CoinGecko image URL tied to a coingeckoId.
  if (row.icon != null) {
    if (!row.icon.url || typeof row.icon.url !== "string") {
      problems.push(`${label}/${row.id}: icon.url missing`);
    } else if (!/coingecko\.com\/coins\/images\//i.test(row.icon.url) && !/coin-images\.coingecko\.com\//i.test(row.icon.url)) {
      problems.push(`${label}/${row.id}: icon.url is not a CoinGecko image (${row.icon.url})`);
    }
    if (row.icon.source !== "coingecko") problems.push(`${label}/${row.id}: icon.source is ${row.icon.source}`);
    if (!row.icon.coingeckoId) problems.push(`${label}/${row.id}: icon without coingeckoId`);
  }
  // Product links: every scored row carries its DefiLlama page, and the CoinGecko page
  // when a token is mapped. Catalog-only rows (appended to a tab, no DefiLlama row and
  // no score) legitimately have neither.
  if (row.score != null && (!row.llamaUrl || !/^https:\/\/defillama\.com\/protocol\//.test(row.llamaUrl))) {
    problems.push(`${label}/${row.id}: llamaUrl is ${row.llamaUrl}`);
  }
  const gecko = row.token && row.token.coingeckoId
    ? `https://www.coingecko.com/en/coins/${encodeURIComponent(row.token.coingeckoId)}`
    : null;
  if ((row.coingeckoUrl || null) !== gecko) {
    problems.push(`${label}/${row.id}: coingeckoUrl is ${row.coingeckoUrl}, expected ${gecko}`);
  }
}

const STATUSES = new Set(["direct", "linked", "failing-paused", "none"]);

function checkTesting(row, problems) {
  const testing = row.testing;
  if (testing && !STATUSES.has(testing.status)) problems.push(`${row && row.id}: testing.status is ${testing.status}`);
  if (testing && (testing.status === "none") !== (testing.mode === "api-only")) {
    problems.push(`${row.id}: testing.status ${testing.status} disagrees with mode ${testing.mode}`);
  }
  if (!testing || (testing.mode !== "fork" && testing.mode !== "api-only")) {
    problems.push(`${row.id}: testing.mode must be fork or api-only`);
    return;
  }
  if (testing.mode === "fork" && (!Array.isArray(testing.commands) || testing.commands.length < 2)) {
    problems.push(`${row.id}: fork row needs copy-paste commands`);
  }
  if (testing.mode === "api-only" && (!testing.recipe || !testing.recipe.commands || !testing.recipe.commands.length)) {
    problems.push(`${row.id}: API-only row needs a category recipe`);
  }
  for (const contract of testing.contracts || []) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract.address || "")) {
      problems.push(`${row.id}: bad contract address ${contract.address}`);
    }
  }
  // Contract flow from data/contract-flows.json: the panel draws it as the call path, so a
  // dangling edge would render an arrow into nothing.
  const flow = testing.flow;
  if (flow) {
    const ids = new Set((flow.nodes || []).map(node => node.id));
    if (ids.size < 2) problems.push(`${row.id}: testing.flow has ${ids.size} node(s)`);
    if (!(flow.edges || []).length) problems.push(`${row.id}: testing.flow has no edges`);
    for (const edge of flow.edges || []) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) problems.push(`${row.id}: testing.flow edge ${edge.from}->${edge.to} points at a missing node`);
      if (!edge.label) problems.push(`${row.id}: testing.flow edge ${edge.from}->${edge.to} has no label`);
    }
  }
  for (const item of row.chainTvls || []) {
    if (!item || typeof item.tvl !== "number" || !Number.isFinite(item.tvl)) {
      problems.push(`${row.id}: bad chain TVL`);
    }
  }
}

function main() {
  const problems = [];
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const overall = Array.isArray(data.overall) ? data.overall : [];
  if (overall.length !== 200) problems.push(`overall has ${overall.length} rows, expected 200`);
  const categoryIds = new Set((data.categories || []).map(cat => cat.id));
  if (categoryIds.size !== 12) problems.push(`expected 12 categories, found ${categoryIds.size}`);

  const seen = new Set();
  overall.forEach((row, idx) => {
    if (row.rank !== idx + 1) problems.push(`overall row ${idx} has rank ${row.rank}`);
    if (seen.has(row.id)) problems.push(`duplicate id ${row.id}`);
    seen.add(row.id);
    if (!categoryIds.has(row.category)) problems.push(`${row.id}: unknown category ${row.category}`);
    if (!row.name) problems.push(`${row.id}: empty name`);
    checkTesting(row, problems);
    checkSignals(row, "overall", problems);
    if (row.tvl == null && row.fees30d == null && row.volume30d == null) problems.push(`${row.id}: no TVL, fees or volume`);
    if (typeof row.score !== "number") problems.push(`${row.id}: missing score`);
    if (idx > 0 && row.score > overall[idx - 1].score) problems.push(`${row.id}: out of score order`);
  });

  for (const [id, rows] of Object.entries(data.byCategory || {})) {
    if (!categoryIds.has(id)) problems.push(`byCategory has unknown tab ${id}`);
    if (!rows.length) problems.push(`tab ${id} is empty`);
    rows.forEach((row, idx) => {
      if (row.rank !== idx + 1) problems.push(`${id} row ${idx} has rank ${row.rank}`);
      checkTesting(row, problems);
      checkSignals(row, id, problems);
      for (const key of NUMERIC) {
        const value = row[key];
        if (value != null && (typeof value !== "number" || !Number.isFinite(value))) {
          problems.push(`${id}/${row.id}: ${key} is ${value}`);
        }
      }
      for (const script of row.scripts || []) {
        if (!script || !script.name) problems.push(`${id}/${row.id}: script without a name`);
        else if (script.file && !fs.existsSync(path.join(ROOT, script.file))) {
          problems.push(`${id}/${row.id}: ${script.name} → missing ${script.file}`);
        }
      }
    });
  }
  for (const id of categoryIds) {
    if (!(data.byCategory || {})[id]) problems.push(`tab ${id} missing from byCategory`);
  }

  const methodology = data.methodology || {};
  if (methodology.weights) {
    const total = Object.values(methodology.weights).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.001) problems.push(`methodology.weights sum to ${total}, expected 1`);
  }
  if (methodology.sources && !Array.isArray(methodology.sources)) {
    problems.push("methodology.sources must be an array");
  }
  const inCi = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
  if (methodology.publishSafe === false && inCi) {
    problems.push("publishSafe is false: this build contains data that is not cleared for public redistribution");
  }
  const coingecko = (methodology.sources || []).find(source => source.id === "coingecko");
  if (inCi && (!coingecko || !coingecko.enabled || !coingecko.available || !(coingecko.matched > 0))) {
    problems.push(
      "CoinGecko attention is missing: CI must publish DefiLlama + CoinGecko. Set COINGECKO_API_KEY, or keep the committed data.json."
    );
  }

  if (problems.length) {
    console.error(`showcase/data.json check failed (${problems.length}):`);
    problems.slice(0, 40).forEach(problem => console.error(`  - ${problem}`));
    process.exit(1);
  }
  const tabs = Object.entries(data.byCategory)
    .map(([id, rows]) => `${id} ${rows.length}`)
    .join(", ");
  // Freshness: warn (not fail) when the build is older than SHOWCASE_MAX_AGE_HOURS (48).
  const maxAge = Number(process.env.SHOWCASE_MAX_AGE_HOURS) || 48;
  const ageHours = (Date.now() - new Date(data.generatedAt).getTime()) / 3600000;
  if (!Number.isFinite(ageHours)) console.warn(`WARNING: showcase/data.json generatedAt ${data.generatedAt} is not a date`);
  else if (ageHours > maxAge) {
    const msg = `showcase/data.json is ${(ageHours / 24).toFixed(1)} days old (generated ${data.generatedAt}, limit ${maxAge} h); rebuild with npm run showcase:build`;
    console.warn(`WARNING: ${msg}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Stale showcase data::${msg}`);
  }
  const STATES = new Set(["paused", "closing", "exploited", "shut-down", "deprecated"]);
  for (const row of overall) {
    if (row.protocolStatus != null && !STATES.has(row.protocolStatus)) {
      console.error(`${row.id}: protocolStatus ${row.protocolStatus} is not one of ${[...STATES].join(", ")}`);
      process.exit(1);
    }
  }
  const fork = data.stats && data.stats.forkInTop200;
  const apiOnly = data.stats && data.stats.apiOnlyInTop200;
  console.log(
    `showcase/data.json ok: ${overall.length} rows, generated ${data.generatedAt}; fork tests ${fork}, API-only ${apiOnly}; tabs: ${tabs}`
  );
}

main();
