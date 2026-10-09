/**
 * Top-200 trending DeFi protocols, plus per-category rankings.
 *
 *   npm run ranking:top200
 *   npm run showcase:build
 *
 * Free DefiLlama endpoints only (`api.llama.fi`). `/summary/derivatives` and
 * `pro-api.llama.fi` are not called.
 *
 * Score (higher is more "trending"):
 *
 *   size        = ln(sizeUsd / $1M)
 *                 sizeUsd is current TVL when TVL >= $5M, otherwise the
 *                 larger of 30d fees and 30d DEX volume
 *   tvlGrowth   = clamp(ln(tvlNow) - ln(max(tvlThen, $1M)), ln(0.2), ln(5))
 *                 tvlThen is the TVL sample on or just before 180 days ago.
 *                 A $0 or missing baseline contributes no growth term (a new
 *                 listing is not a 180-day trend). The $1M floor and the 5×
 *                 cap keep a dust starting point from outranking a large
 *                 protocol that actually doubled. Series younger than 30 days
 *                 contribute no growth term. A series that starts inside the
 *                 window uses its first sample (partial window).
 *   feesMom     = clamp(ln(fees30d) - ln(feesPrev30d), ln(0.2), ln(5))
 *                 fees and dailyRevenue are averaged when both exist
 *                 (30d vs the previous 30d on /overview/fees)
 *   volumeMom   = the same clamp on /overview/dexs 30d vs the previous 30d
 *
 *   Each of those four is a z-score across the eligible set (missing → 0,
 *   so a protocol without a fees adapter is not punished).
 *
 *   score = 0.34*z(size) + 0.46*z(tvlGrowth) + 0.12*z(feesMom) + 0.08*z(volumeMom)
 *           + 0.04 * min(xMentions, 6)
 *
 *   The mention term caps at +0.24. A z-score term is typically order 1, so
 *   size and 6-month growth still decide the order.
 *
 * Eligibility: current TVL >= $5M, or (below that) 30d fees >= $100k, or
 * 30d DEX volume >= $5M. CEX and Ponzi rows are omitted. One failed protocol
 * history fetch is a warning; the process exits non-zero only when /protocols
 * itself fails.
 *
 * X mentions: set X_MENTIONS_DIR to a directory of markdown notes to recount
 * and rewrite data/x-mentions.json. Otherwise the committed file is reused.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const {
  fetchLlamaProtocols,
  fetchLlamaJson,
  fetchDefiLlamaProtocol,
  tvlBaseline,
} = require("../utils/defiLlamaProtocol");
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
const { buildCoverageIndex, linkCatalog, scriptNames, MONITOR, RANKING_ONLY } = require("./coverage");

const ROOT = path.resolve(__dirname, "../../..");
const DATA_JSON = path.join(ROOT, "showcase", "data.json");
const MENTIONS_JSON = path.join(ROOT, "data", "x-mentions.json");

const MIN_TVL_USD = 5_000_000;
const MIN_FEES_30D_USD = 100_000;
const MIN_VOLUME_30D_USD = 5_000_000;
const TVL_LOG_FLOOR_USD = 1_000_000;
const WINDOW_DAYS = 180;
const MIN_GROWTH_DAYS = 30;
const TOP_N = 200;
const WEIGHTS = { size: 0.34, tvlGrowth: 0.46, feesMomentum: 0.12, volumeMomentum: 0.08 };
const MENTION_CAP = 6;
const MENTION_STEP = 0.04;
const MOMENTUM_MIN = Math.log(0.2);
const MOMENTUM_MAX = Math.log(5);
const GROWTH_MIN = MOMENTUM_MIN;
const GROWTH_MAX = MOMENTUM_MAX;
const HISTORY_CONCURRENCY = Math.max(1, parseInt(process.env.RANKING_CONCURRENCY || "4", 10) || 4);

if (!process.env.DEFILLAMA_TIMEOUT_MS) process.env.DEFILLAMA_TIMEOUT_MS = "90000";

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundTo(value, places) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
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

function indexOverview(rows) {
  const bySlug = new Map();
  const byId = new Map();
  for (const row of rows) {
    const slug = row && row.slug ? String(row.slug) : "";
    if (slug) {
      const prev = bySlug.get(slug);
      if (!prev || (num(row.total30d) || 0) > (num(prev.total30d) || 0)) bySlug.set(slug, row);
    }
    if (row && row.defillamaId != null) {
      const id = String(row.defillamaId);
      const prev = byId.get(id);
      if (!prev || (num(row.total30d) || 0) > (num(prev.total30d) || 0)) byId.set(id, row);
    }
  }
  return { bySlug, byId };
}

function lookupOverview(index, protocol) {
  if (!index) return null;
  return index.bySlug.get(protocol.slug) || index.byId.get(String(protocol.id)) || null;
}

function momentum(current, prior) {
  const now = num(current);
  const then = num(prior);
  if (now == null || then == null || then <= 0 || now < 0) return null;
  const raw = Math.log(now + 1) - Math.log(then + 1);
  return Math.min(MOMENTUM_MAX, Math.max(MOMENTUM_MIN, raw));
}

function blendMomentum(a, b) {
  if (a != null && b != null) return (a + b) / 2;
  return a != null ? a : b;
}

function zScores(values) {
  const present = values.filter(value => value != null && Number.isFinite(value));
  if (present.length < 2) return values.map(() => 0);
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  const variance = present.reduce((sum, value) => sum + (value - mean) ** 2, 0) / present.length;
  const std = Math.sqrt(variance);
  if (std < 1e-9) return values.map(() => 0);
  return values.map(value => (value == null || !Number.isFinite(value) ? 0 : (value - mean) / std));
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
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      if (idx > 0) await sleep(50);
      out[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

async function fetchHistory(slug) {
  const waits = [0, 600, 1800, 4000];
  let lastError = null;
  for (let attempt = 0; attempt < waits.length; attempt += 1) {
    if (waits[attempt]) await sleep(waits[attempt]);
    try {
      const data = await fetchDefiLlamaProtocol(slug);
      return data && Array.isArray(data.tvl) ? data.tvl : null;
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

function robustGrowth(tvlNow, baseline) {
  if (tvlNow == null || baseline == null || tvlNow <= 0 || baseline <= 0) return { log: null, pct: null };
  const base = Math.max(baseline, TVL_LOG_FLOOR_USD);
  const raw = Math.log(tvlNow) - Math.log(base);
  const log = Math.min(GROWTH_MAX, Math.max(GROWTH_MIN, raw));
  return {
    log,
    pct: (Math.exp(log) - 1) * 100,
    rawPct: ((tvlNow - base) / base) * 100,
  };
}

function mentionIndex(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = String(row.name || "").toLowerCase();
    const prev = byName.get(key);
    if (!prev || row.count > prev.count) byName.set(key, row);
  }
  return byName;
}

function mentionsFor(protocol, byName) {
  const row = byName.get(String(protocol.name || "").toLowerCase());
  return row ? row.count : 0;
}

function compareScore(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  const tvlA = a.tvl || 0;
  const tvlB = b.tvl || 0;
  if (tvlA !== tvlB) return tvlB - tvlA;
  return String(a.slug).localeCompare(String(b.slug));
}

function toOutputRow(row, rank, overallRank) {
  return {
    rank,
    overallRank,
    name: row.name,
    slug: row.slug,
    category: row.category,
    tvl: row.tvl == null ? null : Math.round(row.tvl),
    tvl6mAgo: row.tvl6mAgo == null ? null : Math.round(row.tvl6mAgo),
    tvlChange6m: roundTo(row.tvlChange6m, 2),
    tvlChange6mRaw: roundTo(row.tvlChange6mRaw, 2),
    tvlWindowDays: row.tvlWindowDays,
    fees30d: row.fees30d == null ? null : Math.round(row.fees30d),
    xMentions: row.xMentions || 0,
    llamaUrl: row.llamaUrl,
    scripts: row.scripts,
    coverage: row.coverage,
    score: roundTo(row.score, 4),
  };
}

function catalogExtra(entry, mentionByName) {
  const metaName = entry.name;
  const mention = mentionByName.get(String(metaName).toLowerCase());
  return {
    rank: null,
    overallRank: null,
    name: entry.name,
    slug: entry.id,
    category: entry.category || entry.group,
    tvl: null,
    tvl6mAgo: null,
    tvlChange6m: null,
    tvlWindowDays: null,
    fees30d: null,
    xMentions: mention ? mention.count : 0,
    llamaUrl: null,
    scripts: scriptNames(entry),
    coverage: MONITOR,
    score: null,
  };
}

function methodology() {
  return {
    windowDays: WINDOW_DAYS,
    weights: WEIGHTS,
    mentionBonus: `min(count, ${MENTION_CAP}) * ${MENTION_STEP} added after the weighted z-scores (max +${MENTION_CAP * MENTION_STEP})`,
    floors: {
      minTvlUsd: MIN_TVL_USD,
      minFees30dUsd: MIN_FEES_30D_USD,
      minVolume30dUsd: MIN_VOLUME_30D_USD,
      tvlLogFloorUsd: TVL_LOG_FLOOR_USD,
      minGrowthDays: MIN_GROWTH_DAYS,
    },
    endpoints: [
      "GET /protocols",
      "GET /protocol/{slug} (eligible TVL rows only; cached in-process)",
      "GET /overview/fees",
      "GET /overview/fees?dataType=dailyRevenue",
      "GET /overview/dexs",
    ],
    excluded: ["CEX and Ponzi rows are omitted from the scored ranking."],
    summary:
      "Trending score is a weighted z-score of log TVL size (0.34), robust 180-day log TVL growth (0.46), " +
      "30-day fees/revenue momentum (0.12) and 30-day DEX volume momentum (0.08), plus a capped X-mention bonus. " +
      "Growth uses ln(now) - ln(max(then, $1M)), clamped to a 0.2×–5× move, and a $0 baseline is omitted. " +
      "Protocols need about $5M TVL, or $100k of 30-day fees, or $5M of 30-day volume. " +
      "Market boards and swap tooling are repo catalog entries, not Llama protocols.",
  };
}

async function main() {
  installCliSafeStdout();
  const generatedAt = new Date().toISOString();
  console.log(
    chalk.cyan("Fetching DefiLlama /protocols, /overview/fees, /overview/fees?dataType=dailyRevenue, /overview/dexs")
  );

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

  const feesQuery = "excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  const [feesBody, revenueBody, dexBody] = await Promise.all([
    fetchOverview(`/overview/fees?${feesQuery}`, "fees overview"),
    fetchOverview(`/overview/fees?${feesQuery}&dataType=dailyRevenue`, "revenue overview"),
    fetchOverview(`/overview/dexs?${feesQuery}`, "dex volume overview"),
  ]);
  const feesIndex = indexOverview(overviewRows(feesBody));
  const revenueIndex = indexOverview(overviewRows(revenueBody));
  const dexIndex = indexOverview(overviewRows(dexBody));

  const catalog = buildCatalog();
  const coverage = buildCoverageIndex(catalog);
  const unknownCategories = new Set();

  const candidates = [];
  for (const protocol of protocols) {
    if (!protocol || !protocol.slug || !protocol.name) continue;
    if (EXCLUDED_LLAMA_CATEGORIES.has(protocol.category)) continue;
    const link = linkCatalog(protocol, coverage);
    const category = resolveCategory(protocol, link);
    if (protocol.category && !LLAMA_TO_CATEGORY[protocol.category] && !SLUG_OVERRIDES[protocol.slug]) {
      unknownCategories.add(protocol.category);
    }
    const tvl = num(protocol.tvl);
    const feesRow = lookupOverview(feesIndex, protocol);
    const revenueRow = lookupOverview(revenueIndex, protocol);
    const dexRow = lookupOverview(dexIndex, protocol);
    const fees30d = feesRow ? num(feesRow.total30d) : null;
    const feesPrev = feesRow ? num(feesRow.total60dto30d) : null;
    const rev30d = revenueRow ? num(revenueRow.total30d) : null;
    const revPrev = revenueRow ? num(revenueRow.total60dto30d) : null;
    const volume30d = dexRow ? num(dexRow.total30d) : null;
    const volumePrev = dexRow ? num(dexRow.total60dto30d) : null;
    const tvlOk = tvl != null && tvl >= MIN_TVL_USD;
    const feesOk = fees30d != null && fees30d >= MIN_FEES_30D_USD;
    const volumeOk = volume30d != null && volume30d >= MIN_VOLUME_30D_USD;
    if (!tvlOk && !feesOk && !volumeOk) continue;
    candidates.push({
      protocol,
      link,
      category,
      tvl,
      fees30d,
      feesMom: blendMomentum(momentum(fees30d, feesPrev), momentum(rev30d, revPrev)),
      volume30d,
      volumeMom: momentum(volume30d, volumePrev),
      needsHistory: tvlOk,
    });
  }

  candidates.sort((a, b) => a.protocol.slug.localeCompare(b.protocol.slug));
  const historyTargets = candidates.filter(row => row.needsHistory);
  console.log(
    chalk.gray(
      `${protocols.length} protocols, ${candidates.length} eligible, ${historyTargets.length} history fetches (concurrency ${HISTORY_CONCURRENCY})`
    )
  );

  const historyCache = new Map();
  let historyMisses = 0;
  let finished = 0;
  await mapPool(historyTargets, HISTORY_CONCURRENCY, async row => {
    const slug = row.protocol.slug;
    if (historyCache.has(slug)) return;
    const series = await fetchHistory(slug);
    historyCache.set(slug, series);
    if (!series) historyMisses += 1;
    finished += 1;
    if (finished % 25 === 0 || finished === historyTargets.length) {
      console.error(chalk.gray(`history ${finished}/${historyTargets.length}`));
    }
  });

  const mentionDir = process.env.X_MENTIONS_DIR;
  let mentionRows = [];
  if (mentionDir && fs.existsSync(mentionDir)) {
    const mentionProtocols = candidates.map(row => ({ name: row.protocol.name, slug: row.protocol.slug }));
    for (const entry of [...catalog.protocols, ...catalog.boards]) {
      mentionProtocols.push({ name: entry.name, slug: entry.id });
    }
    mentionRows = countProtocolMentions(mentionDir, mentionProtocols);
    fs.mkdirSync(path.dirname(MENTIONS_JSON), { recursive: true });
    fs.writeFileSync(MENTIONS_JSON, `${JSON.stringify(toPublicMentions(mentionRows, generatedAt), null, 2)}\n`);
    console.log(chalk.gray(`wrote ${path.relative(ROOT, MENTIONS_JSON)} (${mentionRows.length} names)`));
  } else if (fs.existsSync(MENTIONS_JSON)) {
    mentionRows = loadPublicMentions(MENTIONS_JSON).map(row => ({ ...row, slug: null }));
    console.log(chalk.gray(`reused ${path.relative(ROOT, MENTIONS_JSON)} (${mentionRows.length} names)`));
  } else {
    console.warn(chalk.yellow("warning: no X notes directory and no data/x-mentions.json; mention bonus is 0"));
  }
  const byMention = mentionIndex(mentionRows);

  const scored = candidates.map(row => {
    const series = historyCache.get(row.protocol.slug);
    const baseline = series ? tvlBaseline(series, WINDOW_DAYS) : null;
    let tvl6mAgo = null;
    let tvlWindowDays = null;
    let growthLog = null;
    let tvlChange6m = null;
    let tvlChange6mRaw = null;
    if (baseline && row.tvl != null) {
      const young = baseline.partial && baseline.windowDays < MIN_GROWTH_DAYS;
      tvlWindowDays = baseline.windowDays;
      if (!young) {
        tvl6mAgo = baseline.past != null ? baseline.past : baseline.first;
        const growth = robustGrowth(row.tvl, tvl6mAgo);
        growthLog = growth.log;
        tvlChange6m = growth.pct;
        tvlChange6mRaw = growth.rawPct;
      }
    }
    const sizeUsd =
      row.tvl != null && row.tvl >= MIN_TVL_USD ? row.tvl : Math.max(row.fees30d || 0, row.volume30d || 0);
    const sizeLog = sizeUsd > 0 ? Math.log(sizeUsd / 1e6) : null;
    const scripts = scriptNames(row.link);
    return {
      name: row.protocol.name,
      slug: row.protocol.slug,
      category: row.category,
      tvl: row.tvl,
      tvl6mAgo,
      tvlChange6m,
      tvlChange6mRaw,
      tvlWindowDays,
      fees30d: row.fees30d,
      xMentions: mentionsFor(row.protocol, byMention),
      llamaUrl: `https://defillama.com/protocol/${encodeURIComponent(row.protocol.slug)}`,
      scripts,
      coverage: scripts.length ? MONITOR : RANKING_ONLY,
      sizeLog,
      growthLog,
      feesMom: row.feesMom,
      volumeMom: row.volumeMom,
      catalogId: row.link ? row.link.id : null,
    };
  });

  const sizeZ = zScores(scored.map(row => row.sizeLog));
  const growthZ = zScores(scored.map(row => row.growthLog));
  const feesZ = zScores(scored.map(row => row.feesMom));
  const volumeZ = zScores(scored.map(row => row.volumeMom));
  for (let i = 0; i < scored.length; i += 1) {
    const mentionBonus = MENTION_STEP * Math.min(scored[i].xMentions || 0, MENTION_CAP);
    scored[i].score =
      WEIGHTS.size * sizeZ[i] +
      WEIGHTS.tvlGrowth * growthZ[i] +
      WEIGHTS.feesMomentum * feesZ[i] +
      WEIGHTS.volumeMomentum * volumeZ[i] +
      mentionBonus;
  }

  scored.sort(compareScore);
  const overall = scored.slice(0, TOP_N).map((row, index) => toOutputRow(row, index + 1, index + 1));
  const overallRankBySlug = new Map(overall.map(row => [row.slug, row.rank]));

  const matchedCatalogIds = new Set(scored.map(row => row.catalogId).filter(Boolean));
  const byCategory = {};
  for (const [id] of CATEGORY_BY_ID) byCategory[id] = [];

  for (const row of scored) {
    const list = byCategory[row.category] || (byCategory[row.category] = []);
    const overallRank = overallRankBySlug.get(row.slug) || null;
    list.push(toOutputRow(row, list.length + 1, overallRank));
  }

  for (const entry of catalog.protocols) {
    if (matchedCatalogIds.has(entry.id)) continue;
    const extra = catalogExtra(entry, byMention);
    const list = byCategory[extra.category] || (byCategory[extra.category] = []);
    list.push(extra);
  }

  for (const entry of BOARDS) {
    const group = entry.group === "tooling" ? "tooling" : "boards";
    byCategory[group].push(catalogExtra(entry, byMention));
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
    }
    return { ...meta, count: rows.length, scored: scoredRows.length, note };
  });

  const monitored = overall.filter(row => row.coverage === MONITOR).length;
  const payload = {
    generatedAt,
    methodology: methodology(),
    categories,
    overall,
    byCategory,
    stats: {
      protocolsSeen: protocols.length,
      eligible: scored.length,
      overall: overall.length,
      dedicatedMonitor: monitored,
      rankingOnly: overall.length - monitored,
      historyMisses,
      mentionedNames: mentionRows.length,
    },
  };

  fs.mkdirSync(path.dirname(DATA_JSON), { recursive: true });
  fs.writeFileSync(DATA_JSON, `${JSON.stringify(payload, null, 2)}\n`);

  const monitoredEligible = scored.filter(row => row.coverage === MONITOR).length;
  console.log(chalk.green(`\nWrote ${path.relative(ROOT, DATA_JSON)}`));
  console.log(
    chalk.gray(
      `eligible ${scored.length} · top ${overall.length} · monitors in top ${overall.length}: ${monitored} · ranking only: ${overall.length - monitored} · eligible with a monitor: ${monitoredEligible} · history misses: ${historyMisses}`
    )
  );
  if (unknownCategories.size) {
    console.log(
      chalk.gray(`unmapped Llama categories (filed under other): ${[...unknownCategories].sort().join(", ")}`)
    );
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
}

function printRanked(title, rows) {
  console.log(chalk.cyan.bold(`\n${title}`));
  const table = createTable(["#", "Protocol", "Category", "TVL", "6m Δ", "30d fees", "X"]);
  for (const row of rows) {
    const change = row.tvlChange6m == null ? "—" : `${row.tvlChange6m > 0 ? "+" : ""}${row.tvlChange6m.toFixed(1)}%`;
    table.push([
      row.rank ?? "—",
      row.name,
      categoryMeta(row.category).label,
      formatCurrency(row.tvl),
      change,
      formatCurrency(row.fees30d),
      row.xMentions || 0,
    ]);
  }
  console.log(table.toString());
}

main().catch(err => {
  console.error(chalk.red(err && err.stack ? err.stack : err));
  process.exit(1);
});
