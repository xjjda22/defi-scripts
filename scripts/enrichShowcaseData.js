#!/usr/bin/env node
/**
 * Stamp fork/test metadata and per-chain TVL onto showcase/data.json
 * without rebuilding the ranking. showcase:build calls the same helpers.
 *
 *   node scripts/enrichShowcaseData.js
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { enrichShowcase, applyProtocolMeta } = require("../src/analytics/ranking/coverage");

const FILE = path.join(__dirname, "..", "showcase", "data.json");

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const response = await axios.get("https://api.llama.fi/protocols", {
    timeout: 120_000,
    headers: { "User-Agent": "defi-scripts/showcase-enrich" },
  });
  if (!Array.isArray(response.data)) throw new Error("DefiLlama /protocols did not return a list");
  applyProtocolMeta(data, response.data);
  enrichShowcase(data);
  fs.writeFileSync(FILE, `${JSON.stringify(data, null, 1)}\n`);
  console.log(
    `updated ${FILE}: top 200 fork ${data.stats.forkInTop200}, API-only ${data.stats.apiOnlyInTop200}`
  );
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
