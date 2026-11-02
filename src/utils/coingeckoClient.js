/**
 * Shared CoinGecko HTTP client.
 *
 * - COINGECKO_API_KEY: Demo or Pro key (both start with CG-). Optional.
 * - COINGECKO_API_TIER: "demo" (default, api.coingecko.com + x-cg-demo-api-key) or
 *   "pro" (pro-api.coingecko.com + x-cg-pro-api-key).
 * - Keyless fallback: with no key, or when a keyed call is rejected (401/403), the
 *   request goes to the shared public host without a key. That host is throttled per
 *   IP, so a 429 is retried once after COINGECKO_RETRY_MS (default 6 s).
 *
 * Used by the showcase attention signal (src/analytics/ranking/sources/coingecko.js)
 * and the price helpers (src/utils/prices.js).
 */

const axios = require("axios");

const PUBLIC_HOST = "https://api.coingecko.com/api/v3";
const PRO_HOST = "https://pro-api.coingecko.com/api/v3";

function isPro() {
  return String(process.env.COINGECKO_API_TIER || "demo").toLowerCase() === "pro";
}

function hasKey() {
  return Boolean(process.env.COINGECKO_API_KEY);
}

function host() {
  return isPro() && hasKey() ? PRO_HOST : PUBLIC_HOST;
}

function authHeader() {
  const key = process.env.COINGECKO_API_KEY || "";
  if (!key) return {};
  return isPro() ? { "x-cg-pro-api-key": key } : { "x-cg-demo-api-key": key };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET a CoinGecko v3 path ("/simple/price", "/coins/markets", ...).
 * @param {string} pathname
 * @param {object} [params]
 * @param {{ timeout?: number }} [options]
 */
async function cgGet(pathname, params = {}, options = {}) {
  const timeout = options.timeout || Number(process.env.COINGECKO_TIMEOUT_MS) || 20000;
  const retryMs = Number(process.env.COINGECKO_RETRY_MS) || 6000;
  const attempt = async (base, headers) => {
    try {
      return await axios.get(`${base}${pathname}`, { params, timeout, headers });
    } catch (err) {
      if (err.response && err.response.status === 429) {
        await sleep(retryMs);
        return axios.get(`${base}${pathname}`, { params, timeout, headers });
      }
      throw err;
    }
  };
  try {
    return await attempt(host(), authHeader());
  } catch (err) {
    const status = err.response && err.response.status;
    if (hasKey() && (status === 401 || status === 403)) {
      console.warn(`CoinGecko rejected the key (${status}); retrying keyless on the public host`);
      return attempt(PUBLIC_HOST, {});
    }
    throw err;
  }
}

module.exports = { cgGet, host, authHeader, isPro, hasKey, PUBLIC_HOST, PRO_HOST };
