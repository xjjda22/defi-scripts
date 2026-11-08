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
