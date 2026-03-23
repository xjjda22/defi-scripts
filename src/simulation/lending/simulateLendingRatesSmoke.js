require("dotenv").config();
const { spawnSync } = require("child_process");
const chalk = require("chalk");
const path = require("path");

const root = path.join(__dirname, "..", "..", "..");

function runNode(rel, env = {}) {
  const r = spawnSync(process.execPath, [path.join(root, rel)], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  console.log(r.stdout?.trim());
  return true;
}

async function main() {
  console.log(chalk.cyan("— Morpho GraphQL —"));
  if (!runNode("src/simulation/api/smokeMorphoGraphql.js")) process.exit(1);
  console.log(chalk.cyan("\n— Aave V2/V3 read —"));
  if (!runNode("src/simulation/lending/simulateAaveVersionsFork.js")) process.exit(1);
  console.log(chalk.green("\nOK: lending rates smoke\n"));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
