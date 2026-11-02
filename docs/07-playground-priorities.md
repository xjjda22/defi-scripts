# Playground priorities (fork coverage)

Routine-facing note for the playground batch (part 2 of 4). Updated 2026-11-02.

## Order of work

1. **Top-50 gaps first.** Every top-50 row without a `direct` fork test, before any long-tail row. Re-check each run with `stats.coverage.top50` in `showcase/data.json`.
2. **Forkable top-200 rows with status `none`**, by rank, skipping recorded decisions.
3. **`linked` rows:** replace a borrowed test with the row's own product action when one exists.
4. Long tail (#100+) only after 1–3 are empty or documented.

A batch never builds tests against recorded decisions: **Hyperliquid Bridge** (perps fork coverage closed) and **Tornado Cash** (skipped).

## How coverage is counted

`stats.coverage` (built by `src/catalog/forkStatus.js`):

| Status | Meaning | In the headline? |
| --- | --- | --- |
| `direct` | The row's own product is exercised | yes |
| `linked` | Reuses another product's test (ether.fi Liquid and Nonce Capital via `fork:veda:deposit`) | no, reported separately |
| `failing-paused` | Every test on the row FAILs on purpose while the protocol is paused (Dolomite markets closing, Swell) | no |
| `none` | API-only | no |

The denominator is the pinned snapshot `data/coverage-snapshot.json` (id `2026-11-02`, 106 forkable rows including Avalanche; 104 on the pre-Avalanche chain set). Re-pin only on purpose with `npm run coverage:pin -- <id>` and record it in CHANGELOG. Health updates `PAUSED` in `forkStatus.js` when a pause pre-check starts or stops failing.

## Top 50 on 2026-11-02 (data built 2026-10-29)

Direct: 26 of 50. Linked: 1 (Nonce Capital). Non-forkable rows are listed in `stats.coverage.nonForkable` with a reason per chain.

Forkable top-50 rows without a direct test, all documented:

| Rank | Row | Why no direct test |
| --- | --- | --- |
| 6 | Hyperliquid Bridge | Recorded decision: perps fork coverage closed |
| 13 | Maple | Permissioned syrup deposits |
| 16 | Re | KYC-gated |
| 20 | Tornado Cash | Recorded decision: skipped |
| 21 | Unit | MPC/TSS guardian custody |
| 23 | Plume Vaults | Compliance-gated |
| 28 | Nonce Capital | `linked` via `fork:veda:deposit` (curator; nothing of its own to call) |
| 50 | NEAR Intents | Settles on NEAR |

Resolved 2026-11-02: **#1 LayerZero V2** now has `fork:layerzero:send` (EndpointV2 `PacketSent` + outbound nonce through the USDT0 OApp). **#8 Coinbase Bridge** is documented API-only: custodial, TVL on Bitcoin/Ripple/Cardano, mints only by Coinbase. **Benqi** (#198 sAVAX, #200 Lending) have direct Avalanche tests; **Fence Finance** is contracts-only (pool drained 2026-10-27).

The remaining top-50 gap is structural: Solana, Bitcoin, Hyperliquid L1, Tron and off-chain rows cannot be forked with Anvil.
