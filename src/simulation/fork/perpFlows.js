/**
 * Perps fork actions.
 *
 * Perp books are not Uniswap-style routers: GMX V2 runs an order pipeline and
 * Hyperliquid matches off-chain on its own L1, so none of it is reachable from a
 * plain EVM fork. GMX V1 has a real vault on Arbitrum, but the official docs state
 * V1 is sunset and that trading and providing liquidity are no longer supported.
 * That is confirmed on-chain: Vault.isSwapEnabled() and isLeverageEnabled() are
 * both false, and GlpRewardRouter.mintAndStakeGlp reverts even for 1 USDC. So the
 * fork coverage here is read-only, matching the Solana venues and the symbiotic read.
 *
 * Addresses and doc links live in src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { requireFork, formatUnits, finish, unavailable } = require("./runtime");
const { GMX } = require("../../catalog/contracts");

const VAULT_ABI = [
  "function poolAmounts(address) view returns (uint256)",
  "function isSwapEnabled() view returns (bool)",
  "function isLeverageEnabled() view returns (bool)",
];
const GLP_MANAGER_ABI = [
  "function getPrice(bool maximize) view returns (uint256)",
  "function getAum(bool maximize) view returns (uint256)",
];
const GLP_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

async function run() {
  const chain = process.env.CHAIN || "arbitrum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    if (protocol === "gmx" && action === "read") return await gmxRead(base);
    return finish({ ...base, ok: false, error: `Unknown perps action ${protocol}:${action}` });
  } catch (err) {
    const message = err.shortMessage || err.message || String(err);
    return finish({ ...base, ok: false, skipped: unavailable(message), error: message });
  }
}

/**
 * Read the GMX V1 book on Arbitrum. There is no mint here because V1 liquidity is
 * closed: the docs say so, and mintAndStakeGlp reverts with "SafeMath: subtraction
 * overflow" against the live GlpManager. The assertion is that the V1 vault, GLP
 * supply and GLP price all still read, which is what an integration can still use.
 */
async function gmxRead(base) {
  const provider = getProvider(base.chain);
  const vault = new ethers.Contract(GMX.vault, VAULT_ABI, provider);
  const manager = new ethers.Contract(GMX.glpManager, GLP_MANAGER_ABI, provider);
  const glp = new ethers.Contract(GMX.glp, GLP_ABI, provider);

  const usdc = COMMON_TOKENS.USDC[base.chain];
  const [poolUsdc, swapEnabled, leverageEnabled, aum, price, supply, decimals] = await Promise.all([
    vault.poolAmounts(usdc),
    vault.isSwapEnabled(),
    vault.isLeverageEnabled(),
    manager.getAum(false),
    manager.getPrice(false),
    glp.totalSupply(),
    glp.decimals(),
  ]);

  const ok = supply > 0n && poolUsdc > 0n;
  return finish({
    ...base,
    ok,
    key: `GLPprice=${formatUnits(price, 30)} GLPsupply=${formatUnits(supply, Number(decimals))}`,
    detail: [
      `GMX V1 vault USDC ${formatUnits(poolUsdc, 6)}`,
      `GLP supply ${formatUnits(supply, Number(decimals))} at $${formatUnits(price, 30)} per GLP`,
      `AUM $${formatUnits(aum, 30)}`,
      `isSwapEnabled=${swapEnabled} isLeverageEnabled=${leverageEnabled}`,
      "Read-only: V1 is sunset, GLP minting reverts on the live GlpManager.",
    ].join("\n"),
    error: ok ? null : "GMX V1 vault USDC and GLP supply both read zero",
  });
}

module.exports = { run };
