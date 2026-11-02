#!/usr/bin/env node
/**
 * Run every fork:<protocol>:<action> script.
 * One Anvil process per chain, pinned with FORK_BLOCK when that env var is set.
 *
 *   npm run fork:all
 *   CHAINS=ethereum npm run fork:all
 *   FORK_BLOCK=21000000 npm run fork:all
 *
 * Missing RPC URLs skip that chain. SKIP does not fail the process.
 * Any FAIL exits 1. A missing anvil binary prints Foundry install instructions and exits 1
 * only when at least one chain has an RPC.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawn } = require("child_process");
const path = require("path");
const { suitePlans, RPC_ENV } = require("../src/catalog/forkRecipes");

const ROOT = path.join(__dirname, "..");
const BASE_PORT = parseInt(process.env.FORK_SUITE_BASE_PORT || "19870", 10);
const ANVIL_READY_MS = parseInt(process.env.FORK_VALIDATE_ANVIL_READY_MS || "120000", 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function upstream(chain) {
  if (chain === "ethereum") return process.env.ETHEREUM_RPC_URL || process.env.ETH_RPC_URL || "";
  const configured = process.env[RPC_ENV[chain]] || "";
  if (configured) return configured;
  // FORK_PUBLIC_RPC=1 (local opt-in) forks from the first public endpoint instead of skipping.
  if (process.env.FORK_PUBLIC_RPC === "1" && PUBLIC_RPCS[chain]) return PUBLIC_RPCS[chain][0];
  return "";
}

/**
 * Public fallbacks, tried in order when the configured upstream cannot start an Anvil
 * fork (rate limit, archive limit, dead node). Disable with FORK_RPC_FALLBACK=0.
 * publicnode Base answers "Archive requests require a personal token", so Base uses
 * the official endpoint only.
 */
const PUBLIC_RPCS = {
  ethereum: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
  optimism: ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io"],
  base: ["https://mainnet.base.org"],
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
  bsc: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org"],
  avalanche: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"],
  monad: ["https://rpc.monad.xyz"],
};

function candidates(chain) {
  const first = upstream(chain);
  if (!first) return [];
  const list = [first];
  if (process.env.FORK_RPC_FALLBACK !== "0") {
    for (const url of PUBLIC_RPCS[chain] || []) if (!list.includes(url)) list.push(url);
  }
  return list;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(configured)";
  }
}

// A FAIL whose output matches one of these is an RPC problem, not a test result.
const TRANSIENT = /timeout|timed out|ECONNRESET|ECONNREFUSED|socket hang up|429|Too Many Requests|rate limit|header not found|missing trie node|Archive requests|could not detect network|SERVER_ERROR|502|503|504/i;
// Tests seen flaking on public RPCs or on protocol liquidity; retried once on any FAIL.
const RETRY_ONCE = new Set(
  (process.env.FORK_RETRY_SCRIPTS ||
    "fork:velodrome:swap,fork:venus:supply,fork:rockawayx:deposit,fork:etherfi-cash:supply")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
);

function selectedChains(plans) {
  const raw = (process.env.CHAINS || "").trim();
  const allow = raw
    ? new Set(
        raw
          .split(",")
          .map(item => item.trim().toLowerCase())
          .filter(Boolean)
      )
    : null;
  const chains = [];
  for (const plan of plans) {
    if (allow && !allow.has(plan.chain)) continue;
    if (!chains.includes(plan.chain)) chains.push(plan.chain);
  }
  return chains;
}

async function waitForRpc(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] });
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      const json = await res.json();
      if (json.result && /^0x[0-9a-f]+$/i.test(json.result)) return parseInt(json.result, 16);
      last = json.error ? JSON.stringify(json.error) : "no result";
    } catch (err) {
      last = err.message || String(err);
    }
    await sleep(400);
  }
  throw new Error(last || "anvil not ready");
}

function startAnvil(url, port, forkBlock) {
  const args = ["--fork-url", url, "--port", String(port), "--host", "127.0.0.1"];
  if (forkBlock) args.push("--fork-block-number", String(forkBlock));
  const proc = spawn(anvilBin(), args, { stdio: ["ignore", "ignore", "pipe"], cwd: ROOT });
  LIVE_ANVILS.add(proc);
  let stderr = "";
  proc.stderr.on("data", chunk => {
    stderr += chunk.toString();
    if (stderr.length > 8000) stderr = stderr.slice(-4000);
  });
  return { proc, stderr: () => stderr };
}

const LIVE_ANVILS = new Set();
process.on("exit", () => {
  for (const proc of LIVE_ANVILS) {
    try {
      proc.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(130));
}

function stopAnvil(proc) {
  LIVE_ANVILS.delete(proc);
  if (!proc || proc.killed) return;
  try {
    proc.kill("SIGTERM");
  } catch {
    // already gone
  }
}

const { anvilBin, anvilMissing, printAnvilHelp } = require("./lib/anvil");

const TEST_TIMEOUT_MS = parseInt(process.env.FORK_TEST_TIMEOUT_MS || "180000", 10);

/**
 * Run one npm fork script in its own process group with a hard deadline.
 * spawnSync's timeout only kills npm; the node grandchild keeps the pipes open and
 * the suite hangs. Killing the whole group (-pid) cannot leave anything behind.
 */
function runScript(script, chain, forkUrl) {
  const env = { ...process.env, CHAIN: chain, FORK_TEST_TIMEOUT_MS: String(TEST_TIMEOUT_MS) };
  const key = RPC_ENV[chain];
  if (key) env[key] = forkUrl;
  if (chain === "ethereum") {
    env.ETHEREUM_RPC_URL = forkUrl;
    env.ETH_RPC_URL = forkUrl;
  }
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn("npm", ["run", "--silent", script], {
      cwd: ROOT,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const append = chunk => {
      out += chunk.toString();
      if (out.length > 12 * 1024 * 1024) out = out.slice(-1024 * 1024);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    let timedOut = false;
    const killGroup = signal => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        // group already gone
      }
    };
    // The script has its own watchdog at TEST_TIMEOUT_MS; this is the backstop.
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      setTimeout(() => killGroup("SIGKILL"), 3000).unref();
    }, TEST_TIMEOUT_MS + 15000);
    child.on("close", code => {
      clearTimeout(timer);
      killGroup("SIGKILL");
      const match = out.match(/FORK_RESULT\s+(.+)/);
      const fields = {};
      if (match) {
        for (const part of match[1].split(/\s+/)) {
          const idx = part.indexOf("=");
          if (idx > 0) fields[part.slice(0, idx)] = part.slice(idx + 1);
        }
      }
      let status = fields.status || (code === 0 ? "PASS" : "FAIL");
      if (timedOut) status = "FAIL";
      if (status === "PASS" && code !== 0) status = "FAIL";
      const keyText = timedOut ? `timeout after ${TEST_TIMEOUT_MS + 15000} ms` : (match ? match[1].replace(/^.*?block=\S+\s*/, "") : "");
      resolve({
        script,
        chain,
        status,
        block: fields.block || "-",
        key: keyText,
        protocol: fields.protocol || script.split(":")[1] || script,
        action: fields.action || script.split(":")[2] || "-",
        seconds: Math.round((Date.now() - started) / 1000),
        tail: out.trim().split("\n").slice(-8).join("\n"),
        error: timedOut ? "timeout" : "",
      });
    });
  });
}

async function main() {
  const only = new Set(
    (process.env.FORK_ONLY || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
  );
  const plans = suitePlans().filter(plan => !only.size || only.has(plan.script));
  const chains = selectedChains(plans);
  const forkBlock = (process.env.FORK_BLOCK || process.env.FORK_BLOCK_NUMBER || "").trim();
  const rows = [];
  let port = BASE_PORT;
  const runnable = chains.filter(chain => upstream(chain));

  console.log(`Fork suite: ${plans.length} tests, chains ${chains.join(", ") || "(none)"}`);
  if (forkBlock) console.log(`Pinned block: ${forkBlock}`);

  if (runnable.length && anvilMissing()) {
    printAnvilHelp();
    process.exit(1);
  }

  for (const chain of chains) {
    const mine = plans.filter(plan => plan.chain === chain);
    const url = upstream(chain);
    if (!url) {
      for (const plan of mine) {
        rows.push({
          script: plan.script,
          protocol: plan.script.split(":")[1],
          action: plan.action,
          chain,
          status: "SKIP",
          block: "-",
          key: "",
          tail: `no ${plan.rpcEnv}`,
        });
        console.log(`SKIP  ${plan.script}  ${chain}  no ${plan.rpcEnv}`);
      }
      continue;
    }

    let started = null;
    let forkUrl = "";
    let block = "-";
    let reason = "";
    for (const candidate of candidates(chain)) {
      const attempt = startAnvil(candidate, port, forkBlock);
      const attemptUrl = `http://127.0.0.1:${port}`;
      port += 1;
      try {
        block = String(await waitForRpc(attemptUrl, ANVIL_READY_MS));
        started = attempt;
        forkUrl = attemptUrl;
        console.log(`\nAnvil ${chain} at ${forkUrl} block ${block} (upstream ${hostOf(candidate)})`);
        break;
      } catch (err) {
        stopAnvil(attempt.proc);
        reason = /429|rate limit|Too Many Requests/i.test(attempt.stderr()) ? "upstream RPC rate limit" : err.message;
        console.log(`Anvil ${chain} failed on ${hostOf(candidate)}: ${reason}`);
      }
    }
    if (!started) {
      for (const plan of mine) {
        rows.push({
          script: plan.script,
          protocol: plan.script.split(":")[1],
          action: plan.action,
          chain,
          status: "SKIP",
          block: "-",
          key: "",
          tail: reason,
        });
        console.log(`SKIP  ${plan.script}  ${chain}  ${reason}`);
      }
      continue;
    }

    for (const plan of mine) {
      process.stdout.write(`→ ${plan.script} `);
      let result = await runScript(plan.script, chain, forkUrl);
      const retry =
        result.status === "FAIL" &&
        process.env.FORK_RETRY !== "0" &&
        (RETRY_ONCE.has(plan.script) || TRANSIENT.test(`${result.key} ${result.tail}`));
      if (retry) {
        process.stdout.write(`FAIL (retrying once) `);
        const again = await runScript(plan.script, chain, forkUrl);
        again.retried = true;
        if (again.status === "PASS") again.key = `${again.key} (passed on retry)`.trim();
        result = again;
      }
      if (result.block === "-") result.block = block;
      rows.push(result);
      console.log(`${result.status}${result.key ? `  ${result.key}` : ""}`);
      if (result.status === "FAIL") console.log(result.tail);
    }
    stopAnvil(started.proc);
    await sleep(500);
  }

  console.log("\nprotocol\taction\tchain\tblock\tresult\tkey");
  for (const row of rows) {
    console.log([row.protocol, row.action, row.chain, row.block, row.status, row.key || row.tail || ""].join("\t"));
  }
  const failed = rows.filter(row => row.status === "FAIL");
  const passed = rows.filter(row => row.status === "PASS").length;
  const skipped = rows.filter(row => row.status === "SKIP").length;
  const retried = rows.filter(row => row.retried).length;
  console.log(`\n${passed} PASS, ${failed.length} FAIL, ${skipped} SKIP${retried ? `, ${retried} retried` : ""}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      "## Fork suite",
      "",
      `${passed} PASS, ${failed.length} FAIL, ${skipped} SKIP${retried ? `, ${retried} retried` : ""}`,
      "",
    ];
    const skippedChains = [...new Set(rows.filter(row => row.status === "SKIP").map(row => `${row.chain} (${row.tail})`))];
    if (skippedChains.length) lines.push(`Skipped chains: ${skippedChains.join(", ")}`, "");
    require("fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
  if (failed.length) process.exit(1);
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
