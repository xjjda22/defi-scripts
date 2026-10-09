const pkg = require("../../package.json");
const { CATEGORIES, BOARD_GROUPS, PROTOCOLS, BOARDS, SCRIPT_DESCRIPTIONS } = require("./protocols");

const KINDS = ["Analytics", "Smoke", "Simulate", "Swap", "Cross-chain", "Fork"];
const FAMILIES = new Set(["analytics", "simulate", "swap", "crosschain", "fork"]);

function envValue(command, key) {
  const m = command.match(new RegExp(`(?:^|\\s)${key}=('[^']*'|\\S+)`));
  return m ? m[1].replace(/^'|'$/g, "") : null;
}

function classify(name, command) {
  const parts = name.split(":");
  if (parts[0] === "test" && parts[1] === "pairs") return { id: "pairs", kind: "Simulate" };
  if (name === "fork:all" || name === "simulate:fork:suite") return { id: "validate", kind: "Fork" };
  if (parts[0] === "fork") return { id: parts[1], kind: "Fork" };
  if (!FAMILIES.has(parts[0])) return null;
  const id = parts[0] === "simulate" && parts[1] === "dex" ? parts[2] : parts[1];
  if (parts[0] === "analytics") return { id, kind: "Analytics" };
  if (parts[0] === "swap") return { id, kind: "Swap" };
  if (parts[0] === "crosschain") return { id, kind: "Cross-chain" };
  const smoke = name.endsWith(":smoke") || /\b(ERC20|MORPHO_VAULT)_SMOKE=1\b/.test(command);
  return { id, kind: smoke ? "Smoke" : "Simulate" };
}

function describeLlamaMonitor(command) {
  const slug = envValue(command, "DEFILLAMA_SLUG");
  if (!slug) return null;
  const fees = envValue(command, "DEFILLAMA_FEES") === "1" ? " + fees/revenue (24h/7d/30d)" : "";
  const oi = envValue(command, "DEFILLAMA_OI") === "1" ? " + open interest (total24h)" : "";
  return `DefiLlama TVL + TVL by chain${fees}${oi} (\`${slug}\`)`;
}

function describeLlamaSmoke(command) {
  const slug = envValue(command, "SMOKE_SLUG");
  if (!slug) return null;
  const checks = ["TVL"];
  if (envValue(command, "SMOKE_FEES") === "1") checks.push("positive 24h revenue");
  const extras = [];
  if (envValue(command, "SMOKE_MIN_TVL_USD") === "0") extras.push("$0 TVL allowed");
  if (envValue(command, "SMOKE_ALLOW_NOT_LISTED") === "1") extras.push("404 tolerated");
  const tail = extras.length ? `; ${extras.join(", ")}` : "";
  return `Fails unless DefiLlama \`${slug}\` returns ${checks.join(" and ")}${tail}`;
}

function describeDexVariant(command) {
  const variant = envValue(command, "DEX_VARIANT");
  if (!variant) return null;
  const chain = envValue(command, "CHAIN");
  const proxy = envValue(command, "DEFI_SLIPSTREAM_PROXY") === "1" ? " (Slipstream reference)" : "";
  return `Quote-only \`${variant}\` pool simulation${chain ? ` on ${chain}` : ""}${proxy}`;
}

function describeSmokeFromSibling(script, scripts) {
  if (script.kind !== "Smoke") return null;
  const analytics = scripts.filter(s => s.id === script.id && s.kind === "Analytics");
  const twin = `analytics:${script.name.replace(/^simulate:/, "").replace(/:smoke$/, "")}`;
  const target = analytics.find(s => s.name === twin) || (analytics.length === 1 ? analytics[0] : null);
  return target ? `Smoke for \`${target.name}\`` : null;
}

function loadScripts(scriptMap = pkg.scripts) {
  const scripts = [];
  for (const [name, command] of Object.entries(scriptMap)) {
    const c = classify(name, command);
    if (c) scripts.push({ name, command, ...c });
  }
  for (const s of scripts) {
    s.description =
      SCRIPT_DESCRIPTIONS[s.name] ||
      describeLlamaMonitor(s.command) ||
      describeLlamaSmoke(s.command) ||
      describeDexVariant(s.command) ||
      describeSmokeFromSibling(s, scripts) ||
      null;
  }
  return scripts;
}

function sortScripts(list) {
  return [...list].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
}

function deriveData(entry, scripts) {
  if (entry.data) return entry.data;
  return scripts.some(s => /DEFILLAMA_SLUG|SMOKE_SLUG/.test(s.command)) ? "DefiLlama" : "—";
}

/**
 * Joins the registry with package.json scripts.
 * @returns {{ protocols: object[], boards: object[], categories: object[], boardGroups: object[], problems: string[] }}
 */
function buildCatalog(scriptMap) {
  const scripts = loadScripts(scriptMap);
  const byId = new Map();
  for (const s of scripts) {
    if (!byId.has(s.id)) byId.set(s.id, []);
    byId.get(s.id).push(s);
  }

  const problems = [];
  const known = new Set();
  const attach = entry => {
    if (known.has(entry.id)) problems.push(`duplicate registry id "${entry.id}"`);
    known.add(entry.id);
    const own = sortScripts(byId.get(entry.id) || []);
    if (!own.length) problems.push(`registry id "${entry.id}" has no npm scripts`);
    const kinds = Object.fromEntries(KINDS.map(k => [k, own.filter(s => s.kind === k).length]));
    return { ...entry, scripts: own, kinds, data: deriveData(entry, own) };
  };

  const categoryIds = new Set(CATEGORIES.map(c => c.id));
  const groupIds = new Set(BOARD_GROUPS.map(g => g.id));
  for (const p of PROTOCOLS)
    if (!categoryIds.has(p.category)) problems.push(`"${p.id}" has unknown category "${p.category}"`);
  for (const b of BOARDS) if (!groupIds.has(b.group)) problems.push(`"${b.id}" has unknown group "${b.group}"`);

  const protocols = PROTOCOLS.map(attach);
  const boards = BOARDS.map(attach);

  for (const [id, list] of byId) {
    if (!known.has(id)) problems.push(`no registry entry for id "${id}" (${list.map(s => s.name).join(", ")})`);
  }
  for (const s of scripts) {
    if (!s.description) problems.push(`no description for "${s.name}" (add it to SCRIPT_DESCRIPTIONS)`);
  }

  return { protocols, boards, categories: CATEGORIES, boardGroups: BOARD_GROUPS, problems };
}

/** Case-insensitive lookup by id, name, or category/group id. */
function findEntries(catalog, query) {
  const q = query.toLowerCase();
  const all = [...catalog.protocols, ...catalog.boards];
  const exact = all.filter(e => e.id === q || e.name.toLowerCase() === q);
  if (exact.length) return { kind: "entry", entries: exact };
  const inGroup = all.filter(e => e.category === q || e.group === q);
  if (inGroup.length) return { kind: "group", entries: inGroup };
  return { kind: "search", entries: all.filter(e => e.id.includes(q) || e.name.toLowerCase().includes(q)) };
}

module.exports = { KINDS, buildCatalog, findEntries, loadScripts };
