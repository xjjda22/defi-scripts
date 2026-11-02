# Contributing

## Every change goes through a pull request

Open a PR against `main`, wait for CI (`check`, `fork-suite`) and squash-merge. Do not push straight to `main`: the showcase commits of 2026-10-30 (`e3bd201`…`97d5aab`) and `31885fb` (2026-11-02) landed without review and were only recorded afterwards in `CHANGELOG.md`. History is not rewritten for them.

The one automated exception is the `showcase-refresh` workflow, which commits a rebuilt `showcase/data.json` only.

## Before you open a PR

```bash
npm run lint
npm run catalog:docs && npm run catalog:check
node scripts/showcaseCheck.js && node scripts/showcaseSignalsCheck.js
```

- No `.env`, keys, RPC URLs with keys, or private keys in commits. `daily-*claims*` files are never committed.
- Every `fork:*` script needs an entry in `src/catalog/forkFeatures.js` and a recipe in `src/catalog/forkRecipes.js`.
- New contract addresses: EIP-55 checksummed, code on-chain on the stated chain, and taken from the protocol's official docs.
- Add an entry to `CHANGELOG.md` (or leave it to the routine's CHANGELOG PR and say so in the PR body).

## CI fork suite

`fork-suite` runs fork tests only when CI has RPC URLs configured. Otherwise it reports **SKIPPED** in the job summary and a warning annotation; that is not a pass. Fork tests are run live on Anvil by the health routine.
