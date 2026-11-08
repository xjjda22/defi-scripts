# Fork coverage plan (2026-11-03, receipts 2026-11-05)

Status: **campaign closed, queue empty.** On the 2026-11-05 rebuild, fork tests cover **89 of
the top 200** rows; 111 do not.

Foundry `.t.sol` coverage is a separate queue: [`11-foundry-contract-plan.md`](./11-foundry-contract-plan.md)
(99 new-file target rows relative to the original receiver baseline; W0 has four primitive
files, three from that queue, and 96 remain planned). `npm run foundry:queue` derives the
current row/address/status CSV; the Foundry registry and pinned CI runner do not reclassify
JS coverage or count planned files as executed. W1 acceptance precedes W2/W3. This JS campaign is
unchanged.

> **2026-11-05 — two things the campaign left behind, now fixed and measured.**
> 1. Twelve fork tests existed as npm scripts and in `forkFeatures.js` but were **not attached to
>    any `FORK_RECIPES` entry**: `fork:aave:{flashloan,emode,stake}`,
>    `fork:spark:{flashloan,liquidate}`, `fork:compound:{absorb,buycollateral}`,
>    `fork:morpho:{flashloan,liquidate}` and `fork:llamalend:{borrow,repay,liquidate}`. `fork:all`
>    builds its plan from `FORK_RECIPES`, so none of them ran in the suite and none appeared on a
>    showcase panel. They are attached now: **166 tests in the suite, 166 `fork:*` scripts, no
>    orphans**. `docs/08` had already counted them as tested, which is why the matrix looked
>    better than the suite.
> 2. Every recipe now has a contract flowchart and a per-feature "how to close it on a fork"
>    note: [`10-contract-flows.md`](./10-contract-flows.md). A fork test without a flow is a
>    `catalog:check` failure.
The last two rows closed in fork wave 4 (2026-11-03) — Armitage by Wintermute and xDAI Stake
Bridge — and the 2026-11-05 board then churned 10 rows in and 10 out: six fork rows dropped
(Derive v3 Options, Theo, the old Aster row, Kelp, Mellow Core, Benqi Staked AVAX) and four joined
(Lyra, Aster Bridge, SushiSwap DEX, Axelar). Per R0.2 the dropped rows keep their scripts, so the
count moved from 91 to 89 without deleting a test.

## Full suite receipt (2026-11-06)

First complete `npm run fork:all` after fork wave 4 and the 2026-11-05 board rebuild: **163 PASS,
3 FAIL, 0 SKIP, 1 retried** across 8 chains (166 tests).

| Test | Result | Reading |
| --- | --- | --- |
| `fork:dolomite:supply` | FAIL `marketClosing=true` | Documented `PAUSED` row: every Dolomite Ethereum market is closing since the 2026-10-29 drain. The pre-check sends no tx. |
| `fork:cian:deposit` | FAIL `remainingUpdateTime 0` | CIAN's operator exchange price is stale, so `deposit()` would revert `PriceNotUpdated()`. Added to `PAUSED` on 2026-11-06; the pre-check sends no tx. |
| `fork:rocketpool:burn` | FAIL `excess 0.0 ETH` | The Rocket deposit pool has no free ETH, so `burn` pays dust instead of `getEthValue`. The flow now reads `getExcessBalance()` and fails **before** the tx with that number. Protocol state, not a code regression. |

The other 163 tests pass, including the 12 that were wired into `FORK_RECIPES` this week.

## Both numbers are smaller than they look

| Bucket | Rows | Can a fork test cover it? |
| --- | ---: | --- |
| Top 200 | 200 | — |
| Has a `fork:*` stamp | 89 | — |
| No fork test | 111 | — |
| — documented as infeasible in `API_ONLY` | 18 | No, with a written reason |
| — non-EVM, or no chain TVL (Solana, Bitcoin, Hyperliquid L1, Tron, Sui, Stellar, others) | 91 | No: the suite is EVM-only |
| **— EVM-forkable, just not built** | **0** | **Queue empty** |

So "test every protocol's contracts" meant a few dozen tests, not 109. Every remaining row has a
reason not to exist; that reason is data, not debt, and it is what `API_ONLY` records.

## What the campaign changed

| Outcome | Rows |
| --- | --- |
| Added — 18 tests across 7 chains | Tornado Cash, Fluid DEX, Obol, USDD, Pendle V2, Bedrock uniBTC, Derive V3, Railgun, Fluid Lending, Mellow Core, Axelar, Fraxtal (Ethereum); Aster Bridge, BitFi Basis (BSC); Grove Finance (Base); Hyperliquid Bridge (Arbitrum); Avant (Avalanche); Polymarket (Polygon) |
| Infeasible, recorded with evidence | Liquid Collective (KYC allowlist), Solv Protocol stablecoin (BSC pools whitelisted), SoSoValue Indexes (Base-only, KYB-WLP mint), Avalanche Core Bridge (warden custody) |
| Still open | Armitage by Wintermute, xDAI Stake Bridge |

Avalanche is forkable: `AVALANCHE_RPC_URL` is set in `.env`, and `https://api.avax.network/ext/bc/C/rpc` works as a public fallback (the Avant test used it).

## Parallel build: the agent contract

The blocker for parallel work is that every fork test used to need an edit to `run.js` plus
three registries. `resolveTarget()` in `src/simulation/fork/run.js` now falls back to
`./flows/<target>.js`, so a test is **one new file**.

Each agent owns one protocol and **only creates new files**:

1. `src/simulation/fork/flows/<target>.js` — `module.exports = { run }`, built on `../runtime`
   (`requireFork`, `finish`, `impersonateFunded`, `dealErc20`, `formatUnits`).
2. `output/fork-specs/<target>.json` — the registry data (see below).

Agents **never** edit `package.json`, `src/catalog/forkRecipes.js`, `src/catalog/forkFeatures.js`
or `docs/`, because those are shared files and parallel writers would collide. Integration is a
single serial pass by the orchestrator.

### Spec shape

```json
{
  "target": "tornado-cash",
  "script": "fork:tornado-cash:deposit",
  "protocol": "tornado-cash",
  "action": "deposit",
  "chain": "ethereum",
  "rpcEnv": "ETHEREUM_RPC_URL",
  "contracts": [{ "name": "Tornado 0.1 ETH pool", "address": "0x…", "source": "https://docs…" }],
  "assertion": "the pool's ETH balance rises by exactly 0.1 ETH and Deposit is emitted",
  "notes": "commitment is random; withdrawal is out of scope",
  "feasible": true
}
```

`feasible: false` plus a reason is a **successful** outcome: it replaces a silent gap with a
documented `API_ONLY` entry, the same way the 15 existing ones are recorded.

### Verification an agent must show

Every test is proven on a real fork before it is accepted, on its own port so runs do not collide:

```bash
CHAIN=<chain> FORK_PORT=856x node scripts/startFork.js &
FORK_TARGET=<target> FORK_PROTOCOL=<protocol> FORK_ACTION=<action> CHAIN=<chain> \
  <RPC_ENV>=http://127.0.0.1:856x node src/simulation/fork/run.js
```

Acceptance: `FORK_RESULT status=PASS` with a key that states the measured delta, and the address
must have code on the fork (`provider.getCode` non-empty). A green call with no asserted state
change is rejected.

## Authoring pass: contract flows (2026-11-05)

The same file-ownership contract, applied to documentation instead of tests. The unit is a
`FORK_RECIPES` entry, not a protocol.

| Stage | Agents | What they own |
| --- | ---: | --- |
| Author | 22 | 5 recipes each → `output/flowcharts/<key>.json` (nodes, edges, gap notes) |
| Review | 22 | the same 5 files, checked against the fork source: call order, contract identity, no overclaim |
| Merge | 1 (orchestrator) | `npm run flowcharts:docs` → `data/contract-flows.json` + `docs/10-contract-flows.md` |

Agents write **only** their fragment; `data/`, `docs/` and the showcase are written by the
orchestrator in one serial pass, because parallel writers would collide. Two checks make the
contract enforceable rather than aspirational: `--verify <key>` is the loop an author runs until
it prints OK, and the merge rejects any `0x` address that does not already appear in `src/` or
`output/fork-specs/`. A diagram therefore cannot cite an address no one verified, and a gap note
cannot name a feature that is not in `protocolFeatures.js` (the merge warns and drops it).

## Integration pass (serial, by the orchestrator)

For each accepted spec, in one commit:

1. Add `fork:<target>:<action>` to `package.json`.
2. Add a `FORK_RECIPES` entry (`keys`, `chain`, `contractKeys`, `tests`) in
   `src/catalog/forkRecipes.js`, and the address to `src/catalog/contracts.js` when new.
3. Add the `forkFeatures.js` entry (title, action, assertion) — `catalog:check` fails without it.
4. `npm run catalog:docs` (updates docs/04 tables), then `npm run lint && node scripts/catalog.js --check`.
5. `CHAINS=<chain> FORK_ONLY=<script> npm run fork:all` to confirm it passes inside the suite,
   i.e. under per-test snapshot isolation.

## Waves

| Wave | Scope | Agents | Why this order |
| --- | --- | --- | --- |
| 0 (pilot) | Tornado Cash, Grove Finance, Fluid DEX | 3 | One chain each, three different shapes (pool deposit, vault deposit, DEX swap) to prove the contract before scaling |
| 1 | remaining Ethereum (12) | 3 × 4 | Same chain, so a shared RPC/port budget is easy |
| 2 | Binance 3 + Base 1 | 2 | Different chains, low volume |
| 3 | Arbitrum, Polygon, Avalanche 1 each | 3 | Each needs its own RPC and a bespoke read |

## Risks

- **False positives from weak assertions.** The main failure mode is a test that sends a tx and
  reports PASS without checking a delta. The reviewer must see the delta in the `key`.
- **Wrong address.** Agents must cite the docs URL and prove `getCode` is non-empty; a typo'd
  address on a fork can still "succeed" against an empty account.
- **RPC pressure.** Three concurrent forks on one Alchemy key is the practical ceiling; more
  parallel agents produce 429s that look like test failures.
- **Shared-file conflicts.** Prevented by the file-ownership rule above, not by merging.
- **Registry drift.** `catalog:check` enforces the `forkFeatures` ↔ `package.json` link, so a
  half-integrated test cannot ship.
