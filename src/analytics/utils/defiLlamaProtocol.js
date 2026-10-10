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

/**
 * @param {string} pathname - e.g. "/v2/chains"
 * @param {number} [timeoutMs]
 */
async function fetchLlamaJson(pathname, timeoutMs = resolveTimeoutMs()) {
  const url = pathname.startsWith("http") ? pathname : `${DEFILLAMA_API}${pathname}`;
  const { data } = await axios.get(url, { timeout: timeoutMs });
  return data;
}

function fetchLlamaChains(timeoutMs) {
  return fetchLlamaJson("/v2/chains", timeoutMs);
}

function fetchDexOverview(chain, timeoutMs) {
  const q = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  return fetchLlamaJson(`/overview/dexs/${encodeURIComponent(chain)}?${q}`, timeoutMs);
}

function fetchChainFeesOverview(chain, timeoutMs) {
  const q = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  return fetchLlamaJson(`/overview/fees/${encodeURIComponent(chain)}?${q}`, timeoutMs);
}

/**
 * npm scripts cannot portably quote values that contain spaces or `;`.
 * Pass a percent-encoded token (`Robinhood%20Chain`) and decode here.
 * Plain names (`Abstract`, `Blast`) are unchanged.
 * @param {string|undefined|null} raw
 * @returns {string}
 */
function decodeLlamaToken(raw) {
  if (raw == null) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/** `LLAMA_CHAIN_NAME`, percent-decoded. Defaults to Arc. */
function llamaChainNameFromEnv() {
  return decodeLlamaToken(process.env.LLAMA_CHAIN_NAME) || "Arc";
}

/**
 * Options notional or premium for one protocol.
 * @param {string} slug - e.g. "derive-options"
 * @param {string} dataType - "dailyNotionalVolume" or "dailyPremiumVolume"
 * @param {number} [timeoutMs]
 */
function fetchOptionsSummary(slug, dataType, timeoutMs) {
  const q =
    "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true" + `&dataType=${encodeURIComponent(dataType)}`;
  return fetchLlamaJson(`/summary/options/${encodeURIComponent(slug)}?${q}`, timeoutMs);
}

/**
 * Market-wide options overview (protocols + totals).
 * @param {string} dataType - "dailyNotionalVolume" or "dailyPremiumVolume"
 * @param {number} [timeoutMs]
 */
function fetchOptionsOverview(dataType, timeoutMs) {
  const q =
    "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true" + `&dataType=${encodeURIComponent(dataType)}`;
  return fetchLlamaJson(`/overview/options?${q}`, timeoutMs);
}

/**
 * @param {string} slug - Protocol slug (e.g. "pump.fun")
 * @param {number} [timeoutMs]
 * @param {string} [dataType] - Llama dataType, e.g. "dailyRevenue" (default: daily fees)
 */
function fetchFeesSummary(slug, timeoutMs, dataType) {
  let q = "excludeTotalDataChart=true";
  if (dataType) q += `&dataType=${encodeURIComponent(dataType)}`;
  return fetchLlamaJson(`/summary/fees/${encodeURIComponent(slug)}?${q}`, timeoutMs);
}

/**
 * Free open-interest summary. `/summary/derivatives` is paywalled; this is not.
 * `total24h` is the latest open interest (not perp volume).
 * @param {string} slug
 * @param {number} [timeoutMs]
 */
function fetchOpenInterestSummary(slug, timeoutMs) {
  const q = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  return fetchLlamaJson(`/summary/open-interest/${encodeURIComponent(slug)}?${q}`, timeoutMs);
}

/**
 * Open-interest daily series (`totalDataChart`: [unixSeconds, usd][]). Same free endpoint as
 * `fetchOpenInterestSummary`, with the chart kept so callers can find a period high.
 * @param {string} slug
 * @param {number} [timeoutMs]
 */
function fetchOpenInterestChart(slug, timeoutMs) {
  const q = "excludeTotalDataChartBreakdown=true";
  return fetchLlamaJson(`/summary/open-interest/${encodeURIComponent(slug)}?${q}`, timeoutMs);
}

/**
 * Free DefiLlama hacks list (`/hacks`): `{ date, name, amount, chain[], classification, technique,
 * returnedFunds, bridgeHack, defillamaId, ... }[]`. `date` is unix seconds.
 * @param {number} [timeoutMs]
 */
function fetchLlamaHacks(timeoutMs) {
  return fetchLlamaJson("/hacks", timeoutMs);
}

function fetchLlamaProtocols(timeoutMs) {
  return fetchLlamaJson("/protocols", timeoutMs);
}

/**
 * Current USD prices from the free coins API.
 * @param {string[]} keys - `chain:address`, e.g. "ethereum:0x7712...2AEc"
 * @param {number} [timeoutMs]
 * @returns {Promise<Record<string, { price: number, symbol: string, decimals: number, timestamp: number }>>}
 */
async function fetchCoinPrices(keys, timeoutMs) {
  const data = await fetchLlamaJson(`https://coins.llama.fi/prices/current/${keys.join(",")}`, timeoutMs);
  return data?.coins || {};
}

/**
 * Volume summary for one protocol. `kind` is "dexs" or "aggregators".
 * @param {string} slug
 * @param {"dexs"|"aggregators"} kind
 * @param {number} [timeoutMs]
 */
function fetchVolumeSummary(slug, kind, timeoutMs) {
  const q = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  return fetchLlamaJson(`/summary/${kind}/${encodeURIComponent(slug)}?${q}`, timeoutMs);
}

/** Dead-from date, or "deprecated", when DefiLlama marks the listing retired; otherwise null. */
function llamaDeadLabel(protocol) {
  if (protocol?.deadFrom) return `dead since ${protocol.deadFrom}`;
  if (protocol?.deprecated) return "deprecated";
  return null;
}

/**
 * Current TVL and the sample on or just before `days` earlier.
 * `partial` is true when the series starts after that cutoff (baseline is the first sample).
 * @param {Array<{ date: number, totalLiquidityUSD: number }>|undefined} series
 * @param {number} days
 * @returns {{ current: number, past: number|null, first: number|null, windowDays: number, partial: boolean }|null}
 */
function tvlBaseline(series, days) {
  if (!Array.isArray(series) || !series.length || !Number.isFinite(days) || days <= 0) return null;
  let first = null;
  let last = null;
  for (const point of series) {
    const tvl = coalesceTvlPointUsd(point);
    const date = point && typeof point.date === "number" ? point.date : null;
    if (tvl == null || date == null) continue;
    if (!first || date < first.date) first = { date, tvl };
    if (!last || date >= last.date) last = { date, tvl };
  }
  if (!last || !first) return null;
  const target = last.date - days * 86400;
  let past = null;
  for (const point of series) {
    const tvl = coalesceTvlPointUsd(point);
    const date = point && typeof point.date === "number" ? point.date : null;
    if (tvl == null || date == null || date > target) continue;
    if (!past || date >= past.date) past = { date, tvl };
  }
  const baseline = past || first;
  return {
    current: last.tvl,
    past: past ? past.tvl : null,
    first: first.tvl,
    windowDays: Math.max(0, Math.round((last.date - baseline.date) / 86400)),
    partial: !past,
  };
}

function fetchHistoricalChainTvl(chain, timeoutMs) {
  return fetchLlamaJson(`/v2/historicalChainTvl/${encodeURIComponent(chain)}`, timeoutMs);
}

module.exports = {
  fetchDefiLlamaProtocol,
  lastTvlUsdFromSeries,
  fetchLlamaJson,
  fetchLlamaChains,
  fetchDexOverview,
  fetchChainFeesOverview,
  decodeLlamaToken,
  llamaChainNameFromEnv,
  fetchOptionsSummary,
  fetchOptionsOverview,
  fetchFeesSummary,
  fetchOpenInterestSummary,
  fetchOpenInterestChart,
  fetchLlamaHacks,
  fetchLlamaProtocols,
  fetchCoinPrices,
  fetchVolumeSummary,
  llamaDeadLabel,
  fetchHistoricalChainTvl,
  tvlBaseline,
  DEFILLAMA_API,
};
