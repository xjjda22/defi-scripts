/**
 * Venus Core Pool on BSC: mint vUSDC (Compound V2-style), then redeem.
 * Markets: https://docs-v4.venus.io/deployed-contracts/markets
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { VENUS } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const VTOKEN_ABI = [
  ...ERC,
  "function mint(uint256) returns (uint256)",
  "function redeem(uint256) returns (uint256)",
  "function underlying() view returns (address)",
];

async function run() {
  const chain = "bsc";
  const protocol = process.env.FORK_PROTOCOL || "venus";
  const action = process.env.FORK_ACTION || "supply";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    // BSC USDC has 18 decimals.
    const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
    const usdc = COMMON_TOKENS.USDC.bsc;
    const signer = await impersonateFunded(chain, "USDC", usdc, amount);
    const user = await signer.getAddress();
    const provider = getProvider(chain);
    const asset = new ethers.Contract(usdc, ERC, provider);
    const vToken = new ethers.Contract(VENUS.vUSDC, VTOKEN_ABI, signer);
    const underlying = await vToken.underlying();
    if (underlying.toLowerCase() !== usdc.toLowerCase()) {
      return finish({ ...base, ok: false, error: `vUSDC underlying is ${underlying}, not ${usdc}` });
    }
    const usdcBefore = await asset.balanceOf(user);
    const sharesBefore = await vToken.balanceOf(user);
    await (await new ethers.Contract(usdc, ERC, signer).approve(VENUS.vUSDC, amount)).wait();
    const mintStatus = await (await vToken.mint(amount, { gasLimit: 1_500_000n })).wait();
    // Compound V2 mint returns 0 on success when checked via staticcall; on-chain we assert balances.
    const usdcMid = await asset.balanceOf(user);
    const shares = (await vToken.balanceOf(user)) - sharesBefore;
    if (shares === 0n) return finish({ ...base, ok: false, error: "vUSDC shares were not minted" });
    if (usdcBefore - usdcMid !== amount) {
      return finish({ ...base, ok: false, error: "Venus mint did not pull the USDC" });
    }
    await (await vToken.redeem(shares, { gasLimit: 1_500_000n })).wait();
    const usdcAfter = await asset.balanceOf(user);
    const sharesAfter = await vToken.balanceOf(user);
    const dust = amount / 1000n + 2n;
    const ok = sharesAfter === sharesBefore && usdcAfter + dust >= usdcBefore && usdcAfter > usdcMid;
    return finish({
      ...base,
      ok,
      key: `vUSDC=0->${formatUnits(shares, 8)}->${formatUnits(sharesAfter - sharesBefore, 8)} USDC=${formatUnits(usdcBefore, 18)}->${formatUnits(usdcMid, 18)}->${formatUnits(usdcAfter, 18)}`,
      detail: `minted ${formatUnits(amount, 18)} USDC into Venus Core Pool vUSDC\nvUSDC shares ${formatUnits(shares, 8)}\nUSDC ${formatUnits(usdcBefore, 18)} -> ${formatUnits(usdcAfter, 18)}\nmint tx ${mintStatus.hash}`,
      error: ok ? null : "Venus supply/redeem round trip failed",
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
