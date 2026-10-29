/**
 * Collect the external signals that sit beside the DefiLlama inputs.
 *
 * Each source maps a showcase row to one raw value:
 *   attention   turnover = 24h volume / market cap          (CoinGecko)
 *   smartMoney  intensity = 30d netflow / market cap         (Nansen)
 *
 * The caller turns those into percentiles across the eligible rows. A row with
 * no token, or a source that failed, is simply absent here and scores 0.5.
 */

const { loadTokenMap } = require("./tokenMap");
const coingecko = require("./coingecko");
const nansen = require("./nansen");

/** Pure merge, exported so the offline test does not touch the network. */
function mergeSignals(targets, cgByRow, nanByRow) {
  const byId = new Map();
  for (const target of targets) {
    const cg = (cgByRow && cgByRow.get(target.rowId)) || null;
    const nan = (nanByRow && nanByRow.get(target.rowId)) || null;
    const attention = cg && cg.marketCap > 0 && Number.isFinite(cg.volume24h) ? cg.volume24h / cg.marketCap : null;
    const smartMoney = nan && Number.isFinite(nan.intensity) ? nan.intensity : null;
    if (attention == null && smartMoney == null) continue;
    byId.set(target.rowId, {
      attention,
      smartMoney,
      token: cg
        ? {
            coingeckoId: cg.coingeckoId,
            symbol: cg.symbol,
            marketCap: Math.round(cg.marketCap),
            volume24h: Math.round(cg.volume24h),
            turnover: Number.isFinite(attention) ? Math.round(attention * 10000) / 10000 : null,
          }
        : null,
    });
  }
  return byId;
}

/**
 * @param {Array<{id: string}>} rows scored rows (need `id` only)
 * @returns {Promise<{byId: Map<string, object>, sources: object[], publishSafe: boolean, mapped: number}>}
 */
async function collectSignals(rows) {
  const map = loadTokenMap();
  const targets = rows.filter(row => map.rows[row.id]).map(row => ({ rowId: row.id, token: map.rows[row.id] }));

  const [cg, nan] = await Promise.all([coingecko.collect(targets), nansen.collect(targets)]);
  const byId = mergeSignals(targets, cg.byRow, nan.byRow);
  const publishSafe = !(nan.meta.available && nan.meta.public === false);

  for (const meta of [cg.meta, nan.meta]) {
    const state = !meta.enabled ? "off" : meta.available ? `${meta.matched} rows` : "unavailable";
    console.log(`signal ${meta.id}: ${state}${meta.credits ? ` · ${meta.credits} credits` : ""}`);
  }
  const external = [cg.meta, nan.meta].filter(meta => meta.enabled && meta.available).map(meta => meta.name || meta.id);
  console.log(`sources: DefiLlama core${external.length ? ` + ${external.join(" + ")}` : " (no external signal)"}`);

  return { byId, sources: [cg.meta, nan.meta], publishSafe, mapped: targets.length };
}

module.exports = { collectSignals, mergeSignals };
