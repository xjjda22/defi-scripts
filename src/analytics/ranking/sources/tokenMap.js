/**
 * Showcase row → token map.
 *
 * The board ranks protocol families, but CoinGecko and Nansen both speak tokens.
 * `token-map.json` is the only place that join lives: a row id from
 * `showcase/data.json` maps to one CoinGecko id plus the contract addresses
 * Nansen needs. Rows that are not in the map score a neutral 0.5 on both
 * signals, which is the same rule the core inputs use for missing data.
 *
 * Keep the map conservative. A wrong token is worse than a missing one: it
 * would let an unrelated coin move a protocol's rank.
 */

const fs = require("fs");
const path = require("path");

const MAP_FILE = path.join(__dirname, "..", "token-map.json");

function loadTokenMap(file = MAP_FILE) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = parsed && parsed.rows ? parsed.rows : {};
  for (const [rowId, entry] of Object.entries(rows)) {
    if (!entry || !entry.coingeckoId) throw new Error(`token-map: ${rowId} has no coingeckoId`);
    if (!entry.addresses) entry.addresses = {};
  }
  return { updatedAt: parsed.updatedAt || null, note: parsed.note || "", rows };
}

/** Nansen accepts lowercase EVM addresses; Solana addresses are case-sensitive. */
function normalizeAddress(chain, address) {
  const value = String(address || "").trim();
  if (!value) return "";
  return chain === "solana" ? value : value.toLowerCase();
}

/** Flatten the map into the (chain, address) pairs Nansen is queried with. */
function addressEntries(targets) {
  const out = [];
  for (const target of targets) {
    for (const [chain, address] of Object.entries(target.token.addresses || {})) {
      const normalized = normalizeAddress(chain, address);
      if (normalized) out.push({ rowId: target.rowId, chain, address: normalized });
    }
  }
  return out;
}

module.exports = { MAP_FILE, loadTokenMap, normalizeAddress, addressEntries };
