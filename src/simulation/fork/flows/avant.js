/**
 * Avant Protocol — permissionless staking of avUSD into savUSD on Avalanche C-Chain.
 *
 * Avant's avUSD cannot be minted by the public: the token keeps a `minters` mapping and the
 * documented USDC minter (AvantMintingV2) exposes mint(Order, Route, Signature) behind
 * MINTER_ROLE plus an Avant-signed EIP-712 order. The staking leg is permissionless: savUSD
 * (Staked avUSD) is a standard ERC-4626 vault with asset() = avUSD, maxDeposit() = 2^256-1,
 * no whitelist/role on deposit, and a 1-day cooldown only on the exit path (withdraw/redeem
 * are disabled while cooldownDuration > 0, but deposit/mint are untouched). This test stakes
 * 100 avUSD from a fresh address and asserts the exact shares minted, the savUSD supply delta
 * and the vault's avUSD/totalAssets delta.
 *
 * Addresses: https://docs.avantprotocol.com/security/contract-addresses
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const AVUSD = "0x24dE8771bC5DdB3362Db529Fc3358F2df3A0E346";
const SAVUSD = "0x06d47F3fb376649c3A9Dafe069B3D6E35572219E";
const AVANT_MINTING_V2 = "0xcb43139E90f019624e3B76C56FB05394B162A49c";

const GAS = { gasLimit: 1_500_000n };
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const SOFT_RESTRICTED_STAKER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SOFT_RESTRICTED_STAKER_ROLE"));

const AVUSD_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function minters(address) view returns (bool)",
];

const SAVUSD_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function getUnvestedAmount() view returns (uint256)",
  "function cooldownDuration() view returns (uint256)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
];

const MINTING_ABI = ["function hasRole(bytes32,address) view returns (bool)"];

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

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

function transferLog(receipt, token, from, to) {
  return receipt.logs.find(
    log =>
      log.address.toLowerCase() === token.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics.length === 3 &&
      log.topics[1].toLowerCase() === ethers.zeroPadValue(from, 32).toLowerCase() &&
      log.topics[2].toLowerCase() === ethers.zeroPadValue(to, 32).toLowerCase()
  );
}

async function stake(base) {
  const provider = getProvider(base.chain);
  const [savCode, avCode, mintingCode] = await Promise.all([
    provider.getCode(SAVUSD),
    provider.getCode(AVUSD),
    provider.getCode(AVANT_MINTING_V2),
  ]);
  if (savCode === "0x") return finish({ ...base, ok: false, error: `savUSD ${SAVUSD} has no code on this fork` });
  if (avCode === "0x") return finish({ ...base, ok: false, error: `avUSD ${AVUSD} has no code on this fork` });
  if (mintingCode === "0x")
    return finish({ ...base, ok: false, error: `AvantMintingV2 ${AVANT_MINTING_V2} has no code on this fork` });

  const readVault = new ethers.Contract(SAVUSD, SAVUSD_ABI, provider);
  const [name, symbol, asset, decimals, cooldown] = await Promise.all([
    readVault.name(),
    readVault.symbol(),
    readVault.asset(),
    readVault.decimals(),
    readVault.cooldownDuration(),
  ]);
  if (asset.toLowerCase() !== AVUSD.toLowerCase())
    return finish({ ...base, ok: false, error: `${name}: asset() is ${asset}, not avUSD ${AVUSD}` });
  if (symbol !== "savUSD") return finish({ ...base, ok: false, error: `${name}: symbol() is "${symbol}", not savUSD` });
  if (decimals !== 18n) return finish({ ...base, ok: false, error: `${name}: decimals() is ${decimals}, not 18` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  // avUSD has no whale in runtime's EXTRA_WHALES; impersonateFunded falls back to a fresh
  // random address and runtime.dealErc20() writes the avUSD balance slot.
  const signer = await impersonateFunded(base.chain, "avUSD", AVUSD, amount);
  const user = await signer.getAddress();
  const avUSD = new ethers.Contract(AVUSD, AVUSD_ABI, signer);
  const vault = new ethers.Contract(SAVUSD, SAVUSD_ABI, signer);

  // impersonateFunded already tops up via dealErc20 when no whale is configured; make the
  // top-up explicit so a short whale in a future runtime table cannot masquerade as a FAIL.
  let balance = await avUSD.balanceOf(user);
  if (balance < amount) {
    const topped = await dealErc20(base.chain, AVUSD, user, amount);
    if (!topped) return finish({ ...base, ok: false, error: `could not fund ${user} with ${formatUnits(amount, 18)} avUSD` });
    balance = await avUSD.balanceOf(user);
  }

  const [maxDeposit, softRestricted, userIsMinter, mintingIsMinter, userHasMinterRole] = await Promise.all([
    vault.maxDeposit(user),
    vault.hasRole(SOFT_RESTRICTED_STAKER_ROLE, user),
    avUSD.minters(user),
    avUSD.minters(AVANT_MINTING_V2),
    new ethers.Contract(AVANT_MINTING_V2, MINTING_ABI, provider).hasRole(MINTER_ROLE, user),
  ]);
  if (balance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 18)} avUSD` });
  if (maxDeposit < amount)
    return finish({ ...base, ok: false, error: `savUSD.maxDeposit(${user}) = ${maxDeposit} caps the deposit` });
  if (softRestricted)
    return finish({ ...base, ok: false, error: `savUSD has SOFT_RESTRICTED_STAKER_ROLE on fresh ${user}` });

  const preview = await vault.previewDeposit(amount);
  if (preview === 0n) return finish({ ...base, ok: false, error: "previewDeposit returned 0 shares; no tx sent" });

  const before = await provider.getBlockNumber();
  const supplyBefore = await vault.totalSupply({ blockTag: before });

  await (await avUSD.approve(SAVUSD, amount)).wait();
  const receipt = await (await vault.deposit(amount, user, GAS)).wait();
  const at = receipt.blockNumber;

  const [
    supplyAt,
    supplyPrev,
    sharesAt,
    sharesPrev,
    userAvAt,
    userAvPrev,
    vaultAvAt,
    vaultAvPrev,
    assetsAt,
    assetsPrev,
    unvestedAt,
    unvestedPrev,
  ] = await Promise.all([
    vault.totalSupply({ blockTag: at }),
    vault.totalSupply({ blockTag: at - 1 }),
    vault.balanceOf(user, { blockTag: at }),
    vault.balanceOf(user, { blockTag: at - 1 }),
    avUSD.balanceOf(user, { blockTag: at }),
    avUSD.balanceOf(user, { blockTag: at - 1 }),
    avUSD.balanceOf(SAVUSD, { blockTag: at }),
    avUSD.balanceOf(SAVUSD, { blockTag: at - 1 }),
    vault.totalAssets({ blockTag: at }),
    vault.totalAssets({ blockTag: at - 1 }),
    vault.getUnvestedAmount({ blockTag: at }),
    vault.getUnvestedAmount({ blockTag: at - 1 }),
  ]);

  const minted = sharesAt - sharesPrev;
  const supplyDelta = supplyAt - supplyPrev;
  const avSpent = userAvPrev - userAvAt;
  const vaultIn = vaultAvAt - vaultAvPrev;
  const assetsDelta = assetsAt - assetsPrev;
  // The vault mints `amount` against totalAssets() as of the deposit block: the avUSD balance it
  // held before the transfer (vaultAvPrev) minus the reward amount still vesting at that second.
  // ERC-4626 shares round down, so this is the exact expected mint (Solmate mulDivDown).
  const expectedShares = (amount * supplyPrev) / (vaultAvPrev - unvestedAt);
  const shareDrift = preview > minted ? preview - minted : minted - preview;

  const mintLog = transferLog(receipt, SAVUSD, ethers.ZeroAddress, user);
  const stakeLog = transferLog(receipt, AVUSD, user, SAVUSD);
  const eventsOk =
    !!mintLog &&
    BigInt(mintLog.data) === minted &&
    !!stakeLog &&
    BigInt(stakeLog.data) === amount;

  const ok =
    minted > 0n &&
    minted === expectedShares &&
    shareDrift <= 1n &&
    supplyDelta === minted &&
    avSpent === amount &&
    vaultIn === amount &&
    assetsDelta === amount + (unvestedPrev - unvestedAt) &&
    eventsOk;

  const reasons = [];
  if (minted === 0n) reasons.push("no shares minted");
  if (minted !== expectedShares)
    reasons.push(`minted ${minted} != ERC-4626 expected ${expectedShares} (amount*supply/ (vault avUSD - unvested))`);
  if (shareDrift > 1n) reasons.push(`minted ${formatUnits(minted, 18)} vs previewDeposit ${formatUnits(preview, 18)}`);
  if (supplyDelta !== minted) reasons.push(`totalSupply +${supplyDelta} != minted ${minted}`);
  if (avSpent !== amount) reasons.push(`avUSD spent ${formatUnits(avSpent, 18)} != ${formatUnits(amount, 18)}`);
  if (vaultIn !== amount) reasons.push(`vault avUSD +${formatUnits(vaultIn, 18)} != deposit`);
  if (assetsDelta !== amount + (unvestedPrev - unvestedAt))
    reasons.push(`totalAssets +${assetsDelta} != deposit + vesting change ${unvestedPrev - unvestedAt}`);
  if (!eventsOk) reasons.push("ERC-20 Transfer events (avUSD user->vault, savUSD 0->user) do not match the deltas");

  return finish({
    ...base,
    ok,
    key: `shares=${formatUnits(minted, 18)} previewDeposit=${formatUnits(preview, 18)} totalSupply+=${formatUnits(supplyDelta, 18)} avUSD-=${formatUnits(avSpent, 18)} totalAssets+=${formatUnits(assetsDelta, 18)}`,
    detail:
      `${name} (${symbol}) asset=avUSD ${AVUSD}, cooldownDuration=${cooldown}s\n` +
      `staked ${formatUnits(amount, 18)} avUSD from fresh ${user}: minted ${formatUnits(minted, 18)} savUSD ` +
      `(previewDeposit ${formatUnits(preview, 18)}, drift ${shareDrift} wei)\n` +
      `savUSD totalSupply ${formatUnits(supplyBefore, 18)} -> ${formatUnits(supplyAt, 18)} (+${formatUnits(supplyDelta, 18)}); ` +
      `vault avUSD ${formatUnits(vaultAvPrev, 18)} -> ${formatUnits(vaultAvAt, 18)}; ` +
      `totalAssets ${formatUnits(assetsPrev, 18)} -> ${formatUnits(assetsAt, 18)} ` +
      `(unvested ${formatUnits(unvestedPrev, 18)} -> ${formatUnits(unvestedAt, 18)})\n` +
      `mint leg is gated, measured: avUSD.minters(fresh)=${userIsMinter}, avUSD.minters(AvantMintingV2 ${AVANT_MINTING_V2})=${mintingIsMinter}, ` +
      `AvantMintingV2.hasRole(MINTER_ROLE, fresh)=${userHasMinterRole}\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "avalanche";
  const protocol = process.env.FORK_PROTOCOL || "avant";
  const action = process.env.FORK_ACTION || "stake";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    return await stake(base);
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
