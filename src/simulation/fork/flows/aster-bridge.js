/**
 * Aster (Bridge) — deposit native BNB into the Aster Deposit Bridge (AstherusVault) on BSC.
 *
 * The BNB Chain bridge in Aster's docs is the AstherusVault behind the ERC-1967 proxy
 * 0x128463A60784c4D3f46c23Af3f65Ed859Ba87974: a custodial deposit vault. Users send an asset,
 * the vault keeps it and emits Deposit(account, currency, isNative, amount, broker); Aster reads
 * that event and credits the account off-chain. Depositing is permissionless: the deposit
 * functions only check that the currency is supported and the amount is non-zero, and they are
 * deliberately not gated by whenNotPaused (pause() only stops withdraw()).
 *
 * The native path is used because it is the same Deposit event and the same "the vault's own
 * balance rises by exactly what was sent" assertion as an ERC-20 deposit, without needing a
 * whale or a token balance slot: a fresh random account is funded with anvil_setBalance, so
 * there is no PRIVATE_KEY. depositNative() is payable, which impersonateFunded() - built for
 * ERC-20 whales - cannot fund; this is the same pattern as ethSigner() in exitFlows.js.
 *
 * Addresses: https://docs.asterdex.com/overview/smart-contracts (Aster Deposit Bridge, BNB Chain)
 * Deposit docs: https://docs.asterdex.com/getting-started/deposit-and-withdrawal-guide
 * Implementation: AstherusVault 0x9a183b1E8939d7a7bd49C47ab0AD540f8aa07360, read from the
 * EIP-1967 slot 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc on the
 * fork; the verified AstherusVault source (Sourcify) is what depositNative() comes from.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { impersonateAccount } = require("../../../utils/impersonate");
const { requireFork, formatUnits, finish } = require("../runtime");

const CHAIN = "bsc";
/** Aster Deposit Bridge on BNB Chain (ERC-1967 proxy). Address from the official docs table. */
const BRIDGE = "0x128463A60784c4D3f46c23Af3f65Ed859Ba87974";
/** The vault's sentinel for native BNB: address(bytes20(keccak256("NATIVE"))). */
const NATIVE = ethers.getAddress(ethers.dataSlice(ethers.keccak256(ethers.toUtf8Bytes("NATIVE")), 0, 20));
const AMOUNT = ethers.parseEther("0.5");

const BRIDGE_ABI = [
  "function supportToken(address) view returns (address currency, address priceFeed, uint256 price, bool fixedPrice, uint8 priceDecimals, uint8 currencyDecimals)",
  "function depositNative(uint256 broker) payable",
];
const DEPOSIT_EVENT = new ethers.Interface([
  "event Deposit(address indexed account, address indexed currency, bool isNative, uint256 amount, uint256 broker)",
]);

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "aster-bridge";
  const action = process.env.FORK_ACTION || "deposit-native";
  let ctx;
  try {
    ctx = await requireFork(CHAIN);
  } catch (err) {
    return finish({ protocol, action, chain: CHAIN, block: null, ok: false, error: err.message });
  }
  const base = { protocol, action, chain: CHAIN, block: ctx.forkBlock };

  try {
    const provider = getProvider(CHAIN);
    const vault = new ethers.Contract(BRIDGE, BRIDGE_ABI, provider);

    // Never send funds to an address that is empty on this fork.
    if ((await provider.getCode(BRIDGE)) === "0x") {
      return finish({ ...base, ok: false, error: `no contract code at ${BRIDGE} on the fork` });
    }
    // The vault must list BNB as a deposit currency; depositNative() reverts "currency not
    // support" otherwise, and a different contract would make the balance delta meaningless.
    const native = await vault.supportToken(NATIVE);
    if (String(native.currency).toLowerCase() !== NATIVE.toLowerCase()) {
      return finish({
        ...base,
        ok: false,
        error: `${BRIDGE} does not list ${NATIVE} (NATIVE) as a supported deposit currency`,
      });
    }

    // Fresh random account funded with anvil_setBalance (100 BNB) - no PRIVATE_KEY anywhere.
    const signer = await impersonateAccount(ethers.Wallet.createRandom().address, CHAIN);
    const user = await signer.getAddress();

    const vaultBefore = await provider.getBalance(BRIDGE);
    const userBefore = await provider.getBalance(user);
    // broker 0: the broker tag only tells Aster's backend which frontend routed the deposit.
    const receipt = await (await vault.connect(signer).depositNative(0, { value: AMOUNT })).wait();
    const vaultAfter = await provider.getBalance(BRIDGE, receipt.blockNumber);
    const userAfter = await provider.getBalance(user, receipt.blockNumber);

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== BRIDGE.toLowerCase()) continue;
      try {
        const parsed = DEPOSIT_EVENT.parseLog(log);
        if (parsed && parsed.name === "Deposit") {
          event = parsed.args;
          break;
        }
      } catch {
        // another event emitted by the vault, not the one under test
      }
    }

    const delta = vaultAfter - vaultBefore;
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const userSpent = userBefore - userAfter;
    const eventAccount = event ? String(event.account).toLowerCase() : null;
    const eventCurrency = event ? String(event.currency).toLowerCase() : null;
    const eventNative = event ? event.isNative === true : false;
    const eventAmount = event ? BigInt(event.amount) : -1n;
    const eventBroker = event ? BigInt(event.broker) : -1n;

    const ok =
      receipt.status === 1 &&
      delta === AMOUNT &&
      eventAccount === user.toLowerCase() &&
      eventCurrency === NATIVE.toLowerCase() &&
      eventNative &&
      eventAmount === AMOUNT &&
      eventBroker === 0n &&
      userSpent === AMOUNT + gasCost;

    const reason = ok
      ? null
      : receipt.status !== 1
        ? "depositNative transaction reverted"
        : !event
          ? "no Deposit event from the bridge in the receipt"
          : eventAccount !== user.toLowerCase()
            ? `Deposit account ${eventAccount} is not the depositor ${user}`
            : eventCurrency !== NATIVE.toLowerCase()
              ? `Deposit currency ${eventCurrency} is not NATIVE ${NATIVE}`
              : !eventNative
                ? "Deposit event isNative is false"
                : eventAmount !== AMOUNT
                  ? `Deposit event amount ${eventAmount.toString()} wei, expected ${AMOUNT.toString()}`
                  : eventBroker !== 0n
                    ? `Deposit event broker ${eventBroker.toString()}, expected 0`
                    : delta !== AMOUNT
                      ? `vault balance moved by ${delta.toString()} wei, expected ${AMOUNT.toString()}`
                      : `depositor spent ${userSpent.toString()} wei, expected ${(AMOUNT + gasCost).toString()} (amount + gas)`;

    return finish({
      ...base,
      ok,
      key: `vaultBNB=${formatUnits(vaultBefore, 18)}->${formatUnits(vaultAfter, 18)} delta=${formatUnits(delta, 18)}`,
      detail: [
        `depositNative(0) with ${formatUnits(AMOUNT, 18)} BNB on the Aster Deposit Bridge ${BRIDGE} (AstherusVault)`,
        `vault BNB ${formatUnits(vaultBefore, 18)} -> ${formatUnits(vaultAfter, 18)} (delta ${formatUnits(delta, 18)})`,
        `Deposit account=${event ? eventAccount : "-"} currency=NATIVE isNative=${event ? eventNative : "-"} amount=${
          event ? formatUnits(eventAmount, 18) : "-"
        } broker=${event ? eventBroker.toString() : "-"}`,
        `tx ${receipt.hash} from ${user}`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
