/**
 * Minimal DefiLlama protocol API helper for analytics scripts.
 */

const axios = require("axios");

const DEFILLAMA_API = "https://api.llama.fi";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @param {string} slug - Protocol slug (e.g. "lido", "stakestone-stone")
 * @param {number} [timeoutMs]
 * @returns {Promise<object>}
 */
async function fetchDefiLlamaProtocol(slug, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const { data } = await axios.get(`${DEFILLAMA_API}/protocol/${encodeURIComponent(slug)}`, {
    timeout: timeoutMs,
  });
  return data;
}

/**
 * @param {Array<{ date: number, totalLiquidityUSD: number }>|undefined} tvlSeries
 * @returns {number|null}
 */
function lastTvlUsdFromSeries(tvlSeries) {
  if (!tvlSeries?.length) return null;
  const last = tvlSeries[tvlSeries.length - 1];
  const v = last?.totalLiquidityUSD;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

module.exports = {
  fetchDefiLlamaProtocol,
  lastTvlUsdFromSeries,
  DEFILLAMA_API,
};
