const { CHAINS } = require("../../src/config/chains");
const { RPC_ENV } = require("../../src/catalog/forkRecipes");
function checkForkBlocks(data) {
  const problems = [];
  if (data?.schemaVersion !== 1 || !data.chainsById) return ["Invalid fork-blocks schema"];
  for (const [chain, env] of Object.entries(RPC_ENV)) {
    const pin = data.chainsById[CHAINS[chain].chainId];
    if (!pin || pin.chain !== chain || pin.rpcEnv !== env) {
      problems.push(`Missing or mismatched fork header: ${chain}`);
      continue;
    }
    if (!Number.isSafeInteger(pin.blockNumber) || pin.blockNumber <= 0)
      problems.push(`Unobserved/non-numeric fork pin: ${chain}`);
    if (!/^0x[0-9a-f]{64}$/i.test(pin.blockHash || "")) problems.push(`Invalid observed fork hash: ${chain}`);
    if (
      !Number.isSafeInteger(pin.blockTimestamp) ||
      pin.blockTimestamp <= 0 ||
      !Number.isFinite(Date.parse(pin.observedAt))
    )
      problems.push(`Invalid fork observation timestamp: ${chain}`);
  }
  const ids = new Set(Object.keys(RPC_ENV).map(chain => String(CHAINS[chain].chainId)));
  for (const id of Object.keys(data.chainsById)) if (!ids.has(id)) problems.push(`Unexpected fork chain id: ${id}`);
  if (/https?:\/\//i.test(JSON.stringify(data))) problems.push("Fork headers must not contain RPC URLs");
  return problems;
}
module.exports = { checkForkBlocks };
