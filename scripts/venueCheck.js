#!/usr/bin/env node
/**
 * Verify every address in `src/config/chains.js` actually has code on its chain.
 *
 *   node scripts/venueCheck.js                 # all chains
 *   node scripts/venueCheck.js base arbitrum   # named chains
 *   CONCURRENCY=6 node scripts/venueCheck.js
 *
 * A configured address that answers `eth_getCode` with `0x` is the worst kind of gap: the
 * config looks complete, quotes fail at runtime, and nothing points at the reason. This walk
 * flattens each chain's nested protocol blocks to dotted paths, checks every 0x address,
 * and writes `output/venue-check.json` plus a per-chain table.
 *
 * No fork is started — `eth_getCode` reads the live chain, which is the state a fork copies.
 * Exit code is 1 when a chain has a dead address; unknown/absent blocks are counted, not failed.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { JsonRpcProvider } = require("ethers");

const { CHAINS } = require("../src/config/chains");

const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const OUT = path.resolve(__dirname, "..", "output", "venue-check.json");
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Flatten a chain block to `dotted.path -> address`, skipping scalars like names. */
function addressesOf(chainKey) {
  const chain = CHAINS[chainKey];
  const found = [];
  const walk = (node, prefix) => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string" && ADDRESS_RE.test(v)) found.push({ path: p, address: v });
      else if (v && typeof v === "object") walk(v, p);
    }
  };
  walk(chain, "");
  return found;
}

async function checkChain(key) {
  const chain = CHAINS[key];
  if (!chain?.rpcUrl) return { chain: key, ok: false, error: "no rpcUrl", total: 0, verified: 0, dead: [] };
  const provider = new JsonRpcProvider(chain.rpcUrl, undefined, { staticNetwork: true, batchMaxCount: 1 });
  const items = addressesOf(key);
  const dead = [];
  let verified = 0;

  for (const item of items) {
    try {
      const code = await provider.getCode(item.address);
      if (code && code !== "0x") verified++;
      else dead.push(item);
    } catch (e) {
      dead.push({ ...item, error: e.shortMessage || e.message });
    }
  }

  return {
    chain: key,
    ok: dead.length === 0,
    total: items.length,
    verified,
    dead,
    blocks: {
      uniswap: Boolean(chain.uniswap),
      curve: Boolean(chain.curve),
      balancer: Boolean(chain.balancer),
      sushiswap: Boolean(chain.sushiswap),
      aave: Boolean(chain.aave),
      velodrome: Boolean(chain.velodrome),
      aerodrome: Boolean(chain.aerodrome),
    },
  };
}

(async () => {
  const named = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const keys = named.length ? named : Object.keys(CHAINS);

  const results = new Array(keys.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, keys.length) }, async () => {
      while (next < keys.length) {
        const i = next++;
        const r = await checkChain(keys[i]);
        results[i] = r;
        const detail = r.dead?.length ? `dead=${r.dead.length}` : r.total ? "all live" : "no addresses";
        console.log(`${r.ok ? "OK  " : "DEAD"}  ${r.chain.padEnd(14)} ${String(r.verified ?? 0).padStart(3)}/${String(r.total ?? 0).padEnd(3)} ${detail}`);
      }
    })
  );

  const withAddresses = results.filter((r) => r.total > 0);
  const deadChains = results.filter((r) => (r.dead || []).length);
  const deadTotal = deadChains.reduce((n, r) => n + r.dead.length, 0);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        chains: results.length,
        chainsWithAddresses: withAddresses.length,
        deadAddresses: deadTotal,
        results,
      },
      null,
      2
    )
  );

  console.log(`\n${withAddresses.length}/${results.length} chains carry protocol addresses; ${deadTotal} dead address(es) across ${deadChains.length} chain(s)`);
  if (deadChains.length) {
    for (const r of deadChains) {
      console.log(`\n${r.chain}:`);
      for (const d of r.dead) console.log(`  ${d.path.padEnd(34)} ${d.address} ${d.error ? `(${d.error})` : ""}`);
    }
    process.exit(1);
  }
  console.log(`summary: ${path.relative(process.cwd(), OUT)}`);
})();
