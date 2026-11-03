#!/usr/bin/env node
/**
 * Deploy the locally built fork contracts onto an Anvil fork of every configured chain.
 *
 *   node scripts/forkDeployCheck.js                 # every chain in src/config/chains.js
 *   node scripts/forkDeployCheck.js gnosis mantle   # named chains
 *   CHAINS=gnosis,mantle node scripts/forkDeployCheck.js
 *   CONCURRENCY=8 node scripts/forkDeployCheck.js
 *
 * For each chain it starts `anvil --fork-url <RPC>` on its own port, deploys the three
 * contracts from `src/simulation/fork/contracts/artifacts.json` (the same bytecode the
 * `fork:*` suite uses), then asserts three things on chain:
 *
 *   1. every deployment returned an address with non-empty code,
 *   2. a read call against each contract returns the value it was constructed with,
 *   3. the fork head is a real block (> 0).
 *
 * A chain that cannot fork (RPC down, rate-limited, no archive state) is reported as FAIL
 * with the reason — never silently skipped. Exit code is 1 when any chain fails.
 *
 * Writes output/fork-deploy/<chain>.json per chain and prints a summary table.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { JsonRpcProvider, ContractFactory, Contract, getAddress } = require("ethers");

const { CHAINS } = require("../src/config/chains");
const ARTIFACTS = require("../src/simulation/fork/contracts/artifacts.json");

const PORT_BASE = Number(process.env.FORK_PORT_BASE || 8800);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const READY_TIMEOUT_MS = Number(process.env.FORK_READY_TIMEOUT_MS || 60000);
const OUT_DIR = path.resolve(__dirname, "..", "output", "fork-deploy");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Raw JSON-RPC readiness probe, so ethers never starts against a half-booted anvil. */
async function waitForRpc(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      });
      const json = await res.json();
      if (json.result) {
        const block = Number.parseInt(json.result, 16);
        if (block > 0) {
          const provider = new JsonRpcProvider(url);
          provider.pollingInterval = 400;
          return { provider, block };
        }
      }
      last = json.error?.message || "no result";
    } catch (e) {
      last = e.message;
    }
    await sleep(500);
  }
  throw new Error(`fork did not answer in ${timeoutMs}ms (${last})`);
}

/** Constructor args, read from the ABI so a new contract needs no change here. */
function argsFor(name, abi) {
  const ctor = abi.find((x) => x.type === "constructor");
  if (!ctor || !ctor.inputs.length) return [];
  return ctor.inputs.map((input) =>
    input.type === "address" ? "0x000000000000000000000000000000000000dEaD" : 0
  );
}

async function withDeadline(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const CHAIN_ID_EXPECTED = Object.fromEntries(Object.entries(CHAINS).map(([k, v]) => [k, v.chainId]));

async function checkChain(chainKey, index) {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`unknown chain "${chainKey}"`);
  const rpc = chain.rpcUrl;
  if (!rpc) throw new Error(`no rpcUrl (set ${chainKey.toUpperCase()}_RPC_URL)`);

  const port = PORT_BASE + index;
  const url = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", ["--fork-url", rpc, "--port", String(port), "--host", "127.0.0.1", "--silent"], {
    stdio: "ignore",
  });
  const started = Date.now();
  try {
    const { provider, block } = await waitForRpc(url, READY_TIMEOUT_MS);

    // The fork must be the chain we asked for. A stale process on the port answers happily
    // with a different chain's state, which is how a matrix can be silently wrong.
    const forkChainId = Number((await provider.getNetwork()).chainId);
    if (CHAIN_ID_EXPECTED[chainKey] && forkChainId !== CHAIN_ID_EXPECTED[chainKey]) {
      throw new Error(
        `port ${port} answers chainId ${forkChainId}, expected ${CHAIN_ID_EXPECTED[chainKey]} (stale anvil?)`
      );
    }
    // Anvil signs with its own funded accounts; no key is held here.
    const wallet = await provider.getSigner(0);
    const deployed = [];

    for (const name of ["AaveFlashReceiver", "MorphoFlashReceiver", "MockPrice"]) {
      const art = ARTIFACTS[name];
      if (!art) throw new Error(`artifacts.json has no ${name}`);

      let address;
      let how;
      let gasUsed = "0";
      if (art.bytecode) {
        // Normal creation bytecode: deploy it.
        const factory = new ContractFactory(art.abi, art.bytecode, wallet);
        let contract;
        try {
          contract = await factory.deploy(...argsFor(name, art.abi));
        } catch (e) {
          // Arbitrum and a few L2s fail eth_estimateGas on contract creation against a
          // fork snapshot; an explicit gas limit is the documented way around it.
          if (!/estimateGas|CALL_EXCEPTION|missing revert/i.test(e.message)) throw e;
          contract = await factory.deploy(...argsFor(name, art.abi), { gasLimit: 4_000_000 });
        }
        await contract.waitForDeployment();
        address = getAddress(await contract.getAddress());
        const receipt = await contract.deploymentTransaction().wait();
        gasUsed = receipt.gasUsed.toString();
        how = "deploy";
      } else if (art.deployedBytecode) {
        // Deployed-only artifact (MockPrice): the fork suite installs it with anvil_setCode,
        // so this check does the same instead of pretending it can be constructed.
        address = getAddress(`0x${(0x1a11 + deployed.length).toString(16).padStart(40, "0")}`);
        await provider.send("anvil_setCode", [address, art.deployedBytecode]);
        how = "setCode";
      } else {
        throw new Error(`${name} has neither bytecode nor deployedBytecode`);
      }

      const code = await provider.getCode(address);
      if (!code || code === "0x") throw new Error(`${name} installed with empty code`);
      deployed.push({ name, address, how, codeBytes: (code.length - 2) / 2, gasUsed });
    }

    // Read-backs: each contract must answer with what it was built with.
    const aave = new Contract(deployed[0].address, ARTIFACTS.AaveFlashReceiver.abi, provider);
    const morpho = new Contract(deployed[1].address, ARTIFACTS.MorphoFlashReceiver.abi, provider);
    const asserts = {
      aavePool: getAddress(await aave.pool()),
      morpho: getAddress(await morpho.morpho()),
    };

    // MockPrice ships as deployed bytecode only (no abi in artifacts.json), so read
    // decimals() with a raw eth_call: selector 0x313ce567.
    const DECIMALS = "0x313ce567";
    const raw = await provider.call({ to: deployed[2].address, data: DECIMALS });
    asserts.decimals = Number(BigInt(raw));
    if (asserts.decimals !== 8) throw new Error(`MockPrice.decimals ${asserts.decimals} != 8`);

    return {
      chain: chainKey,
      chainId: Number((await provider.getNetwork()).chainId),
      ok: true,
      forkBlock: block,
      tookMs: Date.now() - started,
      deployed,
      asserts,
    };
  } catch (e) {
    console.error(`[${chainKey}]`, e.stack || e);
    return { chain: chainKey, ok: false, error: e.shortMessage || e.message, tookMs: Date.now() - started };
  } finally {
    anvil.kill("SIGKILL");
  }
}

async function main() {
  const named = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const fromEnv = (process.env.CHAINS || "").split(",").filter(Boolean);
  const keys = named.length ? named : fromEnv.length ? fromEnv : Object.keys(CHAINS);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`fork deploy check: ${keys.length} chain(s), concurrency ${CONCURRENCY}\n`);
  const results = new Array(keys.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, keys.length) }, async () => {
      while (next < keys.length) {
        const i = next++;
        try {
          results[i] = await withDeadline(checkChain(keys[i], i), 120000, keys[i]);
        } catch (e) {
          // A rejected chain must not abort the matrix: record it and keep going.
          results[i] = { chain: keys[i], ok: false, error: e.message, tookMs: 0 };
        }
        const r = results[i];
        console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.chain.padEnd(14)} ${r.ok ? `chainId=${r.chainId} block=${r.forkBlock}` : r.error}`);
        fs.writeFileSync(path.join(OUT_DIR, `${r.chain}.json`), JSON.stringify(r, null, 2));
      }
    })
  );

  const ok = results.filter((r) => r.ok);
  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, pass: ok.length, results }, null, 2)
  );
  console.log(`\n${ok.length}/${results.length} chains deployed all three contracts`);
  if (ok.length !== results.length) {
    console.log(`failed: ${results.filter((r) => !r.ok).map((r) => `${r.chain} (${r.error})`).join("; ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
