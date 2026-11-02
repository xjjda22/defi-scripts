/**
 * Find the anvil binary. Order: ANVIL_BIN, PATH, ~/.foundry/bin/anvil (foundryup's
 * default install dir, which a non-login shell often does not have on PATH).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function works(bin) {
  const check = spawnSync(bin, ["--version"], { encoding: "utf8" });
  return !check.error && check.status === 0;
}

let cached;
function anvilBin() {
  if (cached !== undefined) return cached;
  const candidates = [];
  if (process.env.ANVIL_BIN) candidates.push(process.env.ANVIL_BIN);
  candidates.push("anvil");
  const foundry = path.join(process.env.FOUNDRY_DIR || path.join(os.homedir(), ".foundry"), "bin", "anvil");
  if (fs.existsSync(foundry)) candidates.push(foundry);
  cached = candidates.find(works) || null;
  return cached;
}

function anvilMissing() {
  return !anvilBin();
}

function printAnvilHelp() {
  console.error("anvil was not found (checked ANVIL_BIN, PATH and ~/.foundry/bin).");
  console.error("Install Foundry, then rerun:");
  console.error("  curl -L https://foundry.paradigm.xyz | bash && foundryup");
}

module.exports = { anvilBin, anvilMissing, printAnvilHelp };
