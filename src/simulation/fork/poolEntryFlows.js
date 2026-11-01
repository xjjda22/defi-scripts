/**
 * Entry actions for seven top-200 rows (playground 2026-11-02). A revert is a FAIL.
 * - usdt0 (Ethereum): USDT0 OFT Adapter send() of USDT to Arbitrum (locks USDT in the adapter).
 * - liquity (Ethereum): Liquity V1 Stability Pool provideToSP with LUSD, then withdrawFromSP of all of it.
 * - convex (Ethereum): Booster deposit of Curve 3pool LP (pid 9) with stake, then withdrawAndUnwrap.
 * - theo (Ethereum): thUSD into sthUSD (ERC-4626), initiateRedeem, wait out the lockup, then redeem.
 * - cian (Ethereum): rsETH into the CIAN rsETH Yield Layer vault, then requestRedeem every share.
 * - solvbtc (Ethereum): SolvBTC Router createSubscription with WBTC (permissionless pool).
 * - zama (Ethereum): wrap USDC into Zama's confidential cUSDC (ERC-7984 wrapper).
 * Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { USDT0, LIQUITY, CONVEX, THEO, CIAN, SOLVBTC, ZAMA } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const GAS = { gasLimit: 3_000_000n };
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
];
const SEND_PARAM =
  "tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd)";
const OFT_ABI = [
  "function token() view returns (address)",
  `function quoteOFT(${SEND_PARAM}) view returns (tuple(uint256 minAmountLD, uint256 maxAmountLD), tuple(int256 feeAmountLD, string description)[], tuple(uint256 amountSentLD, uint256 amountReceivedLD))`,
  `function quoteSend(${SEND_PARAM}, bool payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))`,
  `function send(${SEND_PARAM}, tuple(uint256 nativeFee, uint256 lzTokenFee), address refundAddress) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee), tuple(uint256 amountSentLD, uint256 amountReceivedLD))`,
  "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
];
const SP_ABI = [
  "function provideToSP(uint256 _amount, address _frontEndTag)",
  "function withdrawFromSP(uint256 _amount)",
  "function getCompoundedLUSDDeposit(address) view returns (uint256)",
  "function getTotalLUSDDeposits() view returns (uint256)",
  "function lusdToken() view returns (address)",
];
const BOOSTER_ABI = [
  "function poolInfo(uint256) view returns (address lptoken, address token, address gauge, address crvRewards, address stash, bool shutdown)",
  "function isShutdown() view returns (bool)",
  "function deposit(uint256 _pid, uint256 _amount, bool _stake) returns (bool)",
];
const REWARDS_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function withdrawAndUnwrap(uint256 amount, bool claim) returns (bool)",
];
const STH_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function paused() view returns (bool)",
  "function maxDeposit(address) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function lockupPeriod() view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function initiateRedeem(uint256 shares, address owner)",
  "function currentRedeemRequest(address) view returns (uint256 assets, uint256 shares, uint256 claimableTimestamp)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
];
const CIAN_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function paused() view returns (bool)",
  "function maxDeposit(address) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function requestRedeem(uint256 shares, address token)",
  "function remainingUpdateTime() view returns (uint256)",
];
const SOLV_ROUTER_ABI = [
  "function checkPoolPermission(bytes32 poolId) view returns (bool)",
  "function createSubscription(bytes32 poolId, uint256 currencyAmount) returns (uint256 shareValue)",
  "event CreateSubscription(bytes32 indexed poolId, address indexed subscriber, address solvBTC, uint256 subscribeAmount, address currency, uint256 currencyAmount)",
  "event CollectDepositFee(address indexed payer, address indexed currency, address indexed feeReceiver, uint256 feeAmount)",
];

const WRAPPER_ABI = [
  "function underlying() view returns (address)",
  "function rate() view returns (uint256)",
  "function inferredTotalSupply() view returns (uint256)",
  "function confidentialTotalSupply() view returns (bytes32)",
  "function confidentialBalanceOf(address) view returns (bytes32)",
  "function wrap(address to, uint256 amount)",
];
const REGISTRY_ABI = [
  "function getConfidentialTokenAddress(address token) view returns (bool isValid, address confidentialToken)",
];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  const reason = err.reason || (err.revert && err.revert.args && err.revert.args.join(" "));
  return `${reason || err.shortMessage || err.message || err} ${data}`.trim();
}

function eventArgs(receipt, iface, name, address) {
  const out = [];
  for (const log of receipt.logs) {
    if (address && log.address.toLowerCase() !== address.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === name) out.push(parsed.args);
    } catch {
      // other contract's log
    }
  }
  return out;
}

/** USDT0: lock USDT in the Ethereum OFT Adapter for Arbitrum. Destination delivery needs LayerZero and is not run. */
async function usdt0Send(base) {
  const spec = USDT0;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.adapter, OFT_ABI, provider);
  const token = await reader.token();
  if (token.toLowerCase() !== spec.usdt.toLowerCase()) {
    return finish({ ...base, ok: false, error: `OFT Adapter token() is ${token}, not USDT ${spec.usdt}` });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDT", spec.usdt, amount);
  const user = await signer.getAddress();
  const usdt = new ethers.Contract(spec.usdt, ERC, signer);
  const adapter = new ethers.Contract(spec.adapter, OFT_ABI, signer);
  await (await usdt.approve(spec.adapter, amount)).wait();
  const param = [spec.arbitrumEid, ethers.zeroPadValue(user, 32), amount, 0n, "0x", "0x", "0x"];
  const [, , quoted] = await reader.quoteOFT(param);
  param[3] = quoted.amountReceivedLD;
  const fee = await reader.quoteSend(param, false);
  const userBefore = await usdt.balanceOf(user);
  const lockedBefore = await usdt.balanceOf(spec.adapter);
  const receipt = await (await adapter.send(param, [fee.nativeFee, 0n], user, { ...GAS, value: fee.nativeFee })).wait();
  const userAfter = await usdt.balanceOf(user);
  const lockedAfter = await usdt.balanceOf(spec.adapter);
  const [sent] = eventArgs(receipt, reader.interface, "OFTSent", spec.adapter);
  const ok =
    userBefore - userAfter === amount &&
    lockedAfter - lockedBefore === quoted.amountSentLD &&
    !!sent &&
    Number(sent.dstEid) === spec.arbitrumEid &&
    sent.fromAddress.toLowerCase() === user.toLowerCase() &&
    sent.amountSentLD === quoted.amountSentLD &&
    sent.amountReceivedLD === quoted.amountReceivedLD &&
    quoted.amountReceivedLD > 0n;
  return finish({
    ...base,
    ok,
    detail: `send ${formatUnits(amount, 6)} USDT to Arbitrum (EID ${spec.arbitrumEid}) through the USDT0 OFT Adapter, LayerZero fee ${ethers.formatEther(fee.nativeFee)} ETH\nuser USDT -${formatUnits(userBefore - userAfter, 6)}, adapter USDT ${formatUnits(lockedBefore, 6)} -> ${formatUnits(lockedAfter, 6)}\nOFTSent guid ${sent ? sent.guid : "-"} sent ${sent ? formatUnits(sent.amountSentLD, 6) : "-"} received ${sent ? formatUnits(sent.amountReceivedLD, 6) : "-"}\ntx ${receipt.hash}`,
    error: ok ? null : "USDT0 send did not lock exactly the quoted amount or emit a matching OFTSent",
  });
}

/** Liquity V1 Stability Pool round trip. No liquidation lands between the two txs, so the deposit is exact. */
async function liquityDeposit(base) {
  const spec = LIQUITY;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.stabilityPool, SP_ABI, provider);
  const lusdAddress = await reader.lusdToken();
  if (lusdAddress.toLowerCase() !== spec.lusd.toLowerCase()) {
    return finish({ ...base, ok: false, error: `StabilityPool lusdToken() is ${lusdAddress}, not LUSD ${spec.lusd}` });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 18);
  const signer = await impersonateFunded(base.chain, "LUSD", spec.lusd, amount);
  const user = await signer.getAddress();
  const lusd = new ethers.Contract(spec.lusd, ERC, signer);
  const pool = new ethers.Contract(spec.stabilityPool, SP_ABI, signer);
  const userBefore = await lusd.balanceOf(user);
  const totalBefore = await reader.getTotalLUSDDeposits();
  const provideReceipt = await (await pool.provideToSP(amount, ethers.ZeroAddress, GAS)).wait();
  const userMid = await lusd.balanceOf(user);
  const totalMid = await reader.getTotalLUSDDeposits();
  const deposit = await reader.getCompoundedLUSDDeposit(user);
  const provideOk = userBefore - userMid === amount && totalMid - totalBefore === amount && deposit === amount;
  const withdrawReceipt = await (await pool.withdrawFromSP(deposit, GAS)).wait();
  const userAfter = await lusd.balanceOf(user);
  const left = await reader.getCompoundedLUSDDeposit(user);
  const totalAfter = await reader.getTotalLUSDDeposits();
  const withdrawOk = userAfter - userMid === amount && left === 0n && totalAfter === totalBefore;
  const ok = provideOk && withdrawOk;
  return finish({
    ...base,
    ok,
    detail: `provideToSP ${formatUnits(amount, 18)} LUSD: Stability Pool total ${formatUnits(totalBefore, 18)} -> ${formatUnits(totalMid, 18)}, compounded deposit ${formatUnits(deposit, 18)}\nwithdrawFromSP: LUSD back ${formatUnits(userAfter - userMid, 18)}, deposit left ${formatUnits(left, 18)}, pool total back to ${formatUnits(totalAfter, 18)}\ntx ${provideReceipt.hash} / ${withdrawReceipt.hash}`,
    error: ok ? null : `Liquity Stability Pool round trip failed: provide=${provideOk} withdraw=${withdrawOk}`,
  });
}

/** Convex Booster: deposit Curve LP with stake=true, then withdrawAndUnwrap from the pool's BaseRewardPool. */
async function convexDeposit(base) {
  const spec = CONVEX;
  const provider = getProvider(base.chain);
  const booster = new ethers.Contract(spec.booster, BOOSTER_ABI, provider);
  const pid = BigInt(process.env.CONVEX_PID || spec.pid);
  const info = await booster.poolInfo(pid);
  if (info.shutdown || (await booster.isShutdown())) {
    return finish({ ...base, ok: false, error: `Convex pid ${pid} or the Booster is shut down` });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer = await impersonateFunded(base.chain, "3Crv", info.lptoken, amount);
  const user = await signer.getAddress();
  const lp = new ethers.Contract(info.lptoken, ERC, signer);
  const rewards = new ethers.Contract(info.crvRewards, REWARDS_ABI, signer);
  const depositToken = new ethers.Contract(info.token, ERC, provider);
  await (await lp.approve(spec.booster, amount)).wait();
  const lpBefore = await lp.balanceOf(user);
  const gaugeBefore = await lp.balanceOf(info.gauge);
  const supplyBefore = await rewards.totalSupply();
  const depositReceipt = await (await booster.connect(signer).deposit(pid, amount, true, GAS)).wait();
  const lpMid = await lp.balanceOf(user);
  const gaugeMid = await lp.balanceOf(info.gauge);
  const staked = await rewards.balanceOf(user);
  const supplyMid = await rewards.totalSupply();
  const looseTokens = await depositToken.balanceOf(user);
  const depositOk =
    lpBefore - lpMid === amount &&
    gaugeMid - gaugeBefore === amount &&
    staked === amount &&
    supplyMid - supplyBefore === amount &&
    looseTokens === 0n;
  const withdrawReceipt = await (await rewards.withdrawAndUnwrap(staked, false, GAS)).wait();
  const lpAfter = await lp.balanceOf(user);
  const stakedAfter = await rewards.balanceOf(user);
  const gaugeAfter = await lp.balanceOf(info.gauge);
  const withdrawOk = lpAfter - lpMid === amount && stakedAfter === 0n && gaugeAfter === gaugeBefore;
  const ok = depositOk && withdrawOk;
  return finish({
    ...base,
    ok,
    detail: `Booster.deposit(pid ${pid}, ${formatUnits(amount, 18)} LP ${info.lptoken}, stake=true): gauge LP +${formatUnits(gaugeMid - gaugeBefore, 18)}, BaseRewardPool ${info.crvRewards} balance ${formatUnits(staked, 18)}\nwithdrawAndUnwrap: LP back ${formatUnits(lpAfter - lpMid, 18)}, staked left ${formatUnits(stakedAfter, 18)}\ntx ${depositReceipt.hash} / ${withdrawReceipt.hash}`,
    error: ok ? null : `Convex deposit/withdraw failed: deposit=${depositOk} withdraw=${withdrawOk}`,
  });
}

/** Theo sthUSD: stake, initiateRedeem, advance past lockupPeriod on the fork, claim. */
async function theoStake(base) {
  const spec = THEO;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.sthusd, STH_ABI, provider);
  const asset = await reader.asset();
  if (asset.toLowerCase() !== spec.thusd.toLowerCase()) {
    return finish({ ...base, ok: false, error: `sthUSD asset() is ${asset}, not thUSD ${spec.thusd}` });
  }
  if (await reader.paused()) return finish({ ...base, ok: false, error: "sthUSD is paused" });
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "thUSD", spec.thusd, amount);
  const user = await signer.getAddress();
  const thusd = new ethers.Contract(spec.thusd, ERC, signer);
  const vault = new ethers.Contract(spec.sthusd, STH_ABI, signer);
  await (await thusd.approve(spec.sthusd, amount)).wait();
  const userBefore = await thusd.balanceOf(user);
  const vaultBefore = await thusd.balanceOf(spec.sthusd);
  const preview = await reader.previewDeposit(amount);
  const depositReceipt = await (await vault.deposit(amount, user, GAS)).wait();
  const shares = await reader.balanceOf(user);
  const [dep] = eventArgs(depositReceipt, reader.interface, "Deposit", spec.sthusd);
  const userMid = await thusd.balanceOf(user);
  const vaultMid = await thusd.balanceOf(spec.sthusd);
  const depositOk =
    userBefore - userMid === amount &&
    vaultMid - vaultBefore === amount &&
    shares === preview &&
    shares > 0n &&
    !!dep &&
    dep.assets === amount &&
    dep.shares === shares;
  const booked = await reader.convertToAssets(shares);
  const initReceipt = await (await vault.initiateRedeem(shares, user, GAS)).wait();
  const request = await reader.currentRedeemRequest(user);
  const sharesLeft = await reader.balanceOf(user);
  // vesting can only move convertToAssets up between the two calls
  const requestOk =
    sharesLeft === 0n &&
    request.shares === shares &&
    request.assets >= booked &&
    request.assets <= booked + booked / 10_000n;
  const lockup = await reader.lockupPeriod();
  // The time jump would leave later tests on the same fork with stale oracles, so it is undone below.
  const snapshot = await provider.send("evm_snapshot", []);
  await provider.send("evm_increaseTime", [Number(lockup) + 1]);
  await provider.send("evm_mine", []);
  const redeemReceipt = await (await vault.redeem(request.shares, user, user, GAS)).wait();
  const userAfter = await thusd.balanceOf(user);
  const cleared = await reader.currentRedeemRequest(user);
  const claimOk = userAfter - userMid === request.assets && cleared.shares === 0n && cleared.assets === 0n;
  await provider.send("evm_revert", [snapshot]);
  const ok = depositOk && requestOk && claimOk;
  return finish({
    ...base,
    ok,
    detail: `deposit ${formatUnits(amount, 6)} thUSD -> ${formatUnits(shares, 6)} sthUSD (previewDeposit ${formatUnits(preview, 6)})\ninitiateRedeem: booked ${formatUnits(request.assets, 6)} thUSD for ${formatUnits(request.shares, 6)} shares, lockup ${lockup}s advanced on the fork (evm_revert afterwards)\nredeem: thUSD back ${formatUnits(userAfter - userMid, 6)}, request cleared=${cleared.shares === 0n}\ntx ${depositReceipt.hash} / ${initReceipt.hash} / ${redeemReceipt.hash}`,
    error: ok ? null : `Theo sthUSD round trip failed: deposit=${depositOk} request=${requestOk} claim=${claimOk}`,
  });
}

/** CIAN rsETH Yield Layer: deposit rsETH, then requestRedeem every share into the RedeemOperator queue. */
async function cianDeposit(base) {
  const spec = CIAN;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.vault, CIAN_ABI, provider);
  const asset = await reader.asset();
  if (asset.toLowerCase() !== spec.rseth.toLowerCase()) {
    return finish({ ...base, ok: false, error: `Vault asset() is ${asset}, not rsETH ${spec.rseth}` });
  }
  if (await reader.paused()) return finish({ ...base, ok: false, error: "CIAN rsETH Yield Layer is paused" });
  // Deposits revert PriceNotUpdated() once the operator's exchange-price update window has lapsed.
  const window = await reader.remainingUpdateTime();
  if (window === 0n)
    return finish({
      ...base,
      ok: false,
      error: "CIAN exchange price is stale (remainingUpdateTime 0): deposit would revert PriceNotUpdated()",
    });
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1", 18);
  const max = await reader.maxDeposit(ethers.Wallet.createRandom().address);
  if (max < amount)
    return finish({
      ...base,
      ok: false,
      error: `maxDeposit ${formatUnits(max, 18)} is below ${formatUnits(amount, 18)}`,
    });
  const signer = await impersonateFunded(base.chain, "rsETH", spec.rseth, amount);
  const user = await signer.getAddress();
  const rseth = new ethers.Contract(spec.rseth, ERC, signer);
  const vault = new ethers.Contract(spec.vault, CIAN_ABI, signer);
  await (await rseth.approve(spec.vault, amount)).wait();
  const userBefore = await rseth.balanceOf(user);
  const preview = await reader.previewDeposit(amount);
  const supplyBefore = await reader.totalSupply();
  const depositReceipt = await (await vault.deposit(amount, user, GAS)).wait();
  const userMid = await rseth.balanceOf(user);
  const shares = await reader.balanceOf(user);
  const supplyMid = await reader.totalSupply();
  const depositOk =
    userBefore - userMid === amount && shares === preview && shares > 0n && supplyMid - supplyBefore === shares;
  const opBefore = await reader.balanceOf(spec.redeemOperator);
  const requestReceipt = await (await vault.requestRedeem(shares, spec.rseth, GAS)).wait();
  const opAfter = await reader.balanceOf(spec.redeemOperator);
  const sharesLeft = await reader.balanceOf(user);
  const requestOk = sharesLeft === 0n && opAfter - opBefore === shares;
  const ok = depositOk && requestOk;
  return finish({
    ...base,
    ok,
    detail: `deposit ${formatUnits(amount, 18)} rsETH -> ${formatUnits(shares, 18)} shares (previewDeposit ${formatUnits(preview, 18)})\nrequestRedeem(all, rsETH): RedeemOperator shares +${formatUnits(opAfter - opBefore, 18)}, user shares left ${formatUnits(sharesLeft, 18)}; the operator settles the queue off the fork\ntx ${depositReceipt.hash} / ${requestReceipt.hash}`,
    error: ok ? null : `CIAN deposit/request failed: deposit=${depositOk} request=${requestOk}`,
  });
}

/** SolvBTC: subscribe WBTC through the SolvBTC Router (permissionless pool) and receive SolvBTC. */
async function solvSubscribe(base) {
  const spec = SOLVBTC;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.router, SOLV_ROUTER_ABI, provider);
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "0.01", 8);
  const signer = await impersonateFunded(base.chain, "WBTC", spec.wbtc, amount);
  const user = await signer.getAddress();
  if (!(await reader.checkPoolPermission(spec.wbtcPoolId, { from: user }))) {
    return finish({ ...base, ok: false, error: `WBTC pool ${spec.wbtcPoolId} is not open to ${user}` });
  }
  const wbtc = new ethers.Contract(spec.wbtc, ERC, signer);
  const solvbtc = new ethers.Contract(spec.solvbtc, ERC, provider);
  const router = new ethers.Contract(spec.router, SOLV_ROUTER_ABI, signer);
  await (await wbtc.approve(spec.router, amount)).wait();
  const wbtcBefore = await wbtc.balanceOf(user);
  const solvBefore = await solvbtc.balanceOf(user);
  const supplyBefore = await solvbtc.totalSupply();
  const expected = await router.createSubscription.staticCall(spec.wbtcPoolId, amount);
  const receipt = await (await router.createSubscription(spec.wbtcPoolId, amount, GAS)).wait();
  const wbtcAfter = await wbtc.balanceOf(user);
  const solvAfter = await solvbtc.balanceOf(user);
  const supplyAfter = await solvbtc.totalSupply();
  const [sub] = eventArgs(receipt, reader.interface, "CreateSubscription", spec.router);
  const got = solvAfter - solvBefore;
  const [feeEvent] = eventArgs(receipt, reader.interface, "CollectDepositFee", spec.router);
  const fee = feeEvent ? feeEvent.feeAmount : 0n;
  // WBTC has 8 decimals and SolvBTC 18; at a 1:1 NAV 0.01 WBTC is 0.01 SolvBTC.
  const scaled = amount * 10n ** 10n;
  const ok =
    wbtcBefore - wbtcAfter === amount &&
    got === expected &&
    got > 0n &&
    supplyAfter - supplyBefore === got &&
    !!sub &&
    sub.solvBTC.toLowerCase() === spec.solvbtc.toLowerCase() &&
    sub.subscribeAmount === got &&
    sub.currencyAmount === amount &&
    got <= scaled &&
    got >= scaled - scaled / 100n;
  return finish({
    ...base,
    ok,
    detail: `createSubscription(WBTC pool, ${formatUnits(amount, 8)} WBTC) -> ${formatUnits(got, 18)} SolvBTC (static call ${formatUnits(expected, 18)}), SolvBTC supply +${formatUnits(supplyAfter - supplyBefore, 18)}, deposit fee ${formatUnits(fee, 8)} WBTC\nRedemption back to WBTC is an Open Fund request settled by Solv and is not exercised\ntx ${receipt.hash}`,
    error: ok ? null : "SolvBTC subscription did not mint the expected SolvBTC for the WBTC paid",
  });
}

/**
 * Zama cUSDC: wrap USDC into the confidential wrapper. Balances become FHE handles, so the
 * assertion is on the clear side: USDC locked, inferredTotalSupply, and a new balance handle.
 * Unwrapping needs the Zama decryption network and is not run on a fork.
 */
async function zamaWrap(base) {
  const spec = ZAMA;
  const provider = getProvider(base.chain);
  const registry = new ethers.Contract(spec.registry, REGISTRY_ABI, provider);
  const [isValid, listed] = await registry.getConfidentialTokenAddress(spec.usdc);
  if (!isValid || listed.toLowerCase() !== spec.cusdc.toLowerCase()) {
    return finish({
      ...base,
      ok: false,
      error: `Wrappers Registry lists ${listed} (valid=${isValid}) for USDC, not cUSDC ${spec.cusdc}`,
    });
  }
  const reader = new ethers.Contract(spec.cusdc, WRAPPER_ABI, provider);
  const underlying = await reader.underlying();
  if (underlying.toLowerCase() !== spec.usdc.toLowerCase()) {
    return finish({ ...base, ok: false, error: `cUSDC underlying() is ${underlying}, not USDC` });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", spec.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(spec.usdc, ERC, signer);
  const wrapper = new ethers.Contract(spec.cusdc, WRAPPER_ABI, signer);
  await (await usdc.approve(spec.cusdc, amount)).wait();
  const rate = await reader.rate();
  const userBefore = await usdc.balanceOf(user);
  const lockedBefore = await usdc.balanceOf(spec.cusdc);
  const supplyBefore = await reader.inferredTotalSupply();
  const handleBefore = await reader.confidentialBalanceOf(user);
  const receipt = await (await wrapper.wrap(user, amount, GAS)).wait();
  const userAfter = await usdc.balanceOf(user);
  const lockedAfter = await usdc.balanceOf(spec.cusdc);
  const supplyAfter = await reader.inferredTotalSupply();
  const handleAfter = await reader.confidentialBalanceOf(user);
  const ok =
    userBefore - userAfter === amount &&
    lockedAfter - lockedBefore === amount &&
    supplyAfter - supplyBefore === amount / rate &&
    handleBefore === ethers.ZeroHash &&
    handleAfter !== ethers.ZeroHash;
  return finish({
    ...base,
    ok,
    detail: `wrap ${formatUnits(amount, 6)} USDC into cUSDC (rate ${rate}): wrapper USDC ${formatUnits(lockedBefore, 6)} -> ${formatUnits(lockedAfter, 6)}, inferredTotalSupply +${formatUnits(supplyAfter - supplyBefore, 6)}\nconfidential balance handle ${handleAfter} (encrypted; decryption and unwrap need the Zama network)\ntx ${receipt.hash}`,
    error: ok ? null : "Zama cUSDC wrap did not lock exactly the USDC or mint the matching confidential supply",
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
    if (protocol === "usdt0") return await usdt0Send(base);
    if (protocol === "liquity") return await liquityDeposit(base);
    if (protocol === "convex") return await convexDeposit(base);
    if (protocol === "theo") return await theoStake(base);
    if (protocol === "cian") return await cianDeposit(base);
    if (protocol === "solvbtc") return await solvSubscribe(base);
    if (protocol === "zama") return await zamaWrap(base);
    return finish({ ...base, ok: false, error: `Unknown pool entry action ${protocol}:${action}` });
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
