#!/usr/bin/env node
/**
 * Per-protocol contract flowcharts + the "missing from the anvil suite" matrix.
 *
 *   npm run flowcharts:docs     # merge output/flowcharts/*.json -> data/contract-flows.json + docs/10
 *   npm run flowcharts:refresh  # re-render docs/10 from the committed data only
 *   npm run flowcharts:check    # validate the committed data + fail when docs/10 is stale
 *
 * The committed source of truth is `data/contract-flows.json`. It carries one flow per entry in
 * `FORK_RECIPES` (src/catalog/forkRecipes.js): the contracts the fork test touches, the calls
 * between them, and a note for every feature the anvil suite does not cover.
 *
 * Nothing here is hand-maintained prose. Names, chains, RPC vars, scripts and contract addresses
 * are read from the catalog; the feature statuses are read from src/catalog/protocolFeatures.js,
 * which is the same source `docs/08-feature-test-gaps.md` is generated from. The authored
 * fragments only add the edges between contracts and the "how to close it" sentence.
 */

const fs = require("fs");
const path = require("path");
const { FORK_RECIPES } = require("../src/catalog/forkRecipes");
const { FEATURES } = require("../src/catalog/forkFeatures");
const { PROTOCOL_FEATURES } = require("../src/catalog/protocolFeatures");
const { PAUSED } = require("../src/catalog/forkStatus");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = "data/contract-flows.json";
const DOC_PATH = "docs/10-contract-flows.md";
const FRAGMENT_DIR = "output/flowcharts";

const NODE_KINDS = ["actor", "contract", "token", "external", "offchain"];
const EDGE_KINDS = ["call", "transfer", "event", "offchain"];
const KIND_LABEL = {
  actor: "actor / impersonated account",
  contract: "protocol contract",
  token: "token or position",
  external: "external contract (oracle, router, bridge peer)",
  offchain: "off this machine (keeper, DVN, L2, solver)",
};
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SHORT = address => `${address.slice(0, 8)}…${address.slice(-4)}`;

const featureByKey = new Map(PROTOCOL_FEATURES.map(entry => [entry.key, entry]));
const featureScripts = new Set();
for (const entry of PROTOCOL_FEATURES) for (const spec of Object.values(entry.features)) for (const s of spec.scripts || []) featureScripts.add(s);

/** Every 0x address that already exists in the repo, so a flow can never invent one. */
function repoAddresses() {
  const seen = new Set();
  const roots = ["src", "output/fork-specs", "test/contracts", "data"];
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "cache") continue;
        walk(full);
      } else if (/\.(js|json|sol|md)$/.test(entry.name)) {
        let text;
        try {
          text = fs.readFileSync(full, "utf8");
        } catch {
          continue;
        }
        for (const match of text.matchAll(/0x[0-9a-fA-F]{40}/g)) seen.add(match[0].toLowerCase());
      }
    }
  };
  for (const rel of roots) walk(path.join(ROOT, rel));
  return seen;
}

const RECIPE_BY_KEY = new Map();
for (const recipe of FORK_RECIPES) {
  for (const key of recipe.keys) if (!RECIPE_BY_KEY.has(key)) RECIPE_BY_KEY.set(key, recipe);
  RECIPE_BY_KEY.set(recipe.keys[0], recipe);
}

/** The protocolFeatures entry for a recipe: exact key, an alias key, or the catalog: form. */
function featureEntry(recipe) {
  for (const key of recipe.keys) if (featureByKey.has(key)) return featureByKey.get(key);
  for (const key of recipe.keys) if (featureByKey.has(`catalog:${key}`)) return featureByKey.get(`catalog:${key}`);
  return null;
}

const featureRows = entry => {
  if (!entry) return [];
  return Object.entries(entry.features).map(([feature, spec]) => {
    let status = spec.kind;
    if (status === "tested") {
      const forks = (spec.scripts || []).filter(s => s.startsWith("fork:"));
      status = forks.length && forks.every(s => PAUSED[s]) ? "failing-paused" : "direct";
    }
    return { feature, status, scripts: spec.scripts || [], note: spec.note || null };
  });
};

const titleOf = script => {
  const found = FEATURES.find(entry => entry.script === script);
  return found ? found.title || found.action || found.script : script;
};

const shortTitle = recipe => {
  const first = recipe.keys[0];
  const entry = featureEntry(recipe);
  if (entry) return entry.name;
  return first.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

/** Rank from the committed board, when the row is on it. */
function rankMap() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, "showcase", "data.json"), "utf8"));
    return new Map((data.overall || []).map((row, index) => [row.id, row.rank || index + 1]));
  } catch {
    return new Map();
  }
}

// --- fragment validation ----------------------------------------------------

function validateFragment(fragment, recipe, addresses) {
  const problems = [];
  const warnings = [];
  const key = recipe.keys[0];
  if (!fragment || typeof fragment !== "object") return { problems: [`${key}: fragment is not an object`], warnings };

  if (fragment.key !== key) problems.push(`${key}: fragment.key is "${fragment.key}", expected "${key}"`);
  if (typeof fragment.summary !== "string" || fragment.summary.trim().length < 20) problems.push(`${key}: summary must be a sentence`);
  else if (fragment.summary.length > 420) problems.push(`${key}: summary is too long (${fragment.summary.length} > 420)`);
  if (fragment.direction && !["LR", "TD"].includes(fragment.direction)) problems.push(`${key}: direction must be LR or TD`);

  const nodes = Array.isArray(fragment.nodes) ? fragment.nodes : [];
  if (nodes.length < 2) problems.push(`${key}: needs at least 2 nodes`);
  if (nodes.length > 16) problems.push(`${key}: ${nodes.length} nodes is more than a readable flowchart (max 16)`);
  const ids = new Set();
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      problems.push(`${key}: a node is not an object`);
      continue;
    }
    if (!/^[a-z0-9_-]{1,32}$/.test(String(node.id || ""))) problems.push(`${key}: bad node id "${node.id}"`);
    else if (ids.has(node.id)) problems.push(`${key}: duplicate node id "${node.id}"`);
    ids.add(node.id);
    if (typeof node.label !== "string" || !node.label.trim()) problems.push(`${key}: node "${node.id}" has no label`);
    else if (node.label.length > 90) problems.push(`${key}: node "${node.id}" label is too long (${node.label.length} > 90)`);
    if (!NODE_KINDS.includes(node.kind)) problems.push(`${key}: node "${node.id}" kind "${node.kind}" is not one of ${NODE_KINDS.join(", ")}`);
    if (node.address != null) {
      if (!ADDRESS.test(String(node.address))) problems.push(`${key}: node "${node.id}" address is not 40-hex`);
      else if (!addresses.has(String(node.address).toLowerCase())) problems.push(`${key}: node "${node.id}" address ${node.address} does not appear anywhere in the repo`);
    }
  }
  if (nodes.length && !nodes.some(node => node.kind === "actor")) problems.push(`${key}: no actor node (the impersonated account that sends the tx)`);

  const edges = Array.isArray(fragment.edges) ? fragment.edges : [];
  if (!edges.length) problems.push(`${key}: needs at least one edge`);
  if (edges.length > 40) problems.push(`${key}: ${edges.length} edges is more than a readable flowchart (max 40)`);
  for (const edge of edges) {
    if (!edge || typeof edge !== "object") {
      problems.push(`${key}: an edge is not an object`);
      continue;
    }
    if (!ids.has(edge.from)) problems.push(`${key}: edge from unknown node "${edge.from}"`);
    if (!ids.has(edge.to)) problems.push(`${key}: edge to unknown node "${edge.to}"`);
    if (edge.from === edge.to) problems.push(`${key}: self edge on "${edge.from}"`);
    if (!EDGE_KINDS.includes(edge.kind)) problems.push(`${key}: edge ${edge.from}->${edge.to} kind "${edge.kind}" is not one of ${EDGE_KINDS.join(", ")}`);
    if (typeof edge.label !== "string" || !edge.label.trim()) problems.push(`${key}: edge ${edge.from}->${edge.to} has no label`);
    else if (edge.label.length > 70) problems.push(`${key}: edge ${edge.from}->${edge.to} label is too long (${edge.label.length} > 70)`);
  }

  const entry = featureEntry(recipe);
  const names = new Map(featureRows(entry).map(row => [row.feature.toLowerCase(), row.feature]));
  const gaps = fragment.gaps && typeof fragment.gaps === "object" ? fragment.gaps : {};
  for (const [feature, spec] of Object.entries(gaps)) {
    if (!entry) {
      warnings.push(`${key}: gap "${feature}" dropped, the protocol has no src/catalog/protocolFeatures.js entry`);
      continue;
    }
    if (!names.has(feature.toLowerCase())) {
      warnings.push(`${key}: gap "${feature}" dropped, no such feature (valid: ${[...names.values()].slice(0, 6).join(" / ")}…)`);
      continue;
    }
    if (!spec || typeof spec !== "object") problems.push(`${key}: gap "${feature}" is not an object`);
    else if (typeof spec.how !== "string" || spec.how.trim().length < 8) problems.push(`${key}: gap "${feature}" needs a how-to-test sentence`);
    if (spec && spec.blocker != null && typeof spec.blocker !== "string") problems.push(`${key}: gap "${feature}" blocker must be a string or null`);
  }

  if (fragment.notes != null) {
    if (!Array.isArray(fragment.notes)) problems.push(`${key}: notes must be an array`);
    else if (fragment.notes.length > 6) problems.push(`${key}: ${fragment.notes.length} notes (max 6)`);
    else for (const note of fragment.notes) if (typeof note !== "string" || note.length > 320) problems.push(`${key}: note too long or not a string`);
  }

  return { problems, warnings };
}

// --- assembly ---------------------------------------------------------------

/** A readable card title: actors lose their funding clause, contracts lose their parenthetical. */
function shortLabel(node) {
  const text = String(node.label || "").trim();
  if (node.kind === "actor") {
    // "fresh impersonated account funded with 100 USDC" -> "fresh impersonated account"
    return text.split(",")[0].split(/\s+funded\b/i)[0].split(/\s+holding\b/i)[0].trim();
  }
  // Drop the trailing parenthetical as a whole: labels like "USDS, the bridge collateral
  // (erc20token())" contain a nested pair, so a global non-greedy strip would leave a stray ")".
  const stripped = text.replace(/\s*\(.*\)\s*$/, "").replace(/\s{2,}/g, " ").trim();
  return stripped.length > 46 ? `${stripped.slice(0, 45).trimEnd()}…` : stripped;
}

/**
 * Collapse parallel edges between the same pair into one arrow that carries the step numbers.
 * A 22-call test has 11 distinct pairs on Aave; drawing 22 arrows is a hairball, and drawing 11
 * with "1–20" on the busy one keeps the graph readable while the call log keeps the order.
 */
function graphEdges(edges) {
  const map = new Map();
  edges.forEach((edge, index) => {
    const key = `${edge.from}->${edge.to}:${edge.kind}`;
    if (!map.has(key)) map.set(key, { from: edge.from, to: edge.to, kind: edge.kind, steps: [], labels: [] });
    const entry = map.get(key);
    entry.steps.push(index + 1);
    if (!entry.labels.includes(edge.label)) entry.labels.push(edge.label);
  });
  return [...map.values()].map(entry => {
    const first = entry.steps[0];
    const last = entry.steps[entry.steps.length - 1];
    const extra = entry.labels.length - 1;
    const detail = extra > 0 ? `${entry.labels[0]} (+${extra} more)` : entry.labels[0];
    return { ...entry, label: detail, range: first === last ? `${first}` : `${first}–${last}` };
  });
}

function buildRow(fragment, recipe, ranks) {
  const entry = featureEntry(recipe);
  const features = featureRows(entry);
  const tested = features.filter(f => f.status === "direct" || f.status === "linked");
  const gaps = features.filter(f => f.status === "gap" || f.status === "not-testable" || f.status === "failing-paused");
  const annotated = new Map(Object.entries(fragment.gaps || {}).map(([name, spec]) => [name.toLowerCase(), spec]));
  return {
    key: recipe.keys[0],
    name: shortTitle(recipe),
    rank: (entry && ranks.get(entry.key)) || null,
    chain: recipe.chain,
    rpcEnv: recipe.rpcEnv,
    appUrl: recipe.appUrl || null,
    label: recipe.label || null,
    recipeNote: recipe.note || null,
    direction: fragment.direction || "LR",
    summary: fragment.summary.trim(),
    scripts: recipe.tests.map(t => ({
      script: t.script,
      action: t.action,
      feature: titleOf(t.script),
      chain: t.chain || recipe.chain,
      rpcEnv: t.rpcEnv || recipe.rpcEnv,
    })),
    nodes: fragment.nodes.map(node => ({
      id: node.id,
      label: node.label.trim(),
      short: shortLabel(node),
      kind: node.kind,
      address: node.address || null,
    })),
    edges: fragment.edges.map(edge => ({ from: edge.from, to: edge.to, label: edge.label.trim(), kind: edge.kind })),
    graph: { edges: graphEdges(fragment.edges) },
    notes: fragment.notes || [],
    features: { total: features.length, tested: tested.length, gap: features.filter(f => f.status === "gap").length, notTestable: features.filter(f => f.status === "not-testable").length, failingPaused: features.filter(f => f.status === "failing-paused").length },
    missing: entry
      ? gaps.map(row => {
          const how = annotated.get(row.feature.toLowerCase()) || null;
          return { feature: row.feature, status: row.status, how: how ? how.how.trim() : null, blocker: how && how.blocker ? how.blocker.trim() : null, note: row.note };
        })
      : [],
    matrixKey: entry ? entry.key : null,
  };
}

function merge() {
  const addresses = repoAddresses();
  const ranks = rankMap();
  const problems = [];
  const warnings = [];
  const flows = [];
  const fragments = new Map();
  const dir = path.join(ROOT, FRAGMENT_DIR);
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith(".json"))) {
      try {
        const fragment = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        if (!fragment.key) fragment.key = file.replace(/\.json$/, "");
        fragments.set(fragment.key, fragment);
      } catch (error) {
        problems.push(`${FRAGMENT_DIR}/${file}: ${error.message}`);
      }
    }
  }
  for (const recipe of FORK_RECIPES) {
    const key = recipe.keys[0];
    const fragment = fragments.get(key);
    if (!fragment) {
      problems.push(`${key}: no ${FRAGMENT_DIR}/${key}.json fragment`);
      continue;
    }
    const result = validateFragment(fragment, recipe, addresses);
    problems.push(...result.problems);
    warnings.push(...result.warnings);
    flows.push(buildRow(fragment, recipe, ranks));
  }
  flows.sort((a, b) => (a.rank || 9999) - (b.rank || 9999) || a.name.localeCompare(b.name));
  // Gaps that live on rows without a fork recipe: they are not in any flowchart, but dropping
  // them would make the doc look complete when docs/08 still counts them.
  const matrixKeys = new Set(flows.map(flow => flow.matrixKey).filter(Boolean));
  const featureGaps = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "feature-gaps.json"), "utf8"));
    } catch {
      return null;
    }
  })();
  const outsideGaps = featureGaps
    ? (featureGaps.gaps || []).filter(gap => !matrixKeys.has(gap.key))
    : [];
  const sum = field => flows.reduce((n, flow) => n + flow.features[field], 0);
  const totals = {
    recipes: flows.length,
    withMatrix: flows.filter(flow => flow.matrixKey).length,
    features: sum("total"),
    tested: sum("tested"),
    gap: sum("gap"),
    notTestable: sum("notTestable"),
    failingPaused: sum("failingPaused"),
    // One test can cover two rows (fork:euler:deposit is listed under euler and k3-capital), and
    // suitePlans de-duplicates it, so count scripts the same way the suite does.
    scripts: new Set(flows.flatMap(flow => flow.scripts.map(item => item.script))).size,
    chains: [...new Set(flows.map(flow => flow.chain))].sort(),
  };
  return {
    data: {
      generatedAt: new Date().toISOString(),
      totals: { ...totals, gapOutsideRecipes: outsideGaps.length, gapAllRows: featureGaps ? featureGaps.totals.gap : null },
      outsideGaps,
      flows,
    },
    problems,
    warnings,
  };
}

// --- rendering --------------------------------------------------------------

const esc = text => String(text == null ? "" : text).replace(/"/g, "'").replace(/\|/g, "·").replace(/\n/g, " ").trim();
// Labels are quoted, so parentheses and brackets are safe. Only strip the characters that
// Mermaid still reads as syntax inside a quoted string: HTML angle brackets and backticks.
const MERMAID_STRIP = new Set(["<", ">", "`"]);
const mermaidLabel = text => [...esc(text)].filter(char => !MERMAID_STRIP.has(char)).join("");

/** Break a label into short lines so a Mermaid box cannot overflow its own border. */
function wrapLabel(text, max = 26, maxLines = 4) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1)}…`;
    return kept;
  }
  return lines;
}

function mermaid(flow) {
  // Compact spacing + smaller labels: dagre's defaults make a 16-node graph 1,800px wide and the
  // edge labels wider than the nodes.
  const lines = [
    '%%{init: {"flowchart": {"curve": "basis", "nodeSpacing": 34, "rankSpacing": 52}, "themeVariables": {"fontSize": "11px"}}}%%',
    `flowchart ${flow.direction}`,
  ];
  for (const node of flow.nodes) {
    const title = node.short || node.label;
    const body = wrapLabel(title).map(mermaidLabel).join("<br/>");
    const label = node.address ? `${body}<br/>${SHORT(node.address)}` : body;
    lines.push(`  ${node.id}["${label}"]`);
  }
  for (const edge of flow.graph.edges) {
    const arrow = edge.kind === "call" ? "-->" : edge.kind === "transfer" ? "==>" : "-.->";
    const label = `${edge.range} · ${edge.label}`;
    const clipped = label.length > 44 ? `${label.slice(0, 43).trimEnd()}…` : label;
    lines.push(`  ${edge.from} ${arrow}|"${mermaidLabel(clipped)}"| ${edge.to}`);
  }
  lines.push("  classDef actor fill:#14160f,stroke:#14160f,color:#f7f8ef");
  lines.push("  classDef contract fill:#eef2d9,stroke:#14160f,color:#14160f");
  lines.push("  classDef token fill:#ffffff,stroke:#8a8f7a,color:#14160f");
  lines.push("  classDef external fill:#f4f4ee,stroke:#b9beac,color:#14160f");
  lines.push("  classDef offchain fill:#fff1e6,stroke:#c9743a,color:#14160f,stroke-dasharray:4 2");
  for (const kind of NODE_KINDS) {
    const ids = flow.nodes.filter(node => node.kind === kind).map(node => node.id);
    if (ids.length) lines.push(`  class ${ids.join(",")} ${kind}`);
  }
  return lines.join("\n");
}

const cell = text => esc(text || "");
const STATUS_LABEL = { gap: "**gap**", "not-testable": "not-testable", "failing-paused": "failing-paused" };

function readinessRows(flows) {
  return flows.map(flow => {
    const matrix = flow.matrixKey ? `${flow.features.tested}/${flow.features.total}` : "—";
    const gaps = flow.matrixKey ? flow.features.gap + flow.features.failingPaused : "—";
    const untestable = flow.matrixKey ? flow.features.notTestable : "—";
    return `| ${flow.rank ? `#${flow.rank}` : "—"} | [${cell(flow.name)}](#${anchor(flow.key)}) | ${flow.chain} | ${flow.scripts.length} | ${matrix} | ${gaps} | ${untestable} |`;
  });
}

const anchor = key => `flow-${String(key).replace(/[^a-z0-9-]/g, "")}`;

function renderDoc(data) {
  const { totals, flows } = data;
  const out = [];
  out.push("# Contract flows and anvil readiness");
  out.push("");
  out.push("Generated by `npm run flowcharts:docs` from `data/contract-flows.json` plus the catalog. Do not edit by hand; `npm run flowcharts:check` fails when it is stale.");
  out.push("");
  out.push(
    "One flowchart per entry in `FORK_RECIPES`: the contracts a local Anvil fork actually touches, the calls between them, and the features the suite does **not** cover yet. " +
      "Every address below already appears in this repo (`src/` or `output/fork-specs/`), so a diagram cannot point at an address nobody verified. `npm run flowcharts:check` re-checks that on every run."
  );
  out.push("");
  out.push("## Run one locally");
  out.push("");
  out.push("```bash");
  out.push("# terminal 1 — fork the chain the protocol lives on");
  out.push("CHAIN=ethereum node scripts/startFork.js");
  out.push("");
  out.push("# terminal 2 — point that chain's RPC at the fork and run one action");
  out.push("ETHEREUM_RPC_URL=http://127.0.0.1:8545 npm run fork:aave:supply");
  out.push("```");
  out.push("");
  out.push("`npm run fork:all` does that for every recipe (one Anvil per chain, `evm_snapshot` isolation per test). A chain with no RPC var is skipped, and `SKIP` is not a pass. Setup, fallbacks and the test contract are in [`04-fork-testing.md`](./04-fork-testing.md).");
  out.push("");
  out.push("## Readiness");
  out.push("");
  out.push(
    `| | |\n| --- | ---: |\n| Fork recipes with a flowchart | ${totals.recipes} |\n| Fork tests behind them | ${totals.scripts} |\n` +
      `| Recipes with a feature matrix | ${totals.withMatrix} |\n| Features measured | ${totals.features} |\n| Tested on a fork or linked to a test | ${totals.tested} |\n` +
      `| Gap (permissionless, no test) | ${totals.gap} |\n| Failing because the protocol is paused | ${totals.failingPaused} |\n| Not testable on an EVM fork | ${totals.notTestable} |\n` +
      `| Chains | ${totals.chains.join(", ")} |` +
      (data.outsideGaps && data.outsideGaps.length
        ? `\n| Gap on rows with no fork recipe (see the last section) | ${data.outsideGaps.length} |`
        : ``)
  );
  out.push("");
  out.push("A **gap** is a public, permissionless feature with no fork test — the work queue. **Not testable** has a written reason (KYC, off-chain keeper, another chain). A recipe with `—` under *features* has no `src/catalog/protocolFeatures.js` entry, so its feature coverage is unmeasured; that is a gap in the matrix, not a pass.");
  out.push("");
  out.push("| Rank | Protocol | Chain | Tests | Features tested | Gap | Not testable |");
  out.push("| --- | --- | --- | ---: | --- | ---: | ---: |");
  out.push(...readinessRows(flows));
  out.push("");
  out.push("## How to read a diagram");
  out.push("");
  out.push(
    "Each arrow is one distinct call path between two contracts. Parallel calls between the same pair are collapsed into one arrow, " +
      "and its label starts with the step range: `5 · approve(Pool, 1 WETH)` is step 5, `2–10 · …` is the run of steps 2 to 10. " +
      "The full ordered list is the **Call log** in the showcase panel (`?view=flow` on a protocol page), which also plays the sequence arrow by arrow."
  );
  out.push("");
  for (const kind of NODE_KINDS) out.push(`- **${kind}** — ${KIND_LABEL[kind]}`);
  out.push("");
  out.push("Arrows: `-->` call, `==>` token movement, `-.->` event or a step that is off this machine. A cycle (supply → withdraw) is drawn as an arrow that points back at its source.");
  out.push("");
  out.push("## Per protocol");
  out.push("");
  for (const flow of flows) {
    out.push(`<a id="${anchor(flow.key)}"></a>`);
    out.push("");
    out.push(`### ${flow.rank ? `#${flow.rank} ` : ""}${flow.name}`);
    out.push("");
    const meta = [`Chain: **${flow.chain}**`, `${flow.scripts.length} fork test${flow.scripts.length === 1 ? "" : "s"}`, `\`${flow.rpcEnv}\``];
    if (flow.matrixKey) meta.push(`${flow.features.tested}/${flow.features.total} features tested`);
    else meta.push("no feature matrix");
    out.push(meta.join(" · "));
    out.push("");
    out.push("```mermaid");
    out.push(mermaid(flow));
    out.push("```");
    out.push("");
    out.push(`**What this fork proves.** ${esc(flow.summary)}`);
    out.push("");
    out.push("Run it:");
    out.push("");
    out.push("```bash");
    // A recipe can test on more than one chain (PancakeSwap V3 on Ethereum and BSC), so each
    // command carries the env var of the chain that test forks, not the recipe's first chain.
    const chains = [...new Set(flow.scripts.map(item => item.chain))];
    for (const chain of chains) out.push(`CHAIN=${chain} node scripts/startFork.js`);
    for (const item of flow.scripts) out.push(`${item.rpcEnv}=http://127.0.0.1:8545 npm run ${item.script}`);
    out.push("```");
    out.push("");
    const addressed = flow.nodes.filter(node => node.address);
    if (addressed.length) {
      out.push("| Contract | Address | Chain | Role in the flow |");
      out.push("| --- | --- | --- | --- |");
      for (const node of addressed) out.push(`| ${cell(node.label)} | \`${node.address}\` | ${flow.chain} | ${node.kind} |`);
      out.push("");
    }
    if (flow.recipeNote) {
      out.push(`> ${esc(flow.recipeNote)}`);
      out.push("");
    }
    if (flow.notes.length) {
      out.push("Notes:");
      out.push("");
      for (const note of flow.notes) out.push(`- ${esc(note)}`);
      out.push("");
    }
    if (flow.missing.length) {
      out.push("**Missing from the anvil suite.**");
      out.push("");
      out.push("| Feature | Status | How to close it on a fork | Blocker |");
      out.push("| --- | --- | --- | --- |");
      for (const row of flow.missing) {
        out.push(`| ${cell(row.feature)} | ${STATUS_LABEL[row.status] || row.status} | ${cell(row.how || row.note || "—")} | ${cell(row.blocker || "")} |`);
      }
      out.push("");
    } else if (flow.matrixKey) {
      out.push("**Missing from the anvil suite.** None: every feature in the matrix has a fork test.");
      out.push("");
    } else {
      out.push("**Missing from the anvil suite.** Unmeasured: this protocol has no `src/catalog/protocolFeatures.js` entry, so there is no feature list to be missing from.");
      out.push("");
    }
  }
  if (data.outsideGaps && data.outsideGaps.length) {
    out.push("## Gaps on rows without a fork recipe");
    out.push("");
    out.push(
      "`docs/08-feature-test-gaps.md` counts every protocol in the feature matrix, including rows with no `FORK_RECIPES` entry. " +
        "Their gaps cannot appear in a flowchart because there is no fork test to draw; they are listed here so the two docs agree."
    );
    out.push("");
    out.push("| Rank | Protocol | Feature | How to test |");
    out.push("| --- | --- | --- | --- |");
    for (const gap of data.outsideGaps) out.push(`| ${gap.rank ? `#${gap.rank}` : "—"} | ${cell(gap.protocol)} | ${cell(gap.feature)} | ${cell(gap.note || "")} |`);
    out.push("");
  }
  const noMatrix = flows.filter(flow => !flow.matrixKey);
  if (noMatrix.length) {
    out.push("## Recipes with no feature matrix");
    out.push("");
    out.push("These have fork tests but no entry in `src/catalog/protocolFeatures.js`, so `docs/08-feature-test-gaps.md` cannot count their features. Adding the entry is the first step to closing their gaps.");
    out.push("");
    for (const flow of noMatrix) out.push(`- **${flow.name}** (\`${flow.key}\`, ${flow.scripts.length} test${flow.scripts.length === 1 ? "" : "s"})`);
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// --- entry points -----------------------------------------------------------

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

function writeDocs(data) {
  fs.writeFileSync(path.join(ROOT, DATA_PATH), JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync(path.join(ROOT, DOC_PATH), renderDoc(data));
  const { totals } = data;
  console.log(`Wrote ${DATA_PATH} and ${DOC_PATH}: ${totals.recipes} flows, ${totals.scripts} tests, ${totals.gap} gaps.`);
}

/** Re-validate the committed data without needing output/flowcharts (CI path). */
function checkCommitted() {
  const data = readJson(DATA_PATH);
  if (!data || !Array.isArray(data.flows)) return { problems: [`${DATA_PATH} is missing or has no flows`], data: null };
  const problems = [];
  const addresses = repoAddresses();
  const byKey = new Map(data.flows.map(flow => [flow.key, flow]));
  for (const recipe of FORK_RECIPES) {
    const key = recipe.keys[0];
    const flow = byKey.get(key);
    if (!flow) {
      problems.push(`${key}: no flow in ${DATA_PATH}`);
      continue;
    }
    if (flow.chain !== recipe.chain) problems.push(`${key}: chain ${flow.chain} != recipe ${recipe.chain}`);
    if (flow.scripts.length !== recipe.tests.length) problems.push(`${key}: ${flow.scripts.length} scripts != ${recipe.tests.length} recipe tests`);
    const ids = new Set(flow.nodes.map(node => node.id));
    for (const node of flow.nodes) {
      if (node.address && !addresses.has(String(node.address).toLowerCase())) problems.push(`${key}: address ${node.address} is not in the repo`);
      if (!NODE_KINDS.includes(node.kind)) problems.push(`${key}: node ${node.id} has kind ${node.kind}`);
    }
    for (const edge of flow.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) problems.push(`${key}: edge ${edge.from}->${edge.to} points at a missing node`);
    }
    if (!flow.nodes.some(node => node.kind === "actor")) problems.push(`${key}: no actor node`);
  }
  for (const key of byKey.keys()) if (!RECIPE_BY_KEY.has(key)) problems.push(`${key}: flow has no recipe in FORK_RECIPES`);
  const doc = fs.readFileSync(path.join(ROOT, DOC_PATH), "utf8");
  if (doc !== renderDoc(data)) problems.push(`${DOC_PATH} is stale (run npm run flowcharts:docs)`);
  return { problems, data };
}

function loadFragment(key) {
  const file = path.join(ROOT, FRAGMENT_DIR, `${key}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Validate one authored fragment: the loop an authoring agent iterates on. */
function verifyOne(key) {
  const recipe = RECIPE_BY_KEY.get(key);
  if (!recipe) return { problems: [`${key}: no recipe with that key in FORK_RECIPES`], warnings: [] };
  const fragment = loadFragment(key);
  if (!fragment) return { problems: [`${key}: ${FRAGMENT_DIR}/${key}.json is missing`], warnings: [] };
  return validateFragment(fragment, recipe, repoAddresses());
}

function main() {
  const verifyIndex = process.argv.indexOf("--verify");
  if (verifyIndex !== -1) {
    const key = process.argv[verifyIndex + 1];
    const { problems, warnings } = verifyOne(key);
    for (const warning of warnings) console.warn(`warning: ${warning}`);
    if (problems.length) {
      console.error(`${key}: ${problems.length} problem(s)`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    console.log(`${key}: OK`);
    return;
  }
  if (process.argv.includes("--verify-all")) {
    let bad = 0;
    let checked = 0;
    for (const recipe of FORK_RECIPES) {
      const key = recipe.keys[0];
      const { problems } = verifyOne(key);
      checked += 1;
      if (problems.length) {
        bad += 1;
        console.error(`${key}: ${problems.length} problem(s)`);
        for (const problem of problems) console.error(`  - ${problem}`);
      }
    }
    console.log(`${checked - bad}/${checked} fragments valid`);
    if (bad) process.exit(1);
    return;
  }
  if (process.argv.includes("--check")) {
    const { problems, data } = checkCommitted();
    if (problems.length) {
      console.error(`Contract flow check failed (${problems.length}):`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    console.log(`Contract flows OK: ${data.totals.recipes} flows, ${data.totals.scripts} scripts, ${data.totals.gap} gaps.`);
    return;
  }
  if (process.argv.includes("--refresh")) {
    const data = readJson(DATA_PATH);
    if (!data) throw new Error(`${DATA_PATH} does not exist; run npm run flowcharts:docs first`);
    writeDocs(data);
    return;
  }
  const { data, problems, warnings } = merge();
  if (warnings.length) {
    console.warn(`${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`  - ${warning}`);
  }
  if (problems.length) {
    console.error(`Contract flow build failed (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  writeDocs(data);
}

if (require.main === module) main();
module.exports = { merge, renderDoc, checkCommitted, repoAddresses };
