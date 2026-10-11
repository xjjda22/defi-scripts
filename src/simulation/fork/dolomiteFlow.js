/**
 * Dolomite supply and withdraw on Ethereum through the official DepositWithdrawalRouter.
 * Deposits USDC into account 0, asserts the Dolomite account balance, then withdraws the
 * whole balance with BalanceCheckFlag.From so the account can never go negative.
 * Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { DOLOMITE } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
const MARGIN_ABI = [
  "function getMarketIdByTokenAddress(address token) view returns (uint256)",
  "function getMarketIsClosing(uint256 marketId) view returns (bool)",
  "function getAccountWei((address owner, uint256 number) account, uint256 marketId) view returns ((bool sign, uint256 value))",
];
// https://docs.dolomite.io/developer-documentation/depositing-or-withdrawing
const ROUTER_ABI = [
  "function depositWei(uint256 isolationModeMarketId, uint256 toAccountNumber, uint256 marketId, uint256 amountWei, uint8 eventFlag)",
  "function withdrawWei(uint256 isolationModeMarketId, uint256 fromAccountNumber, uint256 marketId, uint256 amountWei, uint8 balanceCheckFlag)",
];
const EVENT_NONE = 0;
const BALANCE_CHECK_FROM = 1;
const ACCOUNT = 0n;
const GAS = { gasLimit: 2_000_000n };

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

function signed(wei) {
  return wei.sign ? wei.value : -wei.value;
}

async function supplyWithdraw(base) {
  const provider = getProvider(base.chain);
  const margin = new ethers.Contract(DOLOMITE.margin, MARGIN_ABI, provider);
  const marketId = await margin.getMarketIdByTokenAddress(DOLOMITE.usdc);
  if (await margin.getMarketIsClosing(marketId)) {
    return finish({ ...base, ok: false, error: `Dolomite USDC market ${marketId} is closing` });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", DOLOMITE.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(DOLOMITE.usdc, ERC, signer);
  const router = new ethers.Contract(DOLOMITE.router, ROUTER_ABI, signer);
  const account = { owner: user, number: ACCOUNT };

  const walletBefore = await usdc.balanceOf(user);
  const supplyBefore = signed(await margin.getAccountWei(account, marketId));
  await (await usdc.approve(DOLOMITE.router, amount)).wait();
  await (await router.depositWei(0, ACCOUNT, marketId, amount, EVENT_NONE, GAS)).wait();
  const walletMid = await usdc.balanceOf(user);
  const supplyMid = signed(await margin.getAccountWei(account, marketId));

  // Withdraw the full balance (type(uint256).max per the docs), never past zero.
  const receipt = await (
    await router.withdrawWei(0, ACCOUNT, marketId, ethers.MaxUint256, BALANCE_CHECK_FROM, GAS)
  ).wait();
  const walletAfter = await usdc.balanceOf(user);
  const supplyAfter = signed(await margin.getAccountWei(account, marketId));

  const dust = amount / 1000n + 2n;
  const pulled = walletBefore - walletMid === amount;
  // Par rounding can leave the credited wei a unit or two under the deposit.
  const credited = supplyMid - supplyBefore + 2n >= amount && supplyMid > supplyBefore;
  const emptied = supplyAfter === 0n;
  const returned = walletAfter + dust >= walletBefore && walletAfter > walletMid;
  const ok = pulled && credited && emptied && returned;
  const fmt = v => formatUnits(v, 6);
  return finish({
    ...base,
    ok,
    key: `market=${marketId} dolomiteUSDC=${fmt(supplyBefore)}->${fmt(supplyMid)}->${fmt(supplyAfter)} USDC=${fmt(walletBefore)}->${fmt(walletMid)}->${fmt(walletAfter)}`,
    detail: `deposited ${fmt(amount)} USDC into Dolomite account 0 (market ${marketId}) via DepositWithdrawalRouter\nDolomite balance ${fmt(supplyBefore)} -> ${fmt(supplyMid)} (after deposit) -> ${fmt(supplyAfter)} (after withdraw)\nwallet USDC ${fmt(walletBefore)} -> ${fmt(walletMid)} -> ${fmt(walletAfter)}\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `Dolomite round trip failed: pulled=${pulled} credited=${credited} emptied=${emptied} returned=${returned}`,
  });
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "dolomite";
  const action = process.env.FORK_ACTION || "supply";
  const chain = "ethereum";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (action === "supply") return await supplyWithdraw(base);
    return finish({ ...base, ok: false, error: `Unknown Dolomite action ${action}` });
  } catch (err) {
    // A revert is a FAIL. Nothing here is downgraded to read-only.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
