/**
 * Liquity V1 on Ethereum.
 * - liquity:deposit   Stability Pool provideToSP / withdrawFromSP (existing coverage)
 * - liquity:open      BorrowerOperations.openTrove with ETH collateral
 * - liquity:redeem    TroveManager.redeemCollateral against active troves
 * - liquity:liquidate open a thin trove, shock PriceFeed via MockPrice, liquidate
 *
 * Addresses: https://docs.liquity.org/liquity-v1/documentation/resources
 * BorrowerOperations 0x24179CD81c9e782A4096035f7eC97fB8B783e007
 * TroveManager       0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2
 * StabilityPool      0x66017D22b0f8556afDd19FC67041899Eb65a21bb
 * LUSD               0x5f98805A4E8be255a32880FDeC7F6728C6568bA0
 * PriceFeed          0x4c517D4e2C851CA76d7eC94B805269Df0f2201De
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { LIQUITY } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");
const { impersonateAccount } = require("../../utils/impersonate");
const ART = require("./contracts/artifacts.json");

const BORROWER_OPS = "0x24179CD81c9e782A4096035f7eC97fB8B783e007";
const TROVE_MANAGER = "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2";
const PRICE_FEED = "0x4c517D4e2C851CA76d7eC94B805269Df0f2201De";
const LUSD = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const PRICE_SLOT = ethers.id("defi-scripts.mock.price");
const GAS = { gasLimit: 4_000_000n };
const MAX_FEE = ethers.parseEther("0.05"); // 5%

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const SP_ABI = [
  "function provideToSP(uint256,address)",
  "function withdrawFromSP(uint256)",
  "function getTotalLUSDDeposits() view returns (uint256)",
  "function getCompoundedLUSDDeposit(address) view returns (uint256)",
  "function lusdToken() view returns (address)",
];
const BO_ABI = [
  "function openTrove(uint256 _maxFeePercentage, uint256 _LUSDAmount, address _upperHint, address _lowerHint) payable",
  "function getEntireDebtAndColl(address) view returns (uint256 debt, uint256 coll, uint256 pendingLUSDDebtReward, uint256 pendingETHReward)",
];
const TM_ABI = [
  "function getTroveStatus(address) view returns (uint256)",
  "function getTroveDebt(address) view returns (uint256)",
  "function getTroveColl(address) view returns (uint256)",
  "function getCurrentICR(address,uint256) view returns (uint256)",
  "function MCR() view returns (uint256)",
  "function redeemCollateral(uint256 _LUSDamount, address _firstRedemptionHint, address _upperPartialRedemptionHint, address _lowerPartialRedemptionHint, uint256 _partialRedemptionHintNICR, uint256 _maxIterations, uint256 _maxFeePercentage)",
  "function liquidate(address _borrower)",
  "function getTroveOwnersCount() view returns (uint256)",
  "function checkRecoveryMode(uint256) view returns (bool)",
  "function getTCR(uint256) view returns (uint256)",
];
const PRICE_ABI = ["function fetchPrice() view returns (uint256)"];
const SORTED_TROVES = "0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6";
const ST_ABI = [
  "function getFirst() view returns (address)",
  "function getLast() view returns (address)",
  "function getNext(address) view returns (address)",
  "function getPrev(address) view returns (address)",
  "function getSize() view returns (uint256)",
];
const TM_HINT_ABI = ["function getNominalICR(address) view returns (uint256)", "function MCR() view returns (uint256)", "function getCurrentICR(address,uint256) view returns (uint256)"];

/**
 * HintHelpers is empty on current mainnet (selfdestructed), and SortedTroves.findInsertPosition
 * can hang for minutes on Anvil eth_call. Walk the 64-node list ourselves and return adjacent hints.
 * NICR = coll * 1e20 / debtApprox (debtApprox includes 200 LUSD gas compensation + ~0.5% fee).
 */
async function insertHints(provider, coll, lusdAmount) {
  const gasComp = ethers.parseEther("200");
  const feeApprox = lusdAmount / 200n; // ~0.5% when base rate is low
  const debtApprox = lusdAmount + gasComp + feeApprox;
  const nicr = (coll * 10n ** 20n) / debtApprox;
  const st = new ethers.Contract(SORTED_TROVES, ST_ABI, provider);
  const tm = new ethers.Contract(TROVE_MANAGER, TM_HINT_ABI, provider);
  const size = Number(await st.getSize());
  if (size === 0) return { upper: ethers.ZeroAddress, lower: ethers.ZeroAddress, nicr };
  const first = await st.getFirst();
  const last = await st.getLast();
  const firstNicr = await tm.getNominalICR(first);
  const lastNicr = await tm.getNominalICR(last);
  // Ascend from the tail when the NICR sits in the lower half — fewer getNominalICR calls on Anvil.
  if (nicr <= lastNicr) return { upper: last, lower: ethers.ZeroAddress, nicr };
  if (nicr >= firstNicr) return { upper: ethers.ZeroAddress, lower: first, nicr };
  const descend = nicr > (firstNicr + lastNicr) / 2n;
  if (descend) {
    let prev = ethers.ZeroAddress;
    let cur = first;
    for (let steps = 0; cur !== ethers.ZeroAddress && steps <= size + 2; steps += 1) {
      const curNicr = await tm.getNominalICR(cur);
      if (nicr <= curNicr) {
        prev = cur;
        cur = await st.getNext(cur);
        continue;
      }
      return { upper: prev, lower: cur, nicr };
    }
    return { upper: prev, lower: ethers.ZeroAddress, nicr };
  }
  let next = ethers.ZeroAddress;
  let cur = last;
  for (let steps = 0; cur !== ethers.ZeroAddress && steps <= size + 2; steps += 1) {
    const curNicr = await tm.getNominalICR(cur);
    if (nicr >= curNicr) {
      next = cur;
      cur = await st.getPrev(cur);
      continue;
    }
    return { upper: cur, lower: next, nicr };
  }
  return { upper: ethers.ZeroAddress, lower: next, nicr };
}

/** First active trove from the tail whose ICR >= MCR — used as redeem firstRedemptionHint. */
async function redemptionHint(provider, price) {
  const st = new ethers.Contract(SORTED_TROVES, ST_ABI, provider);
  const tm = new ethers.Contract(TROVE_MANAGER, TM_HINT_ABI, provider);
  const mcr = await tm.MCR();
  let cur = await st.getLast();
  let steps = 0;
  const size = Number(await st.getSize());
  while (cur !== ethers.ZeroAddress && steps <= size + 2) {
    const icr = await tm.getCurrentICR(cur, price);
    if (icr >= mcr) return { first: cur, mcr };
    cur = await st.getPrev(cur);
    steps += 1;
  }
  return { first: ethers.ZeroAddress, mcr };
}


async function shockPrice(provider, target, price) {
  const original = await provider.send("eth_getCode", [target, "latest"]);
  const slotBefore = await provider.send("eth_getStorageAt", [target, PRICE_SLOT, "latest"]);
  await provider.send("anvil_setCode", [target, ART.MockPrice.deployedBytecode]);
  await provider.send("anvil_setStorageAt", [target, PRICE_SLOT, ethers.toBeHex(price, 32)]);
  return async () => {
    await provider.send("anvil_setCode", [target, original]);
    await provider.send("anvil_setStorageAt", [target, PRICE_SLOT, ethers.toBeHex(BigInt(slotBefore), 32)]);
  };
}

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
    key: `LUSD=${formatUnits(amount, 18)} deposit=${formatUnits(deposit, 18)}->${formatUnits(left, 18)}`,
    detail: `provideToSP ${formatUnits(amount, 18)} LUSD: Stability Pool total ${formatUnits(totalBefore, 18)} -> ${formatUnits(totalMid, 18)}, compounded deposit ${formatUnits(deposit, 18)}\nwithdrawFromSP: LUSD back ${formatUnits(userAfter - userMid, 18)}, deposit left ${formatUnits(left, 18)}, pool total back to ${formatUnits(totalAfter, 18)}\ntx ${provideReceipt.hash} / ${withdrawReceipt.hash}`,
    error: ok ? null : `Liquity Stability Pool round trip failed: provide=${provideOk} withdraw=${withdrawOk}`,
  });
}

async function openTrove(base) {
  const provider = getProvider(base.chain);
  const priceFeed = new ethers.Contract(PRICE_FEED, PRICE_ABI, provider);
  const price = await priceFeed.fetchPrice();
  // MIN_NET_DEBT = 2000 LUSD. Use 2 ETH collateral (~$4.4k) and borrow 2000 LUSD (~150%+ ICR).
  const coll = ethers.parseEther(process.env.FORK_COLLATERAL || "2");
  const debt = ethers.parseUnits(process.env.FORK_AMOUNT || "2000", 18);
  const hints = await insertHints(provider, coll, debt);
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(coll + ethers.parseEther("1"))]);
  const bo = new ethers.Contract(BORROWER_OPS, BO_ABI, signer);
  const tm = new ethers.Contract(TROVE_MANAGER, TM_ABI, provider);
  const lusd = new ethers.Contract(LUSD, ERC, provider);
  const statusBefore = await tm.getTroveStatus(user);
  const balBefore = await lusd.balanceOf(user);
  const ethBefore = await provider.getBalance(user);
  const receipt = await (
    await bo.openTrove(MAX_FEE, debt, hints.upper, hints.lower, { ...GAS, value: coll })
  ).wait();
  const statusAfter = await tm.getTroveStatus(user); // 1 = active
  const troveDebt = await tm.getTroveDebt(user);
  const troveColl = await tm.getTroveColl(user);
  const balAfter = await lusd.balanceOf(user);
  const ethAfter = await provider.getBalance(user);
  const icr = await tm.getCurrentICR(user, price);
  const ok =
    statusBefore === 0n &&
    statusAfter === 1n &&
    troveColl === coll &&
    balAfter - balBefore === debt &&
    troveDebt >= debt &&
    ethBefore - ethAfter >= coll;
  return finish({
    ...base,
    ok,
    key: `coll=${formatUnits(troveColl, 18)}ETH debt=${formatUnits(troveDebt, 18)}LUSD ICR=${formatUnits(icr, 18)} LUSD+=${formatUnits(balAfter - balBefore, 18)}`,
    detail: `openTrove maxFee=5% debt=${formatUnits(debt, 18)} LUSD coll=${formatUnits(coll, 18)} ETH (NICR~${hints.nicr}, hints ${hints.upper}/${hints.lower})
status ${statusBefore}->${statusAfter}, trove debt ${formatUnits(troveDebt, 18)}, coll ${formatUnits(troveColl, 18)}, ICR ${formatUnits(icr, 18)} at price ${formatUnits(price, 18)}
LUSD ${formatUnits(balBefore, 18)} -> ${formatUnits(balAfter, 18)}
tx ${receipt.hash}`,
    error: ok ? null : "Liquity openTrove did not activate the trove or mint the requested LUSD",
  });
}

async function redeem(base) {
  const provider = getProvider(base.chain);
  const tm = new ethers.Contract(TROVE_MANAGER, TM_ABI, provider);
  const owners = await tm.getTroveOwnersCount();
  if (owners === 0n) {
    return finish({ ...base, ok: false, error: "No active Liquity troves to redeem against" });
  }
  const priceFeed = new ethers.Contract(PRICE_FEED, PRICE_ABI, provider);
  const price = await priceFeed.fetchPrice();
  if (await tm.checkRecoveryMode.staticCall?.(price).catch(() => null)) {
    /* fall through — ABI may not have staticCall helper on older ethers */
  }
  const recovery = await new ethers.Contract(
    TROVE_MANAGER,
    ["function checkRecoveryMode(uint256) view returns (bool)"],
    provider
  ).checkRecoveryMode(price);
  if (recovery) {
    return finish({ ...base, ok: false, error: "Liquity is in recovery mode; redemptions are blocked" });
  }
  const { first, mcr } = await redemptionHint(provider, price);
  if (first === ethers.ZeroAddress) {
    return finish({ ...base, ok: false, error: `No trove with ICR >= MCR ${formatUnits(mcr, 18)} to redeem against` });
  }
  // Partial redemption against the first hint: amount << trove debt so the trove stays open and
  // must be re-inserted into SortedTroves. HintHelpers is empty on mainnet, so walk the list for
  // the post-redeem NICR ourselves (findInsertPosition hangs on Anvil eth_call).
  const GAS_COMP = ethers.parseEther("200");
  const troveDebt = await tm.getTroveDebt(first);
  const troveColl = await tm.getTroveColl(first);
  const maxRedeemable = troveDebt > GAS_COMP ? troveDebt - GAS_COMP : 0n;
  if (maxRedeemable === 0n) {
    return finish({ ...base, ok: false, error: `First redemption hint ${first} has no redeemable debt` });
  }
  let amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  if (amount >= maxRedeemable) amount = maxRedeemable / 10n; // keep it partial
  if (amount === 0n) amount = maxRedeemable > ethers.parseEther("1") ? ethers.parseEther("1") : maxRedeemable;
  const ethLot = (amount * 10n ** 18n) / price;
  if (ethLot >= troveColl) {
    return finish({ ...base, ok: false, error: "Partial redeem ethLot would consume entire collateral; pick a smaller FORK_AMOUNT" });
  }
  const newColl = troveColl - ethLot;
  const newDebt = troveDebt - amount;
  const newNicr = (newColl * 10n ** 20n) / newDebt;
  // Walk SortedTroves for insert position of newNicr, skipping `first` (it will be removed then re-inserted).
  const st = new ethers.Contract(SORTED_TROVES, ST_ABI, provider);
  const tmNicr = new ethers.Contract(TROVE_MANAGER, TM_HINT_ABI, provider);
  let prev = ethers.ZeroAddress;
  let cur = await st.getFirst();
  const size = Number(await st.getSize());
  let steps = 0;
  while (cur !== ethers.ZeroAddress && steps <= size + 2) {
    if (cur.toLowerCase() === first.toLowerCase()) {
      cur = await st.getNext(cur);
      steps += 1;
      continue;
    }
    const curNicr = await tmNicr.getNominalICR(cur);
    if (newNicr <= curNicr) {
      prev = cur;
      cur = await st.getNext(cur);
      steps += 1;
      continue;
    }
    break;
  }
  const upperPartial = prev;
  const lowerPartial = cur;

  const signer = await impersonateFunded(base.chain, "LUSD", LUSD, amount);
  const user = await signer.getAddress();
  const lusd = new ethers.Contract(LUSD, ERC, signer);
  const tmWrite = new ethers.Contract(TROVE_MANAGER, TM_ABI, signer);
  const ethBefore = await provider.getBalance(user);
  const lusdBefore = await lusd.balanceOf(user);
  const receipt = await (
    await tmWrite.redeemCollateral(
      amount,
      first,
      upperPartial,
      lowerPartial,
      newNicr,
      1, // single trove
      MAX_FEE,
      GAS
    )
  ).wait();
  const ethAfter = await provider.getBalance(user);
  const lusdAfter = await lusd.balanceOf(user);
  const lusdSpent = lusdBefore - lusdAfter;
  const ok = receipt.status === 1 && lusdSpent === amount;
  return finish({
    ...base,
    ok,
    key: `redeemed=${formatUnits(lusdSpent, 18)}LUSD eth=${formatUnits(ethBefore, 18)}->${formatUnits(ethAfter, 18)} owners=${owners}`,
    detail: `redeemCollateral(${formatUnits(amount, 18)} LUSD) firstHint=${first} partialNICR=${newNicr} hints ${upperPartial}/${lowerPartial}
LUSD ${formatUnits(lusdBefore, 18)} -> ${formatUnits(lusdAfter, 18)}
ETH ${formatUnits(ethBefore, 18)} -> ${formatUnits(ethAfter, 18)} (gas inclusive)
tx ${receipt.hash}`,
    error: ok ? null : "Liquity redeemCollateral did not spend the LUSD amount",
  });
}

async function liquidate(base) {
  const provider = getProvider(base.chain);
  const priceFeed = new ethers.Contract(PRICE_FEED, PRICE_ABI, provider);
  const livePrice = await priceFeed.fetchPrice();
  const mcr = await new ethers.Contract(TROVE_MANAGER, TM_ABI, provider).MCR();
  // Open a trove near MCR, then crash the price so ICR < MCR.
  const debt = ethers.parseUnits("2000", 18);
  // coll such that ICR ≈ 120% at live price: coll = debt * 1.2 / price
  const coll = (debt * 12n * 10n ** 18n) / (livePrice * 10n);
  const collUse = coll > ethers.parseEther("1.2") ? coll : ethers.parseEther("1.5");
  const victim = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const victimAddr = await victim.getAddress();
  await provider.send("anvil_setBalance", [victimAddr, ethers.toQuantity(collUse + ethers.parseEther("1"))]);
  const hints = await insertHints(provider, collUse, debt);
  const bo = new ethers.Contract(BORROWER_OPS, BO_ABI, victim);
  await (await bo.openTrove(MAX_FEE, debt, hints.upper, hints.lower, { ...GAS, value: collUse })).wait();
  const tm = new ethers.Contract(TROVE_MANAGER, TM_ABI, provider);
  const statusBefore = await tm.getTroveStatus(victimAddr);
  const icrBefore = await tm.getCurrentICR(victimAddr, livePrice);
  // Crash price to ~50% so ICR halves below MCR (110%).
  const crashed = livePrice / 2n;
  const restore = await shockPrice(provider, PRICE_FEED, crashed);
  try {
    const liquidator = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
    const liqAddr = await liquidator.getAddress();
    await provider.send("anvil_setBalance", [liqAddr, ethers.toQuantity(ethers.parseEther("1"))]);
    const tmWrite = new ethers.Contract(TROVE_MANAGER, TM_ABI, liquidator);
    const icrAfterShock = await tm.getCurrentICR(victimAddr, crashed);
    if (icrAfterShock >= mcr) {
      return finish({
        ...base,
        ok: false,
        error: `After price shock ICR ${formatUnits(icrAfterShock, 18)} still >= MCR ${formatUnits(mcr, 18)}; cannot liquidate`,
      });
    }
    const receipt = await (await tmWrite.liquidate(victimAddr, GAS)).wait();
    const statusAfter = await tm.getTroveStatus(victimAddr); // 3 = closed by liquidation
    const ok = statusBefore === 1n && statusAfter === 3n;
    return finish({
      ...base,
      ok,
      key: `status=${statusBefore}->${statusAfter} ICR=${formatUnits(icrBefore, 18)}->${formatUnits(icrAfterShock, 18)} price=${formatUnits(livePrice, 18)}->${formatUnits(crashed, 18)}`,
      detail: `opened thin trove (coll ${formatUnits(collUse, 18)} ETH, debt ${formatUnits(debt, 18)} LUSD, ICR ${formatUnits(icrBefore, 18)}), shocked PriceFeed to ${formatUnits(crashed, 18)}, liquidate()\nstatus ${statusBefore} -> ${statusAfter} (3=closedByLiquidation)\ntx ${receipt.hash}`,
      error: ok ? null : `Liquity liquidate did not close the trove (status ${statusAfter})`,
    });
  } finally {
    await restore();
  }
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "liquity";
  const action = process.env.FORK_ACTION || "deposit";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { protocol, action, chain, block: ctx.forkBlock };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (action === "deposit") return await liquityDeposit(base);
    if (action === "open" || action === "open-trove") return await openTrove(base);
    if (action === "redeem") return await redeem(base);
    if (action === "liquidate") return await liquidate(base);
    return finish({ ...base, ok: false, error: `Unknown Liquity action ${action}` });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
