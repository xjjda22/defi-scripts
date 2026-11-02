/**
 * Obol Collective — stake OBOL into stOBOL, on a local Ethereum fork.
 *
 * Obol's own contracts are the staking system, not a DVT cluster: a distributed validator needs
 * validator keys and a live beacon chain, so it cannot be exercised on a fork. The permissionless
 * on-chain action is the one stake.obol.org performs. OBOL holders call stake(uint256) on stOBOL
 * (FixedStakedObol 0x6590…, the non-rebasing "Staked Obol" token). That contract pulls OBOL from
 * the caller, forwards it to rstOBOL (the rebasing accounting core) which stakes it in ObolStaker,
 * and mints stOBOL at the current exchange rate. stOBOL is deliberately not 1:1 with OBOL: rewards
 * accrue to the rebasing supply, so each stOBOL is worth more OBOL over time.
 *
 * The test asserts the full round trip of that state change, not just a successful call: the
 * caller's OBOL falls by exactly the stake, stOBOL is minted at exactly the contract's own quote,
 * the rebasing supply and ObolStaker's totalStaked / default deposit rise by exactly the stake,
 * and the Fixed(account, amount) event names the caller.
 *
 * Addresses (verified contracts section of the token docs):
 *   https://docs.obol.org/community-and-governance/obol-token
 * stOBOL code: https://etherscan.io/address/0x6590cBBCCbE6B83eF3774Ef1904D86A7B02c2fCC
 * ObolStaker code: https://etherscan.io/address/0x30641013934ec7625c9e73a4D63aab4201004259
 *
 * rstOBOL (0x1932e8…) is not listed in the docs; it is read from stOBOL.LST() and checked to be
 * wired to the documented ObolStaker and back to this stOBOL contract before anything is sent.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** OBOL governance token (the staked asset). https://docs.obol.org/community-and-governance/obol-token */
const OBOL = "0x0B010000b7624eb9B3DfBC279673C76E9D29D5F7";
/** stOBOL (FixedStakedObol), the non-rebasing liquid staking token. Same docs page. */
const STOBOL = "0x6590cBBCCbE6B83eF3774Ef1904D86A7B02c2fCC";
/** ObolStaker, the reward-streaming staking contract the docs list as "Obol Staker". */
const OBOL_STAKER = "0x30641013934ec7625c9e73a4D63aab4201004259";

const GAS = { gasLimit: 3_000_000n };

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
];

const STOBOL_ABI = [
  ...ERC20,
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function STAKE_TOKEN() view returns (address)",
  "function LST() view returns (address)",
  "function SHARE_SCALE_FACTOR() view returns (uint256)",
  "function defaultDelegatee() view returns (address)",
  "function stake(uint256) returns (uint256)",
];

/** rstOBOL — the rebasing LST that holds the accounting system stOBOL writes through. */
const LST_ABI = [
  "function STAKER() view returns (address)",
  "function FIXED_LST() view returns (address)",
  "function DEFAULT_DEPOSIT_ID() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function sharesForStake(uint256) view returns (uint256)",
  "function defaultDelegatee() view returns (address)",
];

const STAKER_ABI = [
  "function STAKE_TOKEN() view returns (address)",
  "function totalStaked() view returns (uint256)",
  "function totalEarningPower() view returns (uint256)",
  "function depositorTotalStaked(address) view returns (uint256)",
  "function deposits(uint256) view returns (uint96 balance, address owner, uint96 earningPower, address delegatee, address claimer, uint256 rewardPerTokenCheckpoint, uint256 scaledUnclaimedRewardCheckpoint)",
];

const EVENTS = new ethers.Interface([
  "event Fixed(address indexed account, uint256 amount)",
  "event Staked(address indexed account, uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event StakeDeposited(address owner, uint256 indexed depositId, uint256 amount, uint256 depositBalance, uint256 earningPower)",
]);

/** All logs of one event name emitted by one contract in the receipt. */
function readEvents(receipt, address, name) {
  const found = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue;
    const parsed = EVENTS.parseLog(log);
    if (parsed && parsed.name === name) found.push(parsed.args);
  }
  return found;
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "obol";
  const action = process.env.FORK_ACTION || "stake";
  let ctx;
  try {
    ctx = await requireFork(CHAIN);
  } catch (err) {
    return finish({ protocol, action, chain: CHAIN, block: null, ok: false, error: err.message });
  }
  const base = { protocol, action, chain: CHAIN, block: ctx.forkBlock };

  try {
    const provider = getProvider(CHAIN);

    // Never send OBOL to, or approve, an address that is empty on this fork.
    for (const [name, address] of [
      ["OBOL", OBOL],
      ["stOBOL", STOBOL],
      ["ObolStaker", OBOL_STAKER],
    ]) {
      if ((await provider.getCode(address)) === "0x") {
        return finish({ ...base, ok: false, error: `no ${name} code at ${address} on the fork` });
      }
    }

    const readStobol = new ethers.Contract(STOBOL, STOBOL_ABI, provider);
    const lstAddress = await readStobol.LST();
    if ((await provider.getCode(lstAddress)) === "0x") {
      return finish({
        ...base,
        ok: false,
        error: `stOBOL.LST() is ${lstAddress}, which has no code on this fork`,
      });
    }
    const readLst = new ethers.Contract(lstAddress, LST_ABI, provider);
    const readStaker = new ethers.Contract(OBOL_STAKER, STAKER_ABI, provider);

    // Wiring gates: a stOBOL that is not the one built on this LST/Staker, or a Staker that stakes
    // something other than OBOL, would make the deltas below meaningless.
    const [symbol, decimals, stakeToken, lstStaker, lstFixed, stakerToken, shareScale] = await Promise.all([
      readStobol.symbol(),
      readStobol.decimals(),
      readStobol.STAKE_TOKEN(),
      readLst.STAKER(),
      readLst.FIXED_LST(),
      readStaker.STAKE_TOKEN(),
      readStobol.SHARE_SCALE_FACTOR(),
    ]);
    if (symbol !== "stOBOL") {
      return finish({ ...base, ok: false, error: `${STOBOL} symbol() is "${symbol}", not stOBOL` });
    }
    if (decimals !== 18n) {
      return finish({ ...base, ok: false, error: `stOBOL decimals() is ${decimals}, expected 18` });
    }
    if (stakeToken.toLowerCase() !== OBOL.toLowerCase() || stakerToken.toLowerCase() !== OBOL.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `stake token mismatch: stOBOL.STAKE_TOKEN()=${stakeToken}, ObolStaker.STAKE_TOKEN()=${stakerToken}, OBOL=${OBOL}`,
      });
    }
    if (lstStaker.toLowerCase() !== OBOL_STAKER.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `rstOBOL ${lstAddress} stakes in ${lstStaker}, not the documented ObolStaker ${OBOL_STAKER}`,
      });
    }
    if (lstFixed.toLowerCase() !== STOBOL.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `rstOBOL ${lstAddress} is paired with fixed LST ${lstFixed}, not stOBOL ${STOBOL}`,
      });
    }

    const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1000");

    // No PRIVATE_KEY: a fresh random account is impersonated and topped up with OBOL through
    // anvil's state methods (impersonateFunded falls back to dealErc20 when no whale is configured).
    const signer = await impersonateFunded(CHAIN, "OBOL", OBOL, amount);
    const user = await signer.getAddress();
    const obol = new ethers.Contract(OBOL, ERC20, signer);
    const stobol = new ethers.Contract(STOBOL, STOBOL_ABI, signer);

    let funded = await obol.balanceOf(user);
    if (funded < amount) {
      // Belt and braces: if the impersonated account came up short, write the balance directly.
      await dealErc20(CHAIN, OBOL, user, amount);
      funded = await obol.balanceOf(user);
    }
    if (funded < amount) {
      return finish({
        ...base,
        ok: false,
        error: `funded account ${user} holds ${formatUnits(funded, 18)} OBOL, needs ${formatUnits(amount, 18)}`,
      });
    }

    // The quote is a staticCall of stake() from the user, so the allowance has to exist first.
    await (await obol.approve(STOBOL, amount)).wait();

    // Both quotes are read before the stake lands: the LST's shares-per-stake view and the
    // mint amount stOBOL itself would return. The minted balance must match the latter exactly.
    const depositId = await readLst.DEFAULT_DEPOSIT_ID();
    const [quoted, lstQuote, depositBefore] = await Promise.all([
      stobol.stake.staticCall(amount),
      readLst.sharesForStake(amount),
      readStaker.deposits(depositId),
    ]);
    if (quoted === 0n) {
      return finish({ ...base, ok: false, error: "stake() would mint 0 stOBOL; no tx sent" });
    }
    const quotedFromLst = lstQuote / shareScale;
    if (quoted > quotedFromLst ? quoted - quotedFromLst > 1n : quotedFromLst - quoted > 1n) {
      return finish({
        ...base,
        ok: false,
        error: `stake() quote ${quoted} does not match rstOBOL.sharesForStake()/SHARE_SCALE_FACTOR ${quotedFromLst}`,
      });
    }

    const before = {
      obol: await obol.balanceOf(user),
      stobol: await stobol.balanceOf(user),
      stobolSupply: await stobol.totalSupply(),
      lstSupply: await readLst.totalSupply(),
      totalStaked: await readStaker.totalStaked(),
      totalEarningPower: await readStaker.totalEarningPower(),
      depositorStaked: await readStaker.depositorTotalStaked(lstAddress),
      depositBalance: depositBefore.balance,
    };

    const receipt = await (await stobol.stake(amount, GAS)).wait();

    const depositAfter = await readStaker.deposits(depositId);
    const after = {
      obol: await obol.balanceOf(user),
      stobol: await stobol.balanceOf(user),
      stobolSupply: await stobol.totalSupply(),
      lstSupply: await readLst.totalSupply(),
      totalStaked: await readStaker.totalStaked(),
      totalEarningPower: await readStaker.totalEarningPower(),
      depositorStaked: await readStaker.depositorTotalStaked(lstAddress),
      depositBalance: depositAfter.balance,
    };

    const obolSpent = before.obol - after.obol;
    const minted = after.stobol - before.stobol;
    const supplyDelta = after.stobolSupply - before.stobolSupply;
    const lstSupplyDelta = after.lstSupply - before.lstSupply;
    const stakedDelta = after.totalStaked - before.totalStaked;
    const earningPowerDelta = after.totalEarningPower - before.totalEarningPower;
    const depositorDelta = after.depositorStaked - before.depositorStaked;
    const depositDelta = after.depositBalance - before.depositBalance;

    const fixedEvents = readEvents(receipt, STOBOL, "Fixed");
    const stakedEvents = readEvents(receipt, lstAddress, "Staked");
    const deposits = readEvents(receipt, OBOL_STAKER, "StakeDeposited");
    const transferEvents = readEvents(receipt, STOBOL, "Transfer");

    const fixedOk =
      fixedEvents.length === 1 &&
      String(fixedEvents[0].account).toLowerCase() === user.toLowerCase() &&
      fixedEvents[0].amount === amount;
    // stOBOL routes through rstOBOL, which emits Staked(address(this as fixed LST), amount).
    const routedOk =
      stakedEvents.length === 1 &&
      String(stakedEvents[0].account).toLowerCase() === STOBOL.toLowerCase() &&
      stakedEvents[0].amount === amount;
    const stakeDepositedOk =
      deposits.length === 1 &&
      String(deposits[0].owner).toLowerCase() === lstAddress.toLowerCase() &&
      deposits[0].depositId === depositId &&
      deposits[0].amount === amount;
    const mintTransferOk = transferEvents.some(
      event =>
        event.from === ethers.ZeroAddress &&
        String(event.to).toLowerCase() === user.toLowerCase() &&
        event.value === minted
    );

    const reasons = [];
    if (receipt.status !== 1) reasons.push("stake transaction reverted");
    if (obolSpent !== amount)
      reasons.push(`OBOL spent ${formatUnits(obolSpent, 18)}, expected ${formatUnits(amount, 18)}`);
    if (minted === 0n) reasons.push("no stOBOL minted");
    if (minted !== quoted) reasons.push(`minted ${minted} stOBOL, stake() quote was ${quoted}`);
    if (supplyDelta !== minted && supplyDelta !== minted + 1n)
      reasons.push(`stOBOL totalSupply moved by ${supplyDelta}, expected ${minted} (or +1 wei of share rounding)`);
    if (lstSupplyDelta !== amount)
      reasons.push(
        `rstOBOL totalSupply moved by ${formatUnits(lstSupplyDelta, 18)}, expected ${formatUnits(amount, 18)}`
      );
    if (stakedDelta !== amount)
      reasons.push(
        `ObolStaker.totalStaked moved by ${formatUnits(stakedDelta, 18)}, expected ${formatUnits(amount, 18)}`
      );
    if (depositorDelta !== amount || depositDelta !== amount)
      reasons.push(
        `default deposit accounting moved by depositor ${formatUnits(depositorDelta, 18)} / deposit ${formatUnits(depositDelta, 18)}, expected ${formatUnits(amount, 18)}`
      );
    if (String(depositAfter.owner).toLowerCase() !== lstAddress.toLowerCase())
      reasons.push(`default deposit ${depositId} owner is ${depositAfter.owner}, not rstOBOL ${lstAddress}`);
    if (!fixedOk) reasons.push(`no stOBOL Fixed(${user}, ${amount}) event in the receipt`);
    if (!routedOk) reasons.push(`no rstOBOL Staked(${STOBOL}, ${amount}) event in the receipt`);
    if (!stakeDepositedOk) reasons.push(`no ObolStaker StakeDeposited for deposit ${depositId} of ${amount}`);
    if (!mintTransferOk) reasons.push(`no stOBOL Transfer(0x0 -> ${user}, ${minted}) mint event`);

    return finish({
      ...base,
      ok: reasons.length === 0,
      key: `OBOL ${formatUnits(before.obol, 18)}->${formatUnits(after.obol, 18)} stOBOL ${formatUnits(before.stobol, 18)}->${formatUnits(after.stobol, 18)} stakerTotalStaked+=${formatUnits(stakedDelta, 18)}`,
      detail: [
        `stake ${formatUnits(amount, 18)} OBOL into stOBOL ${STOBOL} (FixedStakedObol) -> rstOBOL ${lstAddress} -> ObolStaker ${OBOL_STAKER}`,
        `OBOL ${formatUnits(before.obol, 18)} -> ${formatUnits(after.obol, 18)} (delta -${formatUnits(obolSpent, 18)}), stOBOL ${formatUnits(before.stobol, 18)} -> ${formatUnits(after.stobol, 18)} (minted ${formatUnits(minted, 18)}, quote ${formatUnits(quoted, 18)})`,
        `rate ${formatUnits((amount * 10n ** 18n) / minted, 18)} OBOL per stOBOL; stOBOL totalSupply +${supplyDelta}, rstOBOL totalSupply +${formatUnits(lstSupplyDelta, 18)}`,
        `ObolStaker totalStaked +${formatUnits(stakedDelta, 18)} (earning power +${formatUnits(earningPowerDelta, 18)}), default deposit ${depositId} balance ${formatUnits(before.depositBalance, 18)} -> ${formatUnits(after.depositBalance, 18)}`,
        `default delegatee ${await readStobol.defaultDelegatee()}, deposit owner ${depositAfter.owner}`,
        `tx ${receipt.hash} from ${user}`,
      ].join("\n"),
      error: reasons.length ? reasons.join("; ") : null,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
