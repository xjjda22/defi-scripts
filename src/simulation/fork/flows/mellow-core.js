/**
 * Mellow Core — permissionless USDC deposit into a Core Vault on Ethereum.
 *
 * Mellow Core Vaults are the vault architecture behind Lido Earn and the other products on
 * Mellow's Deployments page ("Core Vaults are architecturally beyond ERC-4626" —
 * https://docs.mellow.finance/mellow-vaults-overview). A Core Vault therefore has no
 * totalAssets()/previewDeposit(): accounting lives in the ShareManager (share ERC-20) and the
 * vault Oracle, which reports a price with the documented invariant `shares = assets * price`
 * (https://docs.mellow.finance/core-vaults-integration-guide). Mellow's own Collector computes
 * the vault's total assets in the base asset as `totalShares * 1e18 / priceD18`
 * (scripts/collectors/Collector.sol, `totalBase`), so that is the totalAssets read used here.
 *
 * The deposit target is Lido Earn USD (earnUSD, a MetaVault built on Mellow Core Vaults and
 * listed on both Mellow's Deployments page and its Lido Earn deployments page). Its USDC
 * SyncDepositQueue settles in the same transaction at the latest oracle price, with no
 * whitelist: ShareManager.flags().hasWhitelist is false and isDepositorWhitelisted() returns
 * true for an arbitrary address, so the deposit is permissionless. The flow deposits 100 USDC
 * from a fresh impersonated account and asserts the shares minted equal the queue's documented
 * preview (assets * priceD18 / 1e18, penalty and deposit fee included), the ShareManager
 * totalShares delta equals the mint, the Collector-style total assets grow by exactly 100 USDC,
 * and the depositor's USDC falls by exactly 100.
 *
 * Addresses: https://docs.mellow.finance/lido-earn/deployments
 *            https://docs.mellow.finance/core-vaults/core-deployments
 *            https://api.mellow.finance/v1/vaults (vault -> shareManager, oracle, collector)
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, dealErc20, impersonateFunded, formatUnits, finish } = require("../runtime");

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Lido Earn USD (earnUSD) — Mellow Core Vault, Ethereum. https://docs.mellow.finance/lido-earn/deployments
const EARN_USD_VAULT = "0x014e6DA8F283C4aF65B2AA0f201438680A004452";
const EARN_USD_SYNC_DEPOSIT_QUEUE = "0xf6AFAf6afcAe116dD37A779D50fE6c5fa6f8C8f5";
const EARN_USD_SHARE_MANAGER = "0x4Ce1ac8F43E0E5BD7A346A98aF777bF8fbeA1981";
const EARN_USD_ORACLE = "0x827044735c9708a2cf850e7Ea37EBa43bc786028";
const EARN_USD_FEE_MANAGER = "0x72fa23f40e08eB9E45953233b2Dd9665E347e8Dc";

const GAS = { gasLimit: 1_500_000n };

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const VAULT_ABI = [
  "function shareManager() view returns (address)",
  "function oracle() view returns (address)",
  "function feeManager() view returns (address)",
  "function isDepositQueue(address) view returns (bool)",
  "function isPausedQueue(address) view returns (bool)",
];

const QUEUE_ABI = [
  "function name() view returns (string)",
  "function asset() view returns (address)",
  "function syncDepositParams() view returns (uint256 penaltyD6, uint32 maxAge)",
  "function deposit(uint224 assets, address referral, bytes32[] merkleProof)",
];

const SHARE_MANAGER_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function flags() view returns (bool hasMintPause, bool hasBurnPause, bool hasTransferPause, bool hasWhitelist, bool hasTransferWhitelist, uint32 globalLockup)",
  "function totalShares() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function isDepositorWhitelisted(address account, bytes32[] merkleProof) view returns (bool)",
];

const ORACLE_ABI = [
  "function getReport(address asset) view returns (uint256 priceD18, uint32 timestamp, bool isSuspicious)",
];

const FEE_MANAGER_ABI = [
  "function baseAsset(address vault) view returns (address)",
  "function depositFeeD6() view returns (uint256)",
  "function calculateDepositFee(uint256 amount) view returns (uint256)",
  "function feeRecipient() view returns (address)",
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

  // Pre-flight: every address this test reads or calls must be a contract on the fork.
  for (const [name, address] of [
    ["EarnUSD vault", EARN_USD_VAULT],
    ["USDC sync deposit queue", EARN_USD_SYNC_DEPOSIT_QUEUE],
    ["ShareManager", EARN_USD_SHARE_MANAGER],
    ["Oracle", EARN_USD_ORACLE],
    ["FeeManager", EARN_USD_FEE_MANAGER],
    ["USDC", USDC],
  ]) {
    const code = await provider.getCode(address);
    if (code === "0x") return finish({ ...base, ok: false, error: `${name} ${address} has no code on this fork` });
  }

  const vault = new ethers.Contract(EARN_USD_VAULT, VAULT_ABI, provider);
  const [shareManagerAddress, oracleAddress, feeManagerAddress] = await Promise.all([
    vault.shareManager(),
    vault.oracle(),
    vault.feeManager(),
  ]);
  if (shareManagerAddress.toLowerCase() !== EARN_USD_SHARE_MANAGER.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `vault shareManager() is ${shareManagerAddress}, not ${EARN_USD_SHARE_MANAGER}`,
    });
  if (oracleAddress.toLowerCase() !== EARN_USD_ORACLE.toLowerCase())
    return finish({ ...base, ok: false, error: `vault oracle() is ${oracleAddress}, not ${EARN_USD_ORACLE}` });
  if (feeManagerAddress.toLowerCase() !== EARN_USD_FEE_MANAGER.toLowerCase())
    return finish({
      ...base,
      ok: false,
      error: `vault feeManager() is ${feeManagerAddress}, not ${EARN_USD_FEE_MANAGER}`,
    });

  const queueRead = new ethers.Contract(EARN_USD_SYNC_DEPOSIT_QUEUE, QUEUE_ABI, provider);
  const [queueName, queueAsset, isDepositQueue, isQueuePaused, syncParams] = await Promise.all([
    queueRead.name(),
    queueRead.asset(),
    vault.isDepositQueue(EARN_USD_SYNC_DEPOSIT_QUEUE),
    vault.isPausedQueue(EARN_USD_SYNC_DEPOSIT_QUEUE),
    queueRead.syncDepositParams(),
  ]);
  if (queueName !== "SyncDepositQueue")
    return finish({
      ...base,
      ok: false,
      error: `${EARN_USD_SYNC_DEPOSIT_QUEUE} is a ${queueName}, not a SyncDepositQueue`,
    });
  if (queueAsset.toLowerCase() !== USDC.toLowerCase())
    return finish({ ...base, ok: false, error: `queue asset() is ${queueAsset}, not USDC` });
  if (!isDepositQueue)
    return finish({ ...base, ok: false, error: `${EARN_USD_SYNC_DEPOSIT_QUEUE} is not a deposit queue of the vault` });
  if (isQueuePaused) return finish({ ...base, ok: false, error: "the USDC sync deposit queue is paused" });
  const penaltyD6 = syncParams.penaltyD6;
  const maxAge = syncParams.maxAge;

  const shares = new ethers.Contract(EARN_USD_SHARE_MANAGER, SHARE_MANAGER_ABI, provider);
  const oracle = new ethers.Contract(EARN_USD_ORACLE, ORACLE_ABI, provider);
  const feeManager = new ethers.Contract(EARN_USD_FEE_MANAGER, FEE_MANAGER_ABI, provider);
  const [vaultName, shareSymbol, shareDecimals, flags, baseAsset, depositFeeD6] = await Promise.all([
    shares.name(),
    shares.symbol(),
    shares.decimals(),
    shares.flags(),
    feeManager.baseAsset(EARN_USD_VAULT),
    feeManager.depositFeeD6(),
  ]);
  if (baseAsset.toLowerCase() !== USDC.toLowerCase())
    return finish({ ...base, ok: false, error: `${vaultName}: FeeManager baseAsset() is ${baseAsset}, not USDC` });
  if (flags.hasWhitelist)
    return finish({
      ...base,
      ok: false,
      error: `${vaultName} has a deposit whitelist (hasWhitelist=true); not permissionless`,
    });
  if (flags.hasMintPause) return finish({ ...base, ok: false, error: `${vaultName} has minting paused` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", USDC, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(USDC, ERC20, signer);
  const queue = new ethers.Contract(EARN_USD_SYNC_DEPOSIT_QUEUE, QUEUE_ABI, signer);

  let balance = await usdc.balanceOf(user);
  if (balance < amount) {
    if (!(await dealErc20(base.chain, USDC, user, amount)))
      return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 6)} USDC` });
    balance = await usdc.balanceOf(user);
  }
  if (!(await shares.isDepositorWhitelisted(user, [])))
    return finish({ ...base, ok: false, error: `${vaultName}: fresh account ${user} is not allowed to deposit` });

  const head = await provider.getBlockNumber();
  const [report, headBlock] = await Promise.all([oracle.getReport(USDC, { blockTag: head }), provider.getBlock(head)]);
  if (report.isSuspicious || report.priceD18 === 0n)
    return finish({
      ...base,
      ok: false,
      error: `USDC oracle report is unusable (price=${report.priceD18}, suspicious=${report.isSuspicious})`,
    });
  if (BigInt(report.timestamp) + BigInt(maxAge) < BigInt(headBlock.timestamp))
    return finish({
      ...base,
      ok: false,
      error: `USDC oracle report is stale: ${report.timestamp}+${maxAge} < ${headBlock.timestamp}; the sync queue would revert StaleReport`,
    });

  // The SyncDepositQueue mints `assets * priceD18 / 1e18`, where priceD18 is the oracle report
  // price scaled by (1e6 - penaltyD6)/1e6, then deducts the deposit fee. This is the preview of
  // the deposit (Mellow Core Vaults expose no ERC-4626 previewDeposit()).
  const effectivePrice = (report.priceD18 * (1_000_000n - penaltyD6)) / 1_000_000n;
  const previewShares = (amount * effectivePrice) / 10n ** 18n;
  const feeShares = await feeManager.calculateDepositFee(previewShares);
  const expectedShares = previewShares - feeShares;
  if (expectedShares === 0n)
    return finish({
      ...base,
      ok: false,
      error: `previewDeposit(${formatUnits(amount, 6)} USDC) returned 0 shares; no tx sent`,
    });

  const supplyBefore = await shares.totalShares({ blockTag: head });

  await (await usdc.approve(EARN_USD_SYNC_DEPOSIT_QUEUE, amount)).wait();
  const receipt = await (await queue.deposit(amount, ethers.ZeroAddress, [], GAS)).wait();
  const at = receipt.blockNumber;

  const [supplyAt, supplyPrev, sharesAt, sharesPrev, usdcAt, usdcPrev, reportAt, reportPrev, feeRecipient] =
    await Promise.all([
      shares.totalShares({ blockTag: at }),
      shares.totalShares({ blockTag: at - 1 }),
      shares.balanceOf(user, { blockTag: at }),
      shares.balanceOf(user, { blockTag: at - 1 }),
      usdc.balanceOf(user, { blockTag: at }),
      usdc.balanceOf(user, { blockTag: at - 1 }),
      oracle.getReport(USDC, { blockTag: at }),
      oracle.getReport(USDC, { blockTag: at - 1 }),
      feeManager.feeRecipient(),
    ]);

  const minted = sharesAt - sharesPrev;
  const supplyDelta = supplyAt - supplyPrev;
  const spent = usdcPrev - usdcAt;

  // Mellow Collector totalBase: total assets in the base asset = totalShares * 1e18 / priceD18.
  const totalAssetsAt = (supplyAt * 10n ** 18n) / reportAt.priceD18;
  const totalAssetsPrev = (supplyPrev * 10n ** 18n) / reportPrev.priceD18;
  const assetsDelta = totalAssetsAt - totalAssetsPrev;

  let feeRecipientDelta = 0n;
  if (feeShares > 0n) {
    const [feeAt, feePrev] = await Promise.all([
      shares.balanceOf(feeRecipient, { blockTag: at }),
      shares.balanceOf(feeRecipient, { blockTag: at - 1 }),
    ]);
    feeRecipientDelta = feeAt - feePrev;
  }

  // Integer division in totalBase can lose at most a couple of wei at these magnitudes.
  const assetsDrift = assetsDelta > amount ? assetsDelta - amount : amount - assetsDelta;

  const ok =
    minted > 0n &&
    minted === expectedShares &&
    supplyDelta === minted &&
    assetsDelta > 0n &&
    assetsDrift <= 2n &&
    spent === amount &&
    (feeShares === 0n || feeRecipientDelta === feeShares);

  const reasons = [];
  if (minted === 0n) reasons.push("no shares minted");
  if (minted !== expectedShares)
    reasons.push(`minted ${formatUnits(minted, 18)} vs previewDeposit ${formatUnits(expectedShares, 18)}`);
  if (supplyDelta !== minted) reasons.push(`totalSupply +${supplyDelta} != minted ${minted}`);
  if (assetsDelta === 0n) reasons.push("totalAssets did not move");
  if (assetsDrift > 2n)
    reasons.push(`totalAssets +${formatUnits(assetsDelta, 6)} != deposit ${formatUnits(amount, 6)} USDC`);
  if (spent !== amount)
    reasons.push(`depositor spent ${formatUnits(spent, 6)} USDC, expected ${formatUnits(amount, 6)}`);
  if (feeShares > 0n && feeRecipientDelta !== feeShares)
    reasons.push(
      `fee recipient got ${formatUnits(feeRecipientDelta, 18)} shares, expected ${formatUnits(feeShares, 18)}`
    );

  return finish({
    ...base,
    ok,
    key:
      `shares=${formatUnits(minted, 18)} previewDeposit=${formatUnits(expectedShares, 18)} ` +
      `totalSupply+=${formatUnits(supplyDelta, 18)} totalAssets+=${formatUnits(assetsDelta, 6)}USDC ` +
      `deposit=${formatUnits(amount, 6)}USDC`,
    detail:
      `${vaultName} (${shareSymbol}, ${shareDecimals} decimals) on a Mellow Core Vault, ` +
      `shareManager=${shareManagerAddress}, asset=USDC\n` +
      `deposit ${formatUnits(amount, 6)} USDC from fresh ${user} through SyncDepositQueue ${EARN_USD_SYNC_DEPOSIT_QUEUE}: ` +
      `minted ${formatUnits(minted, 18)} shares (previewDeposit ${formatUnits(expectedShares, 18)} = ` +
      `${formatUnits(amount, 6)} USDC * price ${reportAt.priceD18} / 1e18, penaltyD6=${penaltyD6}, depositFeeD6=${depositFeeD6}, ` +
      `feeShares ${formatUnits(feeShares, 18)})\n` +
      `ShareManager totalShares ${formatUnits(supplyBefore, 18)} -> ${formatUnits(supplyAt, 18)}; ` +
      `totalAssets ${formatUnits(totalAssetsPrev, 6)} -> ${formatUnits(totalAssetsAt, 6)} USDC ` +
      `(+${formatUnits(assetsDelta, 6)} USDC); depositor USDC -${formatUnits(spent, 6)}\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL || "mellow-core";
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
