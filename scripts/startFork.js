#!/usr/bin/env node
/**
 * Start Anvil Fork
 * Automatically starts an Anvil fork for the specified chain
 *
 * Usage:
 *   node scripts/startFork.js              # Fork Ethereum mainnet
 *   CHAIN=arbitrum node scripts/startFork.js  # Fork Arbitrum
 */
require("dotenv").config();
const { spawn, spawnSync } = require("child_process");
const { CHAINS } = require("../src/config/chains");

const CHAIN = process.env.CHAIN || "ethereum";
const PORT = process.env.FORK_PORT || "8545";
const FORK_BLOCK = process.env.FORK_BLOCK || null; // Optional: pin to specific block

const chain = CHAINS[CHAIN];

if (!chain) {
  console.error(`❌ Unknown chain: ${CHAIN}`);
  process.exit(1);
}

if (!chain.rpcUrl) {
  console.error(`❌ RPC URL not configured for ${chain.name}`);
  console.error(`Set ${CHAIN.toUpperCase()}_RPC_URL in .env file`);
  process.exit(1);
}

console.log(`\n╔══════════════════════════════════════════════════════════════════════╗`);
console.log(`║                     Starting Anvil Fork                              ║`);
console.log(`╚══════════════════════════════════════════════════════════════════════╝\n`);
console.log(`Chain: ${chain.name}`);
// Print only the host: RPC URLs often carry an API key in the path or query.
let rpcHost = "(configured)";
try {
  rpcHost = new URL(chain.rpcUrl).host;
} catch {
  // keep the placeholder
}
console.log(`RPC host: ${rpcHost}`);
console.log(`Local Port: ${PORT}`);
if (FORK_BLOCK) {
  console.log(`Fork Block: ${FORK_BLOCK}`);
}
console.log(`\n${"─".repeat(72)}\n`);

const args = ["--fork-url", chain.rpcUrl, "--port", PORT, "--host", "127.0.0.1"];

if (FORK_BLOCK) {
  args.push("--fork-block-number", FORK_BLOCK);
}

function anvilMissing() {
  const check = spawnSync("anvil", ["--version"], { encoding: "utf8" });
  return Boolean(check.error) || check.status !== 0;
}

if (anvilMissing()) {
  console.error("anvil was not found on PATH.");
  console.error("Install Foundry, then open a new shell:");
  console.error("  curl -L https://foundry.paradigm.xyz | bash && foundryup");
  process.exit(1);
}

console.log(`Starting Anvil...\n`);

const anvil = spawn("anvil", args, {
  stdio: "inherit",
});

anvil.on("error", error => {
  console.error(`❌ Failed to start Anvil: ${error.message}`);
  if (error.code === "ENOENT") {
    console.error("anvil was not found on PATH.");
    console.error("Install Foundry, then open a new shell:");
    console.error("  curl -L https://foundry.paradigm.xyz | bash && foundryup");
  } else {
    console.error("Make sure Foundry is installed: https://book.getfoundry.sh/getting-started/installation");
  }
  process.exit(1);
});

anvil.on("close", code => {
  console.log(`\n\nAnvil exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nShutting down Anvil fork...");
  anvil.kill("SIGINT");
  process.exit(0);
});
