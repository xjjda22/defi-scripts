# Protocol script coverage

Architecture: [`00-architecture.md`](./00-architecture.md). The per-protocol command list lives in the generated [`02-protocol-catalog.md`](./02-protocol-catalog.md) (or `npm run catalog -- <protocol>` in a terminal). This document covers what each script family means, what is deliberately out of scope, and how to add a protocol.

## Legend

- **Cross-chain (`crosschain:*`)** — Subgraph-backed TVL, volume, and (for Uniswap) liquidity trackers under `src/crosschain/`. Only **Uniswap, Curve, Balancer, and SushiSwap** have these scripts.
- **Analytics (`analytics:*`)** — Dedicated monitors or generic DefiLlama summaries (`DEFILLAMA_SLUG`), plus category aggregators such as `analytics:lending:aggregate` and `analytics:amm:aggregate`.
- **Smoke (`simulate:*:smoke`)** — Pass/fail check of the same data source as the analytics twin; exits non-zero when the source breaks.
- **Simulate (`simulate:*`)** — On-chain fork / quote flows and fill replays.
- **Fork (`fork:<protocol>:<action>`)** — Anvil fork actions that impersonate a whale, assert a balance or position change, and exit non-zero on failure. `npm run fork:all` runs the suite. See [04-fork-testing.md](./04-fork-testing.md).
- **Swap (`swap:*`)** — Wallet-backed examples in `src/examples/`. Only major pool DEX routes have named scripts; lending, LST, perp, and RWA protocols do not (by design).

## Swap / simulate: not applicable in this stack

These are **not** modeled as `swap:*` or `dexForkRunner` pool quotes in this repo:

- **Solana AMM (e.g. HumidiFi)** — requires a non-ethers client.
- **Perp / hybrid DEX (Reya, Lighter, Aster, Drake)** — not spot Uniswap-style routers; use analytics / Llama smokes only.
- **RWA / allowlisted transfer (Ondo, BUIDL)** — swap examples are usually blocked without institutional setup.
- **Privacy / FHEVM (Zama)** — toolchain-specific.
- **Morpho** — no `swap:morpho` (it would be misleading); `simulate:morpho:fork` reads `market(bytes32)` instead.

## Aerodrome / Velodrome (Slipstream) — reference quotes

Slipstream **on-chain quoters** at the published addresses do not return success for standard `QuoterV2.quoteExactInputSingle.staticCall` in this codebase (calls revert). To still ship useful scripts:

- **`simulate:dex:aerodrome:v3`** / **`simulate:dex:velodrome:v3`** set `DEFI_SLIPSTREAM_PROXY=1` and run **Uniswap V3** on the same chain (`base` / `optimism`) with a console note — liquid reference for WETH/USDC-style pairs, not Slipstream execution.
- **`swap:aerodrome`** / **`swap:velodrome`** quote **Uniswap V3** on that chain and explain the limitation; execute via protocol UI or extend with a compatible quoter path.
- **`chains.js`** still lists `aerodrome.v3` / `velodrome.v3` (router, quoter, **pool factory from `router.factory()`**) for future integration via `v3Swap` + `dexId`.

## Aggregate rows without their own scripts

- **Curvance, Resolv, Compound V3, Venus** — rows in `analytics:lending:aggregate` (`LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js`), checked by `simulate:lending:aggregate:smoke`. Euler V2 stays in that aggregate. `fork:euler:deposit` is a separate ERC-4626 round trip of one Ethereum Euler Earn vault.
- **AMM families** — rows in `analytics:amm:aggregate` (`AMM_PROTOCOLS` in `src/analytics/aggregators/allAmmDexAggregator.js`), reused by `simulate:amm:aggregate:smoke`.
- **Landscape boards** (L2, ETH, BTC, RWA, NFT, airdrop) are read-only DefiLlama / calendar views: not claimers, not MEV submit.

## Not covered yet

- **Milk Road Swap**, **Soneium DEX**, **MegaETH AMM** — no verified DefiLlama slug or on-chain scope; add after a listing exists. Soneium and MegaETH are covered at chain level (`analytics:soneium:chain`, `analytics:megaeth:chain`).
- **Curvy v2** (ZK stealth aggregator) — no DefiLlama listing. The old monitor read `curves-protocol`, an unrelated SocialFi app, so it was removed.
- **Ondo / BUIDL full AUM** — DefiLlama's protocol TVL is empty for RWA listings; the monitors read Ethereum supply only (see the RWA note under recipe 4).

## Retired monitors

Removed on 2026-10-10 because DefiLlama marks the listing dead or the venue holds ~$0 with no volume: Vertex Perps, Kwenta, RabbitX, Perennial, Polynomial, Odos, Drop, Aztec Connect. The generic smoke now fails on a dead listing, so a venue that shuts down shows up as a smoke failure instead of a silent pass.

## Adding a missing protocol

1. Confirm a **DefiLlama slug** via `https://api.llama.fi/protocol/<slug>` (HTTP 200 and sensible `name`).
2. **Analytics:** add a line to `package.json`, e.g. `DEFILLAMA_SLUG=<slug> DEFILLAMA_LABEL=<Name> node src/analytics/protocols/llama/dexProtocolMonitor.js` (copy `analytics:aster:perps` pattern).
3. **Smoke:** add `SMOKE_SLUG=<slug> node src/simulation/api/smokeDefiLlamaProtocol.js` (copy `simulate:lighter:smoke`). The smoke fails when DefiLlama marks the listing dead (`deadFrom` / `deprecated`; override with `SMOKE_ALLOW_DEAD=1`) and when TVL is not positive. TVL may be $0 when another check proves the venue is live (`SMOKE_FEES=1`, `SMOKE_OI=1`, `SMOKE_VOLUME=…`) or `SMOKE_MIN_TVL_USD=0` is set; any other `SMOKE_MIN_TVL_USD` raises the floor. Use `SMOKE_ALLOW_NOT_LISTED=1` only when a 404 should not fail CI.
   - **Aggregators, prop AMMs, prediction markets** hold no TVL: add `DEFILLAMA_VOLUME=aggregators` (or `dexs`) to the analytics line and `SMOKE_VOLUME=aggregators` (or `dexs`) to the smoke, which then requires positive 30d volume from `/summary/<kind>/<slug>` (copy `analytics:cowswap:dex` / `simulate:cowswap:smoke`, or `analytics:kalshi:pred` for `dexs`).
4. **No slug but a checkable contract balance** (e.g. a drained bridge): reuse `src/analytics/protocols/onchain/erc20BalanceMonitor.js` with `ERC20_TOKEN` / `ERC20_HOLDER` / `ERC20_CHAIN` (copy `analytics:payy:bridge`).
   - **RWA tokens** (DefiLlama protocol TVL is empty for RWA listings): add the token address to `RWA` in `src/catalog/contracts.js`, then run `src/analytics/protocols/onchain/rwaSupplyMonitor.js` and `src/simulation/api/smokeRwaSupply.js` with `RWA_TOKENS=<keys>` (copy `analytics:ondo:markets` / `simulate:ondo:smoke`). Value is Ethereum `totalSupply` x the DefiLlama coins price; other chains are not summed.
   - **Bridge / sidechain reserve with its own public audit API** (no slug, not an EVM chain): Liquid Network uses `src/analytics/protocols/liquid/pegReserveMonitor.js` (L-BTC supply vs federation reserve from liquid.network) and `src/simulation/api/smokeLiquidReserves.js` (copy `analytics:liquid:reserves` / `simulate:liquid:smoke`).
5. **Chain TVL, no protocol slug** (Arc, Blast, Abstract, Robinhood Chain, Stellar, Monad, MegaETH, Soneium): set `LLAMA_CHAIN_NAME` (default `Arc`) on `src/analytics/protocols/llama/arcChainMonitor.js` and `src/simulation/api/smokeArcChain.js` (copy `analytics:blast:chain` / `simulate:blast:smoke`). Analytics also prints 7d/30d TVL change from `/v2/historicalChainTvl/<name>`. `LLAMA_CHAIN_DEX=1` adds `/overview/dexs/<name>` (24h/7d/30d). `LLAMA_CHAIN_FEES=1` adds `/overview/fees/<name>`. `LLAMA_CHAIN_NOTE` (percent-encoded) is printed after the tables. A name with a space or `;` is percent-encoded in the npm script (`Robinhood%20Chain`) and decoded before the `/v2/chains` lookup; request paths are `encodeURIComponent`'d again. `LLAMA_CHAIN_MIN_TVL_USD=0` allows a $0 row; the smoke still fails if that chain row is missing or the API errors. `analytics:arc:chain` / `simulate:arc:smoke` leave the env unset.
6. **Options notional / premium** (Derive): `src/analytics/protocols/llama/deriveOptionsMonitor.js` reads `/summary/options/<slug>` with `dataType=dailyNotionalVolume` and `dailyPremiumVolume`, TVL from `/protocol/<parent>`, and venue share from `/overview/options`. Copy `analytics:derive:options` / `simulate:derive:smoke`. The smoke fails unless 30d notional is > 0 or the API errors. A venue with a protocol page but no options-volume adapter (Hypercall) is TVL-only — say volume is not tracked. Do not call `/summary/derivatives` (paywalled).
7. **Fees / revenue claims** (or $0 TVL, e.g. launchpads): add `DEFILLAMA_FEES=1` to the analytics line and `SMOKE_FEES=1` to the smoke (copy `analytics:pumpfun:launchpad` / `simulate:pumpfun:smoke`); the smoke then fails unless `/summary/fees/<slug>?dataType=dailyRevenue` has a positive 24h value. Leave `SMOKE_FEES` off when daily revenue is sometimes $0. Open interest (not volume) is `DEFILLAMA_OI=1`, which prints `/summary/open-interest/<slug>` `total24h` (copy `analytics:variational:perps`); add `SMOKE_OI=1` to the smoke to require a positive value (copy `simulate:variational:smoke`). For "OI at a yearly high" claims also set `DEFILLAMA_OI_HIGH=1`, which prints the year-to-date high and its date from the same endpoint's daily chart (copy `analytics:lighter:perps`). Do not call `/summary/derivatives` (paywalled). For month-sized claims ("revenue in September", "Q3 volume", "12-month revenue") add `DEFILLAMA_MONTHS=N` (1–24), which prints UTC calendar-month totals from the daily fees/revenue and volume charts (copy `analytics:hyperliquid:fees` or `analytics:near:intents-volume`). When daily net revenue can be negative (prop firms), add `SMOKE_FEES_DATATYPE=dailyFees` so the smoke checks 24h fees (copy `simulate:propr:revenue:smoke`). Chain fees for several chains at once: `src/analytics/protocols/llama/chainFeesBoard.js` with `LLAMA_FEES_SLUGS=a,b` prints 24h/7d/30d, prior 30d and the 30d change (copy `analytics:chains:fees`).
8. **Exploit amounts**: `src/analytics/protocols/llama/llamaHacksMonitor.js` reads the free DefiLlama `/hacks` list, matched by `LLAMA_HACK_ID` (DefiLlama protocol id) or `LLAMA_HACK_NAME`, optionally since `LLAMA_HACK_SINCE` (YYYY-MM-DD); `src/simulation/api/smokeLlamaHacks.js` fails unless a matching incident has a positive amount (copy `analytics:near:exploit` / `simulate:near:exploit:smoke`). DefiLlama often leaves `returnedFunds` empty, so cite recoveries from the news source.
9. **Lending-style** protocols: consider extending `LENDING_PROTOCOLS` in `src/analytics/aggregators/allLendingAggregator.js` and `SLUGS` in `src/simulation/api/smokeLendingLlamaAggregate.js` instead of one-off monitors. A one-off slug monitor already prints a `borrowed` row from `currentChainTvls` when DefiLlama has one. To **sum borrowed + TVL across several slugs** without double-counting, use `src/analytics/protocols/llama/llamaBorrowedSumMonitor.js` with `DEFILLAMA_SLUGS=slug-a,slug-b` (copy `analytics:curve:lending` / `simulate:curve:lending:smoke`); it prefers the aggregate `borrowed` key over summing `*-borrowed`. Morpho borrowing against one collateral family on one chain ("loans against BTC on Morpho Base"): `src/analytics/protocols/morpho/morphoCollateralBorrowMonitor.js` with `MORPHO_CHAIN_ID` and `MORPHO_COLLATERAL_MATCH` (copy `analytics:morpho:base-btc`). One stablecoin's supply: `src/analytics/protocols/llama/llamaStablecoinMonitor.js` with `LLAMA_STABLECOIN_ID` (copy `analytics:usdsui:supply`).
10. **Register it** in `PROTOCOLS` in `src/catalog/protocols.js` (id = second segment of the script name, category, url, one-line `about`, optional sourced `notes`). Scripts that are not DefiLlama one-liners also need a line in `SCRIPT_DESCRIPTIONS`. Ids may start with a digit (`3jane`).
11. Run `npm run catalog:docs`, then `npm run catalog:check` (fails on unregistered or undescribed scripts and on stale docs).

## Claim monitors (2026-10-21)

Window 2026-10-15 21:00Z to 2026-10-20 ~21:00Z. Live numbers move. These scripts print the current values, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:papertrade:revenue`, `simulate:papertrade:revenue:smoke` | Papertrade "$50M revenue in its first week". DefiLlama fees/revenue + month-to-date. | [X @patfscott](https://x.com/patfscott/status/2111185661432893613) (2026-10-16, Airdrop? / Inner Circle CT); [X @jussy_world](https://x.com/jussy_world/status/2111814590950711579) (2026-10-18) |
| `analytics:propr:revenue`, `simulate:propr:revenue:smoke` | Propr "zero to $5M in revenue in five months". DefiLlama fees by month (smoke checks 24h fees; net revenue can go negative). | [X @0xOwenThurm](https://x.com/0xOwenThurm/status/2112561870037000471) (2026-10-20, Smart Contract Security) |
| `analytics:popdex:tvl`, `simulate:popdex:tvl:smoke` | PopDEX "near 70M TVL". DefiLlama `popdex-bridge`. | [X @pandaBA007](https://x.com/pandaBA007/status/2112120838975816007) (2026-10-19, Airdrop?) |
| `analytics:plume:vaults`, `simulate:plume:vaults:smoke` | "Plume Vaults has attracted over $250M in RWA TVL". DefiLlama `plume-vaults` by chain. | [X @plumenetwork](https://x.com/plumenetwork/status/2112173816143282305) (2026-10-19, Privacy dashboard update) |
| `analytics:metric:dex`, `simulate:metric:dex:smoke` | Metric "$340M in RWA volume since launch"; ~20% of Robinhood stock-token DEX volume in its first day. DefiLlama `metric-v1` volume by month. | [X @realpepito](https://x.com/realpepito/status/2111843913938207090) (2026-10-18, Airdrop?); [X @Nomaticcap](https://x.com/Nomaticcap/status/2111211943713546518) (2026-10-16, Inner Circle CT) |
| `analytics:hypercall:perps`, `simulate:hypercall:perps:smoke` | Hypercall did more daily perp volume on Hyperliquid than Metamask and other builder front-ends. DefiLlama `hypercall-perps` volume. | [X @trajan0x](https://x.com/trajan0x/status/2111227611292799318) (2026-10-16, Airdrop?) |
| `analytics:fluid:lending`, `simulate:fluid:lending:smoke` | Fluid "$1.77B active loans". DefiLlama `fluid-lending` borrowed by chain + fees/revenue. | [X @DefiIgnas](https://x.com/DefiIgnas/status/2112554133257691275) (2026-10-20, Inner Circle CT) |
| `analytics:stonkfun:revenue`, `simulate:stonkfun:revenue:smoke` | StonkFun "$20.8M in protocol revenue" over 30 days. | [X @SolanaSensei](https://x.com/SolanaSensei/status/2112511403672404403) (2026-10-20, Inner Circle CT) |
| `analytics:collector-crypt:revenue`, `simulate:collector-crypt:revenue:smoke` | Collector Crypt "$24.3M in gross revenue in 24 hours" (DefiLlama books it as volume; fees/revenue are separate). | [X @sjdedic](https://x.com/sjdedic/status/2112628950736237001) (2026-10-20, Inner Circle CT) |
| `analytics:umia:launchpad`, `simulate:umia:launchpad:smoke` | Umia "averaging $300k per day" volume since launch. DefiLlama `umia` volume by month. | [X @merklefruit](https://x.com/merklefruit/status/2111127196349972663) (2026-10-16, Dev Alpha) |
| `analytics:near:intents-volume`, `simulate:near:intents-volume:smoke` | NEAR Intents Q3 volume ~$10.41B, September $4.80B. DefiLlama `near-intents` volume by month. | [X @nansen_ai](https://x.com/nansen_ai/status/2112530026088522110) (2026-10-20, ON CHAIN); [X @NEARProtocol](https://x.com/NEARProtocol/status/2112619862593880571) (2026-10-20, Airdrop?) |
| `analytics:tether:revenue`, `simulate:tether:revenue:smoke` | Tether "$5.79B revenue over the past 12 months". DefiLlama fees with 12 monthly totals. | [X @tokenterminal](https://x.com/tokenterminal/status/2112214218820702318) (2026-10-19, ON CHAIN) |
| `analytics:tron:revenue`, `simulate:tron:revenue:smoke` | Tron "monthly revenue reached $23.41M". DefiLlama fees slug `tron`. | [X @lookonchain](https://x.com/lookonchain/status/2112051216293540072) (2026-10-19, ON CHAIN) |
| `analytics:chains:fees`, `simulate:chains:fees:smoke` | Chain fee claims: Ethereum fees up ~48% over 30 days; ICP, Celestia and Algorand fees near zero relative to valuation. | [X @BitcoinStrat](https://x.com/BitcoinStrat/status/2111120582540718097) (2026-10-16); [ICP](https://x.com/BitcoinStrat/status/2111796169185903091), [Celestia](https://x.com/BitcoinStrat/status/2111812542750511303) (2026-10-18); [X @proofofjake_](https://x.com/proofofjake_/status/2111268012754194496) (2026-10-17); all Airdrop? |
| `analytics:uniswap:revenue`, `simulate:uniswap:revenue:smoke` | Uniswap protocol revenue $14.81M in September 2026. DefiLlama revenue by month. | [X @tokenterminal](https://x.com/tokenterminal/status/2111428989608923206) (2026-10-17, ON CHAIN) |
| `analytics:hyperliquid:fees`, `simulate:hyperliquid:fees:smoke` | Hyperliquid ~$91M trading fees in September. DefiLlama fees by month. | [X @BitcoinStrat](https://x.com/BitcoinStrat/status/2111781997534433773) (2026-10-18, Airdrop?) |
| `analytics:morpho:base-btc`, `simulate:morpho:base-btc:smoke` | Dollar loans against BTC on Morpho Base markets ~$1.6B at a ~5% borrow rate. Morpho GraphQL. | [X @Delphi_Digital](https://x.com/Delphi_Digital/status/2112197769645490434) (2026-10-19, MEV KOL); [X @maikaisogawa](https://x.com/maikaisogawa/status/2112197837496963515) (2026-10-19, Airdrop?) |
| `analytics:fx:morpho-vault`, `simulate:fx:morpho-vault:smoke` | f(x) Ecosystem USDC Morpho vault (RockawayX) at 8.26% with "$20M already in". Vault `0x2cA22cb25558fa2018ecb1CE4eD8AF92Ee7ea423` on Ethereum. | [X @PhilMrlo](https://x.com/PhilMrlo/status/2111175343319245156) (2026-10-16, Airdrop?) |
| `analytics:pumpfun:app`, `simulate:pumpfun:app:smoke` | pump.fun App gives away all app revenue; "paid out nearly $20M in just 2 months". DefiLlama `pump.fun-mobile-app` fees by month. | [X @sue_xbt](https://x.com/sue_xbt/status/2111328921631551595) (2026-10-17, Airdrop?) |
| `analytics:pons:revenue`, `simulate:pons:revenue:smoke` | $PONS daily revenue fell from $2M to $36K. DefiLlama parent `pons` fees/revenue by month. | [X @jussy_world](https://x.com/jussy_world/status/2112438814589571464) (2026-10-20, Inner Circle CT) |
| `analytics:solana:chain`, `simulate:solana:chain:smoke` | Solana DeFi TVL ~$5.85B. DefiLlama chain TVL, DEX volume, fees. | [X @satyamsharma_33](https://x.com/satyamsharma_33/status/2111896253181436399) (2026-10-18, Smart Contract Security) |
| `analytics:starknet:chain`, `simulate:starknet:chain:smoke` | Starknet "TVL stayed around 160 million". DefiLlama chain TVL + DEX volume. | [X @odin_free](https://x.com/odin_free/status/2112076313926533456) (2026-10-19, Airdrop?) |
| `analytics:usdsui:supply`, `simulate:usdsui:supply:smoke` | USDsui "record $80M supply". DefiLlama stablecoins id 373 (supply, change, ATH). | [X @Kylechasse](https://x.com/Kylechasse/status/2111302282700816514) (2026-10-17, Inner Circle CT) |
| `analytics:qubic:exploit`, `simulate:qubic:exploit:smoke` | Qubic network attack 2026-10-17. DefiLlama `/hacks` $1.3M. | [X @WuBlockchain](https://x.com/WuBlockchain/status/2111991201016721809) (2026-10-19, ON CHAIN) |
| `analytics:affluent:exploit`, `simulate:affluent:exploit:smoke` | Affluent (TON) exploit 2026-10-16, ~$1.05M. DefiLlama `/hacks` id 5726. | [DeTracker](https://feed.detracker.xyz/) (2026-10-16); [DefiLlama /hacks](https://defillama.com/hacks) |
| `analytics:alpscon:exploit`, `simulate:alpscon:exploit:smoke` | AlpsCon AI Trade Hub (BSC) exploit 2026-10-19, ~$152.8K, via a whitelisted Hardhat test wallet. | [Tozvan](https://tozvan.com/hacks/alpscon-ai-trade-hub-exploit) (2026-10-19); [telem.news](https://telem.news/security/alpscon-ai-exploited-152k-bnb-chain-whitelisted-hardhat-test-7ef99ce4) (2026-10-19) |

## Claim monitors (2026-10-16)

Live numbers move. These scripts print the current values, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:uncx:exploit`, `simulate:uncx:exploit:smoke` | UNCX Vesting V2 share-accounting exploit 2026-10-14; DefiLlama `/hacks` id 1765 shows ~$86K while Blockaid/news cite ~$1.49M across 4 chains by Oct 15. | [The Defiant](https://thedefiant.io/news/hacks/uncx-vesting-pool-exploited-for-about-86-000-blockaid-says) (2026-10-14); [TokenPost](https://www.tokenpost.com/news/technology/31955) (2026-10-14); [Crypto Times](https://www.cryptotimes.io/2026/10/15/uncx-exploit-escalates-vesting-v2-bug-drains-1-5m-across-4-chains-as-copycats-join-in/) (2026-10-15) |
| `analytics:pendle:hy-vault`, `simulate:pendle:hy-vault:smoke` | Pendle Ecosystem High Yield USDC Morpho vault topped ~$15.76M in a day (launched 2026-10-14). Vault `0xcf609F8327E68b42AF54F9D529b9f65d68038435` on Ethereum. | [Crypto Briefing](https://cryptobriefing.com/pendle-high-yield-usdc-vault-morpho/) (2026-10-15) |
| `analytics:curve:lending`, `simulate:curve:lending:smoke` | Curve LlamaLend active loans +68% in Q3 to $70.9M; sums `curve-llamalend` + `curve-llamalend-v2` borrowed without double-counting. | [crypto.news](https://crypto.news/curve-finance-loans-climb-68-in-q3-as-defi-lending/) (2026-10-15) |
| `analytics:balancer:protocol`, `simulate:balancer:protocol:smoke` | Balancer shutdown vote; pools withdrawals-only from 2026-10-30. DefiLlama parent slug + fees/revenue. | [rekt.news](https://www.rekt.news/out-of-balance) (2026-10-14) |
| `analytics:alchemix:base`, `simulate:alchemix:base:smoke` | Alchemix Base TVL ~$2.38M (Inner Circle CT). Prints DefiLlama TVL by chain. | [X @scupytrooples](https://x.com/scupytrooples/status/2110721103853400532) (2026-10-15) |

## Claim monitors (2026-10-12)

Live numbers move. These scripts print the current values, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:liquid:reserves`, `simulate:liquid:smoke` | Liquid Network peg-outs stay frozen 35 days after the 2026-09-06 Elements exploit; the federation reserve is ~603 BTC short of circulating L-BTC (85.8% coverage), and redemptions need full 1:1 backing plus security reviews. Reads the public liquid.network audit API (`/pegs`, `/reserves`, monthly series); peg-out status itself is not exposed. | [The Defiant](https://thedefiant.io/news/security/liquid-bitcoin-redemptions-remain-frozen-with-85-8-reserve-coverage) (2026-10-11); [TokenPost](https://www.tokenpost.com/news/technology/29859) (2026-10-11); [Crypto Briefing](https://cryptobriefing.com/liquid-network-halts-bitcoin-redemptions-reserve-gap/) (2026-10-11) |

## Claim monitors (2026-10-09)

Live numbers move. These scripts print the current DefiLlama windows, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:lighter:perps`, `simulate:lighter:smoke` | Lighter open interest hit a 2026 high; Robinhood partnership ~a quarter of OI and fee revenue, nearly 40% of daily active accounts. Now prints OI and its YTD high (`DEFILLAMA_OI=1 DEFILLAMA_OI_HIGH=1`); the smoke requires positive OI. | [TokenPost](https://www.tokenpost.com/news/business/28319) (2026-10-08); [Coinfomania](https://coinfomania.com/lighter-exchange-hits-2026-high-in-open-interest/) (2026-10-08); [X](https://x.com/Delphi_Digital/status/2108206129574539702) (2026-10-08) |
| `analytics:papertrade:perps`, `simulate:papertrade:smoke` | Papertrade (HyperEVM perps) opened pre-deposits 2026-10-08 with live trading expected after the 2026-10-10 HyperEVM upgrade; ~$25M in user deposits before launch (single X post). | [DeFi Prime](https://defiprime.com/papertrade-opens-predeposits-before-hyperevm-launch) (2026-10-09); [SignalPlus](https://t.signalplus.com/crypto-news/detail/papertrade-opens-predeposits-ahead-october-trading-launch?lang=en-US) (2026-10-08); [X](https://x.com/zoomerfied/status/2108565430499717403) (2026-10-09) |
| `analytics:stellar:chain`, `simulate:stellar:smoke` | Stellar DeFi TVL record of nearly $273M on 2026-10-02 (from ~$265M a week earlier). Chain name `Stellar`. | [BSC News](https://bsc.news/news/stellar-defi-tvl-record-rwa) (2026-10-05); [Blockonomi](https://blockonomi.com/stellar-defi-hits-new-tvl-record-as-active-wallets-near-100000/) (2026-10-03) |
| `analytics:near:exploit`, `simulate:near:exploit:smoke` | NEAR Intents exploited for ~$3.8M (USDT on BNB Chain, Sep 30 to Oct 1); funds returned in full 2026-10-02. Read from DefiLlama `/hacks` (id 6225); returned funds are not recorded there. | [Cointelegraph](https://cointelegraph.com/news/near-intents-recovers-entire-stolen-38m-after-ultimatum-to-exploiter) (2026-10-03); [Decrypt](https://decrypt.co/380014/near-intents-recovers-3-8-million-after-48-hour-ultimatum) (2026-10-04); [X](https://x.com/zacodil/status/2108480859942555933) (2026-10-09) |

## Trending showcase

`npm run ranking:top200` (alias `npm run showcase:build`) writes `showcase/data.json`: an overall top 200 and a ranking for each catalog category. It does not add per-protocol npm scripts, so `catalog:check` is unchanged. Methodology, the category map, and the Monday / Wednesday / Friday refresh are in [`03-showcase-ranking.md`](./03-showcase-ranking.md).

## Claim monitors (2026-10-07)

Live numbers move. These scripts print the current DefiLlama windows, not the snapshot in the source.

| Monitor | Claim | Sources |
|---|---|---|
| `analytics:abstract:chain`, `simulate:abstract:smoke` | Abstract (Ethereum L2) is winding down; the chain shuts down 2026-12-15 and funds not bridged out become inaccessible. Peaked ~$57M TVL / $32M daily DEX volume; reported ~$9.5M TVL / ~$316K DEX volume. Chain name `Abstract`. | [The Block](https://www.theblock.co/news/ecosystems/2026-10-06-abstract-ethereum-layer-2-shutting-down-pudgy-penguins-igloo-417855) (2026-10-06); [TokenPost](https://www.tokenpost.com/news/technology/27126) (2026-10-07); [X](https://x.com/NickPreszler/status/2107574455106994679) (2026-10-06) |
| `analytics:derive:options`, `simulate:derive:smoke` | September onchain options notional more than doubled to ~$4.83B (+121.7% MoM). Derive ~$3.8B, share 88.1% → 79.3%. Paradex notional +285% and OI >$250M. Hypercall ~11.2% share (TVL only here; volume is not tracked on DefiLlama). | [CryptoBriefing](https://cryptobriefing.com/derive-leads-onchain-options-volume-doubles/) (2026-10-05); [Coinfomania](https://coinfomania.com/onchain-options-market-surges-to-4-83b-as-competition-grows/) (2026-10-05); [X](https://x.com/Delphi_Digital/status/2107083828389187613) (2026-10-05) |
| `analytics:robinhood:chain`, `simulate:robinhood:smoke` | Robinhood Chain, about three months old: ~$1.04B TVL, ~$5M app fees in 24h, ~$1.5B DEX volume. Chain name `Robinhood Chain` (percent-encoded in the npm script). | [X](https://x.com/ripchillpill/status/2106018905907237207) (2026-10-02) |
