/**
 * Railgun — shield 10 USDC into RailgunSmartWallet, on a local Ethereum fork.
 *
 * shield() is permissionless: the docs say shielding "is executed publicly, using a public wallet",
 * the contract "computes a commitment (called a note)" from the public data, commits it to the
 * merkle tree stored as merkleRoot and emits Shield. The note is a Poseidon hash:
 *
 *   masterPublicKey = poseidon([spendingPublicKey, viewingPublicKey])
 *   npk             = poseidon([masterPublicKey, random])      // random is 16 bytes
 *   tokenID         = bytes32(address)                          // ERC20 tokenID is just the address
 *   leaf            = poseidon([npk, tokenID, valueAfterFee])   // commitment
 *
 * which is exactly what the SDK builds (engine note/shield-note.ts: getNotePublicKey() and
 * getShieldNoteHash()) and what RailgunLogic.hashCommitment() recomputes on chain. shield() itself
 * takes the preimage, so this flow builds the preimage the way the SDK does and lets the deployed
 * contract produce/insert the leaf:
 *  - the two-input Poseidon calls go through the wallet's own public hashLeftRight() (PoseidonT3),
 *    gated on the circomlib poseidon([1,2]) vector, so no JS port of the round constants is needed;
 *  - the three-input commitment is the wallet's public hashCommitment() (PoseidonT4), the very
 *    function shield() hashes the note with.
 * The contract validates the preimage: value > 0 and npk < the BN254 scalar field, otherwise
 * "Invalid Note NPK" — the same class of field constraint the tornado-cash flow handles.
 *
 * A shield pays the documented 0.25% deduction to the treasury, so the wallet contract receives
 * value - fee and the treasury receives fee. The note's committed value is the adjusted,
 * post-fee value.
 *
 * Docs: https://docs.railgun.org/wiki/learn/shielding-tokens (commitment + Shield event)
 *       https://docs.railgun.org/wiki/learn/railgun-deductions (0.25% shield deduction -> treasury)
 *       https://docs.railgun.org/wiki/learn/helpful-links (ETH contract + treasury addresses)
 *       https://github.com/Railgun-Community/deployments/blob/master/src/chains/ethereum.ts
 * Code: https://github.com/railgun-privacy/contract/blob/main/contracts/logic/RailgunSmartWallet.sol
 *       https://github.com/Railgun-Community/engine/blob/main/src/note/shield-note.ts
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { impersonateAccount } = require("../../../utils/impersonate");
const { requireFork, dealErc20, impersonateFunded, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";
/** RailgunSmartWallet proxy (EIP-1967) on Ethereum. Address from the official docs' contract list. */
const WALLET = "0xFA7093CDD9EE6932B4eb2c9e1cde7CE00B1FA4b9";
/** USDC, the shielded token. https://developers.circle.com/stablecoins/usdc-contract-addresses */
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
/** Treasury that receives the shield deduction, per the docs' contract list. */
const TREASURY = "0xE8A8B458BcD1Ececc6b6b58F80929b29cCecFF40";
/** BN254 scalar field — the range validateCommitmentPreimage() accepts for npk. */
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** circomlib poseidon([1,2]): the value the SDK's Poseidon (and therefore npk/commitment) builds on. */
const POSEIDON_1_2 = 7853200120776062878684798364095072458815029376092732009249414926327459813530n;
/** 10 USDC (6 decimals) — large enough that the 0.25% deduction is a distinct integer. */
const AMOUNT = 10_000_000n;
const TOKEN_TYPE_ERC20 = 0;

const WALLET_ABI = [
  "function shield(((bytes32 npk,(uint8 tokenType,address tokenAddress,uint256 tokenSubID) token,uint120 value) preimage,(bytes32[3] encryptedBundle,bytes32 shieldKey) ciphertext)[] _shieldRequests)",
  "function shieldFee() view returns (uint120)",
  "function treasury() view returns (address)",
  "function treeNumber() view returns (uint256)",
  "function nextLeafIndex() view returns (uint256)",
  "function merkleRoot() view returns (bytes32)",
  "function rootHistory(uint256 treeNumber, bytes32 root) view returns (bool)",
  "function tokenBlocklist(address token) view returns (bool)",
  "function getFee(uint136 amount, bool isInclusive, uint120 feeBP) view returns (uint120, uint120)",
  "function getTokenID((uint8 tokenType,address tokenAddress,uint256 tokenSubID) token) view returns (bytes32)",
  "function validateCommitmentPreimage((bytes32 npk,(uint8 tokenType,address tokenAddress,uint256 tokenSubID) token,uint120 value) note) view returns (bool,string)",
  "function hashCommitment((bytes32 npk,(uint8 tokenType,address tokenAddress,uint256 tokenSubID) token,uint120 value) preimage) view returns (bytes32)",
  "function hashLeftRight(bytes32 left, bytes32 right) view returns (bytes32)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const SHIELD_EVENT = new ethers.Interface([
  "event Shield(uint256 treeNumber, uint256 startPosition, (bytes32 npk,(uint8 tokenType,address tokenAddress,uint256 tokenSubID) token,uint120 value)[] commitments, (bytes32[3] encryptedBundle,bytes32 shieldKey)[] shieldCiphertext, uint256[] fees)",
]);

const hex32 = value => ethers.toBeHex(value, 32);
/** A field element, the shape of a railgun public key / note random. */
const randomFieldElement = () => BigInt(ethers.hexlify(ethers.randomBytes(31))) % FIELD;

async function run() {
  const protocol = process.env.FORK_PROTOCOL || "railgun";
  const action = process.env.FORK_ACTION || "shield";
  let ctx;
  try {
    ctx = await requireFork(CHAIN);
  } catch (err) {
    return finish({ protocol, action, chain: CHAIN, block: null, ok: false, error: err.message });
  }
  const base = { protocol, action, chain: CHAIN, block: ctx.forkBlock };

  try {
    const provider = getProvider(CHAIN);
    const wallet = new ethers.Contract(WALLET, WALLET_ABI, provider);
    const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);

    // Never shield into, or pull from, an address that is empty on this fork.
    for (const [label, address] of [
      ["RailgunSmartWallet", WALLET],
      ["USDC", USDC],
    ]) {
      if ((await provider.getCode(address)) === "0x") {
        return finish({ ...base, ok: false, error: `no contract code at ${label} ${address} on the fork` });
      }
    }

    // The note hash is Poseidon; if the deployed hasher is not circomlib's, npk/commitment are not
    // the values the SDK would build and the test would be meaningless.
    const poseidonVector = BigInt(await wallet.hashLeftRight(hex32(1n), hex32(2n)));
    if (poseidonVector !== POSEIDON_1_2) {
      return finish({
        ...base,
        ok: false,
        error: `hashLeftRight(1,2) is ${poseidonVector}, not circomlib poseidon([1,2]) ${POSEIDON_1_2}`,
      });
    }
    // The documented treasury, a 0.25% shield deduction set on chain, and a token the protocol accepts.
    const treasury = await wallet.treasury();
    if (treasury.toLowerCase() !== TREASURY.toLowerCase()) {
      return finish({ ...base, ok: false, error: `treasury() is ${treasury}, docs list ${TREASURY}` });
    }
    if (await wallet.tokenBlocklist(USDC)) {
      return finish({ ...base, ok: false, error: `${USDC} is blocklisted by RailgunSmartWallet, cannot shield it` });
    }
    const shieldFee = await wallet.shieldFee();
    const [noteValue, fee] = await wallet.getFee(AMOUNT, true, shieldFee);

    // ShieldRequest.preimage, built as the SDK builds it (ShieldNote.serialize -> preimage).
    const tokenData = [TOKEN_TYPE_ERC20, USDC, 0n];
    if ((await wallet.getTokenID(tokenData)) !== hex32(USDC)) {
      return finish({ ...base, ok: false, error: `getTokenID(USDC) is not bytes32(uint256(uint160(USDC)))` });
    }
    const spendingPublicKey = randomFieldElement();
    const viewingPublicKey = randomFieldElement();
    // SDK: note random is 16 bytes; npk = poseidon([masterPublicKey, random]).
    const noteRandom = BigInt(ethers.hexlify(ethers.randomBytes(16)));
    const masterPublicKey = BigInt(await wallet.hashLeftRight(hex32(spendingPublicKey), hex32(viewingPublicKey)));
    const npk = BigInt(await wallet.hashLeftRight(hex32(masterPublicKey), hex32(noteRandom)));
    if (npk >= FIELD) {
      return finish({ ...base, ok: false, error: `npk ${npk} is outside the BN254 field` });
    }

    const preimage = [hex32(npk), tokenData, AMOUNT];
    const [preimageValid, preimageReason] = await wallet.validateCommitmentPreimage(preimage);
    if (!preimageValid) {
      return finish({ ...base, ok: false, error: `contract rejected the shield preimage: ${preimageReason}` });
    }
    // The field constraint (as in tornado-cash): an npk at or above the scalar field must be refused.
    const [outOfFieldValid] = await wallet.validateCommitmentPreimage([hex32(npk + FIELD), tokenData, AMOUNT]);
    if (outOfFieldValid) {
      return finish({ ...base, ok: false, error: `contract accepted npk >= BN254 field (${npk + FIELD})` });
    }
    // The leaf shield() inserts: PoseidonT4([npk, tokenID, valueAfterFee]) — the SDK's getShieldNoteHash().
    const expectedLeaf = await wallet.hashCommitment([hex32(npk), tokenData, noteValue]);

    // No PRIVATE_KEY: a fresh random address funded with 10 USDC from a whale (anvil_deal as backup).
    let signer;
    try {
      signer = await impersonateFunded(CHAIN, "USDC", USDC, AMOUNT);
    } catch (err) {
      signer = await impersonateAccount(ethers.Wallet.createRandom().address, CHAIN);
      if (!(await dealErc20(CHAIN, USDC, await signer.getAddress(), AMOUNT))) {
        throw new Error(`could not fund a fresh account with ${formatUnits(AMOUNT, 6)} USDC: ${err.message}`);
      }
    }
    const user = await signer.getAddress();
    await (await usdc.connect(signer).approve(WALLET, AMOUNT)).wait();

    const before = {
      wallet: await usdc.balanceOf(WALLET),
      treasury: await usdc.balanceOf(treasury),
      user: await usdc.balanceOf(user),
      treeNumber: await wallet.treeNumber(),
      nextLeafIndex: await wallet.nextLeafIndex(),
      merkleRoot: await wallet.merkleRoot(),
    };

    // The ciphertext only carries the note random encrypted to the recipient's viewing key; the
    // contract neither validates nor hashes it (the commitment covers npk/token/value), so it is
    // zeroed. That leaves the note unspendable by us, which is fine: unshield needs an off-chain proof.
    const request = {
      preimage,
      ciphertext: {
        encryptedBundle: [ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash],
        shieldKey: ethers.ZeroHash,
      },
    };
    const receipt = await (await wallet.connect(signer).shield([request], { gasLimit: 3_000_000n })).wait();

    const after = {
      wallet: await usdc.balanceOf(WALLET),
      treasury: await usdc.balanceOf(treasury),
      user: await usdc.balanceOf(user),
      treeNumber: await wallet.treeNumber(),
      nextLeafIndex: await wallet.nextLeafIndex(),
      merkleRoot: await wallet.merkleRoot(),
    };

    let shieldEvent = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== WALLET.toLowerCase()) continue;
      try {
        const parsed = SHIELD_EVENT.parseLog(log);
        if (parsed && parsed.name === "Shield") {
          shieldEvent = parsed.args;
          break;
        }
      } catch {
        // another event emitted by the wallet (Action, or the ERC20 Transfer)
      }
    }
    const committed = shieldEvent ? shieldEvent.commitments[0] : null;
    const committedPreimage = committed
      ? {
          npk: String(committed[0]).toLowerCase(),
          tokenType: Number(committed[1][0]),
          tokenAddress: String(committed[1][1]).toLowerCase(),
          tokenSubID: BigInt(committed[1][2]),
          value: BigInt(committed[2]),
        }
      : null;

    const walletDelta = after.wallet - before.wallet;
    const treasuryDelta = after.treasury - before.treasury;
    const userDelta = before.user - after.user;
    const rootKnown = await wallet.rootHistory(after.treeNumber, after.merkleRoot);

    const problems = [];
    if (receipt.status !== 1) problems.push(`shield tx reverted (status ${receipt.status})`);
    if (walletDelta !== noteValue) {
      problems.push(
        `RailgunSmartWallet USDC balance moved by ${formatUnits(walletDelta, 6)}, expected the post-fee ${formatUnits(noteValue, 6)}`
      );
    }
    if (treasuryDelta !== fee) {
      problems.push(
        `treasury moved by ${formatUnits(treasuryDelta, 6)} USDC, expected the ${formatUnits(fee, 6)} deduction (${shieldFee} bps)`
      );
    }
    if (userDelta !== AMOUNT) {
      problems.push(
        `sender paid ${formatUnits(userDelta, 6)} USDC, expected ${formatUnits(AMOUNT, 6)} (note value + fee)`
      );
    }
    if (after.nextLeafIndex !== before.nextLeafIndex + 1n) {
      problems.push(`nextLeafIndex ${before.nextLeafIndex} -> ${after.nextLeafIndex}, expected exactly +1`);
    }
    if (!shieldEvent) {
      problems.push("no Shield event from the wallet in the receipt");
    } else {
      if (BigInt(shieldEvent.treeNumber) !== before.treeNumber) {
        problems.push(`Shield treeNumber ${shieldEvent.treeNumber} is not the current tree ${before.treeNumber}`);
      }
      if (BigInt(shieldEvent.startPosition) !== before.nextLeafIndex) {
        problems.push(
          `Shield startPosition ${shieldEvent.startPosition} is not the pre-shield leaf index ${before.nextLeafIndex}`
        );
      }
      if (BigInt(shieldEvent.fees[0]) !== fee) {
        problems.push(`Shield fee ${shieldEvent.fees[0]} is not getFee()'s ${fee}`);
      }
      if (
        !committedPreimage ||
        committedPreimage.npk !== hex32(npk).toLowerCase() ||
        committedPreimage.tokenType !== TOKEN_TYPE_ERC20 ||
        committedPreimage.tokenAddress !== USDC.toLowerCase() ||
        committedPreimage.tokenSubID !== 0n ||
        committedPreimage.value !== noteValue
      ) {
        problems.push("Shield event does not carry the submitted preimage (npk/USDC/post-fee value)");
      }
    }
    if (after.merkleRoot === before.merkleRoot) {
      problems.push(`merkleRoot did not change (${after.merkleRoot})`);
    }
    if (!rootKnown) {
      problems.push(`new merkleRoot ${after.merkleRoot} is not recorded in rootHistory`);
    }

    return finish({
      ...base,
      ok: problems.length === 0,
      key:
        `walletUSDC=${formatUnits(before.wallet, 6)}->${formatUnits(after.wallet, 6)} delta=${formatUnits(walletDelta, 6)}` +
        ` treasury=${formatUnits(treasuryDelta, 6)} leaf=${before.nextLeafIndex}`,
      detail: [
        `shield ${formatUnits(AMOUNT, 6)} USDC into RailgunSmartWallet ${WALLET} (tree ${before.treeNumber}, leaf ${before.nextLeafIndex})`,
        `wallet balance ${formatUnits(before.wallet, 6)} -> ${formatUnits(after.wallet, 6)} USDC (delta ${formatUnits(walletDelta, 6)} = ${formatUnits(AMOUNT, 6)} - ${formatUnits(fee, 6)} fee)`,
        `treasury ${treasury} +${formatUnits(treasuryDelta, 6)} USDC, shieldFee ${shieldFee} bps`,
        `note npk ${hex32(npk)} random ${hex32(noteRandom)} value ${noteValue} (pre-fee ${AMOUNT}), leaf poseidon([npk,tokenID,value]) = ${expectedLeaf}`,
        `merkleRoot ${before.merkleRoot} -> ${after.merkleRoot} recorded=${rootKnown}, nextLeafIndex ${before.nextLeafIndex} -> ${after.nextLeafIndex}`,
        `tx ${receipt.hash} from ${user}`,
      ].join("\n"),
      error: problems.length ? problems.join("; ") : null,
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
