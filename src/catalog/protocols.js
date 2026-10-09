/**
 * Protocol registry: the single source for how scripts are presented per protocol.
 *
 * Commands are not listed here. They are derived from package.json: the protocol id is the
 * second segment of the npm script name (`analytics:<id>:...`, `simulate:<id>:...`, `swap:<id>...`,
 * `crosschain:<id>:...`), or the third for `simulate:dex:<id>:...`.
 *
 * `npm run catalog:check` fails when a script has no registry entry or a registry entry has no scripts.
 */

const CATEGORIES = [
  { id: "dex", label: "Spot DEX / AMM" },
  { id: "aggregator", label: "Aggregators & intents" },
  { id: "perps", label: "Perps & derivatives" },
  { id: "lending", label: "Lending & money markets" },
  { id: "vaults", label: "Vault curators & allocators" },
  { id: "staking", label: "Liquid staking" },
  { id: "restaking", label: "Restaking" },
  { id: "stable-rwa", label: "Stablecoins & RWA" },
  { id: "bridge-chain", label: "Bridges & chains" },
  { id: "other", label: "Launchpads, prediction & other" },
];

const BOARD_GROUPS = [
  { id: "boards", label: "Market boards (cross-protocol)" },
  { id: "tooling", label: "Swap & simulation tooling" },
];

const COINDESK_LRT =
  "[CoinDesk](https://www.coindesk.com/business/2026/09/28/the-restaking-gold-rush-is-over-and-top-protocols-are-barely-making-a-profit), 2026-09-28";
const LRT_COMBINED = `Renzo, Kelp, Swell, Puffer Finance and Bedrock (five largest remaining LRTs) made $953,350 combined Q2'26 gross profit, down from $2.18M three quarters earlier (${COINDESK_LRT}).`;
const FEES_NOTE = "Analytics prints DefiLlama fees/revenue for 24h/7d/30d, not quarterly gross profit.";
const PORTALS_W4 = "[Portals](https://blog.portals.fi/defi-tvl-september-2026-week-4/), 2026-09-25";

/** @type {Array<{id: string, name: string, category: string, url: string, about: string, data?: string, notes?: string[]}>} */
const PROTOCOLS = [
  // Spot DEX / AMM
  {
    id: "uniswap",
    name: "Uniswap",
    category: "dex",
    url: "https://uniswap.org",
    about:
      "V2/V3/V4 AMM. The deepest coverage in the repo: cross-chain trackers, price monitor, fork quotes and swaps.",
    data: "Subgraphs, on-chain RPC",
  },
  {
    id: "curve",
    name: "Curve Finance",
    category: "dex",
    url: "https://curve.fi",
    about: "Stablecoin-focused AMM.",
    data: "Subgraphs, on-chain RPC",
  },
  {
    id: "balancer",
    name: "Balancer",
    category: "dex",
    url: "https://balancer.fi",
    about: "Weighted / composable pools behind a single Vault.",
    data: "Subgraphs, on-chain RPC",
  },
  {
    id: "sushiswap",
    name: "SushiSwap",
    category: "dex",
    url: "https://sushi.com",
    about: "V2/V3 AMM on many chains.",
    data: "Subgraphs, on-chain RPC",
  },
  {
    id: "aerodrome",
    name: "Aerodrome",
    category: "dex",
    url: "https://aerodrome.finance",
    about: "Base ve(3,3) DEX (Slipstream concentrated liquidity).",
    data: "DefiLlama, on-chain RPC",
    notes: [
      "Slipstream quoters revert on `QuoterV2.quoteExactInputSingle.staticCall`, so `simulate:dex:aerodrome:v3` and `swap:aerodrome` quote Uniswap V3 on Base as a liquid reference.",
    ],
  },
  {
    id: "velodrome",
    name: "Velodrome",
    category: "dex",
    url: "https://velodrome.finance",
    about: "Optimism ve(3,3) DEX (Slipstream concentrated liquidity).",
    data: "DefiLlama, on-chain RPC",
    notes: ["Same Slipstream quoter limitation as Aerodrome: quotes are a Uniswap V3 reference on Optimism."],
  },
  {
    id: "pancakeswap",
    name: "PancakeSwap V3",
    category: "dex",
    url: "https://pancakeswap.finance",
    about: "Multichain V3 AMM.",
  },
  { id: "camelot", name: "Camelot", category: "dex", url: "https://camelot.exchange", about: "Arbitrum-native DEX." },
  { id: "ambient", name: "Ambient", category: "dex", url: "https://ambient.finance", about: "Single-contract AMM." },
  {
    id: "fluid",
    name: "Fluid DEX",
    category: "dex",
    url: "https://fluid.io",
    about: "DEX on top of Fluid's lending liquidity layer.",
  },
  {
    id: "maverick",
    name: "Maverick",
    category: "dex",
    url: "https://mav.xyz",
    about: "Directional-liquidity AMM.",
  },
  { id: "quickswap", name: "QuickSwap V3", category: "dex", url: "https://quickswap.exchange", about: "Polygon AMM." },
  { id: "syncswap", name: "SyncSwap", category: "dex", url: "https://syncswap.xyz", about: "zkSync-family AMM." },
  { id: "thena", name: "THENA", category: "dex", url: "https://thena.fi", about: "BNB Chain ve(3,3) DEX." },
  { id: "thruster", name: "Thruster", category: "dex", url: "https://thruster.finance", about: "Blast DEX." },
  {
    id: "ammalgam",
    name: "Ammalgam",
    category: "dex",
    url: "https://ammalgam.fi",
    about:
      "Hybrid AMM + lending. The analytics monitor needs `AMMALGAM_LLAMA_SLUG`; the smoke tolerates a missing listing.",
  },
  {
    id: "humidifi",
    name: "HumidiFi",
    category: "dex",
    url: "https://humidifi.xyz",
    about: "Solana prop AMM. No swap path: Solana needs a non-ethers client.",
  },
  {
    id: "monad",
    name: "Monad (native AMM)",
    category: "dex",
    url: "https://monad.xyz",
    about:
      "Monad L1. The Llama row is often chain-level; `simulate:dex:monad:v3` quotes Uniswap V3 on Monad (`MONAD_RPC_URL`, WMON as WETH).",
    data: "DefiLlama, on-chain RPC",
    notes: ["Pool liquidity can be thin, so quotes may fail sanity filters."],
  },
  {
    id: "raydium",
    name: "Raydium AMM",
    category: "dex",
    url: "https://raydium.io",
    about: "Solana AMM.",
    notes: [
      "Raydium TVL $1.26B; handled $1.713B (64%) of StonkFun's $2.67B volume ([KuCoin](https://www.kucoin.com/news/flash/ray-gains-10-as-raydium-captures-64-of-stonkfun-volume), 2026-09-22).",
    ],
  },
  {
    id: "pumpswap",
    name: "PumpSwap",
    category: "dex",
    url: "https://pumpswap.io",
    about: "Solana AMM from pump.fun (distinct from the `pumpfun` launchpad row).",
    notes: [
      "~$482.79M 24h volume, ~17% of Solana's $2.80B DEX volume ([The Chain Observer](https://thechainobserver.com/solana-dex-volume-reaches-2-8b/), 2026-09-22).",
    ],
  },
  {
    id: "bisonfi",
    name: "BisonFi",
    category: "dex",
    url: "https://bisonfi.io",
    about: "Solana AMM.",
    notes: [
      "~$424.26M 24h volume ([The Chain Observer](https://thechainobserver.com/solana-dex-volume-reaches-2-8b/), 2026-09-22); top Solana AMM by volume for 25 straight weeks ([Gate News](https://www.gate.com/news/detail/SOL/bisonfi-dominates-solana-amm-market-for-25-consecutive-weeks-24501218), 2026-09-23).",
    ],
  },
  {
    id: "meteora",
    name: "Meteora DLMM",
    category: "dex",
    url: "https://meteora.ag",
    about: "Solana dynamic liquidity market maker. Analytics adds fees/revenue.",
    notes: [
      "Referral Staking Cycle 2 paid $700K+ USDC from DLMM fees (vs $336K in Cycle 1); cycle ended 2026-09-21 ([Solana Compass](https://solanacompass.com/news/meteora-referral-staking-cycle-2-distributes-over-700k-in-usdc-more-than-double-cycle-1), 2026-09-23).",
    ],
  },
  {
    id: "deepbook",
    name: "DeepBook V3",
    category: "dex",
    url: "https://deepbook.tech",
    about: "Sui on-chain order book.",
    notes: [
      "DeepBook App launched on the order book behind $20B+ of Sui volume ([Sui blog](https://www.sui.io/blog/deepbook-app-is-live-onchain-power-for-serious-traders), 2026-09-24).",
    ],
  },
  {
    id: "kuru",
    name: "Kuru CLOB",
    category: "dex",
    url: "https://kuru.io",
    about: "Monad central-limit order book.",
    notes: [
      "Cumulative trading volume passed $7B on Monad ([TokenPost](https://www.tokenpost.com/news/investing/24062), 2026-09-25).",
    ],
  },
  {
    id: "astroport",
    name: "Astroport",
    category: "dex",
    url: "https://astroport.fi",
    about: "Cosmos DEX (Terra2, Injective, Osmosis, Neutron).",
    notes: ["Neutron Prop 9 governance exploit on 2026-09-22; sibling `drop` is tracked separately."],
  },
  {
    id: "thorchain",
    name: "THORChain DEX",
    category: "dex",
    url: "https://thorchain.org",
    about: "Native cross-chain swaps.",
    notes: [
      "~500k stolen ATOM swapped through THORChain; 168,990.9 ATOM refunded to the attacker after the Hub restart ([CryptoSlate](https://cryptoslate.com/cosmos-restarted-to-seize-2-2-million-in-stolen-atom-but-169000-tokens-still-escaped/), 2026-09-24).",
    ],
  },
  {
    id: "pharaoh",
    name: "Pharaoh Exchange",
    category: "dex",
    url: "https://www.phar.gg/",
    about:
      "Avalanche DEX. Parent slug is preferred over `pharaoh-v3` / `pharaoh-dlmm`. The smoke requires revenue (the lowest day in the last 30 was about $14k).",
    notes: [
      "Record month: ~$2.866B 30-day volume and ~$2.48M 30-day fees; TVL ~$47–53M; V2 wind-down closes 2026-10-31 ([CryptoBriefing](https://cryptobriefing.com/pharaoh-exchange-record-monthly-volume-fees/), 2026-10-01).",
    ],
  },
  {
    id: "fables",
    name: "Fables",
    category: "dex",
    url: "https://www.fables.fi/",
    about: "Robinhood Chain DEX. Llama revenue is $0, so the smoke checks TVL only.",
    notes: [
      "FABLES TGE 2026-10-20 with ve(3,3); 52 markets; about $45M deposits; over $2B cumulative volume ([PANews](https://www.panews.io/articles/01a0f277-bfed-723b-af07-8d537ac49956), 2026-09-30).",
    ],
  },
  {
    id: "arcus",
    name: "Arcus",
    category: "dex",
    url: "https://arcus.xyz/",
    about: "Robinhood Chain DEX. Analytics adds fees/revenue; DEX volume and fees are indexed on Llama.",
    notes: [
      ">$5B cumulative spot+perp volume since the July launch, 15,000+ traders, >$500M peak daily volume, >$28M TVL; integrated into Robinhood Wallet for 190+ Stock Tokens; points Season 1 started 2026-10-01 ([CryptoBriefing](https://cryptobriefing.com/arcus-joins-robinhood-wallets-stock-token-lineup-as-volume-tops-5-billion/), 2026-10-01; [Arcus blog](https://arcus.xyz/blog/introducing-arcus-points), 2026-10-01).",
    ],
  },

  // Aggregators & intents
  { id: "1inch", name: "1inch", category: "aggregator", url: "https://1inch.io", about: "DEX aggregator." },
  {
    id: "cowswap",
    name: "CoW Swap",
    category: "aggregator",
    url: "https://swap.cow.fi",
    about: "Batch-auction intents.",
  },
  {
    id: "kyberswap",
    name: "KyberSwap",
    category: "aggregator",
    url: "https://kyberswap.com",
    about: "Aggregator + AMM.",
  },
  { id: "matcha", name: "Matcha", category: "aggregator", url: "https://matcha.xyz", about: "0x-powered aggregator." },
  { id: "odos", name: "Odos", category: "aggregator", url: "https://odos.xyz", about: "Multi-path aggregator." },
  { id: "paraswap", name: "ParaSwap", category: "aggregator", url: "https://paraswap.io", about: "DEX aggregator." },
  { id: "hashflow", name: "Hashflow", category: "aggregator", url: "https://hashflow.com", about: "RFQ venue." },
  {
    id: "uniswapx",
    name: "UniswapX",
    category: "aggregator",
    url: "https://docs.uniswap.org/contracts/uniswapx/overview",
    about: "Signed Dutch-style orders filled through a reactor, not pool routers.",
    data: "On-chain RPC (reactor `Fill` logs)",
    notes: [
      "The fill replay scans logs in chunks (`UNISWAPX_MAX_BLOCKS`, `UNISWAPX_LOG_CHUNK`) and soft-fails on revert unless `UNISWAPX_REPLAY_STRICT=1`.",
    ],
  },
  {
    id: "near",
    name: "NEAR Intents",
    category: "aggregator",
    url: "https://near.org",
    about: "Cross-chain intent settlement.",
    notes: [
      "Passed ~$31.4B cumulative volume ([Bitinsider](https://bitinsider.io/articles/near-protocol-intents-surpass-30b-in-all-time-volume-as-daily-records-fall), 2026-09-22).",
      "Exploited for ~$3.8M in USDT on BNB Chain (Sep 30 to Oct 1) through the Omni deposit/withdrawal layer; funds returned in full on 2026-10-02 ([Cointelegraph](https://cointelegraph.com/news/near-intents-recovers-entire-stolen-38m-after-ultimatum-to-exploiter), 2026-10-03; [Decrypt](https://decrypt.co/380014/near-intents-recovers-3-8-million-after-48-hour-ultimatum), 2026-10-04; [X](https://x.com/zacodil/status/2108480859942555933), 2026-10-09). `analytics:near:exploit` reads the incident from DefiLlama `/hacks` (id 6225); DefiLlama does not record the returned funds.",
    ],
  },
  {
    id: "curvy",
    name: "Curvy v2",
    category: "aggregator",
    url: "https://curvy.finance",
    about: "ZK stealth aggregator. The Llama slug defaults to `curves-protocol` (override with `CURVY_LLAMA_SLUG`).",
  },

  // Perps & derivatives
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    category: "perps",
    url: "https://hyperliquid.xyz",
    about: "Perps L1.",
  },
  { id: "gmx", name: "GMX", category: "perps", url: "https://gmx.io", about: "Pool-backed perps." },
  { id: "gains", name: "Gains Network", category: "perps", url: "https://gains.trade", about: "gTrade perps." },
  { id: "synfutures", name: "SynFutures V3", category: "perps", url: "https://synfutures.com", about: "Perp DEX." },
  { id: "orderly", name: "Orderly", category: "perps", url: "https://orderly.network", about: "Omnichain order book." },
  { id: "mux", name: "MUX", category: "perps", url: "https://mux.network", about: "Aggregated perp liquidity." },
  { id: "aster", name: "Aster", category: "perps", url: "https://aster.finance", about: "Hybrid perp/spot DEX." },
  { id: "aevo", name: "Aevo", category: "perps", url: "https://aevo.xyz", about: "Options + perps L2." },
  {
    id: "lighter",
    name: "Lighter",
    category: "perps",
    url: "https://lighter.xyz",
    about:
      "ZK perp order book. Analytics adds open interest and its year-to-date high (`DEFILLAMA_OI=1 DEFILLAMA_OI_HIGH=1`); the smoke requires positive open interest (`SMOKE_OI=1`).",
    notes: [
      "Open interest hit a 2026 high; core exchange up ~50% since August; the Robinhood partnership is ~a quarter of Lighter's OI and fee revenue and nearly 40% of daily active accounts ([TokenPost](https://www.tokenpost.com/news/business/28319), 2026-10-08; [Coinfomania](https://coinfomania.com/lighter-exchange-hits-2026-high-in-open-interest/), 2026-10-08; [X](https://x.com/Delphi_Digital/status/2108206129574539702), 2026-10-08). Analytics prints `/summary/open-interest/lighter` `total24h` and the YTD high from its daily chart; the Robinhood share is not tracked.",
    ],
  },
  {
    id: "papertrade",
    name: "Papertrade",
    category: "perps",
    url: "https://papertrade.xyz",
    about: "Synthetic BTC/ETH perps on HyperEVM against a protocol-owned pool (DefiLlama slug `papertrade`).",
    notes: [
      "Pre-deposits opened 2026-10-08; live trading expected ~1h after the 2026-10-10 HyperEVM upgrade (may slip to 2026-10-11) ([DeFi Prime](https://defiprime.com/papertrade-opens-predeposits-before-hyperevm-launch), 2026-10-09; [SignalPlus](https://t.signalplus.com/crypto-news/detail/papertrade-opens-predeposits-ahead-october-trading-launch?lang=en-US), 2026-10-08). ~$25M in user deposits ahead of launch is a single X post ([X](https://x.com/zoomerfied/status/2108565430499717403), 2026-10-09); analytics prints live DefiLlama TVL.",
    ],
  },
  {
    id: "reya",
    name: "Reya Network",
    category: "perps",
    url: "https://reya.network",
    about: "Perps L2. Override the slug with `REYA_LLAMA_SLUG`.",
  },
  {
    id: "drake",
    name: "Drake Exchange",
    category: "perps",
    url: "https://drake.exchange",
    about: "Monad CLOB-AMM perp DEX. Points / MON campaign row lives in `analytics:airdrop:watch`.",
  },
  { id: "kwenta", name: "Kwenta", category: "perps", url: "https://kwenta.io", about: "Synthetix-powered perps." },
  { id: "perennial", name: "Perennial", category: "perps", url: "https://perennial.finance", about: "Perps protocol." },
  { id: "polynomial", name: "Polynomial", category: "perps", url: "https://polynomial.fi", about: "Perps chain." },
  { id: "rabbitx", name: "RabbitX", category: "perps", url: "https://rabbitx.io", about: "Perp order book." },
  {
    id: "vertex",
    name: "Vertex Perps",
    category: "perps",
    url: "https://vertexprotocol.com",
    about: "Hybrid order book.",
  },
  {
    id: "synthetix",
    name: "Synthetix",
    category: "perps",
    url: "https://synthetix.io",
    about: "Derivatives liquidity layer.",
  },
  {
    id: "drift",
    name: "Drift",
    category: "perps",
    url: "https://app.drift.trade",
    about: "Solana perps. Analytics adds fees/revenue; the smoke is TVL-only because daily revenue is sometimes $0.",
    notes: [
      "DFX recovery-token claims opened for the April 1 incident (~$295M stolen); Recovery Pool ~3.1–3.11M USDT ([CryptoBriefing](https://cryptobriefing.com/drift-dfx-recovery-token-claims-april-exploit/), 2026-10-01). The monitor does not read the Recovery Pool or DFX supply.",
    ],
  },
  {
    id: "ostium",
    name: "Ostium",
    category: "perps",
    url: "https://www.ostium.io/",
    about: "RWA perps backed by the OLP vault.",
    notes: [
      "OLP Recovery Plan repays 3,321 of 3,666 wallets in full; confirmed drain 23,752,746 USDC ([The Crypto Times](https://www.cryptotimes.io/2026/10/01/ostium-23-75m-hack-recovery-3321-wallets-repaid-345-lps-face-1000-choice/), 2026-10-01). The monitor does not read recovery payouts.",
    ],
  },
  {
    id: "variational",
    name: "Variational",
    category: "perps",
    url: "https://omni.variational.io",
    about:
      "Off-chain perp DEX. Llama TVL is empty ($0); analytics adds open interest (`DEFILLAMA_OI=1`). The smoke allows $0 TVL.",
    notes: [
      "~23% of all perp DEX volume; September volume >$48B (~60% above August); 30-day volume ~$50B with ~$1.07B open interest; 32% of VAR supply to the genesis airdrop at the Q4 TGE ([The Block Data & Insights](https://www.theblock.co/newsletters/data-and-insights/2026-09-30-data-passive-base-417118), 2026-09-30). Analytics prints `/summary/open-interest/variational` `total24h`, not perp volume.",
    ],
  },
  {
    id: "derive",
    name: "Derive",
    category: "perps",
    url: "https://app.derive.xyz",
    about:
      "Onchain options. Notional and premium from `/summary/options/derive-options`, TVL from `/protocol/derive`, and share vs Paradex and the rest of `/overview/options`. Hypercall TVL is included; its options volume is not tracked on DefiLlama. The smoke fails unless Derive 30d notional is > 0.",
    notes: [
      "September 2026 onchain options notional more than doubled to ~$4.83B (+121.7% MoM). Derive ~$3.8B with share 88.1% → 79.3%; Paradex notional +285% and open interest >$250M; Hypercall ~11.2% share ([CryptoBriefing](https://cryptobriefing.com/derive-leads-onchain-options-volume-doubles/), 2026-10-05; [Coinfomania](https://coinfomania.com/onchain-options-market-surges-to-4-83b-as-competition-grows/), 2026-10-05; [X](https://x.com/Delphi_Digital/status/2107083828389187613), 2026-10-05). Analytics prints trailing 24h/7d/30d notional and premium, not that calendar month. Hypercall volume is not on DefiLlama.",
    ],
  },

  // Lending & money markets
  {
    id: "aave",
    name: "Aave",
    category: "lending",
    url: "https://aave.com",
    about: "V2/V3 lending: live rates, version comparison, liquidations, and fork reads.",
    data: "On-chain RPC",
  },
  {
    id: "morpho",
    name: "Morpho",
    category: "lending",
    url: "https://morpho.org",
    about: "Morpho Blue isolated markets. Also a row in `analytics:lending:aggregate`. No swap script by design.",
    data: "Morpho GraphQL, on-chain RPC",
  },
  {
    id: "spark",
    name: "Spark",
    category: "lending",
    url: "https://spark.fi",
    about: "Sky-aligned lending; also a row in `analytics:lending:aggregate`.",
  },
  {
    id: "nostra",
    name: "Nostra Finance",
    category: "lending",
    url: "https://nostra.finance",
    about: "Starknet lending.",
  },
  { id: "suilend", name: "Suilend", category: "lending", url: "https://suilend.fi", about: "Sui lending." },
  { id: "benqi", name: "Benqi Lending", category: "lending", url: "https://benqi.fi", about: "Avalanche lending." },
  {
    id: "navi",
    name: "NAVI Lending",
    category: "lending",
    url: "https://naviprotocol.io",
    about: "Sui lending.",
    notes: [
      "NAVI held >$420M of deposits in Sui's $1.21B TVL snapshot of 2026-09-22 ([Bitcoinist](https://bitcoinist.com/sui-tvl-moves-above-1-2b-as-defi-liquidity-expands/), 2026-09-24).",
    ],
  },
  {
    id: "kamino",
    name: "Kamino Lend",
    category: "lending",
    url: "https://kamino.finance",
    about: "Solana lending.",
    notes: [
      "sUSDai/USDC market opened at 80% max LTV, 85% liquidation LTV, 5M caps ([Altcoin Buzz](https://www.altcoinbuzz.io/kamino-opens-usdc-borrowing-against-gpu-loan-yields-on-solana), 2026-09-25).",
    ],
  },
  {
    id: "jupiter",
    name: "Jupiter Lend",
    category: "lending",
    url: "https://jup.ag",
    about: "Solana lending (`jupiter-lend`) and its AMM (`jupiter-lend-dex`).",
    notes: [
      "Record $2.41B total deposits on 2026-09-22 ([Solana Compass](https://solanacompass.com/news/jupiter-perps-adds-six-markets-including-tokenized-spacex-hype-and-zec-via-gum-orderbook), 2026-09-22).",
      "Jupiter Earn to seed $10M of sUSDai DEX liquidity on the Lend AMM ([Altcoin Buzz](https://www.altcoinbuzz.io/kamino-opens-usdc-borrowing-against-gpu-loan-yields-on-solana), 2026-09-25).",
    ],
  },
  {
    id: "hyperlend",
    name: "HyperLend",
    category: "lending",
    url: "https://app.hyperlend.finance",
    about:
      "Hyperliquid lending (parent of `hyperlend-pooled` + `hyperlend-isolated`). Analytics adds fees/revenue; the smoke requires revenue. Market size ≈ the `Hyperliquid L1` TVL row plus the `borrowed` row.",
    notes: [
      "First institutional credit facility on HyperLend's Aviya Finance with Anchorage Digital custody; over $800M market size ([GlobeNewswire via Stockhouse](https://stockhouse.com/news/press-releases/2026/09/30/hyperion-defi-anchorage-digital-and-hyperlend-together-announce-the-first), 2026-09-30).",
    ],
  },
  {
    id: "3jane",
    name: "3Jane",
    category: "lending",
    url: "https://www.3jane.xyz/",
    about:
      "Credit protocol on Ethereum. The chain table includes the `borrowed` row (supplied ≈ TVL + borrowed). `Ethereum-borrowed` repeats that same balance.",
    notes: [
      "USD3 minted grew to over $100M after the Levered Callable Capital launch ([X post](https://x.com/DeFi_Dad/status/2104951698246475944) by @DeFi_Dad, 2026-09-29), corroborated by DefiLlama TVL + borrowed.",
    ],
  },
  {
    id: "rhea",
    name: "Rhea Finance",
    category: "lending",
    url: "https://www.rhea.finance",
    about: "NEAR DEX + lending + LST parent (`rhea-finance`) and Rhea Lend (`rhea-lend`).",
  },

  // Vault curators & allocators
  {
    id: "sentora",
    name: "Sentora Curator",
    category: "vaults",
    url: "https://sentora.com",
    about: "Morpho vault curator. Llama reports all Sentora vaults, not a single vault.",
    notes: [
      `Morpho Sentora RLUSD Main (Vault V2) on Ethereum at $424.20M TVL and 5.67% APY (${PORTALS_W4}).`,
      "The single vault is readable via Morpho's API (`vaultV2s`, `0x6dC58a0FdfC8D694e571DC59B9A52EEEa780E6bf`). Distinct from Upshift Sentora USD Earn (`analytics:upshift:allocator`).",
    ],
  },
  {
    id: "steakhouse",
    name: "Steakhouse Financial",
    category: "vaults",
    url: "https://www.steakhouse.financial",
    about: "Morpho vault curator, TVL by chain.",
    notes: [`Steakhouse Prime Instant (Morpho USDC vault) on Base at $444.37M TVL (${PORTALS_W4}).`],
  },
  {
    id: "upshift",
    name: "Upshift",
    category: "vaults",
    url: "https://www.upshift.finance",
    about: "Vault allocator.",
    notes: [`Upshift Sentora USD Earn on Ethereum at $94.41M TVL (${PORTALS_W4}).`],
  },
  {
    id: "keyrock",
    name: "Keyrock Prime USDC",
    category: "vaults",
    url: "https://keyrock.com/",
    about:
      "Single Morpho Vault V2 (`krUSDC` `0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123`, Arc chainId 5042). DefiLlama's `keyrock` slug does not index it. No RPC needed.",
    data: "Morpho GraphQL",
    notes: [
      "Arc cirBTC/USDC Morpho market allocations include $74.99M in Keyrock Prime USDC; market size $176.71M ([TokenPost](https://www.tokenpost.com/news/business/25020), 2026-09-28).",
    ],
  },
  {
    id: "concrete",
    name: "Concrete",
    category: "vaults",
    url: "https://app.concrete.xyz",
    about: "Onchain capital allocator, mostly Ethereum. Analytics adds fees/revenue.",
    notes: [
      "CT token TGE on 2026-09-30; >$1.2B deposits, >$23B cumulative volume, 54,000+ depositors; fixed 1B CT supply ([TokenPost](https://www.tokenpost.com/news/technology/25663), 2026-09-30; [BSC News](https://bsc.news/news/concrete-ct-token-tge-governance), 2026-09-30).",
    ],
  },

  // Liquid staking
  {
    id: "lido",
    name: "Lido",
    category: "staking",
    url: "https://lido.fi",
    about: "stETH / wstETH: APR, TVL, peg, and fork reads.",
    data: "Lido API, DefiLlama, on-chain RPC",
  },
  {
    id: "stakestone",
    name: "StakeStone",
    category: "staking",
    url: "https://stakestone.io",
    about: "STONE LST. Optional `STAKESTONE_YIELDS_POOL_ID` for chart APY.",
    data: "DefiLlama TVL + yields",
  },
  {
    id: "kintsu",
    name: "Kintsu",
    category: "staking",
    url: "https://kintsu.xyz",
    about: "Liquid staking. APY from the Llama yields chart (`KINTSU_YIELDS_POOL_ID`).",
    data: "DefiLlama TVL + yields",
  },
  {
    id: "jito",
    name: "Jito",
    category: "staking",
    url: "https://jito.network",
    about: "Solana LST (JitoSOL).",
    notes: [
      "Pool held 10.38M SOL vs 7.96M JitoSOL supply at epoch 1042 ([Solana Compass](https://solanacompass.com/news/sec-staff-faq-says-staking-receipt-tokens-can-be-digital-commodities-jito), 2026-09-25).",
    ],
  },
  {
    id: "sanctum",
    name: "Sanctum",
    category: "staking",
    url: "https://sanctum.so",
    about: "Solana LST infrastructure.",
    notes: [
      "CLOUD-008 passed: 259M CLOUD burned, supply 1B → ~741M; TVL $2.05B ([Solana Compass](https://solanacompass.com/news/sanctum-governance-vote-passes-259m-cloud-tokens-to-be-burned-ticker-renames-to-sanc), 2026-09-20).",
    ],
  },
  {
    id: "dfdv",
    name: "DFDV Staked SOL",
    category: "staking",
    url: "https://dfdv.com",
    about: "Treasury-company staked SOL.",
    notes: [
      "Added 101,381 SOL in a week to ~2,490,304 SOL ([KuCoin](https://www.kucoin.com/news/flash/dfdv-adds-101-381-sol-to-treasury-as-sol-price-surpasses-116), 2026-09-22).",
    ],
  },
  {
    id: "drop",
    name: "Drop",
    category: "staking",
    url: "https://drop.money",
    about: "Neutron liquid staking. Llama TVL is $0 after the drain; the smoke allows $0.",
    notes: [
      "Neutron Prop 9 governance attack emptied Astroport and Drop contracts (~$9.4M) on 2026-09-22 ([Altcoin Buzz](https://www.altcoinbuzz.io/cosmos-hub-moves-2-1m-of-stolen-atom-after-25-hour-halt), 2026-09-23).",
    ],
  },
  {
    id: "kinetiq",
    name: "Kinetiq",
    category: "staking",
    url: "https://kinetiq.xyz/",
    about: "HYPE liquid staking on Hyperliquid L1. Analytics adds fees/revenue; the smoke is TVL-only.",
    notes: [
      "kPoints program ended: 36.8M kPoints → 50M KNTQ (5% of the 1B max supply), claimable at a fixed $0.26 for 10 days from 2026-10-01 (up to ~$13M gross); KNTQ fell 20%+ from ~$0.448 ATH to ~$0.33 ([CryptoBriefing](https://cryptobriefing.com/kinetiq-ends-kpoints-kntq-price-drop/), 2026-10-02; [The Defiant](https://thedefiant.io/news/defi/kinetiq-ends-kpoints-with-paid-claim-as-kntq-drops-23), 2026-10-02). The monitor reads TVL and fees, not the claim sale.",
    ],
  },

  // Restaking
  {
    id: "eigenlayer",
    name: "EigenLayer (EigenCloud)",
    category: "restaking",
    url: "https://www.eigenlayer.xyz",
    about: "Ethereum restaking. Slug `eigencloud`; `eigenlayer` resolves to the same entry.",
  },
  {
    id: "etherfi",
    name: "ether.fi",
    category: "restaking",
    url: "https://www.ether.fi",
    about: "LRT turning neobank. Analytics adds fees/revenue; the smoke requires positive 24h revenue.",
    notes: [
      `Exiting EigenLayer restaking (<1% of assets still restaked as of August); card share of monthly revenue 17% (Jan) → 46% (Jul); Q2'26 card gross profit $3.14M vs EigenLayer restaking $2.87M; Llama gross profit fell 47% from $18.71M (Q3'25) to $9.99M (Q2'26) (${COINDESK_LRT}).`,
      FEES_NOTE,
    ],
  },
  {
    id: "kelp",
    name: "Kelp",
    category: "restaking",
    url: "https://kelpdao.xyz",
    about: "Liquid restaking. Analytics adds fees/revenue; the smoke requires positive 24h revenue.",
    notes: [
      LRT_COMBINED,
      "Kelp books $460,600 EIGEN rewards as both revenue and cost of revenue (pass-through).",
      FEES_NOTE,
    ],
  },
  {
    id: "bedrock",
    name: "Bedrock",
    category: "restaking",
    url: "https://www.bedrock.technology",
    about: "Liquid restaking. Analytics adds fees/revenue; the smoke requires positive 24h revenue.",
    notes: [LRT_COMBINED, FEES_NOTE],
  },
  {
    id: "swell",
    name: "Swell",
    category: "restaking",
    url: "https://www.swellnetwork.io",
    about: "Liquid restaking. Smoke is TVL-only (Llama daily revenue is often $0).",
    notes: [`Swell recorded $22,370 gross profit in Q2'26. ${LRT_COMBINED}`, FEES_NOTE],
  },
  {
    id: "renzo",
    name: "Renzo",
    category: "restaking",
    url: "https://www.renzoprotocol.com",
    about: "Liquid restaking. Smoke is TVL-only (some revenue days are $0).",
    notes: [LRT_COMBINED, FEES_NOTE],
  },
  {
    id: "puffer",
    name: "Puffer Finance",
    category: "restaking",
    url: "https://www.puffer.fi",
    about: "Liquid restaking. Smoke is TVL-only (revenue is lumpy).",
    notes: [`Puffer Finance (raised $23M) recorded $21,590 gross profit in Q2'26. ${LRT_COMBINED}`, FEES_NOTE],
  },

  // Stablecoins & RWA
  {
    id: "sky",
    name: "Sky (ex-Maker)",
    category: "stable-rwa",
    url: "https://sky.money",
    about: "DSR from the Maker Pot plus Maker and Sky TVL rows.",
    data: "On-chain RPC, DefiLlama",
  },
  {
    id: "ethena",
    name: "Ethena",
    category: "stable-rwa",
    url: "https://ethena.fi",
    about: "USDe / sUSDe: TVL, mint/redeem availability, and on-chain supply.",
    data: "DefiLlama, Ethena API, on-chain RPC",
  },
  {
    id: "circle",
    name: "Circle",
    category: "stable-rwa",
    url: "https://circle.com",
    about: "USDC issuer protocol row.",
    notes: [
      "Circle 24h revenue $7.35M per DefiLlama ([BlockBeats](https://en.theblockbeats.news/flash/369146), 2026-09-26).",
    ],
  },
  {
    id: "ondo",
    name: "Ondo Finance",
    category: "stable-rwa",
    url: "https://ondo.finance",
    about: "Tokenized treasuries and securities. No swap path (allowlisted transfers).",
  },
  {
    id: "buidl",
    name: "BlackRock BUIDL",
    category: "stable-rwa",
    url: "https://www.blackrock.com",
    about: "Tokenized fund. `analytics:buidl:supply` reads `totalSupply` when `BUIDL_TOKEN_ADDRESS` is set.",
    data: "DefiLlama, on-chain RPC",
  },
  {
    id: "usdai",
    name: "USD AI",
    category: "stable-rwa",
    url: "https://usdai.money",
    about: "GPU-loan backed stablecoin.",
    notes: [
      "$128.9M GPU financing facility, its largest to date ([PR Newswire](https://www.prnewswire.com/news-releases/usdai-announces-128-9m-gpu-financing-facility-its-largest-to-date-302888224.html), 2026-09-23).",
    ],
  },

  // Bridges & chains
  {
    id: "stargate",
    name: "Stargate Finance",
    category: "bridge-chain",
    url: "https://stargate.finance",
    about: "LayerZero bridge: V1+V2 parent (`stargate-finance`) and V2 only (`stargate-v2`).",
  },
  {
    id: "meter",
    name: "Meter Passport",
    category: "bridge-chain",
    url: "https://meter.io",
    about: "Bridge (unbacked wMTRG mint, 2026-09-23).",
  },
  {
    id: "gravity",
    name: "Gravity by Galxe",
    category: "bridge-chain",
    url: "https://gravity.xyz",
    about: "Gravity chain bridge.",
    notes: [
      "$G cross-exchange spread hit 40% on bridge limits ([GetChain](https://www.getchainnews.com/en/newflash/E6KkDYb68k), 2026-09-20); Fast Withdraw cut settlement to Ethereum from 7 days to ~10 min.",
    ],
  },
  {
    id: "payy",
    name: "Payy Network",
    category: "bridge-chain",
    url: "https://payy.network",
    about:
      "ZK payments rollup (bridge drained 2026-09-24). No Llama slug: reads USDC `balanceOf` the Ethereum bridge. Needs `ETHEREUM_RPC_URL`.",
    data: "On-chain RPC",
  },
  {
    id: "arc",
    name: "Arc Chain",
    category: "bridge-chain",
    url: "https://circle.com",
    about: "Circle's L1 (chainId 5042). Chain TVL, not a protocol row; not an L2.",
    data: "DefiLlama chains",
    notes: [
      "Arc DeFi TVL $494M, +44.52% 7d, 10 days after mainnet ([TokenPost](https://www.tokenpost.com/news/technology/24382), 2026-09-26).",
    ],
  },
  {
    id: "blast",
    name: "Blast",
    category: "bridge-chain",
    url: "https://blast.io",
    about:
      "Blast L2 (chainId 81457). Chain TVL from DefiLlama `/v2/chains`, not a protocol slug. The smoke allows $0 TVL while the chain winds down and fails if the Blast row disappears.",
    data: "DefiLlama chains",
    notes: [
      "Blast L2 is shutting down (announced 2026-10-02) because operating costs exceed revenue; TVL ~$32M vs >$2B peak (−98%); ~$63.03M still in the canonical bridge on Ethereum; normal-UI withdrawals until 2026-10-26 after ~1-week Lido unwind ([The Block](https://www.theblock.co/news/business/2026-10-02-blast-ethereum-layer-2-shutting-down-417583), 2026-10-02; [Cointelegraph](https://cointelegraph.com/news/blast-to-wind-down-ethereum-l2-after-costs-outpace-revenue), 2026-10-02; [The Crypto Times](https://www.cryptotimes.io/2026/10/02/blast-shuts-down-ethereum-l2-as-operating-costs-exceed-revenue/), 2026-10-02). The monitor reads chain TVL, not the Ethereum bridge balance.",
    ],
  },
  {
    id: "stellar",
    name: "Stellar",
    category: "bridge-chain",
    url: "https://stellar.org",
    about: "Stellar DeFi chain TVL from DefiLlama `/v2/chains` (name `Stellar`), 7d/30d change, and DEX volume.",
    data: "DefiLlama chains",
    notes: [
      "DeFi TVL hit a record of nearly $273M on 2026-10-02 (from ~$265M a week earlier), with $934.5M in stablecoins and ~$2.82B active RWA AUM ([BSC News](https://bsc.news/news/stellar-defi-tvl-record-rwa), 2026-10-05; [Blockonomi](https://blockonomi.com/stellar-defi-hits-new-tvl-record-as-active-wallets-near-100000/), 2026-10-03). DefiLlama's daily record close is $272.8M on 2026-10-01. Analytics prints live chain TVL and DEX volume, not stablecoins or RWAs.",
    ],
  },
  {
    id: "abstract",
    name: "Abstract",
    category: "bridge-chain",
    url: "https://www.abs.xyz/",
    about:
      "Ethereum L2 (chainId 2741) winding down. Chain TVL from DefiLlama `/v2/chains` (name `Abstract`), plus DEX volume. Shuts down 2026-12-15. Not the protocol slug `abstract`.",
    data: "DefiLlama chains",
    notes: [
      "Abstract (Pudgy Penguins / Igloo) is winding down; the chain shuts down 2026-12-15 and funds not bridged out become inaccessible. Peaked ~$57M TVL / $32M daily DEX volume; reported ~$9.5M TVL / ~$316K daily DEX volume at the announcement ([The Block](https://www.theblock.co/news/ecosystems/2026-10-06-abstract-ethereum-layer-2-shutting-down-pudgy-penguins-igloo-417855), 2026-10-06; [TokenPost](https://www.tokenpost.com/news/technology/27126), 2026-10-07; [X](https://x.com/NickPreszler/status/2107574455106994679), 2026-10-06). Analytics prints live `/v2/chains` TVL and `/overview/dexs/Abstract`, not that snapshot. Protocol slug `abstract` is a separate Chain-category page and is not this monitor.",
    ],
  },
  {
    id: "robinhood",
    name: "Robinhood Chain",
    category: "bridge-chain",
    url: "https://robinhood.com",
    about:
      "Robinhood Chain (chainId 4663). Chain TVL, DEX volume, and fees from DefiLlama. The npm script percent-encodes the space in `Robinhood Chain`.",
    data: "DefiLlama chains",
    notes: [
      "About three months old: ~$1.04B TVL, ~$5M app fees in 24h, ~$1.5B DEX volume ([X](https://x.com/ripchillpill/status/2106018905907237207), 2026-10-02). Analytics prints live chain TVL, `/overview/dexs/Robinhood%20Chain`, and `/overview/fees/Robinhood%20Chain`.",
    ],
  },
  {
    id: "kinto",
    name: "Kinto",
    category: "bridge-chain",
    url: "https://kinto.xyz",
    about: "KYC-modular L2.",
  },

  // Launchpads, prediction & other
  {
    id: "pumpfun",
    name: "pump.fun",
    category: "other",
    url: "https://pump.fun",
    about:
      "Solana launchpad. Llama TVL is empty, so analytics shows fees/revenue and the smoke requires positive 24h revenue.",
    notes: [
      "$1.96M 24h protocol revenue, ahead of Hyperliquid's $1.86M ([BlockBeats](https://en.theblockbeats.news/flash/369146), 2026-09-26).",
    ],
  },
  {
    id: "polymarket",
    name: "Polymarket",
    category: "other",
    url: "https://polymarket.com",
    about: "Prediction market. The Llama slug tracks the international book.",
    notes: [
      "Polymarket U.S. just over $1.03B notional volume on the Sep 19-20 weekend ([SCCG](https://sccgmanagement.com/sccg-articles/2026/09/23/kalshi-crypto-volume-allegations-emerge-against-backdrop-of-764-billion-prediction-market-record/), 2026-09-23).",
    ],
  },
  {
    id: "zama",
    name: "Zama",
    category: "other",
    url: "https://zama.ai",
    about: "Confidential DeFi via FHEVM. No swap path (toolchain-specific).",
  },
  {
    id: "aztec",
    name: "Aztec",
    category: "other",
    url: "https://aztec.network",
    about: "Privacy L2. Llama currently surfaces Aztec Connect under `aztec`, which may differ from Ignition branding.",
  },
  {
    id: "bitget",
    name: "Bitget",
    category: "other",
    url: "https://www.bitget.com",
    about: "CEX reserve TVL by chain (hot-wallet incident, 2026-09-24). Read-only; not a DeFi venue.",
  },
];

/** Script families that span protocols. Same id rule as PROTOCOLS. */
const BOARDS = [
  {
    id: "eth",
    name: "Ethereum boards",
    group: "boards",
    about: "DEX share, lending movers, yield, TVL drivers, Aave mix, Pendle markets.",
  },
  { id: "ethbtc", name: "ETH vs BTC", group: "boards", about: "Chain TVL and price ratio windows." },
  { id: "btc", name: "Bitcoin wraps", group: "boards", about: "Wrap / restake TVL and the Circle Bitcoin trail." },
  { id: "l2", name: "L2 overview", group: "boards", about: "Rollup TVL + DEX 30d volume." },
  { id: "rwa", name: "RWA overview", group: "boards", about: "Tokenization TVL board." },
  { id: "nft", name: "NFT markets", group: "boards", about: "Marketplace fees + collection watchlist." },
  {
    id: "airdrop",
    name: "Airdrop watch",
    group: "boards",
    about: "Points / airdrop research calendar (not a claimer).",
  },
  { id: "lending", name: "Lending aggregates", group: "boards", about: "Rates and TVL across lending protocols." },
  { id: "staking", name: "Staking aggregates", group: "boards", about: "LST comparison and category view." },
  { id: "amm", name: "AMM aggregate", group: "boards", about: "Headline TVL for major AMM families." },
  { id: "dex", name: "Multi-DEX prices", group: "boards", about: "On-chain price comparison across DEXs." },
  { id: "weekly", name: "Weekly blocks", group: "boards", about: "Block-level transaction and gas analysis." },
  { id: "quote", name: "Quote", group: "tooling", about: "Single quote without sending a tx." },
  { id: "swap", name: "Swap simulation", group: "tooling", about: "Simulated swap execution." },
  { id: "multi", name: "Multi-protocol", group: "tooling", about: "Quote the same trade across protocols." },
  { id: "pairs", name: "Pair sweep", group: "tooling", about: "Quote every configured pair." },
  { id: "validate", name: "Fork validator", group: "tooling", about: "Validate fork simulations (needs anvil)." },
  { id: "autoroute", name: "Auto-route swap", group: "tooling", about: "Best-price routing example." },
  { id: "crosschain", name: "Cross-chain compare", group: "tooling", about: "Same pair quoted on many chains." },
  { id: "example", name: "Unified Uniswap swap", group: "tooling", about: "Auto-routes across Uniswap versions." },
  { id: "check", name: "Wallet check", group: "tooling", about: "Pre-flight balance / allowance checks." },
];

/** Descriptions for scripts whose purpose cannot be derived from their command line. */
const SCRIPT_DESCRIPTIONS = {
  "crosschain:uniswap:tvl": "TVL across Uniswap V1–V4 on every configured chain",
  "crosschain:uniswap:volume": "24h volume across Uniswap V1–V4 on every configured chain",
  "crosschain:uniswap:liquidity": "Live liquidity flows from V2/V3/V4 mint and burn events",
  "crosschain:uniswap:weekly:tvl": "Daily TVL history for the past week (CSV in `output/`)",
  "crosschain:uniswap:weekly:volume": "Daily volume history for the past week (CSV in `output/`)",
  "crosschain:uniswap:weekly:liquidity": "Daily liquidity changes for the past week",
  "crosschain:curve:tvl": "TVL across Curve deployments on every configured chain",
  "crosschain:curve:volume": "24h volume across Curve deployments",
  "crosschain:curve:weekly:tvl": "Daily TVL history for the past week (CSV in `output/`)",
  "crosschain:curve:weekly:volume": "Daily volume history for the past week (CSV in `output/`)",
  "crosschain:balancer:tvl": "TVL across Balancer V2/V3 deployments",
  "crosschain:balancer:volume": "24h volume across Balancer deployments",
  "crosschain:balancer:weekly:tvl": "Daily TVL history for the past week (CSV in `output/`)",
  "crosschain:balancer:weekly:volume": "Daily volume history for the past week (CSV in `output/`)",
  "crosschain:sushiswap:tvl": "TVL across SushiSwap V2/V3 deployments",
  "crosschain:sushiswap:volume": "24h volume across SushiSwap deployments",
  "crosschain:sushiswap:weekly:tvl": "Daily TVL history for the past week (CSV in `output/`)",
  "crosschain:sushiswap:weekly:volume": "Daily volume history for the past week (CSV in `output/`)",

  "analytics:uniswap:prices": "Compare V2/V3/V4 prices and fee tiers for the configured pairs",
  "analytics:curve:pools": "Virtual price, balances, APY and imbalance per pool",
  "analytics:balancer:pools": "Weighted pool balances, weight drift and impermanent loss",
  "analytics:sushiswap:pools": "SushiSwap vs Uniswap prices per pair",
  "analytics:uniswapx:activity":
    "Recent `Fill` events on the reactor (`CHAIN`, `UNISWAPX_REACTOR`, `UNISWAPX_MAX_BLOCKS`)",
  "analytics:aave:markets": "Aave V3 supply/borrow rates and utilization on every configured chain",
  "analytics:aave:versions": "Aave V2 vs V3 rates across L1 and L2s",
  "analytics:aave:liquidations": "Recent `LiquidationCall` logs; health factors for `AAVE_WATCH_ADDRESSES`",
  "analytics:morpho:optimizer": "Best Morpho Blue markets per loan asset vs Aave V3 rates",
  "analytics:keyrock:vault": "Total assets, liquidity, net APY and curators for the Morpho vault",
  "analytics:lido:staking": "stETH APR, TVL and stETH/wstETH peg (L2 peg needs RPCs)",
  "analytics:stakestone:staking": "TVL and optional chart APY, compared to Lido",
  "analytics:kintsu:staking": "TVL and yields-chart APY, compared to Lido and StakeStone",
  "analytics:sky:rates": "DSR from the Maker Pot plus Maker and Sky TVL rows",
  "analytics:ethena:monitor": "TVL, mint/redeem pairs and USDe / sUSDe `totalSupply`",
  "analytics:buidl:supply": "ERC-20 `totalSupply` when `BUIDL_TOKEN_ADDRESS` is set",
  "analytics:payy:bridge": "USDC `balanceOf` the Payy Ethereum bridge",
  "analytics:arc:chain":
    "Arc chain TVL from DefiLlama `/v2/chains`, plus 7d/30d change (`LLAMA_CHAIN_NAME` defaults to Arc)",
  "analytics:blast:chain": "Blast chain TVL from DefiLlama `/v2/chains` (`LLAMA_CHAIN_NAME=Blast`), plus 7d/30d change",
  "analytics:abstract:chain":
    "Abstract chain TVL from DefiLlama `/v2/chains` (`LLAMA_CHAIN_NAME=Abstract`), 7d/30d change, DEX volume, and the 2026-12-15 shutdown note",
  "analytics:robinhood:chain":
    "Robinhood Chain TVL, DEX volume, and fees (`LLAMA_CHAIN_NAME` percent-encoded as `Robinhood%20Chain`)",
  "analytics:stellar:chain": "Stellar chain TVL from DefiLlama `/v2/chains` (`LLAMA_CHAIN_NAME=Stellar`), 7d/30d change, and DEX volume",
  "analytics:near:exploit":
    "NEAR Intents exploit amount, chain, and technique from DefiLlama `/hacks` (`LLAMA_HACK_ID=6225`, since 2026-09-30)",
  "simulate:near:exploit:smoke": "Fails unless DefiLlama `/hacks` lists a NEAR Intents incident since 2026-09-30 with a positive amount",
  "analytics:derive:options":
    "Derive options notional and premium (24h/7d/30d), TVL, share vs Paradex and the rest, plus Hypercall TVL",
  "simulate:derive:smoke": "Fails unless Derive 30d options notional is > 0 (`/summary/options/derive-options`)",
  "analytics:reya:dex": "DefiLlama TVL + TVL by chain (`REYA_LLAMA_SLUG`, default `reya-perps`)",
  "analytics:ammalgam:hybrid": "DefiLlama summary when `AMMALGAM_LLAMA_SLUG` is set",
  "analytics:curvy:aggregator": "DefiLlama summary (`CURVY_LLAMA_SLUG`, default `curves-protocol`)",

  "analytics:eth:dex-share": "Ethereum venue volume: Uniswap V4 vs V3 vs 1inch Aqua vs long-tail",
  "analytics:eth:lending-movers": "Ethereum lending/CDP 7d TVL change (Aave V4, Spark, Morpho)",
  "analytics:eth:yield": "Pendle V2 DEX volume plus Ethereum yield TVL movers",
  "analytics:eth:tvl-drivers": "Ethereum DeFi 7d $ inflow/outflow by protocol (CEX omitted)",
  "analytics:eth:aave-mix": "Aave V3 vs V4 vs Horizon collateral and borrowed on Ethereum",
  "analytics:eth:pendle-markets": "Pendle chain TVL plus Ethereum PT/YT market liquidity",
  "analytics:ethbtc:tvl": "Ethereum vs Bitcoin chain TVL: last month, this month, this week",
  "analytics:ethbtc:ratio": "ETH vs BTC spot and ratio for the same windows (CoinGecko)",
  "analytics:btc:wraps": "Bitcoin wrap / restake TVL (WBTC, Babylon, Citrea, Nexus)",
  "analytics:btc:wrap-trail": "Circle Bitcoin daily TVL path vs Kraken / Babylon / Nexus",
  "analytics:l2:overview": "TVL + DEX 30d volume for Arb/OP/Base/Polygon/Scroll/zkSync/Linea/Unichain",
  "analytics:rwa:overview": "RWA protocol TVL (DigiFT, Huma, Ondo, BUIDL, thBill)",
  "analytics:nft:markets": "Marketplace fees + 10-collection watchlist (`RESERVOIR_API_KEY` for floors)",
  "analytics:airdrop:watch": "Research calendar; optional join to a `trends-report.json` (`TRENDS_REPORT`)",
  "analytics:lending:aggregate": "DefiLlama TVL for Aave, Morpho, Compound, Spark, Venus, Euler, Curvance, Resolv",
  "analytics:lending:rates": "Best supply/borrow across Aave (on-chain) + Morpho (API) per chain",
  "analytics:lending:venues": "Compound V3 + Venus TVL on BSC and L2s (`LENDING_LLAMA_CHAINS`)",
  "analytics:staking:aggregate": "LST category view from DefiLlama",
  "analytics:staking:compare": "Lido vs StakeStone vs Kintsu heuristic score",
  "analytics:amm:aggregate": "Headline TVL for major AMMs (`AMM_PROTOCOLS`)",
  "analytics:dex:prices": "Prices across Uniswap, Sushi, Curve; supports `CHAIN` and `PAIR_GROUP=daytrade`",
  "analytics:weekly:blocks": "Block-level transaction and gas analysis",
  "simulate:weekly:blocks": "Same as `analytics:weekly:blocks`",

  "simulate:aave:v3:fork": "Aave V3 supply/borrow flow on a fork",
  "simulate:aave:markets": "Read-only Aave V3 market state (`SIMULATE_ONLY=true`)",
  "simulate:aave:versions": "Aave V2 vs V3 reads on a fork",
  "simulate:aave:liquidations": "Replay liquidation scenarios on a fork",
  "simulate:morpho:fork": "Read Morpho Blue `market(bytes32)` (optional `MORPHO_MARKET_ID`)",
  "simulate:morpho:smoke": "Morpho GraphQL API smoke",
  "simulate:lido:fork": "Lido stake flow on a fork",
  "simulate:lido:read": "Read-only Lido state (`SIMULATE_ONLY=true`)",
  "simulate:uniswapx:fill": "Replay a historical fill via `eth_call` at its block (`UNISWAPX_REPLAY_TX`)",
  "simulate:lending:rates:smoke": "Smoke for `analytics:lending:rates`",
  "simulate:staking:compare:smoke": "Smoke for `analytics:staking:compare`",
  "simulate:quote": "Quote one swap without sending (`SIMULATE_ONLY=true`)",
  "simulate:swap": "Simulate one swap end to end",
  "simulate:multi:quote": "Quote the same trade on every protocol (`SIMULATE_ONLY=true`)",
  "simulate:multi": "Simulate the same trade on every protocol",
  "simulate:validate:forks": "Run every fork simulation against anvil",
  "test:pairs": "Quote the default pair group",
  "test:pairs:all": "Quote every configured pair (`GROUP=all`)",

  "swap:uniswap:v2": "Uniswap V2 swap, including multi-hop routes",
  "swap:uniswap:v3": "Uniswap V3 swap with fee-tier selection",
  "swap:uniswap:v4": "Uniswap V4 swap through the singleton PoolManager",
  "swap:curve": "Swap through a Curve pool",
  "swap:balancer": "Swap through the Balancer V2 Vault",
  "swap:sushiswap": "SushiSwap V2/V3 swap",
  "swap:aerodrome": "Uniswap V3 reference quote on Base (Slipstream quoter limitation)",
  "swap:velodrome": "Uniswap V3 reference quote on Optimism (Slipstream quoter limitation)",
  "swap:uniswapx": "Pointer to UniswapX monitor and replay (orders are signed, not routed)",
  "swap:autoroute": "Route across Uniswap, Sushi, Curve, Balancer and execute on the best price",
  "swap:crosschain": "Compare the same pair across chains",
  "swap:example": "Auto-route across Uniswap versions",
  "swap:check": "Wallet balance and allowance pre-flight",
};

module.exports = { CATEGORIES, BOARD_GROUPS, PROTOCOLS, BOARDS, SCRIPT_DESCRIPTIONS };
