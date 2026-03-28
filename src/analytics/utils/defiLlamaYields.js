/**
 * DefiLlama yields API — chart endpoint is small per pool (full /pools is ~12MB).
 */

const axios = require("axios");

const YIELDS_BASE = "https://yields.llama.fi";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Latest point from a pool’s APY history (e.g. Kintsu SMON on Monad).
 * @param {string} poolId - UUID from yields.llama.fi pools list
 * @param {number} [timeoutMs]
 * @returns {Promise<{ apy: number|null, apyBase: number|null, tvlUsd: number|null, timestamp?: string }|null>}
 */
async function fetchYieldsChartLatest(poolId, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!poolId || typeof poolId !== "string") return null;
  const { data } = await axios.get(`${YIELDS_BASE}/chart/${encodeURIComponent(poolId)}`, {
    timeout: timeoutMs,
  });
  const arr = data?.data;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const last = arr[arr.length - 1];
  const apy = typeof last.apy === "number" && Number.isFinite(last.apy) ? last.apy : null;
  const apyBase = typeof last.apyBase === "number" && Number.isFinite(last.apyBase) ? last.apyBase : null;
  const tvlUsd = typeof last.tvlUsd === "number" && Number.isFinite(last.tvlUsd) ? last.tvlUsd : null;
  return { apy, apyBase, tvlUsd, timestamp: last.timestamp };
}

module.exports = {
  fetchYieldsChartLatest,
  YIELDS_BASE,
};
