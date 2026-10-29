/**
 * CoinGecko attention signal.
 *
 * One batched call to `/coins/markets` covers every mapped row: market cap,
 * 24h volume and the 30-day price change. The score uses **turnover**
 * (24h volume ÷ market cap), not price momentum — TVL is already denominated in
 * dollars, so a token's price rise inflates growth and TVL-added. Turnover is
 * the part that is not already in the DefiLlama inputs.
 *
 * Free Demo tier: 100 calls/min. Without a key the public host is shared per IP,
 * so CI can be throttled; a failed call disables the signal for that build and
 * every row scores the neutral 0.5.
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const { loadTokenMap } = require("./tokenMap");

const ROOT = path.resolve(__dirname, "../../../..");
const CACHE_DIR = process.env.SIGNALS_CACHE_DIR || path.join(ROOT, "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "coingecko-markets.json");
const TOP_CACHE_FILE = path.join(CACHE_DIR, "coingecko-top.json");
const TOP_LIMIT = Number(process.env.COINGECKO_TOP_LIMIT) || 200;
const TTL_MS = Number(process.env.COINGECKO_CACHE_TTL_MS) || 6 * 3600 * 1000;
const TIMEOUT_MS = Number(process.env.COINGECKO_TIMEOUT_MS) || 20000;
const MAX_IDS_PER_CALL = 200;

// Demo and Pro keys both use the CG- prefix, so the tier cannot be inferred from
// the key. Demo is the default; a paid key opts in with COINGECKO_API_TIER=pro.
function isPro() {
  return String(process.env.COINGECKO_API_TIER || "demo").toLowerCase() === "pro";
}

function host() {
  return isPro() ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
}

function authHeader() {
  const key = process.env.COINGECKO_API_KEY || "";
  if (!key) return {};
  return isPro() ? { "x-cg-pro-api-key": key } : { "x-cg-demo-api-key": key };
}

function readCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (parsed && parsed.coins && parsed.fetchedAt) return parsed;
  } catch {
    // no usable cache
  }
  return { fetchedAt: 0, coins: {} };
}

function writeCache(coins) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), coins }));
}

function readTopCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(TOP_CACHE_FILE, "utf8"));
    if (parsed && Array.isArray(parsed.ids) && parsed.fetchedAt) return parsed;
  } catch {
    // no usable cache
  }
  return { fetchedAt: 0, ids: [] };
}

function writeTopCache(ids) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(TOP_CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), ids }));
}

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Pure parse step, exported so the offline test can run without a network. */
function parseMarkets(body) {
  const rows = Array.isArray(body) ? body : Array.isArray(body && body.data) ? body.data : [];
  const out = {};
  for (const coin of rows) {
    if (!coin || !coin.id) continue;
    const marketCap = Number(coin.market_cap);
    const volume24h = Number(coin.total_volume);
    if (!Number.isFinite(marketCap) || !Number.isFinite(volume24h)) continue;
    out[coin.id] = {
      coingeckoId: coin.id,
      symbol: String(coin.symbol || "").toUpperCase(),
      marketCap,
      volume24h,
      priceChange30d: Number.isFinite(Number(coin.price_change_percentage_30d_in_currency))
        ? Number(coin.price_change_percentage_30d_in_currency)
        : null,
      updatedAt: coin.last_updated || null,
    };
  }
  return out;
}

async function requestMarkets(ids) {
  const response = await axios.get(`${host()}/coins/markets`, {
    timeout: TIMEOUT_MS,
    headers: authHeader(),
    params: {
      vs_currency: "usd",
      ids: ids.join(","),
      per_page: Math.max(ids.length, 1),
      page: 1,
      sparkline: "false",
      price_change_percentage: "30d",
    },
  });
  return parseMarkets(response.data);
}

async function fetchTop(limit) {
  const cache = readTopCache();
  if (Date.now() - Number(cache.fetchedAt || 0) < TTL_MS && cache.ids.length >= limit) return cache.ids;
  const response = await axios.get(`${host()}/coins/markets`, {
    timeout: TIMEOUT_MS,
    headers: authHeader(),
    params: { vs_currency: "usd", order: "market_cap_desc", per_page: limit, page: 1, sparkline: "false" },
  });
  const ids = (Array.isArray(response.data) ? response.data : []).map(coin => coin && coin.id).filter(Boolean);
  if (ids.length) writeTopCache(ids);
  return ids;
}

async function fetchMarkets(ids) {
  const coins = {};
  for (const group of chunks(ids, MAX_IDS_PER_CALL)) {
    let parsed;
    try {
      parsed = await requestMarkets(group);
    } catch (err) {
      const status = err.response && err.response.status;
      if (status !== 429) throw err;
      await new Promise(resolve => setTimeout(resolve, 6000));
      parsed = await requestMarkets(group);
    }
    Object.assign(coins, parsed);
  }
  return coins;
}

/**
 * @param {Array<{rowId: string, token: object}>} targets
 * @returns {Promise<{byRow: Map<string, object>, meta: object}>}
 */
async function collect(targets) {
  const meta = {
    key: "attention",
    id: "coingecko",
    label: "Token attention",
    enabled: Boolean(targets.length),
    available: false,
    endpoint: "GET api.coingecko.com/api/v3/coins/markets",
    asOf: null,
    matched: 0,
    name: "CoinGecko",
    attribution: "Token market data by CoinGecko",
    url: "https://www.coingecko.com",
    public: true,
    note: "Turnover (24h volume / market cap). Neutral 0.5 when a row has no token or the call fails.",
  };
  if (process.env.SIGNALS_OFF === "1") {
    meta.enabled = false;
    meta.note = "Disabled with SIGNALS_OFF=1.";
    return { byRow: new Map(), topIds: [], meta };
  }
  if (!targets.length) {
    meta.note = "No row in token-map.json is in this build.";
    return { byRow: new Map(), topIds: [], meta };
  }

  const ids = [...new Set(targets.map(target => target.token.coingeckoId))];
  const cache = readCache();
  const fresh = Date.now() - Number(cache.fetchedAt || 0) < TTL_MS;
  const cached = fresh && ids.every(id => cache.coins[id]);

  try {
    const coins = cached ? cache.coins : { ...cache.coins, ...(await fetchMarkets(ids)) };
    if (!cached) writeCache(coins);
    const byRow = new Map();
    for (const target of targets) {
      const coin = coins[target.token.coingeckoId];
      if (!coin || !coin.marketCap || coin.marketCap <= 0) continue;
      byRow.set(target.rowId, { ...coin, turnover: coin.volume24h / coin.marketCap });
    }
    let topIds = [];
    try {
      topIds = await fetchTop(TOP_LIMIT);
    } catch (err) {
      console.warn(`coingecko: top-${TOP_LIMIT} list failed (${err.message}) — universe uses TVL + category floor only`);
    }
    meta.available = true;
    meta.asOf = new Date().toISOString();
    meta.matched = byRow.size;
    meta.topIds = topIds.length;
    if (!process.env.COINGECKO_API_KEY) meta.note += " No API key: the public host is IP-throttled.";
    return { byRow, topIds, meta };
  } catch (err) {
    meta.note = `Call failed (${err.message}); signal stays neutral.`;
    console.warn(`coingecko: ${err.message} — attention stays neutral`);
    return { byRow: new Map(), topIds: [], meta };
  }
}

module.exports = { collect, parseMarkets, loadTokenMap };
