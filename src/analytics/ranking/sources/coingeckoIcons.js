/**
 * CoinGecko icons for showcase rows.
 *
 * Image-only. Never expands token-map.json and never feeds into attention scoring.
 * Resolution order for a row's CoinGecko id:
 *   1. token.coingeckoId (already mapped for the attention signal)
 *   2. DefiLlama gecko_id on the row's members / parent
 *   3. Conservative match against /coins/list (exact id↔slug/alias, or unique exact name)
 *
 * Images come from /coins/markets (already fetched for mapped tokens, plus a
 * follow-up batch for any extra ids). Unmatched rows stay null; the UI draws a
 * monogram placeholder.
 */

const fs = require("fs");
const path = require("path");

const { cgGet } = require("../../../utils/coingeckoClient");
const { CATALOG_ALIASES } = require("../categoryMap");

const ROOT = path.resolve(__dirname, "../../../..");
const CACHE_DIR = process.env.SIGNALS_CACHE_DIR || path.join(ROOT, "data", "cache");
const LIST_CACHE = path.join(CACHE_DIR, "coingecko-coins-list.json");
const IMAGE_CACHE = path.join(CACHE_DIR, "coingecko-images.json");
const TTL_MS = Number(process.env.COINGECKO_CACHE_TTL_MS) || 6 * 3600 * 1000;
const MAX_IDS_PER_CALL = 200;

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Prefer the small/thumb CDN path when CoinGecko hands us a large asset. */
function preferThumb(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/\/large\//, "/small/");
}

function isCoingeckoImage(url) {
  if (!url || typeof url !== "string") return false;
  return /coingecko\.com\/coins\/images\//i.test(url) || /coin-images\.coingecko\.com\//i.test(url);
}

function aliasCandidates(row) {
  const out = new Set();
  const add = value => {
    const key = norm(value);
    if (key) out.add(key);
  };
  add(row.id);
  add(row.slug);
  add(row.name);
  if (CATALOG_ALIASES[row.id]) CATALOG_ALIASES[row.id].forEach(add);
  if (CATALOG_ALIASES[row.slug]) CATALOG_ALIASES[row.slug].forEach(add);
  // Reverse: if this row id/slug is listed as an alias of a family, include the family key.
  for (const [family, aliases] of Object.entries(CATALOG_ALIASES)) {
    if (aliases.includes(row.id) || aliases.includes(row.slug)) add(family);
  }
  for (const member of row.members || []) {
    add(member.slug);
    add(member.name);
  }
  return [...out];
}

/**
 * Pure match step: pick a CoinGecko id for a row without touching the network.
 * @returns {{ coingeckoId: string, via: string } | null}
 */
function matchCoingeckoId(row, listIndex) {
  if (row.token && row.token.coingeckoId) {
    return { coingeckoId: row.token.coingeckoId, via: "token-map" };
  }
  for (const id of row.llamaGeckoIds || []) {
    if (id) return { coingeckoId: id, via: "defillama-gecko_id" };
  }
  if (!listIndex) return null;

  const candidates = aliasCandidates(row);
  for (const key of candidates) {
    if (listIndex.byId.has(key)) return { coingeckoId: key, via: "coins-list-id" };
  }
  // Unique exact name against the coins list. Ambiguous names are skipped.
  const nameKeys = new Set(
    [row.name, ...(row.members || []).map(m => m.name)]
      .map(value => String(value || "").toLowerCase().trim())
      .filter(Boolean)
  );
  for (const name of nameKeys) {
    const hits = listIndex.byName.get(name) || [];
    if (hits.length === 1) return { coingeckoId: hits[0].id, via: "coins-list-name" };
  }
  return null;
}

function buildListIndex(coins) {
  const byId = new Map();
  const byName = new Map();
  for (const coin of coins || []) {
    if (!coin || !coin.id) continue;
    byId.set(String(coin.id).toLowerCase(), coin);
    const name = String(coin.name || "")
      .toLowerCase()
      .trim();
    if (!name) continue;
    const list = byName.get(name) || [];
    list.push(coin);
    byName.set(name, list);
  }
  return { byId, byName };
}

async function loadCoinsList() {
  const cached = readJson(LIST_CACHE);
  if (cached && Array.isArray(cached.coins) && Date.now() - Number(cached.fetchedAt || 0) < TTL_MS) {
    return cached.coins;
  }
  const response = await cgGet("/coins/list", { include_platform: "false" });
  const coins = Array.isArray(response.data) ? response.data : [];
  if (coins.length) writeJson(LIST_CACHE, { fetchedAt: Date.now(), coins });
  return coins;
}

function readImageCache() {
  const cached = readJson(IMAGE_CACHE);
  if (cached && cached.images && Date.now() - Number(cached.fetchedAt || 0) < TTL_MS) return cached.images;
  return {};
}

function writeImageCache(images) {
  writeJson(IMAGE_CACHE, { fetchedAt: Date.now(), images });
}

/**
 * Fetch /coins/markets for the given ids and return { id: imageUrl }.
 * Accepts a seed map (from the attention markets parse) so we do not refetch
 * ids we already have an image for.
 */
async function fetchImages(ids, seed = {}) {
  const images = { ...seed };
  const missing = [...new Set(ids)].filter(id => id && !isCoingeckoImage(images[id]));
  if (!missing.length) return images;

  for (const group of chunks(missing, MAX_IDS_PER_CALL)) {
    let body;
    try {
      const response = await cgGet("/coins/markets", {
        vs_currency: "usd",
        ids: group.join(","),
        per_page: Math.max(group.length, 1),
        page: 1,
        sparkline: "false",
      });
      body = response.data;
    } catch (err) {
      console.warn(`coingecko icons: markets fetch failed (${err.message})`);
      continue;
    }
    const rows = Array.isArray(body) ? body : [];
    for (const coin of rows) {
      if (!coin || !coin.id || !coin.image) continue;
      images[coin.id] = preferThumb(coin.image);
    }
  }
  return images;
}

/**
 * @param {Array<object>} rows scored rows (need id, name, slug, token?, llamaGeckoIds?, members?)
 * @param {{ imagesById?: Record<string, string> }} [options]
 * @returns {Promise<{ byId: Map<string, object>, matched: number, unmatched: Array<{id:string,name:string}>, via: Record<string, number> }>}
 */
async function resolveIcons(rows, options = {}) {
  const meta = { matched: 0, unmatched: [], via: {} };
  const byId = new Map();
  if (process.env.SIGNALS_OFF === "1") {
    meta.note = "Disabled with SIGNALS_OFF=1.";
    return { byId, ...meta };
  }

  const seedRaw = { ...readImageCache(), ...(options.imagesById || {}) };
  const seedImages = {};
  for (const [id, url] of Object.entries(seedRaw)) {
    const thumb = preferThumb(url);
    if (isCoingeckoImage(thumb)) seedImages[id] = thumb;
  }
  let listIndex = null;
  const needsList = rows.some(row => !(row.token && row.token.coingeckoId) && !(row.llamaGeckoIds || []).length);
  if (needsList) {
    try {
      listIndex = buildListIndex(await loadCoinsList());
    } catch (err) {
      console.warn(`coingecko icons: coins/list failed (${err.message}); matching mapped + DefiLlama ids only`);
    }
  }

  const pending = [];
  for (const row of rows) {
    const match = matchCoingeckoId(row, listIndex);
    if (!match) {
      meta.unmatched.push({ id: row.id, name: row.name });
      continue;
    }
    meta.via[match.via] = (meta.via[match.via] || 0) + 1;
    pending.push({ rowId: row.id, ...match });
  }

  const images = await fetchImages(
    pending.map(item => item.coingeckoId),
    seedImages
  );
  writeImageCache(images);

  for (const item of pending) {
    const url = images[item.coingeckoId];
    if (!isCoingeckoImage(url)) {
      meta.unmatched.push({
        id: item.rowId,
        name: (rows.find(row => row.id === item.rowId) || {}).name || item.rowId,
      });
      continue;
    }
    byId.set(item.rowId, {
      url,
      source: "coingecko",
      coingeckoId: item.coingeckoId,
      via: item.via,
    });
    meta.matched += 1;
  }

  return { byId, matched: meta.matched, unmatched: meta.unmatched, via: meta.via };
}

module.exports = {
  resolveIcons,
  matchCoingeckoId,
  preferThumb,
  isCoingeckoImage,
  buildListIndex,
  aliasCandidates,
  norm,
};
