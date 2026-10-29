/**
 * Nansen smart-money signal.
 *
 * One POST to `/api/v1/smart-money/netflow` for every mapped contract address.
 * The raw number is 30-day net flow ÷ market cap; only its percentile is ever
 * published, and the board never prints dollar flows or wallet lists.
 *
 * Redistribution: Nansen's guidelines put smart-money flow data in the
 * "restricted" bucket (approval + significant transformation). Until that
 * approval exists, this source runs only in local builds: a CI build without
 * `NANSEN_PUBLIC=1` disables it even when a key is present. The build marks the
 * output `publishSafe: false` so a deploy can be caught before it ships.
 *
 * Credits: `/smart-money/netflow` costs 5 credits. The free plan tops up to 10
 * credits a day, so cache the raw response (12h default) and make one call per
 * build. Pro is 2,000 credits a month, which is 400 calls.
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const { addressEntries, normalizeAddress } = require("./tokenMap");

const ROOT = path.resolve(__dirname, "../../../..");
const CACHE_DIR = process.env.SIGNALS_CACHE_DIR || path.join(ROOT, "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "nansen-netflow.json");
const TTL_MS = Number(process.env.NANSEN_CACHE_TTL_MS) || 12 * 3600 * 1000;
const TIMEOUT_MS = Number(process.env.NANSEN_TIMEOUT_MS) || 30000;
const ENDPOINT = "POST https://api.nansen.ai/api/v1/smart-money/netflow";

/** Official Nansen chain ids for the platforms in token-map.json. */
const CHAINS = ["ethereum", "solana", "base", "arbitrum", "optimism", "polygon", "bnb", "avalanche", "hyperevm"];

function isCi() {
  return process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
}

function readCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (parsed && Array.isArray(parsed.data) && parsed.fetchedAt) return parsed;
  } catch {
    // no usable cache
  }
  return { fetchedAt: 0, addresses: [], data: [] };
}

function writeCache(addresses, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), addresses, data }));
}

/** Pure parse step, exported for the offline test. */
function parseNetflow(body) {
  const rows = Array.isArray(body) ? body : Array.isArray(body && body.data) ? body.data : [];
  const out = [];
  for (const row of rows) {
    if (!row || !row.token_address) continue;
    const chain = String(row.chain || "").toLowerCase();
    const marketCap = Number(row.market_cap_usd);
    const netFlow30d = Number(row.net_flow_30d_usd);
    if (!Number.isFinite(marketCap) || !Number.isFinite(netFlow30d)) continue;
    out.push({
      chain,
      address: normalizeAddress(chain, row.token_address),
      tokenSymbol: row.token_symbol || null,
      marketCap,
      netFlow30d,
      netFlow7d: Number.isFinite(Number(row.net_flow_7d_usd)) ? Number(row.net_flow_7d_usd) : null,
      traderCount: Number.isFinite(Number(row.trader_count)) ? Number(row.trader_count) : null,
    });
  }
  return out;
}

async function postNetflow(key, addresses) {
  const response = await axios.post(
    "https://api.nansen.ai/api/v1/smart-money/netflow",
    {
      chains: ["all"],
      filters: { token_address: addresses },
      pagination: { page: 1, per_page: 1000 },
      order_by: [{ field: "market_cap_usd", direction: "DESC" }],
    },
    {
      timeout: TIMEOUT_MS,
      headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" },
    }
  );
  return { rows: parseNetflow(response.data), credits: response.headers["x-nansen-credits-used"] || null };
}

/**
 * @param {Array<{rowId: string, token: object}>} targets
 * @returns {Promise<{byRow: Map<string, object>, meta: object}>}
 */
async function collect(targets) {
  const key = process.env.NANSEN_API_KEY || "";
  const approved = process.env.NANSEN_PUBLIC === "1";
  const entries = addressEntries(targets);
  const meta = {
    key: "smartMoney",
    id: "nansen",
    label: "Smart-money flow",
    enabled: Boolean(key) && entries.length > 0 && process.env.SIGNALS_OFF !== "1",
    available: false,
    endpoint: ENDPOINT,
    asOf: null,
    matched: 0,
    credits: null,
    public: approved,
    name: "Nansen API",
    attribution: "Smart-money data powered by Nansen API",
    url: "https://www.nansen.ai",
    note: "Percentile of 30-day smart-money netflow / market cap. Raw flows and wallet lists are never published.",
  };

  if (process.env.SIGNALS_OFF === "1") {
    meta.enabled = false;
    meta.note = "Disabled with SIGNALS_OFF=1.";
    return { byRow: new Map(), meta };
  }
  if (!key) {
    meta.enabled = false;
    meta.note = "NANSEN_API_KEY is not set; signal stays neutral.";
    return { byRow: new Map(), meta };
  }
  if (!entries.length) {
    meta.enabled = false;
    meta.note = "No mapped row in this build has a contract address.";
    return { byRow: new Map(), meta };
  }
  if (isCi() && !approved) {
    meta.enabled = false;
    meta.note =
      "CI build with NANSEN_PUBLIC != 1: disabled until Nansen redistribution approval. Run locally to preview.";
    return { byRow: new Map(), meta };
  }

  const addresses = [...new Set(entries.map(entry => entry.address))];
  const cache = readCache();
  const fresh = Date.now() - Number(cache.fetchedAt || 0) < TTL_MS;
  const cached = fresh && addresses.every(address => (cache.addresses || []).includes(address));

  let rows;
  try {
    if (cached) {
      meta.credits = "cache";
      rows = cache.data;
    } else {
      const result = await postNetflow(key, addresses);
      rows = result.rows;
      meta.credits = result.credits;
      writeCache(addresses, rows);
    }
  } catch (err) {
    const status = err.response && err.response.status;
    if (status === 429) {
      const retryAfter = Math.min(Number(err.response.headers && err.response.headers["retry-after"]) || 5, 15);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      try {
        const result = await postNetflow(key, addresses);
        rows = result.rows;
        meta.credits = result.credits;
        writeCache(addresses, rows);
      } catch (retryErr) {
        meta.note = `Rate limited (${retryErr.message}); signal stays neutral.`;
        console.warn(`nansen: ${retryErr.message} — smart money stays neutral`);
        return { byRow: new Map(), meta };
      }
    } else {
      meta.note = `Call failed (${err.message}); signal stays neutral.`;
      if (status === 401 || status === 403)
        meta.note = "Key rejected, out of credits, or plan does not include the endpoint.";
      console.warn(`nansen: ${err.message} — smart money stays neutral`);
      return { byRow: new Map(), meta };
    }
  }

  const byRow = matchNetflow(targets, rows);

  meta.available = true;
  meta.asOf = new Date().toISOString();
  meta.matched = byRow.size;
  if (!approved) meta.note += " Preview only: not cleared for public redistribution.";
  return { byRow, meta };
}

/** Pure join of parsed netflow rows to targets, exported for the offline test. */
function matchNetflow(targets, rows) {
  const byChainAddress = new Map();
  const byAddress = new Map();
  for (const row of rows) {
    byChainAddress.set(`${row.chain}:${row.address}`, row);
    const previous = byAddress.get(row.address);
    if (!previous || row.marketCap > previous.marketCap) byAddress.set(row.address, row);
  }

  const byRow = new Map();
  for (const target of targets) {
    let match = null;
    for (const [chain, address] of Object.entries(target.token.addresses || {})) {
      const normalized = normalizeAddress(chain, address);
      const row = byChainAddress.get(`${chain}:${normalized}`) || byAddress.get(normalized);
      if (!row) continue;
      if (!match || row.marketCap > match.marketCap) match = row;
    }
    if (!match || !match.marketCap || match.marketCap <= 0) continue;
    byRow.set(target.rowId, {
      tokenSymbol: match.tokenSymbol,
      marketCap: match.marketCap,
      netFlow30d: match.netFlow30d,
      netFlow7d: match.netFlow7d,
      traderCount: match.traderCount,
      intensity: match.netFlow30d / match.marketCap,
    });
  }
  return byRow;
}

module.exports = { collect, parseNetflow, matchNetflow, CHAINS };
