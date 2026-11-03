#!/usr/bin/env node
/**
 * Merge `output/chain-specs/*.json` into a `src/config/chains.js` CHAINS object.
 *
 *   node scripts/importChainSpecs.js src/config/chains.js
 *   node scripts/importChainSpecs.js ../defi-mev/src/config/chains.js
 *
 * Specs are written by the per-chain onboarding agents and are the only file those agents
 * touch, so the shared config is edited in one serial pass instead of by parallel writers.
 * A chain already present is left alone; a spec with `forked: false` is skipped, so a chain
 * that never answered a fork cannot land as a working entry.
 */

const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/importChainSpecs.js <path to chains.js>");
  process.exit(1);
}

const specDir = path.resolve(__dirname, "..", "output", "chain-specs");
const specs = fs
  .readdirSync(specDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(specDir, f), "utf8")))
  .filter((s) => s.key && s.chainId && s.forked)
  .sort((a, b) => a.chainId - b.chainId);

const target = path.resolve(process.cwd(), file);
const src = fs.readFileSync(target, "utf8");

const present = new Set();
for (const m of src.matchAll(/^\s{2}([a-z][a-z0-9]*):\s*\{/gm)) present.add(m[1]);

const fresh = specs.filter((s) => !present.has(s.key));
if (!fresh.length) {
  console.log(`${file}: every spec is already present (${present.size} chains)`);
  process.exit(0);
}

const render = (s) => {
  const rpcDefault = s.source === "public" && s.publicUrl ? ` || "${s.publicUrl}"` : "";
  return [
    `  ${s.key}: {`,
    `    name: "${s.name}",`,
    `    chainId: ${s.chainId},`,
    `    rpcUrl: process.env.${s.rpcEnv}${rpcDefault},`,
    `    explorer: "${s.explorer || ""}",`,
    `    nativeSymbol: "${s.nativeSymbol || "ETH"}",`,
    `  },`,
  ].join("\n");
};

// Insert before the `};` that closes CHAINS: the last `};` before COMMON_TOKENS (or before
// module.exports when the file has no COMMON_TOKENS block).
const anchor = src.search(/^const COMMON_TOKENS/m);
const limit = anchor >= 0 ? anchor : src.length;
const closeIdx = src.lastIndexOf("};", limit);
if (closeIdx < 0) {
  console.error("could not find the end of the CHAINS object");
  process.exit(1);
}

const block = fresh.map(render).join("\n");
const out = `${src.slice(0, closeIdx)}${block}\n${src.slice(closeIdx)}`;
fs.writeFileSync(target, out);

console.log(`${file}: added ${fresh.length} chain(s) — ${fresh.map((s) => s.key).join(", ")}`);
