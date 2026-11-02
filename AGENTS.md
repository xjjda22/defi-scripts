# AGENTS.md — defi-scripts

Public MIT repo. Every commit is world-readable and permanent.

The unit of work is not "a protocol". It is **a row on the top-200 board**.

Rules are numbered. `[checked]` means a command fails when you break it; `[reviewed]` means a
reviewer does. If a rule has neither, it is not a rule — fix that before adding another.

## 0. The 200 rows are the backlog

`npm run ranking:top200` writes `showcase/data.json`. Those 200 rows are the coverage target.
The list is generated, never hand-maintained.

- **R0.1** Never edit `showcase/data.json` by hand and never hardcode a rank. `[reviewed]`
- **R0.2** A row that drops off the board keeps its scripts but stops counting toward coverage.
  Do not delete a working monitor because the row left the board. `[reviewed]`

## 1. What counts as a top-200 row

This defines the denominator. It lives in `src/analytics/ranking/`, not in prose.

- **Eligible:** ≥$5M TVL, or ≥$100k 30-day fees, or ≥$5M 30-day volume.
- **Pool:** DefiLlama top 200 by TVL ∪ CoinGecko top 200 by market cap (joined through
  `token-map.json`) ∪ the top 20 rows per category. Percentiles and the top 200 are computed
  inside that pool; a row outside it cannot enter.
- **Excluded:** `CEX`, `Ponzi`, `Token Locker`, non-DeFi fee earners; chain gas-fee rows.
- **One row per protocol family per category.** Aave V2/V3/V4 are one row; children in different
  categories stay separate. Chains are represented by their canonical-bridge row.

- **R1.1** Do not add a curated row to the board to make coverage look better. If a protocol is
  not in the pool, build catalog coverage only — the board is a measurement, not a wishlist.
  `[reviewed]`
- **R1.2** The pool, floors and weights change in `src/analytics/ranking/` (and are mirrored into
  `docs/03-showcase-ranking.md` by hand). Counts, coverage percentages and rank numbers belong in
  `data.json` and generated docs — never in a rule, a README claim or a comment. `[reviewed]`

## 2. Every row sits in exactly one bucket

This is the contract. The failure mode being prevented is a row that is quietly "not done"
with no record of why.

| # | Bucket | What must exist |
|---|---|---|
| 1 | **Fork-tested** | `fork:<protocol>:<action>` that asserts a delta + `forkFeatures.js` + `forkRecipes.js` |
| 2 | **API-only, reason written** | An `API_ONLY` entry in `forkRecipes.js` saying why a fork test cannot exist |
| 3 | **Not forkable** | Classification in the coverage snapshot (non-EVM, no chain TVL, or chain without an RPC) + monitor/smoke where a data source exists |
| 4 | **EVM-forkable, not built** | Nothing extra — this is the work queue |

- **R2.1** No row may be silently uncovered. If there is no fork test, the reason must be data:
  an `API_ONLY` entry or a bucket-3 classification. "Nobody got to it yet" is bucket 4, and
  bucket 4 must list the row. `[reviewed]`
- **R2.2** Bucket 4 is the only queue. Work it in rank order, top-50 first. `[reviewed]`
- **R2.3** An API-only row still ships its analytics and smoke, and still lists its contracts
  where they exist. `[reviewed]`
- **R2.4** Bucket assignments come from `data/coverage-snapshot.json` +
  `src/catalog/forkRecipes.js`. Change the inputs and regenerate, never the rendered table.
  `[reviewed]`

## 3. Definition of done

- **A new protocol is done when** it has at least one registered script, a `PROTOCOLS` entry and
  a bucket assignment. With a DefiLlama listing that means analytics + smoke; where a fork test
  is the only meaningful surface, the row is fork-only and that is stated. `[reviewed]`
- **A fork test is done when** it runs on a pinned block with impersonation or `anvil_deal`,
  needs no `PRIVATE_KEY`, fails on revert, and prints a measured state delta on PASS. A green
  call with no asserted delta is rejected. `[reviewed]`
- **A row is done when** it is bucket 1, or bucket 2/3 with the reason recorded. Row-level
  backlog: `docs/07-fork-coverage-plan.md`. Feature-level backlog: `docs/08-feature-test-gaps.md`
  — every public permissionless feature gets a fork test, not just one per protocol.
  `[reviewed]`

## 4. Hard rules

- **R4.1 Placement.** Generic DeFi tooling only. MEV, bundles, sandwich/flashloan analysis,
  trading bots and personal strategies belong in `defi-mev`. Shared chains, ABIs, addresses and
  quotes stay here so `defi-mev` can import them. `[reviewed]`
- **R4.2 Secrets.** Never commit `.env`, keys, RPC URLs containing keys, private keys, or
  `daily-*claims*` files. `[reviewed]` — there is no automated secret scan yet; CI only reports
  whether RPCs are configured.
- **R4.3 Registration.** Every script needs a `PROTOCOLS` entry and a `SCRIPT_DESCRIPTIONS` line;
  run `catalog:docs` before `catalog:check`. `[checked]`
- **R4.4 Naming.** `<family>:<protocol>:<what>` — `analytics:aave:markets`,
  `simulate:kelp:smoke`, `fork:uniswap:v3`. `[reviewed]` — `catalog:check` validates registration,
  not the pattern.
- **R4.5 Layout.** Analytics under `src/analytics/protocols/<name>/`; simulation grouped by run
  type; all `.md` under `docs/` except `README.md` and this file. `[reviewed]`
- **R4.6 Addresses.** EIP-55 checksummed and code on-chain on the stated chain `[reviewed]`;
  cited from the protocol's official docs, and the fork source must match its artifact
  (`check:contracts`) `[checked]`.
- **R4.7 Third-party data.** A committed `showcase/data.json` must have `publishSafe: true`
  `[checked]` in CI — `showcaseCheck.js` only enforces it when `CI`/`GITHUB_ACTIONS` is set, so a
  local build can be unsafe. CoinGecko attribution always, Nansen only after redistribution
  approval `[reviewed]`.
- **R4.8 Process.** PR against `main`, wait for `check` + `fork-suite`, squash-merge, never push
  `main`. CHANGELOG entry for every change. `[reviewed]`
- **R4.9 Public independence.** This repo must never import from `defi-mev`, read its files or
  need it to run. The dependency only runs the other way. One violation to remove:
  `src/analytics/airdrop/airdropWatch.js` resolves `../../defi-mev/data/trends-report.json`
  (it fails soft, but a stranger's clone has no such path). `[reviewed]`

## 5. Enforcement

```bash
npm run lint
npm run catalog:docs && npm run catalog:check     # registration, descriptions, stale docs, docs/08
npm run check:contracts                           # fork contracts match their sources
node scripts/showcaseCheck.js                     # data.json shape + publishSafe
node scripts/showcaseSignalsCheck.js              # CoinGecko/Nansen plumbing
npm run fork:all                                  # SKIPPED without RPC is not a pass
```

Everything marked `[reviewed]` has no gate. If you add a gate for one, flip its tag in the same PR.

## 6. Snapshot — 2026-11-02 build + fork campaign `56ca5ef`

The four buckets sum to 200. Rows, not scripts: one protocol family is one row.

| | Rows |
|---|---:|
| Top 200 | 200 |
| Bucket 1 — fork-tested | 89 |
| Bucket 2 — API-only, reason written | 18 |
| Bucket 3 — not forkable | 91 |
| Bucket 4 — EVM-forkable, not built | 2 |
| Candidate pool | 268 |
| Rows with a dedicated monitor | 97 |
| Ranking-only rows | 103 |

Rebuilt from `showcase/data.json` (generatedAt 2026-11-02T18:06Z) after the fork campaign landed:
the board now carries 89 fork stamps, up from 72, and bucket 4 is down to the two rows nothing has
investigated yet — Armitage by Wintermute and xDAI Stake Bridge. Bucket 2 grew to 18 because the
four rows the campaign proved is not forkable (Liquid Collective, Solv stablecoin, SoSoValue
Indexes, Avalanche Core Bridge) now have `API_ONLY` entries with the on-chain evidence.

Bucket 3 is 91, not the 96 that `stats.coverage.nonForkable` reports: that count overlaps
`API_ONLY`, and the buckets here are disjoint so they sum to 200. Do not add a curated row to
keep a number looking good; fix the input.
