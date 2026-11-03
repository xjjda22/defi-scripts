#!/usr/bin/env node
/**
 * Discover which canonical DeFi deployments exist on every configured chain.
 *
 *   node scripts/venueDiscover.js                 # report only
 *   node scripts/venueDiscover.js --write         # add verified blocks to src/config/chains.js
 *   CHAINS=celo,linea node scripts/venueDiscover.js
 *
 * Only addresses that answer `eth_getCode` on that chain are reported as present, so an entry
 * can never be added from memory. A DEX block is written only when its **factory** is live —
 * a router without a factory cannot quote, and a factory alone is enough to derive pools.
 *
 * Addresses are the canonical singleton deployments (Uniswap V2/V3, Sushi V2/V3, Pancake V3,
 * Balancer V2, Aave V3). They are identical across chains where the protocol deployed, which
 * is exactly what makes this check meaningful: the same address either has code or it does not.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, getAddress } = require("ethers");

const { CHAINS } = require("../src/config/chains");

const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const OUT = path.resolve(__dirname, "..", "output", "venue-discover.json");

// dotted path -> canonical address
const CANDIDATES = {
  "uniswap.v2.factory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  "uniswap.v2.router": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "uniswap.v3.factory": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "uniswap.v3.router": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  "uniswap.v3.nftPositionManager": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  "uniswap.v3.quoter": "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
  "uniswap.v3.quoterV2": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  "sushiswap.v2.factory": "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
  "sushiswap.v2.router": "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
  "pancakeswap.v3.factory": "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  "balancer.v2.vault": "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
  "aave.v3.pool": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
};

// A DEX block is only useful with its factory.
const REQUIRES_FACTORY = {
  uniswap: "uniswap.v3.factory",
  sushiswap: "sushiswap.v2.factory",
  pancakeswap: "pancakeswap.v3.factory",
};

async function scan(key) {
  const chain = CHAINS[key];
  const provider = new JsonRpcProvider(chain.rpcUrl, undefined, { staticNetwork: true, batchMaxCount: 1 });
  const live = [];
  for (const [p, address] of Object.entries(CANDIDATES)) {
    try {
      const code = await provider.getCode(address);
      if (code && code !== "0x") live.push({ path: p, address: getAddress(address), bytes: (code.length - 2) / 2 });
    } catch {
      /* chain answered with an error: treat as absent */
    }
  }
  return { chain: key, chainId: Number((await provider.getNetwork()).chainId), live };
}

function groupByProtocol(live) {
  const out = {};
  for (const item of live) {
    const [top, mid, leaf] = item.path.split(".");
    if (!out[top]) out[top] = {};
    if (leaf) {
      out[top][mid] = out[top][mid] || {};
      out[top][mid][leaf] = item.address;
    } else {
      out[top][mid] = item.address;
    }
  }
  return out;
}

(async () => {
  const named = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const write = process.argv.includes("--write");
  const keys = named.length ? named : Object.keys(CHAINS);

  const results = new Array(keys.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, keys.length) }, async () => {
      while (next < keys.length) {
        const i = next++;
        results[i] = await scan(keys[i]);
        const r = results[i];
        const protos = [...new Set(r.live.map((l) => l.path.split(".")[0]))];
        console.log(`${r.chain.padEnd(14)} chainId=${String(r.chainId).padEnd(8)} ${protos.length ? protos.join(",") : "—"}`);
      }
    })
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ discoveredAt: new Date().toISOString(), results }, null, 2));

  const withVenue = results.filter((r) => r.live.length);
  console.log(`\n${withVenue.length}/${results.length} chains have at least one canonical deployment`);

  if (!write) {
    console.log(`summary: ${path.relative(process.cwd(), OUT)}  (re-run with --write to add blocks)`);
    return;
  }

  // Merge verified blocks into chains.js, in place, one chain at a time. Only leaves that
  // answered getCode are rendered, and a protocol the chain already configures is left alone.
  const target = path.resolve(__dirname, "..", "src", "config", "chains.js");
  const src = fs.readFileSync(target, "utf8");
  const blocks = src.split(/^(?=\s{2}[a-z][a-z0-9]*: \{)/m);
  let added = 0;

  const render = (proto, tree) => {
    const lines = [`    ${proto}: {`];
    for (const [mid, leaves] of Object.entries(tree)) {
      if (typeof leaves === "string") {
        lines.push(`      ${mid}: "${leaves}",`);
        continue;
      }
      lines.push(`      ${mid}: {`);
      for (const [leaf, addr] of Object.entries(leaves)) lines.push(`        ${leaf}: "${addr}",`);
      lines.push(`      },`);
    }
    lines.push(`    },`);
    return lines.join("\n");
  };

  for (let i = 0; i < blocks.length; i++) {
    const m = blocks[i].match(/^\s{2}([a-z][a-z0-9]*): \{/m);
    if (!m) continue;
    const key = m[1];
    const scan = results.find((r) => r.chain === key);
    if (!scan || !scan.live.length) continue;

    const tree = groupByProtocol(scan.live);
    const chainsBlock = CHAINS[key] || {};
    const fresh = Object.keys(tree).filter((proto) => {
      const needsFactory = REQUIRES_FACTORY[proto];
      if (needsFactory && !tree[proto]?.[needsFactory.split(".")[1]]?.[needsFactory.split(".")[2]]) return false;
      return !chainsBlock[proto];
    });
    if (!fresh.length) continue;

    const insertion = fresh.map((proto) => render(proto, tree[proto])).join("\n");
    const closeIdx = blocks[i].lastIndexOf("  },");
    if (closeIdx < 0) continue;
    blocks[i] = `${blocks[i].slice(0, closeIdx)}${insertion}\n${blocks[i].slice(closeIdx)}`;
    added += fresh.length;
  }

  if (added) {
    fs.writeFileSync(target, blocks.join(""));
    console.log(`chains.js: added ${added} verified protocol block(s)`);
  } else {
    console.log("chains.js: nothing to add");
  }
})();
