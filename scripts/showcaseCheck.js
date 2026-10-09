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
    if (row.tvl == null && row.fees30d == null && row.volume30d == null) problems.push(`${row.id}: no TVL, fees or volume`);
    if (typeof row.score !== "number") problems.push(`${row.id}: missing score`);
    if (idx > 0 && row.score > overall[idx - 1].score) problems.push(`${row.id}: out of score order`);
  });

  for (const [id, rows] of Object.entries(data.byCategory || {})) {
    if (!categoryIds.has(id)) problems.push(`byCategory has unknown tab ${id}`);
    if (!rows.length) problems.push(`tab ${id} is empty`);
    rows.forEach((row, idx) => {
      if (row.rank !== idx + 1) problems.push(`${id} row ${idx} has rank ${row.rank}`);
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
  console.log(`showcase/data.json ok: ${overall.length} rows, generated ${data.generatedAt}; tabs: ${tabs}`);
}

main();
