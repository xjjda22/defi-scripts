/**
 * Compound III (cUSDCv3) supply and borrow on an Ethereum fork.
 * Comet address: https://docs.compound.finance/#networks
 *   cUSDCv3 0xc3d688B66703497DAA19211EEdff47f25384cdc3
 * supply(asset, amount) deposits base or collateral.
 * withdraw(base, amount) borrows when it exceeds the supplied base balance.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { COMPOUND_CUSDC_V3 } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const COMET_ABI = [
  "function supply(address asset, uint256 amount)",
  "function withdraw(address asset, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function borrowBalanceOf(address) view returns (uint256)",
  "function userCollateral(address, address) view returns (uint128 balance, uint128 reserved)",
];

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = "compound";
  const action = process.env.FORK_ACTION || "supply";
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  if (chain !== "ethereum") {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: "Compound V3 fork test is Ethereum-only" });
  }
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const weth = COMMON_TOKENS.WETH.ethereum;
  const provider = getProvider(chain);
  const cometRead = new ethers.Contract(COMPOUND_CUSDC_V3, COMET_ABI, provider);
  try {
    if (action === "supply") return await supplyBase({ chain, protocol, action, ctx, usdc, cometRead });
    if (action === "borrow") return await borrowBase({ chain, protocol, action, ctx, usdc, weth, provider, cometRead });
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: `Unknown action ${action}` });
  } catch (err) {
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: err.shortMessage || err.message,
    });
  }
}

async function supplyBase({ chain, protocol, action, ctx, usdc, cometRead }) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 6);
  const signer = await impersonateFunded(chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const before = await cometRead.balanceOf(user);
  const token = new ethers.Contract(usdc, ["function approve(address,uint256) returns (bool)"], signer);
  const comet = new ethers.Contract(COMPOUND_CUSDC_V3, COMET_ABI, signer);
  await (await token.approve(COMPOUND_CUSDC_V3, amount)).wait();
  const tx = await comet.supply(usdc, amount);
  const receipt = await tx.wait();
  const after = await cometRead.balanceOf(user);
  const ok = after > before;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `base=${formatUnits(before, 6)}->${formatUnits(after, 6)}`,
    detail: `supplied ${formatUnits(amount, 6)} USDC to cUSDCv3\nbalanceOf ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "Comet base balance did not increase",
  });
}

async function borrowBase({ chain, protocol, action, ctx, usdc, weth, provider, cometRead }) {
  const collateral = ethers.parseEther(process.env.FORK_COLLATERAL || "1");
  const borrow = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(chain, "WETH", weth, collateral);
  const user = await signer.getAddress();
  const wethToken = new ethers.Contract(weth, ["function approve(address,uint256) returns (bool)"], signer);
  const usdcToken = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)"], provider);
  const comet = new ethers.Contract(COMPOUND_CUSDC_V3, COMET_ABI, signer);
  const walletBefore = await usdcToken.balanceOf(user);
  const borrowBefore = await cometRead.borrowBalanceOf(user);
  await (await wethToken.approve(COMPOUND_CUSDC_V3, collateral)).wait();
  await (await comet.supply(weth, collateral)).wait();
  const tx = await comet.withdraw(usdc, borrow);
  const receipt = await tx.wait();
  const walletAfter = await usdcToken.balanceOf(user);
  const borrowAfter = await cometRead.borrowBalanceOf(user);
  const collateralAfter = await cometRead.userCollateral(user, weth);
  const ok = walletAfter > walletBefore && borrowAfter > borrowBefore;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `borrow=${formatUnits(borrowBefore, 6)}->${formatUnits(borrowAfter, 6)} usdc=${formatUnits(walletBefore, 6)}->${formatUnits(walletAfter, 6)}`,
    detail: `WETH collateral ${formatUnits(collateralAfter.balance, 18)}\nborrowBalance ${formatUnits(borrowBefore, 6)} -> ${formatUnits(borrowAfter, 6)}\nUSDC ${formatUnits(walletBefore, 6)} -> ${formatUnits(walletAfter, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "borrow did not increase debt and USDC",
  });
}

module.exports = { run };
