#!/usr/bin/env node
/**
 * Runs a table-driven script: `node scripts/runTarget.js <family> <key>`.
 *
 * `analytics:*` and `crosschain:*` used to be 117 one-line npm scripts. They are now
 * rows in `src/catalog/analyticsTargets.js` and `src/catalog/crosschainTargets.js`,
 * invoked through the `analytics` and `crosschain` drivers:
 *
 *   npm run analytics -- aave:liquidations
 *   npm run crosschain -- uniswap:tvl
 *
 * The table row supplies the module and its env. Anything already set in the shell
 * wins, so a one-off override still works.
 */

const { spawn } = require("child_process");
const path = require("path");
const { TARGETS: ANALYTICS_TARGETS } = require("../src/catalog/analyticsTargets");
const { TARGETS: CROSSCHAIN_TARGETS } = require("../src/catalog/crosschainTargets");

const ROOT = path.join(__dirname, "..");
const FAMILIES = {
  analytics: ANALYTICS_TARGETS,
  crosschain: CROSSCHAIN_TARGETS,
};

function usage(family, targets) {
  const keys = targets.map(t => t.key).sort();
  console.error(`Unknown target. Run \`npm run ${family} -- <key>\`.`);
  console.error(`Keys: ${keys.join(", ")}`);
}

function main() {
  const family = String(process.argv[2] || "").trim();
  const key = String(process.argv[3] || "").trim();
  const targets = FAMILIES[family];
  if (!targets) {
    console.error(`Unknown family "${family}". Expected: ${Object.keys(FAMILIES).join(", ")}`);
    process.exit(1);
  }
  if (!key) {
    usage(family, targets);
    process.exit(1);
  }
  const target =
    targets.find(t => t.key === key) ||
    (targets.filter(t => t.key.split(":")[0] === key).length === 1
      ? targets.find(t => t.key.split(":")[0] === key)
      : null);
  if (!target) {
    usage(family, targets);
    process.exit(1);
  }

  const env = { ...process.env };
  for (const [name, value] of Object.entries(target.env || {})) {
    if (env[name] === undefined) env[name] = String(value);
  }
  const child = spawn(process.execPath, [path.join(ROOT, target.module), ...process.argv.slice(4)], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : code == null ? 1 : code));
  child.on("error", err => {
    console.error(err.message);
    process.exit(1);
  });
}

main();
