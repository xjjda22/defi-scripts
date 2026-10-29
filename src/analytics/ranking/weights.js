/**
 * Score weights.
 *
 * Core inputs keep their relative order and cover 0.85 of the score. The two
 * external signals take 0.15: CoinGecko attention 0.08 and Nansen smart money
 * 0.07. When a source is off (no key, no addresses, CI without approval) its
 * weight is dropped and every remaining weight is renormalised, so the score
 * stays on a 0–1 scale and the board still ranks.
 */

const CORE_WEIGHTS = { size: 0.3, growth: 0.21, tvlAdded: 0.17, feesMomentum: 0.1, volumeMomentum: 0.07 };
const SIGNAL_WEIGHTS = { attention: 0.08, smartMoney: 0.07 };

function activeWeights(enabledSignals) {
  const weights = { ...CORE_WEIGHTS };
  for (const key of enabledSignals) {
    if (SIGNAL_WEIGHTS[key]) weights[key] = SIGNAL_WEIGHTS[key];
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  for (const key of Object.keys(weights)) weights[key] = weights[key] / total;
  return weights;
}

function roundWeights(weights) {
  const out = {};
  for (const [key, value] of Object.entries(weights)) out[key] = Math.round(value * 10000) / 10000;
  return out;
}

module.exports = { CORE_WEIGHTS, SIGNAL_WEIGHTS, activeWeights, roundWeights };
