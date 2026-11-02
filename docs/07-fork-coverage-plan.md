# Fork coverage plan (2026-11-03)

Status: **proposal + pilot in progress.** Fork tests cover 72 of the top 200 rows. This page
sizes the rest, defines the agent contract used to build the missing tests in parallel, and
records what is deliberately out of scope.

## Both numbers are smaller than they look

| Bucket | Rows | Can a fork test cover it? |
| --- | ---: | --- |
| Top 200 | 200 | — |
| Has a `fork:*` test today | 72 | — |
| No fork test | 128 | — |
| — documented as infeasible in `API_ONLY` | 15 | No, with a written reason |
| — non-EVM (Solana 21, Bitcoin 15, Hyperliquid L1 6, Tron 5, Sui 2, Stellar 2, unknown 32) | 91 | No: the suite is EVM-only |
| **— EVM-forkable, just not built** | **22** | **Yes — this is the campaign** |

So "test every protocol's contracts" means **22 tests**, not 128. The other 106 already have a
reason not to exist; that reason is data, not debt, and it is what `API_ONLY` records.

## The 22, by chain

| Chain | Rows |
| --- | --- |
| Ethereum (15) | Tornado Cash, Obol, Bedrock uniBTC, USDD, Derive V3 Options, Fluid DEX, Avalanche Core Bridge, Railgun, Pendle V2, Liquid Collective, Fluid Lending, Mellow Core, Fraxtal, Axelar Network, SoSoValue Indexes |
| Binance (3) | Solv Protocol (Stablecoin), Aster (Bridge), BitFi Basis |
| Base (1) | Grove Finance |
| Arbitrum (1) | Hyperliquid Bridge |
| Polygon (1) | Polymarket |
| Avalanche (1) | Avant Protocol |

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
