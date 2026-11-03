/**
 * Armitage by Wintermute — permissionless ERC-4626 deposit into a Morpho Vault V2 on Ethereum.
 *
 * Armitage is Wintermute's vault-curation arm: it does not ship its own custody or OTC contract.
 * Its entire Ethereum TVL is the set of Morpho Vault V2 vaults it curates, so the deposit is made
 * straight into the vault contract. The docs say so: "Deposits are permissionless and noncustodial:
 * you connect your wallet directly to Morpho and deposit the asset specified by your chosen vault
 * into its Morpho Vault V2 smart contracts." This test deposits 100 USDC from a fresh random
 * address into Wintermute USDC Select (the largest of the seven curated vaults) and asserts the
 * shares minted, the share supply and the vault's assets.
 *
 * maxDeposit() reads 0 on every Vault V2 (VaultV2.sol: `function maxDeposit(address) external
 * pure returns (uint256) { return 0; }`), so the flow deliberately does not gate on it — the gate
 * is deposit() actually succeeding plus the measured deltas.
 *
 * Addresses: https://armitage.wintermute.com/docs/vaults/select (app lists the vault and $42.35M)
 *            https://armitage.wintermute.com/docs/deposit-guide (permissionless deposit)
 *            https://github.com/DefiLlama/DefiLlama-Adapters/blob/main/registries/curators.js
 *            (registries/curators.js "armitage" → blockchains.ethereum.morpho[7] vault addresses)
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// The largest of Armitage's seven curated Ethereum vaults (name() "Wintermute USDC Select").
const ARMITAGE_USDC_SELECT = "0xA2EAaD0D586cF9FD73bb2c09cF6A7E3e187D68cd";
// curator() of all seven vaults; owner() 0xB83A…9E5e is the same on all seven.
const ARMITAGE_CURATOR = "0x4687E45bB5518a995913a24BB2816fe2031d74D8";

const GAS = { gasLimit: 3_000_000n };
const YEAR = 31_536_000n;

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const VAULT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function asset() view returns (address)",
  "function curator() view returns (address)",
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
  const [vaultCode, usdcCode] = await Promise.all([
    provider.getCode(ARMITAGE_USDC_SELECT),
    provider.getCode(USDC),
  ]);
  if (vaultCode === "0x")
    return finish({ ...base, ok: false, error: `Armitage vault ${ARMITAGE_USDC_SELECT} has no code on this fork` });
  if (usdcCode === "0x") return finish({ ...base, ok: false, error: `USDC ${USDC} has no code on this fork` });

  const read = new ethers.Contract(ARMITAGE_USDC_SELECT, VAULT_ABI, provider);
  const [name, symbol, asset, curator] = await Promise.all([
    read.name(),
    read.symbol(),
    read.asset(),
    read.curator(),
  ]);
  if (asset.toLowerCase() !== USDC.toLowerCase())
    return finish({ ...base, ok: false, error: `${name}: asset() is ${asset}, not Ethereum USDC` });
  if (curator.toLowerCase() !== ARMITAGE_CURATOR.toLowerCase())
    return finish({ ...base, ok: false, error: `${name}: curator() is ${curator}, not the Armitage curator` });
  // The "Wintermute …" names are what the Armitage app lists; the Pendle Ecosystem vaults carry
  // their partner's name. Refuse anything that is not one of those two families.
  if (!/^Wintermute |^Pendle Ecosystem /.test(name))
    return finish({ ...base, ok: false, error: `${ARMITAGE_USDC_SELECT}: name() is "${name}", not an Armitage vault` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", USDC, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(USDC, ERC20, signer);
  const vault = new ethers.Contract(ARMITAGE_USDC_SELECT, VAULT_ABI, signer);

  let balance = await usdc.balanceOf(user);
  if (balance < amount) {
    // The configured whales can be dry on a re-used fork; anvil_deal tops the fresh account up.
    await dealErc20(base.chain, USDC, user, amount);
    balance = await usdc.balanceOf(user);
  }
  if (balance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 6)} USDC` });

  const preview = await vault.previewDeposit(amount);
  if (preview === 0n) return finish({ ...base, ok: false, error: "previewDeposit returned 0 shares; no tx sent" });

  const before = await provider.getBlockNumber();
  const supplyBefore = await vault.totalSupply({ blockTag: before });

  await (await usdc.approve(ARMITAGE_USDC_SELECT, amount)).wait();
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
  // totalAssets() accrues interest on every read, so the deposit block also books the seconds
  // since the fork block. Bound that generously: 100% APY on the prior TVL + 2 USDC.
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
      `${name} (${symbol}) curator=${curator} (Armitage), asset=USDC, shares 18dp\n` +
      `deposited ${formatUnits(amount, 6)} USDC from fresh ${user}: minted ${formatUnits(minted, 18)} shares ` +
      `(previewDeposit ${formatUnits(preview, 18)}, drift ${formatUnits(shareDrift, 18)}), shares now worth ${formatUnits(shareValue, 6)} USDC\n` +
      `totalSupply ${formatUnits(supplyBefore, 18)} -> ${formatUnits(supplyAt, 18)}; ` +
      `totalAssets ${formatUnits(assetsPrev, 6)} -> ${formatUnits(assetsAt, 6)} USDC in the deposit block ` +
      `(+${formatUnits(assetsDelta - amount, 6)} USDC of accrued interest on top of the deposit)\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "armitage";
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
