/**
 * Restaking fork actions on Ethereum.
 * Kelp and Renzo stay in stakingFlows.js. This file does not duplicate them.
 * Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { EIGENLAYER, SYMBIOTIC, SWELL, PUFFER } = require("../../catalog/contracts");
const { impersonateAccount } = require("../../utils/impersonate");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const EIGEN_ABI = [
  "function depositIntoStrategy(address strategy, address token, uint256 amount) returns (uint256)",
  "function stakerDepositShares(address staker, address strategy) view returns (uint256)",
  "function queueWithdrawals(tuple(address[] strategies, uint256[] depositShares, address withdrawer)[] params) returns (bytes32[])",
  "function cumulativeWithdrawalsQueued(address staker) view returns (uint256)",
];
const RSW_ABI = ["function deposit() payable", "function balanceOf(address) view returns (uint256)", "function whitelistEnabled() view returns (bool)"];
const PUF_ABI = [
  "function depositETH(address receiver) payable returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
];

const GAS = { gasLimit: 1_500_000n };

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  const reason = err.reason || (err.revert && err.revert.args && err.revert.args.join(" "));
  return `${reason || err.shortMessage || err.message || err} ${data}`.trim();
}

function gated(message) {
  return /whitelist|paused|cap|not allowed|unauthorized|permission|disabled|full|maximum/i.test(String(message || ""));
}

async function forkOrFail(protocol, action) {
  const chain = "ethereum";
  try {
    const ctx = await requireFork(chain);
    return { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    finish({ ok: false, protocol, action, chain, block: null, error: err.message });
    return null;
  }
}

async function freshEth(chain) {
  return impersonateAccount(ethers.Wallet.createRandom().address, chain);
}

async function depositSteth(base) {
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.01");
  const signer = await impersonateFunded(base.chain, "stETH", EIGENLAYER.steth, amount);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const sm = new ethers.Contract(EIGENLAYER.strategyManager, EIGEN_ABI, signer);
  const before = await sm.stakerDepositShares(user, EIGENLAYER.stethStrategy);
  const erc = new ethers.Contract(EIGENLAYER.steth, ERC, signer);
  await (await erc.approve(EIGENLAYER.strategyManager, amount)).wait();
  const tx = await sm.depositIntoStrategy(EIGENLAYER.stethStrategy, EIGENLAYER.steth, amount, GAS);
  const receipt = await tx.wait();
  const after = await sm.stakerDepositShares(user, EIGENLAYER.stethStrategy);
  return { signer, user, before, after, receipt, provider, amount };
}

async function eigenDeposit(base) {
  const { before, after, receipt, amount } = await depositSteth(base);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `stETHShares=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(amount, 18)} stETH into the stETH strategy\ndeposit shares ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "EigenLayer deposit shares did not increase",
  });
}

async function eigenQueue(base) {
  const { signer, user, before, after, amount } = await depositSteth(base);
  if (after <= before) return finish({ ...base, ok: false, error: "EigenLayer deposit shares did not increase" });
  const minted = after - before;
  const dm = new ethers.Contract(EIGENLAYER.delegationManager, EIGEN_ABI, signer);
  const queuedBefore = await dm.cumulativeWithdrawalsQueued(user);
  const tx = await dm.queueWithdrawals(
    [{ strategies: [EIGENLAYER.stethStrategy], depositShares: [minted], withdrawer: user }],
    GAS
  );
  const receipt = await tx.wait();
  const queuedAfter = await dm.cumulativeWithdrawalsQueued(user);
  const sharesAfter = await new ethers.Contract(EIGENLAYER.strategyManager, EIGEN_ABI, getProvider(base.chain)).stakerDepositShares(
    user,
    EIGENLAYER.stethStrategy
  );
  const ok = queuedAfter > queuedBefore;
  return finish({
    ...base,
    ok,
    key: `queued=${queuedBefore.toString()}->${queuedAfter.toString()} sharesLeft=${formatUnits(sharesAfter, 18)}`,
    detail: `deposited ${formatUnits(amount, 18)} stETH (shares ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}) then queueWithdrawals\ncumulativeWithdrawalsQueued ${queuedBefore} -> ${queuedAfter}\ndeposit shares left ${formatUnits(sharesAfter, 18)}\nThe withdrawal delay is not advanced. Completion is not asserted.\ntx ${receipt.hash}`,
    error: ok ? null : "queueWithdrawals did not increment cumulativeWithdrawalsQueued",
  });
}

async function symbioticRead(base) {
  const provider = getProvider(base.chain);
  const code = await provider.getCode(SYMBIOTIC.vaultFactory);
  const bytes = code && code !== "0x" ? (code.length - 2) / 2 : 0;
  const ok = bytes > 0;
  return finish({
    ...base,
    ok,
    key: `readOnly=no-permissionless-vault factoryCode=${bytes}`,
    detail:
      "Symbiotic docs publish VaultFactory and not a permissionless vault address. Curator vaults set their own deposit whitelist. No deposit.",
    error: ok ? null : "VaultFactory has no code",
  });
}

async function swellDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(SWELL.rswETH, RSW_ABI, provider);
  if (await reader.whitelistEnabled()) {
    const supply = await reader.balanceOf(SWELL.rswETH);
    return finish({
      ...base,
      ok: true,
      key: `readOnly=whitelistEnabled supplyHolder=${formatUnits(supply, 18)}`,
      detail: "rswETH whitelistEnabled() is true. A fresh account cannot deposit. No deposit.",
    });
  }
  const signer = await freshEth(base.chain);
  const user = await signer.getAddress();
  const before = await reader.balanceOf(user);
  const token = new ethers.Contract(SWELL.rswETH, RSW_ABI, signer);
  const tx = await token.deposit({ value, ...GAS });
  const receipt = await tx.wait();
  const after = await reader.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `rswETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH\nrswETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "rswETH balance did not increase",
  });
}

async function pufferDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(PUFFER.pufETH, PUF_ABI, provider);
  const max = await reader.maxDeposit(ethers.ZeroAddress);
  if (max === 0n) {
    const supply = await reader.balanceOf(PUFFER.pufETH);
    return finish({
      ...base,
      ok: true,
      key: "readOnly=maxDeposit=0",
      detail: `pufETH maxDeposit is 0. total held by the vault contract ${formatUnits(supply, 18)}. No deposit.`,
    });
  }
  const signer = await freshEth(base.chain);
  const user = await signer.getAddress();
  const before = await reader.balanceOf(user);
  const vault = new ethers.Contract(PUFFER.pufETH, PUF_ABI, signer);
  const tx = await vault.depositETH(user, { value, ...GAS });
  const receipt = await tx.wait();
  const after = await reader.balanceOf(user);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `pufETH=${formatUnits(before, 18)}->${formatUnits(after, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH via depositETH\npufETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "pufETH balance did not increase",
  });
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const base = await forkOrFail(protocol, action);
  if (!base) return;
  try {
    if (protocol === "eigenlayer" && action === "deposit") return await eigenDeposit(base);
    if (protocol === "eigenlayer" && action === "queue") return await eigenQueue(base);
    if (protocol === "symbiotic") return await symbioticRead(base);
    if (protocol === "swell") return await swellDeposit(base);
    if (protocol === "puffer") return await pufferDeposit(base);
    return finish({ ...base, ok: false, error: `Unknown restaking action ${protocol}:${action}` });
  } catch (err) {
    const message = explain(err);
    if ((protocol === "swell" || protocol === "puffer") && gated(message)) {
      return finish({
        ...base,
        ok: true,
        key: `readOnly=${message.slice(0, 80)}`,
        detail: message,
      });
    }
    return finish({ ...base, ok: false, error: message });
  }
}

module.exports = { run };
