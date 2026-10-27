/**
 * ether.fi Cash lending on OP Mainnet: an ether.fi-managed Aave V4 Spoke over one Liquidity Hub.
 * Borrowing is limited to ether.fi Safes; supplying to the Hub is open. The test supplies USDC
 * to the Spoke's USDC reserve, then withdraws all of it. Addresses: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { ETHERFI_CASH } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const SPOKE_ABI = [
  "function getReserve(uint256 reserveId) view returns (tuple(address underlying, address hub, uint16 assetId, uint8 decimals, uint24 collateralRisk, uint8 flags, uint32 dynamicConfigKey))",
  "function getReserveConfig(uint256 reserveId) view returns (tuple(uint24 collateralRisk, bool paused, bool frozen, bool borrowable, bool receiveSharesEnabled))",
  "function getUserSuppliedAssets(uint256 reserveId, address user) view returns (uint256)",
  "function getUserSuppliedShares(uint256 reserveId, address user) view returns (uint256)",
  "function supply(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)",
  "function withdraw(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)",
];
const GAS = { gasLimit: 2_000_000n };

async function run() {
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const chain = process.env.CHAIN || "optimism";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    const spec = ETHERFI_CASH;
    const provider = getProvider(chain);
    const reader = new ethers.Contract(spec.spoke, SPOKE_ABI, provider);
    const reserve = await reader.getReserve(spec.reserveId);
    if (
      reserve.underlying.toLowerCase() !== spec.asset.toLowerCase() ||
      reserve.hub.toLowerCase() !== spec.hub.toLowerCase()
    ) {
      return finish({ ...base, ok: false, error: `Spoke reserve ${spec.reserveId} is ${reserve.underlying} on hub ${reserve.hub}, not USDC on the documented Hub` });
    }
    const config = await reader.getReserveConfig(spec.reserveId);
    if (config.paused || config.frozen) {
      return finish({
        ...base,
        ok: true,
        key: `readOnly=${config.paused ? "paused" : "frozen"}`,
        detail: `USDC reserve is ${config.paused ? "paused" : "frozen"}. No supply.`,
      });
    }
    const amount = ethers.parseUnits(process.env.FORK_AMOUNT || spec.defaultAmount, spec.decimals);
    const signer = await impersonateFunded(chain, spec.symbol, spec.asset, amount);
    const user = await signer.getAddress();
    const usdc = new ethers.Contract(spec.asset, ERC, provider);
    const spoke = new ethers.Contract(spec.spoke, SPOKE_ABI, signer);
    const d = spec.decimals;

    const userBefore = await usdc.balanceOf(user);
    const hubBefore = await usdc.balanceOf(spec.hub);
    await (await new ethers.Contract(spec.asset, ERC, signer).approve(spec.spoke, amount)).wait();
    await (await spoke.supply(spec.reserveId, amount, user, GAS)).wait();
    const userMid = await usdc.balanceOf(user);
    const hubMid = await usdc.balanceOf(spec.hub);
    const supplied = await reader.getUserSuppliedAssets(spec.reserveId, user);
    const shares = await reader.getUserSuppliedShares(spec.reserveId, user);
    const supplyOk =
      userBefore - userMid === amount &&
      hubMid - hubBefore === amount &&
      shares > 0n &&
      supplied + 1n >= amount &&
      supplied <= amount;

    const receipt = await (await spoke.withdraw(spec.reserveId, supplied, user, GAS)).wait();
    const userAfter = await usdc.balanceOf(user);
    const hubAfter = await usdc.balanceOf(spec.hub);
    const left = await reader.getUserSuppliedShares(spec.reserveId, user);
    const back = userAfter - userMid;
    const withdrawOk = back === supplied && hubMid - hubAfter === supplied && left === 0n;

    const ok = supplyOk && withdrawOk;
    return finish({
      ...base,
      ok,
      key: `USDC=${formatUnits(userBefore, d)}->${formatUnits(userMid, d)}->${formatUnits(userAfter, d)} hub=+${formatUnits(hubMid - hubBefore, d)}/-${formatUnits(hubMid - hubAfter, d)} supplied=${formatUnits(supplied, d)} sharesLeft=${left}`,
      detail: `supplied ${formatUnits(amount, d)} USDC to the ether.fi Cash Spoke (reserve ${spec.reserveId}); Hub USDC +${formatUnits(hubMid - hubBefore, d)}\nsupplied assets ${formatUnits(supplied, d)}, shares ${shares}\nwithdrew ${formatUnits(back, d)} USDC; shares left ${left}\ntx ${receipt.hash}`,
      error: ok ? null : `ether.fi Cash supply/withdraw failed: supply=${supplyOk} withdraw=${withdrawOk}`,
    });
  } catch (err) {
    // A revert is a FAIL.
    const reason = err.reason || err.shortMessage || err.message || String(err);
    return finish({ ...base, ok: false, error: `${reason} ${typeof err.data === "string" ? err.data : ""}`.trim() });
  }
}

module.exports = { run };
