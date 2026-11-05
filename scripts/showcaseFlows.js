#!/usr/bin/env node
/**
 * Stamp the generated contract flows onto showcase/data.json without rebuilding the ranking.
 *
 *   npm run showcase:flows
 *
 * `enrichShowcase` is the same offline pass `npm run ranking:top200` runs after the board is
 * built, so this keeps the page identical to a full rebuild minus new DefiLlama numbers. Every
 * flow comes from data/contract-flows.json via src/catalog/contractFlows.js.
 */

const fs = require("fs");
const path = require("path");
const { enrichShowcase } = require("../src/catalog/forkRecipes");

const FILE = path.join(__dirname, "..", "showcase", "data.json");

function main() {
  if (!fs.existsSync(FILE)) throw new Error(`${FILE} does not exist; run npm run ranking:top200 first`);
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  enrichShowcase(data);
  fs.writeFileSync(FILE, `${JSON.stringify(data, null, 1)}\n`);
  const fork = (data.overall || []).filter(row => row.testing && row.testing.mode === "fork");
  const flows = fork.filter(row => row.testing.flow);
  console.log(`updated ${FILE}: ${flows.length}/${fork.length} fork rows carry a contract flow (${data.stats.forkInTop200} fork rows in the top 200)`);
}

main();
