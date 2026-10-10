/**
 * Vault curator and allocator fork actions on Ethereum.
 * ERC-4626 deposit then redeem when maxDeposit is open. maxDeposit 0 is a read.
 * Addresses and doc links: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { VAULTS, VEDA, UPSHIFT } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const VAULT_ABI = [
  ...ERC,
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function asset() view returns (address)",
];
const TELLER_ABI = [
  "function deposit(address depositAsset, uint256 depositAmount, uint256 minimumMint) payable returns (uint256)",
  "function isPaused() view returns (bool)",
  "function assetData(address) view returns (bool allowDeposits, bool allowWithdraws, uint16 sharePremium)",
];
const UPSHIFT_ABI = [
  ...ERC,
  "function deposit(address asset, uint256 amount, address receiver)",
  "function instantRedeem(uint256 shares, address receiver)",
  "function requestRedeem(uint256 shares, address receiver)",
  "function depositsPaused() view returns (bool)",
  "function instantRedemptionFee() view returns (uint256)",
  "function maxDepositAmount() view returns (uint256)",
  "function getSharePrice() view returns (uint256)",
  "function previewDeposit(address asset, uint256 amount) view returns (uint256)",
];

const GAS = { gasLimit: 1_500_000n };

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  const reason = err.reason || (err.revert && err.revert.args && err.revert.args.join(" "));
  return `${reason || err.shortMessage || err.message || err} ${data}`.trim();
}

function gated(message) {
  return /whitelist|allowlist|paused|max ?deposit|not allowed|unauthorized|permission|onlyrole|accesscontrol|disabled|cap/i.test(
    String(message || "")
  );
}

async function forkOrFail(protocol, action) {
  const chain = "ethereum";
  try {
    const ctx = await requireFork(chain);
    return { chain, block: ctx.forkBlock, protocol, action };
  } catch (err) {
    finish({ ok: false, protocol, action, chain, block: null, error: err.message });
    return null;
  }
}

async function approve(token, signer, spender, amount) {
  const erc = new ethers.Contract(token, ERC, signer);
  await (await erc.approve(spender, amount)).wait();
}

async function readVault(base, spec, reason) {
  const provider = getProvider(base.chain);
  const vault = new ethers.Contract(spec.vault, VAULT_ABI, provider);
  const assets = await vault.totalAssets();
  const shareDecimals = Number(await vault.decimals());
  let rate = null;
  try {
    rate = await vault.convertToAssets(10n ** BigInt(shareDecimals));
  } catch {
    rate = null;
  }
  const ok = assets > 0n;
  const rateKey = rate == null ? "" : ` rate=${formatUnits(rate, spec.decimals)}`;
  return finish({
    ...base,
    ok,
    key: `readOnly=${reason} totalAssets=${formatUnits(assets, spec.decimals)}${rateKey}`,
    detail: `${spec.label} ${reason}. totalAssets ${formatUnits(assets, spec.decimals)} ${spec.symbol}. No deposit.`,
    error: ok ? null : `${spec.label} totalAssets was 0`,
  });
}

async function erc4626(base, spec) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(spec.vault, VAULT_ABI, provider);
  const probe = ethers.Wallet.createRandom().address;
  const max = await reader.maxDeposit(probe);
  if (max === 0n) return readVault(base, spec, "maxDeposit=0");
  const wanted = ethers.parseUnits(process.env.FORK_AMOUNT || spec.defaultAmount, spec.decimals);
  const amount = wanted < max ? wanted : max;
  if (amount === 0n) return readVault(base, spec, "maxDeposit=0");
  const signer = await impersonateFunded(base.chain, spec.symbol, spec.asset, amount);
  const user = await signer.getAddress();
  const asset = new ethers.Contract(spec.asset, ERC, provider);
  const vault = new ethers.Contract(spec.vault, VAULT_ABI, signer);
  const shareDecimals = Number(await reader.decimals());
  const sharesBefore = await vault.balanceOf(user);
  const assetsBefore = await asset.balanceOf(user);
  await approve(spec.asset, signer, spec.vault, amount);
  await (await vault.deposit(amount, user, GAS)).wait();
  const shares = (await vault.balanceOf(user)) - sharesBefore;
  const redeemed = await vault.redeem(shares, user, user, GAS);
  const receipt = await redeemed.wait();
  const assetsAfter = await asset.balanceOf(user);
  const dust = amount / 1000n + 2n;
  const ok = shares > 0n && assetsAfter + dust >= assetsBefore;
  return finish({
    ...base,
    ok,
    key: `${spec.label}Shares=${formatUnits(shares, shareDecimals)} ${spec.symbol}=${formatUnits(assetsBefore, spec.decimals)}->${formatUnits(assetsAfter, spec.decimals)}`,
    detail: `deposited ${formatUnits(amount, spec.decimals)} ${spec.symbol} into ${spec.label}\nshares ${formatUnits(shares, shareDecimals)}\n${spec.symbol} ${formatUnits(assetsBefore, spec.decimals)} -> ${formatUnits(assetsAfter, spec.decimals)}\ntx ${receipt.hash}`,
    error: ok ? null : `${spec.label} deposit/redeem did not return assets within rounding`,
  });
}

async function vedaDeposit(base) {
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.01");
  const provider = getProvider(base.chain);
  const tellerRead = new ethers.Contract(VEDA.teller, TELLER_ABI, provider);
  if (await tellerRead.isPaused()) return finish({ ...base, ok: false, skipped: true, error: "Veda teller is paused" });
  const [allowDeposits, allowWithdraws] = await tellerRead.assetData(VEDA.weth);
  if (!allowDeposits) {
    const vault = new ethers.Contract(VEDA.vault, ERC, provider);
    const supply = await vault.totalSupply();
    return finish({
      ...base,
      ok: supply > 0n,
      key: `readOnly=WETH deposits closed supply=${formatUnits(supply, 18)}`,
      detail: "Teller assetData says WETH deposits are closed. No deposit.",
      error: supply > 0n ? null : "Liquid ETH vault has no supply",
    });
  }
  const signer = await impersonateFunded(base.chain, "WETH", VEDA.weth, amount);
  const user = await signer.getAddress();
  const shares = new ethers.Contract(VEDA.vault, ERC, provider);
  const before = await shares.balanceOf(user);
  await approve(VEDA.weth, signer, VEDA.vault, amount);
  const teller = new ethers.Contract(VEDA.teller, TELLER_ABI, signer);
  const tx = await teller.deposit(VEDA.weth, amount, 0, GAS);
  const receipt = await tx.wait();
  const after = await shares.balanceOf(user);
  const minted = after - before;
  const ok = minted > 0n;
  return finish({
    ...base,
    ok,
    key: `liquidETH=${formatUnits(before, 18)}->${formatUnits(after, 18)} withdraws=${allowWithdraws}`,
    detail: `deposited ${formatUnits(amount, 18)} WETH via the Teller\nliquidETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nWETH allowWithdraws=${allowWithdraws}. Teller bulkWithdraw is not a public capability, so this does not redeem.\ntx ${receipt.hash}`,
    error: ok ? null : "Liquid ETH shares were not minted",
  });
}

async function upshiftRead(base, reason) {
  const provider = getProvider(base.chain);
  const vault = new ethers.Contract(UPSHIFT.vault, UPSHIFT_ABI, provider);
  const price = await vault.getSharePrice();
  const ok = price > 0n;
  return finish({
    ...base,
    ok,
    key: `readOnly=${reason} sharePrice=${formatUnits(price, 6)}`,
    detail: `Sentora USD ${reason}. sentUSD share price ${formatUnits(price, 6)} USDC. No deposit.`,
    error: ok ? null : "Upshift share price was 0",
  });
}

async function upshiftDeposit(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(UPSHIFT.vault, UPSHIFT_ABI, provider);
  if (await reader.depositsPaused()) return upshiftRead(base, "depositsPaused");
  const cap = await reader.maxDepositAmount();
  if (cap === 0n) return upshiftRead(base, "maxDepositAmount=0");
  const depositAmount = amount < cap ? amount : cap;
  const signer = await impersonateFunded(base.chain, "USDC", UPSHIFT.usdc, depositAmount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(UPSHIFT.usdc, ERC, provider);
  const sent = new ethers.Contract(UPSHIFT.receipt, ERC, provider);
  const vault = new ethers.Contract(UPSHIFT.vault, UPSHIFT_ABI, signer);
  const sharesBefore = await sent.balanceOf(user);
  const assetsBefore = await usdc.balanceOf(user);
  await approve(UPSHIFT.usdc, signer, UPSHIFT.vault, depositAmount);
  await (await vault.deposit(UPSHIFT.usdc, depositAmount, user, GAS)).wait();
  const shares = (await sent.balanceOf(user)) - sharesBefore;
  if (shares === 0n) return finish({ ...base, ok: false, error: "sentUSD shares were not minted" });
  // instantRedemptionFee() is in basis points. A same-block round trip returns assets minus that fee.
  const feeBps = await reader.instantRedemptionFee();
  let redeemed = false;
  let receipt;
  try {
    receipt = await (await vault.instantRedeem(shares, user, GAS)).wait();
    redeemed = true;
  } catch (err) {
    const message = explain(err);
    if (!gated(message)) return finish({ ...base, ok: false, error: message });
    receipt = await (await vault.requestRedeem(shares, user, GAS)).wait();
  }
  const assetsAfter = await usdc.balanceOf(user);
  const fee = redeemed ? (depositAmount * feeBps) / 10_000n : 0n;
  const ok = redeemed ? assetsAfter + fee + 2n >= assetsBefore : shares > 0n;
  const mode = redeemed ? "instantRedeem" : "requestRedeem";
  return finish({
    ...base,
    ok,
    key: `sentUSD=${formatUnits(shares, 6)} USDC=${formatUnits(assetsBefore, 6)}->${formatUnits(assetsAfter, 6)} feeBps=${feeBps.toString()} ${mode}`,
    detail: `deposited ${formatUnits(depositAmount, 6)} USDC into Sentora USD\nsentUSD ${formatUnits(shares, 6)}\nUSDC ${formatUnits(assetsBefore, 6)} -> ${formatUnits(assetsAfter, 6)}\ninstant redemption fee ${feeBps.toString()} bps\n${mode}\ntx ${receipt.hash}`,
    error: ok ? null : "Upshift deposit did not return USDC within the instant redemption fee",
  });
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const base = await forkOrFail(protocol, action);
  if (!base) return;
  try {
    if (protocol === "steakhouse") return await erc4626(base, VAULTS.steakhouse);
    if (protocol === "gauntlet") return await erc4626(base, VAULTS.gauntlet);
    if (protocol === "sentora") return await erc4626(base, VAULTS.sentora);
    if (protocol === "yearn") return await erc4626(base, VAULTS.yearn);
    if (protocol === "euler") return await erc4626(base, VAULTS.euler);
    if (protocol === "veda") return await vedaDeposit(base);
    if (protocol === "upshift") return await upshiftDeposit(base);
    return finish({ ...base, ok: false, error: `Unknown vault action ${protocol}:${action}` });
  } catch (err) {
    const message = explain(err);
    const spec = VAULTS[protocol];
    if (spec && gated(message)) return readVault(base, spec, message.slice(0, 120));
    if (protocol === "upshift" && gated(message)) return upshiftRead(base, message.slice(0, 120));
    if (protocol === "veda" && gated(message)) {
      return finish({
        ...base,
        ok: false,
        error: message,
      });
    }
    return finish({ ...base, ok: false, error: message });
  }
}

module.exports = { run };
