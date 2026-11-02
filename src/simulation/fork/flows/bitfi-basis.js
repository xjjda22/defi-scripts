/**
 * BitFi Basis (bfBTC) — permissionless deposit on BNB Chain.
 *
 * BitFi's "basis" product on BSC is bfBTC, a yield-bearing BTC token: users deposit BTCB and
 * the contract mints bfBTC at the current epoch ratio, while the underlying is traded in a
 * delta-neutral basis strategy (spot BTC vs. futures) by BitFi. The vault is a single ERC-20
 * contract (also a LayerZero OFT) with an ERC-4626-style entry point, and deposit() is
 * permissionless: no allowlist, no KYC, only paused()/minDepositTokenAmount gates.
 *
 * BitFi's stablecoin side (bfUSD / hbfUSD / pbfUSD) is NOT deployed on BSC — the docs list
 * Ethereum mainnet only, and those addresses have no code on BSC — so there is no stablecoin
 * vault to deposit into here. This test exercises the BSC basis vault that does exist and
 * asserts the share/asset deltas:
 *   - 0.01 BTCB is pulled from a fresh impersonated account,
 *   - bfBTC minted equals previewDeposit() exactly (same block, same epoch ratio),
 *   - totalSupply rises by exactly the minted amount (1:1 share accounting),
 *   - the minted bfBTC converts back to the deposited BTCB within 0.01% at currentRatio(),
 *   - paused() is false and the deposit is above minDepositTokenAmount().
 *
 * Addresses:
 *   bfBTC (BSC): https://docs.bitfi.one/developer/bfbtc-overview/deployed-contracts
 *   BTCB (BSC):  https://bscscan.com/address/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c
 *   Deposit API: https://docs.bitfi.one/developer/using-contract/stake-bfbtc
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../../utils/web3");
const { requireFork, impersonateFunded, formatUnits, finish } = require("../runtime");

const CHAIN = "bsc";

// BitFi bfBTC on BSC ("BitFi Bitcoin", symbol bfBTC, 8 decimals).
const BF_BTC = "0x623F2774d9f27B59bc6b954544487532CE79d9DF";
// BSC BTCB, the bfBTC underlying (underlyingAsset()).
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";

const GAS = { gasLimit: 2_000_000n };
// bfBTC is quoted in 8 decimals, BTCB in 18; currentRatio() is the 1e8-scaled BTC-per-bfBTC
// ratio, so 1 BTCB (1e18) previews to `amount * ratio / 1e18` bfBTC sats.
const RATIO_SCALE = 10n ** 18n;

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const VAULT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function underlyingAsset() view returns (address)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function currentEpoch() view returns (uint256)",
  "function currentRatio() view returns (uint256)",
  "function minDepositTokenAmount() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function deposit(uint256 amount, uint256 minAmount)",
];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through to the ethers message
    }
  }
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

async function deposit(base) {
  const provider = getProvider(base.chain);
  const [vaultCode, tokenCode] = await Promise.all([provider.getCode(BF_BTC), provider.getCode(BTCB)]);
  if (vaultCode === "0x") return finish({ ...base, ok: false, error: `bfBTC ${BF_BTC} has no code on this fork` });
  if (tokenCode === "0x") return finish({ ...base, ok: false, error: `BTCB ${BTCB} has no code on this fork` });

  const read = new ethers.Contract(BF_BTC, VAULT_ABI, provider);
  const [name, symbol, decimals, underlying, owner, paused, epoch, ratio, minDeposit] = await Promise.all([
    read.name(),
    read.symbol(),
    read.decimals(),
    read.underlyingAsset(),
    read.owner(),
    read.paused(),
    read.currentEpoch(),
    read.currentRatio(),
    read.minDepositTokenAmount(),
  ]);
  if (symbol !== "bfBTC") return finish({ ...base, ok: false, error: `${BF_BTC} is ${symbol}, not bfBTC` });
  if (underlying.toLowerCase() !== BTCB.toLowerCase())
    return finish({ ...base, ok: false, error: `${symbol}: underlyingAsset() is ${underlying}, not BSC BTCB` });
  if (paused) return finish({ ...base, ok: false, error: `${symbol} vault is paused on this fork; no deposit possible` });

  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "0.01", 18);
  if (amount < minDeposit)
    return finish({
      ...base,
      ok: false,
      error: `deposit ${formatUnits(amount, 18)} BTCB is below minDepositTokenAmount ${formatUnits(minDeposit, 18)} BTCB`,
    });

  const signer = await impersonateFunded(base.chain, "BTCB", BTCB, amount);
  const user = await signer.getAddress();
  const token = new ethers.Contract(BTCB, ERC20, signer);
  const vault = new ethers.Contract(BF_BTC, VAULT_ABI, signer);

  const tokenBalance = await token.balanceOf(user);
  if (tokenBalance < amount)
    return finish({ ...base, ok: false, error: `funded account ${user} holds ${formatUnits(tokenBalance, 18)} BTCB` });

  const preview = await vault.previewDeposit(amount);
  if (preview === 0n) return finish({ ...base, ok: false, error: "previewDeposit returned 0 bfBTC; no tx sent" });

  // 1% slippage guard, as the docs recommend for minAmount.
  const minAmount = (preview * 99n) / 100n;

  const before = await provider.getBlockNumber();
  const supplyBefore = await vault.totalSupply({ blockTag: before });

  await (await token.approve(BF_BTC, amount)).wait();
  const receipt = await (await vault.deposit(amount, minAmount, GAS)).wait();
  const at = receipt.blockNumber;

  const [sharesAt, sharesPrev, supplyAt, supplyPrev, tokenAt, tokenPrev, blockAt] = await Promise.all([
    vault.balanceOf(user, { blockTag: at }),
    vault.balanceOf(user, { blockTag: at - 1 }),
    vault.totalSupply({ blockTag: at }),
    vault.totalSupply({ blockTag: at - 1 }),
    token.balanceOf(user, { blockTag: at }),
    token.balanceOf(user, { blockTag: at - 1 }),
    provider.getBlock(at),
  ]);
  const minted = sharesAt - sharesPrev;
  const supplyDelta = supplyAt - supplyPrev;
  const tokenSpent = tokenPrev - tokenAt;
  // Value the minted shares back in BTCB at the epoch ratio: minted * 1e18 / ratio.
  const assetsBack = (minted * RATIO_SCALE) / ratio;
  const valueDrift = assetsBack > amount ? assetsBack - amount : amount - assetsBack;
  const valueTolerance = amount / 10_000n; // 0.01%

  const ok = minted > 0n && minted === preview && supplyDelta === minted && tokenSpent === amount && valueDrift <= valueTolerance;

  const reasons = [];
  if (minted === 0n) reasons.push("no bfBTC minted");
  if (minted !== preview)
    reasons.push(`minted ${formatUnits(minted, 8)} bfBTC != previewDeposit ${formatUnits(preview, 8)}`);
  if (supplyDelta !== minted) reasons.push(`totalSupply +${supplyDelta} != minted ${minted}`);
  if (tokenSpent !== amount)
    reasons.push(`BTCB spent ${formatUnits(tokenSpent, 18)} != deposit ${formatUnits(amount, 18)}`);
  if (valueDrift > valueTolerance)
    reasons.push(`minted bfBTC values ${formatUnits(assetsBack, 18)} BTCB != ${formatUnits(amount, 18)} BTCB`);

  return finish({
    ...base,
    ok,
    key:
      `minted=${formatUnits(minted, 8)}bfBTC previewDeposit=${formatUnits(preview, 8)} ` +
      `totalSupply+=${formatUnits(supplyDelta, 8)} BTCB-=${formatUnits(tokenSpent, 18)} deposit=${formatUnits(amount, 18)}BTCB`,
    detail:
      `${name} (${symbol}, ${decimals} decimals) on BSC: underlyingAsset=${underlying} (BTCB), ` +
      `owner=${owner}, epoch=${epoch}, currentRatio=${formatUnits(ratio, 8)} BTC/bfBTC, paused=${paused}\n` +
      `deposited ${formatUnits(amount, 18)} BTCB from fresh ${user}: minted ${formatUnits(minted, 8)} bfBTC ` +
      `(previewDeposit ${formatUnits(preview, 8)}, exact match), worth ${formatUnits(assetsBack, 18)} BTCB at currentRatio\n` +
      `totalSupply ${formatUnits(supplyBefore, 8)} -> ${formatUnits(supplyAt, 8)} bfBTC; ` +
      `BTCB spent exactly ${formatUnits(tokenSpent, 18)}; minAmount guard ${formatUnits(minAmount, 8)} bfBTC\n` +
      `tx ${receipt.hash} (block ${at}; fork block ${base.block}, ts ${blockAt.timestamp})\n` +
      `note: BitFi's stablecoin basis vaults (bfUSD/hbfUSD/pbfUSD) are Ethereum-mainnet only; the BSC basis vault is bfBTC and its asset is BTCB`,
    error: ok ? null : reasons.join("; "),
  });
}

async function run() {
  const chain = process.env.CHAIN || CHAIN;
  const protocol = process.env.FORK_PROTOCOL || "bitfi-basis";
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
