#!/usr/bin/env node
/**
 * Run the Aave fork test against a local Anvil fork of each chain that has an Aave V3 pool.
 *
 *   node scripts/forkAaveCheck.js
 *   CHAINS=ethereum,base node scripts/forkAaveCheck.js
 *
 * For each chain: verify the pool and the USDC address have code on that chain, start
 * `anvil --fork-url <RPC>`, point `FORK_RPC_URL` at the anvil fork, and run
 * `forge test --match-contract AaveFlashReceiverFork`. The Solidity test then takes a real
 * flash loan from the real pool through the receiver we build locally.
 *
 * The addresses are verified before use — a chain whose pool or token has no code is reported
 * as a gap, not attempted.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { JsonRpcProvider, getAddress } = require("ethers");

const { CHAINS } = require("../src/config/chains");

// Aave V3 pool + native USDC. Verified per chain in `verify()` before any fork starts.
// Verified pool+USDC map, written by the chain-map pass (data/aave-chains.json). Every entry
// was proven by ADDRESSES_PROVIDER() on the pool and symbol() on the reserve, not by code alone.
const VERIFIED = (() => {
  try {
    const m = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "aave-chains.json"), "utf8"));
    return Object.fromEntries(m.chains.map((c, i) => [c.chain, { pool: c.pool, usdc: c.usdc, port: 8901 + i }]));
  } catch {
    return null;
  }
})();

const FALLBACK = {
  ethereum: { pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", port: 8901 },
  arbitrum: { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", port: 8902 },
  optimism: { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", port: 8903 },
  base: { pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", port: 8904 },
  polygon: { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", port: 8905 },
};

const AAVE = VERIFIED || FALLBACK;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpcReady(url, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      });
      const json = await res.json();
      if (json.result && BigInt(json.result) > 0n) return BigInt(json.result).toString();
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("anvil did not answer");
}

async function verify(chain, cfg) {
  const provider = new JsonRpcProvider(CHAINS[chain].rpcUrl, undefined, { staticNetwork: true, batchMaxCount: 1 });
  const [poolCode, usdcCode] = await Promise.all([provider.getCode(cfg.pool), provider.getCode(cfg.usdc)]);
  provider.destroy?.();
  if (poolCode === "0x" || usdcCode === "0x") {
    throw new Error(`missing code (pool ${(poolCode.length - 2) / 2}B, usdc ${(usdcCode.length - 2) / 2}B)`);
  }
  return { poolCode: (poolCode.length - 2) / 2, usdcCode: (usdcCode.length - 2) / 2 };
}

async function runChain(chain) {
  const cfg = AAVE[chain];
  const rpc = CHAINS[chain]?.rpcUrl;
  if (!rpc) return { chain, ok: false, error: "no rpc" };
  if (!cfg) return { chain, ok: false, error: "no Aave V3 config" };

  let evidence;
  try {
    evidence = await verify(chain, cfg);
  } catch (e) {
    return { chain, ok: false, error: `address check: ${e.message}` };
  }

  const url = `http://127.0.0.1:${cfg.port}`;
  const anvil = spawn("anvil", ["--fork-url", rpc, "--port", String(cfg.port), "--host", "127.0.0.1", "--silent"], {
    stdio: "ignore",
  });
  try {
    const block = await rpcReady(url);
    const out = await new Promise((resolve) => {
      const child = spawn(
        "forge",
        ["test", "--match-contract", "AaveFlashReceiverFork", "-vv"],
        {
          cwd: path.resolve(__dirname, ".."),
          env: {
            ...process.env,
            FORK_RPC_URL: url,
            AAVE_POOL: getAddress(cfg.pool),
            AAVE_USDC: getAddress(cfg.usdc),
          },
        }
      );
      let text = "";
      child.stdout.on("data", (d) => (text += d));
      child.stderr.on("data", (d) => (text += d));
      child.on("close", (code) => resolve({ code, text }));
    });
    const passed = /\[PASS\] test_fork_aave_flashloan_roundtrip/.test(out.text);
    return {
      chain,
      ok: out.code === 0 && passed,
      forkBlock: block,
      evidence,
      summary: (out.text.match(/Suite result:.*$/m) || [""])[0],
      error: passed ? undefined : (out.text.match(/\[FAIL[^\]]*\]/) || ["forge test failed"])[0],
    };
  } catch (e) {
    return { chain, ok: false, error: e.message };
  } finally {
    anvil.kill("SIGKILL");
  }
}

(async () => {
  const named = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const fromEnv = (process.env.CHAINS || "").split(",").filter(Boolean);
  const keys = (named.length ? named : fromEnv.length ? fromEnv : Object.keys(AAVE)).filter((k) => AAVE[k]);

  const results = [];
  for (const chain of keys) {
    const r = await runChain(chain);
    results.push(r);
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${chain.padEnd(10)} ${
        r.ok ? `block=${r.forkBlock} pool=${r.evidence.poolCode}B usdc=${r.evidence.usdcCode}B` : r.error
      }`
    );
  }

  const dir = path.resolve(__dirname, "..", "output", "fork-aave");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} chains took a real Aave flash loan through the local receiver`);
  if (ok !== results.length) process.exit(1);
})();
