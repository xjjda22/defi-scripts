/**
 * Cross-reference DefiLlama rows with catalog protocols and their npm scripts.
 * A row is "covered by a dedicated monitor" when a catalog protocol's script
 * slug, exact name, or explicit alias points at it. Aggregate boards are not
 * dedicated monitors.
 */

const { CATALOG_ALIASES } = require("./categoryMap");

function envValue(command, key) {
  const match = String(command || "").match(new RegExp(`(?:^|\\s)${key}=('[^']*'|\\S+)`));
  return match ? match[1].replace(/^'|'$/g, "") : null;
}

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function buildCoverageIndex(catalog) {
  const bySlug = new Map();
  const byAlias = new Map();
  const byName = new Map();
  const byId = new Map();

  const remember = (map, key, entry) => {
    if (!key || map.has(key)) return;
    map.set(key, entry);
  };

  for (const entry of catalog.protocols) {
    byId.set(entry.id, entry);
    remember(byName, normName(entry.name), entry);
    for (const script of entry.scripts || []) {
      const slug = envValue(script.command, "DEFILLAMA_SLUG") || envValue(script.command, "SMOKE_SLUG");
      if (slug) remember(bySlug, slug.toLowerCase(), entry);
    }
    const aliases = CATALOG_ALIASES[entry.id] || [];
    for (const alias of aliases) remember(byAlias, alias.toLowerCase(), entry);
  }

  return { bySlug, byAlias, byName, byId };
}

function withKind(entry, linkKind) {
  if (!entry) return null;
  return { ...entry, linkKind };
}

function linkCatalog(protocol, index) {
  if (!protocol || !index) return null;
  const slug = String(protocol.slug || "").toLowerCase();
  if (slug && index.bySlug.has(slug)) return withKind(index.bySlug.get(slug), "slug");
  if (slug && index.byAlias.has(slug)) return withKind(index.byAlias.get(slug), "alias");
  const name = normName(protocol.name);
  if (name && index.byName.has(name)) return withKind(index.byName.get(name), "name");
  return null;
}

function scriptNames(entry) {
  if (!entry || !entry.scripts) return [];
  return entry.scripts.map(script => script.name);
}

/**
 * npm script name plus the source file it runs, so the showcase can link to it.
 * @returns {{ name: string, file: string|null }[]}
 */
function scriptLinks(entry) {
  if (!entry || !entry.scripts) return [];
  return entry.scripts.map(script => {
    const match = String(script.command || "").match(/(?:^|\s)node\s+((?:src|scripts)\/\S+\.js)/);
    return { name: script.name, file: match ? match[1] : null };
  });
}

const MONITOR = "covered by a dedicated monitor";
const RANKING_ONLY = "ranking only";

module.exports = {
  buildCoverageIndex,
  linkCatalog,
  scriptNames,
  scriptLinks,
  MONITOR,
  RANKING_ONLY,
};
