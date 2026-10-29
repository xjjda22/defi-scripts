/**
 * Entry actions for three top-200 rows (playground 2026-10-30). A revert is a FAIL.
 * - falcon (Ethereum): USDf into sUSDf (ERC-4626), then redeem every share.
 * - meth (Ethereum): mETH Staking.stake with native ETH, then unstakeRequest of everything minted.
 * - aera (Base): gtUSDa ProvisionerV2 requestDeposit (async), then refundRequest after the deadline.
 * Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { FALCON, METH, AERA } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const GAS = { gasLimit: 1_500_000n };
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const VAULT_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
];
const METH_STAKING_ABI = [
  "function stake(uint256 minMETHAmount) payable",
  "function unstakeRequest(uint128 methAmount, uint128 minETHAmount) returns (uint256)",
  "function ethToMETH(uint256) view returns (uint256)",
  "function mETHToETH(uint256) view returns (uint256)",
  "function minimumStakeBound() view returns (uint256)",
  "function minimumUnstakeBound() view returns (uint256)",
  "function isStakingAllowlist() view returns (bool)",
  "function pauser() view returns (address)",
  "function mETH() view returns (address)",
  "function unstakeRequestsManager() view returns (address)",
  "event UnstakeRequested(uint256 indexed id, address indexed staker, uint256 ethAmount, uint256 mETHLocked)",
];
const METH_PAUSER_ABI = [
  "function isStakingPaused() view returns (bool)",
  "function isUnstakeRequestsAndClaimsPaused() view returns (bool)",
];
const REQUEST = "tuple(uint8 requestType, address user, address receiver, uint256 units, uint256 tokens, uint256 solverTip, uint256 deadline, uint256 maxPriceAge)";
const PROVISIONER_ABI = [
  "function requestDeposit(address token, uint256 tokensIn, uint256 minUnitsOut, uint256 solverTip, uint256 deadline, uint256 maxPriceAge, bool isFixedPrice) returns (bytes32)",
  `function refundRequest(address token, ${REQUEST} request)`,
  `function getRequestHash(address token, ${REQUEST} request) view returns (bytes32)`,
  "function asyncRequestHashes(bytes32) view returns (bool)",
  "function tokensDetails(address) view returns (bool asyncDepositEnabled, bool asyncRedeemEnabled, bool syncDepositEnabled, bool syncRedeemEnabled)",
];
const AERA_VAULT_ABI = [
  ...ERC,
  "function provisioner() view returns (address)",
  "function feeCalculator() view returns (address)",
];
const CALC_ABI = [
  "function convertTokenToUnits(address vault, address token, uint256 tokenAmount) view returns (uint256)",
  "function isVaultPaused(address vault) view returns (bool)",
];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  const reason = err.reason || (err.revert && err.revert.args && err.revert.args.join(" "));
  return `${reason || err.shortMessage || err.message || err} ${data}`.trim();
}

function within(a, b, tolerance) {
  return (a > b ? a - b : b - a) <= tolerance;
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

/**
 * sUSDf round trip. Pre-checks: asset() is the documented USDf and maxDeposit covers the amount.
 * sUSDf vests yield per second, so the share and asset checks against the pre-tx previews are within 1 bp,
 * while the event and balance checks are exact.
 */
async function falconStake(base) {
  const spec = FALCON;
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.vault, VAULT_ABI, provider);
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || spec.defaultAmount, spec.decimals);
  const asset = await reader.asset();
  if (asset.toLowerCase() !== spec.usdf.toLowerCase()) {
    return finish({ ...base, ok: false, error: `sUSDf asset() is ${asset}, not the documented USDf ${spec.usdf}` });
  }
  const max = await reader.maxDeposit(ethers.Wallet.createRandom().address);
  if (max < amount) {
    return finish({ ...base, ok: false, error: `sUSDf maxDeposit ${formatUnits(max, 18)} is below ${formatUnits(amount, 18)}` });
  }
  const signer = await impersonateFunded(base.chain, spec.symbol, spec.usdf, amount);
  const user = await signer.getAddress();
  const usdf = new ethers.Contract(spec.usdf, ERC, signer);
  const vault = new ethers.Contract(spec.vault, VAULT_ABI, signer);
  await (await usdf.approve(spec.vault, amount)).wait();
  const usdfBefore = await usdf.balanceOf(user);
  const vaultUsdfBefore = await usdf.balanceOf(spec.vault);
  const preview = await reader.previewDeposit(amount);
  const depositReceipt = await (await vault.deposit(amount, user, GAS)).wait();
  const usdfMid = await usdf.balanceOf(user);
  const vaultUsdfMid = await usdf.balanceOf(spec.vault);
  const shares = await reader.balanceOf(user);
  const [dep] = eventArgs(depositReceipt, reader.interface, "Deposit", spec.vault);
  const depositOk =
    usdfBefore - usdfMid === amount &&
    vaultUsdfMid - vaultUsdfBefore === amount &&
    shares > 0n &&
    !!dep &&
    dep.assets === amount &&
    dep.shares === shares &&
    within(shares, preview, preview / 10_000n);
  const redeemPreview = await reader.previewRedeem(shares);
  const redeemReceipt = await (await vault.redeem(shares, user, user, GAS)).wait();
  const usdfAfter = await usdf.balanceOf(user);
  const sharesAfter = await reader.balanceOf(user);
  const got = usdfAfter - usdfMid;
  const [wd] = eventArgs(redeemReceipt, reader.interface, "Withdraw", spec.vault);
  const redeemOk =
    sharesAfter === 0n &&
    !!wd &&
    wd.assets === got &&
    wd.shares === shares &&
    within(got, redeemPreview, redeemPreview / 10_000n) &&
    within(got, amount, amount / 10_000n);
  const ok = depositOk && redeemOk;
  return finish({
    ...base,
    ok,
    key: `sUSDf=0->${formatUnits(shares, 18)}->${formatUnits(sharesAfter, 18)} USDf=${formatUnits(usdfBefore, 18)}->${formatUnits(usdfMid, 18)}->${formatUnits(usdfAfter, 18)}`,
    detail: `staked ${formatUnits(amount, 18)} USDf into sUSDf\nshares ${formatUnits(shares, 18)} (pre-tx previewDeposit ${formatUnits(preview, 18)}), Deposit event assets ${dep ? formatUnits(dep.assets, 18) : "-"}\nredeemed every share for ${formatUnits(got, 18)} USDf (pre-tx previewRedeem ${formatUnits(redeemPreview, 18)})\ntx ${redeemReceipt.hash}`,
    error: ok ? null : `Falcon sUSDf round trip failed: deposit=${depositOk} redeem=${redeemOk}`,
  });
}

/**
 * mETH stake + unstake request. Pre-checks: the documented Staking wiring, staking not paused,
 * no allowlist, amount above minimumStakeBound. Asserts exact mint at ethToMETH, the Staking contract
 * holds the ETH, and unstakeRequest locks every mETH in the UnstakeRequestsManager with an
 * UnstakeRequested event whose ethAmount equals the pre-tx mETHToETH. Finalisation is not waited out.
 */
async function methStake(base) {
  const spec = METH;
  const provider = getProvider(base.chain);
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const reader = new ethers.Contract(spec.staking, METH_STAKING_ABI, provider);
  const [methAddr, manager, pauserAddr, allowlist, minStake] = await Promise.all([
    reader.mETH(),
    reader.unstakeRequestsManager(),
    reader.pauser(),
    reader.isStakingAllowlist(),
    reader.minimumStakeBound(),
  ]);
  if (methAddr.toLowerCase() !== spec.meth.toLowerCase() || manager.toLowerCase() !== spec.unstakeRequestsManager.toLowerCase()) {
    return finish({ ...base, ok: false, error: `Staking wiring differs from docs: mETH ${methAddr}, manager ${manager}` });
  }
  const pauser = new ethers.Contract(pauserAddr, METH_PAUSER_ABI, provider);
  if (await pauser.isStakingPaused()) return finish({ ...base, ok: false, error: "mETH staking is paused" });
  if (await pauser.isUnstakeRequestsAndClaimsPaused()) return finish({ ...base, ok: false, error: "mETH unstake requests are paused" });
  if (allowlist) return finish({ ...base, ok: false, error: "mETH staking allowlist is on" });
  if (value < minStake) return finish({ ...base, ok: false, error: `amount below minimumStakeBound ${formatUnits(minStake, 18)}` });

  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const staking = new ethers.Contract(spec.staking, METH_STAKING_ABI, signer);
  const meth = new ethers.Contract(spec.meth, ERC, signer);
  const expected = await reader.ethToMETH(value);
  const ethBefore = await provider.getBalance(spec.staking);
  const stakeReceipt = await (await staking.stake(expected, { value, ...GAS })).wait();
  const minted = await meth.balanceOf(user);
  const ethAfter = await provider.getBalance(spec.staking, stakeReceipt.blockNumber);
  const stakeOk = minted === expected && minted > 0n && ethAfter - ethBefore === value;

  const ethOwed = await reader.mETHToETH(minted);
  await (await meth.approve(spec.staking, minted)).wait();
  const managerBefore = await meth.balanceOf(spec.unstakeRequestsManager);
  const minEth = (ethOwed * 999n) / 1000n;
  const requestReceipt = await (await staking.unstakeRequest(minted, minEth, GAS)).wait();
  const [req] = eventArgs(requestReceipt, reader.interface, "UnstakeRequested", spec.staking);
  const methLeft = await meth.balanceOf(user);
  const managerAfter = await meth.balanceOf(spec.unstakeRequestsManager);
  const requestOk =
    !!req &&
    req.staker.toLowerCase() === user.toLowerCase() &&
    req.mETHLocked === minted &&
    req.ethAmount === ethOwed &&
    methLeft === 0n &&
    managerAfter - managerBefore === minted;
  const ok = stakeOk && requestOk;
  return finish({
    ...base,
    ok,
    key: `mETH=0->${formatUnits(minted, 18)}->${formatUnits(methLeft, 18)} expected=${formatUnits(expected, 18)} request=${req ? req.id : "-"} ethOwed=${formatUnits(ethOwed, 18)}`,
    detail: `staked ${formatUnits(value, 18)} ETH, minted ${formatUnits(minted, 18)} mETH (pre-tx ethToMETH ${formatUnits(expected, 18)})\nStaking ETH ${formatUnits(ethBefore, 18)} -> ${formatUnits(ethAfter, 18)}\nunstakeRequest #${req ? req.id : "-"}: ${req ? formatUnits(req.mETHLocked, 18) : "-"} mETH locked in the UnstakeRequestsManager for ${req ? formatUnits(req.ethAmount, 18) : "-"} ETH (pre-tx mETHToETH ${formatUnits(ethOwed, 18)})\nFinalisation and claim are not waited out.\ntx ${requestReceipt.hash}`,
    error: ok ? null : `mETH stake/unstake failed: stake=${stakeOk} request=${requestOk}`,
  });
}

/**
 * Aera gtUSDa (Base) async deposit request, then refund after the deadline. Pre-checks: the vault's
 * provisioner() and feeCalculator() are the documented ones, async USDC deposits are enabled and the
 * vault is not paused. Asserts the Provisioner holds exactly the USDC, the stored request hash equals
 * getRequestHash of the request, and refundRequest after the deadline returns exactly the USDC and
 * clears the hash. Solving happens off this machine (Aera's solver), so no units are expected.
 */
async function aeraRequest(base) {
  const spec = AERA;
  const provider = getProvider(base.chain);
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const vaultReader = new ethers.Contract(spec.vault, AERA_VAULT_ABI, provider);
  const [prov, calc] = await Promise.all([vaultReader.provisioner(), vaultReader.feeCalculator()]);
  if (prov.toLowerCase() !== spec.provisioner.toLowerCase() || calc.toLowerCase() !== spec.calculator.toLowerCase()) {
    return finish({ ...base, ok: false, error: `gtUSDa wiring changed: provisioner ${prov}, feeCalculator ${calc}` });
  }
  const calculator = new ethers.Contract(spec.calculator, CALC_ABI, provider);
  const provReader = new ethers.Contract(spec.provisioner, PROVISIONER_ABI, provider);
  const details = await provReader.tokensDetails(spec.usdc);
  if (!details.asyncDepositEnabled) return finish({ ...base, ok: false, error: "gtUSDa async USDC deposits are disabled" });
  if (await calculator.isVaultPaused(spec.vault)) return finish({ ...base, ok: false, error: "gtUSDa is paused in the PriceAndFeeCalculator" });

  const signer = await impersonateFunded(base.chain, "USDC", spec.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(spec.usdc, ERC, signer);
  const provisioner = new ethers.Contract(spec.provisioner, PROVISIONER_ABI, signer);
  await (await usdc.approve(spec.provisioner, amount)).wait();
  const units = await calculator.convertTokenToUnits(spec.vault, spec.usdc, amount);
  const minUnitsOut = (units * 97n) / 100n;
  const now = (await provider.getBlock("latest")).timestamp;
  const deadline = BigInt(now) + 3600n;
  const maxPriceAge = 3600n;
  const userBefore = await usdc.balanceOf(user);
  const provBefore = await usdc.balanceOf(spec.provisioner);
  await (await provisioner.requestDeposit(spec.usdc, amount, minUnitsOut, 0n, deadline, maxPriceAge, false, GAS)).wait();
  const userMid = await usdc.balanceOf(user);
  const provMid = await usdc.balanceOf(spec.provisioner);
  const request = { requestType: 0, user, receiver: user, units: minUnitsOut, tokens: amount, solverTip: 0n, deadline, maxPriceAge };
  const hash = await provReader.getRequestHash(spec.usdc, request);
  const stored = await provReader.asyncRequestHashes(hash);
  const requestOk = userBefore - userMid === amount && provMid - provBefore === amount && stored;

  await provider.send("evm_increaseTime", [3601]);
  await provider.send("evm_mine", []);
  const refundReceipt = await (await provisioner.refundRequest(spec.usdc, request, GAS)).wait();
  const userAfter = await usdc.balanceOf(user);
  const provAfter = await usdc.balanceOf(spec.provisioner);
  const cleared = !(await provReader.asyncRequestHashes(hash));
  const unitsHeld = await vaultReader.balanceOf(user);
  const refundOk = userAfter - userMid === amount && provMid - provAfter === amount && cleared && unitsHeld === 0n;
  const ok = requestOk && refundOk;
  return finish({
    ...base,
    ok,
    key: `USDC=${formatUnits(userBefore, 6)}->${formatUnits(userMid, 6)}->${formatUnits(userAfter, 6)} request=${hash.slice(0, 10)} stored=${stored} cleared=${cleared}`,
    detail: `requestDeposit ${formatUnits(amount, 6)} USDC into gtUSDa, minUnitsOut ${formatUnits(minUnitsOut, 18)} (97% of convertTokenToUnits ${formatUnits(units, 18)})\nProvisioner USDC ${formatUnits(provBefore, 6)} -> ${formatUnits(provMid, 6)}, request hash ${hash} stored=${stored}\nrefundRequest after the deadline: USDC back ${formatUnits(userAfter - userMid, 6)}, hash cleared=${cleared}, gtUSDa units held ${formatUnits(unitsHeld, 18)}\ntx ${refundReceipt.hash}`,
    error: ok ? null : `Aera gtUSDa request/refund failed: request=${requestOk} refund=${refundOk}`,
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
    if (protocol === "falcon") return await falconStake(base);
    if (protocol === "meth") return await methStake(base);
    if (protocol === "aera") return await aeraRequest(base);
    return finish({ ...base, ok: false, error: `Unknown entry action ${protocol}:${action}` });
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
