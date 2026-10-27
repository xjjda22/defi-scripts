/**
 * Olympus Cooler V2 (MonoCooler) on Ethereum: add gOHM collateral, borrow USDS, repay in full and
 * withdraw the collateral. Every step is asserted against the MonoCooler account state and the
 * wallet balances. Addresses and doc links: src/catalog/contracts.js (COOLER_V2).
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { COOLER_V2 } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
];
const COOLER_ABI = [
  "function collateralToken() view returns (address)",
  "function debtToken() view returns (address)",
  "function borrowsPaused() view returns (bool)",
  "function minDebtRequired() view returns (uint256)",
  "function loanToValues() view returns (uint96 maxOriginationLtv, uint96 liquidationLtv)",
  "function accountCollateral(address) view returns (uint128)",
  "function accountDebt(address) view returns (uint128)",
  "function addCollateral(uint128 collateralAmount, address onBehalfOf, (address delegate, int256 amount)[] delegationRequests)",
  "function borrow(uint128 borrowAmount, address onBehalfOf, address recipient) returns (uint128)",
  "function repay(uint128 repayAmount, address onBehalfOf) returns (uint128)",
  "function withdrawCollateral(uint128 collateralAmount, address onBehalfOf, address recipient, (address delegate, int256 amount)[] delegationRequests) returns (uint128)",
];
const MAX_U128 = (1n << 128n) - 1n;
const GAS = { gasLimit: 2_500_000n };
// sUSDS holds the savings USDS. Used only to top up the few wei of interest owed at repay.
const USDS_WHALE = "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD";

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

async function borrowRoundTrip(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(COOLER_V2.monoCooler, COOLER_ABI, provider);
  const collateralToken = await reader.collateralToken();
  const debtToken = await reader.debtToken();
  if (collateralToken.toLowerCase() !== COOLER_V2.gohm.toLowerCase() || debtToken.toLowerCase() !== COOLER_V2.usds.toLowerCase()) {
    return finish({ ...base, ok: false, error: `MonoCooler tokens changed: collateral ${collateralToken}, debt ${debtToken}` });
  }
  if (await reader.borrowsPaused()) return finish({ ...base, ok: false, error: "MonoCooler borrowsPaused() is true; borrow would revert" });

  const collateral = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const borrowAmount = ethers.parseEther(process.env.FORK_BORROW || "1500");
  const minDebt = await reader.minDebtRequired();
  const [maxLtv] = await reader.loanToValues();
  const maxBorrow = (collateral * maxLtv) / 10n ** 18n;
  if (borrowAmount < minDebt || borrowAmount > maxBorrow) {
    return finish({
      ...base,
      ok: false,
      error: `FORK_BORROW ${formatUnits(borrowAmount, 18)} must sit between minDebtRequired ${formatUnits(minDebt, 18)} and the origination limit ${formatUnits(maxBorrow, 18)} USDS for ${formatUnits(collateral, 18)} gOHM`,
    });
  }

  const signer = await impersonateFunded(base.chain, "gOHM", COOLER_V2.gohm, collateral);
  const user = await signer.getAddress();
  const gohm = new ethers.Contract(COOLER_V2.gohm, ERC, signer);
  const usds = new ethers.Contract(COOLER_V2.usds, ERC, signer);
  const cooler = new ethers.Contract(COOLER_V2.monoCooler, COOLER_ABI, signer);

  const gohmBefore = await gohm.balanceOf(user);
  const usdsBefore = await usds.balanceOf(user);
  await (await gohm.approve(COOLER_V2.monoCooler, collateral)).wait();
  await (await cooler.addCollateral(collateral, user, [], GAS)).wait();
  const gohmMid = await gohm.balanceOf(user);
  const posted = await reader.accountCollateral(user);

  await (await cooler.borrow(borrowAmount, user, user, GAS)).wait();
  const usdsMid = await usds.balanceOf(user);
  const debtMid = await reader.accountDebt(user);

  // Interest accrues per second, so the full repay owes a few wei more than was borrowed.
  const whale = await impersonateAccount(USDS_WHALE, base.chain);
  const topUp = ethers.parseEther("1");
  await (await new ethers.Contract(COOLER_V2.usds, ERC, whale).transfer(user, topUp)).wait();
  const usdsBeforeRepay = await usds.balanceOf(user);
  await (await usds.approve(COOLER_V2.monoCooler, ethers.MaxUint256)).wait();
  await (await cooler.repay(MAX_U128, user, GAS)).wait();
  const usdsAfterRepay = await usds.balanceOf(user);
  const debtAfter = await reader.accountDebt(user);
  const repaid = usdsBeforeRepay - usdsAfterRepay;

  const receipt = await (await cooler.withdrawCollateral(MAX_U128, user, user, [], GAS)).wait();
  const gohmAfter = await gohm.balanceOf(user);
  const collateralAfter = await reader.accountCollateral(user);

  const postedOk = gohmBefore - gohmMid === collateral && posted === collateral;
  const borrowedOk = usdsMid - usdsBefore === borrowAmount && debtMid === borrowAmount;
  const repaidOk = debtAfter === 0n && repaid >= borrowAmount && repaid - borrowAmount < topUp;
  const withdrawnOk = collateralAfter === 0n && gohmAfter === gohmBefore;
  const ok = postedOk && borrowedOk && repaidOk && withdrawnOk;
  const f = v => formatUnits(v, 18);
  return finish({
    ...base,
    ok,
    key: `gOHM=${f(gohmBefore)}->${f(gohmMid)}->${f(gohmAfter)} collateral=0->${f(posted)}->${f(collateralAfter)} USDS=+${f(usdsMid - usdsBefore)} debt=${f(debtMid)}->${f(debtAfter)} repaid=${f(repaid)}`,
    detail: `added ${f(collateral)} gOHM to Cooler V2 (MonoCooler), borrowed ${f(borrowAmount)} USDS (origination limit ${f(maxBorrow)}, min debt ${f(minDebt)})\nrepaid ${f(repaid)} USDS (interest ${f(repaid - borrowAmount)}), debt ${f(debtMid)} -> ${f(debtAfter)}\nwithdrew all collateral: gOHM ${f(gohmMid)} -> ${f(gohmAfter)}\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `Cooler V2 round trip failed: posted=${postedOk} borrowed=${borrowedOk} repaid=${repaidOk} withdrawn=${withdrawnOk}`,
  });
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "cooler";
  const action = process.env.FORK_ACTION || "borrow";
  const chain = "ethereum";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (action === "borrow") return await borrowRoundTrip(base);
    return finish({ ...base, ok: false, error: `Unknown Cooler action ${action}` });
  } catch (err) {
    // A revert is a FAIL. Nothing here is downgraded to read-only.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
