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
    FORK_WETH_WHALE: WHALES.ethereum.WETH,
    FORK_STETH_WHALE: EXTRA_WHALES.ethereum.stETH[0],
    FORK_USDAT_WHALE: EXTRA_WHALES.ethereum.USDat[0],
    FORK_DAI_WHALE: WHALES.ethereum.DAI,
    FORK_WBTC_WHALE: WHALES.ethereum.WBTC,
    FORK_GOHM_WHALE: EXTRA_WHALES.ethereum.gOHM[0],
    // Curve USDC/USDf pool: the public USDf fixture used by the Falcon sUSDf test.
    FORK_USDF_WHALE: EXTRA_WHALES.ethereum.USDf[0],
    // Existing ylrsETH holder used only to seed the holder exit while CIAN's price window is stale.
    FORK_CIAN_SHARE_WHALE: "0x97feD74a8D5Bd772167017d6FC58433cc2b99E9D",
    FORK_ONDO_RUSDY_WHALE: "0xf247d536d81c4cfD5047C57d7c6c978F5F304F64",
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
