#!/usr/bin/env node
/** One isolated, pinned Anvil per configured chain. Only public result counts are persisted.
 * Missing RPC => real forge JSON skips, explicitly NOT a fork pass.
 * Configured RPC => any unexpected skip is a failure, even when forge exits zero.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const { spawn } = require("child_process");
const { once } = require("events");
const { buildRegistry, checkRegistry } = require("../src/catalog/foundryTests");
const { RPC_ENV } = require("../src/catalog/forkRecipes");
const { CHAINS } = require("../src/config/chains");
const { anvilBin } = require("./lib/anvil");
const { rpc } = require("./observeForkBlocks");
const { parseForgeJson, executionFailed } = require("./lib/foundryResults");
const ROOT = path.resolve(__dirname, "..");
const live = new Set();
process.on("exit", () => {
  for (const proc of live) proc.kill("SIGKILL");
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));
function cleanEnv() {
  const env = { ...process.env };
  // Explicit empty values prevent dotenv from reintroducing upstream RPCs.
  for (const key of new Set([
    ...Object.keys(env).filter(key => /RPC_URL$/.test(key)),
    ...Object.values(RPC_ENV),
    "FORK_RPC_URL",
    "ETH_RPC_URL",
    ...Object.keys(env).filter(key => /PRIVATE_KEY$/.test(key) || /^FORK_.*_WHALE$/.test(key)),
    "PRIVATE_KEY",
    "FOUNDRY_FORK_URL",
    "DAPP_FORK_URL",
  ]))
    env[key] = "";
  env.FORK_BLOCK = "0";
  env.FORK_CHAIN_ID = "1";
  env.FOUNDRY_FFI = "false";
  env.DOTENV_CONFIG_PATH = "/dev/null";
  return env;
}
function forgeBin() {
  if (process.env.FORGE_BIN) return process.env.FORGE_BIN;
  const candidate = path.join(os.homedir(), ".foundry/bin/forge");
  return fs.existsSync(candidate) ? candidate : "forge";
}
async function forge(file, env) {
  const child = spawn(forgeBin(), ["test", "--match-path", file, "--json", "--threads", "1"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  live.add(child);
  let stdout = "";
  child.stdout.on("data", chunk => {
    stdout += chunk;
  });
  // Discard raw diagnostics: they can contain credential-bearing upstream URLs.
  child.stderr.resume();
  const timer = setTimeout(() => child.kill("SIGKILL"), Number(process.env.FOUNDRY_TEST_TIMEOUT_MS || 180000));
  try {
    const [code] = await once(child, "close");
    return { counts: parseForgeJson(stdout), code };
  } finally {
    clearTimeout(timer);
    live.delete(child);
  }
}
async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function startAnvil(url, pin) {
  if (!anvilBin()) throw new Error("Anvil missing; install Foundry");
  const port = await freePort();
  const child = spawn(
    anvilBin(),
    [
      "--fork-url",
      url,
      "--fork-block-number",
      String(pin.blockNumber),
      "--port",
      String(port),
      "--host",
      "127.0.0.1",
      "--silent",
    ],
    { cwd: ROOT, stdio: "ignore" }
  );
  live.add(child);
  child.on("error", () => {});
  const local = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + Number(process.env.FORK_VALIDATE_ANVIL_READY_MS || 120000);
  while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
    try {
      const chainId = Number(BigInt(await rpc(local, "eth_chainId", [])));
      const header = await rpc(local, "eth_getBlockByNumber", ["0x" + pin.blockNumber.toString(16), false]);
      if (chainId !== CHAINS[pin.chain].chainId || header.hash !== pin.blockHash)
        throw new Error("Fork identity mismatch");
      if (child.exitCode !== null || child.signalCode !== null) throw new Error("Owned Anvil exited during readiness");
      return { child, local };
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  child.kill("SIGKILL");
  live.delete(child);
  throw new Error("Pinned Anvil failed readiness/chain/hash verification (RPC details suppressed)");
}
async function stopAnvil(child) {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, "close");
    child.kill("SIGKILL");
    await closed;
  }
  live.delete(child);
}
function writeSummary(summary, file = path.join(ROOT, "output/foundry-fork-summary.json")) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(summary, null, 2) + "\n");
}
function setupFailureSummary() {
  return {
    schemaVersion: 1,
    PASS: 0,
    FAIL: 0,
    SKIP: 0,
    infrastructureErrors: 1,
    plannedRows: null,
    chains: [],
    status: "FAILED: setup prevented execution; no tests counted",
  };
}
async function main() {
  const registry = buildRegistry();
  const validation = checkRegistry(registry);
  if (validation.problems.length) throw new Error(validation.problems.join("; "));
  const selected = process.env.CHAINS?.split(",").map(x => x.trim());
  if (selected?.some(chain => !RPC_ENV[chain])) throw new Error("Unknown CHAINS selection");
  const entries = registry.filter(
    row => row.file?.startsWith("test/contracts/protocols/") && (!selected || selected.includes(row.chain))
  );
  if (!entries.length) throw new Error("No implemented protocol tests selected");
  const pinData = require("../data/fork-blocks.json");
  if (require("./lib/forkBlocks").checkForkBlocks(pinData).length) throw new Error("Invalid observed fork headers");
  const pins = pinData.chainsById;
  const repeats = process.argv.includes("--twice") ? 2 : 1;
  const newCounts = () => ({ PASS: 0, FAIL: 0, SKIP: 0 });
  const summary = {
    schemaVersion: 1,
    runs: Array.from({ length: repeats }, (_, i) => ({ iteration: i + 1, ...newCounts() })),
    PASS: 0,
    FAIL: 0,
    SKIP: 0,
    infrastructureErrors: 0,
    plannedRows: registry.filter(e => e.status === "planned" && e.foundry_bucket !== "not-queued").length,
    coverageBlockedRows: registry.filter(e => e.coverageStatus === "blocked").length,
    acceptedW1Rows: registry.filter(e => e.wave === "W1" && e.coverageStatus === "accepted").length,
    chains: [],
  };
  let failed = false;
  for (const chain of [...new Set(entries.map(e => e.chain))]) {
    const url = process.argv.includes("--no-rpc")
      ? ""
      : process.env[RPC_ENV[chain]] || (chain === "ethereum" && process.env.ETH_RPC_URL) || "";
    const report = {
      chain,
      mode: url ? "executed" : "no-rpc",
      blockNumber: null,
      PASS: 0,
      FAIL: 0,
      SKIP: 0,
      tests: [],
      runs: Array.from({ length: repeats }, (_, i) => ({ iteration: i + 1, ...newCounts() })),
    };
    summary.chains.push(report);
    let anvil;
    try {
      const env = { ...cleanEnv(), ...require("./lib/foundryFunding").fundingEnv(chain, process.env) };
      if (url) {
        const pin = pins[CHAINS[chain].chainId];
        if (!pin?.blockNumber || !pin.blockHash)
          throw new Error(`No observed pin for ${chain}; run observe:fork-blocks with its RPC`);
        report.blockNumber = pin.blockNumber;
        anvil = await startAnvil(url, pin);
        env.FORK_RPC_URL = anvil.local;
        env.FORK_BLOCK = String(pin.blockNumber);
        env.FORK_CHAIN_ID = String(CHAINS[chain].chainId);
      }
      // Each pass uses fresh Forge forks; the owned Anvil remains read-only at the same pin.
      // Repeating before shutdown permits warm-cache acceptance without sharing mutable test state.
      for (let iteration = 0; iteration < repeats; iteration++) {
        for (const entry of entries.filter(e => e.chain === chain)) {
          const { counts, code } = await forge(entry.file, env);
          for (const key of ["PASS", "FAIL", "SKIP"]) {
            report[key] += counts[key];
            summary[key] += counts[key];
            report.runs[iteration][key] += counts[key];
            summary.runs[iteration][key] += counts[key];
          }
          report.tests.push(...counts.tests.map(test => ({ ...test, iteration: iteration + 1 })));
          console.log(
            `${chain} run ${iteration + 1} ${entry.slug}: PASS ${counts.PASS}, FAIL ${counts.FAIL}, SKIP ${counts.SKIP}`
          );
          if (executionFailed(counts, code, !!url)) failed = true;
          if (!url && (counts.PASS || counts.FAIL)) throw new Error("No-RPC mode unexpectedly executed a test");
        }
      }
    } catch {
      report.mode = "infrastructure-error";
      report.error =
        "Unable to execute/parse pinned suite; check toolchain, observed pin, RPC archive support and timeout. No endpoint diagnostics retained.";
      summary.infrastructureErrors++;
      failed = true;
    } finally {
      if (anvil) await stopAnvil(anvil.child);
    }
  }
  summary.status = failed
    ? "FAILED"
    : summary.PASS
      ? summary.SKIP
        ? "PARTIAL"
        : "EXECUTED"
      : "SKIPPED: no fork test ran; not a fork-test pass";
  const line = `PASS ${summary.PASS}, FAIL ${summary.FAIL}, SKIP ${summary.SKIP}`;
  console.log(`${line} — ${summary.status}; infrastructure errors ${summary.infrastructureErrors}`);
  console.log(
    `Coverage is separate: W1 accepted ${summary.acceptedW1Rows}, blocked ${summary.coverageBlockedRows}; planned rows ${summary.plannedRows}.`
  );
  if (summary.SKIP)
    console.log(
      `::warning title=Foundry skips::${summary.SKIP} tests skipped; missing-RPC skips are not passes, configured-chain skips fail.`
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Foundry fork\n\n${line}\n\n**${summary.status}**\n\nInfrastructure errors: ${summary.infrastructureErrors}; planned rows: ${summary.plannedRows} (not counted as tests).\n\nExecution PASS does not imply complete primitive coverage: W1 accepted ${summary.acceptedW1Rows}; blocked ${summary.coverageBlockedRows}.\n`
    );
  writeSummary(summary);
  if (failed) process.exitCode = 1;
}
if (require.main === module)
  main().catch(() => {
    const summary = setupFailureSummary();
    writeSummary(summary);
    console.error(
      "PASS 0, FAIL 0, SKIP 0 — FAILED: setup prevented execution; infrastructure errors 1 (RPC details suppressed)."
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "## Foundry fork\n\n**FAILED: setup prevented execution.** PASS 0, FAIL 0, SKIP 0; infrastructure errors 1.\n"
      );
    process.exitCode = 1;
  });
module.exports = { cleanEnv, writeSummary, setupFailureSummary };
