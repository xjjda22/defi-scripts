/**
 * Hyperliquid Bridge — deposit USDC into the Arbitrum escrow (Bridge2) on a local Arbitrum fork.
 *
 * Hyperliquid's legacy Arbitrum bridge is a real, permissionless escrow contract, not the
 * off-chain perps engine: users send native Arbitrum USDC to the bridge address and the L1
 * validators credit the sending account on HyperCore from the resulting USDC Transfer log.
 * There is no deposit() function for that path — the escrow is credited by a plain ERC-20
 * transfer, which is exactly how deposits reach it on mainnet (sampled arbitrum blocks around
 * 520630400: every USDC Transfer into the bridge comes from a bare USDC.transfer, selector
 * 0xa9059cbb, with no call to the bridge at all), so the assertion is the escrow's own USDC
 * balance delta plus the USDC Transfer(from=depositor, to=bridge) event in the receipt, which
 * is the event the validators consume.
 *
 * Deliverable scope: the on-chain lock only. The HyperCore credit happens on the L1 and is not
 * observable on an Arbitrum fork; withdrawals are validator-signed batches, not user calls.
 *
 * The contract keeps the Pausable flag from Bridge2.sol. `paused()` gates withdrawals and
 * validator-set updates — it cannot block a plain transfer — so a paused bridge is refused as a
 * pre-flight failure (a locked bridge is not a working deposit route) rather than reported as a
 * passing deposit. getCode + paused() + usdcToken() are the three gates.
 *
 * Addresses: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/usdc
 * ("Legacy Bridge" — Contract 0x2df1c51e09aecf9cacb7bc98cb1742757f163df7 on Arbitrum, minimum
 * deposit 5 USDC; less than that is not credited). The docs' source link is
 * https://github.com/hyperliquid-dex/contracts/blob/master/Bridge2.sol.
 * Asset: Arbitrum native USDC 0xaf88d065e77c8cC2239327C5EDb3A432268e5831, also read back from
 * the escrow's own usdcToken() at run time.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

const CHAIN = "arbitrum";
/** Hyperliquid legacy Arbitrum bridge (Bridge2). Address from the official "Legacy Bridge" section. */
const BRIDGE = "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7";
/** Arbitrum native USDC, the only asset the bridge accepts. */
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
/** 10 USDC — above the documented 5 USDC minimum, small enough to be a test deposit. */
const AMOUNT = 10_000_000n;

const BRIDGE_ABI = ["function paused() view returns (bool)", "function usdcToken() view returns (address)"];
const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];
const TRANSFER_EVENT = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "hyperliquid-bridge";
  const action = process.env.FORK_ACTION || "deposit";
  let ctx;
  try {
    ctx = await requireFork(CHAIN);
  } catch (err) {
    return finish({ protocol, action, chain: CHAIN, block: null, ok: false, error: err.message });
  }
  const base = { protocol, action, chain: CHAIN, block: ctx.forkBlock };

  try {
    const provider = getProvider(CHAIN);
    const bridge = new ethers.Contract(BRIDGE, BRIDGE_ABI, provider);

    // Never send funds to an address that is empty on this fork.
    if ((await provider.getCode(BRIDGE)) === "0x") {
      return finish({ ...base, ok: false, error: `no contract code at ${BRIDGE} on the fork` });
    }
    // A paused Bridge2 blocks withdrawals and validator-set updates; refuse to call it a deposit test.
    const paused = await bridge.paused();
    if (paused !== false) {
      return finish({ ...base, ok: false, error: `${BRIDGE} paused() is true: the bridge is gated` });
    }
    // The escrow must be holding the documented token; otherwise the balance delta means nothing.
    const usdcToken = await bridge.usdcToken();
    if (usdcToken.toLowerCase() !== USDC.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `${BRIDGE} usdcToken() is ${usdcToken}, not Arbitrum native USDC ${USDC}`,
      });
    }

    // Fresh account funded from an Arbitrum USDC whale (anvil_deal fallback), no PRIVATE_KEY.
    const signer = await impersonateFunded(CHAIN, "USDC", USDC, AMOUNT);
    const user = await signer.getAddress();
    const usdc = new ethers.Contract(USDC, USDC_ABI, signer);

    const userBefore = await usdc.balanceOf(user);
    const bridgeBefore = await usdc.balanceOf(BRIDGE);

    // The documented deposit flow: a plain transfer of native USDC to the bridge. The token
    // emits Transfer(user -> bridge); the escrow has no deposit() hook to call for this path.
    const receipt = await (await usdc.transfer(BRIDGE, AMOUNT, { gasLimit: 500_000n })).wait();

    const bridgeAfter = await usdc.balanceOf(BRIDGE);
    const userAfter = await usdc.balanceOf(user);

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDC.toLowerCase()) continue;
      try {
        const parsed = TRANSFER_EVENT.parseLog(log);
        if (parsed && parsed.name === "Transfer" && parsed.args.to.toLowerCase() === BRIDGE.toLowerCase()) {
          event = parsed.args;
          break;
        }
      } catch {
        // another event emitted by USDC, not the transfer under test
      }
    }
    const eventFrom = event ? String(event.from).toLowerCase() : null;
    const eventValue = event ? event.value : null;

    const delta = bridgeAfter - bridgeBefore;
    const spent = userBefore - userAfter;
    const ok =
      receipt.status === 1 &&
      delta === AMOUNT &&
      spent === AMOUNT &&
      eventFrom === user.toLowerCase() &&
      eventValue === AMOUNT;
    const reason = ok
      ? null
      : !event
        ? `no USDC Transfer to ${BRIDGE} in the receipt`
        : eventFrom !== user.toLowerCase()
          ? `USDC Transfer to the bridge came from ${eventFrom}, not ${user}`
          : eventValue !== AMOUNT
            ? `USDC Transfer to the bridge was ${eventValue.toString()}, expected ${AMOUNT.toString()}`
            : delta !== AMOUNT
              ? `bridge USDC moved by ${delta.toString()}, expected ${AMOUNT.toString()}`
              : `depositor USDC moved by ${spent.toString()}, expected ${AMOUNT.toString()}`;

    return finish({
      ...base,
      ok,
      key: `bridgeUSDC=${formatUnits(bridgeBefore, 6)}->${formatUnits(bridgeAfter, 6)} delta=${formatUnits(delta, 6)}`,
      detail: [
        `transfer ${formatUnits(AMOUNT, 6)} USDC to the Hyperliquid Bridge ${BRIDGE} from ${user}`,
        `bridge USDC ${formatUnits(bridgeBefore, 6)} -> ${formatUnits(bridgeAfter, 6)} (delta ${formatUnits(delta, 6)})`,
        `depositor USDC ${formatUnits(userBefore, 6)} -> ${formatUnits(userAfter, 6)} (spent ${formatUnits(spent, 6)})`,
        `USDC Transfer from ${eventFrom} to ${BRIDGE} value ${eventValue == null ? "-" : formatUnits(eventValue, 6)}`,
        `tx ${receipt.hash} (HyperCore credit happens on the L1 and is out of scope on an Arbitrum fork)`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
