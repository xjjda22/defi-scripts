# Changelog

Changes to defi-scripts. Newest first. Merged work is on `main`; anything marked
**local only** is committed on a branch that has not been pushed.

## [2026-10-21]

Mon/Wed/Fri pass: health fixes, the playground batch built on 2026-10-19, and claims from 2026-10-15 21:00Z to 2026-10-20 ~21:00Z. Squash-merged on 2026-10-21 as [#31](https://github.com/xjjda22/defi-scripts/pull/31) (health) and [#32](https://github.com/xjjda22/defi-scripts/pull/32) (playground). The claims batch stopped before its PR that day; it was re-audited and shipped on 2026-10-23 as [#__CLAIMS_PR__](https://github.com/xjjda22/defi-scripts/pull/__CLAIMS_PR__) (claims).

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
