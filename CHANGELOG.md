# Changelog

Changes to defi-scripts. Newest first. Merged work is on `main`; anything marked
**local only** is committed on a branch that has not been pushed.

## [2026-10-11]

A session in four parts: repair the perps fork tests, record the BAND decision,
make the protocol page describe what its tests actually do, then add a local
runner so those tests can be run from the page. A follow-up the same evening
closed the two known issues it carried forward (`anvil_deal`, `308faf0`).

### Fixed

- **Fabricated contract addresses removed from the showcase contract book**
  ([#20](https://github.com/xjjda22/defi-scripts/pull/20)). Three GMX V1
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
- **The fork top-up works again** (follow-up PR). `dealErc20` in
  `src/simulation/fork/runtime.js` only called `anvil_deal`, which anvil 1.3.0
  answers with `Method not found`, so it always returned `false`. It now tries
  `anvil_dealERC20` / `anvil_deal` first, then writes the balance itself with
  `anvil_setStorageAt`: the slots `balanceOf` reads (from `eth_createAccessList`),
  then the balances mapping at slots 0–100 in Solidity and Vyper layouts. Every
  write is confirmed with `balanceOf`; rebasing tokens are scaled to land on the
  amount. Same API and return value.
- **A short whale no longer fails a test.** `impersonateFunded` now writes the
  amount into the fresh test account when no whale holds enough (not into the
  whale, which can be a contract such as wstETH). `simulate:aave:v3:fork` and the
  `dexForkRunner` execution path (`simulate:dex:*` with `SIMULATE_ONLY=false`),
  which exited when the whale was short, top up instead.
- **Broken PR links in this file** pointed at `xjjda22/defi/defi-scripts`; fixed.

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

- **Fork feature registry** ([#22](https://github.com/xjjda22/defi-scripts/pull/22)).
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

- **BAND is now in research scope** ([#21](https://github.com/xjjda22/defi-scripts/pull/21)).
  Earlier reads skipped it. When its posts are first read, add its file-name stem
  to `LIST_NAMES` in `src/analytics/ranking/mentions.js`.
- **Perps fork coverage is closed.** GMX V1 is sunset and Hyperliquid matches
  off-chain on its own L1, so neither yields a fork test.
- **Playground scope: depth for all 200, play where possible.** Of the 200 top-200
  rows, **101 sit on a chain the repo can fork**; the other 99 get contracts,
  explorer links and a stated reason rather than a blank panel.
  Larger blockers: Solana 26, Bitcoin 12, Hyperliquid L1 5, Sui 5, Near 4.
- **`308faf0` dropped, not merged.** It is a `github-actions[bot]` refresh that
  `showcase-refresh.yml` pushed to `fix/gap-audit-2026-10-10` eight minutes
  *after* that branch merged as #19, so it never had a PR. It is the only commit
  on the branch not in `main`, and it holds nothing but `showcase/data.json`.
  Merging it would undo #22: its rows predate the registry, so all 200 lose
  `testing.features` and `explorerUrl`. Its ranking is two hours newer than
  `main`'s (`12:22Z` vs `10:36Z`, 2026-10-10), which the Mon/Wed/Fri 05:30
  Pages rebuild already supersedes on the live page. The branch is left in place
  because the GitHub connector cannot delete branches; it is safe to delete.

### Verified

Live fork runs, not mocks:

| Feature | Chain | Result |
| --- | --- | --- |
| `fork:gmx:read` | Arbitrum @ 513776035 | PASS `GLPprice=0.090035359974678776349465376` |
| `fork:cbeth:rate` | Ethereum @ 26168262 | PASS `exchangeRate=1.141372229011236917` |
| `fork:aave:supply` | Ethereum @ 26168264 | PASS `aToken=0.0->999.999999` |

Follow-up, Ethereum fork via `ethereum-rpc.publicnode.com`, anvil 1.8.5: `dealErc20`
gave 12,345 of USDC, USDT, DAI, WETH, WBTC, stETH, wstETH, USDe, crvUSD, USDS, sUSDS
and aEthUSDC to fresh accounts, each spendable by `transfer`, in all three modes:
native (`anvil_dealERC20`), access list, and slot scan (USDC slot 9, WETH 3,
crvUSD Vyper slot 1, aEthUSDC 52). With every configured USDC, WETH and DAI whale
zeroed on the fork, `fork:aave:supply`, `fork:aave:borrow`, `fork:sky:sdai`,
`fork:compound:borrow` and `simulate:aave:v3:fork` PASS by topping up; on `main`
the same fork fails `fork:aave:supply` and `fork:aave:borrow`.

`fork:aave:supply` was run by clicking **Run** on the protocol page; output
streamed into the card. `npm run lint`, `scripts/catalog.js --check` and
`scripts/showcaseCheck.js` all pass, and `showcase/data.json` was confirmed
**additive only** against `main` — ranking order, scores, stats and `generatedAt`
are byte-identical, with only `features` and `explorerUrl` added.

### Known issues carried forward

- **Playground batches 2+ are not built.** The runner exists, but coverage is
  still 20 of 200 rows with fork tests and 21 with contract addresses.

Resolved in the follow-up: the dead `anvil_deal` top-up (see Fixed) and the
unmerged `308faf0` refresh (see Decisions).
