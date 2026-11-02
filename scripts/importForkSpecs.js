#!/usr/bin/env node
/**
 * Import fork-test specs written by the coverage agents into the six registries.
 *
 *   node scripts/importForkSpecs.js output/fork-specs/<target>.json [...]
 *
 * Each spec is the JSON shape documented in docs/07-fork-coverage-plan.md. The importer is
 * idempotent: a script, recipe, feature or registry entry that already exists is left alone, so
 * re-running after a partial failure is safe.
 *
 * It does the mechanical edits only. The feature-matrix row in
 * `src/catalog/protocolFeatures.js` still needs a human pass when the protocol already has an
 * entry there, because choosing which documented feature a test closes is a judgement call —
 * `npm run coverage:features:check` names every fork script that is still unmapped.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RPC_ENV = {
  ethereum: "ETHEREUM_RPC_URL",
  arbitrum: "ARBITRUM_RPC_URL",
  optimism: "OPTIMISM_RPC_URL",
  base: "BASE_RPC_URL",
  polygon: "POLYGON_RPC_URL",
  bsc: "BSC_RPC_URL",
  zksync: "ZKSYNC_RPC_URL",
  scroll: "SCROLL_RPC_URL",
  unichain: "UNICHAIN_RPC_URL",
  monad: "MONAD_RPC_URL",
  avalanche: "AVALANCHE_RPC_URL",
};

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text);
const q = value => JSON.stringify(String(value));

/** Insert `text` just before the `];` that closes the array opened at `anchor`. */
function insertBeforeArrayEnd(source, anchor, text) {
  const start = source.indexOf(anchor);
  if (start < 0) throw new Error(`anchor not found: ${anchor}`);
  const end = source.indexOf("\n];", start);
  if (end < 0) throw new Error(`array end not found after: ${anchor}`);
  return `${source.slice(0, end + 1)}${text}${source.slice(end + 1)}`;
}

function specToEntry(spec) {
  const c = spec.catalog || {};
  const contract = (spec.contracts || [])[0] || {};
  return {
    script: spec.script,
    target: spec.target,
    chain: spec.chain,
    rpcEnv: spec.rpcEnv || RPC_ENV[spec.chain],
    name: c.name || spec.protocol,
    category: c.category || "other",
    url: c.url || "",
    about: c.about || "",
    title: c.title || `${spec.protocol} ${spec.action}`,
    description: c.description || spec.assertion || "",
    section: c.section || "actions",
    action: contract.name ? `\`${spec.action}\` on ${contract.name}` : `\`${spec.action}\``,
    assertion: spec.assertion || "",
  };
}

function addScript(entry) {
  const rel = "package.json";
  let src = read(rel);
  if (src.includes(q(entry.script) + ":")) return false;
  const line = "    " + q(entry.script) + ": " + q(
    `CHAIN=${entry.chain} FORK_TARGET=${entry.target} FORK_PROTOCOL=${entry.target} FORK_ACTION=${entry.script.split(":")[2]} node src/simulation/fork/run.js`
  ) + ",\n";
  const anchor = /^\s*"fork:stakewise:deposit":.*$/m.exec(src);
  if (!anchor) throw new Error("package.json fork anchor missing");
  const at = anchor.index + anchor[0].length + 1;
  write(rel, src.slice(0, at) + line + src.slice(at));
  return true;
}

function addFeature(entry) {
  let src = read("src/catalog/forkFeatures.js");
  if (src.includes(`script: ${q(entry.script)}`)) return false;
  const block = `  {
    script: ${q(entry.script)},
    section: ${q(entry.section)},
    chain: ${q(entry.chain)},
    title: ${q(entry.title)},
    action: ${q(entry.action)},
    assertion: ${q(entry.assertion)},
    group: ${q(entry.target)},
  },
`;
  write("src/catalog/forkFeatures.js", insertBeforeArrayEnd(src, "const FEATURES = [", block));
  return true;
}

function addRecipe(entry) {
  let src = read("src/catalog/forkRecipes.js");
  if (src.includes(`"${entry.script}"`)) return false;
  const block = `  recipe({
    keys: [${q(entry.target)}],
    appUrl: ${q(entry.url)},
    chain: ${q(entry.chain)},
    contractKeys: [${q(entry.target)}],
    tests: [test(${q(entry.script)}, ${q(entry.script.split(":")[2])}, ${q(entry.chain)})],
  }),
`;
  write("src/catalog/forkRecipes.js", insertBeforeArrayEnd(src, "const FORK_RECIPES = [", block));
  return true;
}

function addDescription(entry) {
  let src = read("src/catalog/protocols.js");
  if (src.includes(`${q(entry.script)}:`)) return false;
  const line = `  ${q(entry.script)}: ${q(entry.description)},\n`;
  const anchor = '  "simulate:chains:fees:smoke": "Fails unless every chain on the board has positive 30d fees",';
  if (!src.includes(anchor)) throw new Error("SCRIPT_DESCRIPTIONS anchor missing");
  write("src/catalog/protocols.js", src.replace(anchor, `${line}${anchor}`));
  return true;
}

function addProtocol(entry) {
  let src = read("src/catalog/protocols.js");
  if (src.includes(`    id: ${q(entry.target)},`)) return false;
  const block = `  {
    id: ${q(entry.target)},
    name: ${q(entry.name)},
    category: ${q(entry.category)},
    url: ${q(entry.url)},
    about: ${q(entry.about)},
    data: "On-chain RPC, DefiLlama",
  },
`;
  write("src/catalog/protocols.js", insertBeforeArrayEnd(src, "const PROTOCOLS = [", block));
  return true;
}

function addContract(entry, spec) {
  let src = read("src/catalog/contracts.js");
  const dotted = "book." + entry.target;
  if (src.includes(`book[${q(entry.target)}]`) || src.includes(dotted + " =")) return false;
  const docKey = `${entry.target}Doc`;
  const docUrl = (spec.contracts || [])[0]?.source || entry.url;
  const lines = (spec.contracts || [])
    .map(row => `  push(book[${q(entry.target)}], ${q(entry.chain)}, ${q(row.name)}, ${q(row.address)}, DOCS['${docKey}']);`)
    .join("\n");
  const block = `  book[${q(entry.target)}] = [];\n${lines}\n\n  return book;`;
  src = src.replace("  return book;", block);
  src = src.replace('  fluidLite: "https://lite.guides.instadapp.io/getting-started/vault-receipt-tokens",',
    `  fluidLite: "https://lite.guides.instadapp.io/getting-started/vault-receipt-tokens",\n  "${docKey}": ${q(docUrl)},`);
  write("src/catalog/contracts.js", src);
  return true;
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("usage: node scripts/importForkSpecs.js <spec.json> [...]");
    process.exit(1);
  }
  for (const file of files) {
    const spec = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    if (spec.feasible === false) {
      console.log(`skip (infeasible): ${spec.target} — ${(spec.notes || "").slice(0, 90)}`);
      continue;
    }
    const entry = specToEntry(spec);
    const changed = [
      addScript(entry) && "script",
      addRecipe(entry) && "recipe",
      addFeature(entry) && "feature",
      addDescription(entry) && "description",
      addProtocol(entry) && "protocol",
      addContract(entry, spec) && "contract",
    ].filter(Boolean);
    console.log(`${spec.target}: ${changed.length ? changed.join(", ") : "already imported"}`);
  }
  console.log("\nNext: npm run catalog:docs && npm run coverage:features && node scripts/catalog.js --check");
  console.log("      (then map the fork script in src/catalog/protocolFeatures.js if the check names it)");
}

main();
