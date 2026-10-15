/**
 * USD.AI on Arbitrum: stake USDai into sUSDai (ERC-4626 deposit).
 * Protocol mint/redeem of USDai is whitelisted; staking is open for any holder.
 * sUSDai redemptions are a 30-day queue, so this test does not redeem.
 * https://docs.usd.ai/technical-overview/contract-addresses
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { USDAI } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const VAULT_ABI = [
  ...ERC,
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function asset() view returns (address)",
];

async function run() {
  const chain = "arbitrum";
  const protocol = process.env.FORK_PROTOCOL || "usdai";
  const action = process.env.FORK_ACTION || "stake";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    const provider = getProvider(chain);
    const vault = new ethers.Contract(USDAI.susdai, VAULT_ABI, provider);
    const assetAddr = await vault.asset();
    if (assetAddr.toLowerCase() !== USDAI.usdai.toLowerCase()) {
      return finish({ ...base, ok: false, error: `sUSDai asset is ${assetAddr}, not ${USDAI.usdai}` });
    }
    const decimals = Number(await new ethers.Contract(USDAI.usdai, ERC, provider).decimals());
    const wanted = ethers.parseUnits(process.env.FORK_AMOUNT || "100", decimals);
    const probe = ethers.Wallet.createRandom().address;
    const max = await vault.maxDeposit(probe);
    if (max === 0n) {
      return finish({ ...base, ok: false, error: "sUSDai maxDeposit is 0" });
    }
    const amount = wanted < max ? wanted : max;
    const signer = await impersonateFunded(chain, "USDai", USDAI.usdai, amount);
    const user = await signer.getAddress();
    const usdai = new ethers.Contract(USDAI.usdai, ERC, provider);
    const sharesTok = new ethers.Contract(USDAI.susdai, ERC, provider);
    const assetsBefore = await usdai.balanceOf(user);
    const sharesBefore = await sharesTok.balanceOf(user);
    await (await new ethers.Contract(USDAI.usdai, ERC, signer).approve(USDAI.susdai, amount)).wait();
    const vaultW = new ethers.Contract(USDAI.susdai, VAULT_ABI, signer);
    const receipt = await (await vaultW.deposit(amount, user, { gasLimit: 1_500_000n })).wait();
    const assetsAfter = await usdai.balanceOf(user);
    const sharesAfter = await sharesTok.balanceOf(user);
    const minted = sharesAfter - sharesBefore;
    const ok = minted > 0n && assetsBefore - assetsAfter === amount;
    return finish({
      ...base,
      ok,
      key: `sUSDai=${formatUnits(sharesBefore, decimals)}->${formatUnits(sharesAfter, decimals)} USDai=${formatUnits(assetsBefore, decimals)}->${formatUnits(assetsAfter, decimals)}`,
      detail: `staked ${formatUnits(amount, decimals)} USDai into sUSDai\nsUSDai ${formatUnits(sharesBefore, decimals)} -> ${formatUnits(sharesAfter, decimals)}\nRedeem is a 30-day queue, so this does not redeem.\ntx ${receipt.hash}`,
      error: ok ? null : "sUSDai shares were not minted",
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
