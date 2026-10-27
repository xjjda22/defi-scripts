# Changelog

Changes to defi-scripts. Newest first. Merged work is on `main`; anything marked
**local only** is committed on a branch that has not been pushed.

## [2026-10-28]

Mon/Wed/Fri pass: claims from 2026-10-22 21:00Z to 2026-10-27 ~21:00Z (this window also covers the 2026-10-26 claims run, which failed before building), the playground batch and the health check. Squash-merged on 2026-10-28 as [#37](https://github.com/xjjda22/defi-scripts/pull/37) (claims, `7fcf486`), [#38](https://github.com/xjjda22/defi-scripts/pull/38) (playground, `2326851`) and [#39](https://github.com/xjjda22/defi-scripts/pull/39) (health, `1c12e46`). This entry also records the 2026-10-26 playground batch, [#36](https://github.com/xjjda22/defi-scripts/pull/36) (`78c9954`, merged 2026-10-27), which had no changelog entry.

### Fixed

- `fork:upshift:deposit` (test bug): the 2-wei round-trip tolerance did not allow for the instant-exit price sitting 0.44 ppm below the deposit price. It now asserts the USDC paid equals the pre-tx `previewRedemption(shares, true)` after-fee amount, the fee is taken on the gross amount, and the gross is within 1 bp of the deposit.
- `fork:vesper:deposit` (timing flake, new in #38): sUSDv vests per second, so `requestRedeem` only matched the pre-tx `previewRedeem` when mined in the same second. It now asserts the pending request equals the rise in `totalAssetsInCooldown`, is at least the preview, and is within 1 bp.
- `fork:swell:deposit`: rswETH `deposit()` reverts `CoreMethodsPaused` (Swell's AccessControlManager has core methods, bot methods and withdrawals paused after the 2026-10-21 incident). A Puffer-style pre-check now FAILs early with `coreMethodsPaused=true` and sends no tx. It stays FAIL until Swell unpauses.
- Superstate USTB continuous price oracle stored lowercase; now EIP-55 `0xE4fA682f94610cCd170680cc3B045d77D9E528a8` (matches docs.superstate.com, has code, `fork:superstate:nav` PASS).
- `llamaStablecoinMonitor.js`: a gap of more than 3 days in a series no longer skews the 30d change (USDD's series has a 07-07 to 09-28 gap). Non-USD pegs now print in their own currency.
- Generated README and docs sections checked after the three squashes: all claim-monitor sections (2026-10-07 to 2026-10-28) are in `README.md`, and nothing was dropped.

### Changed

- `dexProtocolMonitor.js`: new opt-in `DEFILLAMA_TVL_DATES_BORROWED` and `DEFILLAMA_CHAIN`; `smokeDefiLlamaProtocol.js` gets `SMOKE_CHAIN`.
- `arcChainMonitor.js`: new `LLAMA_CHAIN_FEES_SLUG`, `LLAMA_CHAIN_MONTHS` and `LLAMA_CHAIN_STABLES` (matching options in `smokeArcChain.js`).
- New `llamaYieldPoolMonitor.js` (DefiLlama yields pool APY and TVL). `catalog.js` describes the new options. Before/after output of `pendle:tvl`, `usdsui` and `eurc` is byte-identical.
- Playground: new shared flows `src/simulation/fork/queuedExitFlows.js` (Ember, Vesper), `etherfiCashFlow.js` and (#36) `stakeLinkFlow.js`; `vaultFlows.js` gains a shared `depositOnly()` helper (Concrete, Saturn). New whales in `runtime.js`: Aave aOptUSDCn on OP for USDC (the ether.fi Hub breaks its own accounting as a whale), plus the USDat Curve pool, cvxCRV, gOHM and USDS from #36.
- Showcase: additive `testing` stamps only. Ranking, scores, order and `generatedAt` unchanged. Stats: `forkInTop200` 43 → 49 (#36) → 53 (#38), `apiOnlyInTop200` 157 → 151 → 147. `docs/04` regenerated with `npm run catalog:docs`.

### Added

**Claims** (17 monitors, 34 scripts: each `analytics:<name>:<kind>` plus `simulate:<name>:smoke`; sources and live numbers in the README table, the catalog cards and `docs/01`)
- Exploits (DefiLlama `/hacks`): `analytics:initia:exploit`, `analytics:x100:exploit`, `analytics:yapeswap:exploit`.
- Revenue: `analytics:ore:revenue`, `analytics:sky:revenue`, `analytics:pendle:revenue`.
- Perps / chains: `analytics:bulk:perps`, `analytics:bnb:chain`.
- Stablecoins: `analytics:eurc:supply`, `analytics:ousd:supply`, `analytics:arc:stablecoins`, `analytics:usdd:supply`.
- Lending / vaults: `analytics:aerie:morpho-vault`, `analytics:morpho:tvl`, `analytics:aave:mantle`, `analytics:aave:v4`, `analytics:sentora:usd-vault`.
- New contract: Aerie x Plume USDC Core vault `0x5E2339BCb89B42782CEE454B46C7C6f88c0E4f83` (EIP-55, has code, asset USDC).

**Playground** (#36, 2026-10-26)
- Fork tests + contracts: Curvance on Monad (`fork:curvance:deposit`), Saturn (`fork:saturn:stake`), Concentrator (`fork:concentrator:deposit`), Cooler Loans V2 (`fork:cooler:borrow`), stake.link (`fork:stakelink:deposit`), Fluid Lite (`fork:fluid-lite:deposit`).
- Contracts only (documented reason): RSK Bridge (TVL is in Powpeg on Bitcoin; the Ethereum Token Bridge was sunset in March 2026), Huma (PST is minted on Solana; the Ethereum token is a CCIP representation).

**Playground** (#38, 2026-10-28)
- Fork tests + contracts: Ember (`fork:ember:deposit`), Vesper (`fork:vesper:deposit`), ether.fi Borrowing Market + Cash Liquid on OP (`fork:etherfi-cash:supply`).
- Contracts only (documented reason): Lombard Vaults (the LBTCv Teller is only in a third-party repo), DeFi Saver Asset Management (positions sit in users' own smart wallets), Enzyme (each vault is manager-deployed with its own policies).
- Coverage, recounted at 102 forkable top-200 rows (earlier entries used ~101): fork tests **48 → 52**, contracts **57 → 64**. #36 reported 43 → 49 fork features and 50 → 58 contracts on its ~101 count.

### Decisions

- Claims are counted against the X list each post was read in (`x-list-claims-2026-10-28-browser.md`); every one of the 19 X sources was re-opened through the public tweet endpoint and states its claim inside the window.
- Mismatches are recorded, not hidden: Sky September revenue fell 4.8% (claim +50%); EURC is EUR 444.55M with an ATH of EUR 445.76M (claim EUR 450M); OUSD +$379.49M since its series began 09-30 (claim +$794M 30d); USDD 7d +0.46% (claim fastest-growing); Aave V4 deposits $1.20B (claim $1.5B; loans match); Morpho's $9.3B start matches neither TVL nor TVL + borrowed; BNB Q3 levels differ by definition (DefiLlama vs Blockworks), growth directions match.
- Covered already, no new script: Pons revenue, GRVT OI/TVL, Robinhood Chain TVL/revenue/volume, Collector Crypt and Stonk revenue, Zama TVL, Starknet TVL drop, NEAR Intents volume, Meteora/Jupiter revenue, Hyperliquid OI, pump.fun revenue, Swell pause, monthly L1 fee board.
- Skipped: Bloom Trading drain (trading bot, not on `/hacks`), CoinDCX (CEX), UXLINK wallet long, predict.fun drains (no amount), "230 hacks YTD" (not one protocol), Immunefi fee collector (truncated address, not DeFi), HIP-3/HIP-4, Outcome.xyz, Variational, Jito BAM and EQX (not repo-readable), Aave V4 Coinbase stock deposits and BNB Q3 lending/RWA (no per-asset split), NEST TVL (different DefiLlama listing), tokenterminal stablecoins-in-DeFi totals (no public source), macro/price/governance posts.
- Playground skips: Benqi sAVAX #110 (Avalanche is not a configured fork chain), Hyperliquid Bridge #14 (perps fork coverage stays closed), Tornado Cash #54. Next batch starts at #122 Aera.
- The Swell deposit test is left FAILing on purpose while the protocol is paused, same rule as Puffer.

### Verified (2026-10-28, live)

| Check | Result |
| --- | --- |
| 17 claim monitors + 17 smokes (#37) | 34/34 exit 0 |
| Initia / X100 / Yapeswap (`/hacks`) | $2.60M (10-23) / $4.75M (10-24) / $21.9K (10-25) |
| ORE revenue | 30d $3.91M, 7d $972.1K, 24h $138.7K |
| Sky revenue | Aug $14.12M, Sep $13.44M (-4.8%) |
| BULK OI | $1.39M (09-09) → $14.40M (10-24), $15.78M now; volume paywalled |
| EURC / OUSD / Arc / USDD | EUR 444.55M / $830.75M / $993.86M (+$524.97M 30d) / $1.74B (+0.46% 7d) |
| BNB Chain Q2 → Q3 | gas fees $31.17M → $49.17M (+57.7%), DEX volume $74.97B → $102.62B (+36.9%) |
| Pendle 30d revenue | $452.39K |
| Aerie x Plume USDC Core | 13.25% net APY on $5.77M |
| Morpho | TVL + borrowed $12.20B → $17.20B in a year; Robinhood Chain $615.10M of $1.13B (54.3%) |
| Aave on Mantle / Aave V4 | $71.29M (+45.2% 30d, 62.3% of Mantle) / TVL $742.1M + borrowed $462.4M |
| Sentora USD vault | $116.56M, 30d APY 7.59% |
| Playground forks (#38) | Ember: 100 USDC → 94.782369 eEARN = `previewDeposit`, redeem queued. Vesper: 100 USDC → 100 USDv → 98.577679 sUSDv, `requestRedeem` reserved 99.999999 USDv. ether.fi Cash (OP): 100 USDC supplied, 99.999999 withdrawn, 0 shares left |
| Playground forks (#36) | Curvance 100 WMON round trip; Saturn 100 USDat → 95.2556 sUSDat; Concentrator 100 cvxCRV round trip; Cooler V2 1 gOHM in, 1500 USDS borrowed and repaid; stake.link 10 LINK queued and unqueued; Fluid Lite 1 stETH → 0.8167 iETHv2 → 0.9995 stETH |
| `simulate:*:smoke` on main `2326851` | 188/188 exit 0 |
| DefiLlama endpoints | 152/152 return 200 with data (125 protocol slugs, 3 crosschain slugs, 5 chain-fee slugs, 12 chain TVL names, 4 stablecoin ids, 1 yield pool) |
| Contract book | 210/210 addresses have code; 1 checksum fix (Superstate oracle) |
| Fork suite on main `2326851` (Anvil 1.8.5) | 89 PASS / 3 FAIL / 0 SKIP of 92 (Ethereum 78/3 at block 26287126; Base, Optimism, Monad, Arbitrum, BSC 11/11) |
| Fork suite after #39 (Ethereum) | 80 PASS / 1 FAIL (Swell, protocol paused) |
| Gates | lint, `catalog:check`, `showcaseCheck` (200 rows, fork 53 / API-only 147), `node --check`, package.json duplicate-key scan; CI `check` and `fork-suite` green on #37, #38, #39 |

### Known issues carried forward

- **CI `fork-suite` skips the forks**: the repo has no RPC secret, so fork tests are only run locally on Anvil.
- **Busy-list coverage is keyword-only** (Airdrop?, Inner Circle CT, ON CHAIN); posts without a keyword are not scanned.
- **Swell is paused** (core methods, bot methods and withdrawals): rates frozen at swETH 1.202970 / rswETH 1.137680, `fork:swell:deposit` FAILs until it unpauses, and DefiLlama `/hacks` still has no amount.
- **`fork:etherfi-cash:supply` flakes on slow RPCs**: on `mainnet.optimism.io` it FAILed with `sharesLeft=1` (interest accruing between the read and the full withdraw); PASS on publicnode.
- **Pendle +43% Q3 claim** (Alea Research) vs DefiLlama +33.3%.
- **Playground depth**: 50 of 102 forkable top-200 rows still have no fork test.
- **`anvil_deal` is still `Method not found` on Anvil 1.8.5**; `anvil_dealERC20` now works for USDC on a mainnet fork, but the code still uses whales.
- **Anvil is not on the default `PATH`** on the box; fork runs need the Foundry bin dir added.
- **Velodrome fork on Optimism**: `fork:velodrome:swap` times out on `mainnet.optimism.io`; it PASSes against publicnode.
- **publicnode Optimism archive limit**: a cast call a few minutes after forking returned "Archive requests require a personal token"; a fresh fork worked.
- **`308faf0` showcase ranking refresh** still unmerged on `fix/gap-audit-2026-10-10`.
- Perps fork coverage stays closed.
- Resolved: **X search breaking mid-run** (2026-10-23) did not happen in the 2026-10-28 browser read (no login wall, captcha or "Something went wrong"), removed from this list.

## [2026-10-23]

Mon/Wed/Fri pass: the 2026-10-21 claims backlog, the playground batch, a clean health check, and claims from 2026-10-20 21:00Z to 2026-10-22 ~21:00Z. Squash-merged on 2026-10-23 as [#33](https://github.com/xjjda22/defi-scripts/pull/33) (2026-10-21 claims, `9af21a2`), [#34](https://github.com/xjjda22/defi-scripts/pull/34) (playground, `ec16e2f`) and [#35](https://github.com/xjjda22/defi-scripts/pull/35) (claims).

### Fixed

- **README `## Claim monitors (2026-10-21)` restored.** The playground squash (#34) was cut before #33 landed and dropped that section from `README.md`; #35 puts the 26-row table back under the new 2026-10-23 section. `docs/01` and this changelog were not affected.
- Nothing broken on health: no slug/RPC repair PR.

### Changed

- `dexProtocolMonitor.js`: optional `DEFILLAMA_TVL_DATES=YYYY-MM-DD,...` prints the last daily TVL point on or before each UTC date and the first-to-last change (for "TVL grew X% in Q3" claims). Off unless set; existing scripts unchanged.
- Playground: new shared Morpho Vault V2 helper (RockawayX folded into it) and a LINK whale in `runtime.js`.
- Showcase: additive `testing` stamps for the new fork rows only. Ranking, scores, order and `generatedAt` unchanged. Stats: `forkInTop200` 35→43, `apiOnlyInTop200` 165→157.

### Added

**Claims** (11 monitors, 22 scripts; sources and live numbers in the README table, the catalog cards and `docs/01`)
- Incidents: `analytics:swell:incident` (swETH / rswETH rates on-chain vs pre-incident 1.133254 / 1.082464, plus the `/hacks` row), `analytics:wax:exploit` (DefiLlama `/hacks`, 2026-10-22).
- Perps OI / TVL: `analytics:grvt:perps`, `analytics:ondo:perps` (OI + YTD high), `analytics:extended:perps` (TVL by chain).
- Volume / revenue: `analytics:pancakeswap:aggregator`, `analytics:lighter:revenue` (monthly since April), `analytics:metaplex:revenue`.
- TVL: `analytics:pendle:tvl` (`DEFILLAMA_TVL_DATES=2026-06-30,2026-09-30`), `analytics:berachain:chain`, `analytics:rnt:lending` (TVL + borrowed).
- Each has a `simulate:<name>:smoke`. New contract constant `SWELL.swETH` `0xf951E335afb289353dc249e82926178EaC7DEd78` (EIP-55, on-chain code, `symbol()` = swETH). New registry ids: wax, grvt, extended, metaplex, berachain, rnt; notes added to swell, ondo, pancakeswap, pendle, lighter.

**Playground**
- Fork tests + contracts: NEAR Bridge (`fork:near-bridge:deposit`), Concrete (`fork:concrete:deposit`), Clearstar on Base (`fork:clearstar:deposit`), Hyperithm (`fork:hyperithm:deposit`), Portal (`fork:portal:transfer`), Chainlink CCIP (`fork:ccip:send`), StakeWise V3 (`fork:stakewise:deposit`).
- Contracts only (documented reason, no fork): K3 Capital (its Ethereum vaults are covered by the existing `fork:euler:deposit`; most K3 TVL is on Monad and not covered).
- Coverage among ~101 forkable top-200 rows (the build's own count was 104): fork features **35→43**, contracts **42→50**.

### Decisions

- **2026-10-21 claims backlog shipped** as #33: all 52 scripts reran live on 2026-10-23 before merge, none dropped.
- Claims are counted against the list each X post was read in (`x-list-claims-2026-10-23-browser.md`); X posts were re-opened through the public tweet endpoint and each states its claim inside the window.
- Covered already, no new script: Papertrade TVL / revenue drops, metric.xyz TVL and volume, Hyperliquid TVL and fees, pump.fun revenue and app traders, Robinhood vs Solana DEX volume, Starknet TVL, Derive V3 notional, Collector Crypt / StonkFun revenue, Plume nOPAL (aggregate in `analytics:plume:vaults`), Algorand fees.
- Skipped: 79thVault drain (2026-10-07), Sophon (historical); Jupiter YOLO, Grvt / Ondo perp volume (DefiLlama derivatives volume is paywalled, so OI was built instead); Katana, Boros, Paradex RFQ, Exfil, Optimum TVB, Aave V4 tokenized stocks on Base, Aster fee share (no repo-readable number); DefiLlama top lists, macro / CEX / non-DeFi hacks, memes, wallet PnL and token posts.
- Lighter's Q3 revenue is $9.85M on DefiLlama vs $8.55M in the post (Q2 matches at $7.24M); RNT Lend's "$30M+ market size" is TVL $21.39M + borrowed $9.29M. Recorded, not hidden.
- Playground skips: Tornado Cash #54 (decision), Ember #68 (mostly Sui / Pharos; out of time), Lombard Vaults #86 (Teller address only from a third-party repo). CCIP sends to Base: the LINK pool does not allow Arbitrum. Concrete uses `ctDefiUSDT` because the `ctDeltaWeETH` deposit limit is 0.
- Perps fork coverage stays closed. No cloud agent used; claims built locally.

### Verified (2026-10-23, live)

| Check | Result |
| --- | --- |
| 2026-10-21 claims (#33) before merge | 52/52 exit 0. Starknet chain TVL $158.0M (10-21) → $42.3M (10-22): Extended moved ~$117M to Arc (now `analytics:extended:perps`) |
| Health on main `9af21a2` | lint, `catalog:check`, `showcaseCheck` pass; 160/160 `simulate:*:smoke` exit 0; all 116 DefiLlama slugs in `package.json` return 200 |
| Ethereum forks on main (Anvil 1.8.5) | 12/12 PASS: uniswap v3, aave supply, morpho supply, kelp, world-chain, robinhood, starknet, polygon, lighter-bridge, wbeth, meta-pool, puffer (0.046 pufETH; vault reopened) |
| Playground forks (#34) | NEAR Bridge: bridge ETH +0.05, `InitTransfer` matches. Concrete: 200 USDT → 187.076647 shares = `previewDeposit`. Clearstar (Base): 100 USDC round trip. Hyperithm: 100 USDC → 93.85 shares → redeemed. Portal: WETH +0.05, message amount matches. CCIP: 1 LINK to Base, fee = `getFee` 0.000214364218448937 ETH. StakeWise V3: vault assets +0.1 ETH, 0.0462323 osETH minted |
| Fork regression on the playground branch | 6/6 PASS: rockawayx, steakhouse, arbitrum, lighter-bridge, wbeth, meta-pool |
| 11 claim monitors + 11 smokes | 22/22 exit 0 |
| Swell incident | swETH 1.202970 (+6.15% vs 1.133254), rswETH 1.137680 (+5.10% vs 1.082464); `/hacks` row 2026-10-21, no amount |
| WAX bridge exploit (`/hacks`) | $90.5K (2026-10-22) |
| Grvt / Ondo Perps OI | $451.02M (TVL $33.65M) / $110.81M (YTD high 10-22) |
| Extended TVL | $114.26M: Arc $114.10M, Starknet ~$128 |
| PancakeSwap Aggregator | 30d volume $1.22B |
| Pendle V2 TVL | $942.01M (06-30) → $1.26B (09-30), +33.3%; now $1.05B |
| Lighter revenue | Q2 $7.24M, Q3 $9.85M (+36%) |
| Metaplex | 30d revenue $181.63K ≈ $2.21M/yr |
| Berachain / RNT Lend | chain TVL $33.77M (-6.1% 30d) / TVL $21.39M + borrowed $9.29M |
| Gates | lint, `catalog:check`, `showcaseCheck`, `node --check`, package.json duplicate-key scan; CI `check` green on each PR |

### Known issues carried forward

- **CI `fork-suite` skips the forks**: the repo has no RPC secret, so fork tests are only run locally on Anvil.
- **X search broke mid-run** ("Something went wrong") on 2026-10-23; Inner Circle CT and Airdrop? were filled in by connector list searches (keyword-only).
- **Busy-list coverage is keyword-only** (Airdrop?, Inner Circle CT); posts without a keyword are not scanned.
- **Swell rates still rising** after the incident, and DefiLlama `/hacks` records no amount.
- **Pendle +43% Q3 claim** (Alea Research) vs DefiLlama +33.3%.
- **Playground depth**: ~58 forkable top-200 rows still have no fork test.
- **`anvil_deal` is still `Method not found` on Anvil 1.8.5**, and `anvil_dealERC20` finds no slot for USDC.
- **Anvil is not on the default `PATH`** on the box; fork runs need the Foundry bin dir added.
- **Velodrome fork on Optimism**: `fork:velodrome:swap` times out on the public `mainnet.optimism.io` RPC; it PASSes against publicnode.
- **`308faf0` showcase ranking refresh** still unmerged on `fix/gap-audit-2026-10-10`.
- Perps fork coverage stays closed.
- Resolved: **Puffer** `fork:puffer:deposit` PASSes again (vault reopened), removed from this list.

## [2026-10-21]

Mon/Wed/Fri pass: health fixes, the playground batch built on 2026-10-19, and claims from 2026-10-15 21:00Z to 2026-10-20 ~21:00Z. Squash-merged on 2026-10-21 as [#31](https://github.com/xjjda22/defi-scripts/pull/31) (health) and [#32](https://github.com/xjjda22/defi-scripts/pull/32) (playground). The claims batch stopped before its PR that day; it was re-audited and shipped on 2026-10-23 as [#33](https://github.com/xjjda22/defi-scripts/pull/33) (claims).

### Fixed

- **Aerodrome / Velodrome smokes**: DefiLlama retired the `aerodrome` and `velodrome` parent slugs (both are now children of `aero-protocol`). `analytics:aerodrome:dex` / `simulate:aerodrome:smoke` read `aerodrome-slipstream`, `analytics:velodrome:dex` / `simulate:velodrome:smoke` read `velodrome-v3`, and `analytics:amm:aggregate` lists the four `aero-protocol` children.
- **`simulate:eth:tvl-drivers:smoke`** looks for Lido / Aave / Spark / Eigen among inflows *and* outflows; on 2026-10-21 all of them were outflows and the inflow-only check failed.
- Health baseline: 134 smokes, 131 PASS on main before the fix, 3 fixed. All 95 DefiLlama slugs in `package.json` return 200.

### Changed

- `run.js`: receipt polling before `wait()` and a 30% gas pad on estimates (Anvil 1.8). `runtime.js`: a fresh account wraps the native gas token when a chain has no WETH whale (Monad).
- `fork:puffer:deposit` checks the pufETH AccessManager first and FAILs with `targetClosed=true` instead of sending a tx that will revert.
- After-reads in the bridge flows are pinned to the receipt block (ethers caches `getBalance("latest")`).
- Showcase: additive `testing` stamps for the new fork rows and the Puffer note. Ranking, scores, order and `generatedAt` unchanged. Stats: `forkInTop200` 28→35, `apiOnlyInTop200` 172→165.
- `dexProtocolMonitor.js`: optional `DEFILLAMA_MONTHS=N` prints UTC calendar-month totals of fees/revenue and/or volume from the daily charts (for "September revenue", "Q3 volume", "12-month revenue" claims). Off unless set; existing scripts unchanged.
- `smokeDefiLlamaProtocol.js`: optional `SMOKE_FEES_DATATYPE=dailyFees` checks 24h fees instead of 24h revenue (Propr's daily net revenue can be negative). Default unchanged.

### Added

**Claims** (26 claim monitors incl. the `chains` board, 52 scripts; sources and live numbers in the catalog cards and `docs/01`)
- Fees / revenue: `analytics:papertrade:revenue`, `analytics:propr:revenue`, `analytics:stonkfun:revenue`, `analytics:collector-crypt:revenue`, `analytics:pons:revenue`, `analytics:pumpfun:app`, `analytics:tether:revenue`, `analytics:tron:revenue`, `analytics:uniswap:revenue`, `analytics:hyperliquid:fees`, `analytics:fluid:lending`, plus the `analytics:chains:fees` board (Ethereum, Tron, ICP, Celestia, Algorand).
- TVL / volume: `analytics:popdex:tvl`, `analytics:plume:vaults`, `analytics:metric:dex`, `analytics:hypercall:perps`, `analytics:umia:launchpad`, `analytics:near:intents-volume`, `analytics:solana:chain`, `analytics:starknet:chain`, `analytics:usdsui:supply`.
- Morpho: `analytics:morpho:base-btc` (BTC-collateral borrows on Base) and `analytics:fx:morpho-vault` (RockawayX f(x) Ecosystem USDC Vault V2 `0x2cA22cb25558fa2018ecb1CE4eD8AF92Ee7ea423`, EIP-55, on-chain code, `asset()` = USDC).
- Exploits from DefiLlama `/hacks` dated in window: `analytics:qubic:exploit`, `analytics:affluent:exploit`, `analytics:alpscon:exploit`.
- Each has a `simulate:<name>:smoke`. New helpers: `chainFeesBoard.js`, `morphoCollateralBorrowMonitor.js`, `llamaStablecoinMonitor.js`; `fetchFeesChart` / `fetchVolumeChart` / `monthlyTotals` / `trailingWindowTotals` in `defiLlamaProtocol.js`.
- New registry ids: propr, popdex, hypercall, metric, affluent, fx, plume, usdsui, tron, solana, qubic, stonkfun, collector-crypt, umia, pons, alpscon, and the `chains` board. Notes added to papertrade, fluid, near, tether, uniswap, hyperliquid, morpho, pumpfun, starknet.

**Playground**
- Fork tests + contracts: World Chain (`fork:world-chain:deposit`), Robinhood Chain (`fork:robinhood:deposit`), Starknet / StarkGate (`fork:starknet:deposit`), Polygon PoS (`fork:polygon:deposit`), Lighter (`fork:lighter-bridge:deposit`), Binance wBETH (`fork:wbeth:deposit`), Meta Pool spETH (`fork:meta-pool:deposit`).
- Contracts only (documented reason, no fork): LayerZero V2 (messaging layer; the endpoint holds no user funds, and `fork:stargate:deposit` already runs a real V2 send).
- `src/simulation/fork/lstDepositFlows.js` (wBETH, spETH) and new Orbit / OP / StarkGate / Polygon / Lighter flows in `bridgeFlows.js`.
- Coverage among ~101 forkable top-200 rows: fork features **28→35**, contracts **34→42**.

### Decisions

- Claims are counted against the list each X post was read in (`x-list-claims-2026-10-19-browser.md`, `x-list-claims-2026-10-21-browser.md`); X posts were re-opened through the public tweet endpoint and each states its claim inside the window.
- Covered already, no new script: Robinhood Chain TVL ATH / DEX volume / app revenue (`analytics:robinhood:chain`), Monad ~$1B TVL (`analytics:monad:dex`), Zama $100M+ on Morpho (`analytics:zama:privacy`), Papertrade TVL (`analytics:papertrade:perps`), Meteora MET-staker fees (`analytics:meteora:dex`).
- Skipped: Drift ($295M, 2026-04-01), Kelp ($293M, 2026-04-18) and Balancer ($128M, 2025-11-03) exploit figures are historical recaps; Aave V4 tokenized-stock deposits on Base (DefiLlama `aave-v4` has no Base row and the per-asset Spoke split is not readable here); LI.FI Intents (not broken out on DefiLlama); Injective "$24M since 2024" (no since-2024 window); JTX TWAP, Standard buybacks, ether.fi card spend, Pendle RWA share, Optimum TVB (not in public data the repo reads); DefiLlama top lists, macro stablecoin / DeFi TVL moves, token burns, launches without a number, hardware-wallet theft, Pirate Chain (no amount) and Coffer ($0.70).
- Fluid's "$1.77B active loans" is ~$672M on DefiLlama `fluid-lending`; the catalog note says the claim likely counts Jupiter Lend. Collector Crypt's "$24.3M gross revenue" is DefiLlama 24h *volume*; fees are ~$2.1M. Umia's "$300k/day" is ~$130K/day on DefiLlama. These are recorded, not hidden.

### Verified (2026-10-21, live)

| Check | Result |
| --- | --- |
| Health smokes `simulate:aerodrome:smoke`, `simulate:velodrome:smoke`, `simulate:eth:tvl-drivers:smoke` | PASS: Aerodrome Slipstream $219.70M, Velodrome V3 $20.11M, TVL drivers OK |
| Playground forks (Anvil 1.8.5, Ethereum publicnode, block 26236523) | 7/7 new PASS: World Chain, Robinhood, Starknet, Polygon, Lighter, wBETH (0.090184 for 0.1 ETH), Meta Pool (0.087268 spETH); Puffer FAIL `targetClosed=true` (known) |
| Fork regression on the playground branch (Ethereum + BSC) | 6/6 PASS: uniswap v3, aave supply, morpho supply, kelp deposit, venus supply, lista-dao deposit |
| 26 claim monitors + 26 smokes | 52/52 exit 0 |
| Papertrade revenue | 7d $28.54M, all-time $61.80M (launched 2026-10-10) |
| Propr fees May–Oct | $5.03M (revenue $1.55M) |
| PopDEX / Plume Vaults TVL | $71.80M / $226.99M |
| Metric V1 volume | 30d $2.97B, all-time $4.37B |
| Hypercall Perps volume | 30d $5.91M |
| Fluid Lending | borrowed $672.02M, 24h revenue $18.3K |
| StonkFun / Collector Crypt / Pons | 30d revenue $17.94M / 24h fees $2.12M, 24h volume $24.36M / 24h revenue $67.95K |
| NEAR Intents volume | Jul $2.21B, Aug $2.78B, Sep $4.80B |
| Tether 12-month fees | $5.75B |
| Tron / Uniswap / Hyperliquid | Tron 30d $23.66M; Uniswap Sep revenue $15.49M; Hyperliquid Sep fees $91.33M |
| Chain fees board | ETH 30d +48.74%; ICP 30d $183.84K; Celestia 24h $95; Algorand 24h $15 |
| Morpho Base BTC-collateral borrows | $1.61B (cbBTC/USDC $1.60B at 5.19%) |
| f(x) Ecosystem USDC vault | $13.97M, 6.81% net APY |
| pump.fun App fees Aug–Oct | $20.20M |
| Solana / Starknet chain TVL | $5.97B / $157.90M |
| USDsui supply | $78.59M (ATH $80.06M on 2026-10-15) |
| Exploits (`/hacks`) | Qubic $1.30M (10-17), Affluent $1.05M (10-16), AlpsCon $152.8K (10-19) |
| Claims re-audit (2026-10-23, before merge) | all 31 X posts open via the public tweet endpoint, dated 10-16..10-20 UTC; `/hacks` rows unchanged; 52/52 claim scripts exit 0 again; 186 existing scripts on the touched helpers (`dexProtocolMonitor.js`, `smokeDefiLlamaProtocol.js`, `defiLlamaProtocol.js`) exit 0. Starknet chain TVL fell to $42.31M on DefiLlama on 2026-10-22 (was $158.0M on 10-21, inside the claim window); smoke floor $10M still holds |
| Gates | lint, `catalog:check`, `showcaseCheck`, `node --check`, package.json duplicate-key scan; CI `check` + `fork-suite` green on each PR |

### Known issues carried forward

- **Puffer**: pufETH `isTargetClosed` is true (2026-10-19 and 2026-10-21), so `fork:puffer:deposit` FAILs until the vault reopens.
- **Velodrome fork on Optimism**: `fork:velodrome:swap` times out on the public `mainnet.optimism.io` RPC; it PASSes against publicnode.
- **`anvil_deal` is still `Method not found` on Anvil 1.8.5**, and `anvil_dealERC20` finds no slot for USDC.
- **`308faf0` showcase ranking refresh** still unmerged on `fix/gap-audit-2026-10-10`.
- Perps fork coverage stays closed.

## [2026-10-16]

Mon/Wed/Fri pass: claims monitors, playground batch, and a clean health check. Squash-merged as [#28](https://github.com/xjjda22/defi-scripts/pull/28) (claims) and [#29](https://github.com/xjjda22/defi-scripts/pull/29) (playground).

### Fixed

- Nothing broken on health: all sampled `simulate:*:smoke` and a five-fork Anvil subset PASS. No slug/RPC repair PR.

### Changed

- Showcase `testing` stamp for five newly forked rows (`mode` api-only → fork). Ranking scores, order, and `generatedAt` unchanged. Stats only: `forkInTop200` 23→28, `apiOnlyInTop200` 177→172.

### Added

**Claims**
- **`analytics:uncx:exploit` / `simulate:uncx:exploit:smoke`** — DefiLlama `/hacks` id 1765 (since 2026-10-14). Catalog note: Llama shows ~$86K while Blockaid/news cite ~$1.49M later.
- **`analytics:pendle:hy-vault` / `simulate:pendle:hy-vault:smoke`** — Morpho Vault V2 `0xcf609F8327E68b42AF54F9D529b9f65d68038435` on Ethereum; EIP-55 + on-chain code verified. Live ~$17.14M.
- **`analytics:curve:lending` / `simulate:curve:lending:smoke`** — sums `curve-llamalend` + `curve-llamalend-v2` borrowed+TVL without double-counting. Live borrowed ~$75.03M.
- **`analytics:balancer:protocol` / `simulate:balancer:protocol:smoke`** — DefiLlama `balancer` + `DEFILLAMA_FEES=1`; catalog note on withdrawals-only from 2026-10-30. Live TVL ~$44.20M.
- **`analytics:alchemix:base` / `simulate:alchemix:base:smoke`** — DefiLlama `alchemix` by chain (Base ~$2.38M). Inner Circle CT source.
- **`llamaBorrowedSumMonitor.js`** — multi-slug borrowed+TVL helper.
- **BAND** stem in `LIST_NAMES` (`band` / `10-band` → `"BAND"`). List was read; 0 DeFi claims (music-band list).

**Playground**
- Contracts + fork tests: Lista Liquid Staking (`fork:lista:stake`), USD AI (`fork:usdai:stake`), Venus Core Pool (`fork:venus:supply`), Spark Vaults (`fork:spark-vaults:deposit`), Lista DAO Lending (`fork:lista-dao:deposit`).
- Contracts only (documented reason, no fork): fx Protocol, Avalon SuperEarn, Fusion by IPOR.
- Coverage among ~101 forkable top-200 rows: fork features **23→28**, contracts **27→34**.

### Decisions

- Perps fork coverage stays closed (GMX V1 sunset / Hyperliquid L1). Hyperliquid Bridge and Tornado Cash left untouched this batch.
- Pure bridges without a permissionless assertable action get contracts/notes, not fabricated fork tests.
- Cloud agents unavailable (Cursor usage exhausted); claims and playground built locally.

### Verified

| Feature / smoke | Result |
| --- | --- |
| `simulate:uncx:exploit:smoke` | PASS $86,000 (2026-10-14) |
| `simulate:pendle:hy-vault:smoke` | PASS TVL $17.14M |
| `simulate:curve:lending:smoke` | PASS borrowed $75.03M |
| `simulate:balancer:protocol:smoke` | PASS TVL $44.20M |
| `simulate:alchemix:base:smoke` | PASS Base $2.38M |
| `fork:lista:stake` | PASS |
| `fork:venus:supply` | PASS |
| `fork:lista-dao:deposit` | PASS |
| `fork:usdai:stake` | PASS |
| `fork:spark-vaults:deposit` | PASS |
| Health smokes (thorchain, papertrade, liquid, monad, etherfi, morpho, aave-mix, keyrock, maple, …) | PASS |
| Prior forks (aave:supply, cbeth:rate, rockawayx, llamalend, dolomite) | PASS |

### Known issues carried forward

- **`anvil_deal` is `Method not found` on anvil 1.3.0**, so whale top-up via deal is dead; tests that need more than the whale holds hard-fail (blocked fx Protocol fork this batch).
- **`308faf0` showcase ranking refresh** still unmerged on `fix/gap-audit-2026-10-10`.
- **Playground depth remains open** — still ~73 of 101 forkable rows without fork tests after this batch.
- **Busy X lists (Airdrop?, Inner Circle CT)** could not be scrolled fully to Oct 14; list-scoped search + built-in X search were used for the gap and remain imperfect.
- **Anvil not on default PATH** in the automation box (`~/.foundry/bin` must be prepended for `fork:*`).

## [2026-10-11]

A session in four parts: repair the perps fork tests, record the BAND decision,
make the protocol page describe what its tests actually do, then add a local
runner so those tests can be run from the page.

### Fixed

- **Fabricated contract addresses removed from the showcase contract book**
  ([#20](https://github.com/xjjda22/defi/defi-scripts/pull/20)). Three GMX V1
  entries had **no contract code** on Arbitrum, and one did not even pass EIP-55
  checksum validation. They shared a prefix with the real deployments and then
  diverged, so they read as legitimate:

  | Entry | Address | On-chain |
  | --- | --- | --- |
  | `RewardRouterV2` | `0xA90e5653…` | no code, bad checksum |
  | `GlpManager` | `0x321F653e…17b961615F3E594c` | no code |
  | `GLP` | `0x4277f8F2…52701d4537eC965DF0bc517c` | no code |

- **A non-existent Hyperliquid bridge dropped.** `0x2Df1c67E04526f42B83764733b06AAf4e2B05B02`
  has no code on Ethereum (1) or Arbitrum (42161) and fails EIP-55. The
  read-only assertion built on it could never pass.
- **`perpFlows.js` referenced an undefined key.** It read `GMX.rewardRouterV2`,
  which `contracts.js` never defined, so the script died on an invalid address
  before reaching the chain.
- **`GMX.glp` pointed at fsGLP, not GLP.** `0x1aDDD80E…` is the staked-GLP token;
  it is now labelled `fsGlp` and the real GLP is
  `0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258`.
- **The generated docs could silently drop content.** Merging `fork:eigenlayer:deposit`
  and `:queue` into one table row swallowed the queue action's assertion. A run
  now only merges while every non-script column is identical, so grouping can no
  longer hide a differing action or assertion.

### Changed

- **`fork:gmx:glp` became `fork:gmx:read`.** [Contracts for V1](https://docs.gmx.io/docs/archived/contracts-v1)
  states V1 is sunset and that trading and providing liquidity are no longer
  supported, and the live chain agrees: `Vault.isSwapEnabled()` and
  `isLeverageEnabled()` are both `false`, and `GlpRewardRouter.mintAndStakeGlp`
  reverts with `SafeMath: subtraction overflow` even for **1 USDC**. The script
  is now read-only and asserts the V1 vault, GLP supply and GLP price still read.
- **Contract addresses verified against the official archived list** and the
  interface config it links to: Vault `0x489ee077…`, GlpManager `0x3963FfC9…`,
  GlpRewardRouter `0xB95DB5B1…`, GLP `0x4277f8F2…`, RewardRouter `0x5E4766F9…`.
- **`docs/00-architecture.md` corrected.** It claimed *"No in-repo HTTP server"*;
  it now names both local servers.

### Added

- **Fork feature registry** ([#22](https://github.com/xjjda22/defi/defi-scripts/pull/22)).
  `src/catalog/forkFeatures.js` is the single source of truth for what each
  `fork:*` script does, what makes it PASS, and the dials a reader can set.
  **All 61 fork scripts** are covered: actions 36, perps 1, vaults 7, stables 17.
  It feeds three consumers from one file — the `docs/04-fork-testing.md` tables
  (now generated between `<!-- features:id -->` markers), each showcase row's
  `testing.features`, and the numbered feature cards on the protocol page.
- **Drift guard.** `catalog:check` fails when a `fork:*` script has no feature
  entry, or an entry has no script. Verified by planting `fork:zzz:nope` in
  `package.json` — caught, then removed.
- **Explorer links on every contract.** `contracts[].explorerUrl` is built from
  the `explorer` already in `src/config/chains.js`; all 48 entries link out, so an
  address can be confirmed rather than trusted. This is the cheap half of the
  fabricated-address problem above.
- **A documented reason on pages that cannot be tested.** A row with no fork test
  now says so plainly instead of rendering an empty panel.
- **Playground runner, `npm run play`** — *local only*, not pushed.
  `scripts/playgroundServer.js` serves `showcase/` and runs fork features on
  request: Anvil starts lazily per chain, the script runs, and output streams
  into the feature card over Server-Sent Events.
- **`docs/05-playground.md`** — the two modes, the API, the safety model, and a
  table of what a fork cannot reach.

### Infrastructure

- **GitHub Pages enabled.** It had never been turned on, so **every prior Pages
  run had failed**. Source is now GitHub Actions and the showcase is live:
  <https://xjjda22.github.io/defi-scripts/>. The Mon/Wed/Fri 05:30 Asia/Kuala_Lumpur
  refresh is active.

### Security / safety

The playground is the only part of the repo that executes anything on request, so
it is narrow by construction. Verified rather than assumed:

- It binds `127.0.0.1` with no override, unlike `showcase:serve`, which accepts
  `HOST=0.0.0.0` and is safe to expose because it only serves files.
- Any other `Host` header is rejected with **403**, so a DNS-rebound page cannot
  drive Anvil. Confirmed by sending `Host: evil.example.com`.
- The client sends a **feature id, never a command**; the registry supplies both
  the npm script name and the chain. An injection-shaped id returns **400**.
  No client string reaches a shell.
- Runs are **serialised**, matching `forkSuite`, because positions leak between
  tests sharing an Anvil. Confirmed by firing two concurrent runs: they executed
  strictly one after the other.
- `PRIVATE_KEY` is deleted from the child environment; Anvil impersonates a whale.

### Decisions

- **BAND is now in research scope** ([#21](https://github.com/xjjda22/defi/defi-scripts/pull/21)).
  Earlier reads skipped it. When its posts are first read, add its file-name stem
  to `LIST_NAMES` in `src/analytics/ranking/mentions.js`.
- **Perps fork coverage is closed.** GMX V1 is sunset and Hyperliquid matches
  off-chain on its own L1, so neither yields a fork test.
- **Playground scope: depth for all 200, play where possible.** Of the 200 top-200
  rows, **101 sit on a chain the repo can fork**; the other 99 get contracts,
  explorer links and a stated reason rather than a blank panel.
  Larger blockers: Solana 26, Bitcoin 12, Hyperliquid L1 5, Sui 5, Near 4.

### Verified

Live fork runs, not mocks:

| Feature | Chain | Result |
| --- | --- | --- |
| `fork:gmx:read` | Arbitrum @ 513776035 | PASS `GLPprice=0.090035359974678776349465376` |
| `fork:cbeth:rate` | Ethereum @ 26168262 | PASS `exchangeRate=1.141372229011236917` |
| `fork:aave:supply` | Ethereum @ 26168264 | PASS `aToken=0.0->999.999999` |

`fork:aave:supply` was run by clicking **Run** on the protocol page; output
streamed into the card. `npm run lint`, `scripts/catalog.js --check` and
`scripts/showcaseCheck.js` all pass, and `showcase/data.json` was confirmed
**additive only** against `main` — ranking order, scores, stats and `generatedAt`
are byte-identical, with only `features` and `explorerUrl` added.

### Known issues carried forward

- **`anvil_deal` is `Method not found` on anvil 1.3.0**, so `dealErc20` in
  `src/simulation/fork/runtime.js` always returns `false` and the whale top-up
  path is dead code. A test needing more than its whale holds hard-fails instead
  of topping up. Found while building `fork:gmx:glp`; not fixed.
- **`308faf0` "Refresh showcase/data.json"** is committed on
  `fix/gap-audit-2026-10-10` but never merged. It is a large ranking refresh and
  was deliberately kept out of #20 so that fix stayed reviewable.
- **Playground batches 2+ are not built.** The runner exists, but coverage is
  still 20 of 200 rows with fork tests and 21 with contract addresses.
