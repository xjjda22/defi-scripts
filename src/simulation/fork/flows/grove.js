/**
 * Grove Finance (Sky Prime Agent) — permissionless ERC-4626 deposit on Base.
 *
 * Grove's own Allocator stack (ALMProxy / ForeignController / RateLimits) is governance
 * gated: the proxy's doCall() is CONTROLLER-only and every fund-moving controller function
 * is RELAYER-only, so it exposes no public deposit. The ERC-4626 vault Grove deploys on Base
 * is the Grove x Steakhouse USDC Morpho Vault V2: owner() is Grove's Base Executor and
 * deposit() is permissionless. This test deposits 100 USDC from a fresh random address and
 * asserts the shares minted, the share supply and the vault's assets.
 *
 * Addresses: https://github.com/grove-labs/grove-address-registry/blob/master/src/Base.sol
 *            https://forum.skyeco.com/t/september-24-2026-proposed-changes-to-grove-for-upcoming-spell/28229
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const GROVE_STEAKHOUSE_USDC = "0xbeef0786756810478b88982DE00F3CD7fdB8e7c7";
const GROVE_BASE_EXECUTOR = "0x491EDFB0B8b608044e227225C715981a30F3A44E";

const GAS = { gasLimit: 2_000_000n };
const YEAR = 31_536_000n;

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const VAULT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function asset() view returns (address)",
  "function owner() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

async function deposit(base) {
  const provider = getProvider(base.chain);
  const [vaultCode, usdcCode] = await Promise.all([provider.getCode(GROVE_STEAKHOUSE_USDC), provider.getCode(USDC)]);
  if (vaultCode === "0x")
    return finish({ ...base, ok: false, error: `Grove vault ${GROVE_STEAKHOUSE_USDC} has no code on this fork` });
  if (usdcCode === "0x") return finish({ ...base, ok: false, error: `USDC ${USDC} has no code on this fork` });

  const read = new ethers.Contract(GROVE_STEAKHOUSE_USDC, VAULT_ABI, provider);
  const [name, symbol, asset, owner] = await Promise.all([read.name(), read.symbol(), read.asset(), read.owner()]);
  if (asset.toLowerCase() !== USDC.toLowerCase())
    return finish({ ...base, ok: false, error: `${name}: asset() is ${asset}, not Base USDC` });
  if (owner.toLowerCase() !== GROVE_BASE_EXECUTOR.toLowerCase())
    return finish({ ...base, ok: false, error: `${name}: owner() is ${owner}, not the Grove Base Executor` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", USDC, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(USDC, ERC20, signer);
  const vault = new ethers.Contract(GROVE_STEAKHOUSE_USDC, VAULT_ABI, signer);

  const balance = await usdc.balanceOf(user);
  if (balance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 6)} USDC` });

  const preview = await vault.previewDeposit(amount);
  if (preview === 0n) return finish({ ...base, ok: false, error: "previewDeposit returned 0 shares; no tx sent" });

  const before = await provider.getBlockNumber();
  const supplyBefore = await vault.totalSupply({ blockTag: before });

  await (await usdc.approve(GROVE_STEAKHOUSE_USDC, amount)).wait();
  const receipt = await (await vault.deposit(amount, user, GAS)).wait();
  const at = receipt.blockNumber;

  const [assetsAt, assetsPrev, supplyAt, supplyPrev, sharesAt, sharesPrev, blockAt, blockPrev] = await Promise.all([
    vault.totalAssets({ blockTag: at }),
    vault.totalAssets({ blockTag: at - 1 }),
    vault.totalSupply({ blockTag: at }),
    vault.totalSupply({ blockTag: at - 1 }),
    vault.balanceOf(user, { blockTag: at }),
    vault.balanceOf(user, { blockTag: at - 1 }),
    provider.getBlock(at),
    provider.getBlock(at - 1),
  ]);
  const minted = sharesAt - sharesPrev;
  const shareValue = await vault.convertToAssets(minted, { blockTag: at });

  const supplyDelta = supplyAt - supplyPrev;
  const assetsDelta = assetsAt - assetsPrev;
  const shareDrift = preview > minted ? preview - minted : minted - preview;
  const valueDrift = shareValue > amount ? shareValue - amount : amount - shareValue;
  // Vault assets are supplied to Morpho markets, so totalAssets also compounds during the block
  // the deposit lands in. Bound that interest generously: 100% APY on the prior TVL + 2 USDC.
  const seconds = BigInt(Math.max(1, blockAt.timestamp - blockPrev.timestamp));
  const interestBound = (assetsPrev * seconds) / YEAR + 2_000_000n;

  const ok =
    minted > 0n &&
    shareDrift <= preview / 1_000_000n &&
    supplyDelta === minted &&
    assetsDelta >= amount &&
    assetsDelta - amount <= interestBound &&
    valueDrift <= amount / 100n;

  const reasons = [];
  if (minted === 0n) reasons.push("no shares minted");
  if (shareDrift > preview / 1_000_000n)
    reasons.push(`minted ${formatUnits(minted, 18)} vs previewDeposit ${formatUnits(preview, 18)}`);
  if (supplyDelta !== minted) reasons.push(`totalSupply +${supplyDelta} != minted ${minted}`);
  if (assetsDelta < amount) reasons.push(`totalAssets +${formatUnits(assetsDelta, 6)} < deposit`);
  if (assetsDelta - amount > interestBound)
    reasons.push(`totalAssets +${formatUnits(assetsDelta, 6)} exceeds deposit + interest bound`);
  if (valueDrift > amount / 100n)
    reasons.push(`minted shares convertToAssets ${formatUnits(shareValue, 6)} != 100 USDC`);

  return finish({
    ...base,
    ok,
    key: `shares=${formatUnits(minted, 18)} previewDeposit=${formatUnits(preview, 18)} totalSupply+=${formatUnits(supplyDelta, 18)} totalAssets+=${formatUnits(assetsDelta, 6)}USDC deposit=${formatUnits(amount, 6)}USDC`,
    detail:
      `${name} (${symbol}) owner=${owner} (Grove Base Executor), asset=Base USDC\n` +
      `deposited ${formatUnits(amount, 6)} USDC from fresh ${user}: minted ${formatUnits(minted, 18)} shares ` +
      `(previewDeposit ${formatUnits(preview, 18)}, drift ${formatUnits(shareDrift, 18)}), shares now worth ${formatUnits(shareValue, 6)} USDC\n` +
      `totalSupply ${formatUnits(supplyBefore, 18)} -> ${formatUnits(supplyAt, 18)}; ` +
      `totalAssets ${formatUnits(assetsPrev, 6)} -> ${formatUnits(assetsAt, 6)} USDC in the deposit block ` +
      `(+${formatUnits(assetsDelta - amount, 6)} USDC of market interest on top of the deposit)\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "base";
  const protocol = process.env.FORK_PROTOCOL || "grove";
  const action = process.env.FORK_ACTION || "deposit";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    return await deposit(base);
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
