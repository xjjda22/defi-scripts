const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseForgeJson, executionFailed } = require("../../scripts/lib/foundryResults");
const { buildRegistry, checkRegistry } = require("../../src/catalog/foundryTests");
const suite = statuses =>
  JSON.stringify({
    "test.t.sol:Example": {
      test_results: Object.fromEntries(statuses.map((status, n) => [`test_${n}()`, { status }])),
    },
  });
test("counts structured successes, failures and skips exactly", () => {
  const result = parseForgeJson(suite(["Success", "Failure", "Skipped", "Success"]));
  assert.deepEqual([result.PASS, result.FAIL, result.SKIP, result.tests.length], [2, 1, 1, 4]);
});
test("a configured execution must fail on skips even with forge exit zero", () => {
  const result = parseForgeJson(suite(["Skipped"]));
  assert.equal(executionFailed(result, 0, true), true);
  assert.equal(executionFailed(result, 0, false), false);
});
test("failure statuses and nonzero exits cannot be painted green", () => {
  assert.equal(executionFailed(parseForgeJson(suite(["Failure"])), 0, true), true);
  assert.equal(executionFailed(parseForgeJson(suite(["Success"])), 1, true), true);
  assert.equal(executionFailed(parseForgeJson(suite(["Success"])), null, true), true); // signal/timeout
});
test("invalid, empty, compiler-only and unknown result schemas fail closed", () => {
  for (const input of ["", "PASS 99", "{}", "[]", '{"errors":[]}', suite(["SomethingNew"])])
    assert.throws(() => parseForgeJson(input));
});
test("registry does not turn addresses or JS coverage into passing Solidity coverage", () => {
  const entries = buildRegistry();
  assert.equal(entries.length, require("../../showcase/data.json").overall.length);
  assert.ok(
    buildRegistry(undefined, {})
      .filter(e => e.foundry_bucket !== "not-queued")
      .every(e => e.status === "planned")
  );
  assert.ok(entries.filter(e => !e.file).every(e => e.status !== "passing"));
  assert.ok(entries.filter(e => e.status === "passing").every(e => e.receipt));
  assert.equal(checkRegistry(entries).problems.length, 0);
});
test("registry fails passing claims without a file or evidence", () => {
  const invalid = [{ slug: "invented", status: "passing", file: null, foundry_bucket: "parity" }];
  assert.ok(checkRegistry(invalid).problems.some(p => p.includes("file and receipt")));
});
test("planned rows warn, rather than prematurely failing W2/W3", () => {
  const result = checkRegistry([
    { slug: "future", status: "planned", file: null, foundry_bucket: "parity", wave: "W3" },
  ]);
  assert.ok(result.warnings.some(w => w.includes("future")));
});

test("all committed fork calls use explicit numeric heights", () => {
  const fs = require("fs");
  const path = require("path");
  const root = path.resolve(__dirname, "../contracts");
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith(".sol")) {
        const source = fs.readFileSync(file, "utf8");
        assert.equal(/vm\.createSelectFork\(url\)/.test(source), false, file);
      }
    }
  };
  visit(root);
});

test("fork headers reject guessed/zero pins, chain drift and endpoint leaks", () => {
  const { checkForkBlocks } = require("../../scripts/lib/forkBlocks");
  const pins = require("../../data/fork-blocks.json");
  assert.deepEqual(checkForkBlocks(pins), []);
  const broken = structuredClone(pins);
  broken.chainsById[1].blockNumber = "latest";
  assert.ok(checkForkBlocks(broken).some(p => p.includes("non-numeric")));
  broken.chainsById[1].blockNumber = 0;
  assert.ok(checkForkBlocks(broken).some(p => p.includes("non-numeric")));
  broken.chainsById[1].chain = "wrong-chain";
  assert.ok(checkForkBlocks(broken).some(p => p.includes("mismatched")));
  broken.chainsById[1].source = "https://example.invalid/credential";
  assert.ok(checkForkBlocks(broken).some(p => p.includes("URLs")));
});

test("prototype keys and array-shaped results cannot masquerade as statuses", () => {
  for (const status of ["constructor", "toString", "__proto__", null, ["Success"], ["Skipped"], {}])
    assert.throws(() => parseForgeJson(suite([status])));
  assert.throws(() => parseForgeJson('{"contract":{"test_results":[]}}'));
  assert.throws(() => parseForgeJson('{"contract":{"test_results":{}}}'));
});
test("runner removes upstream fork URLs, chain overrides and signing keys from forge env", () => {
  const { cleanEnv } = require("../../scripts/foundryFork");
  const names = {
    ETHEREUM_RPC_URL: "upstream",
    FORK_RPC_URL: "upstream",
    FOUNDRY_FORK_URL: "upstream",
    DAPP_FORK_URL: "upstream",
    WALLET_PRIVATE_KEY: "fixture",
    FORK_USDC_WHALE: "fixture",
    FORK_BASE_USDC_WHALE: "fixture",
    FORK_BLOCK: "123",
    FORK_CHAIN_ID: "999",
  };
  const old = Object.fromEntries(Object.keys(names).map(name => [name, process.env[name]]));
  try {
    Object.assign(process.env, names);
    const env = cleanEnv();
    for (const name of [
      "ETHEREUM_RPC_URL",
      "FORK_RPC_URL",
      "FOUNDRY_FORK_URL",
      "DAPP_FORK_URL",
      "WALLET_PRIVATE_KEY",
      "FORK_USDC_WHALE",
      "FORK_BASE_USDC_WHALE",
    ])
      assert.equal(env[name], "");
    assert.equal(env.FORK_BLOCK, "0");
    assert.equal(env.FORK_CHAIN_ID, "1");
    assert.equal(env.FOUNDRY_FFI, "false");
  } finally {
    for (const [name, value] of Object.entries(old))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});
test("setup failure overwrites an old passing artifact with zero counted tests", () => {
  const fs = require("fs"),
    os = require("os"),
    path = require("path");
  const { writeSummary, setupFailureSummary } = require("../../scripts/foundryFork");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-summary-"));
  const file = path.join(dir, "summary.json");
  try {
    writeSummary({ PASS: 999, status: "EXECUTED" }, file);
    writeSummary(setupFailureSummary(), file);
    const result = JSON.parse(fs.readFileSync(file));
    assert.deepEqual([result.PASS, result.FAIL, result.SKIP, result.infrastructureErrors], [0, 0, 0, 1]);
    assert.match(result.status, /^FAILED/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
test("observation helper refuses transaction methods before making any RPC request", async () => {
  const { rpc } = require("../../scripts/observeForkBlocks");
  await assert.rejects(rpc("http://127.0.0.1:1", "eth_sendRawTransaction", ["0x"]), /read-only/);
});
test("bridge/token names do not override the actual deployed address chain", () => {
  const rows = buildRegistry();
  for (const slug of ["base-bridge", "robinhood-chain-bridge", "binance-staked-eth"]) {
    const row = rows.find(r => r.slug === slug);
    assert.equal(row.chain, "ethereum");
    assert.deepEqual(row.chains, ["ethereum"]);
    assert.equal(row.wave, row.rank <= 50 ? "W1" : row.rank <= 100 ? "W2" : "W3");
    assert.equal(row.foundry_bucket, "parity");
  }
});

test("an implemented file cannot silently switch to an unrelated chain", () => {
  const rows = buildRegistry();
  rows.find(r => r.slug === "aave").chain = "base";
  assert.ok(checkRegistry(rows).problems.some(p => p.includes("matching configured row address")));
});
test("test execution PASS is separate from blocked primitive acceptance", () => {
  const rows = buildRegistry();
  const cbeth = rows.find(r => r.slug === "coinbase-wrapped-staked-eth");
  assert.equal(cbeth.status, "passing");
  assert.equal(cbeth.coverageStatus, "blocked");
  assert.ok(cbeth.coverageReason);
  for (const slug of ["ondo-finance"]) {
    const row = rows.find(r => r.slug === slug);
    assert.equal(row.file, null);
    assert.equal(row.status, "planned");
    assert.equal(row.coverageStatus, "blocked");
  }
  const sentora = rows.find(r => r.slug === "sentora-curator");
  assert.equal(sentora.status, "passing");
  assert.equal(sentora.coverageStatus, "accepted");
  assert.match(sentora.reason, /accrueInterest/);
});
test("per-chain whale fixtures cannot leak one chain's USDC whale into another", () => {
  const { fundingEnv } = require("../../scripts/lib/foundryFunding");
  const { EXTRA_WHALES } = require("../../src/simulation/fork/runtime");
  const { getAddress } = require("ethers");
  const base = fundingEnv("base", { FORK_USDC_WHALE: EXTRA_WHALES.optimism.USDC[1] });
  assert.equal(base.FORK_USDC_WHALE, getAddress(EXTRA_WHALES.base.USDC[0]));
  assert.equal(fundingEnv("optimism").FORK_USDC_WHALE, getAddress(EXTRA_WHALES.optimism.USDC[1]));
  assert.equal(
    fundingEnv("base", { FORK_BASE_USDC_WHALE: EXTRA_WHALES.optimism.USDC[1] }).FORK_USDC_WHALE,
    getAddress(EXTRA_WHALES.optimism.USDC[1])
  );
  assert.throws(
    () => fundingEnv("base", { FORK_BASE_USDC_WHALE: "invalid-secret-looking-value" }),
    /Invalid public funding fixture/
  );
});
test("every registered whale-reading primitive has a default fixture on its execution chain", () => {
  const fs = require("fs"),
    path = require("path");
  const { fundingEnv } = require("../../scripts/lib/foundryFunding");
  for (const row of buildRegistry().filter(r => r.file?.startsWith("test/contracts/protocols/"))) {
    const source = fs.readFileSync(path.resolve(__dirname, "../..", row.file), "utf8");
    for (const match of source.matchAll(/envOr\("(FORK_[A-Z_]+WHALE)"/g))
      assert.ok(fundingEnv(row.chain)[match[1]], `${row.slug}: ${match[1]}`);
  }
});

test("passing W1 claims require two pinned successful receipts and unchanged sources", () => {
  const row = buildRegistry().find(row => row.slug === "sentora-curator");
  const proof = require("../../data/foundry-test-receipts.json");
  const root = require("path").resolve(__dirname, "../..");
  assert.equal(
    checkRegistry([row], root, proof).problems.some(p => p.includes("bounded pinned")),
    false
  );
  for (const mutation of [
    r => r.runs.pop(),
    r => {
      r.runs[0].SKIP = 1;
    },
    r => {
      r.runs[0].wallSeconds = 60;
    },
    r => {
      r.blockNumber++;
    },
    r => {
      r.blockHash = "0x" + "0".repeat(64);
    },
    r => {
      r.sourceHashes[row.file] = "0".repeat(64);
    },
  ]) {
    const changed = structuredClone(proof);
    mutation(changed.workerReceipts.find(r => r.slug === row.slug));
    assert.ok(checkRegistry([row], root, changed).problems.some(p => p.includes("bounded pinned")));
  }
  assert.ok(checkRegistry([row], root, {}).problems.some(p => p.includes("bounded pinned")));
});
