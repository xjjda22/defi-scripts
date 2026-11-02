/**
 * Axelar Network — the Ethereum leg of a General Message Passing send, on a local fork.
 *
 * Axelar settlement is off-chain: the AxelarGateway only emits ContractCall(sender, chain,
 * address, payloadHash, payload), validators observe that event, and a signed command later
 * executes the call on the destination chain. So the source chain is the only leg a fork can
 * observe, and the documented user flow there has exactly two permissionless steps:
 *
 *   1. AxelarGasService.payNativeGasForContractCall{value}(sender, chain, address, payload, refund)
 *      — payable, no gate, keeps the ETH in the gas service for the relayer and emits
 *      NativeGasPaidForContractCall.
 *   2. AxelarGateway.callContract(chain, address, payload) — no value, no gate besides the
 *      gateway pause switch, emits ContractCall for the same payloadHash.
 *
 * The test asserts the ETH leg precisely: the gas service's own balance rises by exactly the
 * paid amount, both events carry the submitted sender/chain/address/keccak256(payload), and the
 * caller spends exactly that amount plus gas. Destination execution is out of scope by
 * construction (it needs validator signatures over the observed event).
 *
 * Addresses (Ethereum mainnet): https://docs.axelar.dev/resources/contract-addresses/mainnet/
 *   (the page links https://github.com/axelarnetwork/axelar-contract-deployments/blob/main/
 *    axelar-chains-config/info/mainnet.json, which lists the two addresses below under
 *    chains.ethereum.contracts.AxelarGateway / AxelarGasService)
 * Contract source: https://github.com/axelarnetwork/axelar-cgp-solidity/blob/main/contracts/AxelarGateway.sol
 *                  https://github.com/axelarnetwork/axelar-cgp-solidity/blob/main/contracts/gas-service/AxelarGasService.sol
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { impersonateAccount } = require("../../../utils/impersonate");
const { requireFork, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** AxelarGateway (Ethereum mainnet, v6.2 Create3 deployment). */
const GATEWAY = "0x4F4495243837681061C4743b74B3eEdf548D56A5";
/** AxelarGasService (same Create3 address on every EVM chain). */
const GAS_SERVICE = "0x2d5d7d31F671F86C782533cc367F14109a082712";
/** A registered Axelar destination chain name; the gateway echoes it, it is not validated on-chain. */
const DEST_CHAIN = "Polygon";
/** Interchain Token Service on Polygon — same canonical address as on Ethereum (mainnet.json). */
const DEST_ADDRESS = "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C";
/** Native gas paid for the message. */
const GAS_VALUE = ethers.parseEther("0.01");

const GAS_SERVICE_ABI = [
  "function payNativeGasForContractCall(address sender, string destinationChain, string destinationAddress, bytes payload, address refundAddress) payable",
  "function implementation() view returns (address)",
];
const GATEWAY_ABI = [
  "function callContract(string destinationChain, string destinationContractAddress, bytes payload)",
];
const NATIVE_GAS_EVENT = new ethers.Interface([
  "event NativeGasPaidForContractCall(address indexed sender, string destinationChain, string destinationAddress, bytes32 indexed payloadHash, uint256 gasFeeAmount, address refundAddress)",
]);
const CONTRACT_CALL_EVENT = new ethers.Interface([
  "event ContractCall(address indexed sender, string destinationChain, string destinationContractAddress, bytes32 indexed payloadHash, bytes payload)",
]);

/** First log emitted by `address` that decodes as `name` in `iface`, or null. */
function findEvent(receipt, address, iface, name) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === name) return parsed.args;
    } catch {
      // another event from the same contract, not the one under test
    }
  }
  return null;
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "axelar";
  const action = process.env.FORK_ACTION || "send-message";
  let ctx;
  try {
    ctx = await requireFork(CHAIN);
  } catch (err) {
    return finish({ protocol, action, chain: CHAIN, block: null, ok: false, error: err.message });
  }
  const base = { protocol, action, chain: CHAIN, block: ctx.forkBlock };

  try {
    const provider = getProvider(CHAIN);
    const gasService = new ethers.Contract(GAS_SERVICE, GAS_SERVICE_ABI, provider);
    const gateway = new ethers.Contract(GATEWAY, GATEWAY_ABI, provider);

    // Never pay an address that is empty on this fork.
    for (const [name, address] of [
      ["AxelarGateway", GATEWAY],
      ["AxelarGasService", GAS_SERVICE],
    ]) {
      if ((await provider.getCode(address)) === "0x") {
        return finish({ ...base, ok: false, error: `no contract code at ${name} ${address} on the fork` });
      }
    }
    // Both are Upgradable proxies: a live implementation behind them is what makes the calls real.
    const implementation = await gasService.implementation();
    if ((await provider.getCode(implementation)) === "0x") {
      return finish({
        ...base,
        ok: false,
        error: `AxelarGasService ${GAS_SERVICE} implementation ${implementation} has no code on the fork`,
      });
    }

    // Fresh random account funded with anvil_setBalance (100 ETH) — no PRIVATE_KEY anywhere.
    // A payable call cannot be funded by impersonateFunded(), which is built for ERC-20 whales.
    const signer = await impersonateAccount(ethers.Wallet.createRandom().address, CHAIN);
    const user = await signer.getAddress();

    // Distinct per run so payloadHash cannot match a stale event, and usable as a no-op call.
    const payload = ethers.hexlify(ethers.toUtf8Bytes(`axelar fork test ${user.toLowerCase()}`));
    const payloadHash = ethers.keccak256(payload);

    // Pre-flight: the gateway pause switch would make callContract revert; a static call reports
    // that as a gate instead of spending the gas payment first.
    try {
      await provider.call({
        from: user,
        to: GATEWAY,
        data: gateway.interface.encodeFunctionData("callContract", [DEST_CHAIN, DEST_ADDRESS, payload]),
      });
    } catch (err) {
      return finish({
        ...base,
        ok: false,
        error: `AxelarGateway.callContract is gated on this fork (paused?): ${err.shortMessage || err.message}`,
      });
    }

    // Explicit block tags: a "latest" read of the same address would be served from the
    // provider's short-lived cache and hide the spend.
    const blockBefore = await provider.getBlockNumber();
    const userBefore = await provider.getBalance(user, blockBefore);
    const serviceBefore = await provider.getBalance(GAS_SERVICE, blockBefore);

    // 1. Pay native gas for the message. The gas service keeps the ETH for the relayer.
    const payReceipt = await (
      await gasService
        .connect(signer)
        .payNativeGasForContractCall(user, DEST_CHAIN, DEST_ADDRESS, payload, user, { value: GAS_VALUE })
    ).wait();

    // 2. Emit the message the Axelar validators observe and sign over.
    const callReceipt = await (await gateway.connect(signer).callContract(DEST_CHAIN, DEST_ADDRESS, payload)).wait();

    const userAfter = await provider.getBalance(user);
    const serviceAfter = await provider.getBalance(GAS_SERVICE, callReceipt.blockNumber);

    const gas = findEvent(payReceipt, GAS_SERVICE, NATIVE_GAS_EVENT, "NativeGasPaidForContractCall");
    const call = findEvent(callReceipt, GATEWAY, CONTRACT_CALL_EVENT, "ContractCall");

    const delta = serviceAfter - serviceBefore;
    const fees = [payReceipt, callReceipt].reduce((sum, r) => sum + r.gasUsed * r.gasPrice, 0n);
    const spent = userBefore - userAfter;

    const gasMatches =
      gas &&
      gas.sender.toLowerCase() === user.toLowerCase() &&
      gas.destinationChain === DEST_CHAIN &&
      gas.destinationAddress === DEST_ADDRESS &&
      String(gas.payloadHash).toLowerCase() === payloadHash.toLowerCase() &&
      gas.gasFeeAmount === GAS_VALUE &&
      gas.refundAddress.toLowerCase() === user.toLowerCase();
    const callMatches =
      call &&
      call.sender.toLowerCase() === user.toLowerCase() &&
      call.destinationChain === DEST_CHAIN &&
      call.destinationContractAddress === DEST_ADDRESS &&
      String(call.payloadHash).toLowerCase() === payloadHash.toLowerCase() &&
      String(call.payload).toLowerCase() === payload.toLowerCase();

    const ok =
      payReceipt.status === 1 &&
      callReceipt.status === 1 &&
      delta === GAS_VALUE &&
      Boolean(gasMatches) &&
      Boolean(callMatches) &&
      spent === GAS_VALUE + fees;

    const reason = ok
      ? null
      : payReceipt.status !== 1 || callReceipt.status !== 1
        ? `a transaction reverted (pay status ${payReceipt.status}, call status ${callReceipt.status})`
        : delta !== GAS_VALUE
          ? `gas service balance moved by ${formatUnits(delta, 18)} ETH, expected ${formatUnits(GAS_VALUE, 18)}`
          : !gas
            ? "no NativeGasPaidForContractCall event from the gas service in the receipt"
            : !call
              ? "no ContractCall event from the gateway in the receipt"
              : !gasMatches
                ? "NativeGasPaidForContractCall args do not match the submitted message"
                : !callMatches
                  ? "ContractCall args do not match the submitted message"
                  : `caller spent ${formatUnits(spent, 18)} ETH, expected ${formatUnits(GAS_VALUE + fees, 18)} (payment + gas)`;

    return finish({
      ...base,
      ok,
      key: `gasServiceETH=${formatUnits(serviceBefore, 18)}->${formatUnits(serviceAfter, 18)} delta=${formatUnits(delta, 18)} payloadHash=${payloadHash}`,
      detail: [
        `pay ${formatUnits(GAS_VALUE, 18)} ETH native gas for ${DEST_CHAIN}:${DEST_ADDRESS} and callContract with ${ethers.dataLength(payload)} bytes of payload`,
        `gas service ETH ${formatUnits(serviceBefore, 18)} -> ${formatUnits(serviceAfter, 18)} (delta ${formatUnits(delta, 18)})`,
        `NativeGasPaidForContractCall sender=${gas ? gas.sender : "-"} payloadHash=${gas ? String(gas.payloadHash) : "-"} gasFeeAmount=${gas ? formatUnits(gas.gasFeeAmount, 18) : "-"} refund=${gas ? gas.refundAddress : "-"}`,
        `ContractCall sender=${call ? call.sender : "-"} payloadHash=${call ? String(call.payloadHash) : "-"} payloadBytes=${call ? ethers.dataLength(call.payload) : "-"}`,
        `caller spent ${formatUnits(spent, 18)} ETH (${formatUnits(GAS_VALUE, 18)} payment + ${formatUnits(fees, 18)} gas)`,
        `destination execution needs Axelar validators to sign an execute command from this event, so it never lands on a single-chain fork`,
        `tx ${payReceipt.hash} then ${callReceipt.hash} from ${user}`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
