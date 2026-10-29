/**
 * Candidate universe.
 *
 * Scoring all ~1,040 eligible rows means ~740 TVL history fetches. This caps the
 * pool before any history is fetched, while keeping every category represented:
 *
 *   1. DefiLlama top `overall` rows by TVL
 *   2. CoinGecko top `overall` tokens by market cap (mapped through token-map.json)
 *   3. top `perCategory` rows in every category, by TVL, then fees, then volume
 *
 * The union is deduplicated and topped up to `overall` rows if the floors leave
 * it short. Percentiles are then computed inside this pool, not across all rows.
 */

const DEFAULTS = { overall: 200, perCategory: 20 };

function groupTotals(group) {
  let tvl = 0;
  let fees = 0;
  let volume = 0;
  for (const member of group.members || []) {
    tvl += member.tvl || 0;
    fees += member.fees30d || 0;
    volume += member.volume30d || 0;
  }
  return { tvl, fees, volume };
}

/** Rank on the same basis the score uses: TVL, then fees, then volume. */
function rankValue(totals) {
  if (totals.tvl > 0) return { basis: "tvl", value: totals.tvl };
  if (totals.fees > 0) return { basis: "fees", value: totals.fees };
  if (totals.volume > 0) return { basis: "volume", value: totals.volume };
  return { basis: null, value: 0 };
}

function selectUniverse({ groups, signals, topTokenIds, overall = DEFAULTS.overall, perCategory = DEFAULTS.perCategory }) {
  const rows = groups.map(group => {
    const totals = groupTotals(group);
    const rank = rankValue(totals);
    return { group, totals, basis: rank.basis, value: rank.value };
  });

  const tvlTop = rows
    .filter(row => row.totals.tvl > 0)
    .sort((a, b) => b.totals.tvl - a.totals.tvl)
    .slice(0, overall);

  const tokenTop = new Set(topTokenIds || []);
  const coinGecko = rows.filter(row => {
    const signal = signals && signals.byId ? signals.byId.get(row.group.id) : null;
    const id = signal && signal.token ? signal.token.coingeckoId : null;
    return id != null && tokenTop.has(id);
  });

  const byCategory = new Map();
  for (const row of rows) {
    const list = byCategory.get(row.group.category) || [];
    list.push(row);
    byCategory.set(row.group.category, list);
  }
  const floor = [];
  for (const list of byCategory.values()) {
    list.sort((a, b) => b.value - a.value);
    floor.push(...list.slice(0, perCategory));
  }

  const pool = new Map();
  for (const row of [...tvlTop, ...coinGecko, ...floor]) pool.set(row.group.id, row.group);
  if (pool.size < overall) {
    for (const row of [...rows].sort((a, b) => b.value - a.value)) {
      if (pool.size >= overall) break;
      pool.set(row.group.id, row.group);
    }
  }

  return {
    groups: [...pool.values()],
    meta: {
      overall,
      perCategory,
      tvlTop: tvlTop.length,
      coinGeckoTop: coinGecko.length,
      categoryFloor: floor.length,
      categories: byCategory.size,
      candidates: pool.size,
    },
  };
}

module.exports = { selectUniverse, groupTotals, rankValue, DEFAULTS };
