/** Foundry row registry. A file is not proof of execution. Only recorded receipts are passing.
 * W1 precedes W2; planned rows warn today, not a premature future-wave gate.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { attachTesting, RPC_ENV } = require("./forkRecipes");
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
    status: "passing",
    wave: "receiver",
    receipt: "docs/11-foundry-contract-plan.md#receiver-default-review-2026-11-08",
    reason: "Existing Ethereum receiver verified twice with shared pin defaults; not a new protocol-wave primitive.",
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
  "layerzero-v2": {
    file: "test/contracts/protocols/layerzero-v2/LayerZeroV2.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  sparklend: {
    file: "test/contracts/protocols/sparklend/SparkLend.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  ethena: {
    file: "test/contracts/protocols/ethena/Ethena.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "hyperliquid-bridge": {
    file: "test/contracts/protocols/hyperliquid-bridge/HyperliquidBridge.fork.t.sol",
    chain: "arbitrum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  veda: {
    file: "test/contracts/protocols/veda/Veda.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Shared ether.fi Liquid ETH BoringVault deposit; separate board-row attribution, not independent deployments or all curator exposure.",
  },
  "steakhouse-financial": {
    file: "test/contracts/protocols/steakhouse-financial/SteakhouseFinancial.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  ccip: {
    file: "test/contracts/protocols/ccip/Ccip.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  maple: {
    file: "test/contracts/protocols/maple/Maple.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  re: {
    file: "test/contracts/protocols/re/Re.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "binance-staked-eth": {
    file: "test/contracts/protocols/binance-staked-eth/Wbeth.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  rockawayx: {
    file: "test/contracts/protocols/rockawayx/Rockawayx.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "polygon-bridge": {
    file: "test/contracts/protocols/polygon-bridge/PolygonBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "plume-vaults": {
    file: "test/contracts/protocols/plume-vaults/PlumeVaults.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "nonce-capital": {
    file: "test/contracts/protocols/nonce-capital/NonceCapital.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Shared ether.fi Liquid ETH BoringVault deposit; separate board-row attribution, not independent deployments or all curator exposure.",
  },
  tether: {
    file: "test/contracts/protocols/tether/Tether.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  aera: {
    file: "test/contracts/protocols/aera/Aera.fork.t.sol",
    chain: "base",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "base-bridge": {
    file: "test/contracts/protocols/base-bridge/BaseBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "coinbase-wrapped-staked-eth": {
    file: "test/contracts/protocols/coinbase-wrapped-staked-eth/Cbeth.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    reason:
      "cbETH is custodial and outside the seven planned read-only exceptions. Its read-only test passes, but no mint/redeem primitive was completed; require explicit exception or leave coverage row blocked/skipped.",
    coverageStatus: "blocked",
    coverageReason:
      "Read-only rate/accounting execution passes, but this row is outside the seven permitted read-only exceptions; no approved mint/redeem primitive completion.",
  },
  concrete: {
    file: "test/contracts/protocols/concrete/Concrete.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "curve-finance": {
    file: "test/contracts/protocols/curve-finance/CurveLlamalend.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason: "Llamalend crvUSD lending-vault deposit primitive, not generic Curve pool coverage.",
  },
  "defi-saver-asset-management": {
    file: "test/contracts/protocols/defi-saver-asset-management/DefiSaver.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Real registry-resolved RecipeExecutor -> registered AaveV3Supply -> Aave; local delegatecall wallet fixture, not production DSProxy authorization coverage.",
  },
  "etherfi-borrowing-market": {
    file: "test/contracts/protocols/etherfi-borrowing-market/EtherfiCash.fork.t.sol",
    chain: "optimism",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  gauntlet: {
    file: "test/contracts/protocols/gauntlet/Gauntlet.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  hyperithm: {
    file: "test/contracts/protocols/hyperithm/Hyperithm.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "lighter-bridge": {
    file: "test/contracts/protocols/lighter-bridge/LighterBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  obol: {
    file: "test/contracts/protocols/obol/Obol.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  opentrade: {
    file: "test/contracts/protocols/opentrade/OpenTrade.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    reason: "KYC-gated: read-only rate, conversion, liquidity-asset wiring and lender gate invariants.",
    coverageStatus: "accepted",
  },
  pancakeswap: {
    file: "test/contracts/protocols/pancakeswap/Pancakeswap.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "robinhood-chain-bridge": {
    file: "test/contracts/protocols/robinhood-chain-bridge/RobinhoodBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "tornado-cash": {
    file: "test/contracts/protocols/tornado-cash/TornadoCash.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  upshift: {
    file: "test/contracts/protocols/upshift/Upshift.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "sentora-curator": {
    file: "test/contracts/protocols/sentora-curator/Sentora.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    coverageStatus: "accepted",
    receipt: "docs/11-foundry-contract-plan.md#sentora-and-event-review-2026-11-08",
    reason:
      "Permissionless accrueInterest settlement: exact cached RLUSD interest and fee-share deltas; not investor deposit or redemption.",
  },
  "ondo-finance": {
    file: null,
    chain: "ethereum",
    status: "planned",
    wave: "W1",
    coverageStatus: "blocked",
    coverageReason:
      "Ondo issuer subscription needs registration; existing JS coverage is oracle-read only. A public rUSDY conversion candidate is not proven by two bounded pinned runs and lacks a generated-book entry; no accepted primitive/file.",
    reason:
      "Ondo issuer subscription needs registration; existing JS coverage is oracle-read only. A public rUSDY conversion candidate is not proven by two bounded pinned runs and lacks a generated-book entry; no accepted primitive/file.",
  },
};
function buildRegistry(board = require("../../showcase/data.json"), built = BUILT) {
  return board.overall.map(original => {
    // Reattach from contracts.js, rather than silently relying on stale board addresses.
    const row = attachTesting(structuredClone(original));
    const contracts = row.testing.contracts || [];
    const addressChains = [...new Set(contracts.map(c => c.chain))].sort();
    const forkChains = addressChains.filter(chain => RPC_ENV[chain]);
    const rank = row.overallRank || row.rank;
    const existing = built[row.slug];
    const queued = forkChains.length > 0 || !!existing;
    return {
      rank,
      protocol: row.name,
      slug: row.slug,
      category: row.category,
      unique_contracts: new Set(contracts.map(c => `${c.chain}:${c.address.toLowerCase()}`)).size,
      contract_entries: contracts.length,
      chains: addressChains,
      testing_mode: row.testing.mode,
      foundry_bucket:
        existing?.wave === "receiver" || row.slug === "aave" ? "already-covered" : queued ? "parity" : "not-queued",
      wave: existing?.wave || (queued ? (rank <= 50 ? "W1" : rank <= 100 ? "W2" : "W3") : "—"),
      status: existing?.status || "planned",
      file: existing?.file || null,
      chain: existing?.chain || (forkChains.includes(row.testing.chain) ? row.testing.chain : forkChains[0]) || null,
      receipt: existing?.receipt || null,
      coverageStatus:
        existing?.coverageStatus || (existing?.status === "passing" ? "accepted" : queued ? "planned" : "not-queued"),
      coverageReason: existing?.coverageReason || null,
      reason:
        existing?.reason ||
        (existing?.status === "passing"
          ? "Pinned execution proven; scope is limited to the registered primitive and receipt, not all protocol features."
          : queued
            ? "Contract primitive awaits implementation and two pinned runs; JS coverage is not Solidity coverage."
            : contracts.length
              ? "Configured addresses are outside the fork RPC map; deferred, not executed."
              : row.testing.note || "No configured contract address; out of this parity queue."),
    };
  });
}
function checkPassingProof(entry, proof, root) {
  const row = proof?.workerReceipts?.find(row => row.slug === entry.slug);
  if (
    !row ||
    row.file !== entry.file ||
    row.chain !== entry.chain ||
    row.runs?.length !== 2 ||
    row.runs.some(
      run =>
        run.PASS !== 1 ||
        run.FAIL !== 0 ||
        run.SKIP !== 0 ||
        run.exitCode !== 0 ||
        !(run.wallSeconds > 0 && run.wallSeconds < 60)
    )
  )
    return false;
  const pins = JSON.parse(fs.readFileSync(path.join(root, "data/fork-blocks.json")));
  if (
    !Object.values(pins.chainsById).some(
      pin => pin.chain === row.chain && pin.blockNumber === row.blockNumber && pin.blockHash === row.blockHash
    )
  )
    return false;
  if (!row.sourceHashes?.[entry.file] || !proof.commonSourceHashes) return false;
  return Object.entries({ ...proof.commonSourceHashes, ...row.sourceHashes }).every(
    ([file, expected]) =>
      fs.existsSync(path.join(root, file)) &&
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex") === expected
  );
}
function checkRegistry(entries = buildRegistry(), root = ROOT, proof) {
  if (proof === undefined) {
    try {
      proof = JSON.parse(fs.readFileSync(path.join(root, "data/foundry-test-receipts.json")));
    } catch {
      proof = null;
    }
  }
  const problems = [],
    warnings = [],
    seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slug)) problems.push(`Duplicate Foundry slug: ${entry.slug}`);
    seen.add(entry.slug);
    if (!["planned", "passing", "skipped"].includes(entry.status))
      problems.push(`Invalid Foundry status: ${entry.slug}`);
    if (!["accepted", "blocked", "planned", "not-queued"].includes(entry.coverageStatus))
      problems.push(`Invalid Foundry coverage status: ${entry.slug}`);
    if (entry.coverageStatus === "accepted" && entry.status !== "passing")
      problems.push(`Accepted Foundry coverage requires proven passing execution: ${entry.slug}`);
    if (entry.coverageStatus === "blocked" && !entry.coverageReason)
      problems.push(`Blocked Foundry coverage requires a reason: ${entry.slug}`);
    if (entry.status === "passing" && (!entry.file || !entry.receipt))
      problems.push(`Passing Foundry row requires file and receipt: ${entry.slug}`);
    if (entry.status === "passing" && entry.receipt && !fs.existsSync(path.join(root, entry.receipt.split("#")[0])))
      problems.push(`Missing Foundry receipt document: ${entry.slug}`);
    if (entry.status === "passing" && entry.wave === "W1") {
      let verified = false;
      try {
        verified = checkPassingProof(entry, proof, root);
      } catch {
        /* Fail closed on malformed proof. */
      }
      if (!verified)
        problems.push(`Passing W1 row requires two bounded pinned receipts for unchanged sources: ${entry.slug}`);
    }
    if (entry.file && (!RPC_ENV[entry.chain] || !entry.chains?.includes(entry.chain)))
      problems.push(`Foundry execution chain has no matching configured row address: ${entry.slug}`);
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
