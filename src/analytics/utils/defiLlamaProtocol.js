/**
 * Minimal DefiLlama protocol API helper for analytics scripts.
 */

const axios = require("axios");

const DEFILLAMA_API = "https://api.llama.fi";

function resolveTimeoutMs() {
  const env = parseInt(process.env.DEFILLAMA_TIMEOUT_MS || "", 10);
  if (Number.isFinite(env) && env >= 5000) return env;
  return 60000;
}

/**
 * @param {string} slug - Protocol slug (e.g. "lido", "stakestone-stone")
 * @param {number} [timeoutMs]
 * @returns {Promise<object>}
 */
async function fetchDefiLlamaProtocol(slug, timeoutMs = resolveTimeoutMs()) {
  const { data } = await axios.get(`${DEFILLAMA_API}/protocol/${encodeURIComponent(slug)}`, {
    timeout: timeoutMs,
  });
  return data;
}

/**
 * @param {Array<{ date: number, totalLiquidityUSD: number }>|undefined} tvlSeries
 * @returns {number|null}
 */
function coalesceTvlPointUsd(point) {
  const v = point?.totalLiquidityUSD;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function lastTvlUsdFromSeries(tvlSeries) {
  if (!tvlSeries?.length) return null;
  for (let i = tvlSeries.length - 1; i >= 0; i--) {
    const n = coalesceTvlPointUsd(tvlSeries[i]);
    if (n != null && n >= 0) return n;
  }
  return null;
}

module.exports = {
  fetchDefiLlamaProtocol,
  lastTvlUsdFromSeries,
  DEFILLAMA_API,
};
