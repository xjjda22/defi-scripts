#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { buildRegistry } = require("../src/catalog/foundryTests");
const fields = [
  "rank",
  "protocol",
  "slug",
  "category",
  "unique_contracts",
  "contract_entries",
  "chains",
  "testing_mode",
  "foundry_bucket",
  "wave",
  "status",
  "reason",
  "coverageStatus",
  "coverageReason",
];
const rows = buildRegistry();
const quote = value => '"' + String(Array.isArray(value) ? value.join(";") : (value ?? "")).replace(/"/g, '""') + '"';
const output = path.resolve(__dirname, "../output/foundry-contract-queue.csv");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  [fields.join(","), ...rows.map(row => fields.map(field => quote(row[field])).join(","))].join("\n") + "\n"
);
for (const wave of ["W0", "W1", "W2", "W3", "receiver", "—"])
  console.log(`${wave}: ${rows.filter(row => row.wave === wave).length} rows`);
console.log(`Wrote ${rows.length} rows to output/foundry-contract-queue.csv (not a coverage claim).`);
