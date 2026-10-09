/**
 * Count protocol names in local markdown research notes (X list reads and
 * daily claim files). The committed file keeps only name, count, last-seen
 * date and list names — not post text.
 *
 * Match is case-insensitive on the protocol name, the slug (hyphens as
 * spaces), and a small alias map. Word boundaries are letters and digits, so
 * "Aave" does not match "Aavegotchi".
 */

const fs = require("fs");
const path = require("path");

/** Extra names that the notes use for a slug. Kept small on purpose. */
const MENTION_ALIASES = {
  "aave-v2": ["Aave"],
  "aave-v3": ["Aave"],
  "aave-v4": ["Aave"],
  "aave-horizon-rwa": ["Aave"],
  eigencloud: ["EigenLayer", "EigenCloud"],
  "ether.fi-stake": ["ether.fi", "etherfi"],
  "ether.fi-liquid": ["ether.fi", "etherfi"],
  "ethena-usde": ["Ethena", "USDe"],
  "sky-lending": ["Sky", "MakerDAO"],
  "polymarket-international": ["Polymarket"],
  "polymarket-us": ["Polymarket"],
  "hyperliquid-hlp": ["Hyperliquid"],
  "hyperliquid-perps": ["Hyperliquid"],
  "gmx-v2-perps": ["GMX"],
  "gmx-v1-perps": ["GMX"],
  "pendle-v2": ["Pendle"],
  "jito-liquid-staking": ["Jito"],
  "raydium-amm": ["Raydium"],
  "meteora-dlmm": ["Meteora"],
  "pump.fun": ["pumpfun", "pump.fun"],
  "uniswap-v2": ["Uniswap"],
  "uniswap-v3": ["Uniswap"],
  "uniswap-v4": ["Uniswap"],
  "curve-dex": ["Curve"],
  lido: ["stETH"],
  "morpho-blue": ["Morpho"],
  sparklend: ["Spark"],
  "blackrock-buidl": ["BUIDL"],
  "ondo-global-markets": ["Ondo"],
  "ondo-yield-assets": ["Ondo"],
  "near-intents": ["NEAR Intents"],
  "pancakeswap-amm": ["PancakeSwap"],
  "pancakeswap-amm-v3": ["PancakeSwap"],
  "rocket-pool": ["Rocket Pool"],
  wbtc: ["WBTC"],
  cowswap: ["CoW Swap", "CowSwap"],
  "1inch-swap": ["1inch"],
  "jupiter-lend": ["Jupiter"],
  "kamino-lend": ["Kamino"],
  "drift-trade": ["Drift"],
  "lighter-perps": ["Lighter"],
  "lighter-robinhood-perps": ["Lighter"],
  "derive-v3-options": ["Derive"],
  "derive-options": ["Derive"],
  "aerodrome-slipstream": ["Aerodrome"],
  "aerodrome-v1": ["Aerodrome"],
  "velodrome-v2": ["Velodrome"],
  sushiswap: ["Sushi"],
  "sushiswap-v3": ["SushiSwap", "Sushi"],
  "balancer-v2": ["Balancer"],
  "robinhood-chain-bridge": ["Robinhood Chain"],
  "usd-ai": ["USD.AI", "USDai"],
  "sentora-curator": ["Sentora"],
  "steakhouse-financial": ["Steakhouse"],
  "fluid-dex": ["Fluid"],
  "fluid-lending": ["Fluid"],
  "blast-bridge": ["Blast"],
  "gains-network": ["Gains Network", "gTrade"],
  variational: ["Variational"],
  ostium: ["Ostium"],
  synthetix: ["Synthetix"],
  concrete: ["Concrete"],
  upshift: ["Upshift"],
  renzo: ["Renzo"],
  kelp: ["Kelp"],
  "puffer-stake": ["Puffer"],
  "swell-liquid-restaking": ["Swell"],
  "bedrock-unieth": ["Bedrock"],
  "spark-liquidity-layer": ["Spark"],
};

/**
 * Single tokens that are category words, not a protocol. A longer name or
 * slug that merely contains one of these still matches.
 */
const GENERIC_PATTERNS = new Set([
  "yield",
  "farm",
  "swap",
  "bridge",
  "chain",
  "dex",
  "interface",
  "services",
  "index",
  "vault",
  "pool",
  "market",
  "token",
  "finance",
  "protocol",
  "network",
  "app",
  "labs",
  "exchange",
  "defi",
  "nft",
  "rwa",
  "tvl",
  "amm",
  "eth",
  "btc",
  "sol",
  "usdc",
  "usdt",
  "dai",
  "usd",
]);

const WINDOW_START = "2026-09-28";
const WINDOW_END = "2026-10-09";
const JUNK_HEADING =
  /^(meta|counts|ship|shipped|skipped|inputs|coverage note|claims shipped|claims to ship.*|backlog.*|top build.*|suggested next.*|[a-d]\)\s.*)$/i;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePattern(raw) {
  const text = String(raw || "")
    .trim()
    .toLowerCase();
  if (text.length < 3) return null;
  if (GENERIC_PATTERNS.has(text)) return null;
  const body = escapeRegExp(text);
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "gi");
}

function patternsFor(protocol) {
  const slug = protocol.slug || "";
  const candidates = [
    protocol.name,
    slug,
    slug.replace(/-/g, " "),
    ...(MENTION_ALIASES[slug] || []),
    ...(protocol.aliases || []),
  ];
  const seen = new Set();
  const compiled = [];
  for (const candidate of candidates) {
    const key = String(candidate || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const re = compilePattern(key);
    if (re) compiled.push(re);
  }
  return compiled;
}

function countMatches(text, regexes) {
  const starts = new Set();
  for (const re of regexes) {
    re.lastIndex = 0;
    let match = re.exec(text);
    while (match) {
      starts.add(match.index);
      if (match[0].length === 0) re.lastIndex += 1;
      match = re.exec(text);
    }
  }
  return starts.size;
}

function lineDate(line, fallback) {
  const found = String(line).match(/\d{4}-\d{2}-\d{2}/g) || [];
  const inWindow = found.filter(date => date >= WINDOW_START && date <= WINDOW_END).sort();
  if (inWindow.length) return inWindow[inWindow.length - 1];
  if (fallback && fallback >= WINDOW_START && fallback <= WINDOW_END) return fallback;
  return fallback || null;
}

/**
 * Split a note into blocks tagged with the X list (or "daily claims") they came from.
 * @returns {{ list: string, date: string|null, text: string }[]}
 */
function blocksFromFile(filename, text) {
  const fileDate = (filename.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || null;
  const isDaily = filename.startsWith("daily-");
  const lines = text.split(/\n/);
  const blocks = [];
  let list = isDaily ? "daily claims" : "x lists";
  let inListTable = false;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const title = heading[1].replace(/\s*\(oldest seen:.*\)$/i, "").trim();
      inListTable = /^lists$/i.test(title);
      const fallback = isDaily ? "daily claims" : "x lists";
      list = !inListTable && !JUNK_HEADING.test(title) ? title : fallback;
      continue;
    }
    if (inListTable && /^\|/.test(line) && !/^\|\s*-/.test(line) && !/^\|\s*List\s*\|/i.test(line)) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map(cell => cell.trim());
      if (cells[0]) {
        blocks.push({ list: cells[0], date: lineDate(line, fileDate), text: cells.join(" ") });
        continue;
      }
    }
    if (line.trim()) blocks.push({ list, date: lineDate(line, fileDate), text: line });
  }
  return blocks;
}

function readNoteFiles(dir) {
  const files = fs
    .readdirSync(dir)
    .filter(name => name.endsWith(".md"))
    .sort();
  const blocks = [];
  for (const name of files) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    blocks.push(...blocksFromFile(name, text));
  }
  return blocks;
}

/**
 * @param {string} dir
 * @param {Array<{ name: string, slug: string, aliases?: string[] }>} protocols
 * @returns {Array<{ name: string, slug: string, count: number, lastSeen: string|null, lists: string[] }>}
 */
function countProtocolMentions(dir, protocols) {
  const blocks = readNoteFiles(dir);
  const rows = [];
  for (const protocol of protocols) {
    const regexes = patternsFor(protocol);
    if (!regexes.length) continue;
    let count = 0;
    let lastSeen = null;
    const lists = new Set();
    for (const block of blocks) {
      const hits = countMatches(block.text, regexes);
      if (!hits) continue;
      count += hits;
      lists.add(block.list);
      if (block.date && (!lastSeen || block.date > lastSeen)) lastSeen = block.date;
    }
    if (count > 0) {
      rows.push({
        name: protocol.name,
        slug: protocol.slug,
        count,
        lastSeen,
        lists: [...lists].sort((a, b) => a.localeCompare(b)),
      });
    }
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return rows;
}

/** Public file shape: no slug, no post text. */
function toPublicMentions(rows, generatedAt) {
  return {
    generatedAt,
    protocols: rows.map(row => ({
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
  return protocols
    .filter(row => row && row.name && row.count > 0)
    .map(row => ({
      name: row.name,
      count: row.count,
      lastSeen: row.lastSeen || null,
      lists: Array.isArray(row.lists) ? row.lists : [],
    }));
}

module.exports = {
  MENTION_ALIASES,
  countProtocolMentions,
  toPublicMentions,
  loadPublicMentions,
};
