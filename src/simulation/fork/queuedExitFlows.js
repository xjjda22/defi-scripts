/**
 * Vaults whose exit is a queue, not an instant redeem: Ember Earn and Vesper USD (sUSDv).
 * Each test deposits, then files the exit request and asserts the request itself.
 * The queue is not waited out. Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { EMBER, VESPER } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const GAS = { gasLimit: 1_500_000n };

const EMBER_ABI = [
  ...ERC,
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function asset() view returns (address)",
  "function minWithdrawableShares() view returns (uint256)",
  "function getPendingWithdrawalsLength() view returns (uint256)",
  "function getPendingWithdrawal(uint256 index) view returns (tuple(address owner, address receiver, uint256 shares, uint256 estimatedWithdrawAmount, uint256 timestamp, uint256 sequenceNumber))",
  "function redeemShares(uint256 shares, address receiver) returns (tuple(address owner, address receiver, uint256 shares, uint256 estimatedWithdrawAmount, uint256 timestamp, uint256 sequenceNumber))",
];

const GATEWAY_ABI = [
  "function PEGGED_TOKEN() view returns (address)",
  "function previewDeposit(address tokenIn, uint256 amountIn) view returns (uint256)",
  "function deposit(address tokenIn, uint256 amountIn, uint256 minPeggedTokenOut, address receiver) returns (uint256)",
  "function maxMint() view returns (uint256)",
];
const STAKING_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function cooldownEnabled() view returns (bool)",
  "function totalAssetsInCooldown() view returns (uint256)",
  "function requestRedeem(uint256 shares, address owner) returns (uint256, uint256)",
  "function getPendingRequests(address account) view returns (uint256[], uint256[], uint256[])",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  const reason = err.reason || (err.revert && err.revert.args && err.revert.args.join(" "));
  return `${reason || err.shortMessage || err.message || err} ${data}`.trim();
}

async function approve(token, signer, spender, amount) {
  const erc = new ethers.Contract(token, ERC, signer);
  await (await erc.approve(spender, amount)).wait();
}

/**
 * Ember Earn: USDC deposit (ERC-4626), then redeemShares, which moves the shares into the vault and
 * appends a request to the FIFO withdrawal queue that Ember's operator processes.
 */
async function emberDeposit(base) {
  const spec = EMBER;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.vault, EMBER_ABI, provider);
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || spec.defaultAmount, spec.decimals);
  const assetOnChain = await reader.asset();
  if (assetOnChain.toLowerCase() !== spec.asset.toLowerCase()) {
    return finish({ ...base, ok: false, error: `eEARN asset() is ${assetOnChain}, not USDC` });
  }
  const max = await reader.maxDeposit(ethers.Wallet.createRandom().address);
  if (max < amount) {
    return finish({
      ...base,
      ok: true,
      key: `readOnly=maxDeposit=${formatUnits(max, spec.decimals)}`,
      detail: `eEARN maxDeposit ${formatUnits(max, spec.decimals)} USDC is below the test amount. No deposit.`,
    });
  }
  const signer = await impersonateFunded(base.chain, spec.symbol, spec.asset, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(spec.asset, ERC, provider);
  const vault = new ethers.Contract(spec.vault, EMBER_ABI, signer);
  const usdcBefore = await usdc.balanceOf(user);
  const preview = await reader.previewDeposit(amount);
  await approve(spec.asset, signer, spec.vault, amount);
  await (await vault.deposit(amount, user, GAS)).wait();
  const usdcMid = await usdc.balanceOf(user);
  const shares = await reader.balanceOf(user);
  const minShares = await reader.minWithdrawableShares();
  const lenBefore = await reader.getPendingWithdrawalsLength();
  const vaultSharesBefore = await reader.balanceOf(spec.vault);
  const estimate = await reader.convertToAssets(shares);
  // redeemShares spends the owner's allowance to the vault itself.
  await (await vault.approve(spec.vault, shares)).wait();
  const receipt = await (await vault.redeemShares(shares, user, GAS)).wait();
  const lenAfter = await reader.getPendingWithdrawalsLength();
  const request = await reader.getPendingWithdrawal(lenAfter - 1n);
  const sharesAfter = await reader.balanceOf(user);
  const vaultSharesAfter = await reader.balanceOf(spec.vault);
  const pulled = usdcBefore - usdcMid === amount;
  const minted = shares > 0n && shares === preview;
  const queued =
    lenAfter === lenBefore + 1n &&
    request.owner.toLowerCase() === user.toLowerCase() &&
    request.receiver.toLowerCase() === user.toLowerCase() &&
    request.shares === shares &&
    request.estimatedWithdrawAmount === estimate;
  const moved = sharesAfter === 0n && vaultSharesAfter - vaultSharesBefore === shares;
  const ok = shares >= minShares && pulled && minted && queued && moved;
  const d = spec.decimals;
  return finish({
    ...base,
    ok,
    key: `eEARN=0->${formatUnits(shares, d)}->${formatUnits(sharesAfter, d)} USDC=${formatUnits(usdcBefore, d)}->${formatUnits(usdcMid, d)} queue=${lenBefore}->${lenAfter} estimate=${formatUnits(request.estimatedWithdrawAmount, d)}`,
    detail: `deposited ${formatUnits(amount, d)} USDC into Ember Earn\nshares ${formatUnits(shares, d)} (previewDeposit ${formatUnits(preview, d)})\nredeemShares queued request #${request.sequenceNumber}: ${formatUnits(request.shares, d)} shares, estimated ${formatUnits(request.estimatedWithdrawAmount, d)} USDC (convertToAssets ${formatUnits(estimate, d)})\nqueue length ${lenBefore} -> ${lenAfter}; the operator processes it off this machine\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `Ember Earn failed: pulled=${pulled} sharesMatchPreview=${minted} queued=${queued} sharesMoved=${moved} aboveMin=${shares >= minShares}`,
  });
}

/**
 * Vesper USD: USDC -> USDv through the Gateway (fixed-price adapter at 1.0), stake USDv into sUSDv
 * (ERC-4626), then requestRedeem the shares into the cooldown queue.
 */
async function vesperDeposit(base) {
  const spec = VESPER;
  const provider = getProvider(base.chain);
  const gatewayReader = new ethers.Contract(spec.gateway, GATEWAY_ABI, provider);
  const stakingReader = new ethers.Contract(spec.vault, STAKING_ABI, provider);
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || spec.defaultAmount, spec.decimals);
  const pegged = await gatewayReader.PEGGED_TOKEN();
  const stakedAsset = await stakingReader.asset();
  if (pegged.toLowerCase() !== spec.usdv.toLowerCase() || stakedAsset.toLowerCase() !== spec.usdv.toLowerCase()) {
    return finish({ ...base, ok: false, error: `Gateway PEGGED_TOKEN ${pegged} / sUSDv asset ${stakedAsset} is not USDv ${spec.usdv}` });
  }
  const signer = await impersonateFunded(base.chain, spec.symbol, spec.asset, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(spec.asset, ERC, provider);
  const usdv = new ethers.Contract(spec.usdv, ERC, provider);
  const gateway = new ethers.Contract(spec.gateway, GATEWAY_ABI, signer);
  const staking = new ethers.Contract(spec.vault, STAKING_ABI, signer);

  // 1. Gateway deposit: USDC -> USDv.
  const usdcBefore = await usdc.balanceOf(user);
  const usdvBefore = await usdv.balanceOf(user);
  const usdvPreview = await gatewayReader.previewDeposit(spec.asset, amount);
  await approve(spec.asset, signer, spec.gateway, amount);
  await (await gateway.deposit(spec.asset, amount, usdvPreview, user, GAS)).wait();
  const usdcMid = await usdc.balanceOf(user);
  const usdvGot = (await usdv.balanceOf(user)) - usdvBefore;
  const mintOk = usdcBefore - usdcMid === amount && usdvGot === usdvPreview && usdvGot > 0n;

  // 2. Stake USDv -> sUSDv. sUSDv vests distributed yield per second, so the share price can move
  // between the preview block and the deposit block; the Deposit event is the exact record.
  const max = await stakingReader.maxDeposit(user);
  if (max < usdvGot) {
    return finish({ ...base, ok: false, error: `sUSDv maxDeposit ${max} below ${usdvGot} after a successful mint` });
  }
  const sharesPreview = await stakingReader.previewDeposit(usdvGot);
  const assetsBefore = await stakingReader.totalAssets();
  const usdvPre = await usdv.balanceOf(user);
  await approve(spec.usdv, signer, spec.vault, usdvGot);
  const stakeReceipt = await (await staking.deposit(usdvGot, user, GAS)).wait();
  const shares = await stakingReader.balanceOf(user);
  const assetsAfter = await stakingReader.totalAssets();
  const usdvSpent = usdvPre - (await usdv.balanceOf(user));
  const iface = new ethers.Interface(STAKING_ABI);
  const events = stakeReceipt.logs
    .filter(log => log.address.toLowerCase() === spec.vault.toLowerCase())
    .map(log => {
      try {
        return iface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(parsed => parsed && parsed.name === "Deposit");
  const event = events[0];
  const drift = shares > sharesPreview ? shares - sharesPreview : sharesPreview - shares;
  const stakeOk =
    shares > 0n &&
    usdvSpent === usdvGot &&
    events.length === 1 &&
    event.args.assets === usdvGot &&
    event.args.shares === shares &&
    drift * 10_000n <= sharesPreview &&
    assetsAfter - assetsBefore >= usdvGot;

  // 3. Cooldown request: shares are burned and the USDv is reserved for the 7-day (default) cooldown.
  const cooldown = await stakingReader.cooldownEnabled();
  const redeemPreview = await stakingReader.previewRedeem(shares);
  const reservedBefore = await stakingReader.totalAssetsInCooldown();
  const receipt = await (await staking.requestRedeem(shares, user, GAS)).wait();
  const sharesAfter = await stakingReader.balanceOf(user);
  const reservedAfter = await stakingReader.totalAssetsInCooldown();
  const pending = await stakingReader.getPendingRequests(user);
  const pendingIds = pending[0];
  const reserved = reservedAfter - reservedBefore;
  // sUSDv vests per second, so a request mined a second after the preview reserves slightly more.
  // The pending request records the exact amount; the preview bounds it from below, within 1 bp.
  const pendingAssets = pendingIds.length === 1 ? pending[1][0] : 0n;
  const requestOk =
    cooldown &&
    sharesAfter === 0n &&
    pendingIds.length === 1 &&
    pendingAssets === reserved &&
    reserved >= redeemPreview &&
    (reserved - redeemPreview) * 10_000n <= redeemPreview;

  const ok = mintOk && stakeOk && requestOk;
  const d = spec.decimals;
  return finish({
    ...base,
    ok,
    key: `USDC=${formatUnits(usdcBefore, d)}->${formatUnits(usdcMid, d)} USDv=+${formatUnits(usdvGot, 18)} sUSDv=0->${formatUnits(shares, 18)}->${formatUnits(sharesAfter, 18)} cooldownReserved=+${formatUnits(reserved, 18)}`,
    detail: `Gateway deposit ${formatUnits(amount, d)} USDC -> ${formatUnits(usdvGot, 18)} USDv (previewDeposit ${formatUnits(usdvPreview, 18)})\nstaked into sUSDv: ${formatUnits(shares, 18)} shares = Deposit event shares, ${formatUnits(sharesPreview, 18)} previewed a block earlier (drift ${formatUnits(drift, 18)}); totalAssets +${formatUnits(assetsAfter - assetsBefore, 18)} (deposit plus vested yield)\nrequestRedeem: shares left ${formatUnits(sharesAfter, 18)}, ${pendingIds.length} pending request, ${formatUnits(reserved, 18)} USDv reserved = pending request ${formatUnits(pendingAssets, 18)} (previewRedeem ${formatUnits(redeemPreview, 18)}); the cooldown is not waited out\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `Vesper USD failed: mint=${mintOk} stake=${stakeOk} request=${requestOk} (cooldownEnabled=${cooldown}, pending=${pendingIds.length}, reserved=${reserved}, previewRedeem=${redeemPreview})`,
  });
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const chain = process.env.CHAIN || "ethereum";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (protocol === "ember") return await emberDeposit(base);
    if (protocol === "vesper") return await vesperDeposit(base);
    return finish({ ...base, ok: false, error: `Unknown queued-exit action ${protocol}:${action}` });
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
