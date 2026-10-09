/**
 * Count how many distinct X posts from the user's lists mention each ranked
 * protocol.
 *
 * Input is a directory (X_MENTIONS_DIR) of list reads:
 *   - raw post JSON: an array of posts, `{ posts: [...] }`, or the X API
 *     `{ data: [...] }` shape. A post needs an `id` and `text`; the list comes
 *     from the post (`list`), the file (`list`), or the file name.
 *   - markdown list notes: only lines that carry an `x.com/<user>/status/<id>`
 *     link count, filed under the nearest `## <list>` heading.
 * Files whose name starts with `daily-` are skipped: those are this repo's own
 * claim write-ups, and counting them would reward protocols for already having
 * a monitor.
 *
 * Posts are de-duplicated by status id, so the same post read on two days, or
 * on two lists, counts once. A protocol scores one mention per post no matter
 * how many times the post names it.
 *
 * Matching is on word boundaries (letters and digits), so "Aave" does not hit
 * "Aavegotchi". Names that are ordinary English words, or four letters or
 * fewer, match case-sensitively only (Title case, ALL CAPS, or a $TICKER), so
 * "lighter fees" or "a sky-high APY" do not count for Lighter or Sky. Category
 * words such as "swap" or "bridge", and names that are too generic even when
 * capitalised ("World", "Quote", "Exactly"), are never used as a pattern.
 *
 * The committed file keeps only id, name, count, last-seen date and list
 * names. No post text.
 */

const fs = require("fs");
const path = require("path");

/** Extra names the lists use for a Llama slug. Only unambiguous ones. */
const MENTION_ALIASES = {
  eigencloud: ["EigenLayer", "EigenCloud"],
  "ether.fi-stake": ["ether.fi", "etherfi", "weETH", "eETH"],
  "ethena-usde": ["Ethena", "USDe", "sUSDe"],
  "sky-lending": ["MakerDAO", "USDS"],
  "polymarket-international": ["Polymarket"],
  "polymarket-us": ["Polymarket"],
  "hyperliquid-perps": ["Hyperliquid", "HLP"],
  "hyperliquid-hlp": ["Hyperliquid", "HLP"],
  "gmx-v2-perps": ["GMX"],
  "gmx-v1-perps": ["GMX"],
  "pendle-v2": ["Pendle"],
  "jito-liquid-staking": ["Jito", "JitoSOL"],
  "raydium-amm": ["Raydium"],
  "meteora-dlmm": ["Meteora"],
  "pump.fun": ["pumpfun", "pump.fun"],
  "curve-dex": ["Curve Finance"],
  lido: ["stETH", "wstETH"],
  "morpho-blue": ["Morpho"],
  sparklend: ["SparkLend"],
  "blackrock-buidl": ["BUIDL"],
  "ondo-global-markets": ["Ondo"],
  "near-intents": ["NEAR Intents"],
  "pancakeswap-amm": ["PancakeSwap"],
  "pancakeswap-amm-v3": ["PancakeSwap"],
  "rocket-pool": ["rETH"],
  cowswap: ["CoW Swap", "CowSwap", "CoW Protocol"],
  "1inch-swap": ["1inch"],
  "kamino-lend": ["Kamino"],
  "drift-trade": ["Drift Protocol"],
  "lighter-perps": ["Lighter"],
  "derive-v3-options": ["Derive"],
  "aerodrome-slipstream": ["Aerodrome"],
  "aerodrome-v1": ["Aerodrome"],
  "velodrome-v2": ["Velodrome"],
  "sushiswap-v3": ["SushiSwap"],
  "robinhood-chain-bridge": ["Robinhood Chain"],
  "usd-ai": ["USD.AI", "USDai"],
  "sentora-curator": ["Sentora"],
  "steakhouse-financial": ["Steakhouse"],
  "gains-network": ["gTrade"],
  "puffer-stake": ["Puffer"],
  "swell-liquid-restaking": ["Swell"],
  "bedrock-unieth": ["Bedrock"],
  "kinetiq-khype": ["Kinetiq", "kHYPE"],
};

/** Single tokens that are category words, not a protocol. */
const GENERIC_PATTERNS = new Set([
  "yield", "farm", "swap", "bridge", "chain", "dex", "interface", "services", "index", "vault", "pool",
  "pools", "market", "markets", "token", "finance", "protocol", "network", "app", "labs", "exchange",
  "defi", "nft", "rwa", "tvl", "amm", "eth", "btc", "sol", "usdc", "usdt", "dai", "usd", "staking",
  "lending", "perps", "options", "stake", "earn", "liquid", "money", "cash", "pay", "wallet", "bank",
  "capital", "fund", "base", "core", "one", "prime", "x", "v2", "v3", "v4",
]);

/** Protocol names that are also ordinary words: case-sensitive matching only. */
const COMMON_WORDS = new Set([
  "abstract", "across", "arc", "aura", "axis", "balance", "blast", "bounce", "circle", "compound",
  "concrete", "core", "curve", "derive", "drift", "echo", "ember", "euler", "fables", "fluid", "frax",
  "gearbox", "harvest", "hop", "infinity", "ink", "instadapp", "jupiter", "kelp", "level", "lighter",
  "linea", "liquity", "maple", "mantle", "mode", "morph", "noble", "noon", "orbit", "orca", "origin",
  "papertrade", "portal", "proxy", "radiant", "river", "scroll", "silo", "sky", "solstice", "sonic",
  "spark", "spectra", "strata", "superform", "swell", "symbiotic", "treehouse", "unit", "venus",
  "wrapped", "yearn", "zircuit",
]);

/** Names too generic to count at all, even capitalised ("World", "Quote", "Exactly"). */
const NEVER_MATCH = new Set(["world", "quote", "monster", "fomo", "exactly", "bend", "opinion", "re", "unit", "notional"]);

/** File-name stems from the X list reads → list display name. */
const LIST_NAMES = {
  airdrop: "Airdrop?",
  "01-airdrop": "Airdrop?",
  "dev-alpha-mev-kol": "Dev Alpha",
  "02-dev-alpha": "Dev Alpha",
  "inner-circle-ct": "Inner Circle CT",
  "03-inner-circle": "Inner Circle CT",
  "mev-gigachads": "mev gigachads",
  "04-mev-gigachads": "mev gigachads",
  "mev-twitter": "mev twitter",
  "05-mev-twitter": "mev twitter",
  "on-chain": "ON CHAIN",
  "06-on-chain": "ON CHAIN",
  "privacy-dashboard-update": "Privacy dashboard update",
  "07-privacy-dashboard": "Privacy dashboard update",
  "privacy-x-web3-projects": "Privacy x web3 projects",
  "08-privacy-web3": "Privacy x web3 projects",
  "smart-contract-security": "Smart Contract Security",
  "09-smart-contract-security": "Smart Contract Security",
};

const LIST_ALIASES = {
  Airdrop: "Airdrop?",
  "Dev Alpha / MEV KOL": "Dev Alpha",
  "Dev Alpha/MEV KOL": "Dev Alpha",
};

function canonicalList(name) {
  const text = String(name || "").trim();
  return LIST_ALIASES[text] || text || "unknown list";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(word) {
  return word.replace(/(^|[\s-])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

/**
 * @param {string} raw display form, e.g. "Lighter" or "aave v3"
 * @returns {RegExp[]}
 */
function compilePatterns(raw) {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();
  if (lower.length < 3 || GENERIC_PATTERNS.has(lower) || NEVER_MATCH.has(lower)) return [];
  const strict = COMMON_WORDS.has(lower) || lower.replace(/[^a-z0-9]/g, "").length <= 4;
  const edge = body => `(?<![a-z0-9])${body}(?![a-z0-9])`;
  if (!strict) return [new RegExp(edge(escapeRegExp(lower)), "gi")];
  const forms = new Set([text, titleCase(lower), lower.toUpperCase()]);
  if (text === lower) forms.delete(text);
  return [...forms]
    .filter(form => /[A-Z]/.test(form))
    .map(form => new RegExp(`(?<![A-Za-z0-9])\\$?${escapeRegExp(form)}(?![A-Za-z0-9])`, "g"));
}

/**
 * @param {{ names: string[], slugs: string[] }} target
 */
function patternsFor(target) {
  const candidates = [];
  for (const name of target.names || []) candidates.push(name);
  for (const slug of target.slugs || []) {
    candidates.push(slug.replace(/-/g, " "));
    candidates.push(...(MENTION_ALIASES[slug] || []));
  }
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const key = String(candidate || "").trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(...compilePatterns(key));
  }
  return out;
}

function hits(text, regexes) {
  for (const re of regexes) {
    re.lastIndex = 0;
    if (re.test(text)) return true;
  }
  return false;
}

function isoDay(value) {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function postsFromJson(file, parsed) {
  const stem = path.basename(file, ".json").replace(/^\d{4}-\d{2}-\d{2}__/, "");
  const fileList = parsed && !Array.isArray(parsed) && parsed.list ? parsed.list : LIST_NAMES[stem] || stem;
  let rows = [];
  if (Array.isArray(parsed)) rows = parsed;
  else if (parsed && Array.isArray(parsed.posts)) rows = parsed.posts;
  else if (parsed && Array.isArray(parsed.data)) rows = parsed.data;
  const out = [];
  for (const row of rows) {
    if (!row || !row.text) continue;
    const id = row.id ? String(row.id) : (String(row.url || "").match(/status\/(\d+)/) || [])[1];
    if (!id) continue;
    out.push({
      id,
      list: canonicalList(row.list || fileList),
      date: isoDay(row.created_at || row.t || row.date),
      text: String(row.text),
    });
  }
  return out;
}

function postsFromMarkdown(text) {
  const out = [];
  let list = "x lists";
  for (const line of text.split(/\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      list = canonicalList(heading[1].replace(/\s*\(.*\)\s*$/, ""));
      continue;
    }
    const status = line.match(/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)/);
    if (!status) continue;
    out.push({ id: status[1], list, date: isoDay(line), text: line });
  }
  return out;
}

/**
 * @param {string} dir
 * @returns {{ id: string, lists: string[], date: string|null, text: string }[]}
 */
function readPosts(dir) {
  const byId = new Map();
  const files = fs
    .readdirSync(dir)
    .filter(name => !name.startsWith("daily-") && (name.endsWith(".json") || name.endsWith(".md")))
    .sort();
  for (const name of files) {
    const file = path.join(dir, name);
    const raw = fs.readFileSync(file, "utf8");
    let posts = [];
    if (name.endsWith(".json")) {
      try {
        posts = postsFromJson(file, JSON.parse(raw));
      } catch (err) {
        console.warn(`warning: skip ${name} (${err.message})`);
      }
    } else {
      posts = postsFromMarkdown(raw);
    }
    for (const post of posts) {
      const prev = byId.get(post.id);
      if (!prev) {
        byId.set(post.id, { id: post.id, lists: new Set([post.list]), date: post.date, text: post.text });
        continue;
      }
      prev.lists.add(post.list);
      if (!prev.date && post.date) prev.date = post.date;
      // Raw post text beats a note line that only paraphrases it.
      if (post.text.length > prev.text.length) prev.text = post.text;
    }
  }
  return [...byId.values()].map(post => ({ ...post, lists: [...post.lists].sort() }));
}

/**
 * @param {string} dir
 * @param {Array<{ id: string, name: string, names: string[], slugs: string[] }>} targets
 */
function countProtocolMentions(dir, targets) {
  const posts = readPosts(dir);
  const rows = [];
  for (const target of targets) {
    const regexes = patternsFor(target);
    if (!regexes.length) continue;
    let count = 0;
    let lastSeen = null;
    const lists = new Set();
    for (const post of posts) {
      if (!hits(post.text, regexes)) continue;
      count += 1;
      post.lists.forEach(list => lists.add(list));
      if (post.date && (!lastSeen || post.date > lastSeen)) lastSeen = post.date;
    }
    if (count > 0) {
      rows.push({ id: target.id, name: target.name, count, lastSeen, lists: [...lists].sort() });
    }
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const dates = posts.map(post => post.date).filter(Boolean).sort();
  const listNames = new Set();
  posts.forEach(post => post.lists.forEach(list => listNames.add(list)));
  return {
    rows,
    corpus: {
      posts: posts.length,
      from: dates[0] || null,
      to: dates[dates.length - 1] || null,
      lists: [...listNames].sort(),
    },
  };
}

/** Public file shape: no post text. */
function toPublicMentions(result, generatedAt) {
  return {
    generatedAt,
    corpus: result.corpus,
    protocols: result.rows.map(row => ({
      id: row.id,
      name: row.name,
      count: row.count,
      lastSeen: row.lastSeen,
      lists: row.lists,
    })),
  };
}

function loadPublicMentions(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const protocols = Array.isArray(parsed) ? parsed : parsed.protocols || [];
  return {
    corpus: (parsed && parsed.corpus) || null,
    rows: protocols
      .filter(row => row && row.name && row.count > 0)
      .map(row => ({
        id: row.id || null,
        name: row.name,
        count: row.count,
        lastSeen: row.lastSeen || null,
        lists: Array.isArray(row.lists) ? row.lists : [],
      })),
  };
}

module.exports = {
  MENTION_ALIASES,
  COMMON_WORDS,
  compilePatterns,
  patternsFor,
  readPosts,
  countProtocolMentions,
  toPublicMentions,
  loadPublicMentions,
};
