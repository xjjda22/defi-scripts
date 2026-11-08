/** Foundry row registry. A file is not proof of execution. Only recorded receipts are passing.
 * W1 precedes W2; planned rows warn today, not a premature future-wave gate.
 */
const fs = require("fs");
const path = require("path");
const { attachTesting } = require("./forkRecipes");
const ROOT = path.resolve(__dirname, "../..");
const BUILT = {
  aave: {
    file: "test/contracts/protocols/aave/AaveV3.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  morpho: {
    file: "test/contracts/MorphoFlashReceiver.fork.t.sol",
    chain: "ethereum",
    status: "skipped",
    wave: "receiver",
    reason: "Existing receiver test; not reverified by the protocol-only W0 receipt.",
  },
  uniswap: {
    file: "test/contracts/protocols/uniswap/UniswapV3.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  lido: {
    file: "test/contracts/protocols/lido/Lido.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  "bedrock-unieth": {
    file: "test/contracts/protocols/bedrock/BedrockUniETH.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
};
function buildRegistry(board = require("../../showcase/data.json"), built = BUILT) {
  return board.overall.map(original => {
    // Reattach from contracts.js, rather than silently relying on stale board addresses.
    const row = attachTesting(structuredClone(original));
    const contracts = row.testing.contracts || [];
    const rank = row.overallRank || row.rank;
    const existing = built[row.slug];
    const queued = contracts.length > 0 || !!existing;
    return {
      rank,
      protocol: row.name,
      slug: row.slug,
      category: row.category,
      unique_contracts: new Set(contracts.map(c => `${c.chain}:${c.address.toLowerCase()}`)).size,
      contract_entries: contracts.length,
      chains: [...new Set(contracts.map(c => c.chain))].sort(),
      testing_mode: row.testing.mode,
      foundry_bucket:
        existing?.wave === "receiver" || row.slug === "aave" ? "already-covered" : queued ? "parity" : "not-queued",
      wave: existing?.wave || (queued ? (rank <= 50 ? "W1" : rank <= 100 ? "W2" : "W3") : "—"),
      status: existing?.status || "planned",
      file: existing?.file || null,
      chain: existing?.chain || row.testing.chain || null,
      receipt: existing?.receipt || null,
      reason:
        existing?.reason ||
        (queued
          ? "Contract primitive awaits implementation and two pinned runs; JS coverage is not Solidity coverage."
          : row.testing.note || "No configured contract address; out of this parity queue."),
    };
  });
}
function checkRegistry(entries = buildRegistry(), root = ROOT) {
  const problems = [],
    warnings = [],
    seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slug)) problems.push(`Duplicate Foundry slug: ${entry.slug}`);
    seen.add(entry.slug);
    if (!["planned", "passing", "skipped"].includes(entry.status))
      problems.push(`Invalid Foundry status: ${entry.slug}`);
    if (entry.status === "passing" && (!entry.file || !entry.receipt))
      problems.push(`Passing Foundry row requires file and receipt: ${entry.slug}`);
    if (entry.file && (!entry.file.endsWith(".t.sol") || !fs.existsSync(path.join(root, entry.file))))
      problems.push(`Missing Foundry file: ${entry.slug}: ${entry.file}`);
    if (entry.foundry_bucket !== "not-queued" && entry.status === "planned")
      warnings.push(`Foundry planned ${entry.wave}: ${entry.slug}`);
  }
  const registered = new Set(entries.filter(e => e.file).map(e => e.file));
  const walk = dir => {
    if (!fs.existsSync(path.join(root, dir))) return;
    for (const child of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${child.name}`;
      if (child.isDirectory()) walk(relative);
      else if (child.name.endsWith(".t.sol") && !registered.has(relative))
        problems.push(`Unregistered Foundry protocol file: ${relative}`);
    }
  };
  walk("test/contracts/protocols");
  return { problems, warnings };
}
module.exports = { BUILT, buildRegistry, checkRegistry };
