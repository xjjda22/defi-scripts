#!/usr/bin/env node
// Reads RPC headers only. Never stores an endpoint, key, account or transaction.
const fs = require("fs");
const path = require("path");
const { CHAINS } = require("../src/config/chains");
const { RPC_ENV } = require("../src/catalog/forkRecipes");
const ROOT = path.resolve(__dirname, "..");
async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || data.error || data.result == null) throw new Error("RPC observation failed (endpoint redacted)");
  return data.result;
}
async function main() {
  const file = path.join(ROOT, "data/fork-blocks.json");
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { schemaVersion: 1, chainsById: {} };
  const selected = (process.env.CHAINS || Object.keys(RPC_ENV).join(",")).split(",");
  if (process.env.FORK_BLOCK && selected.length !== 1) throw new Error("An explicit block requires exactly one chain");
  let observed = 0;
  for (const chain of selected) {
    if (!RPC_ENV[chain] || !CHAINS[chain]) throw new Error(`Unknown fork chain: ${chain}`);
    const { chainId } = CHAINS[chain];
    const url = process.env[RPC_ENV[chain]] || (chain === "ethereum" && process.env.ETH_RPC_URL);
    if (!url) {
      if (!data.chainsById[chainId])
        data.chainsById[chainId] = {
          chain,
          rpcEnv: RPC_ENV[chain],
          blockNumber: 0,
          reason: "Unobserved: no configured RPC. Zero is not a valid pin.",
        };
      continue;
    }
    if (Number(BigInt(await rpc(url, "eth_chainId", []))) !== chainId) throw new Error(`Wrong chain: ${chain}`);
    const tag = process.env.FORK_BLOCK ? "0x" + BigInt(process.env.FORK_BLOCK).toString(16) : "latest";
    const block = await rpc(url, "eth_getBlockByNumber", [tag, false]);
    const blockNumber = Number(BigInt(block.number));
    if (process.env.FORK_BLOCK && BigInt(blockNumber) !== BigInt(process.env.FORK_BLOCK))
      throw new Error("RPC returned wrong block");
    if (!Number.isSafeInteger(blockNumber) || blockNumber <= 0 || !/^0x[0-9a-f]{64}$/i.test(block.hash))
      throw new Error("Invalid observed header");
    data.chainsById[chainId] = {
      chain,
      rpcEnv: RPC_ENV[chain],
      blockNumber,
      blockHash: block.hash,
      blockTimestamp: Number(BigInt(block.timestamp)),
      observedAt: new Date().toISOString(),
      source: `RPC header via ${RPC_ENV[chain]} (URL deliberately omitted)`,
    };
    observed++;
    console.log(`${chain}: observed block ${blockNumber}`);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`Observed ${observed} chain(s); unobserved entries remain explicitly unusable.`);
}
if (require.main === module)
  main().catch(() => {
    console.error("Fork pin observation failed; endpoint details suppressed.");
    process.exitCode = 1;
  });
module.exports = { rpc };
