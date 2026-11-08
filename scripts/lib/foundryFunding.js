// Existing, public whale fixtures, selected per deployment chain. Never token-slot guessing.
const { getAddress } = require("ethers");
const { WHALES } = require("../../src/utils/impersonate");
const { EXTRA_WHALES } = require("../../src/simulation/fork/runtime");
const FIXTURES = {
  ethereum: {
    FORK_USDT_WHALE: WHALES.ethereum.USDT,
    FORK_USDE_WHALE: EXTRA_WHALES.ethereum.USDe[0],
    FORK_LINK_WHALE: EXTRA_WHALES.ethereum.LINK[0],
    FORK_CRVUSD_WHALE: EXTRA_WHALES.ethereum.crvUSD[0],
  },
  arbitrum: { FORK_ARBITRUM_USDC_WHALE: WHALES.arbitrum.USDC },
  base: { FORK_USDC_WHALE: EXTRA_WHALES.base.USDC[0] },
  // aOptUSDCn, not the ether.fi Hub whose custody balance the test measures.
  optimism: { FORK_USDC_WHALE: EXTRA_WHALES.optimism.USDC[1] },
};
function fundingEnv(chain, overrides = {}) {
  const result = {};
  for (const [name, fallback] of Object.entries(FIXTURES[chain] || {})) {
    const scopedName = name.startsWith(`FORK_${chain.toUpperCase()}_`)
      ? name
      : name.replace("FORK_", `FORK_${chain.toUpperCase()}_`);
    try {
      result[name] = getAddress(overrides[scopedName] || fallback);
    } catch {
      throw new Error(`Invalid public funding fixture override for ${chain}`);
    }
  }
  return result;
}
module.exports = { fundingEnv };
