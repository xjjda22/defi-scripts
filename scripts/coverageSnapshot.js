#!/usr/bin/env node
/**
 * Pin the forkable-row denominator for fork coverage.
 *
 *   npm run coverage:pin -- 2026-11-02     # write data/coverage-snapshot.json
 *
 * Coverage (stats.coverage in showcase/data.json) is then always counted against this
 * list of row ids, so the % is comparable across ranking rebuilds. Rows that drop out
 * of a later top 200 are reported as missingFromBuild; new forkable rows are not added
 * until the snapshot is re-pinned (record the re-pin in CHANGELOG).
 */
const fs = require("fs");
const path = require("path");
const { FORKABLE_CHAINS, SNAPSHOT_FILE, isForkable } = require("../src/catalog/forkStatus");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "showcase", "data.json"), "utf8"));
const id = process.argv[2] || new Date().toISOString().slice(0, 10);
const forkable = (data.overall || []).filter(row => isForkable(row)).map(row => row.id);
const snapshot = {
  id,
  pinnedAt: new Date().toISOString(),
  dataGeneratedAt: data.generatedAt,
  forkableChains: FORKABLE_CHAINS,
  rule: "a top-200 row is forkable when any of its top-8 DefiLlama chain TVLs is on a forkable chain",
  forkable,
};
fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`pinned ${forkable.length} forkable rows as snapshot ${id} (data built ${data.generatedAt})`);
