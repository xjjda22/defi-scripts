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

function checkTesting(row, problems) {
  const testing = row.testing;
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

  if (problems.length) {
    console.error(`showcase/data.json check failed (${problems.length}):`);
    problems.slice(0, 40).forEach(problem => console.error(`  - ${problem}`));
    process.exit(1);
  }
  const tabs = Object.entries(data.byCategory)
    .map(([id, rows]) => `${id} ${rows.length}`)
    .join(", ");
  const fork = data.stats && data.stats.forkInTop200;
  const apiOnly = data.stats && data.stats.apiOnlyInTop200;
  console.log(
    `showcase/data.json ok: ${overall.length} rows, generated ${data.generatedAt}; fork tests ${fork}, API-only ${apiOnly}; tabs: ${tabs}`
  );
}

main();
