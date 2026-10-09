/**
 * Top-200 trending DeFi protocols, plus per-category rankings.
 *
 *   npm run ranking:top200
 *   npm run showcase:build
 *
 * Free DefiLlama endpoints only (`api.llama.fi`). `/summary/derivatives` and
 * `pro-api.llama.fi` are not called. Full write-up: docs/03-showcase-ranking.md.
 *
 * Rows. One row per protocol family and category: DefiLlama children that
 * share a `parentProtocol` and land in the same showcase category are summed
 * (Aave V2 + V3 + V4 → "Aave"), so versions of one protocol never take
 * several top-200 slots. Children of one parent in different categories stay
 * separate rows (Jupiter's aggregator, perps and lending). CEX, Ponzi and
 * token-locker rows are left out.
 *
 * Score. Every input is turned into a percentile (0–1) across the eligible
 * rows, so no single outlier or clamp decides the order and there are no
 * ties at a cap. A missing input scores 0.5 (neutral).
 *
 *   size          TVL percentile among TVL rows; a row under $5M TVL is ranked on
 *                 its 30d fees among all rows' fees (or 30d volume)
 *   growth        ln(TVL now / max(TVL 180 days ago, $1M)), unclamped
 *   tvlAdded      TVL now − TVL 180 days ago, in dollars
 *   feesMom       30d fees vs the previous 30d (both ≥ $10k)
 *   volumeMom     30d volume vs the previous 30d (both ≥ $1M); spot DEX, then
 *                 aggregator, then options volume. Perp volume is a paid
 *                 DefiLlama endpoint, so perps lean on fees.
 *
 *   score = 0.35·size + 0.25·growth + 0.20·tvlAdded + 0.12·feesMom + 0.08·volumeMom
 *           + 0.012 · min(X posts, 6)
 *
 * New listings. A family with no TVL sample on or before the 180-day cutoff
 * is "new": its relative growth is neutral (0.5) and tvlAdded is its whole
 * TVL since its first sample. The page shows a "New" badge with its age.
 *
 * X mentions: set X_MENTIONS_DIR to a directory of list reads (raw post JSON
 * or markdown notes with status links) to recount distinct posts and rewrite
 * data/x-mentions.json. Otherwise the committed file is reused.
 *
 * RANKING_CACHE_DIR=/tmp/llama-cache keeps each protocol's TVL series on disk
 * for 20 hours, so a re-run does not refetch ~800 histories.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchLlamaProtocols, fetchLlamaJson, fetchDefiLlamaProtocol } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");
const { buildCatalog } = require("../../catalog/catalog");
const { BOARDS } = require("../../catalog/protocols");
const {
  EXCLUDED_LLAMA_CATEGORIES,
  LLAMA_TO_CATEGORY,
  SLUG_OVERRIDES,
  categoryMeta,
  resolveCategory,
  CATEGORY_BY_ID,
} = require("./categoryMap");
const { countProtocolMentions, toPublicMentions, loadPublicMentions } = require("./mentions");
const { buildCoverageIndex, linkCatalog, scriptLinks, MONITOR, RANKING_ONLY } = require("./coverage");

const ROOT = path.resolve(__dirname, "../../..");
const DATA_JSON = path.join(ROOT, "showcase", "data.json");
const MENTIONS_JSON = path.join(ROOT, "data", "x-mentions.json");

const MIN_TVL_USD = 5_000_000;
const MIN_FEES_30D_USD = 100_000;
const MIN_VOLUME_30D_USD = 5_000_000;
const TVL_LOG_FLOOR_USD = 1_000_000;
const FEES_MOMENTUM_FLOOR_USD = 10_000;
const VOLUME_MOMENTUM_FLOOR_USD = 1_000_000;
const WINDOW_DAYS = 180;
const TOP_N = 200;
const CATEGORY_LIMIT = 100;
const WEIGHTS = { size: 0.35, growth: 0.25, tvlAdded: 0.2, feesMomentum: 0.12, volumeMomentum: 0.08 };
const MENTION_CAP = 6;
const MENTION_STEP = 0.012;
const DAY = 86400;
const CACHE_MAX_AGE_MS = 20 * 3600 * 1000;
const HISTORY_CONCURRENCY = Math.max(1, parseInt(process.env.RANKING_CONCURRENCY || "6", 10) || 6);
const CACHE_DIR = process.env.RANKING_CACHE_DIR || "";

if (!process.env.DEFILLAMA_TIMEOUT_MS) process.env.DEFILLAMA_TIMEOUT_MS = "120000";

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundTo(value, places) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function money(value) {
  return value == null || !Number.isFinite(value) ? null : Math.round(value);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function overviewRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.protocols)) return data.protocols;
  return [];
}

/**
 * Index overview rows by slug and DefiLlama id. Rows with protocolType "chain"
 * are a chain's own gas fees (Ethereum, Solana, Tron), not a protocol's, so
 * they are skipped; otherwise whole chains enter on the fees floor.
 */
function indexOverview(rows) {
  const bySlug = new Map();
  const byId = new Map();
  for (const row of rows) {
    if (!row || row.protocolType === "chain") continue;
    if (row.slug) bySlug.set(String(row.slug), row);
    if (row.defillamaId != null) byId.set(String(row.defillamaId), row);
  }
  return { bySlug, byId };
}

function lookupOverview(index, protocol) {
  if (!index) return null;
  return index.bySlug.get(protocol.slug) || index.byId.get(String(protocol.id)) || null;
}

/** Percentile in (0, 1) with average rank for ties; missing values get 0.5. */
function percentiles(values) {
  const present = [];
  values.forEach((value, idx) => {
    if (value != null && Number.isFinite(value)) present.push({ value, idx });
  });
  const out = values.map(() => 0.5);
  if (present.length < 2) return out;
  present.sort((a, b) => a.value - b.value);
  let i = 0;
  while (i < present.length) {
    let j = i;
    while (j + 1 < present.length && present[j + 1].value === present[i].value) j += 1;
    const pct = ((i + j) / 2 + 0.5) / present.length;
    for (let k = i; k <= j; k += 1) out[present[k].idx] = pct;
    i = j + 1;
  }
  return out;
}

function logRatio(now, then, floor) {
  if (now == null || then == null || now < floor || then < floor) return null;
  return Math.log(now) - Math.log(then);
}

async function fetchOverview(pathname, label) {
  try {
    return await fetchLlamaJson(pathname);
  } catch (err) {
    console.warn(chalk.yellow(`warning: ${label} failed (${err.message}); that component stays neutral`));
    return null;
  }
}

async function mapPool(items, limit, fn) {
  let cursor = 0;
  async function worker() {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

function cacheFile(slug) {
  return path.join(CACHE_DIR, `${slug.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}

function compactSeries(series) {
  const out = [];
  for (const point of series || []) {
    const date = point && num(point.date);
    const tvl = point ? Number(point.totalLiquidityUSD) : NaN;
    if (date == null || !Number.isFinite(tvl)) continue;
    out.push([date, tvl]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

async function fetchHistory(slug) {
  if (CACHE_DIR) {
    try {
      const file = cacheFile(slug);
      const stat = fs.statSync(file);
      if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
        const cached = JSON.parse(fs.readFileSync(file, "utf8"));
        return compactSeries(cached.map(p => (Array.isArray(p) ? { date: p[0], totalLiquidityUSD: p[1] } : p)));
      }
    } catch {
      // no usable cache entry
    }
  }
  const waits = [0, 800, 2500, 6000];
  let lastError = null;
  for (let attempt = 0; attempt < waits.length; attempt += 1) {
    if (waits[attempt]) await sleep(waits[attempt]);
    try {
      const data = await fetchDefiLlamaProtocol(slug);
      const series = data && Array.isArray(data.tvl) ? compactSeries(data.tvl) : null;
      if (series && CACHE_DIR) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cacheFile(slug), JSON.stringify(series));
      }
      return series;
    } catch (err) {
      lastError = err;
      const status = err.response && err.response.status;
      if (status && status < 500 && status !== 429 && status !== 408) {
        console.warn(chalk.yellow(`warning: skip ${slug} (HTTP ${status})`));
        return null;
      }
    }
  }
  console.warn(chalk.yellow(`warning: skip ${slug} (${lastError ? lastError.message : "unknown error"})`));
  return null;
}

/** Last sample on or before `cutoff`, the first sample, and the series end. */
function seriesPoints(series, cutoff) {
  if (!series || !series.length) return null;
  let atCutoff = null;
  for (const [date, tvl] of series) {
    if (date <= cutoff) atCutoff = tvl;
    else break;
  }
  return { atCutoff, first: series[0][1], firstDate: series[0][0] };
}

function parentSlug(parentId) {
  return String(parentId || "").replace(/^parent#/, "");
}

/**
 * Six-month TVL for a family from its children's histories.
 * Children without a history (below the TVL floor, or a failed fetch) are
 * left out of both ends so they cannot fake growth.
 */
function familyHistory(members, historyCache, cutoff, nowSec) {
  let now = 0;
  let then = 0;
  let firstSum = 0;
  let firstDate = null;
  let withHistory = 0;
  let anyOld = false;
  let missing = 0;
  for (const member of members) {
    if (!member.needsHistory) continue;
    const series = historyCache.get(member.protocol.slug);
    const points = seriesPoints(series, cutoff);
    if (!points) {
      missing += 1;
      continue;
    }
    withHistory += 1;
    now += member.tvl || 0;
    firstSum += points.first;
    if (firstDate == null || points.firstDate < firstDate) firstDate = points.firstDate;
    if (points.atCutoff != null) {
      anyOld = true;
      then += points.atCutoff;
    }
  }
  if (!withHistory) return { known: false, missing };
  const ageDays = firstDate == null ? null : Math.max(0, Math.round((nowSec - firstDate) / DAY));
  if (!anyOld) {
    return { known: true, isNew: true, ageDays, now, then: null, growth: null, added: now - firstSum, missing };
  }
  const base = Math.max(then, TVL_LOG_FLOOR_USD);
  return {
    known: true,
    isNew: false,
    ageDays,
    now,
    then,
    growth: now > 0 ? Math.log(now) - Math.log(base) : null,
    pct: now > 0 ? (now / base - 1) * 100 : null,
    added: now - then,
    missing,
  };
}

const SHORT_LABELS = {
  dex: "DEX",
  aggregator: "Aggregator",
  perps: "Perps",
  lending: "Lending",
  vaults: "Vaults",
  staking: "Staking",
  restaking: "Restaking",
  "stable-rwa": "Stablecoin",
  "bridge-chain": "Bridge",
  other: "Other",
};

function shortLabel(categoryId) {
  return SHORT_LABELS[categoryId] || categoryMeta(categoryId).label;
}

function buildGroups(candidates, parentNames) {
  const byKey = new Map();
  for (const row of candidates) {
    const parent = row.protocol.parentProtocol || null;
    const key = parent ? `${parent}::${row.category}` : `slug:${row.protocol.slug}`;
    if (!byKey.has(key)) byKey.set(key, { key, parent, category: row.category, members: [] });
    byKey.get(key).members.push(row);
  }
  const groupsPerParent = new Map();
  for (const group of byKey.values()) {
    if (group.parent) groupsPerParent.set(group.parent, (groupsPerParent.get(group.parent) || 0) + 1);
  }
  const groups = [...byKey.values()];
  for (const group of groups) {
    group.members.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
    const lead = group.members[0].protocol;
    const siblings = group.parent ? groupsPerParent.get(group.parent) : 1;
    const parentName = group.parent ? parentNames.get(group.parent) || null : null;
    if (group.members.length === 1) {
      group.name = lead.name;
      group.slug = lead.slug;
      group.id = lead.slug;
    } else {
      const base = parentName || lead.name;
      group.name = siblings > 1 ? `${base} (${shortLabel(group.category)})` : base;
      group.slug = parentSlug(group.parent);
      group.id = siblings > 1 ? `${group.slug}--${group.category}` : group.slug;
    }
    group.parentName = parentName;
    group.siblings = siblings;
  }
  return groups;
}

function sumField(members, field) {
  let total = null;
  for (const member of members) {
    const value = num(member[field]);
    if (value == null) continue;
    total = (total || 0) + value;
  }
  return total;
}

/** Momentum from children that report both windows. */
function familyMomentum(members, nowField, prevField, floor) {
  let now = 0;
  let prev = 0;
  let seen = 0;
  for (const member of members) {
    const a = num(member[nowField]);
    const b = num(member[prevField]);
    if (a == null || b == null) continue;
    now += a;
    prev += b;
    seen += 1;
  }
  if (!seen) return { log: null, pct: null };
  const log = logRatio(now, prev, floor);
  return { log, pct: log == null ? null : (Math.exp(log) - 1) * 100 };
}

function mentionLookup(result) {
  const byId = new Map();
  const byName = new Map();
  for (const row of result.rows) {
    if (row.id) byId.set(row.id, row);
    const key = String(row.name || "").toLowerCase();
    const prev = byName.get(key);
    if (!prev || row.count > prev.count) byName.set(key, row);
  }
  return (id, name) => byId.get(id) || byName.get(String(name || "").toLowerCase()) || null;
}

function compareScore(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  if ((a.tvl || 0) !== (b.tvl || 0)) return (b.tvl || 0) - (a.tvl || 0);
  return String(a.id).localeCompare(String(b.id));
}

function toOutputRow(row, rank, overallRank) {
  return {
    rank,
    overallRank,
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    llamaCategories: row.llamaCategories,
    members: row.members,
    tvl: money(row.tvl),
    tvl6mAgo: money(row.tvl6mAgo),
    tvlAdded6m: money(row.tvlAdded6m),
    tvlChange6m: roundTo(row.tvlChange6m, 2),
    isNew: row.isNew,
    ageDays: row.ageDays,
    fees30d: money(row.fees30d),
    feesChange30d: roundTo(row.feesChange30d, 1),
    volume30d: money(row.volume30d),
    volumeChange30d: roundTo(row.volumeChange30d, 1),
    xMentions: row.xMentions || 0,
    xLists: row.xLists || [],
    llamaUrl: row.llamaUrl,
    scripts: row.scripts,
    coverage: row.coverage,
    score: roundTo(row.score, 4),
    components: row.components,
  };
}

function catalogExtra(entry, mentionFor) {
  const mention = mentionFor(entry.id, entry.name);
  return {
    rank: null,
    overallRank: null,
    id: entry.id,
    name: entry.name,
    slug: entry.id,
    category: entry.category || entry.group,
    llamaCategories: [],
    members: null,
    tvl: null,
    tvl6mAgo: null,
    tvlAdded6m: null,
    tvlChange6m: null,
    isNew: false,
    ageDays: null,
    fees30d: null,
    feesChange30d: null,
    volume30d: null,
    volumeChange30d: null,
    xMentions: mention ? mention.count : 0,
    xLists: mention ? mention.lists : [],
    llamaUrl: null,
    scripts: scriptLinks(entry),
    coverage: MONITOR,
    score: null,
    components: null,
    catalogOnly: true,
  };
}

function methodology(corpus) {
  return {
    windowDays: WINDOW_DAYS,
    weights: WEIGHTS,
    scoring: "percentile",
    mentionBonus: `${MENTION_STEP} per distinct X post, capped at ${MENTION_CAP} posts (max +${roundTo(MENTION_CAP * MENTION_STEP, 3)})`,
    mentionCorpus: corpus || null,
    floors: {
      minTvlUsd: MIN_TVL_USD,
      minFees30dUsd: MIN_FEES_30D_USD,
      minVolume30dUsd: MIN_VOLUME_30D_USD,
      tvlLogFloorUsd: TVL_LOG_FLOOR_USD,
      feesMomentumFloorUsd: FEES_MOMENTUM_FLOOR_USD,
      volumeMomentumFloorUsd: VOLUME_MOMENTUM_FLOOR_USD,
    },
    endpoints: [
      "GET /protocols",
      "GET /lite/protocols2 (parent protocol names)",
      "GET /protocol/{slug} (rows with TVL >= $5M)",
      "GET /overview/fees",
      "GET /overview/dexs",
      "GET /overview/aggregators",
      "GET /overview/options",
    ],
    excluded: [...EXCLUDED_LLAMA_CATEGORIES],
    summary:
      "Each row is a protocol family in one category (DefiLlama children with the same parent are summed, so Aave V2/V3/V4 are one row). " +
      "The score is a weighted sum of percentiles across all eligible rows: size 0.35, 6-month relative TVL growth 0.25, " +
      "6-month TVL added in dollars 0.20, 30-day fees momentum 0.12 and 30-day DEX volume momentum 0.08, plus a small bonus " +
      "per distinct X post from the user's lists. Percentiles cannot saturate, so a fresh listing cannot jump the board on a " +
      "capped growth number. A family with no TVL 180 days ago is marked New: its relative growth is neutral and it is judged on " +
      "the dollars it has gathered. CEX, Ponzi and token-locker rows are excluded.",
  };
}

async function main() {
  installCliSafeStdout();
  const generatedAt = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoff = nowSec - WINDOW_DAYS * DAY;
  console.log(chalk.cyan("Fetching DefiLlama /protocols, /lite/protocols2, /overview/fees, /overview/dexs"));

  let protocols;
  try {
    protocols = await fetchLlamaProtocols();
  } catch (err) {
    console.error(chalk.red(`DefiLlama /protocols failed: ${err.message}`));
    process.exit(1);
  }
  if (!Array.isArray(protocols) || !protocols.length) {
    console.error(chalk.red("DefiLlama /protocols returned no protocols"));
    process.exit(1);
  }

  const overviewQuery = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  const [feesBody, dexBody, aggBody, optionsBody, liteBody] = await Promise.all([
    fetchOverview(`/overview/fees?${overviewQuery}`, "fees overview"),
    fetchOverview(`/overview/dexs?${overviewQuery}`, "dex volume overview"),
    fetchOverview(`/overview/aggregators?${overviewQuery}`, "aggregator volume overview"),
    fetchOverview(`/overview/options?${overviewQuery}`, "options volume overview"),
    fetchOverview("/lite/protocols2", "parent protocol names"),
  ]);
  const feesIndex = indexOverview(overviewRows(feesBody));
  // Spot DEX volume first, then aggregator and options volume for rows that have none.
  const dexIndex = indexOverview([
    ...overviewRows(optionsBody),
    ...overviewRows(aggBody),
    ...overviewRows(dexBody),
  ]);
  const parentNames = new Map();
  for (const parent of (liteBody && liteBody.parentProtocols) || []) {
    if (parent && parent.id && parent.name) parentNames.set(parent.id, parent.name);
  }

  const catalog = buildCatalog();
  const coverage = buildCoverageIndex(catalog);
  const unknownCategories = new Set();
  const excludedCounts = {};

  const candidates = [];
  for (const protocol of protocols) {
    if (!protocol || !protocol.slug || !protocol.name) continue;
    if (EXCLUDED_LLAMA_CATEGORIES.has(protocol.category)) {
      excludedCounts[protocol.category] = (excludedCounts[protocol.category] || 0) + 1;
      continue;
    }
    const tvl = num(protocol.tvl);
    const feesRow = lookupOverview(feesIndex, protocol);
    const dexRow = lookupOverview(dexIndex, protocol);
    const fees30d = feesRow ? num(feesRow.total30d) : null;
    const volume30d = dexRow ? num(dexRow.total30d) : null;
    const tvlOk = tvl != null && tvl >= MIN_TVL_USD;
    const feesOk = fees30d != null && fees30d >= MIN_FEES_30D_USD;
    const volumeOk = volume30d != null && volume30d >= MIN_VOLUME_30D_USD;
    if (!tvlOk && !feesOk && !volumeOk) continue;
    const link = linkCatalog(protocol, coverage);
    if (protocol.category && !LLAMA_TO_CATEGORY[protocol.category] && !SLUG_OVERRIDES[protocol.slug]) {
      unknownCategories.add(protocol.category);
    }
    candidates.push({
      protocol,
      link,
      category: resolveCategory(protocol, link),
      tvl,
      fees30d,
      feesPrev30d: feesRow ? num(feesRow.total60dto30d) : null,
      volume30d,
      volumePrev30d: dexRow ? num(dexRow.total60dto30d) : null,
      needsHistory: tvlOk,
    });
  }
  candidates.sort((a, b) => a.protocol.slug.localeCompare(b.protocol.slug));

  const historyTargets = candidates.filter(row => row.needsHistory);
  console.log(
    chalk.gray(
      `${protocols.length} protocols, ${candidates.length} eligible, ${historyTargets.length} history fetches (concurrency ${HISTORY_CONCURRENCY}${CACHE_DIR ? `, cache ${CACHE_DIR}` : ""})`
    )
  );
  const historyCache = new Map();
  let historyMisses = 0;
  let finished = 0;
  await mapPool(historyTargets, HISTORY_CONCURRENCY, async row => {
    const series = await fetchHistory(row.protocol.slug);
    historyCache.set(row.protocol.slug, series);
    if (!series) historyMisses += 1;
    finished += 1;
    if (finished % 50 === 0 || finished === historyTargets.length) {
      console.error(chalk.gray(`history ${finished}/${historyTargets.length}`));
    }
  });

  const groups = buildGroups(candidates, parentNames);

  const mentionTargets = groups.map(group => ({
    id: group.id,
    name: group.name,
    names: [
      group.name,
      ...group.members.map(m => m.protocol.name),
      ...(group.parentName && group.siblings === 1 ? [group.parentName] : []),
    ],
    slugs: group.members.map(m => m.protocol.slug),
  }));
  // A catalog card can share its id with a family row (aave, uniswap): merge
  // the names into that target so the public file lists each id once.
  const targetById = new Map(mentionTargets.map(target => [target.id, target]));
  for (const entry of [...catalog.protocols, ...catalog.boards]) {
    const existing = targetById.get(entry.id);
    if (existing) {
      existing.names.push(entry.name);
      continue;
    }
    const target = { id: entry.id, name: entry.name, names: [entry.name], slugs: [] };
    targetById.set(entry.id, target);
    mentionTargets.push(target);
  }
  const mentionDir = process.env.X_MENTIONS_DIR;
  let mentionResult = { rows: [], corpus: null };
  if (mentionDir && fs.existsSync(mentionDir)) {
    mentionResult = countProtocolMentions(mentionDir, mentionTargets);
    fs.mkdirSync(path.dirname(MENTIONS_JSON), { recursive: true });
    fs.writeFileSync(MENTIONS_JSON, `${JSON.stringify(toPublicMentions(mentionResult, generatedAt), null, 2)}\n`);
    const c = mentionResult.corpus;
    console.log(
      chalk.gray(
        `wrote ${path.relative(ROOT, MENTIONS_JSON)}: ${mentionResult.rows.length} names from ${c.posts} posts (${c.from} to ${c.to})`
      )
    );
  } else if (fs.existsSync(MENTIONS_JSON)) {
    mentionResult = loadPublicMentions(MENTIONS_JSON);
    console.log(chalk.gray(`reused ${path.relative(ROOT, MENTIONS_JSON)} (${mentionResult.rows.length} names)`));
  } else {
    console.warn(chalk.yellow("warning: no X notes directory and no data/x-mentions.json; mention bonus is 0"));
  }
  const mentionFor = mentionLookup(mentionResult);

  const scored = groups.map(group => {
    const members = group.members;
    const tvl = sumField(members, "tvl");
    const history = familyHistory(members, historyCache, cutoff, nowSec);
    const fees = familyMomentum(members, "fees30d", "feesPrev30d", FEES_MOMENTUM_FLOOR_USD);
    const volume = familyMomentum(members, "volume30d", "volumePrev30d", VOLUME_MOMENTUM_FLOOR_USD);
    const fees30d = sumField(members, "fees30d");
    const volume30d = sumField(members, "volume30d");
    const links = [];
    const seenLinks = new Set();
    for (const member of members) {
      if (member.link && !seenLinks.has(member.link.id)) {
        seenLinks.add(member.link.id);
        links.push(member.link);
      }
    }
    const scripts = [];
    const seenScripts = new Set();
    for (const link of links) {
      for (const script of scriptLinks(link)) {
        if (seenScripts.has(script.name)) continue;
        seenScripts.add(script.name);
        scripts.push(script);
      }
    }
    const mention = mentionFor(group.id, group.name);
    const llamaSlug = group.slug;
    return {
      id: group.id,
      name: group.name,
      slug: llamaSlug,
      category: group.category,
      llamaCategories: [...new Set(members.map(m => m.protocol.category).filter(Boolean))],
      members:
        members.length > 1
          ? members.map(m => ({ slug: m.protocol.slug, name: m.protocol.name, tvl: money(m.tvl) }))
          : null,
      tvl,
      tvl6mAgo: history.known && !history.isNew ? history.then : null,
      tvlAdded6m: history.known ? history.added : null,
      tvlChange6m: history.known && !history.isNew ? history.pct : null,
      isNew: Boolean(history.known && history.isNew),
      ageDays: history.known ? history.ageDays : null,
      fees30d,
      feesChange30d: fees.pct,
      volume30d,
      volumeChange30d: volume.pct,
      xMentions: mention ? mention.count : 0,
      xLists: mention ? mention.lists : [],
      llamaUrl: `https://defillama.com/protocol/${encodeURIComponent(llamaSlug)}`,
      scripts,
      coverage: scripts.length ? MONITOR : RANKING_ONLY,
      catalogIds: links.map(link => link.id),
      sizeBasis: tvl != null && tvl >= MIN_TVL_USD ? "tvl" : fees30d != null && fees30d > 0 ? "fees" : "volume",
      inputs: {
        size: null,
        growth: history.known && !history.isNew ? history.growth : null,
        tvlAdded: history.known ? history.added : null,
        feesMomentum: fees.log,
        volumeMomentum: volume.log,
      },
    };
  });

  // Size is ranked on the row's own basis so dollars of TVL, fees and volume are
  // never compared directly: TVL rows against TVL rows, the rest against every
  // row's 30-day fees (or, without fees, every row's 30-day volume).
  const tvlPct = percentiles(scored.map(row => (row.sizeBasis === "tvl" ? Math.log(row.tvl) : null)));
  const feesPct = percentiles(scored.map(row => (row.fees30d > 0 ? Math.log(row.fees30d) : null)));
  const volumePct = percentiles(scored.map(row => (row.volume30d > 0 ? Math.log(row.volume30d) : null)));
  scored.forEach((row, i) => {
    if (row.sizeBasis === "tvl") row.inputs.size = tvlPct[i];
    else if (row.sizeBasis === "fees") row.inputs.size = feesPct[i];
    else row.inputs.size = row.volume30d > 0 ? volumePct[i] : null;
  });
  const pct = {};
  for (const key of Object.keys(WEIGHTS)) {
    pct[key] = key === "size" ? scored.map(row => row.inputs.size ?? 0) : percentiles(scored.map(row => row.inputs[key]));
  }
  scored.forEach((row, i) => {
    const mentionBonus = MENTION_STEP * Math.min(row.xMentions || 0, MENTION_CAP);
    let score = mentionBonus;
    const components = {};
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      score += weight * pct[key][i];
      components[key] = roundTo(pct[key][i], 3);
    }
    components.mentions = roundTo(mentionBonus, 3);
    row.score = score;
    row.components = components;
  });

  scored.sort(compareScore);
  const overall = scored.slice(0, TOP_N).map((row, index) => toOutputRow(row, index + 1, index + 1));
  const overallRankById = new Map(overall.map(row => [row.id, row.rank]));

  const matchedCatalogIds = new Set(scored.flatMap(row => row.catalogIds));
  const byCategory = {};
  for (const [id] of CATEGORY_BY_ID) byCategory[id] = [];
  const categoryTotals = {};
  for (const row of scored) {
    const list = byCategory[row.category] || (byCategory[row.category] = []);
    categoryTotals[row.category] = (categoryTotals[row.category] || 0) + 1;
    const overallRank = overallRankById.get(row.id) || null;
    // Keep the category's top rows plus anything that made the overall top 200.
    if (list.length < CATEGORY_LIMIT || overallRank) list.push(toOutputRow(row, categoryTotals[row.category], overallRank));
  }
  for (const entry of catalog.protocols) {
    if (matchedCatalogIds.has(entry.id)) continue;
    const extra = catalogExtra(entry, mentionFor);
    (byCategory[extra.category] || (byCategory[extra.category] = [])).push(extra);
  }
  for (const entry of BOARDS) {
    const group = entry.group === "tooling" ? "tooling" : "boards";
    byCategory[group].push(catalogExtra(entry, mentionFor));
  }
  for (const list of Object.values(byCategory)) {
    let next = list.reduce((max, row) => Math.max(max, row.rank || 0), 0);
    for (const row of list) {
      if (row.rank == null) {
        next += 1;
        row.rank = next;
      }
    }
  }

  const categories = [...CATEGORY_BY_ID.values()].map(meta => {
    const rows = byCategory[meta.id] || [];
    const scoredRows = rows.filter(row => row.score != null);
    let note = null;
    if (meta.source === "repo") {
      note = "Repo tooling from the catalog, not a DefiLlama protocol ranking. Ordered as in the catalog.";
    } else if (!scoredRows.length) {
      note = "No protocol cleared the TVL, fees, or volume floor in this category.";
    } else if ((categoryTotals[meta.id] || 0) > scoredRows.length) {
      note = `Top ${scoredRows.length} of ${categoryTotals[meta.id]} eligible rows by score.`;
    }
    return {
      ...meta,
      count: rows.length,
      scored: scoredRows.length,
      eligible: categoryTotals[meta.id] || 0,
      inTop200: overall.filter(row => row.category === meta.id).length,
      note,
    };
  });

  const monitored = overall.filter(row => row.coverage === MONITOR).length;
  const payload = {
    generatedAt,
    methodology: methodology(mentionResult.corpus),
    categories,
    overall,
    byCategory,
    stats: {
      protocolsSeen: protocols.length,
      eligibleProtocols: candidates.length,
      eligible: scored.length,
      overall: overall.length,
      dedicatedMonitor: monitored,
      rankingOnly: overall.length - monitored,
      newInTop200: overall.filter(row => row.isNew).length,
      historyMisses,
      mentionedNames: mentionResult.rows.length,
      excluded: excludedCounts,
    },
  };
  fs.mkdirSync(path.dirname(DATA_JSON), { recursive: true });
  fs.writeFileSync(DATA_JSON, `${JSON.stringify(payload, null, 1)}\n`);

  console.log(chalk.green(`\nWrote ${path.relative(ROOT, DATA_JSON)}`));
  console.log(
    chalk.gray(
      `eligible protocols ${candidates.length} → ${scored.length} rows · top ${overall.length}: ${monitored} with a monitor, ${overall.length - monitored} ranking only, ${payload.stats.newInTop200} new · history misses ${historyMisses}`
    )
  );
  if (unknownCategories.size) {
    console.log(chalk.yellow(`unmapped Llama categories (filed under other): ${[...unknownCategories].sort().join(", ")}`));
  }
  printRanked("Overall top 20", overall.slice(0, 20));
  for (const meta of categories) {
    const rows = (byCategory[meta.id] || []).filter(row => row.score != null).slice(0, 3);
    if (!rows.length) {
      console.log(chalk.yellow(`\n${meta.label}: ${meta.note || "empty"}`));
      continue;
    }
    printRanked(`${meta.label} top 3`, rows);
  }
  if (historyMisses > Math.max(10, historyTargets.length * 0.05)) {
    console.error(chalk.red(`too many history misses (${historyMisses}); the growth terms are unreliable`));
    process.exitCode = 1;
  }
}

function printRanked(title, rows) {
  console.log(chalk.cyan.bold(`\n${title}`));
  const table = createTable(["#", "Protocol", "Category", "TVL", "6m Δ", "6m added", "30d fees", "X", "Score"]);
  for (const row of rows) {
    let change = "—";
    if (row.isNew) change = `new (${row.ageDays}d)`;
    else if (row.tvlChange6m != null) change = `${row.tvlChange6m > 0 ? "+" : ""}${row.tvlChange6m.toFixed(1)}%`;
    table.push([
      row.rank ?? "—",
      row.name,
      categoryMeta(row.category).label,
      formatCurrency(row.tvl),
      change,
      row.tvlAdded6m == null ? "—" : formatCurrency(row.tvlAdded6m),
      formatCurrency(row.fees30d),
      row.xMentions || 0,
      row.score == null ? "—" : row.score.toFixed(3),
    ]);
  }
  console.log(table.toString());
}

main().catch(err => {
  console.error(chalk.red(err && err.stack ? err.stack : err));
  process.exit(1);
});
