/**
 * Fluid Lending — permissionless ERC-4626 deposit into the fUSDC fToken on Ethereum.
 *
 * fUSDC is Fluid's own lending token: it is created by the FluidLendingFactory with
 * (Fluid Liquidity, Lending Factory, USDC) wired in its constructor. Its deposit(assets, receiver)
 * is a public ERC-4626 entry point (verified source: fToken.main.sol). The call path is
 *   fUSDC.deposit() -> LIQUIDITY.operate(asset, +assets, ..., abi.encode(msg.sender))
 *   -> fUSDC.liquidityCallback() -> USDC.transferFrom(msg.sender, LIQUIDITY, assets)
 * so the underlying always ends up in the Fluid Liquidity contract that backs every fToken, and
 * the depositor only needs a plain USDC approval to the fToken. There is no whitelist and no
 * liquidity-layer-only gate on deposit(); the liquidity-layer callback is internal plumbing, not
 * an access restriction (contrast fToken.liquidityCallback itself, which is Liquidity-only).
 *
 * This test deposits 100 USDC from a fresh random address and asserts the ERC-4626 outcome:
 *   - the deposit mints exactly previewDeposit() shares (a deposit that lands in a later second
 *     can only round a hair below preview, never above, because the exchange price is monotonic),
 *   - totalSupply rises by exactly the minted shares,
 *   - the fToken's underlying (totalAssets) rises by the 100 USDC deposit, plus at most one
 *     block of accrued interest,
 *   - the USDC balance of the Fluid Liquidity contract (which holds all fToken underlying; the
 *     fToken contract itself never holds funds) rises by exactly 100 USDC,
 *   - a Deposit(sender, receiver, assets, shares) event is emitted by the fToken, matching.
 *
 * Addresses: https://docs.fluid.instadapp.io/contracts/contract-addresses.html points at the
 * deployment registry https://github.com/instadapp/fluid-contracts-public/blob/main/deployments/deployments.md
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

const CHAIN = "ethereum";

// https://github.com/instadapp/fluid-contracts-public/blob/main/deployments/deployments.md (fToken_fUSDC, mainnet)
const FUSDC = "0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33";
// https://github.com/instadapp/fluid-contracts-public/blob/main/deployments/deployments.md (Liquidity, mainnet)
const LIQUIDITY = "0x52Aa899454998Be5b000Ad077a46Bbe360F4e497";
// https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const GAS = { gasLimit: 2_000_000n };
const YEAR = 31_536_000n;
// totalAssets() is re-derived as totalSupply * exchangePrice / 1e27, so the book value of a
// deposit can round down by a couple of micro-USDC even though exactly 100 USDC moved.
const ASSET_ROUNDING = 10n;

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const FTOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function minDeposit() view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
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
  // Fluid reverts with custom errors (4-byte selector + args); keep the selector for triage.
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

async function deposit(base) {
  const provider = getProvider(base.chain);
  const [fTokenCode, usdcCode, liquidityCode] = await Promise.all([
    provider.getCode(FUSDC),
    provider.getCode(USDC),
    provider.getCode(LIQUIDITY),
  ]);
  if (fTokenCode === "0x") return finish({ ...base, ok: false, error: `fUSDC ${FUSDC} has no code on this fork` });
  if (usdcCode === "0x") return finish({ ...base, ok: false, error: `USDC ${USDC} has no code on this fork` });
  if (liquidityCode === "0x")
    return finish({ ...base, ok: false, error: `Fluid Liquidity ${LIQUIDITY} has no code on this fork` });

  const read = new ethers.Contract(FUSDC, FTOKEN_ABI, provider);
  const [name, symbol, asset, shareDecimals, maxDeposit, minDeposit] = await Promise.all([
    read.name(),
    read.symbol(),
    read.asset(),
    read.decimals(),
    read.maxDeposit(ethers.ZeroAddress),
    read.minDeposit(),
  ]);
  if (asset.toLowerCase() !== USDC.toLowerCase())
    return finish({ ...base, ok: false, error: `${name}: asset() is ${asset}, not Ethereum USDC` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", USDC, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(USDC, ERC20, signer);
  const fToken = new ethers.Contract(FUSDC, FTOKEN_ABI, signer);

  const balance = await usdc.balanceOf(user);
  if (balance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(balance, 6)} USDC` });

  const preview = await fToken.previewDeposit(amount);
  if (preview === 0n) return finish({ ...base, ok: false, error: "previewDeposit returned 0 shares; no tx sent" });

  await (await usdc.approve(FUSDC, amount)).wait();
  const receipt = await (await fToken["deposit(uint256,address)"](amount, user, GAS)).wait();
  const at = receipt.blockNumber;

  const [assetsAt, assetsPrev, supplyAt, supplyPrev, sharesAt, sharesPrev, liqAt, liqPrev, blockAt, blockPrev] =
    await Promise.all([
      fToken.totalAssets({ blockTag: at }),
      fToken.totalAssets({ blockTag: at - 1 }),
      fToken.totalSupply({ blockTag: at }),
      fToken.totalSupply({ blockTag: at - 1 }),
      fToken.balanceOf(user, { blockTag: at }),
      fToken.balanceOf(user, { blockTag: at - 1 }),
      usdc.balanceOf(LIQUIDITY, { blockTag: at }),
      usdc.balanceOf(LIQUIDITY, { blockTag: at - 1 }),
      provider.getBlock(at),
      provider.getBlock(at - 1),
    ]);

  const iface = new ethers.Interface(FTOKEN_ABI);
  const depositLog = receipt.logs.find(
    log => log.address.toLowerCase() === FUSDC.toLowerCase() && log.topics[0] === iface.getEvent("Deposit").topicHash
  );
  const depositArgs = depositLog ? iface.parseLog(depositLog).args : null;

  const minted = sharesAt - sharesPrev;
  const supplyDelta = supplyAt - supplyPrev;
  const assetsDelta = assetsAt - assetsPrev;
  const underlyingDelta = liqAt - liqPrev;
  const shareValue = await fToken.convertToAssets(minted, { blockTag: at });
  // A deposit that lands in a later second than the preview accrues a sliver of interest, so it can
  // only mint slightly fewer shares. Allow 1e-6 relative drift; a same-second deposit matches exactly.
  const shareDrift = preview > minted ? preview - minted : minted - preview;
  const shareTolerance = preview / 1_000_000n;
  const valueDrift = shareValue > amount ? shareValue - amount : amount - shareValue;
  // totalAssets() is marked with the block timestamp, so a deposit that lands in a later second
  // also books that second's interest on the whole pool. Bound it generously: 100% APY + 2 USDC.
  const seconds = BigInt(Math.max(1, blockAt.timestamp - blockPrev.timestamp));
  const interestBound = (assetsPrev * seconds) / YEAR + 2_000_000n;
  const extraInterest = assetsDelta > amount ? assetsDelta - amount : 0n;

  const eventOk =
    depositArgs != null &&
    depositArgs.sender.toLowerCase() === user.toLowerCase() &&
    depositArgs.owner.toLowerCase() === user.toLowerCase() &&
    depositArgs.assets === amount &&
    depositArgs.shares === minted;
  const previewOk = minted > 0n && minted <= preview && shareDrift <= shareTolerance;

  const ok =
    receipt.status === 1 &&
    previewOk &&
    eventOk &&
    supplyDelta === minted &&
    assetsDelta > 0n &&
    assetsDelta + ASSET_ROUNDING >= amount &&
    extraInterest <= interestBound &&
    underlyingDelta === amount &&
    valueDrift <= amount / 10_000n;

  const reasons = [];
  if (minted === 0n) reasons.push("no shares minted");
  if (minted > preview)
    reasons.push(
      `minted ${formatUnits(minted, shareDecimals)} > previewDeposit ${formatUnits(preview, shareDecimals)}`
    );
  else if (shareDrift > shareTolerance)
    reasons.push(
      `minted ${formatUnits(minted, shareDecimals)} vs previewDeposit ${formatUnits(preview, shareDecimals)}`
    );
  if (!eventOk)
    reasons.push(
      depositArgs
        ? `Deposit event sender=${depositArgs.sender} owner=${depositArgs.owner} assets=${depositArgs.assets} shares=${depositArgs.shares}`
        : `no Deposit event from ${FUSDC} in tx ${receipt.hash}`
    );
  if (supplyDelta !== minted) reasons.push(`totalSupply +${supplyDelta} != minted ${minted}`);
  if (assetsDelta + ASSET_ROUNDING < amount)
    reasons.push(`totalAssets +${formatUnits(assetsDelta, 6)} < deposit (beyond rounding)`);
  if (extraInterest > interestBound)
    reasons.push(`totalAssets +${formatUnits(assetsDelta, 6)} exceeds deposit + interest bound`);
  if (underlyingDelta !== amount)
    reasons.push(`Fluid Liquidity USDC balance +${formatUnits(underlyingDelta, 6)} != deposit`);
  if (valueDrift > amount / 10_000n)
    reasons.push(`minted shares convertToAssets ${formatUnits(shareValue, 6)} != 100 USDC`);

  return finish({
    ...base,
    ok,
    key:
      `shares=${formatUnits(minted, shareDecimals)} previewDeposit=${formatUnits(preview, shareDecimals)} ` +
      `totalSupply+=${formatUnits(supplyDelta, shareDecimals)} totalAssets+=${formatUnits(assetsDelta, 6)}USDC ` +
      `underlying+=${formatUnits(underlyingDelta, 6)}USDC deposit=${formatUnits(amount, 6)}USDC`,
    detail:
      `${name} (${symbol}, ${shareDecimals} decimals) asset=USDC, deposit() permissionless; ` +
      `maxDeposit=${formatUnits(maxDeposit, 6)} USDC, minDeposit=${formatUnits(minDeposit, shareDecimals)}\n` +
      `deposited ${formatUnits(amount, 6)} USDC from fresh ${user}: minted ${formatUnits(minted, shareDecimals)} shares ` +
      `(previewDeposit ${formatUnits(preview, shareDecimals)}, drift ${formatUnits(shareDrift, shareDecimals)}), ` +
      `shares now worth ${formatUnits(shareValue, 6)} USDC\n` +
      `totalSupply ${formatUnits(supplyPrev, shareDecimals)} -> ${formatUnits(supplyAt, shareDecimals)}; ` +
      `totalAssets ${formatUnits(assetsPrev, 6)} -> ${formatUnits(assetsAt, 6)} USDC in the deposit block ` +
      `(+${formatUnits(extraInterest, 6)} USDC of accrued interest on top of the deposit)\n` +
      `Fluid Liquidity USDC balance ${formatUnits(liqPrev, 6)} -> ${formatUnits(liqAt, 6)} ` +
      `(+${formatUnits(underlyingDelta, 6)} USDC = the deposit; the fToken itself never holds funds)\n` +
      `Deposit event sender=${depositArgs?.sender} owner=${depositArgs?.owner} assets=${formatUnits(depositArgs?.assets ?? 0n, 6)} ` +
      `shares=${formatUnits(depositArgs?.shares ?? 0n, shareDecimals)}\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block})`,
    error: ok ? null : reasons.join("; "),
  });
}


// ---------- Vault borrow (T1 operate) ----------
// ETH/USDC vault #11 has live borrow room (vaults 1-10 are at hard borrow caps).
// https://docs.fluid.instadapp.io/fluid-integration/borrow/write/deposit-borrow-t1.html
// https://api.fluid.instadapp.io/v2/1/vaults id=11
const VAULT_ETH_USDC = "0x0C8C77B7FF4c2aF7F6CEBbe67350A490E3DD6cB3";
const VAULT_ABI = [
  "function operate(uint256 nftId_, int256 newCol_, int256 newDebt_, address to_) payable returns (uint256 nftId, int256 supplyAmt, int256 borrowAmt)",
  "function constantsView() view returns (address liquidity, address factory, address adminImplementation, address secondaryImplementation, address supplyToken)",
];

async function vaultBorrow(base) {
  const provider = getProvider(base.chain);
  const { impersonateAccount } = require("../../../utils/impersonate");
  const vaultCode = await provider.getCode(VAULT_ETH_USDC);
  if (vaultCode === "0x") {
    return finish({ ...base, ok: false, error: `Fluid vault ${VAULT_ETH_USDC} has no code` });
  }
  const vaultRead = new ethers.Contract(VAULT_ETH_USDC, VAULT_ABI, provider);
  const constants = await vaultRead.constantsView();
  if (constants.supplyToken.toLowerCase() !== "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
    return finish({ ...base, ok: false, error: `Expected native ETH supply token, got ${constants.supplyToken}` });
  }
  const coll = ethers.parseEther(process.env.FORK_COLLATERAL || "1");
  const debt = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6); // 100 USDC
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(coll + ethers.parseEther("1"))]);
  const usdc = new ethers.Contract(USDC, ERC20, provider);
  const vault = new ethers.Contract(VAULT_ETH_USDC, VAULT_ABI, signer);
  const usdcBefore = await usdc.balanceOf(user);
  const ethBefore = await provider.getBalance(user);
  // nftId=0 opens a new position; positive newCol deposits ETH; positive newDebt borrows USDC.
  const tx = await vault.operate(0, coll, debt, user, { ...GAS, value: coll });
  const receipt = await tx.wait();
  const usdcAfter = await usdc.balanceOf(user);
  const ethAfter = await provider.getBalance(user);
  const borrowed = usdcAfter - usdcBefore;
  const ok = borrowed === debt && ethBefore - ethAfter >= coll;
  return finish({
    ...base,
    ok,
    key: `coll=${formatUnits(coll, 18)}ETH borrowed=${formatUnits(borrowed, 6)}USDC`,
    detail: `Fluid vault operate(nftId=0, +${formatUnits(coll, 18)} ETH, +${formatUnits(debt, 6)} USDC) on ${VAULT_ETH_USDC}\nUSDC ${formatUnits(usdcBefore, 6)} -> ${formatUnits(usdcAfter, 6)}\nETH spent >= ${formatUnits(coll, 18)} (gas inclusive)\ntx ${receipt.hash}`,
    error: ok ? null : "Fluid vault operate() did not credit the borrowed USDC",
  });
}


async function run() {
  const chain = process.env.CHAIN || CHAIN;
  const protocol = process.env.FORK_PROTOCOL || "fluid-lending";
  const action = process.env.FORK_ACTION || "deposit";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  if (chain !== CHAIN) {
    return finish({ ...base, ok: false, error: `Fluid Lending fUSDC is wired for ${CHAIN} only (got ${chain})` });
  }
  try {
    if (action === "deposit") return await deposit(base);
    if (action === "borrow" || action === "vault-borrow") return await vaultBorrow(base);
    return finish({ ...base, ok: false, error: `Unknown Fluid Lending action ${action}` });
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
