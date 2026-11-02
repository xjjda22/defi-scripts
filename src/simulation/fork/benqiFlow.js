/**
 * Benqi on Avalanche C-Chain.
 * - benqi:supply  Core Markets qiUSDCn (Compound V2-style): mint with native USDC, then redeem
 *                 every qiToken. Pre-check: Comptroller mintGuardianPaused(qiUSDCn).
 * - benqi:stake   Liquid Staking sAVAX: submit() 1 AVAX; shares must equal the pre-tx
 *                 getSharesByPooledAvax. Unstaking is a 15-day requestUnlock, not exercised.
 *                 Pre-check: mintingPaused().
 * Addresses: https://docs.benqi.fi/resources/contracts (src/catalog/contracts.js BENQI).
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { BENQI } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");
const { impersonateAccount } = require("../../utils/impersonate");

const GAS = { gasLimit: 1_500_000n };
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const QI_ABI = [
  ...ERC,
  "function mint(uint256) returns (uint256)",
  "function redeem(uint256) returns (uint256)",
  "function underlying() view returns (address)",
  "function exchangeRateStored() view returns (uint256)",
];
const COMPTROLLER_ABI = ["function mintGuardianPaused(address) view returns (bool)"];
const SAVAX_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function submit() payable returns (uint256)",
  "function mintingPaused() view returns (bool)",
  "function getSharesByPooledAvax(uint256) view returns (uint256)",
  "function totalPooledAvax() view returns (uint256)",
];

async function supply(base) {
  const provider = getProvider(base.chain);
  const comptroller = new ethers.Contract(BENQI.comptroller, COMPTROLLER_ABI, provider);
  if (await comptroller.mintGuardianPaused(BENQI.qiUsdcn)) {
    return finish({ ...base, ok: false, key: "paused=mint", error: "Benqi Comptroller has qiUSDCn minting paused" });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", BENQI.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(BENQI.usdc, ERC, signer);
  const qi = new ethers.Contract(BENQI.qiUsdcn, QI_ABI, signer);
  const underlying = await qi.underlying();
  if (underlying.toLowerCase() !== BENQI.usdc.toLowerCase()) {
    return finish({ ...base, ok: false, error: `qiUSDCn underlying() is ${underlying}, not native USDC ${BENQI.usdc}` });
  }
  const usdcBefore = await usdc.balanceOf(user);
  const cashBefore = await usdc.balanceOf(BENQI.qiUsdcn);
  await (await usdc.approve(BENQI.qiUsdcn, amount)).wait();
  const mintCode = await qi.mint.staticCall(amount, GAS);
  if (mintCode !== 0n) return finish({ ...base, ok: false, error: `qiUSDCn mint returned error code ${mintCode}` });
  const mintReceipt = await (await qi.mint(amount, GAS)).wait();
  const usdcMid = await usdc.balanceOf(user);
  const cashMid = await usdc.balanceOf(BENQI.qiUsdcn);
  const shares = await qi.balanceOf(user);
  const rate = await qi.exchangeRateStored();
  const valued = (shares * rate) / 10n ** 18n;
  const mintOk = usdcBefore - usdcMid === amount && cashMid - cashBefore === amount && shares > 0n && valued + 2n >= amount - amount / 10000n;
  const redeemReceipt = await (await qi.redeem(shares, GAS)).wait();
  const usdcAfter = await usdc.balanceOf(user);
  const left = await qi.balanceOf(user);
  const back = usdcAfter - usdcMid;
  const redeemOk = left === 0n && back + amount / 10000n + 2n >= amount && back <= amount + amount / 10000n;
  const ok = mintOk && redeemOk;
  return finish({
    ...base,
    ok,
    key: `USDC=-${formatUnits(amount, 6)}/+${formatUnits(back, 6)} qiUSDCn=${formatUnits(shares, 8)}->${formatUnits(left, 8)}`,
    detail: `mint ${formatUnits(amount, 6)} USDC into qiUSDCn: market cash ${formatUnits(cashBefore, 6)} -> ${formatUnits(cashMid, 6)}, ${formatUnits(shares, 8)} qiUSDCn (worth ${formatUnits(valued, 6)} USDC at exchangeRateStored)\nredeem all: ${formatUnits(back, 6)} USDC back, ${formatUnits(left, 8)} qiUSDCn left\ntx ${mintReceipt.hash} / ${redeemReceipt.hash}`,
    error: ok ? null : `Benqi qiUSDCn round trip failed: mint=${mintOk} redeem=${redeemOk}`,
  });
}

async function stake(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(BENQI.savax, SAVAX_ABI, provider);
  if (await reader.mintingPaused()) {
    return finish({ ...base, ok: false, key: "paused=minting", error: "sAVAX minting is paused" });
  }
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(amount + ethers.parseEther("1"))]);
  const expected = await reader.getSharesByPooledAvax(amount);
  const pooledBefore = await reader.totalPooledAvax();
  const savax = new ethers.Contract(BENQI.savax, SAVAX_ABI, signer);
  const receipt = await (await savax.submit({ ...GAS, value: amount })).wait();
  const shares = await reader.balanceOf(user);
  const pooledAfter = await reader.totalPooledAvax();
  const ok = shares === expected && shares > 0n && pooledAfter - pooledBefore === amount;
  return finish({
    ...base,
    ok,
    key: `AVAX=${formatUnits(amount, 18)} sAVAX=${formatUnits(shares, 18)} expected=${formatUnits(expected, 18)}`,
    detail: `submit ${formatUnits(amount, 18)} AVAX: ${formatUnits(shares, 18)} sAVAX (pre-tx getSharesByPooledAvax ${formatUnits(expected, 18)}), totalPooledAvax +${formatUnits(pooledAfter - pooledBefore, 18)}\nUnstake (requestUnlock, 15-day cooldown) is not exercised.\ntx ${receipt.hash}`,
    error: ok ? null : "sAVAX submit did not mint the previewed shares or pool the AVAX",
  });
}

async function run() {
  const chain = "avalanche";
  const protocol = process.env.FORK_PROTOCOL || "benqi";
  const action = process.env.FORK_ACTION || "supply";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { protocol, action, chain, block: ctx.forkBlock };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (action === "supply") return await supply(base);
    if (action === "stake") return await stake(base);
    return finish({ ...base, ok: false, error: `Unknown Benqi action ${action}` });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
