/**
 * Liquid staking and restaking fork actions on Ethereum.
 * Addresses and doc links live in src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { ROCKET_DEPOSIT_POOL, CBETH, ETHERFI, KELP, RENZO } = require("../../catalog/contracts");
const { requireFork, formatUnits, finish, unavailable } = require("./runtime");

const STETH_ABI = [
  "function submit(address referral) payable returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const WSTETH_ABI = [
  "function wrap(uint256) returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const ROCKET_ABI = [
  "function deposit() payable",
  "function getMaximumDepositAmount() view returns (uint256)",
];
const RETH_ABI = ["function balanceOf(address) view returns (uint256)"];
const CBETH_ABI = ["function exchangeRate() view returns (uint256)", "function getExchangeRate() view returns (uint256)"];
const ETHERFI_POOL_ABI = ["function deposit() payable returns (uint256)", "function deposit(address referral) payable returns (uint256)"];
const EETH_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
const WEETH_ABI = ["function wrap(uint256) returns (uint256)", "function balanceOf(address) view returns (uint256)"];
const KELP_ABI = ["function depositETH(uint256 minRSETHAmountExpected, string referralId) payable"];
const RSETH_ABI = ["function balanceOf(address) view returns (uint256)"];
const RENZO_ABI = ["function depositETH() payable", "function depositETH(uint256 minOut, address referral) payable"];
const EZETH_ABI = ["function balanceOf(address) view returns (uint256)"];

async function fundedSigner(chain) {
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
  return signer;
}

function skipOrFail(err, base) {
  const message = err.shortMessage || err.message || String(err);
  return finish({
    ...base,
    skipped: unavailable(message),
    ok: false,
    error: message,
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
  if (chain !== "ethereum") {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: "Staking fork tests are Ethereum-only" });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    if (protocol === "lido" && action === "submit") return await lidoSubmit(base);
    if (protocol === "lido" && action === "wrap") return await lidoWrap(base);
    if (protocol === "rocketpool") return await rocketDeposit(base);
    if (protocol === "cbeth") return await cbethRate(base);
    if (protocol === "etherfi" && action === "deposit") return await etherfiDeposit(base);
    if (protocol === "etherfi" && action === "wrap") return await etherfiWrap(base);
    if (protocol === "kelp") return await kelpDeposit(base);
    if (protocol === "renzo") return await renzoDeposit(base);
    return finish({ ...base, ok: false, error: `Unknown staking action ${protocol}:${action}` });
  } catch (err) {
    return skipOrFail(err, base);
  }
}

async function lidoSubmit(base) {
  const value = BigInt(process.env.LIDO_SUBMIT_WEI || "10000000000000000");
  const stAddr = COMMON_TOKENS.stETH.ethereum;
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const steth = new ethers.Contract(stAddr, STETH_ABI, signer);
  const before = await steth.balanceOf(user);
  const tx = await steth.submit(ethers.ZeroAddress, { value });
  const receipt = await tx.wait();
  const after = await steth.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `stETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `submitted ${formatUnits(value, 18)} ETH\nstETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "stETH balance did not increase",
  });
}

async function lidoWrap(base) {
  const value = BigInt(process.env.LIDO_SUBMIT_WEI || "10000000000000000");
  const stAddr = COMMON_TOKENS.stETH.ethereum;
  const wstAddr = COMMON_TOKENS.wstETH.ethereum;
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const steth = new ethers.Contract(stAddr, [...STETH_ABI, "function approve(address,uint256) returns (bool)"], signer);
  const wst = new ethers.Contract(wstAddr, WSTETH_ABI, signer);
  await (await steth.submit(ethers.ZeroAddress, { value })).wait();
  const stBal = await steth.balanceOf(user);
  const before = await wst.balanceOf(user);
  await (await steth.approve(wstAddr, stBal)).wait();
  const tx = await wst.wrap(stBal);
  const receipt = await tx.wait();
  const after = await wst.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `wstETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `wrapped ${formatUnits(stBal, 18)} stETH\nwstETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "wstETH balance did not increase",
  });
}

async function rocketDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const provider = getProvider(base.chain);
  const poolRead = new ethers.Contract(ROCKET_DEPOSIT_POOL, ROCKET_ABI, provider);
  let cap = null;
  try {
    cap = await poolRead.getMaximumDepositAmount();
  } catch {
    cap = null;
  }
  if (cap != null && cap < value) {
    return finish({
      ...base,
      skipped: true,
      ok: false,
      error: `Rocket deposit pool cap is ${formatUnits(cap, 18)} ETH, below ${formatUnits(value, 18)}`,
    });
  }
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const reth = new ethers.Contract(COMMON_TOKENS.rETH.ethereum, RETH_ABI, provider);
  const before = await reth.balanceOf(user);
  const pool = new ethers.Contract(ROCKET_DEPOSIT_POOL, ROCKET_ABI, signer);
  const tx = await pool.deposit({ value });
  const receipt = await tx.wait();
  const after = await reth.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `rETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH\nrETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "rETH balance did not increase",
  });
}

async function cbethRate(base) {
  const provider = getProvider(base.chain);
  const token = new ethers.Contract(CBETH, CBETH_ABI, provider);
  let rate;
  try {
    rate = await token.exchangeRate();
  } catch {
    rate = await token.getExchangeRate();
  }
  const ok = rate > ethers.parseEther("1");
  return finish({
    ...base,
    ok,
    key: `exchangeRate=${formatUnits(rate, 18)}`,
    detail: `cbETH exchangeRate ${formatUnits(rate, 18)} (ETH per cbETH). No public mint path.`,
    error: ok ? null : "exchangeRate was not above 1",
  });
}

async function etherfiDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const eeth = new ethers.Contract(ETHERFI.eETH, EETH_ABI, provider);
  const before = await eeth.balanceOf(user);
  const pool = new ethers.Contract(ETHERFI.liquidityPool, ETHERFI_POOL_ABI, signer);
  let tx;
  try {
    tx = await pool["deposit()"]({ value });
  } catch (err) {
    try {
      tx = await pool["deposit(address)"](ethers.ZeroAddress, { value });
    } catch (inner) {
      return skipOrFail(inner.shortMessage ? inner : err, base);
    }
  }
  const receipt = await tx.wait();
  const after = await eeth.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `eETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH\neETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "eETH balance did not increase",
  });
}

async function etherfiWrap(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const pool = new ethers.Contract(ETHERFI.liquidityPool, ETHERFI_POOL_ABI, signer);
  try {
    await (await pool["deposit()"]({ value })).wait();
  } catch {
    await (await pool["deposit(address)"](ethers.ZeroAddress, { value })).wait();
  }
  const eeth = new ethers.Contract(ETHERFI.eETH, EETH_ABI, signer);
  const weeth = new ethers.Contract(ETHERFI.weETH, WEETH_ABI, signer);
  const amount = await eeth.balanceOf(user);
  const before = await weeth.balanceOf(user);
  await (await eeth.approve(ETHERFI.weETH, amount)).wait();
  const tx = await weeth.wrap(amount);
  const receipt = await tx.wait();
  const after = await weeth.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `weETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `wrapped ${formatUnits(amount, 18)} eETH\nweETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "weETH balance did not increase",
  });
}

async function kelpDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const rs = new ethers.Contract(KELP.rsETH, RSETH_ABI, provider);
  const before = await rs.balanceOf(user);
  const pool = new ethers.Contract(KELP.depositPool, KELP_ABI, signer);
  const tx = await pool.depositETH(0, "", { value });
  const receipt = await tx.wait();
  const after = await rs.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `rsETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH\nrsETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "rsETH balance did not increase",
  });
}

async function renzoDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await fundedSigner(base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const ez = new ethers.Contract(RENZO.ezETH, EZETH_ABI, provider);
  const before = await ez.balanceOf(user);
  const manager = new ethers.Contract(RENZO.restakeManager, RENZO_ABI, signer);
  let tx;
  try {
    tx = await manager["depositETH()"]({ value });
  } catch (err) {
    try {
      tx = await manager["depositETH(uint256,address)"](0, ethers.ZeroAddress, { value });
    } catch (inner) {
      return skipOrFail(inner.shortMessage ? inner : err, base);
    }
  }
  const receipt = await tx.wait();
  const after = await ez.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `ezETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH\nezETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "ezETH balance did not increase",
  });
}

module.exports = { run };
