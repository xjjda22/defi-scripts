/**
 * stake.link LINK staking on Ethereum through the Priority Pool. deposit(amount, true, []) stakes what
 * the Staking Pool can take right now (stLINK to the user) and queues the rest. The test asserts the
 * split against the Deposit event, the stLINK balance and the queue, then unqueues the queued part,
 * which a fresh account (not in the distribution merkle tree) can do without a proof.
 * Addresses and doc links: src/catalog/contracts.js (STAKE_LINK).
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { STAKE_LINK } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
const POOL_ABI = [
  "function token() view returns (address)",
  "function stakingPool() view returns (address)",
  "function poolStatus() view returns (uint8)",
  "function paused() view returns (bool)",
  "function totalQueued() view returns (uint256)",
  "function getQueuedTokens(address account, uint256 distributionAmount) view returns (uint256)",
  "function deposit(uint256 amount, bool shouldQueue, bytes[] data)",
  "function unqueueTokens(uint256 amountToUnqueue, uint256 amount, uint256 sharesAmount, bytes32[] merkleProof)",
  "event Deposit(address indexed account, uint256 instantAmount, uint256 queueAmount)",
  "event UnqueueTokens(address indexed account, uint256 amount)",
];
const GAS = { gasLimit: 3_000_000n };

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

function parsed(iface, receipt, address, name) {
  return receipt.logs
    .filter(log => log.address.toLowerCase() === address.toLowerCase())
    .map(log => {
      try {
        return iface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(item => item && item.name === name);
}

async function depositFlow(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(STAKE_LINK.priorityPool, POOL_ABI, provider);
  const token = await reader.token();
  const stakingPool = await reader.stakingPool();
  if (token.toLowerCase() !== STAKE_LINK.link.toLowerCase() || stakingPool.toLowerCase() !== STAKE_LINK.stakingPool.toLowerCase()) {
    return finish({ ...base, ok: false, error: `Priority Pool wiring changed: token ${token}, stakingPool ${stakingPool}` });
  }
  const status = Number(await reader.poolStatus());
  if (status !== 0) return finish({ ...base, ok: false, error: `Priority Pool poolStatus() is ${status} (0 = OPEN); deposit would revert` });
  if (await reader.paused()) return finish({ ...base, ok: false, error: "Priority Pool is paused; a queued deposit would revert" });

  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "10");
  const signer = await impersonateFunded(base.chain, "LINK", STAKE_LINK.link, amount);
  const user = await signer.getAddress();
  const link = new ethers.Contract(STAKE_LINK.link, ERC, signer);
  const stlink = new ethers.Contract(STAKE_LINK.stakingPool, ERC, provider);
  const pool = new ethers.Contract(STAKE_LINK.priorityPool, POOL_ABI, signer);

  const linkBefore = await link.balanceOf(user);
  const stBefore = await stlink.balanceOf(user);
  const queuedBefore = await reader.getQueuedTokens(user, 0);
  const totalBefore = await reader.totalQueued();
  await (await link.approve(STAKE_LINK.priorityPool, amount)).wait();
  const receipt = await (await pool.deposit(amount, true, [], GAS)).wait();
  const tag = { blockTag: receipt.blockNumber };
  const event = parsed(reader.interface, receipt, STAKE_LINK.priorityPool, "Deposit");
  const linkMid = await link.balanceOf(user, tag);
  const stMid = await stlink.balanceOf(user, tag);
  const queued = (await reader.getQueuedTokens(user, 0, tag)) - queuedBefore;
  const totalMid = await reader.totalQueued(tag);
  const instant = event ? event.args.instantAmount : -1n;
  const eventQueued = event ? event.args.queueAmount : -1n;
  const stGain = stMid - stBefore;
  // stLINK is share based, so the balance can land a wei or two off the staked amount.
  const stOk = stGain + 2n >= instant && stGain <= instant + 2n;
  const depositOk =
    Boolean(event) &&
    event.args.account === user &&
    linkBefore - linkMid === amount &&
    instant + eventQueued === amount &&
    queued === eventQueued &&
    totalMid - totalBefore === eventQueued &&
    stOk;

  let unqueueOk = true;
  let linkAfter = linkMid;
  let tx = receipt.hash;
  if (queued > 0n) {
    const out = await (await pool.unqueueTokens(queued, 0, 0, [], GAS)).wait();
    tx = out.hash;
    const unq = parsed(reader.interface, out, STAKE_LINK.priorityPool, "UnqueueTokens");
    linkAfter = await link.balanceOf(user, { blockTag: out.blockNumber });
    const left = await reader.getQueuedTokens(user, 0, { blockTag: out.blockNumber });
    const totalAfter = await reader.totalQueued({ blockTag: out.blockNumber });
    unqueueOk = Boolean(unq) && unq.args.amount === queued && linkAfter - linkMid === queued && left === queuedBefore && totalAfter === totalBefore;
  }
  const ok = depositOk && unqueueOk;
  const f = v => formatUnits(v, 18);
  return finish({
    ...base,
    ok,
    key: `staked=${f(instant)} queued=${f(eventQueued)} stLINK=+${f(stGain)} LINK=${f(linkBefore)}->${f(linkMid)}->${f(linkAfter)} totalQueued=${f(totalBefore)}->${f(totalMid)}`,
    detail: `Priority Pool deposit(${f(amount)} LINK, shouldQueue=true)\nDeposit event: staked ${f(instant)}, queued ${f(eventQueued)}; stLINK +${f(stGain)}\nqueue ${f(totalBefore)} -> ${f(totalMid)} LINK${queued > 0n ? `\nunqueueTokens(${f(queued)}) returned the queued LINK: wallet ${f(linkMid)} -> ${f(linkAfter)}` : ""}\nstLINK exits go through the Priority Pool / Withdrawal Pool, so staked LINK is not withdrawn here.\ntx ${tx}`,
    error: ok ? null : `stake.link deposit failed: deposit=${depositOk} unqueue=${unqueueOk}`,
  });
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "stakelink";
  const action = process.env.FORK_ACTION || "deposit";
  const chain = "ethereum";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (action === "deposit") return await depositFlow(base);
    return finish({ ...base, ok: false, error: `Unknown stake.link action ${action}` });
  } catch (err) {
    // A revert is a FAIL. Nothing here is downgraded to read-only.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
