#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const chalk = require("chalk");

const ROOT = path.join(__dirname, "..");
const BASE_PORT = parseInt(process.env.FORK_VALIDATE_BASE_PORT || "19850", 10);
const ANVIL_READY_MS = parseInt(process.env.FORK_VALIDATE_ANVIL_READY_MS || "120000", 10);
const CHAIN_GAP_MS = parseInt(process.env.FORK_VALIDATE_CHAIN_GAP_MS || "6000", 10);
const ANVIL_SETTLE_MS = parseInt(process.env.FORK_VALIDATE_ANVIL_SETTLE_MS || "4000", 10);
const ANVIL_RETRIES = Math.min(5, Math.max(1, parseInt(process.env.FORK_VALIDATE_ANVIL_RETRIES || "3", 10) || 3));
const RETRY_WAIT_MS = parseInt(process.env.FORK_VALIDATE_RETRY_WAIT_MS || "10000", 10);
const PAIR = process.env.PAIR || "WETH/USDC";

const CHAIN_ORDER = ["ethereum", "arbitrum", "optimism", "base", "polygon", "bsc", "zksync", "scroll", "unichain"];

const RPC_ENV_KEY = {
  ethereum: "ETHEREUM_RPC_URL",
  arbitrum: "ARBITRUM_RPC_URL",
  optimism: "OPTIMISM_RPC_URL",
  base: "BASE_RPC_URL",
  polygon: "POLYGON_RPC_URL",
  bsc: "BSC_RPC_URL",
  zksync: "ZKSYNC_RPC_URL",
  scroll: "SCROLL_RPC_URL",
  unichain: "UNICHAIN_RPC_URL",
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function upstreamRpc(chainKey) {
  if (chainKey === "ethereum") {
    return process.env.ETHEREUM_RPC_URL || process.env.ETH_RPC_URL || null;
  }
  const k = RPC_ENV_KEY[chainKey];
  return k && process.env[k] ? process.env[k] : null;
}

function parseChainFilter() {
  const raw = (process.env.CHAINS || "").trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function waitForJsonRpc(forkHttpUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_blockNumber",
    params: [],
  });
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(forkHttpUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      const j = await res.json();
      if (j.result && /^0x[0-9a-f]+$/i.test(j.result)) return;
      lastErr = j.error ? JSON.stringify(j.error) : "no result";
    } catch (e) {
      lastErr = (e && e.message) || String(e);
    }
    await sleep(400);
  }
  throw new Error(`RPC not ready: ${forkHttpUrl} (${lastErr})`);
}

function startAnvil(upstream, port, forkBlock) {
  const args = ["--fork-url", upstream, "--port", String(port), "--host", "127.0.0.1"];
  if (forkBlock && String(forkBlock).trim()) {
    args.push("--fork-block-number", String(forkBlock).trim());
  }
  const proc = spawn("anvil", args, {
    stdio: ["ignore", "ignore", "pipe"],
    cwd: ROOT,
  });
  let stderr = "";
  proc.stderr?.on("data", d => {
    stderr += d.toString();
    if (stderr.length > 12000) stderr = stderr.slice(-6000);
  });
  proc.on("error", err => {
    stderr += `\nspawn error: ${err.message}`;
  });
  return { proc, getStderr: () => stderr };
}

function killAnvil(proc) {
  if (!proc || proc.killed) return;
  try {
    proc.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}

function runNode(scriptRel, env, extraArgs = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...extraArgs], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function wethUsdcQuoteSane(simOutput) {
  if (!/^WETH\/USDC$/i.test(PAIR.trim())) return { ok: true };
  const m = simOutput.match(/Expected Output:\s*([\d,.]+)\s*USDC/i);
  if (!m) return { ok: true };
  const v = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(v)) return { ok: false, reason: "unparseable Expected Output" };
  if (v < 50 || v > 100_000) return { ok: false, reason: `implausible USDC per 1 WETH (${v})` };
  return { ok: true };
}

function isRateLimitAnvilStderr(s) {
  return /429|rate limit|Max retries exceeded|Too Many Requests/i.test(s || "");
}

async function spawnAnvilAndWait(upstream, port, forkBlock) {
  let lastErr = "";
  let lastStderr = "";
  for (let attempt = 0; attempt < ANVIL_RETRIES; attempt++) {
    const { proc, getStderr } = startAnvil(upstream, port, forkBlock);
    try {
      await waitForJsonRpc(`http://127.0.0.1:${port}`, Math.ceil(ANVIL_READY_MS / ANVIL_RETRIES) + 5000);
      await sleep(ANVIL_SETTLE_MS);
      return { proc, getStderr };
    } catch (e) {
      lastErr = e.message;
      lastStderr = getStderr();
      killAnvil(proc);
      if (attempt < ANVIL_RETRIES - 1 && isRateLimitAnvilStderr(lastStderr)) {
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      if (isRateLimitAnvilStderr(lastStderr)) {
        return { rateLimited: true, error: lastErr, anvilStderr: lastStderr };
      }
      return { error: lastErr, anvilStderr: lastStderr };
    }
  }
  return { error: lastErr || "anvil retries exhausted", anvilStderr: lastStderr };
}

async function validateChain(chainKey, port) {
  const upstream = upstreamRpc(chainKey);
  if (!upstream) {
    return { chainKey, skipped: true, reason: "no upstream RPC in env" };
  }

  const envKey = RPC_ENV_KEY[chainKey] || "ETHEREUM_RPC_URL";
  const forkUrl = `http://127.0.0.1:${port}`;
  const forkBlock = process.env.FORK_BLOCK_NUMBER || process.env.FORK_BLOCK || "";

  const anvilResult = await spawnAnvilAndWait(upstream, port, forkBlock);
  if (anvilResult.rateLimited) {
    return {
      chainKey,
      skipped: true,
      reason: "upstream RPC rate limit / anvil fork failed (retry later or increase FORK_VALIDATE_RETRY_WAIT_MS)",
    };
  }
  if (anvilResult.error && !anvilResult.proc) {
    return {
      chainKey,
      ok: false,
      phase: "anvil",
      error: anvilResult.error,
      anvilStderr: anvilResult.anvilStderr,
    };
  }

  const proc = anvilResult.proc;
  const getStderr = anvilResult.getStderr;

  const childEnv = {
    [envKey]: forkUrl,
    CHAIN: chainKey,
    PAIR,
    SIMULATE_ONLY: "true",
  };
  if (chainKey === "ethereum") {
    childEnv.ETHEREUM_RPC_URL = forkUrl;
    childEnv.ETH_RPC_URL = forkUrl;
  }

  const sim = runNode("src/simulation/simulateMultiProtocol.js", childEnv);
  const out = `${sim.stdout}\n${sim.stderr}`;
  const noLiquidity = /No liquidity found on any protocol/m.test(out);
  const hasBest = /Expected Output:/m.test(out) && !noLiquidity;
  const sane = wethUsdcQuoteSane(out);
  const quotesOk = hasBest && sane.ok;
  const ok = sim.status === 0 && quotesOk;

  killAnvil(proc);
  await sleep(CHAIN_GAP_MS);

  let bestLine = "";
  const m = out.match(/Best Quote[\s\S]*?Expected Output:\s*[^\n]+/);
  if (m) bestLine = m[0].split("\n").slice(0, 5).join(" | ");

  return {
    chainKey,
    ok,
    phase: "simulate:multi:quote",
    exitCode: sim.status,
    quotesOk: hasBest,
    sanityOk: sane.ok,
    sanityReason: sane.reason,
    noLiquidity,
    snippet: bestLine || out.slice(-1200),
    anvilStderr: ok ? "" : getStderr?.(),
  };
}

async function validateEthereumExecution(port) {
  const upstream = upstreamRpc("ethereum");
  if (!upstream) return { skipped: true, reason: "no ETHEREUM_RPC_URL" };

  const forkUrl = `http://127.0.0.1:${port}`;
  const forkBlock = process.env.FORK_BLOCK_NUMBER || process.env.FORK_BLOCK || "";
  const anvilResult = await spawnAnvilAndWait(upstream, port, forkBlock);
  if (anvilResult.rateLimited) {
    return { skipped: true, reason: "rate limit starting anvil" };
  }
  if (anvilResult.error && !anvilResult.proc) {
    return { ok: false, error: anvilResult.error, anvilStderr: anvilResult.anvilStderr };
  }

  const proc = anvilResult.proc;
  const childEnv = {
    ETHEREUM_RPC_URL: forkUrl,
    ETH_RPC_URL: forkUrl,
    CHAIN: "ethereum",
    PAIR,
    SIMULATE_ONLY: "false",
  };
  const sim = runNode("src/simulation/simulateMultiProtocol.js", childEnv);
  killAnvil(proc);
  await sleep(CHAIN_GAP_MS);

  const out = `${sim.stdout}\n${sim.stderr}`;
  const executed = /Trade executed successfully on fork|✓ Trade executed successfully/m.test(out);
  const ok = sim.status === 0 && executed;
  return { ok, exitCode: sim.status, executed, tail: out.slice(-2000) };
}

async function main() {
  const filter = parseChainFilter();
  const chains = filter ? CHAIN_ORDER.filter(c => filter.has(c)) : CHAIN_ORDER;

  console.log(chalk.cyan.bold("\nFork simulation validation"));
  console.log(chalk.gray(`Pair: ${PAIR} | chains: ${chains.join(", ")}`));
  console.log(
    chalk.gray(
      `Anvil: ready ≤${ANVIL_READY_MS}ms, ${ANVIL_RETRIES} retries, ${RETRY_WAIT_MS}ms backoff | gap between chains: ${CHAIN_GAP_MS}ms\n`
    )
  );

  const anvilCheck = spawnSync("anvil", ["--version"], { encoding: "utf8" });
  if (anvilCheck.error || anvilCheck.status !== 0) {
    console.error(
      chalk.red("anvil not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation")
    );
    process.exit(1);
  }

  const rows = [];
  let port = BASE_PORT;

  for (const chainKey of chains) {
    process.stdout.write(chalk.yellow(`→ ${chainKey} `));
    const r = await validateChain(chainKey, port++);
    rows.push(r);
    if (r.skipped) {
      console.log(chalk.gray(`skip (${r.reason})`));
    } else if (r.ok) {
      console.log(chalk.green("OK"));
    } else {
      console.log(chalk.red(`FAIL (${r.phase})`));
      if (r.error) console.log(chalk.gray(`  ${r.error}`));
      if (r.sanityReason) console.log(chalk.gray(`  sanity: ${r.sanityReason}`));
      if (r.noLiquidity) {
        console.log(
          chalk.gray(
            "  hint: no quotes for this PAIR — check `src/config/chains.js` pools/routers or try another PAIR= for this chain"
          )
        );
      }
      if (r.anvilStderr) console.log(chalk.gray(`  anvil: ${String(r.anvilStderr).slice(-400)}`));
    }
  }

  console.log(chalk.cyan("\n── Summary ──"));
  for (const r of rows) {
    if (r.skipped) {
      console.log(chalk.gray(`  ${r.chainKey}: skipped — ${r.reason}`));
    } else if (r.ok) {
      console.log(chalk.green(`  ${r.chainKey}: quotes OK on fork`));
      if (r.snippet) console.log(chalk.gray(`    ${r.snippet.slice(0, 180)}…`));
    } else {
      console.log(chalk.red(`  ${r.chainKey}: FAIL`));
      if (r.sanityReason) console.log(chalk.gray(`    sanity: ${r.sanityReason}`));
      if (r.snippet) console.log(chalk.gray(r.snippet.slice(0, 500)));
    }
  }

  if (process.env.FORK_VALIDATE_EXEC === "1") {
    console.log(chalk.cyan("\n── Ethereum full execution on fork (FORK_VALIDATE_EXEC=1) ──"));
    const ex = await validateEthereumExecution(port++);
    if (ex.skipped) {
      console.log(chalk.gray(`skipped: ${ex.reason}`));
    } else if (ex.ok) {
      console.log(chalk.green("OK: swap executed on fork"));
    } else {
      console.log(chalk.red("FAIL"));
      console.log(chalk.gray(ex.tail || ex.error || ""));
    }
    if (!ex.ok && !ex.skipped) process.exitCode = 1;
  }

  const failed = rows.filter(r => !r.skipped && !r.ok);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
