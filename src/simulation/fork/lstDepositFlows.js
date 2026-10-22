/**
 * ETH → liquid staking token mints on an Ethereum fork that are open to any wallet.
 * wBETH: payable deposit(referral) mints at exchangeRate(). spETH (Meta Pool): ERC-4626
 * depositETH(receiver) mints previewDeposit shares. StakeWise V3: Genesis Vault
 * depositAndMintOsToken mints vault shares and osETH. A revert is a FAIL.
 * Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { WBETH, META_POOL, STAKEWISE } = require("../../catalog/contracts");
const { requireFork, formatUnits, finish } = require("./runtime");

const WBETH_ABI = [
  "function deposit(address referral) payable",
  "function exchangeRate() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const SPETH_ABI = [
  "function depositETH(address receiver) payable returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
];
const DEPOSIT_EVENT = new ethers.Interface([
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
]);

async function freshSigner(chain) {
  return impersonateAccount(ethers.Wallet.createRandom().address, chain);
}

/** wBETH minted must equal value * 1e18 / exchangeRate() (1 wei rounding) and the contract keeps the ETH. */
async function wbethDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const provider = getProvider(base.chain);
  const signer = await freshSigner(base.chain);
  const user = await signer.getAddress();
  const wbeth = new ethers.Contract(WBETH, WBETH_ABI, signer);
  const rate = await wbeth.exchangeRate();
  const expected = (value * 10n ** 18n) / rate;
  const before = await wbeth.balanceOf(user);
  const ethBefore = await provider.getBalance(WBETH);
  const receipt = await (await wbeth.deposit(ethers.ZeroAddress, { value })).wait();
  const minted = (await wbeth.balanceOf(user, { blockTag: receipt.blockNumber })) - before;
  const ethAfter = await provider.getBalance(WBETH, receipt.blockNumber);
  const diff = minted > expected ? minted - expected : expected - minted;
  const ok = minted > 0n && diff <= 1n && ethAfter - ethBefore === value;
  return finish({
    ...base,
    ok,
    key: `wBETH=0->${formatUnits(minted, 18)} expected=${formatUnits(expected, 18)} rate=${formatUnits(rate, 18)}`,
    detail: `deposit ${formatUnits(value, 18)} ETH into wBETH\nexchangeRate ${formatUnits(rate, 18)} ETH per wBETH\nminted ${formatUnits(minted, 18)} (expected ${formatUnits(expected, 18)})\ncontract ETH ${formatUnits(ethBefore, 18)} -> ${formatUnits(ethAfter, 18)}\nRedeem goes through Binance, so this does not unwrap.\ntx ${receipt.hash}`,
    error: ok ? null : "wBETH deposit did not mint at exchangeRate() and keep the ETH",
  });
}

/**
 * spETH depositETH. When the Liquid Unstake Pool holds spETH, the Staking contract buys it there
 * at previewDeposit instead of minting, so totalAssets need not move. The checks follow the ETH
 * instead: spETH + Liquid Unstake Pool hold exactly `value` more ETH, the ERC-4626 Deposit event
 * reports assets = value and shares = the balance the user gained, and the shares sit within
 * 1 bp of the pre-tx previewDeposit (the share price accrues every second).
 */
async function metaPoolDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const provider = getProvider(base.chain);
  const signer = await freshSigner(base.chain);
  const user = await signer.getAddress();
  const speth = new ethers.Contract(META_POOL.speth, SPETH_ABI, signer);
  const custody = [META_POOL.speth, META_POOL.liquidPool];
  // ethers caches identical getBalance("latest") calls for ~250 ms, so the after-read is pinned
  // to the receipt's block.
  const ethOf = async blockTag => {
    let total = 0n;
    for (const address of custody) total += await provider.getBalance(address, blockTag);
    return total;
  };
  const preview = await speth.previewDeposit(value);
  const before = await speth.balanceOf(user);
  const ethBefore = await ethOf("latest");
  const receipt = await (await speth.depositETH(user, { value })).wait();
  const minted = (await speth.balanceOf(user, { blockTag: receipt.blockNumber })) - before;
  const ethAfter = await ethOf(receipt.blockNumber);
  const event = receipt.logs
    .filter(log => log.address.toLowerCase() === META_POOL.speth.toLowerCase())
    .map(log => {
      try {
        return DEPOSIT_EVENT.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(parsed => parsed && parsed.name === "Deposit");
  const eventOk = Boolean(event) && event.args.assets === value && event.args.shares === minted;
  const drift = minted > preview ? minted - preview : preview - minted;
  const ok = minted > 0n && eventOk && drift * 10_000n <= preview && ethAfter - ethBefore === value;
  return finish({
    ...base,
    ok,
    key: `spETH=0->${formatUnits(minted, 18)} preview=${formatUnits(preview, 18)} custodyEth+=${formatUnits(ethAfter - ethBefore, 18)} event=${eventOk}`,
    detail: `depositETH ${formatUnits(value, 18)} into Meta Pool spETH\nshares ${formatUnits(minted, 18)} (previewDeposit before the tx ${formatUnits(preview, 18)})\nspETH + Liquid Unstake Pool ETH ${formatUnits(ethBefore, 18)} -> ${formatUnits(ethAfter, 18)}\nERC-4626 Deposit event matches ${eventOk}\nUnstake is a liquid-pool swap or a 2-9 day delayed withdrawal, so this does not redeem.\ntx ${receipt.hash}`,
    error: ok ? null : "spETH depositETH did not take the ETH and deliver previewDeposit shares",
  });
}

const STAKEWISE_VAULT_ABI = [
  "function depositAndMintOsToken(address receiver, uint256 osTokenShares, address referrer) payable returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function getShares(address account) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function isStateUpdateRequired() view returns (bool)",
  "function capacity() view returns (uint256)",
  "function osTokenPositions(address user) view returns (uint128)",
  "event Deposited(address indexed caller, address indexed receiver, uint256 assets, uint256 shares, address referrer)",
];

/**
 * StakeWise V3 Genesis Vault: depositAndMintOsToken stakes ETH and mints osETH against it in one call.
 * Pre-checks: the vault must not need a keeper state update (a deposit would revert NotHarvested) and
 * the deposit must fit under capacity(). Asserts the vault's totalAssets rose by exactly `value`, the
 * Deposited event reports assets = value and shares = the user's share gain (within 1 wei of the pre-tx
 * convertToShares), and the user holds exactly the requested osETH, which is also the vault's
 * osToken position for the user. Exits go through the exit queue, so there is no redeem.
 */
async function stakewiseDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(STAKEWISE.genesisVault, STAKEWISE_VAULT_ABI, provider);
  if (await reader.isStateUpdateRequired()) {
    return finish({ ...base, ok: false, error: "Genesis Vault needs a keeper state update (updateState) before deposits" });
  }
  const totalBefore = await reader.totalAssets();
  const capacity = await reader.capacity();
  if (totalBefore + value > capacity) {
    return finish({ ...base, ok: false, error: `deposit would exceed capacity ${formatUnits(capacity, 18)} ETH` });
  }
  const signer = await freshSigner(base.chain);
  const user = await signer.getAddress();
  const vault = new ethers.Contract(STAKEWISE.genesisVault, STAKEWISE_VAULT_ABI, signer);
  const controller = new ethers.Contract(STAKEWISE.controller, ["function convertToShares(uint256 assets) view returns (uint256)"], provider);
  const osEth = new ethers.Contract(STAKEWISE.osETH, ["function balanceOf(address) view returns (uint256)"], provider);
  // Mint osETH worth half the deposit, well inside the vault's LTV.
  const osShares = await controller.convertToShares(value / 2n);
  const expectedShares = await reader.convertToShares(value);
  const sharesBefore = await reader.getShares(user);
  const osBefore = await osEth.balanceOf(user);
  const receipt = await (await vault.depositAndMintOsToken(user, osShares, ethers.ZeroAddress, { value })).wait();
  const tag = { blockTag: receipt.blockNumber };
  const shares = (await reader.getShares(user, tag)) - sharesBefore;
  const osMinted = (await osEth.balanceOf(user, tag)) - osBefore;
  const position = await reader.osTokenPositions(user, tag);
  const totalAfter = await reader.totalAssets(tag);
  const event = receipt.logs
    .filter(log => log.address.toLowerCase() === STAKEWISE.genesisVault.toLowerCase())
    .map(log => {
      try {
        return reader.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(parsed => parsed && parsed.name === "Deposited");
  const eventOk = Boolean(event) && event.args.receiver === user && event.args.assets === value && event.args.shares === shares;
  const drift = shares > expectedShares ? shares - expectedShares : expectedShares - shares;
  const ok = shares > 0n && drift <= 1n && eventOk && totalAfter - totalBefore === value && osMinted === osShares && position === osShares;
  return finish({
    ...base,
    ok,
    key: `shares=0->${formatUnits(shares, 18)} expected=${formatUnits(expectedShares, 18)} osETH=0->${formatUnits(osMinted, 18)} requested=${formatUnits(osShares, 18)} totalAssets+=${formatUnits(totalAfter - totalBefore, 18)} event=${eventOk}`,
    detail: `depositAndMintOsToken ${formatUnits(value, 18)} ETH into the StakeWise Genesis Vault\nvault shares ${formatUnits(shares, 18)} (convertToShares before the tx ${formatUnits(expectedShares, 18)})\nosETH minted ${formatUnits(osMinted, 18)} (requested ${formatUnits(osShares, 18)}, position ${formatUnits(position, 18)})\nvault totalAssets ${formatUnits(totalBefore, 18)} -> ${formatUnits(totalAfter, 18)}\nDeposited event matches ${eventOk}\nExits go through the validator exit queue, so this does not redeem.\ntx ${receipt.hash}`,
    error: ok ? null : "Genesis Vault deposit did not mint the expected shares and osETH",
  });
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
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
    if (protocol === "wbeth") return await wbethDeposit(base);
    if (protocol === "meta-pool") return await metaPoolDeposit(base);
    if (protocol === "stakewise") return await stakewiseDeposit(base);
    return finish({ ...base, ok: false, error: `Unknown LST action ${protocol}:${action}` });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message || String(err) });
  }
}

module.exports = { run };
