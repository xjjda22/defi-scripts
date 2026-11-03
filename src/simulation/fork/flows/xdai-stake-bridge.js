/**
 * xDAI Stake Bridge (Gnosis Chain canonical bridge) — permissionless USDS deposit on Ethereum.
 *
 * The Ethereum side is a POA token-bridge `EternalStorageProxy` (1137 bytes) at
 * 0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016 that delegates to 0x257bDD093Cab1Bd39eBF837dCB60f33d031d7d49.
 * It locks its collateral token on Ethereum and mints native xDAI on Gnosis Chain, so the
 * destination credit is not observable on an Ethereum fork; the asserted behaviour is the lock
 * plus the bridge's own daily-limit accounting, both read from the bridge itself.
 *
 * relayTokens(address,uint256) is the permissionless deposit: no owner/validator/allowlist gate,
 * only minPerTx <= amount <= maxPerTx and the daily limit. This test deposits 100 USDS from a
 * fresh random address and asserts the bridge's USDS collateral and its totalSpentPerDay bucket
 * each rise by exactly the deposit, and the depositor pays exactly that much USDS.
 *
 * DefiLlama adapter (the row's source):
 *   https://raw.githubusercontent.com/DefiLlama/DefiLlama-Adapters/08239f856c/projects/xdai/index.js
 *   `const xDaiBridge = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016"` — the adapter sums
 *   SAI/DAI/cDAI held by this address, and its own balanceOf call is what this flow re-checks.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

const XDAI_BRIDGE = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016";
const USDS = "0xdC035D45d973E3EC169d2276DDab16f1e407384F";
// getBridgeMode() = 0x18762d46, the POA erc-to-native bridge mode (same mode as the retired SAI
// bridge 0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6, which now reports maxPerTx() = 0).
const BRIDGE_MODE = "0x18762d46";
const VALIDATOR = "0xe1579dEbdD2DF16Ebdb9db8694391fa74EeA201E";

const GAS = { gasLimit: 600_000n };

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const BRIDGE_ABI = [
  "function erc20token() view returns (address)",
  "function getBridgeMode() view returns (bytes4)",
  "function getBridgeInterfacesVersion() view returns (uint64,uint64,uint64)",
  "function validatorContract() view returns (address)",
  "function requiredBlockConfirmations() view returns (uint256)",
  "function isInitialized() view returns (bool)",
  "function minPerTx() view returns (uint256)",
  "function maxPerTx() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function totalSpentPerDay(uint256) view returns (uint256)",
  "function relayTokens(address,uint256)",
];

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

async function deposit(base) {
  const provider = getProvider(base.chain);
  const [bridgeCode, usdsCode] = await Promise.all([provider.getCode(XDAI_BRIDGE), provider.getCode(USDS)]);
  if (bridgeCode === "0x")
    return finish({ ...base, ok: false, error: `xDAI bridge ${XDAI_BRIDGE} has no code on this fork` });
  if (usdsCode === "0x") return finish({ ...base, ok: false, error: `USDS ${USDS} has no code on this fork` });

  const read = new ethers.Contract(XDAI_BRIDGE, BRIDGE_ABI, provider);
  const [collateral, mode, version, validator, confirmations, initialized, minPerTx, maxPerTx, dailyLimit] =
    await Promise.all([
      read.erc20token(),
      read.getBridgeMode(),
      read.getBridgeInterfacesVersion(),
      read.validatorContract(),
      read.requiredBlockConfirmations(),
      read.isInitialized(),
      read.minPerTx(),
      read.maxPerTx(),
      read.dailyLimit(),
    ]);

  // Identity gates: a typo'd address, the retired SAI bridge, or the erc-to-erc OmniBridge
  // sibling cannot pass. 0x7301CFA0… is the old SAI bridge (erc20token() = SAI, maxPerTx() = 0)
  // and 0x88ad0951… is the OmniBridge (no erc20token(), erc-to-erc mode).
  if (collateral.toLowerCase() !== USDS.toLowerCase())
    return finish({ ...base, ok: false, error: `erc20token() is ${collateral}, not USDS — not the live xDAI bridge` });
  if (mode !== BRIDGE_MODE)
    return finish({ ...base, ok: false, error: `getBridgeMode() is ${mode}, not the erc-to-native mode ${BRIDGE_MODE}` });
  if (validator.toLowerCase() !== VALIDATOR.toLowerCase())
    return finish({ ...base, ok: false, error: `validatorContract() is ${validator}, not ${VALIDATOR}` });
  if (!initialized) return finish({ ...base, ok: false, error: "isInitialized() is false; the bridge is not live" });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  if (amount < minPerTx)
    return finish({ ...base, ok: false, error: `deposit ${formatUnits(amount, 18)} USDS is below minPerTx ${formatUnits(minPerTx, 18)}` });
  if (amount > maxPerTx)
    return finish({ ...base, ok: false, error: `deposit ${formatUnits(amount, 18)} USDS is above maxPerTx ${formatUnits(maxPerTx, 18)}` });

  const head = await provider.getBlock("latest");
  const headDay = Math.floor(head.timestamp / 86400);
  const spentToday = await read.totalSpentPerDay(headDay);
  if (spentToday + amount > dailyLimit)
    return finish({
      ...base,
      ok: false,
      error: `daily limit reached: ${formatUnits(spentToday, 18)} already spent of ${formatUnits(dailyLimit, 18)}`,
    });

  const signer = await impersonateFunded(base.chain, "USDS", USDS, amount);
  const user = await signer.getAddress();
  const usds = new ethers.Contract(USDS, ERC20, signer);
  const bridge = new ethers.Contract(XDAI_BRIDGE, BRIDGE_ABI, signer);

  const balance = await usds.balanceOf(user);
  if (balance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 18)} USDS` });

  await (await usds.approve(XDAI_BRIDGE, amount)).wait();
  const receipt = await (await bridge.relayTokens(user, amount, GAS)).wait();
  const at = receipt.blockNumber;
  const blockAt = await provider.getBlock(at);
  const day = Math.floor(blockAt.timestamp / 86400);

  const [collateralAt, collateralPrev, spentAt, spentPrev, userAt, userPrev] = await Promise.all([
    usds.balanceOf(XDAI_BRIDGE, { blockTag: at }),
    usds.balanceOf(XDAI_BRIDGE, { blockTag: at - 1 }),
    bridge.totalSpentPerDay(day, { blockTag: at }),
    bridge.totalSpentPerDay(day, { blockTag: at - 1 }),
    usds.balanceOf(user, { blockTag: at }),
    usds.balanceOf(user, { blockTag: at - 1 }),
  ]);

  // The bridge's USDS collateral and its own daily-limit accounting are two independent
  // measurements of the same deposit; both must move by exactly the amount locked.
  const collateralDelta = collateralAt - collateralPrev;
  const spentDelta = spentAt - spentPrev;
  const userDelta = userPrev - userAt;

  const ok = collateralDelta === amount && spentDelta === amount && userDelta === amount;

  const reasons = [];
  if (collateralDelta !== amount)
    reasons.push(`bridge USDS collateral +${formatUnits(collateralDelta, 18)} != deposit ${formatUnits(amount, 18)}`);
  if (spentDelta !== amount)
    reasons.push(`totalSpentPerDay +${formatUnits(spentDelta, 18)} != deposit ${formatUnits(amount, 18)}`);
  if (userDelta !== amount)
    reasons.push(`depositor USDS -${formatUnits(userDelta, 18)} != deposit ${formatUnits(amount, 18)}`);

  return finish({
    ...base,
    ok,
    key: `bridgeUSDS+=${formatUnits(collateralDelta, 18)} totalSpentPerDay+=${formatUnits(spentDelta, 18)} deposit=${formatUnits(amount, 18)}USDS`,
    detail:
      `xDAI bridge ${XDAI_BRIDGE} (POA EternalStorageProxy, erc-to-native ${mode}, ` +
      `interfaces v${version[0]}.${version[1]}.${version[2]}, validator ${validator}, ` +
      `${confirmations} block confirmations), collateral USDS ${USDS}\n` +
      `relayTokens(${user}, ${formatUnits(amount, 18)} USDS) from fresh ${user}: ` +
      `bridge USDS collateral ${formatUnits(collateralPrev, 18)} -> ${formatUnits(collateralAt, 18)}\n` +
      `totalSpentPerDay(${day}) ${formatUnits(spentPrev, 18)} -> ${formatUnits(spentAt, 18)} of ` +
      `${formatUnits(dailyLimit, 18)} daily limit; depositor USDS ${formatUnits(userPrev, 18)} -> ${formatUnits(userAt, 18)}\n` +
      `xDAI is minted on Gnosis Chain, so the destination balance is not visible on this fork\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "xdai-stake-bridge";
  const action = process.env.FORK_ACTION || "deposit";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    return await deposit(base);
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
