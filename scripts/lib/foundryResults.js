// Parse structured Foundry results, never human-readable PASS/SKIP log lines.
function parseForgeJson(text) {
  const suites = JSON.parse(text);
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
  const tests = [];
  if (!suites || typeof suites !== "object" || Array.isArray(suites)) throw new Error("Invalid forge JSON root");
  const statuses = { Success: "PASS", Failure: "FAIL", Skipped: "SKIP" };
  for (const [suite, result] of Object.entries(suites)) {
    if (!result?.test_results || typeof result.test_results !== "object" || Array.isArray(result.test_results))
      throw new Error("Missing forge test_results");
    for (const [name, test] of Object.entries(result.test_results)) {
      if (!test || typeof test.status !== "string" || !Object.hasOwn(statuses, test.status))
        throw new Error("Unknown forge test status");
      const status = statuses[test.status];
      counts[status]++;
      tests.push({ suite, name, status });
    }
  }
  if (!tests.length) throw new Error("No tests executed or skipped");
  return { ...counts, tests };
}
function executionFailed(counts, exitCode, claimsExecution) {
  return exitCode !== 0 || counts.FAIL > 0 || (claimsExecution && counts.SKIP > 0);
}
module.exports = { parseForgeJson, executionFailed };
