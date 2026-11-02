/**
 * Compound III (cUSDCv3) supply and borrow on an Ethereum fork.
 * Comet address: https://docs.compound.finance/#networks
 *   cUSDCv3 0xc3d688B66703497DAA19211EEdff47f25384cdc3
 * supply(asset, amount) deposits base or collateral.
 * withdraw(base, amount) borrows when it exceeds the supplied base balance.
 * repay: supply(base) against an open borrow reduces borrowBalanceOf.
 * withdraw: withdraw(base) of a supplied balance returns USDC to the wallet.
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
  "function isSupplyPaused() view returns (bool)",
  "function isWithdrawPaused() view returns (bool)",
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
    // Both actions supply then withdraw. A Pause Guardian pause reverts Paused(), so it is a
    // labelled FAIL before any tx (same rule as the Swell and Puffer pauses).
    const paused = [];
    if (await cometRead.isSupplyPaused()) paused.push("supply");
    if (await cometRead.isWithdrawPaused()) paused.push("withdraw");
    if (paused.length) {
      return finish({
        ok: false,
        protocol,
        action,
        chain,
        block: ctx.forkBlock,
        key: `paused=${paused.join(",")}`,
        error: `cUSDCv3 ${paused.join(" and ")} paused by the Pause Guardian; no tx sent`,
      });
    }
    if (action === "supply") return await supplyBase({ chain, protocol, action, ctx, usdc, cometRead });
    if (action === "borrow") return await borrowBase({ chain, protocol, action, ctx, usdc, weth, provider, cometRead });
    if (action === "repay") return await repayBase({ chain, protocol, action, ctx, usdc, weth, cometRead });
    if (action === "withdraw") return await withdrawBase({ chain, protocol, action, ctx, usdc, cometRead });
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

async function repayBase({ chain, protocol, action, ctx, usdc, weth, cometRead }) {
  const collateral = ethers.parseEther(process.env.FORK_COLLATERAL || "1");
  const borrow = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(chain, "WETH", weth, collateral);
  const user = await signer.getAddress();
  const erc20 = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
  const wethToken = new ethers.Contract(weth, erc20, signer);
  const usdcToken = new ethers.Contract(usdc, erc20, signer);
  const comet = new ethers.Contract(COMPOUND_CUSDC_V3, COMET_ABI, signer);
  await (await wethToken.approve(COMPOUND_CUSDC_V3, collateral)).wait();
  await (await comet.supply(weth, collateral)).wait();
  await (await comet.withdraw(usdc, borrow)).wait();
  const debtBefore = await cometRead.borrowBalanceOf(user);
  if (debtBefore === 0n) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: "borrow step opened no debt" });
  }
  // Repay half of the open debt with the borrowed USDC.
  const repay = debtBefore / 2n;
  const walletBefore = await usdcToken.balanceOf(user);
  await (await usdcToken.approve(COMPOUND_CUSDC_V3, repay)).wait();
  const tx = await comet.supply(usdc, repay);
  const receipt = await tx.wait();
  const debtAfter = await cometRead.borrowBalanceOf(user);
  const walletAfter = await usdcToken.balanceOf(user);
  const ok = debtAfter < debtBefore && debtAfter > 0n && walletBefore - walletAfter === repay;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `debt=${formatUnits(debtBefore, 6)}->${formatUnits(debtAfter, 6)} usdc=${formatUnits(walletBefore, 6)}->${formatUnits(walletAfter, 6)}`,
    detail: `repaid ${formatUnits(repay, 6)} USDC\nborrowBalance ${formatUnits(debtBefore, 6)} -> ${formatUnits(debtAfter, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "repay did not reduce debt by the USDC spent",
  });
}

async function withdrawBase({ chain, protocol, action, ctx, usdc, cometRead }) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 6);
  const signer = await impersonateFunded(chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const usdcToken = new ethers.Contract(usdc, ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"], signer);
  const comet = new ethers.Contract(COMPOUND_CUSDC_V3, COMET_ABI, signer);
  await (await usdcToken.approve(COMPOUND_CUSDC_V3, amount)).wait();
  await (await comet.supply(usdc, amount)).wait();
  const suppliedBefore = await cometRead.balanceOf(user);
  const walletBefore = await usdcToken.balanceOf(user);
  const out = amount / 2n;
  const tx = await comet.withdraw(usdc, out);
  const receipt = await tx.wait();
  const suppliedAfter = await cometRead.balanceOf(user);
  const walletAfter = await usdcToken.balanceOf(user);
  const debt = await cometRead.borrowBalanceOf(user);
  const ok = walletAfter - walletBefore === out && suppliedAfter < suppliedBefore && debt === 0n;
  return finish({
    ok,
    protocol,
    action,
    chain,
    block: ctx.forkBlock,
    key: `base=${formatUnits(suppliedBefore, 6)}->${formatUnits(suppliedAfter, 6)} usdc=${formatUnits(walletBefore, 6)}->${formatUnits(walletAfter, 6)}`,
    detail: `withdrew ${formatUnits(out, 6)} USDC of ${formatUnits(amount, 6)} supplied\ntx ${receipt.hash}`,
    error: ok ? null : "withdraw did not return USDC without opening debt",
  });
}

module.exports = { run };
