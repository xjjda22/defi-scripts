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
| EVM chain not in the fork RPC map | 8 | BSquared, Pharos, Anubis, RISE, CORE, Gnosis (RealT, whitelisted) |
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
execution summary. No `latest` fallback exists in the protocol harness. Both legacy receiver tests also use
that harness, including its Ethereum pin default and local URL override. For Aave's
multi-chain checker, `FORK_CHAIN_ID` selects the configured chain/pin/RPC env; its pool/token
overrides are still explicit. `forkAaveCheck.js` passes both the actual Anvil block and chain
ID it already knows, preserving its existing per-chain orchestration. Morpho's legacy
market fixture is Ethereum-specific and asserts chain 1 rather than pretending it is portable.

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

Acceptance caveats surfaced during W1 planning: do not expand the seven read-only exceptions
merely because an initial probe only reads getters. Sentora's later public interest-settlement
receipt below supersedes its initial getter-only classification. Ondo issuer subscription is
registration-gated, while a separate public rUSDY conversion candidate remains unproven.
Apply §7's substantive primitive acceptance rather than inventing permissions or calling code
existence a pass.
Veda and Nonce Capital can share a deployed vault: registry/queue counts are **board rows**,
not a claim of distinct deployments or independent underlying liquidity.

### Critical infrastructure review

Queue eligibility follows **configured contract deployment chains**, not words in a row name.
Base Bridge's L1StandardBridge/OptimismPortal are on Ethereum; Robinhood Chain Bridge's
Inbox/Bridge/Outbox/Rollup are also on Ethereum. Both are eligible source-chain primitives,
not a claim to execute their destination chain. The unsupported-chain exclusion cannot be
applied merely because the bridge's destination has no RPC. The original Robinhood example
in that exclusion table was misleading and has been removed. Binance staked ETH's wBETH
address is an Ethereum staking contract, not the excluded CEX or custodial BTC product.
All three rows therefore remain W1 on the pinned board. The registry now derives its default
execution chain from supported **address chains**, with catalog validation for each file's
chosen deployment chain; it does not trust a category's generic fallback chain.

JSON results fail closed for no matching contracts (`{}`), compiler-only output, unknown
statuses (including inherited JavaScript object keys), and malformed suite arrays. Setup
failures replace any prior summary artifact with zero tests counted plus an infrastructure
error. Forge subprocesses receive only the local fork URL, not upstream fork defaults or
signing-key envs, and FFI is disabled. The header-query helper permits only chain/header
reads. `forge test` has no broadcast path: state-changing contract calls execute in its
simulated EVM; the upstream is used for reads, never live transaction submission. Raw RPC
errors and timeout diagnostics are not copied into public summaries.

Header observations on other chains remain header-only evidence. This review does not
upgrade their planned rows, prove public archive retention, or infer a pass from a reachable
RPC. Only explicitly recorded test executions can change the registry's passing status.

### Receiver default review (2026-11-08)

Both existing receiver tests passed twice on a local Ethereum Anvil fork at block 26,363,300,
with `FORK_BLOCK` unset/zero so that the shared JSON default was actually exercised.
Each invocation returned **PASS 2, FAIL 0, SKIP 0**. The named Ethereum upstream env was set
to an unreachable loopback endpoint in these runs: their success verifies the local
`FORK_RPC_URL` override was used. A separate standalone invocation using only the configured
Ethereum RPC and no explicit block/override also returned **PASS 2, FAIL 0, SKIP 0**. All
state-changing calls remained simulated. Morpho's registry execution status is therefore
passing with this measured receipt; its receiver wave still does not count as a newly built
W1 primitive. These runs do not establish receiver portability to any other chain.

## W1a receipt (2026-11-08)

Imported protocol commit `c7ec3bec37f66941e3a168fe9bbda44d86482fe4`: fifteen files, each passed twice at Ethereum block 26,363,300 except Hyperliquid Bridge at Arbitrum block 522,239,393. The worker reported zero failures/skips in final acceptance. These are bounded primitives, not every protocol feature.

| Row | Primitive receipt (raw units) |
|---|---|
| `layerzero-v2` | outbound nonce before: 38627;   outbound nonce after: 38628;   USDT locked: 100000000 |
| `sparklend` | USDC supplied: 100000000;   aUSDC minted: 100000000 |
| `ethena` | USDe staked: 100000000000000000000;   sUSDe minted: 79552746860503932265 |
| `hyperliquid-bridge` | EVM block number: 26366830;   requested L2 fork pin: 522239393;   escrow USDC delta: 10000000 |
| `veda` | WETH deposited into shared Veda/Nonce vault: 10000000000000000;   Liquid ETH shares minted: 9004726812624452 |
| `steakhouse-financial` | fee shares minted: 1628064535252680180;   USDC deposited: 100000000;   shares minted: 87152829664869978845 |
| `ccip` | LINK locked: 1000000000000000000;   ETH fee paid: 227384233157793 |
| `maple` | syrupUSDC total supply (read-only): 771432502497933;   USDC per 1e6 shares (read-only): 1191883 |
| `re` | reUSD: 320406443346881915436284614;   reUSDe: 20471878759381985255377948 |
| `binance-staked-eth` | wBETH minted: 900720313132899095;   ETH locked: 1000000000000000000 |
| `rockawayx` | USDC deposited: 100000000;   shares minted: 96354792794393198649 |
| `polygon-bridge` | predicate ETH delta: 50000000000000000 |
| `plume-vaults` | nALPHA: 3585625943039;   nBASIS: 100880819338;   nALPHA vault total assets (read-only): 4057791924096 |
| `nonce-capital` | WETH deposited into shared Veda/Nonce vault: 10000000000000000;   Liquid ETH shares minted: 9004726812624452 |
| `tether` | USDT sender debit: 100000000;   USDT receiver credit: 100000000 |

Veda and Nonce Capital intentionally deposit into the **same** ether.fi Liquid ETH BoringVault: these are two board-row attributions, not two independent deployments or proof of every curator exposure. Maple, Re and Plume use the plan's approved read-only exceptions; no KYC-gated mint is represented as executed. The initial fifteen-file import contained neither Sentora nor Ondo; the later Sentora receipt below closes interest-settlement coverage, not investor deposits. Ondo remains planned/blocked without an accepted file.


## W1b receipt (2026-11-08)

Imported protocol commit `94acb3130a68520d320c11d2be66caf567af05da`: sixteen files, each passed twice at the same committed chain pins. Fourteen are state-changing primitives, OpenTrade is an approved read-only exception, and cbETH is tested but **coverage-blocked**.

| Row | Primitive receipt (raw units) |
|---|---|
| `base-bridge` | source-chain ETH locked: 50000000000000000 |
| `upshift` | sentUSD shares minted: 95088416; USDC spent: 100000000 |
| `concrete` | ctDefiUSDT shares minted: 93237553; USDT spent: 100000000 |
| `lighter-bridge` | Lighter USDC increase: 20000000 |
| `defi-saver-asset-management` | DFS recipe WETH supplied: 1000000000000000000; wallet aWETH minted: 999999999999999999 |
| `tornado-cash` | pool ETH increase: 100000000000000000; Merkle leaf index: 76220 |
| `robinhood-chain-bridge` | bridge ETH increase: 50000000000000000 |
| `hyperithm` | accrued fee shares minted: 97690311448763175847; shares minted: 93587065188699408776; USDC share value: 99999999 |
| `gauntlet` | performance-fee shares minted: 1274095678894901285; shares minted: 87889033520519326210; USDC share value: 99999999 |
| `aera` | USDC escrowed then refunded: 100000000; minimum units requested: 88936240050831187096 |
| `opentrade` | XTBT supply: 60263425069; XTBT total assets: 66695913405; USDC per 1 XTBT: 1106739; accrued assets over shares: 6432488336 |
| `coinbase-wrapped-staked-eth` | cbETH exchange rate: 1143516358079014311; cbETH supply: 393750601365061869784889; accrued backing over shares: 56509652299335440468893 — rate-implied arithmetic only, NOT independent reserve/custody proof |
| `curve-finance` | Llamalend shares minted: 90191000231653259501886; crvUSD share value: 99999999999999999999 |
| `etherfi-borrowing-market` | Hub USDC increase: 100000000; supplied USDC assets: 99999999; supply shares minted: 99566071 |
| `obol` | OBOL staked: 922058161977852557047; stOBOL minted: 734714306716429792446; stOBOL supply increase: 734714306716429792446 |
| `pancakeswap` | WETH spent: 50000000000000000; USDC received: 111813932 |

Scope limitations preserved in acceptance:

- **cbETH:** the pinned implementation has no permissionless wrap/unwrap/deposit/redeem path; non-minter mint/burn reject. The rate/supply read-only test really executes and passes, so it is not a `vm.skip`. Its `coverageStatus` remains blocked, outside the seven approved read-only exceptions, and its rate-implied backing arithmetic does not prove Coinbase reserves. Sources: [Coinbase token design](https://github.com/coinbase/wrapped-tokens-os/blob/main/doc/tokendesign.md), [StakedTokenV1](https://github.com/coinbase/wrapped-tokens-os/blob/main/contracts/wrapped-tokens/staking/StakedTokenV1.sol), [pinned implementation](https://etherscan.io/address/0x31724cA0C982A31fbb5C57f4217AB585271fc9a5#code). The old shared-book CDP citation redirects to a generic overview; this receipt supplements it without changing an address.
- **DFS:** the real, book-anchored DFSRegistry resolves the deployed RecipeExecutor and AaveV3Supply. At the Ethereum pin the executor is `0x6e7dEde13E011Eee74E0c731A06c158377fc1Cae`, while the static book/official [mainnet.json](https://github.com/defisaver/defisaver-v3-contracts/blob/main/addresses/mainnet.json) still names an older executor. No blind book update was made. The local delegatecall wallet is a labelled fixture: the test proves deployed recipe dispatch into real Aave, **not** production DSProxy factory/auth behavior.
- **Curve Finance:** the configured primitive is a Llamalend crvUSD lending-vault deposit, not generic Curve DEX/pool coverage. The separate Curve DEX row stays in W3.
- **Fee shares:** Gauntlet and Hyperithm assert exact supply change equals depositor mint plus fee-recipient balance changes, deduplicating shared fee recipients. They do not weaken this to `supplyDelta >= minted`. Passive fee owners may be EOAs; callable dynamic contract dependencies are separately code-checked.

Reproducible funding comes from existing `WHALES` / `EXTRA_WHALES`, shared with the JS runtime, not guessed balance slots. The runner supplies Ethereum USDT/USDe/LINK/crvUSD, Arbitrum USDC, Base USDC and Optimism aOptUSDCn fixtures per chain. Chain-scoped override names (for example `FORK_BASE_USDC_WHALE`) prevent a global USDC whale leaking between chains. Addresses are public fixtures, never keys. Ethereum USDC tests alone retain the already documented slot-9 funding pattern. No upstream URL or signing secret is persisted in receipts.


## Sentora and event review (2026-11-08)

Imported follow-ups `a89c31f04a5f3477aaf98305bc447ef774662e93` and `cf4a193b546596caae0b50361213328aad3d847c`. Sentora now proves a genuine mutable primitive: a fresh unfunded/unprivileged caller invokes public `accrueInterest()` on the generated-book RLUSD vault. Cached assets increase from **407042101108796826704413078** to **407045029447823612584074174**; recognized interest is **2928339026785879661096** RLUSD wei and minted fee shares **288126975960335940238**. Exact preview, fee-recipient deltas, timestamp and zero caller shares are asserted. Worker dedicated passes were **0.2256s / 0.2201s**. This is **not** a validated investor deposit or redemption and needs no read-only exception.

[Official Morpho V2 semantics](https://docs.morpho.org/developers/contracts/morpho-vaults-v2/#accrueinterest) define permissionless accrual and its preview; `maxDeposit`, `maxMint`, `maxWithdraw` and `maxRedeem` always return zero. That sentinel is not evidence that deposits are closed. The stale Sentora recipe note is corrected without changing the JS flow or regenerating the ranking snapshot.

LayerZero now binds its unique nonempty `PacketSent` and configured send-library assertion to the deployed EndpointV2 emitter. Hyperliquid binds the exact USDC sender/escrow/amount `Transfer` to USDC. Polygon binds `LockedEther(user,user,amount)` to the deployed EtherPredicate. Existing nonce/custody/debit deltas remain; these do not prove destination-chain finalization.

The reviewed W1 source is **32 files / 31 accepted board-row primitives**, plus cbETH execution-passing but coverage-blocked. Ondo is the 33rd W1 row, without an accepted file. Veda and Nonce still share one deployment; file/row counts do not imply distinct deployed targets.

### Blockers and exploratory attempts retained

- **Ondo:** [issuer subscribe](https://docs.ondo.finance/developer-guides/usdy-instant-manager-integration) from a fresh caller reverted `UserNotRegistered`. This does not prove all USDY operations are registration-gated: official [rUSDY conversion](https://docs.ondo.finance/general-access-products/usdy/rebasing) is a separate public wrapper candidate subject to sanctions/blocklist rules. A legally funded purchase/wrap/unwrap prototype produced no completed passing result: one manual termination at **81.471s**, then **two strict 60s timeouts**. The delay's stage/root cause is not established; neither protocol pause nor archive failure is inferred. No wrapper address/test is added, no exception expanded. Acceptance still needs an official generated-book entry and two bounded pinned custody/share/burn proofs.
- **Steakhouse:** one unchanged cold review execution timed out at **60.0488s**. Unchanged successive retries passed **21.7611s / 0.0763s**. The selected acceptance pair is not a claim that all exploratory runs passed; no observed protocol assertion failure was suppressed.
- The first pre-review integrated aggregate was **35 PASS / 0 FAIL / 0 SKIP**; a second pre-review run was intentionally interrupted after the Sentora/event follow-ups arrived. It is not counted as a second pass or evidence for the changed sources. Final-source integration receipts are recorded separately below.

For bounded acceptance reruns use `npm run test:contracts:fork -- --twice`: each test is really invoked twice with fresh Forge forks while the same owned pinned Anvil caches upstream reads. JSON `runs` records each pass separately; top-level totals count **executions**, not unique files or coverage rows. Without `--twice`, CI continues to run once. Per-chain whale defaults and overrides apply independently to both invocations.


The current queue still targets **99 new-file rows**: live address resolution moves Bedrock from the snapshot's `98 parity + 1 discovery` to `99 parity`; it does not add another row. Aave/Morpho remain two already-covered rows outside that target, and 99 board rows remain not queued. W0 contributes three new-file targets plus the extra Aave port. Remaining wave sizes are W1 **33**, W2 **23**, W3 **40**. The 64 currently unimplemented files are Ondo plus W2/W3; cbETH is an additional acceptance blocker despite having a real passing file. No ranking/board snapshot was regenerated.

`data/foundry-test-receipts.json` retains sanitized selected worker measurements, exact two-run counts/timings, source hashes (including interfaces/shared harness), header identities, no-RPC results and future-wave partitions. `catalog:check` now rejects a W1 passing claim if its two bounded successful pinned receipts or unchanged source hashes are missing. This checks claims already made; planned future waves still warn rather than fail a premature completeness gate.


## Final reviewed-source integration (2026-11-08)

`npm run test:contracts:fork -- --twice` completed two aggregate passes with **36 PASS / 0 FAIL / 0 SKIP each**, **72 executions total**, zero infrastructure errors. Each pass includes W0's four files plus 32 W1 files; it is not a claim of 36 newly completed W1 rows. Per-pass chain receipts:

| Chain | Observed block | PASS / FAIL / SKIP per pass |
|---|---:|---|
| Ethereum | 26,363,300 | 33 / 0 / 0 |
| Arbitrum | 522,239,393 | 1 / 0 / 0 |
| Base | 54,552,643 | 1 / 0 / 0 |
| Optimism | 159,251,063 | 1 / 0 / 0 |

The complete aggregate took **608.177s**, including cold upstream reads and warm second passes, with fresh Forge forks per invocation. The committed proof retains every parsed test identity/iteration. Other configured chains still have header observations only, not execution evidence. W1 remains **31 accepted / 33 target rows**: cbETH is read-only PASS but coverage-blocked, and Ondo has no accepted file. No W2/W3 test was started or counted.

The final current-driver single invocation returned **0 PASS / 0 FAIL / 36 SKIP**; the no-RPC twice invocation returned **0 PASS / 0 FAIL / 72 SKIP** (36 per pass), explicitly not a fork pass. The entire Solidity suite without RPCs returned **12 PASS / 0 FAIL / 38 SKIP**. Address-book (157 libraries / 515 constants), contract artifacts (3), catalog, lint, showcase checks, all 19 Node runner/registry tests and all 32 new W1 directory format checks passed. Whole-tree `forge fmt --check test/contracts` is not clean: existing W0/shared-helper/legacy-receiver formatting and the generator's `Addresses.sol` layout differ from formatter preferences; no unrelated or generated formatting rewrite was applied. The existing full JS fork suite was not rerun; its scripts/runner are unchanged, with only the existing whale registry additionally exported for shared fixtures.

Runner override names are `FORK_ETHEREUM_USDT_WHALE`, `FORK_ETHEREUM_USDE_WHALE`, `FORK_ETHEREUM_LINK_WHALE`, `FORK_ETHEREUM_CRVUSD_WHALE`, `FORK_ARBITRUM_USDC_WHALE`, `FORK_BASE_USDC_WHALE`, `FORK_OPTIMISM_USDC_WHALE`. All are optional public fixture addresses, not keys. Ambient whale envs are cleared before applying the selected chain's validated defaults/overrides. Forge still receives only the owned loopback fork URL. Unknown/non-string JSON statuses, including array-coerced `Success`/`Skipped`, fail closed.
