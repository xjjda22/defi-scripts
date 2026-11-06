/**
 * Lista Moolah (Morpho Blue fork) borrow on BSC.
 * Supply BTCB collateral, borrow USDT from a liquid market.
 *
 * Moolah: 0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C
 * Docs: https://docs.bsc.lista.org/for-developer/lista-lending/contract-reference
 * Market (USDT loan / BTCB collateral, lltv 80%):
 *   id 0x975f4cf3db16812d995f60e19bec91a96108d47429237acc8d208bc0519c5b19
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { requireFork, dealErc20, formatUnits, finish } = require("./runtime");
const { impersonateAccount } = require("../../utils/impersonate");

const MOOLAH = "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const MARKET_ID = "0x975f4cf3db16812d995f60e19bec91a96108d47429237acc8d208bc0519c5b19";
const GAS = { gasLimit: 3_000_000n };

const ABI = [
  "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function supplyCollateral((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)",
  "function borrow((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function owner() view returns (address)",
];
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

function paramsTuple(raw) {
  return {
    loanToken: raw.loanToken ?? raw[0],
    collateralToken: raw.collateralToken ?? raw[1],
    oracle: raw.oracle ?? raw[2],
    irm: raw.irm ?? raw[3],
    lltv: raw.lltv ?? raw[4],
  };
}

async function borrow(base) {
  const provider = getProvider(base.chain);
  const moolah = new ethers.Contract(MOOLAH, ABI, provider);
  let market;
  try {
    market = paramsTuple(await moolah.idToMarketParams(MARKET_ID));
  } catch (err) {
    return finish({ ...base, ok: false, error: `idToMarketParams failed: ${err.shortMessage || err.message}` });
  }
  if (market.loanToken.toLowerCase() !== USDT.toLowerCase() || market.collateralToken.toLowerCase() !== BTCB.toLowerCase()) {
    return finish({
      ...base,
      ok: false,
      error: `Unexpected market params loan=${market.loanToken} coll=${market.collateralToken}`,
    });
  }
  const totals = await moolah.market(MARKET_ID);
  const liquidity = BigInt(totals.totalSupplyAssets) - BigInt(totals.totalBorrowAssets);
  if (liquidity < ethers.parseUnits("10", 18)) {
    return finish({ ...base, ok: false, error: `Market liquidity too low: ${liquidity}` });
  }
  // 0.01 BTCB (~$750+) covers borrowing 100 USDT at 80% LLTV.
  const collateral = ethers.parseUnits(process.env.FORK_COLLATERAL || "0.01", 18);
  const borrowAmt = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(ethers.parseEther("1"))]);
  // BTCB (Binance-Peg) has no reliable anvil_dealERC20 slot; pull from Binance 8 which holds ~21k BTCB.
  // https://bscscan.com/token/0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c#balances
  const BTCB_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
  let funded = false;
  try {
    const whale = await impersonateAccount(BTCB_WHALE, base.chain);
    await provider.send("anvil_setBalance", [BTCB_WHALE, ethers.toQuantity(ethers.parseEther("1"))]);
    const whaleBal = await new ethers.Contract(BTCB, ERC, provider).balanceOf(BTCB_WHALE);
    if (whaleBal >= collateral) {
      await (await new ethers.Contract(BTCB, ["function transfer(address,uint256) returns (bool)"], whale).transfer(user, collateral, GAS)).wait();
      funded = true;
    }
  } catch (_) {
    /* fall through */
  }
  if (!funded) {
    const dealt = await dealErc20(base.chain, BTCB, user, collateral);
    if (!dealt) {
      return finish({ ...base, ok: false, error: "Could not fund BTCB collateral via whale transfer or anvil_deal" });
    }
  }
  const btcb = new ethers.Contract(BTCB, ERC, signer);
  const usdt = new ethers.Contract(USDT, ERC, provider);
  const moolahWrite = new ethers.Contract(MOOLAH, ABI, signer);
  await (await btcb.approve(MOOLAH, collateral)).wait();
  await (await moolahWrite.supplyCollateral(market, collateral, user, "0x", GAS)).wait();
  const posMid = await moolah.position(MARKET_ID, user);
  if (posMid.collateral === 0n) {
    return finish({ ...base, ok: false, error: "supplyCollateral left 0 collateral" });
  }
  const usdtBefore = await usdt.balanceOf(user);
  const receipt = await (await moolahWrite.borrow(market, borrowAmt, 0, user, user, GAS)).wait();
  const usdtAfter = await usdt.balanceOf(user);
  const pos = await moolah.position(MARKET_ID, user);
  const got = usdtAfter - usdtBefore;
  const ok = got === borrowAmt && pos.borrowShares > 0n && pos.collateral > 0n;
  return finish({
    ...base,
    ok,
    key: `coll=${formatUnits(pos.collateral, 18)}BTCB borrowed=${formatUnits(got, 18)}USDT shares=${pos.borrowShares}`,
    detail: `Moolah market ${MARKET_ID}\nsupplyCollateral ${formatUnits(collateral, 18)} BTCB, borrow ${formatUnits(borrowAmt, 18)} USDT\nUSDT ${formatUnits(usdtBefore, 18)} -> ${formatUnits(usdtAfter, 18)}, borrowShares ${pos.borrowShares}\ntx ${receipt.hash}`,
    error: ok ? null : "Lista Moolah borrow did not credit USDT or open borrow shares",
  });
}

async function run() {
  const chain = process.env.CHAIN || "bsc";
  const protocol = process.env.FORK_PROTOCOL || "lista-dao";
  const action = process.env.FORK_ACTION || "borrow";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { protocol, action, chain, block: ctx.forkBlock };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  try {
    if (action === "borrow") return await borrow(base);
    return finish({ ...base, ok: false, error: `listaMoolahFlow only handles borrow (got ${action})` });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run, borrow };
