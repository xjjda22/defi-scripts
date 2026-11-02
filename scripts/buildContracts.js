#!/usr/bin/env node
/**
 * Build or verify `src/simulation/fork/contracts/artifacts.json`.
 *
 *   npm run build:contracts   # compile the .sol sources and update the artifacts
 *   npm run check:contracts   # compile and exit 1 when the artifacts are stale
 *
 * The fork tests deploy these contracts from `artifacts.json`, so editing a .sol file
 * without rebuilding would silently keep running the old bytecode. CI runs `--check`.
 *
 * Bytecode is compared with the CBOR metadata suffix stripped. solc embeds the build
 * path and settings in that suffix, so recompiling in a temporary directory changes
 * the trailing bytes without changing behaviour. Everything that executes must match;
 * the ABI is compared exactly for the two receivers.
 *
 * Compiler: solc 0.8.24 through Foundry, optimizer off (the pragma is exact, so the
 * version cannot float). The sources are copied to a scratch directory and compiled
 * with `src = "."`, which keeps the run reproducible on any machine.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHECK = process.argv.includes("--check");
const SOLC_VERSION = "0.8.24";
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src", "simulation", "fork", "contracts");
const ARTIFACTS = path.join(SRC_DIR, "artifacts.json");
const NOTE =
  "Compiled with solc 0.8.24 via `npm run build:contracts` (forge build --use 0.8.24, optimizer off) " +
  "from FlashReceivers.sol and MockPrice.sol in this folder.";

/** `bytecode` is creation code for the deployed receivers; MockPrice ships runtime code only. */
const CONTRACTS = [
  { name: "AaveFlashReceiver", source: "FlashReceivers.sol", field: "bytecode", compareAbi: true },
  { name: "MorphoFlashReceiver", source: "FlashReceivers.sol", field: "bytecode", compareAbi: true },
  { name: "MockPrice", source: "MockPrice.sol", field: "deployedBytecode", compareAbi: false },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Drop the trailing CBOR metadata (its last two bytes are its length). */
function stripMetadata(hex) {
  const h = String(hex || "").replace(/^0x/, "");
  if (h.length < 4) return h;
  const len = parseInt(h.slice(-4), 16);
  if (!Number.isFinite(len) || len <= 0 || len * 2 + 4 > h.length) return h;
  return h.slice(0, h.length - (len * 2 + 4));
}

function compile() {
  const tmp = path.join(os.tmpdir(), "defi-scripts-contracts");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const file of fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".sol"))) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(tmp, file));
  }
  fs.writeFileSync(path.join(tmp, "foundry.toml"), '[profile.default]\nsrc = "."\nout = "out"\n');
  const run = spawnSync("forge", ["build", "--root", tmp, "--use", SOLC_VERSION, "--force"], { encoding: "utf8" });
  if (run.error && run.error.code === "ENOENT") {
    fail("forge not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation");
  }
  if (run.status !== 0) fail(`forge build failed:\n${run.stdout || ""}\n${run.stderr || ""}`);
  return tmp;
}

function readBuilt(tmp) {
  const out = {};
  for (const contract of CONTRACTS) {
    const file = path.join(tmp, "out", contract.source, `${contract.name}.json`);
    if (!fs.existsSync(file)) fail(`compiler output missing for ${contract.name} (${contract.source})`);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    const code = contract.field === "deployedBytecode" ? json.deployedBytecode.object : json.bytecode.object;
    out[contract.name] = { abi: json.abi, code: `0x${code.replace(/^0x/, "")}` };
  }
  return out;
}

function main() {
  const built = readBuilt(compile());
  const onDisk = fs.existsSync(ARTIFACTS) ? JSON.parse(fs.readFileSync(ARTIFACTS, "utf8")) : {};

  const drifted = [];
  for (const contract of CONTRACTS) {
    const previous = onDisk[contract.name];
    if (!previous) {
      drifted.push(`${contract.name}: missing from artifacts.json`);
      continue;
    }
    const codeSame = stripMetadata(previous[contract.field]) === stripMetadata(built[contract.name].code);
    if (!codeSame) drifted.push(`${contract.name}: ${contract.field} does not match ${contract.source}`);
    if (contract.compareAbi && JSON.stringify(previous.abi) !== JSON.stringify(built[contract.name].abi)) {
      drifted.push(`${contract.name}: abi does not match ${contract.source}`);
    }
  }

  if (CHECK) {
    if (drifted.length) {
      fail(
        `artifacts.json is stale — run \`npm run build:contracts\`:\n${drifted.map(d => `  - ${d}`).join("\n")}`
      );
    }
    console.log(`check:contracts OK — ${CONTRACTS.length} artifacts match their .sol sources (solc ${SOLC_VERSION})`);
    return;
  }

  const next = { _note: NOTE };
  let changed = 0;
  for (const contract of CONTRACTS) {
    const previous = onDisk[contract.name];
    const same =
      previous &&
      stripMetadata(previous[contract.field]) === stripMetadata(built[contract.name].code) &&
      (!contract.compareAbi || JSON.stringify(previous.abi) === JSON.stringify(built[contract.name].abi));
    if (same) {
      next[contract.name] = previous; // keep the committed bytes so an unchanged contract never churns
      continue;
    }
    changed += 1;
    next[contract.name] = contract.compareAbi
      ? { abi: built[contract.name].abi, [contract.field]: built[contract.name].code }
      : { [contract.field]: built[contract.name].code };
  }

  const noteChanged = onDisk._note !== NOTE;
  if (!changed && !noteChanged) {
    console.log(`build:contracts — ${CONTRACTS.length} artifacts already up to date (solc ${SOLC_VERSION})`);
    return;
  }
  fs.writeFileSync(ARTIFACTS, `${JSON.stringify(next, null, 1)}\n`);
  console.log(
    `build:contracts — wrote ${path.relative(ROOT, ARTIFACTS)}: ${changed} rebuilt, ${CONTRACTS.length - changed} unchanged (solc ${SOLC_VERSION})`
  );
}

main();
