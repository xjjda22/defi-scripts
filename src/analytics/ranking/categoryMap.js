/**
 * Twelve showcase categories. Ids and labels match `src/catalog/protocols.js`
 * (`CATEGORIES` + `BOARD_GROUPS`) so a protocol filed in the catalog stays in
 * the same bucket here.
 *
 * DefiLlama's category string maps through `LLAMA_TO_CATEGORY`. `SLUG_OVERRIDES`
 * wins over that label. An exact script-slug or exact-name catalog link also
 * uses the catalog category. Alias links keep the Llama category unless the
 * slug is overridden (they still inherit that protocol's npm scripts).
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
};

/**
 * Slug exceptions. These disagree with a naive reading of Llama's category
 * and follow the catalog instead.
 */
const SLUG_OVERRIDES = {
  "ethena-usde": "stable-rwa",
  "ethena-usdtb": "stable-rwa",
  "sky-lending": "stable-rwa",
  "sky-money": "stable-rwa",
  "sky-rwa": "stable-rwa",
  "near-intents": "aggregator",
  "ether.fi-stake": "restaking",
  "ether.fi-liquid": "restaking",
  "polymarket-international": "other",
  "polymarket-us": "other",
  "pump.fun": "other",
  // Self-repaying loans. Llama files them under Synthetics, which otherwise maps to perps.
  "alchemix-v3": "lending",
  alchemix: "lending",
  // Same catalog card as Jupiter Lend (the AMM is not a separate aggregator).
  "jupiter-lend-dex": "lending",
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
  drift: ["drift-trade"],
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
  kyberswap: ["kyberswap-classic", "kyberswap-elastic"],
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
};

/** Not DeFi venues. Omitted from the scored ranking (catalog extras can still list them). */
const EXCLUDED_LLAMA_CATEGORIES = new Set(["CEX", "Ponzi"]);

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
  if (catalogLink && catalogLink.category && catalogLink.linkKind !== "alias") return catalogLink.category;
  const mapped = protocol && LLAMA_TO_CATEGORY[protocol.category];
  return mapped || "other";
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
