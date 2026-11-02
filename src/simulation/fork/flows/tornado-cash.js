/**
 * Tornado Cash Classic — deposit 0.1 ETH into the 0.1 ETH ETH pool, on a local Ethereum fork.
 *
 * An ETH tornado is a standalone pool contract (not a proxy): deposit(bytes32 commitment) is
 * payable, takes exactly denomination() wei, records the commitment in the pool's Poseidon
 * Merkle tree and emits Deposit(commitment, leafIndex, timestamp). The ETH stays in the pool,
 * so the pool's own balance must rise by exactly 0.1 ETH.
 *
 * The commitment is a random field element — poseidon(secret, nullifier), whose preimage is the
 * only thing that can withdraw it later — so this test covers the deposit side only. Withdrawal
 * is out of scope by construction, not because the pool is closed: deposits have never been paused.
 * It has to be < the BN254 scalar field: the pool Poseidon-hashes the leaf while inserting it, and
 * the hasher reverts with "_right should be inside the field" above that (only ~19% of uniformly
 * random bytes32 values are valid leaves).
 *
 * Addresses: https://github.com/tornadocash/docs/blob/en/general/tornado-cash-smart-contracts.md
 * Pool code: https://github.com/tornadocash/tornado-core/blob/master/contracts/Tornado.sol
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { impersonateAccount } = require("../../../utils/impersonate");
const { requireFork, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** Tornado Cash Classic 0.1 ETH pool (mainnet). Address from the official deployments table. */
const POOL = "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc";
const DENOMINATION = ethers.parseEther("0.1");
/** BN254 scalar field, the range the pool's Poseidon hasher accepts. */
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const POOL_ABI = [
  "function denomination() view returns (uint256)",
  "function commitments(bytes32) view returns (bool)",
  "function deposit(bytes32 commitment) payable",
];
const DEPOSIT_EVENT = new ethers.Interface([
  "event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)",
]);

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "tornado-cash";
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
    const pool = new ethers.Contract(POOL, POOL_ABI, provider);

    // Never send funds to an address that is empty on this fork.
    if ((await provider.getCode(POOL)) === "0x") {
      return finish({ ...base, ok: false, error: `no contract code at ${POOL} on the fork` });
    }
    // The pool must be the 0.1 ETH one; a wrong instance would make the delta meaningless.
    const denomination = await pool.denomination();
    if (denomination !== DENOMINATION) {
      return finish({
        ...base,
        ok: false,
        error: `${POOL} denomination() is ${formatUnits(denomination, 18)} ETH, not the documented 0.1 ETH pool`,
      });
    }

    // Fresh random account funded with anvil_setBalance (100 ETH) — no PRIVATE_KEY anywhere.
    // Same pattern as ethSigner() in exitFlows.js: a payable deposit cannot be funded by
    // impersonateFunded(), which is built for ERC-20 whales.
    const signer = await impersonateAccount(ethers.Wallet.createRandom().address, CHAIN);
    const user = await signer.getAddress();
    // Random, unknowable to anyone else, and valid as a Poseidon input.
    const commitment = ethers.toBeHex(BigInt(ethers.hexlify(ethers.randomBytes(32))) % FIELD, 32);

    const poolBefore = await provider.getBalance(POOL);
    const receipt = await (
      await pool.connect(signer).deposit(commitment, { value: denomination, gasLimit: 1_000_000n })
    ).wait();
    const poolAfter = await provider.getBalance(POOL);

    // The pool keeps the commitment in its own storage; this is the state a later withdraw() reads.
    const recorded = (await pool.commitments(commitment)) === true;

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== POOL.toLowerCase()) continue;
      try {
        const parsed = DEPOSIT_EVENT.parseLog(log);
        if (parsed && parsed.name === "Deposit") {
          event = parsed.args;
          break;
        }
      } catch {
        // another event emitted by the pool, not the one under test
      }
    }
    const eventCommitment = event ? String(event.commitment).toLowerCase() : null;

    const delta = poolAfter - poolBefore;
    const ok =
      receipt.status === 1 && delta === denomination && eventCommitment === commitment.toLowerCase() && recorded;
    const reason = ok
      ? null
      : !event
        ? "no Deposit event from the pool in the receipt"
        : eventCommitment !== commitment.toLowerCase()
          ? `Deposit event commitment ${eventCommitment} is not the submitted ${commitment}`
          : delta !== denomination
            ? `pool balance moved by ${delta.toString()} wei, expected ${denomination.toString()}`
            : "pool did not record the commitment (commitments(commitment) is false)";

    return finish({
      ...base,
      ok,
      key: `poolETH=${formatUnits(poolBefore, 18)}->${formatUnits(poolAfter, 18)} delta=${formatUnits(delta, 18)}`,
      detail: [
        `deposit ${formatUnits(denomination, 18)} ETH into the Tornado Cash Classic 0.1 ETH pool ${POOL}`,
        `pool balance ${formatUnits(poolBefore, 18)} -> ${formatUnits(poolAfter, 18)} ETH (delta ${formatUnits(delta, 18)})`,
        `commitment ${commitment} leafIndex ${event ? String(event.leafIndex) : "-"} recorded=${recorded}`,
        `tx ${receipt.hash} from ${user}`,
      ].join("\n"),
      error: reason,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
