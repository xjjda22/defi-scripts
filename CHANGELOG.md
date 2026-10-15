# Changelog

Changes to defi-scripts. Newest first. Merged work is on `main`; anything marked
**local only** is committed on a branch that has not been pushed.

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
