/**
 * Derive v3 (options) — permissionless USDC deposit into Derive's own Ethereum margin system.
 *
 * Derive v3 is a zkVM exchange that settles on Ethereum L1: every L1 action is appended to the
 * public queue of the OnchainActionManager, and all user collateral is escrowed in the SPOT_VAULT.
 * Deposits are not allowlisted. The documented direct path (docs.derive.xyz/getting-started/
 * depositing) is: approve the ACTION_MANAGER for the ERC-20, then call
 * depositToNewSubaccount(asset, amount, managerId, owner) where `asset` is the protocol spot asset
 * label (NOT the ERC-20). On-chain that pulls the ERC-20 from the caller straight into the asset's
 * vault (USDC -> SPOT_VAULT), checks the vault balance grew by exactly `amount`, and appends a
 * DEPOSIT_TO_NEW_SUBACCOUNT_TYPE public action; the zk batch then credits the new subaccount.
 *
 * This test deposits 100 USDC from a fresh random address and asserts:
 *   - the depositor's USDC falls by exactly 100,
 *   - SPOT_VAULT's USDC rises by exactly 100 in the same block,
 *   - a PublicActionQueued event is emitted for that account whose 76-byte payload encodes the
 *     USDC spot asset label, the amount, managerId 1 (PRIME standard margin: ETH-OPTIONS/ETH-PERP)
 *     and the depositor as owner, and whose actionId is timestamped in that block,
 *   - publicActionsAcc advances.
 *
 * Addresses: https://docs.derive.xyz/getting-started/contracts (ACTION_MANAGER, SPOT_VAULT,
 *            WITHDRAWAL_OUTBOX) and
 *            https://docs.derive.xyz/getting-started/depositing (depositToNewSubaccount, $10 minimum).
 *            The USDC protocol asset label and managerId come from Derive's public
 *            https://api.derive.xyz/v3/public/get_risk_universes and are re-verified on-chain
 *            through WITHDRAWAL_OUTBOX.resolveAsset(), which maps the label to USDC + SPOT_VAULT.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

// Mainnet addresses from https://docs.derive.xyz/getting-started/contracts
const ACTION_MANAGER = "0xE366CcA474968e33b777E13905829A3b800CFAD3";
const WITHDRAWAL_OUTBOX = "0x7c743D79C9C595cE332314503d84cBBb4E85FA63";
const SPOT_VAULT = "0x2e7dF4fAf35a1599979C7E764444e112d936ec42";
// Canonical Ethereum USDC (6 decimals), recorded by Circle:
// https://developers.circle.com/stablecoins/usdc-on-main-networks
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// Protocol spot asset label for USDC (collaterals[].address), from get_risk_universes.
const USDC_SPOT_ASSET = "0x57B03E14d409ADC7fAb6CFc44b5886CAD2D5f02b";
// PRIME / standard margin manager (ETH-OPTION, ETH-PERP, USDC collateral).
const MANAGER_ID = 1;
// OnchainActionManager.DEPOSIT_TO_NEW_SUBACCOUNT_TYPE
const DEPOSIT_TYPE = 2n;
// Docs: the exchange does not credit a deposit worth less than $10.
const MIN_DEPOSIT = 10_000_000n;

const GAS = { gasLimit: 1_000_000n };

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const MANAGER_ABI = [
  "function depositToNewSubaccount(address asset,uint256 amount,uint32 managerId,address owner_) returns (uint256)",
  "function publicActionsAcc() view returns (bytes32)",
  "function publicActionTimes(uint256) view returns (uint64)",
  "function WITHDRAWAL_OUTBOX() view returns (address)",
  "event PublicActionQueued(uint256 indexed actionId, address indexed sender, uint64 indexed actionType, bytes data, bytes32 acc)",
];

const OUTBOX_ABI = [
  "function resolveAsset(address) view returns (tuple(address vault,uint64 staticPriceX6,address token,uint8 decimals), address, bool)",
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

function decodePayload(hexWith0x) {
  const hex = hexWith0x.slice(2);
  if (hex.length !== 152) return { asset: null, amount: 0n, managerId: -1, owner: null, bytes: hex.length / 2 };
  return {
    asset: ethers.getAddress("0x" + hex.slice(0, 40)),
    amount: BigInt("0x" + hex.slice(40, 104)),
    managerId: parseInt(hex.slice(104, 112), 16),
    owner: ethers.getAddress("0x" + hex.slice(112, 152)),
    bytes: 76,
  };
}

async function deposit(base) {
  const provider = getProvider(base.chain);
  const [managerCode, outboxCode, vaultCode, usdcCode] = await Promise.all([
    provider.getCode(ACTION_MANAGER),
    provider.getCode(WITHDRAWAL_OUTBOX),
    provider.getCode(SPOT_VAULT),
    provider.getCode(USDC),
  ]);
  if (managerCode === "0x")
    return finish({ ...base, ok: false, error: `Derive ACTION_MANAGER ${ACTION_MANAGER} has no code on this fork` });
  if (outboxCode === "0x")
    return finish({
      ...base,
      ok: false,
      error: `Derive WITHDRAWAL_OUTBOX ${WITHDRAWAL_OUTBOX} has no code on this fork`,
    });
  if (vaultCode === "0x")
    return finish({ ...base, ok: false, error: `Derive SPOT_VAULT ${SPOT_VAULT} has no code on this fork` });
  if (usdcCode === "0x") return finish({ ...base, ok: false, error: `USDC ${USDC} has no code on this fork` });

  const manager = new ethers.Contract(ACTION_MANAGER, MANAGER_ABI, provider);
  const outbox = new ethers.Contract(WITHDRAWAL_OUTBOX, OUTBOX_ABI, provider);

  const [managerOutbox, resolved] = await Promise.all([
    manager.WITHDRAWAL_OUTBOX(),
    outbox.resolveAsset(USDC_SPOT_ASSET),
  ]);
  if (managerOutbox.toLowerCase() !== WITHDRAWAL_OUTBOX.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `ACTION_MANAGER points at outbox ${managerOutbox}, not the documented ${WITHDRAWAL_OUTBOX}`,
    });

  const [cfg, label, native] = resolved;
  if (label.toLowerCase() !== USDC_SPOT_ASSET.toLowerCase() || native)
    return finish({
      ...base,
      ok: false,
      error: `spot asset ${USDC_SPOT_ASSET} resolves to label ${label} native=${native}`,
    });
  if (cfg.token.toLowerCase() !== USDC.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `spot asset ${USDC_SPOT_ASSET} resolves to token ${cfg.token}, not Ethereum USDC`,
    });
  if (cfg.vault.toLowerCase() !== SPOT_VAULT.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `spot asset ${USDC_SPOT_ASSET} resolves to vault ${cfg.vault}, not SPOT_VAULT`,
    });
  if (cfg.decimals !== 6n)
    return finish({ ...base, ok: false, error: `USDC spot asset resolves to ${cfg.decimals} decimals, not 6` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  if (amount < MIN_DEPOSIT)
    return finish({
      ...base,
      ok: false,
      error: `FORK_AMOUNT ${formatUnits(amount, 6)} USDC is below Derive's documented $10 deposit minimum`,
    });

  const signer = await impersonateFunded(base.chain, "USDC", USDC, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(USDC, ERC20, signer);
  const depositManager = manager.connect(signer);

  const walletBalance = await usdc.balanceOf(user);
  if (walletBalance < amount)
    return finish({
      ...base,
      ok: false,
      error: `funded account ${user} holds ${formatUnits(walletBalance, 6)} USDC, needs ${formatUnits(amount, 6)}`,
    });

  await (await usdc.approve(ACTION_MANAGER, amount)).wait();
  const receipt = await (
    await depositManager.depositToNewSubaccount(USDC_SPOT_ASSET, amount, MANAGER_ID, user, GAS)
  ).wait();
  const at = receipt.blockNumber;

  let queued = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ACTION_MANAGER.toLowerCase()) continue;
    let parsed;
    try {
      parsed = manager.interface.parseLog(log);
    } catch {
      continue;
    }
    if (parsed && parsed.name === "PublicActionQueued") {
      queued = parsed;
      break;
    }
  }
  const payload = queued ? decodePayload(queued.args.data) : null;
  const actionId = queued ? queued.args.actionId : null;
  const actionType = queued ? queued.args.actionType : null;

  const [userPrev, userAt, vaultPrev, vaultAt, accPrev, accAt, actionTime, blockAt] = await Promise.all([
    usdc.balanceOf(user, { blockTag: at - 1 }),
    usdc.balanceOf(user, { blockTag: at }),
    usdc.balanceOf(SPOT_VAULT, { blockTag: at - 1 }),
    usdc.balanceOf(SPOT_VAULT, { blockTag: at }),
    manager.publicActionsAcc({ blockTag: at - 1 }),
    manager.publicActionsAcc({ blockTag: at }),
    actionId == null ? Promise.resolve(0n) : manager.publicActionTimes(actionId, { blockTag: at }),
    provider.getBlock(at),
  ]);

  // The pull is a plain USDC Transfer(user -> SPOT_VAULT); decode it from the receipt too so the
  // assertion does not rest on balance reads alone.
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const pulled = receipt.logs
    .filter(log => log.address.toLowerCase() === USDC.toLowerCase() && log.topics[0] === transferTopic)
    .map(log => ({
      from: ("0x" + log.topics[1].slice(26)).toLowerCase(),
      to: ("0x" + log.topics[2].slice(26)).toLowerCase(),
      value: BigInt(log.data),
    }))
    .filter(t => t.from === user.toLowerCase() && t.to === SPOT_VAULT.toLowerCase() && t.value === amount);

  const userDelta = userPrev - userAt;
  const vaultDelta = vaultAt - vaultPrev;

  const checks = {
    event: Boolean(queued),
    sender: queued != null && queued.args.sender.toLowerCase() === user.toLowerCase(),
    actionType: actionType === DEPOSIT_TYPE,
    payloadAsset:
      payload != null && payload.asset != null && payload.asset.toLowerCase() === USDC_SPOT_ASSET.toLowerCase(),
    payloadAmount: payload != null && payload.amount === amount,
    payloadManager: payload != null && payload.managerId === MANAGER_ID,
    payloadOwner: payload != null && payload.owner != null && payload.owner.toLowerCase() === user.toLowerCase(),
    payloadBytes: payload != null && payload.bytes === 76,
    userDelta: userDelta === amount,
    vaultDelta: vaultDelta === amount,
    transfer: pulled.length === 1,
    accChanged: accAt !== accPrev,
    actionRecordedAt: actionTime === BigInt(blockAt.timestamp),
  };
  const ok = Object.values(checks).every(Boolean);

  const reasons = [];
  if (!checks.event) reasons.push("no PublicActionQueued event from the ACTION_MANAGER");
  if (checks.event && !checks.sender) reasons.push(`event sender ${queued.args.sender} != ${user}`);
  if (checks.event && !checks.actionType) reasons.push(`actionType ${actionType} != ${DEPOSIT_TYPE}`);
  if (!checks.payloadAsset) reasons.push("queued payload asset is not the USDC spot asset label");
  if (!checks.payloadAmount) reasons.push("queued payload amount is not the deposited amount");
  if (!checks.payloadManager) reasons.push(`queued payload managerId is not ${MANAGER_ID}`);
  if (!checks.payloadOwner) reasons.push("queued payload owner is not the depositor");
  if (!checks.payloadBytes) reasons.push(`queued payload is ${payload ? payload.bytes : "?"} bytes, not 76`);
  if (!checks.userDelta) reasons.push(`depositor USDC delta ${formatUnits(userDelta, 6)} != ${formatUnits(amount, 6)}`);
  if (!checks.vaultDelta)
    reasons.push(`SPOT_VAULT USDC delta ${formatUnits(vaultDelta, 6)} != ${formatUnits(amount, 6)}`);
  if (!checks.transfer)
    reasons.push("no single USDC Transfer(user -> SPOT_VAULT) of the deposit amount in the receipt");
  if (!checks.accChanged) reasons.push("publicActionsAcc did not change");
  if (!checks.actionRecordedAt) reasons.push("queued actionId is not timestamped in the deposit block");

  return finish({
    ...base,
    ok,
    key: `usdc-${formatUnits(userDelta, 6)} spotVault+${formatUnits(vaultDelta, 6)} actionId=${
      actionId == null ? "-" : actionId.toString()
    } type=2 managerId=${MANAGER_ID}`,
    detail:
      `Derive v3 OnchainActionManager ${ACTION_MANAGER}: depositToNewSubaccount(${USDC_SPOT_ASSET} USDC label, ` +
      `${formatUnits(amount, 6)} USDC, managerId ${MANAGER_ID}, owner ${user})\n` +
      `USDC ${formatUnits(userPrev, 6)} -> ${formatUnits(userAt, 6)} for the depositor; SPOT_VAULT ${SPOT_VAULT} ` +
      `${formatUnits(vaultPrev, 6)} -> ${formatUnits(vaultAt, 6)} USDC (+${formatUnits(vaultDelta, 6)})\n` +
      (queued
        ? `queued public action #${actionId} type=${actionType} (DEPOSIT_TO_NEW_SUBACCOUNT_TYPE) in block ${at}: ` +
          `payload asset=${payload.asset} amount=${formatUnits(payload.amount, 6)} managerId=${payload.managerId} ` +
          `owner=${payload.owner}; publicActionsAcc ${accPrev} -> ${accAt}\n`
        : "no public action was queued\n") +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block}). The zkVM credits the new subaccount ` +
      `asynchronously, so the L1 leg (exact pull + queued action) is what is observable on a fork.`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "derive-v3";
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
