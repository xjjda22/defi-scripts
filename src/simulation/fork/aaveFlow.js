/**
 * Aave V3 supply / borrow / repay / withdraw on a fork.
 * SparkLend uses the same Pool ABI at SPARK_POOL.
 * Pool address for Aave comes from src/config/chains.js.
 * Spark pool: https://docs.spark.fi/dev/sparklend/core-contracts/pool
 */

const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { SPARK_POOL } = require("../../catalog/contracts");
const AaveV3PoolABI = require("../../abis/aave/AaveV3Pool.json");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const POOL_ABI = [
  ...AaveV3PoolABI,
  "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)",
  "function withdraw(address asset,uint256 amount,address to) returns (uint256)",
  "function borrow(address asset,uint256 amount,uint256 interestRateMode,uint16 referralCode,address onBehalfOf)",
  "function repay(address asset,uint256 amount,uint256 interestRateMode,address onBehalfOf) returns (uint256)",
  "function setUserUseReserveAsCollateral(address asset,bool useAsCollateral)",
];

const VARIABLE = 2n;

function poolAddress(chain, protocol) {
  if (protocol === "spark") return SPARK_POOL;
  return CHAINS[chain]?.aave?.v3?.pool || null;
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "aave";
  const action = process.env.FORK_ACTION || "supply";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const poolAddr = poolAddress(chain, protocol);
  const usdc = COMMON_TOKENS.USDC?.[chain];
  const weth = COMMON_TOKENS.WETH?.[chain];
  if (!poolAddr || !usdc || !weth) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `Missing ${protocol} pool or USDC/WETH on ${chain}`,
    });
  }

  const provider = getProvider(chain);
  const poolRead = new ethers.Contract(poolAddr, POOL_ABI, provider);
  let reserve;
  try {
    reserve = await poolRead.getReserveData(usdc);
  } catch (err) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `getReserveData(USDC) failed: ${err.shortMessage || err.message}`,
    });
  }

  try {
    if (action === "supply") return await supplyUsdc({ chain, protocol, action, ctx, poolAddr, usdc, reserve, provider });
    if (action === "withdraw") return await withdrawUsdc({ chain, protocol, action, ctx, poolAddr, usdc, reserve, provider });
    if (action === "borrow") return await borrowUsdc({ chain, protocol, action, ctx, poolAddr, usdc, weth, provider });
    if (action === "repay") return await repayUsdc({ chain, protocol, action, ctx, poolAddr, usdc, weth });
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: `Unknown action ${action}` });
  } catch (err) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: err.shortMessage || err.message,
    });
  }
}

async function supplyUsdc({ chain, protocol, action, ctx, poolAddr, usdc, reserve, provider }) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 6);
  const signer = await impersonateFunded(chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const aToken = new ethers.Contract(reserve.aTokenAddress, ["function balanceOf(address) view returns (uint256)"], provider);
  const before = await aToken.balanceOf(user);
  const token = new ethers.Contract(usdc, ["function approve(address,uint256) returns (bool)"], signer);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
  await (await token.approve(poolAddr, amount)).wait();
  const tx = await pool.supply(usdc, amount, user, 0);
  const receipt = await tx.wait();
  const after = await aToken.balanceOf(user);
  const ok = after > before;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `aToken=${formatUnits(before, 6)}->${formatUnits(after, 6)}`,
    detail: `supplied ${formatUnits(amount, 6)} USDC\naToken ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "aToken balance did not increase",
  });
}

async function withdrawUsdc({ chain, protocol, action, ctx, poolAddr, usdc, reserve, provider }) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 6);
  const signer = await impersonateFunded(chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const token = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
  const beforeWallet = await token.balanceOf(user);
  await (await token.approve(poolAddr, amount)).wait();
  await (await pool.supply(usdc, amount, user, 0)).wait();
  const aToken = new ethers.Contract(reserve.aTokenAddress, ["function balanceOf(address) view returns (uint256)"], provider);
  const aBefore = await aToken.balanceOf(user);
  const tx = await pool.withdraw(usdc, aBefore, user);
  const receipt = await tx.wait();
  const aAfter = await aToken.balanceOf(user);
  const afterWallet = await token.balanceOf(user);
  const ok = aAfter < aBefore && afterWallet + amount / 100n >= beforeWallet;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `aToken=${formatUnits(aBefore, 6)}->${formatUnits(aAfter, 6)}`,
    detail: `withdrew aToken ${formatUnits(aBefore, 6)} -> ${formatUnits(aAfter, 6)}\nUSDC wallet ${formatUnits(beforeWallet, 6)} -> ${formatUnits(afterWallet, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "withdraw did not return USDC",
  });
}

async function borrowUsdc({ chain, protocol, action, ctx, poolAddr, usdc, weth, provider }) {
  const collateral = ethers.parseEther(process.env.FORK_COLLATERAL || "1");
  const borrow = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(chain, "WETH", weth, collateral);
  const user = await signer.getAddress();
  const wethToken = new ethers.Contract(weth, ["function approve(address,uint256) returns (bool)"], signer);
  const usdcToken = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)"], provider);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
  const before = await usdcToken.balanceOf(user);
  const debtBefore = (await pool.getUserAccountData(user)).totalDebtBase;
  await (await wethToken.approve(poolAddr, collateral)).wait();
  await (await pool.supply(weth, collateral, user, 0)).wait();
  try {
    await (await pool.setUserUseReserveAsCollateral(weth, true)).wait();
  } catch {
    // first supply is already collateral on Aave V3
  }
  const tx = await pool.borrow(usdc, borrow, VARIABLE, 0, user);
  const receipt = await tx.wait();
  const after = await usdcToken.balanceOf(user);
  const debtAfter = (await pool.getUserAccountData(user)).totalDebtBase;
  const ok = after > before && debtAfter > debtBefore;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `usdc=${formatUnits(before, 6)}->${formatUnits(after, 6)} debtBase=${debtBefore}->${debtAfter}`,
    detail: `collateral 1 WETH\nborrowed ${formatUnits(borrow, 6)} USDC\nUSDC ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\ndebtBase ${debtBefore} -> ${debtAfter}\ntx ${receipt.hash}`,
    error: ok ? null : "borrow did not increase USDC and debt",
  });
}

async function repayUsdc({ chain, protocol, action, ctx, poolAddr, usdc, weth }) {
  const collateral = ethers.parseEther("1");
  const borrow = ethers.parseUnits("100", 6);
  const signer = await impersonateFunded(chain, "WETH", weth, collateral);
  const user = await signer.getAddress();
  const wethToken = new ethers.Contract(weth, ["function approve(address,uint256) returns (bool)"], signer);
  const usdcToken = new ethers.Contract(usdc, ["function approve(address,uint256) returns (bool)"], signer);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer);
  await (await wethToken.approve(poolAddr, collateral)).wait();
  await (await pool.supply(weth, collateral, user, 0)).wait();
  try {
    await (await pool.setUserUseReserveAsCollateral(weth, true)).wait();
  } catch {
    // already enabled
  }
  await (await pool.borrow(usdc, borrow, VARIABLE, 0, user)).wait();
  const debtBefore = (await pool.getUserAccountData(user)).totalDebtBase;
  await (await usdcToken.approve(poolAddr, borrow * 2n)).wait();
  const tx = await pool.repay(usdc, ethers.MaxUint256, VARIABLE, user);
  const receipt = await tx.wait();
  const debtAfter = (await pool.getUserAccountData(user)).totalDebtBase;
  const ok = debtAfter < debtBefore;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `debtBase=${debtBefore}->${debtAfter}`,
    detail: `repaid variable USDC\ndebtBase ${debtBefore} -> ${debtAfter}\ntx ${receipt.hash}`,
    error: ok ? null : "debt did not fall",
  });
}

module.exports = { run };
