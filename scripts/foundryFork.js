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
    "PRIVATE_KEY",
  ]))
    env[key] = "";
  env.FORK_BLOCK = "0";
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
  const summary = {
    schemaVersion: 1,
    PASS: 0,
    FAIL: 0,
    SKIP: 0,
    infrastructureErrors: 0,
    plannedRows: registry.filter(e => e.status === "planned" && e.foundry_bucket !== "not-queued").length,
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
    };
    summary.chains.push(report);
    let anvil;
    try {
      const env = cleanEnv();
      if (url) {
        const pin = pins[CHAINS[chain].chainId];
        if (!pin?.blockNumber || !pin.blockHash)
          throw new Error(`No observed pin for ${chain}; run observe:fork-blocks with its RPC`);
        report.blockNumber = pin.blockNumber;
        anvil = await startAnvil(url, pin);
        env.FORK_RPC_URL = anvil.local;
        env.FORK_BLOCK = String(pin.blockNumber);
      }
      for (const entry of entries.filter(e => e.chain === chain)) {
        const { counts, code } = await forge(entry.file, env);
        for (const key of ["PASS", "FAIL", "SKIP"]) {
          report[key] += counts[key];
          summary[key] += counts[key];
        }
        report.tests.push(...counts.tests);
        if (executionFailed(counts, code, !!url)) failed = true;
        if (!url && (counts.PASS || counts.FAIL)) throw new Error("No-RPC mode unexpectedly executed a test");
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
  if (summary.SKIP)
    console.log(
      `::warning title=Foundry skips::${summary.SKIP} tests skipped; missing-RPC skips are not passes, configured-chain skips fail.`
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Foundry fork\n\n${line}\n\n**${summary.status}**\n\nInfrastructure errors: ${summary.infrastructureErrors}; planned rows: ${summary.plannedRows} (not counted as tests).\n`
    );
  fs.mkdirSync(path.join(ROOT, "output"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "output/foundry-fork-summary.json"), JSON.stringify(summary, null, 2) + "\n");
  if (failed) process.exitCode = 1;
}
if (require.main === module)
  main().catch(() => {
    console.error("Foundry runner setup failed (details suppressed to protect RPC URLs).");
    process.exitCode = 1;
  });
module.exports = { cleanEnv };
