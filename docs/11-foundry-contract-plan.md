# Foundry contract-test plan (2026-11-07)

Status: **W0 built (2026-11-07).** The queue is **99 rows**, not 200; W0 builds 4 tests — 3 from
the queue (Uniswap, Lido, Bedrock) plus the Aave port — and they pass on a pinned Ethereum fork.

Two gaps are often conflated. **Address coverage:** 100 rows have no contract address in
`contracts.js`; 99 are outside this queue (reasons in §2), and only Bedrock uniETH is both
EVM-forkable and missing an address. **Solidity test coverage:** 198 rows have no `.t.sol` at all.
This plan closes the second gap for the 98 rows that have addresses, and closes both gaps for the
one row where they are both missing.

This plan turns the per-protocol address book into a Foundry suite that runs on `forge` against a
pinned `anvil` fork. It is additive: the JS `fork:*` suite stays the multi-step orchestrator, and
a `.t.sol` owns the contract-level primitive.

## 1. Baseline

What Foundry covers today:

| Artifact | Count | What it is |
|---|---:|---|
| `src/simulation/fork/contracts/*.sol` | 2 | `FlashReceivers.sol`, `MockPrice.sol` — the only Solidity sources the repo deploys |
| `test/contracts/*.t.sol` | 5 | 2 fork tests (Aave V3, Morpho Blue through the receivers) + 3 unit tests for those sources |
| Top-200 rows with a Foundry test (receiver path) | 2 / 200 | Aave (rank 2), Morpho (rank 5) |
| Top-200 rows with configured addresses | 100 / 200 | 313 entries, 307 distinct addresses |
| JS fork suite | 114 recipes / 204 unique `fork:*` scripts | Anvil + ethers, not `.t.sol` |

The address book is generated upstream of this plan: `showcase/data.json` → `testing.contracts`
→ `contractsForKeys()` in `src/catalog/contracts.js`. This plan does not change that pipeline.

## 2. The denominator is 99

| Bucket | Rows | Work |
|---|---:|---|
| Has addresses, no `.t.sol` | 98 | one `.t.sol` per row (parity) |
| EVM-forkable, no addresses (Bedrock uniETH) | 1 | find and verify addresses, then `.t.sol` |
| Already has a Foundry test | 2 | Aave, Morpho — keep, extend |
| Not queued (reasons below) | 99 | no file |
| **Total** | **200** | **99 new files** |

After W0, 96 of the 98 parity rows remain queued. Aave is an extra port on a row that already had
a receiver test; Uniswap, Lido and Bedrock are built.

The 99 rows not in this queue, by reason:

| Reason | Rows | Examples |
|---|---:|---|
| Non-EVM TVL only | 48 | Solana, Sui, Tron, Bitcoin, Hyperliquid L1, Starknet, Stellar, Near |
| No chain TVL on the board | 33 | aggregators and wallets: 0x, Enso, Bebop, Titan, Nordstern, Arcus |
| EVM chain not in the fork RPC map | 8 | BSquared, Pharos, Robinhood Chain, Anubis, RISE, CORE, Gnosis (RealT, whitelisted) |
| Documented no-fork reason on a forkable chain | 10 | Unit, NEAR Intents, Solv, M0, Avalanche Core Bridge, Liquid Collective, Aster USDF, PinkSale, SoSoValue, Valos |

`docs/07` declared bucket 4 empty on 2026-11-05. Its 89/111 split is that board; the 2026-11-07
board in `showcase/data.json` has 93 fork-tested and 107 API-only rows. The 98/99 split in this
plan is computed from the 2026-11-07 file, not copied from `docs/07`.

On the 2026-11-07 board, Bedrock uniETH (rank 198) is the one EVM-forkable row whose own
`testing.note` says the uniETH deposit/mint recipe does not exist yet — so it is the one
**discovery** row. That discovery is resolved: `0xF1376bceF0f78459C0Ed0ba5ddce976F1ddF51F4`,
symbol `uniETH`, 18 decimals, EIP-1967 implementation `0x8a94866dF557Bb7FCe88EfF9917237286098e590`.
The address is in BOOK and the generated book; the bucket still comes from the next
`coverage-snapshot` rebuild, not from a hand assignment.

Two of those four buckets are deferrals, not verdicts. The 8-row chain bucket moves into the
queue as soon as its chain gets an `*_RPC_URL` in `src/config/chains.js`; the 33 no-TVL rows are
a measurement gap (0x, Enso and Bebop do have on-chain settlement contracts — the board just does
not attribute chain TVL to them), so a future TVL attribution moves a row in. The 48 non-EVM rows
and the 10 documented rows are the only hard "no": this suite is EVM-only, and those ten gate every
permissionless action behind an allowlist, an off-chain signer or a custodian (MPC guardians, SGX
wardens, whitelisted pools, KYC). They stay API-only; a `.t.sol` cannot prove them on one chain.

Of the 98 parity rows, 91 are fork-tested and 7 are API-only with addresses (Maple, Re, Plume
Vaults, OpenTrade, Huma, Avalon Superearn, SSV Network). For the API-only seven, the `.t.sol`
covers read-only invariants (supply, rate, role wiring), not a deposit that the protocol gates.

## 3. What Foundry adds that the JS suite does not

The 204 `fork:*` scripts are orchestration: start Anvil, impersonate a whale, send three
transactions, compare balances. That is the right layer for multi-step flows and for the
showcase commands. A `.t.sol` is the right layer for the contract itself:

- typed calls and `require`-based assertions against the ABI the protocol actually ships;
- storage and event assertions a JS test can only reach through `eth_getStorageAt`;
- compilation against the same solc as `FlashReceivers.sol`, so ABI drift fails the build;
- `forge test` runs without Node, ethers or a running Anvil process (it forks in-process).

Rule: **one primitive per file, not a copy of the JS flow.** Port the action's contract call and
its measured delta. Leave multi-protocol recipes (flash-loan-into-swap, liquidate with a mock
oracle) in the JS suite until a `.t.sol` can assert the same numbers more directly.

Not doing: re-implementing Aave, Uniswap or any protocol source, and not substituting a mock for
the protocol. A `.t.sol` calls the deployed contract on a fork; a local mock is only a fixture
(oracle, receiver, token) and is labelled as one.

## 4. Layout

```
test/contracts/
  protocols/
    _shared/
      ProtocolTestBase.sol      # fork setup, skip, code checks, deal helpers
      Addresses.sol             # GENERATED from src/catalog/contracts.js
    aave/
      AaveV3.fork.t.sol
      interfaces/IAaveV3Pool.sol
    uniswap/
      UniswapV3.fork.t.sol
      interfaces/IUniswapV3Router.sol
    ...
scripts/buildAddressBook.js     # codegen + --check
```

Rules:

- `foundry.toml` keeps `src = "src/simulation/fork/contracts"`, `test = "test/contracts"`,
  solc 0.8.24, optimizer off. No `lib/forge-std`: keep the local `Vm` interface (this repo has no
  submodules, and the five existing tests prove the pattern). Extend that interface with
  `startPrank`, `stopPrank`, `warp`, `roll` and `expectEmit` as the tests need them.
- `interfaces/` holds only the functions the test calls. Do not copy a full protocol SDK.
- `Addresses.sol` is generated; `check:address-book` fails when `contracts.js` changed without
  regeneration. No address literal in a `.t.sol` (R4.6). Solidity has no nested libraries, so the
  generator emits one file-level library per BOOK key (`Aave`, `Uniswap`, `Usdc`, …) plus
  `Tokens`. Import the module as `import * as Addresses from "../_shared/Addresses.sol";` and use
  `Addresses.Aave.V3_POOL`, `Addresses.Tokens.USDC_ETHEREUM`.
- Test names: `test_fork_<protocol>_<action>`. One file per protocol row; one function per action.
- Project-root imports (`src/simulation/fork/contracts/...`) keep the test path short; no
  remappings are needed.

## 5. Harness

`ProtocolTestBase` extends the existing `TestBase` (`test/contracts/helpers/TestBase.sol`):

```solidity
abstract contract ProtocolTestBase is TestBase {
    function _fork(string memory rpcEnv, uint256 chainId) internal returns (bool) {
        string memory url = vm.envOr("FORK_RPC_URL", vm.envOr(rpcEnv, string("")));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return false;
        }
        uint256 blockNo = vm.envOr("FORK_BLOCK", uint256(0));
        if (blockNo == 0) {
            string memory pins = vm.readFile(string.concat(vm.projectRoot(), "/data/fork-blocks.json"));
            blockNo = vm.parseJsonUint(pins, string.concat(".chainsById.", vm.toString(chainId), ".blockNumber"));
        }
        require(blockNo > 0, "missing fork pin: observe this chain first");
        vm.createSelectFork(url, blockNo);
        require(block.chainid == chainId, "chain id");
        return true;
    }

    function _requireCode(address target) internal view {
        require(target.code.length > 0, "no code");
    }
}
```

A test:

```solidity
import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {Vm, vm} from "../../helpers/TestBase.sol";
import * as Addresses from "../_shared/Addresses.sol";
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IAaveV3Pool} from "./interfaces/IAaveV3Pool.sol";
import {IAaveProtocolDataProvider} from "./interfaces/IAaveProtocolDataProvider.sol";

contract AaveV3ForkTest is ProtocolTestBase {
    function test_fork_aave_supply() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address pool = Addresses.Aave.V3_POOL;
        address usdc = Addresses.Usdc.USDC;
        _requireCode(pool);
        _requireCode(usdc);

        (address aUsdc,,) = IAaveProtocolDataProvider(Addresses.Aave.V3_DATA_PROVIDER)
            .getReserveTokensAddresses(usdc);
        _requireCode(aUsdc);

        address user = address(0xA11CE);
        _dealUsdc(usdc, user, 1_000e6);

        vm.startPrank(user);
        IERC20(usdc).approve(pool, 1_000e6);
        IAaveV3Pool(pool).supply(usdc, 1_000e6, user, 0);
        vm.stopPrank();

        assertEq(IERC20(usdc).balanceOf(user), 0, "usdc spent");
        assertTrue(IERC20(aUsdc).balanceOf(user) >= 1_000e6 - 2, "aToken");
    }
}
```

Aave V3 books USDC at LTV 0 at the W0 block, so `getUserAccountData` collateral is not the
supply delta; the aToken balance is. The data provider resolves aUSDC, so the test pins no
token address.

Each test imports `Vm`/`vm` itself: Solidity imports are not transitive, so `ProtocolTestBase`
does not re-export the cheatcode handle.

`_dealUsdc` uses `vm.store` only for tokens whose balance slot is documented (USDC slot 9,
already used by `AaveFlashReceiver.fork.t.sol`); otherwise the test funds from a whale. The whale
list stays in `src/utils/impersonate.js`; a storage write without a cited slot is rejected in
review.

## 6. Run modes

```bash
# A. pinned anvil fork — the mode CI and reviewers use
CHAIN=ethereum FORK_BLOCK=26363300 node scripts/startFork.js
FORK_RPC_URL=http://127.0.0.1:8545 \
  forge test --match-path 'test/contracts/protocols/**/*.t.sol' -vv

# B. direct upstream fork — no anvil process
FORK_RPC_URL=$ETHEREUM_RPC_URL FORK_BLOCK=26363300 \
  forge test --match-contract AaveV3ForkTest -vv

# C. no RPC — every fork test skips; the job reports the skip count
forge test --match-path 'test/contracts/protocols/**/*.t.sol'
```

`FORK_BLOCK` defaults per chain from `data/fork-blocks.json` (observed RPC headers; refresh weekly with `observe:fork-blocks`), so a green run
is reproducible. A committed test that forks `latest` is a review FAIL.

## 7. Acceptance

A `.t.sol` ships only when all of these hold:

1. `block.chainid` is asserted against the intended chain.
2. Every address used passes `_requireCode`.
3. At least one **state delta** is asserted: balance, shares, debt, nonce, timestamp, or an event
   with exact arguments. A getter-only test must assert a value that can change (exchange rate
   above 1, non-zero `totalSupply`) — not merely "not zero".
4. The fork block is pinned, and the test passes twice in a row from that block.
5. Runtime under 60 s; no `PRIVATE_KEY`; no broadcast.
6. `vm.skip(true)` when the RPC env is missing. CI parses `forge test --json` and fails the fork
   job when `skipped > 0` while the job claims to have run — a skip is not a pass, the same rule
   as `fork:all`.

For proxies, `getCode` is not enough: assert the implementation or admin getter, or a value only
the implementation can return.

## 8. Waves

| Wave | Scope | Files | Why |
|---|---|---:|---|
| W0 (pilot) — **built** | harness + codegen; Aave USDC, Uniswap V3, Lido, Bedrock uniETH | 4 | two lending/DEX flows, one staking, one discovery |
| W1 | parity, rank 1–50 | 33 | half the value in the top quartile |
| W2 | parity, rank 51–100 | 23 | |
| W3 | parity, rank 101–200 | 40 | long tail; ERC-4626 vaults dominate and are the cheapest tests |
| — | already covered (Aave, Morpho) | 2 | Aave is ported in W0; Morpho still only has the receiver test |
| — | out of scope | 99 | reasons in `docs/07` and `testing.note` |

W0 receipt (Ethereum block 26,363,300): **4 passed, 0 failed, 0 skipped**; without
`ETHEREUM_RPC_URL`: **4 skipped, 0 failed**.

| Test | Measured delta | Gas |
|---|---|---:|
| `AaveV3ForkTest.test_fork_aave_supply` | 1,000 USDC supplied; aUSDC 999,999,999 (1 wei share rounding) | 178,811 |
| `UniswapV3ForkTest.test_fork_uniswap_v3_swap` | 1 WETH → 2,239.765879 USDC; router `factory()` matches | 150,546 |
| `LidoForkTest.test_fork_lido_submit` | 1 ETH → 0.999999999999999999 stETH; `submit` returns 0.800853… shares | 127,126 |
| `BedrockUniETHForkTest.test_fork_bedrock_unieth_read` | symbol `uniETH`; totalSupply > 0; EIP-1967 impl + admin match | 32,252 |

W0 also ports the Aave action onto `ProtocolTestBase` so there is one pattern, not two. The
Morpho receiver test stays as the receiver-specific test.

Effort: W0 4–5 days; each parity test 0.5–1.5 days (2–3 for lending liquidations or a non-trivial
proxy). The 96 W1–W3 files are **~65–100 engineer-days**, or 4–6 weeks with three agents. W1
(33 files) is ~25 days and should land before W2 starts.

## 9. CI and gates

W0 adds to `.github/workflows/ci.yml` `check`:

- `npm run check:address-book`
- `npm run test:contracts` — the no-RPC run. Skips are allowed here because the job also runs the
  three existing non-fork unit tests.

Implemented by the infrastructure follow-up: a `foundry-fork` job, `continue-on-error` like `fork-suite`, with the same RPC secrets:

- `npm run test:contracts:fork` (`node scripts/foundryFork.js`; per-chain local Anvil, pinned header identity, serial JSON parsing)
- summary line `PASS n, FAIL n, SKIP n`, and a warning annotation when `SKIP > 0`.

Registry gate (`src/catalog/foundryTests.js`, implemented): `{ slug, file, status: "passing" | "skipped" |
"planned" }`. `catalog:check` warns for `planned` and fails when `passing` has no file. Flip to
fail for every parity row after W2. Do not gate W3 by count; gate by registry completeness.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Duplicate of the JS suite, drift | one address source (codegen); `.t.sol` owns the primitive, JS owns the multi-step recipe; registry links script ↔ file |
| RPC rate limits | pinned blocks, one fork per chain, `--jobs 1`, the existing `forkSuite` retry budget |
| Storage-slot hacks break on a proxy upgrade | cite the slot; prefer whale funding; assert `getCode` and a getter first |
| Proxy `getCode` passes but the call hits a stub | assert implementation/admin or a value only the implementation returns |
| Latest-block drift | `data/fork-blocks.json`, pinned weekly; no `latest` in a committed test |
| Skip reported as pass | parse `--json` counts; fail the fork job on `skipped > 0` |
| Long tail stalls | W1 is the stopping point if the budget shrinks; W2/W3 stay `planned` in the registry |

## 11. W0 build (2026-11-07)

Built and green:

1. `test/contracts/protocols/_shared/ProtocolTestBase.sol` — fork, skip and code checks; the
   shared `Vm` gained the native-ETH `deal`, `load`, `startPrank`, `stopPrank`, `warp`, `roll`
   and `expectEmit` declarations.
2. `scripts/buildAddressBook.js` + generated `test/contracts/protocols/_shared/Addresses.sol`
   (157 libraries, 515 constants, `--check` gated). `build:address-book` and
   `check:address-book` are in `package.json`; the check runs in CI.
3. `test/contracts/protocols/aave/AaveV3.fork.t.sol` — USDC supply, aUSDC delta via the Aave data
   provider. Aave V3 books USDC at LTV 0 at this block, so collateral is not the delta.
4. `test/contracts/protocols/uniswap/UniswapV3.fork.t.sol` — `exactInputSingle`, exact USDC out.
5. `test/contracts/protocols/lido/Lido.fork.t.sol` — `submit`, stETH delta, `submit` returns shares.
6. `test/contracts/protocols/bedrock/BedrockUniETH.fork.t.sol` — read-only proxy/implementation
   invariants for the discovery row.
7. `npm run test:contracts` in the `check` CI job.

Acceptance met: with an Ethereum RPC and `FORK_BLOCK=26363300`,
`forge test --match-path 'test/contracts/protocols/**'` prints **4 PASS, 0 SKIP**; without one,
**4 SKIP, 0 FAIL**. `check:address-book`, `check:contracts`, `catalog:check` and `npm run lint`
are green.

The infrastructure follow-up implements the CI job and registry gate. W1 (33 parity files, rank 1–50) remains a separate acceptance stage; W2/W3 are not started by this infrastructure change. Regenerate the queue with `npm run foundry:queue`.

## Appendix — queue

`output/foundry-contract-queue.csv` (generated, gitignored) has all 200 rows:
`rank, protocol, slug, category, unique_contracts, contract_entries, chains, testing_mode,
foundry_bucket, wave, status, reason` (157 libraries, 515 constants in the address book, not
counted per row).

## Infrastructure receipt (2026-11-08)

The committed board is still the snapshot generated 2026-11-06 at 9:59 PM MYT (UTC+8), not
reranked by this change. The generator reattaches its rows to **current** `contracts.js`:
Bedrock's W0 discovery adds its three entries, so configured-address rows are now 101, not
the original 100. This is address-book drift, not a new board row or a completed W1 test.
There are still 99 new-file target rows relative to the original Aave/Morpho baseline;
three were built by W0, leaving W1/W2/W3 at 33/23/40. Aave's additional primitive is the
fourth W0 file; Morpho's receiver is listed separately and is not claimed by the W0 receipt.
The generated CSV contains every board row, including exclusions with reasons. It is ignored,
not a manually maintained second ranking.

`data/fork-blocks.json` records chain ID, numeric height, hash, timestamp, observation time,
and RPC env name from actual header queries. All eleven chains already in `RPC_ENV` were
observed on 2026-11-08, 9:21–9:23 AM MYT (UTC+8); no chain configuration was added.
Ethereum deliberately retains the W0 archive block 26,363,300. Observing the other chains'
headers is **not** evidence their protocol tests ran or that a public provider retains archive
state. Refresh with a configured archive endpoint when necessary:

```bash
CHAINS=ethereum FORK_BLOCK=26363300 npm run observe:fork-blocks
# Omit FORK_BLOCK to record an actually observed head; only numeric heights are saved.
# With an explicit block, select exactly one chain.
CHAINS=base npm run observe:fork-blocks
npm run foundry:queue
npm run test:foundry-runner
node scripts/foundryFork.js --no-rpc
npm run test:contracts:fork
```

The runner creates its own loopback-only Anvil on a free port for each configured chain,
checks its chain/header identity, runs files serially, then kills that Anvil. Each `_fork`
creates a fresh in-process test fork of that local node at the pin; no test state is shared.
The harness interface remains `_fork(rpcEnv, chainId)`; `FORK_RPC_URL` overrides the named
upstream for local runs, `FORK_BLOCK` overrides the numeric pin for author testing, and a
missing/zero pin is an error when an RPC exists. No URL/key is stored in the header file or
execution summary. No `latest` fallback exists in the protocol harness. The two legacy receiver tests now
require explicit `FORK_BLOCK` when an RPC is present; `forkAaveCheck.js` supplies the actual
Anvil block it already observes, preserving its existing per-chain orchestration.

No-RPC protocol receipt: **PASS 0, FAIL 0, SKIP 4**, explicitly labelled not a fork pass.
Two independent Anvil runs at Ethereum block 26,363,300: **PASS 4, FAIL 0, SKIP 0** each.
The runner writes `output/foundry-fork-summary.json` with real JSON test counts and separate
infrastructure errors. A configured-chain skip, nonzero forge exit, empty/unknown JSON, or
startup/hash failure exits nonzero; an unavailable chain is shown as no-RPC rather than
silently counted as passing. Planned rows are not counted as executed or skipped tests.
`forge test` without RPCs also ran the existing non-fork tests: **12 PASS, 0 FAIL, 6 SKIP**
(the six skips include both legacy receivers and the four protocol files). A separate pinned
compatibility invocation returned **6 PASS, 0 FAIL, 0 SKIP**, including the legacy receivers;
this one compatibility run is not represented as Morpho protocol-wave acceptance.

For integration, add each accepted file to `BUILT` in `foundryTests.js` with its actual chain.
Use `planned` before implementation, `skipped` for a built but unverified/unavailable file
with a reason, and `passing` only with a receipt of two pinned runs. The catalog checks
missing files, passing-without-evidence, duplicate slugs, and unregistered protocol files.
Planned W1–W3 rows warn only; the post-W2 completeness gate is deliberately not enforced yet.

Acceptance caveats surfaced during W1 planning: the seven API-only rows are not an exhaustive
list of read-only primitives. Sentora can expose getter-only verification, and Ondo's mint
is KYC-gated despite its JS fork label. Apply §7's substantive mutable-value/proxy-invariant
acceptance rather than inventing permissionless deposits or calling code existence a pass.
Veda and Nonce Capital can share a deployed vault: registry/queue counts are **board rows**,
not a claim of distinct deployments or independent underlying liquidity.
