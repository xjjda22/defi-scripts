/**
 * Venus Core Pool on BSC (Compound V2-style Unitroller).
 * - venus:supply  mint vUSDC then redeem shares
 * - venus:borrow  mint vUSDC, enterMarkets, borrow USDC; assert debt + balance deltas
 * - venus:repay   borrow then repayBorrow; assert debt cleared
 * - venus:redeem  mint then redeemUnderlying; assert underlying returned
 *
 * Markets: https://docs-v4.venus.io/deployed-contracts/markets
 * Comptroller (Unitroller): 0xfD36E2c2a6789Db23113685031d7F16329158384
 * vUSDC: 0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { VENUS } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384";
const GAS = { gasLimit: 2_500_000n };
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const VTOKEN_ABI = [
  ...ERC,
  "function mint(uint256) returns (uint256)",
  "function redeem(uint256) returns (uint256)",
  "function redeemUnderlying(uint256) returns (uint256)",
  "function borrow(uint256) returns (uint256)",
  "function repayBorrow(uint256) returns (uint256)",
  "function underlying() view returns (address)",
  "function borrowBalanceStored(address) view returns (uint256)",
  "function borrowBalanceCurrent(address) returns (uint256)",
];
const COMPTROLLER_ABI = [
  "function enterMarkets(address[]) returns (uint256[])",
  "function checkMembership(address,address) view returns (bool)",
];

async function withBase() {
  const chain = "bsc";
  const protocol = process.env.FORK_PROTOCOL || "venus";
  const action = process.env.FORK_ACTION || "supply";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return { error: finish({ ok: false, protocol, action, chain, block: null, error: err.message }) };
  }
  return { chain, protocol, action, base: { protocol, action, chain, block: ctx.forkBlock } };
}

async function mintCollateral(signer, usdc, amount) {
  const user = await signer.getAddress();
  const asset = new ethers.Contract(usdc, ERC, signer);
  const vToken = new ethers.Contract(VENUS.vUSDC, VTOKEN_ABI, signer);
  const underlying = await vToken.underlying();
  if (underlying.toLowerCase() !== usdc.toLowerCase()) {
    throw new Error(`vUSDC underlying is ${underlying}, not ${usdc}`);
  }
  await (await asset.approve(VENUS.vUSDC, amount)).wait();
  const usdcBefore = await asset.balanceOf(user);
  await (await vToken.mint(amount, GAS)).wait();
  const shares = await vToken.balanceOf(user);
  const usdcMid = await asset.balanceOf(user);
  if (shares === 0n || usdcBefore - usdcMid !== amount) {
    throw new Error("Venus mint did not pull USDC / mint shares");
  }
  const comptroller = new ethers.Contract(COMPTROLLER, COMPTROLLER_ABI, signer);
  await (await comptroller.enterMarkets([VENUS.vUSDC], GAS)).wait();
  if (!(await comptroller.checkMembership(user, VENUS.vUSDC))) {
    throw new Error("enterMarkets did not list vUSDC for the account");
  }
  return { user, asset, vToken, shares, usdcMid };
}

async function supply(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const usdc = COMMON_TOKENS.USDC.bsc;
  const signer = await impersonateFunded(base.chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const asset = new ethers.Contract(usdc, ERC, provider);
  const vToken = new ethers.Contract(VENUS.vUSDC, VTOKEN_ABI, signer);
  const underlying = await vToken.underlying();
  if (underlying.toLowerCase() !== usdc.toLowerCase()) {
    return finish({ ...base, ok: false, error: `vUSDC underlying is ${underlying}, not ${usdc}` });
  }
  const usdcBefore = await asset.balanceOf(user);
  const sharesBefore = await vToken.balanceOf(user);
  await (await new ethers.Contract(usdc, ERC, signer).approve(VENUS.vUSDC, amount)).wait();
  const mintStatus = await (await vToken.mint(amount, GAS)).wait();
  const usdcMid = await asset.balanceOf(user);
  const shares = (await vToken.balanceOf(user)) - sharesBefore;
  if (shares === 0n) return finish({ ...base, ok: false, error: "vUSDC shares were not minted" });
  if (usdcBefore - usdcMid !== amount) {
    return finish({ ...base, ok: false, error: "Venus mint did not pull the USDC" });
  }
  await (await vToken.redeem(shares, GAS)).wait();
  const usdcAfter = await asset.balanceOf(user);
  const sharesAfter = await vToken.balanceOf(user);
  const dust = amount / 1000n + 2n;
  const ok = sharesAfter === sharesBefore && usdcAfter + dust >= usdcBefore && usdcAfter > usdcMid;
  return finish({
    ...base,
    ok,
    key: `vUSDC=0->${formatUnits(shares, 8)}->${formatUnits(sharesAfter - sharesBefore, 8)} USDC=${formatUnits(usdcBefore, 18)}->${formatUnits(usdcMid, 18)}->${formatUnits(usdcAfter, 18)}`,
    detail: `minted ${formatUnits(amount, 18)} USDC into Venus Core Pool vUSDC\nvUSDC shares ${formatUnits(shares, 8)}\nUSDC ${formatUnits(usdcBefore, 18)} -> ${formatUnits(usdcAfter, 18)}\nmint tx ${mintStatus.hash}`,
    error: ok ? null : "Venus supply/redeem round trip failed",
  });
}

async function borrow(base) {
  // Supply enough that CF 0.825 covers a small borrow of the same asset.
  const collateral = ethers.parseUnits(process.env.FORK_COLLATERAL || "1000", 18);
  const borrowAmt = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const usdc = COMMON_TOKENS.USDC.bsc;
  const signer = await impersonateFunded(base.chain, "USDC", usdc, collateral);
  const { user, asset, vToken } = await mintCollateral(signer, usdc, collateral);
  const debtBefore = await vToken.borrowBalanceStored(user);
  const balBefore = await asset.balanceOf(user);
  const code = await vToken.borrow.staticCall(borrowAmt, GAS);
  if (code !== 0n) return finish({ ...base, ok: false, error: `vUSDC.borrow staticCall returned ${code}` });
  const receipt = await (await vToken.borrow(borrowAmt, GAS)).wait();
  const debtAfter = await vToken.borrowBalanceStored(user);
  const balAfter = await asset.balanceOf(user);
  const ok = balAfter - balBefore === borrowAmt && debtAfter > debtBefore && debtAfter + 2n >= borrowAmt;
  return finish({
    ...base,
    ok,
    key: `borrowed=${formatUnits(borrowAmt, 18)} debt=${formatUnits(debtBefore, 18)}->${formatUnits(debtAfter, 18)} USDC=${formatUnits(balBefore, 18)}->${formatUnits(balAfter, 18)}`,
    detail: `minted ${formatUnits(collateral, 18)} USDC as collateral, enterMarkets(vUSDC), borrowed ${formatUnits(borrowAmt, 18)} USDC\ndebt ${formatUnits(debtBefore, 18)} -> ${formatUnits(debtAfter, 18)}\nUSDC ${formatUnits(balBefore, 18)} -> ${formatUnits(balAfter, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "Venus borrow did not increase debt by the borrowed USDC amount",
  });
}

async function repay(base) {
  const collateral = ethers.parseUnits(process.env.FORK_COLLATERAL || "1000", 18);
  const borrowAmt = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const usdc = COMMON_TOKENS.USDC.bsc;
  // Extra USDC covers interest accrual between borrow and repay.
  const signer = await impersonateFunded(base.chain, "USDC", usdc, collateral + borrowAmt / 10n + 1n);
  const { user, asset, vToken } = await mintCollateral(signer, usdc, collateral);
  await (await vToken.borrow(borrowAmt, GAS)).wait();
  const debtMid = await vToken.borrowBalanceCurrent.staticCall(user);
  // Approve a buffer and repay uint256.max so interest accrued between the read and the tx is covered.
  await (await asset.approve(VENUS.vUSDC, ethers.MaxUint256)).wait();
  const balBefore = await asset.balanceOf(user);
  const receipt = await (await vToken.repayBorrow(ethers.MaxUint256, GAS)).wait();
  const debtAfter = await vToken.borrowBalanceStored(user);
  const balAfter = await asset.balanceOf(user);
  const paid = balBefore - balAfter;
  const ok = debtAfter === 0n && paid + 2n >= debtMid;
  return finish({
    ...base,
    ok,
    key: `repaid=${formatUnits(paid, 18)} debt=${formatUnits(debtMid, 18)}->${formatUnits(debtAfter, 18)}`,
    detail: `borrowed then repayBorrow(${formatUnits(debtMid, 18)}): paid ${formatUnits(paid, 18)} USDC, debt left ${formatUnits(debtAfter, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "Venus repayBorrow did not clear the debt",
  });
}

async function redeem(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const usdc = COMMON_TOKENS.USDC.bsc;
  const signer = await impersonateFunded(base.chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const asset = new ethers.Contract(usdc, ERC, signer);
  const vToken = new ethers.Contract(VENUS.vUSDC, VTOKEN_ABI, signer);
  await (await asset.approve(VENUS.vUSDC, amount)).wait();
  await (await vToken.mint(amount, GAS)).wait();
  const shares = await vToken.balanceOf(user);
  const balMid = await asset.balanceOf(user);
  // redeemUnderlying of most of the deposited amount (leave dust for exchange-rate rounding)
  const redeemAmt = amount - amount / 1000n;
  const receipt = await (await vToken.redeemUnderlying(redeemAmt, GAS)).wait();
  const balAfter = await asset.balanceOf(user);
  const sharesAfter = await vToken.balanceOf(user);
  const got = balAfter - balMid;
  const ok = got === redeemAmt && sharesAfter < shares && sharesAfter >= 0n;
  return finish({
    ...base,
    ok,
    key: `redeemUnderlying=${formatUnits(redeemAmt, 18)} got=${formatUnits(got, 18)} shares=${formatUnits(shares, 8)}->${formatUnits(sharesAfter, 8)}`,
    detail: `minted ${formatUnits(amount, 18)} USDC, redeemUnderlying(${formatUnits(redeemAmt, 18)}): received ${formatUnits(got, 18)} USDC, shares ${formatUnits(shares, 8)} -> ${formatUnits(sharesAfter, 8)}\ntx ${receipt.hash}`,
    error: ok ? null : "Venus redeemUnderlying did not return the requested underlying",
  });
}

async function run() {
  const setup = await withBase();
  if (setup.error) return setup.error;
  const { base, action } = setup;
  try {
    if (action === "supply") return await supply(base);
    if (action === "borrow") return await borrow(base);
    if (action === "repay") return await repay(base);
    if (action === "redeem") return await redeem(base);
    return finish({ ...base, ok: false, error: `Unknown Venus action ${action}` });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
