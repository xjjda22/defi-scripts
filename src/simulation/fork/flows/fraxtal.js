/**
 * Fraxtal (Frax Finance's OP-Stack L2) — deposit frxUSD into the canonical L1 bridge, on a local
 * Ethereum fork.
 *
 * Fraxtal is a custom-gas-token OP chain: SystemConfig.gasPayingToken() is FRAX, so the OP Stack
 * L1StandardBridge deliberately refuses native ETH (depositETH() reverts with "StandardBridge:
 * cannot bridge ETH with custom gas token", and OptimismPortal.depositTransaction() with a non-zero
 * value reverts too). The permissionless value-bearing path is the ERC-20 one: depositERC20() pulls
 * the token out of the caller (no whitelist, no owner gate) into the bridge, which keeps it, emits
 * ERC20DepositInitiated, and asks the L1CrossDomainMessenger -> OptimismPortal to enqueue the L2
 * transaction (TransactionDeposited). The bridge holds ~99.5M frxUSD, the largest single ERC-20
 * position behind the row's $166M.
 *
 * Addresses: https://docs.frax.com/fraxtal/addresses/fraxtal-contracts (all L1 proxies) and
 *            https://docs.frax.finance/cross-chain/fraxtal-bridge (L1StandardBridge is the
 *            ETH/ERC20 deposit entry point).
 * Token pair: https://docs.frax.com/fraxtal/addresses/frax-tokens — frxUSD is
 *            0x853d955aCEf822Db058eb8505911ED77F175b99e on Ethereum and
 *            0xFc00000000000000000000000000000000000001 on Fraxtal; the L2 token's name()/symbol()
 *            are "Frax USD"/"frxUSD" (checked against chain 252 at 0xfc).
 *
 * Naming trap: the L1 token 0x853d… still answers symbol() "FRAX" because it is the pre-2025 FRAX
 * that was renamed frxUSD; the old FXS token 0x3432… is what Fraxtal now calls FRAX and uses as its
 * native gas token. FRAX itself is not an ERC-20 bridge asset (the bridge's balance of it is 0), so
 * frxUSD is what this flow locks.
 *
 * Destination delivery needs the L2 sequencer to derive the deposit; the fork only checks the
 * source chain, like every other bridge flow here.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** Fraxtal L1StandardBridgeProxy (official Ethereum-mainnet address table). */
const BRIDGE = "0x34C0bD5877A5Ee7099D0f5688D65F4bB9158BDE2";
/** L1CrossDomainMessengerProxy the bridge must report; it carries the deposit to the portal. */
const MESSENGER = "0x126bcc31Bc076B3d515f60FBC81FddE0B0d542Ed";
/** OptimismPortalProxy: enqueues the L2 transaction and holds the deposit message. */
const PORTAL = "0x36cb65c1967A0Fb0EEE11569C51C2f2aA1Ca6f6D";
/** Fraxtal L2StandardBridge predeploy, the bridge's counterpart. */
const L2_BRIDGE = "0x4200000000000000000000000000000000000010";
/** frxUSD on Ethereum (L1) and its documented Fraxtal representation (L2). */
const FRXUSD = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const FRXUSD_L2 = "0xFc00000000000000000000000000000000000001";
const AMOUNT = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);

const BRIDGE_ABI = [
  "function messenger() view returns (address)",
  "function l2TokenBridge() view returns (address)",
  "function paused() view returns (bool)",
  "function depositETH(uint32 _minGasLimit, bytes _extraData) payable",
  "function depositERC20(address _l1Token, address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes _extraData) payable",
];
const PORTAL_ABI = ["function paused() view returns (bool)"];
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
const DEPOSIT_EVENT = new ethers.Interface([
  "event ERC20DepositInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)",
]);
const TRANSACTION_DEPOSITED_TOPIC = ethers.id("TransactionDeposited(address,address,uint256,bytes)");

/** A native-ETH deposit must be refused; the reason is the chain's custom gas token. */
async function ethDepositBlocked(provider, from) {
  const data = new ethers.Interface(["function depositETH(uint32,bytes) payable"]).encodeFunctionData(
    "depositETH",
    [200_000, "0x"]
  );
  try {
    // Any value is refused; 0.05 ETH keeps the call well inside the impersonated balance.
    await provider.call({ from, to: BRIDGE, data, value: ethers.parseEther("0.05"), gasLimit: 1_000_000n });
    return { blocked: false, reason: null };
  } catch (err) {
    const reason = err.shortMessage || err.message || String(err);
    return { blocked: /custom gas token/i.test(reason), reason };
  }
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "fraxtal";
  const action = process.env.FORK_ACTION || "deposit-erc20";
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
    // The deposit only counts if this really is the Fraxtal bridge wired to the Fraxtal messenger.
    const messenger = await bridge.messenger();
    if (messenger.toLowerCase() !== MESSENGER.toLowerCase()) {
      return finish({ ...base, ok: false, error: `${BRIDGE}.messenger() is ${messenger}, not ${MESSENGER}` });
    }
    if ((await provider.getCode(MESSENGER)) === "0x") {
      return finish({ ...base, ok: false, error: `no contract code at messenger ${MESSENGER} on the fork` });
    }
    const l2Bridge = await bridge.l2TokenBridge();
    if (l2Bridge.toLowerCase() !== L2_BRIDGE.toLowerCase()) {
      return finish({ ...base, ok: false, error: `${BRIDGE}.l2TokenBridge() is ${l2Bridge}, not ${L2_BRIDGE}` });
    }
    // A paused bridge or portal would swallow the escrow without enqueueing the L2 deposit.
    if (await bridge.paused()) {
      return finish({ ...base, ok: false, error: `Fraxtal L1StandardBridge ${BRIDGE} is paused` });
    }
    const portal = new ethers.Contract(PORTAL, PORTAL_ABI, provider);
    if ((await provider.getCode(PORTAL)) === "0x") {
      return finish({ ...base, ok: false, error: `no contract code at portal ${PORTAL} on the fork` });
    }
    if (await portal.paused()) {
      return finish({ ...base, ok: false, error: `Fraxtal OptimismPortal ${PORTAL} is paused` });
    }
    // The token must be the documented 18-decimal frxUSD; a wrong address would bridge junk.
    const token = new ethers.Contract(FRXUSD, TOKEN_ABI, provider);
    if ((await provider.getCode(FRXUSD)) === "0x") {
      return finish({ ...base, ok: false, error: `no contract code at frxUSD ${FRXUSD} on the fork` });
    }
    const decimals = await token.decimals();
    if (Number(decimals) !== 18) {
      return finish({ ...base, ok: false, error: `${FRXUSD} has ${decimals} decimals, expected the 18-decimal frxUSD` });
    }
    const symbol = await token.symbol().catch(() => "?");

    // Fresh random account funded with frxUSD (100 by default) through the shared runtime helpers;
    // no PRIVATE_KEY anywhere. There is no configured frxUSD whale, so impersonateFunded deals the
    // balance with anvil_dealERC20/slot probing, and dealErc20 tops it up if the whale path was short.
    const signer = await impersonateFunded(CHAIN, "frxUSD", FRXUSD, AMOUNT);
    const user = await signer.getAddress();
    let funded = await token.balanceOf(user);
    if (funded < AMOUNT) {
      const dealt = await dealErc20(CHAIN, FRXUSD, user, AMOUNT);
      if (!dealt) {
        return finish({ ...base, ok: false, error: `could not fund ${user} with ${formatUnits(AMOUNT, 18)} frxUSD` });
      }
      funded = await token.balanceOf(user);
      if (funded < AMOUNT) {
        return finish({
          ...base,
          ok: false,
          error: `${user} holds ${formatUnits(funded, 18)} frxUSD after dealing, need ${formatUnits(AMOUNT, 18)}`,
        });
      }
    }

    const eth = await ethDepositBlocked(provider, user);

    const bridgeBefore = await token.balanceOf(BRIDGE);
    const userBefore = await token.balanceOf(user);
    const erc20 = token.connect(signer);
    await (await erc20.approve(BRIDGE, AMOUNT)).wait();
    const receipt = await (
      await bridge
        .connect(signer)
        .depositERC20(FRXUSD, FRXUSD_L2, AMOUNT, 200_000, "0x", { gasLimit: 1_000_000n })
    ).wait();

    const tag = { blockTag: receipt.blockNumber };
    const bridgeAfter = await token.balanceOf(BRIDGE, tag);
    const userAfter = await token.balanceOf(user, tag);

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== BRIDGE.toLowerCase()) continue;
      try {
        const parsed = DEPOSIT_EVENT.parseLog(log);
        if (parsed && parsed.name === "ERC20DepositInitiated") {
          event = parsed.args;
          break;
        }
      } catch {
        // another event emitted by the bridge, not the one under test
      }
    }
    const eventOk =
      Boolean(event) &&
      event.l1Token.toLowerCase() === FRXUSD.toLowerCase() &&
      event.l2Token.toLowerCase() === FRXUSD_L2.toLowerCase() &&
      event.from.toLowerCase() === user.toLowerCase() &&
      event.to.toLowerCase() === user.toLowerCase() &&
      event.amount === AMOUNT &&
      event.extraData === "0x";
    // The portal must also have enqueued the L2 deposit that will mint frxUSD on Fraxtal.
    const enqueued = receipt.logs.some(
      log => log.address.toLowerCase() === PORTAL.toLowerCase() && log.topics[0] === TRANSACTION_DEPOSITED_TOPIC
    );

    const delta = bridgeAfter - bridgeBefore;
    const spent = userBefore - userAfter;
    const ok = receipt.status === 1 && delta === AMOUNT && spent === AMOUNT && eventOk && enqueued;
    const reason = ok
      ? null
      : !event
        ? "no ERC20DepositInitiated event from the bridge in the receipt"
        : !eventOk
          ? "ERC20DepositInitiated does not carry the submitted l1Token/l2Token/from/to/amount/extraData"
          : delta !== AMOUNT
            ? `bridge frxUSD moved by ${delta.toString()} wei, expected ${AMOUNT.toString()}`
            : spent !== AMOUNT
              ? `depositor frxUSD moved by ${spent.toString()} wei, expected ${AMOUNT.toString()}`
              : "the OptimismPortal did not emit TransactionDeposited";

    return finish({
      ...base,
      ok,
      key: `bridgeFrxUSD=${formatUnits(bridgeBefore, 18)}->${formatUnits(bridgeAfter, 18)} delta=${formatUnits(delta, 18)} ethBridge=${eth.blocked ? "blocked" : "open"}`,
      detail: [
        `depositERC20 ${formatUnits(AMOUNT, 18)} frxUSD (L1 ${FRXUSD}, symbol ${symbol}) -> Fraxtal ${FRXUSD_L2} via ${BRIDGE}`,
        `bridge frxUSD ${formatUnits(bridgeBefore, 18)} -> ${formatUnits(bridgeAfter, 18)} (delta ${formatUnits(delta, 18)})`,
        `depositor ${user} frxUSD ${formatUnits(userBefore, 18)} -> ${formatUnits(userAfter, 18)}`,
        `ERC20DepositInitiated matches ${eventOk}; portal TransactionDeposited ${enqueued}`,
        `native-ETH deposit refused: ${eth.blocked ? eth.reason : "depositETH did NOT revert - chain no longer a custom gas token"}`,
        "Destination delivery needs the Fraxtal sequencer; this fork only checks the L1 escrow and the enqueued message.",
        `tx ${receipt.hash}`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
