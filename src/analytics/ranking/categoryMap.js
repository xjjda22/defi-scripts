/**
 * Twelve showcase categories. Ids and labels match `src/catalog/protocols.js`
 * (`CATEGORIES` + `BOARD_GROUPS`) so a protocol filed in the catalog stays in
 * the same bucket here.
 *
 * DefiLlama's own category decides, through `LLAMA_TO_CATEGORY`. `SLUG_OVERRIDES`
 * is the short, commented exception list. The catalog card's category is only
 * a fallback for a Llama category this map does not know yet. Catalog links
 * (slug, name, alias) attach npm scripts; they do not move a row.
 * The last two categories are not Llama protocols; the ranking script fills
 * them from catalog boards.
 */

const { CATEGORIES, BOARD_GROUPS } = require("../../catalog/protocols");

const LLAMA_TO_CATEGORY = {
  Dexs: "dex",

  "DEX Aggregator": "aggregator",
  "Bridge Aggregator": "aggregator",
  "Bridge Aggregators": "aggregator",

  Derivatives: "perps",
  Options: "perps",
  "Options Vault": "perps",
  "Exotic Options": "perps",
  Synthetics: "perps",
  "Interest Rate Derivatives": "perps",

  Lending: "lending",
  CDP: "lending",
  "Uncollateralized Lending": "lending",
  "NFT Lending": "lending",
  "CDP Manager": "lending",
  "Leveraged Farming": "lending",
  "Collateral Management": "lending",
  "Collateral Markets": "lending",

  "Risk Curators": "vaults",
  "Onchain Capital Allocator": "vaults",
  "Yield Aggregator": "vaults",
  "Liquidity Manager": "vaults",
  "Liquidity Automation": "vaults",
  "Treasury Manager": "vaults",
  Indexes: "vaults",
  // No separate yield category in the twelve. Yield markets sit with vaults;
  // incentive farms stay in the catch-all.
  Yield: "vaults",

  "Liquid Staking": "staking",
  "Staking Pool": "staking",
  "Anchor BTC": "staking",
  "Decentralized BTC": "staking",

  Restaking: "restaking",
  "Liquid Restaking": "restaking",
  "Restaked BTC": "restaking",

  RWA: "stable-rwa",
  "Reserve Currency": "stable-rwa",
  "Algo-Stables": "stable-rwa",
  "Stablecoin Issuer": "stable-rwa",
  "Stablecoin Wrapper": "stable-rwa",
  "Dual-Token Stablecoin": "stable-rwa",
  "Partially Algorithmic Stablecoin": "stable-rwa",
  "Basis Trading": "stable-rwa",

  Bridge: "bridge-chain",
  "Canonical Bridge": "bridge-chain",
  "Cross Chain Bridge": "bridge-chain",
  "Cross Chain": "bridge-chain",
  Chain: "bridge-chain",

  Launchpad: "other",
  "NFT Launchpad": "other",
  "Prediction Market": "other",
  Farm: "other",
  "NFT Marketplace": "other",
  Gaming: "other",
  Privacy: "other",
  Services: "other",
  Interface: "other",
  SoFi: "other",
  Payments: "other",
  Insurance: "other",
  "Trading App": "other",
  MEV: "other",
  Wallets: "other",
  CeDeFi: "other",
  "Crypto Card Issuer": "other",
  "Governance Incentives": "other",
  "AI Agents": "other",
  "Decentralized AI": "other",
  "OTC Marketplace": "other",
  DOR: "other",
  "Block Builders": "other",
  "DAO Service Provider": "other",
  "DCA Tools": "other",
  DePIN: "other",
  "Developer Tools": "other",
  Meme: "other",
  "NFT Automated Strategies": "other",
  NftFi: "other",
  Oracle: "other",
  "Telegram Bot": "other",
};

/**
 * Slug exceptions to DefiLlama's own category. Keep each one justified; every
 * other row follows `LLAMA_TO_CATEGORY`.
 */
const SLUG_OVERRIDES = {
  // Llama files Sky's products as CDP / Lending. They are the USDS/DAI
  // stablecoin issuer.
  "sky-lending": "stable-rwa",
  "sky-money": "stable-rwa",
  "sky-rwa": "stable-rwa",
  // Llama: Bridge. It is a cross-chain intents venue.
  "near-intents": "aggregator",
  // Llama: Liquid Staking. eETH/weETH is a liquid restaking token.
  // (ether.fi Liquid stays with vaults, as Llama files it.)
  "ether.fi-stake": "restaking",
  // Llama: Collateral Markets. Symbiotic is a restaking protocol.
  symbiotic: "restaking",
  // Llama: Synthetics (maps to perps). Self-repaying loans.
  "alchemix-v3": "lending",
  alchemix: "lending",
};

/**
 * Live Llama slugs for a catalog protocol whose npm slug was split or renamed.
 * Linking uses the catalog category and attaches that protocol's npm scripts.
 * Only the product the monitor is about — not every similarly named row.
 */
const CATALOG_ALIASES = {
  aave: ["aave-v1", "aave-v2", "aave-v3", "aave-v4", "aave-horizon-rwa"],
  morpho: ["morpho-blue"],
  spark: ["sparklend"],
  etherfi: ["ether.fi-stake", "ether.fi-liquid"],
  uniswap: ["uniswap-v1", "uniswap-v2", "uniswap-v3", "uniswap-v4"],
  curve: ["curve-dex"],
  balancer: ["balancer-v1", "balancer-v2", "balancer-v3"],
  sushiswap: ["sushiswap-v3"],
  gmx: ["gmx-v1-perps", "gmx-v2-perps"],
  hyperliquid: ["hyperliquid-perps", "hyperliquid-hlp"],
  pancakeswap: ["pancakeswap-amm", "pancakeswap-infinity"],
  ethena: ["ethena-usde", "ethena-usdtb"],
  sky: ["sky-lending", "sky-money", "sky-rwa"],
  polymarket: ["polymarket-international", "polymarket-us"],
  ondo: ["ondo-global-markets", "ondo-yield-assets"],
  jito: ["jito-liquid-staking"],
  aerodrome: ["aerodrome-v1", "aerodrome-slipstream"],
  velodrome: ["velodrome-v1", "velodrome-v2", "velodrome-v3"],
  lighter: ["lighter-perps", "lighter-robinhood-perps"],
  stargate: ["stargate-v1", "stargate-v2"],
  swell: ["swell-liquid-staking", "swell-liquid-restaking"],
  puffer: ["puffer-stake"],
  bedrock: ["bedrock-unieth", "bedrock-unibtc"],
  "1inch": ["1inch-swap", "1inch-aqua"],
  near: ["near-intents"],
  camelot: ["camelot-v2", "camelot-v3"],
  thena: ["thena-v1", "thena-fusion", "thena-integral"],
  thruster: ["thruster-v2", "thruster-v3"],
  maverick: ["maverick-v1", "maverick-v2"],
  nostra: ["nostra-money-market"],
  aevo: ["aevo-perps"],
  mux: ["mux-perps"],
  blast: ["blast-bridge"],
  sanctum: ["sanctum-validator-lsts"],
  "3jane": ["3jane-lending"],
  pharaoh: ["pharaoh-v3", "pharaoh-cl", "pharaoh-dlmm"],
  hyperlend: ["hyperlend-pooled", "hyperlend-isolated"],
  kinetiq: ["kinetiq-khype"],
  arcus: ["arcus-perps"],
  robinhood: ["robinhood-chain-bridge"],
  derive: ["derive-v3-options"],
  eigenlayer: ["eigencloud"],
  keyrock: ["keyrock"],
  stakestone: ["stakestone-stone"],
  polynomial: ["polynomial-trade"],
  drift: ["drift-trade", "drift-amm"],
  synthetix: ["synthetix-v4", "synthetix-v3", "synthetix-v1+v2"],
  kyberswap: ["kyberswap-classic", "kyberswap-elastic", "kyberswap-aggregator"],
};

/**
 * Omitted from the scored ranking (catalog extras can still list them):
 * centralized exchanges, Ponzi rows, token lockers (team tokens parked in a
 * vesting contract are not DeFi usage), and a few non-DeFi fee earners.
 */
const EXCLUDED_LLAMA_CATEGORIES = new Set([
  "CEX",
  "Ponzi",
  "Token Locker",
  // Fee-earning but not DeFi venues; they would otherwise enter on the fees floor.
  "Coins Tracker",
  "Domains",
  "Foundation",
  "Physical TCG",
  "Luck Games",
  "Gamified Mining",
]);

const CATEGORY_BY_ID = new Map();
for (const cat of CATEGORIES) {
  CATEGORY_BY_ID.set(cat.id, { id: cat.id, label: cat.label, source: "defillama" });
}
for (const group of BOARD_GROUPS) {
  CATEGORY_BY_ID.set(group.id, { id: group.id, label: group.label, source: "repo" });
}

function categoryMeta(id) {
  return CATEGORY_BY_ID.get(id) || { id, label: id, source: "defillama" };
}

/**
 * @param {{ slug?: string, category?: string }} protocol
 * @param {{ category?: string }|null} catalogLink
 */
function resolveCategory(protocol, catalogLink) {
  const slug = protocol && protocol.slug;
  if (slug && SLUG_OVERRIDES[slug]) return SLUG_OVERRIDES[slug];
  const mapped = protocol && LLAMA_TO_CATEGORY[protocol.category];
  if (mapped) return mapped;
  // Unknown Llama category: fall back to the catalog card, then the catch-all.
  if (catalogLink && catalogLink.category && catalogLink.linkKind !== "alias") return catalogLink.category;
  return "other";
}

module.exports = {
  LLAMA_TO_CATEGORY,
  SLUG_OVERRIDES,
  CATALOG_ALIASES,
  EXCLUDED_LLAMA_CATEGORIES,
  CATEGORY_BY_ID,
  categoryMeta,
  resolveCategory,
};
