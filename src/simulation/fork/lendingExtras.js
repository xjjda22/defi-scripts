/**
 * Lending features beyond supply/borrow/repay/withdraw, on an Ethereum Anvil fork:
 *   aave:flashloan, spark:flashloan     Pool.flashLoanSimple into a receiver deployed on the fork
 *   aave:emode                          setUserUseReserveAsCollateral off/on + setUserEMode on/off
 *   aave:stake                          stkAAVE stake + cooldown (Safety Module)
 *   spark:liquidate                     liquidationCall after the WETH price source is shocked
 *   morpho:flashloan                    Morpho.flashLoan with an onMorphoFlashLoan callback
 *   morpho:liquidate                    Morpho.liquidate after the market oracle is shocked
 *   compound:absorb, compound:buycollateral   Comet.absorb / buyCollateral after an ETH/USD shock
 *   llamalend:borrow|repay|liquidate    LlamaLend Controller create_loan / repay / liquidate
 *
 * Price shocks replace the oracle's code with MockPrice (contracts/MockPrice.sol) through
 * anvil_setCode, write the price into a namespaced slot, and restore the original code in a
 * finally block so later tests on the same fork see the real oracle. A revert is a FAIL.
 *
 * Addresses (all checksummed, code checked on-chain 2026-11-02):
 *   Aave V3 Pool 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2  https://aave.com/docs/resources/addresses
 *   stkAAVE 0x4da27a545c0c5B758a6BA100e3a049001de870f5, AAVE 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9
 *   SparkLend Pool 0xC13e21B648A5Ee794902342038FF3aDAB66BE987  https://docs.spark.fi/dev/sparklend/core-contracts/pool
 *   Morpho Blue 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb  https://docs.morpho.org/get-started/resources/addresses/
 *   Comet cUSDCv3 0xc3d688B66703497DAA19211EEdff47f25384cdc3  https://docs.compound.finance/#networks
 *   LlamaLend wstETH market: vault 0x21CF1c5Dc48C603b89907FE6a7AE83EA5e3709aF (factory index 13),
 *     controller and AMM read from the vault  https://docs.curve.finance/developer/deployments
 */

const { ethers } = require("ethers");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { SPARK_POOL, MORPHO_BLUE, COMPOUND_CUSDC_V3, LLAMALEND } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("./runtime");
const ART = require("./contracts/artifacts.json");

const AAVE_POOL = CHAINS.ethereum.aave?.v3?.pool || "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const STKAAVE = "0x4da27a545c0c5B758a6BA100e3a049001de870f5";
const AAVE_TOKEN = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
const PRICE_SLOT = ethers.id("defi-scripts.mock.price");

const POOL_ABI = [
  "function supply(address,uint256,address,uint16)",
  "function borrow(address,uint256,uint256,uint16,address)",
  "function flashLoanSimple(address receiver,address asset,uint256 amount,bytes params,uint16 referralCode)",
  "function liquidationCall(address collateral,address debt,address user,uint256 debtToCover,bool receiveAToken)",
  "function setUserUseReserveAsCollateral(address,bool)",
  "function setUserEMode(uint8)",
  "function getUserEMode(address) view returns (uint256)",
  "function getUserConfiguration(address) view returns (uint256)",
  "function getReserveData(address) view returns ((uint256 data) configuration,uint128,uint128,uint128,uint128,uint128,uint40 lastUpdateTimestamp,uint16 id,address aTokenAddress,address,address,address,uint128,uint128,uint128)",
  "function getUserAccountData(address) view returns (uint256 totalCollateralBase,uint256 totalDebtBase,uint256 availableBorrowsBase,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)",
  "function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)",
  "function ADDRESSES_PROVIDER() view returns (address)",
];
const BAL = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
];

/** Replace `target`'s code with MockPrice returning `price`; returns a restore function. */
async function shockPrice(provider, target, price) {
  const original = await provider.send("eth_getCode", [target, "latest"]);
  const slotBefore = await provider.send("eth_getStorageAt", [target, PRICE_SLOT, "latest"]);
  await provider.send("anvil_setCode", [target, ART.MockPrice.deployedBytecode]);
  await provider.send("anvil_setStorageAt", [target, PRICE_SLOT, ethers.toBeHex(price, 32)]);
  return async () => {
    await provider.send("anvil_setCode", [target, original]);
    await provider.send("anvil_setStorageAt", [target, PRICE_SLOT, ethers.toBeHex(BigInt(slotBefore), 32)]);
  };
}

async function deploy(name, signer, ...args) {
  const factory = new ethers.ContractFactory(ART[name].abi, ART[name].bytecode, signer);
  const c = await factory.deploy(...args);
  await c.waitForDeployment();
  return c;
}

async function warp(provider, seconds) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

// ---------- Aave / Spark ----------

async function aaveFlash(base, poolAddr) {
  const provider = getProvider(base.chain);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100000", 6);
  const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);
  const premiumBps = BigInt(await pool.FLASHLOAN_PREMIUM_TOTAL());
  const premium = (amount * premiumBps) / 10000n;
  // Fund the caller with the premium plus 1 USDC so the receiver can pay it back.
  const signer = await impersonateFunded(base.chain, "USDC", usdc, premium + 1_000_000n);
  const receiver = await deploy("AaveFlashReceiver", signer, poolAddr);
  const recvAddr = await receiver.getAddress();
  const token = new ethers.Contract(usdc, BAL, signer);
  await (await token.transfer(recvAddr, premium + 1_000_000n)).wait();
  const before = await token.balanceOf(recvAddr);
  const reserve = await pool.getReserveData(usdc);
  const aBalBefore = await token.balanceOf(reserve.aTokenAddress);
  const receipt = await (await pool.connect(signer).flashLoanSimple(recvAddr, usdc, amount, "0x", 0)).wait();
  const after = await token.balanceOf(recvAddr);
  const aBalAfter = await token.balanceOf(reserve.aTokenAddress);
  const seenAmount = await receiver.seenAmount();
  const seenPremium = await receiver.seenPremium();
  const seenBalance = await receiver.seenBalance();
  const ok =
    seenAmount === amount &&
    seenPremium === premium &&
    seenBalance >= before + amount &&
    after === before - premium &&
    aBalAfter >= aBalBefore + premium;
  return finish({
    ...base,
    ok,
    key: `borrowed=${formatUnits(seenAmount, 6)} premium=${formatUnits(seenPremium, 6)} (${premiumBps}bps)`,
    detail: `flashLoanSimple ${formatUnits(amount, 6)} USDC into ${recvAddr}\nbalance inside callback ${formatUnits(seenBalance, 6)}\nreceiver ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\npool USDC ${formatUnits(aBalBefore, 6)} -> ${formatUnits(aBalAfter, 6)}\ntx ${receipt.hash}`,
    error: ok ? null : "flash loan amount, premium or repayment did not match",
  });
}

async function aaveEmode(base) {
  const weth = COMMON_TOKENS.WETH.ethereum;
  const amount = ethers.parseEther("1");
  const signer = await impersonateFunded(base.chain, "WETH", weth, amount);
  const user = await signer.getAddress();
  const pool = new ethers.Contract(AAVE_POOL, POOL_ABI, signer);
  await (await new ethers.Contract(weth, BAL, signer).approve(AAVE_POOL, amount)).wait();
  await (await pool.supply(weth, amount, user, 0)).wait();
  const id = BigInt((await pool.getReserveData(weth)).id);
  const bit = 1n << (id * 2n + 1n);
  const isColl = async () => (BigInt(await pool.getUserConfiguration(user)) & bit) !== 0n;
  const c0 = await isColl();
  await (await pool.setUserUseReserveAsCollateral(weth, false)).wait();
  const c1 = await isColl();
  const coll1 = (await pool.getUserAccountData(user)).totalCollateralBase;
  await (await pool.setUserUseReserveAsCollateral(weth, true)).wait();
  const c2 = await isColl();
  const coll2 = (await pool.getUserAccountData(user)).totalCollateralBase;
  const category = Number(process.env.AAVE_EMODE_CATEGORY || "1");
  const e0 = await pool.getUserEMode(user);
  await (await pool.setUserEMode(category)).wait();
  const e1 = await pool.getUserEMode(user);
  const ltvE = (await pool.getUserAccountData(user)).ltv;
  await (await pool.setUserEMode(0)).wait();
  const e2 = await pool.getUserEMode(user);
  const ltv0 = (await pool.getUserAccountData(user)).ltv;
  const ok =
    c0 && !c1 && coll1 === 0n && c2 && coll2 > 0n && e0 === 0n && e1 === BigInt(category) && e2 === 0n && ltvE !== ltv0;
  return finish({
    ...base,
    ok,
    key: `collateral=${c0}->${c1}->${c2} emode=${e0}->${e1}->${e2} ltv=${ltv0}/${ltvE}`,
    detail: `supplied 1 WETH (reserve id ${id})\ncollateral flag ${c0} -> off ${c1} (collateralBase ${coll1}) -> on ${c2} (collateralBase ${coll2})\ne-mode ${e0} -> ${e1} (ltv ${ltvE}) -> ${e2} (ltv ${ltv0})`,
    error: ok ? null : "collateral toggle or e-mode switch did not take effect",
  });
}

async function aaveStake(base) {
  const provider = getProvider(base.chain);
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "10");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  if (!(await dealErc20(base.chain, AAVE_TOKEN, user, amount))) throw new Error("could not fund AAVE");
  const stk = new ethers.Contract(
    STKAAVE,
    [
      ...BAL,
      "function stake(address,uint256)",
      "function cooldown()",
      "function stakersCooldowns(address) view returns (uint256)",
      "function COOLDOWN_SECONDS() view returns (uint256)",
    ],
    signer
  );
  const before = await stk.balanceOf(user);
  await (await new ethers.Contract(AAVE_TOKEN, BAL, signer).approve(STKAAVE, amount)).wait();
  const r1 = await (await stk.stake(user, amount)).wait();
  const after = await stk.balanceOf(user);
  // stakersCooldowns returns a packed (uint40 timestamp, uint216 amount) on v1.x, a plain timestamp on older versions.
  const cooldownTs = async () => {
    const data = await provider.call({
      to: STKAAVE,
      data: stk.interface.encodeFunctionData("stakersCooldowns", [user]),
    });
    return BigInt(ethers.dataSlice(data, 0, 32)); // first word is the timestamp in both layouts
  };
  const raw = await cooldownTs();
  const r2 = await (await stk.cooldown()).wait();
  const cdTs = await cooldownTs();
  const blockTs = BigInt((await provider.getBlock(r2.blockNumber)).timestamp);
  const ok = after === before + amount && raw === 0n && cdTs === blockTs;
  return finish({
    ...base,
    ok,
    key: `stkAAVE=${ethers.formatEther(before)}->${ethers.formatEther(after)} cooldown=${cdTs}`,
    detail: `staked ${ethers.formatEther(amount)} AAVE, stkAAVE ${ethers.formatEther(before)} -> ${ethers.formatEther(after)}\ncooldown started at ${cdTs} (block ts ${blockTs}), cooldown seconds ${await stk.COOLDOWN_SECONDS()}\ntx ${r1.hash} / ${r2.hash}`,
    error: ok ? null : "stake or cooldown did not register",
  });
}

async function sparkLiquidate(base) {
  const provider = getProvider(base.chain);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const weth = COMMON_TOKENS.WETH.ethereum;
  const poolRead = new ethers.Contract(SPARK_POOL, POOL_ABI, provider);
  const provAddr = await poolRead.ADDRESSES_PROVIDER();
  const oracleAddr = await new ethers.Contract(
    provAddr,
    ["function getPriceOracle() view returns (address)"],
    provider
  ).getPriceOracle();
  const oracle = new ethers.Contract(
    oracleAddr,
    [
      "function getSourceOfAsset(address) view returns (address)",
      "function getAssetPrice(address) view returns (uint256)",
    ],
    provider
  );
  const source = await oracle.getSourceOfAsset(weth);
  const ethPrice = await oracle.getAssetPrice(weth);

  const collateral = ethers.parseEther("1");
  const borrower = await impersonateFunded(base.chain, "WETH", weth, collateral);
  const user = await borrower.getAddress();
  const pool = poolRead.connect(borrower);
  await (await new ethers.Contract(weth, BAL, borrower).approve(SPARK_POOL, collateral)).wait();
  await (await pool.supply(weth, collateral, user, 0)).wait();
  const avail = (await pool.getUserAccountData(user)).availableBorrowsBase; // 8-dec USD
  const borrow = (avail * 95n) / 100n / 100n; // USD 8 dec -> USDC 6 dec, 95% of max
  await (await pool.borrow(usdc, borrow, 2n, 0, user)).wait();
  const hfBefore = (await pool.getUserAccountData(user)).healthFactor;

  const restore = await shockPrice(provider, source, (ethPrice * 70n) / 100n);
  try {
    const hfShock = (await pool.getUserAccountData(user)).healthFactor;
    const debtBefore = (await pool.getUserAccountData(user)).totalDebtBase;
    const cover = borrow / 2n;
    const liq = await impersonateFunded(base.chain, "USDC", usdc, cover);
    const liqAddr = await liq.getAddress();
    const wethTok = new ethers.Contract(weth, BAL, provider);
    const wBefore = await wethTok.balanceOf(liqAddr);
    await (await new ethers.Contract(usdc, BAL, liq).approve(SPARK_POOL, cover)).wait();
    const receipt = await (await poolRead.connect(liq).liquidationCall(weth, usdc, user, cover, false)).wait();
    const wAfter = await wethTok.balanceOf(liqAddr);
    const debtAfter = (await pool.getUserAccountData(user)).totalDebtBase;
    const ok = hfBefore >= 10n ** 18n && hfShock < 10n ** 18n && debtAfter < debtBefore && wAfter > wBefore;
    return finish({
      ...base,
      ok,
      key: `hf=${ethers.formatEther(hfBefore)}->${ethers.formatEther(hfShock)} seized=${ethers.formatEther(wAfter - wBefore)}WETH`,
      detail: `1 WETH collateral, borrowed ${formatUnits(borrow, 6)} USDC\nWETH source ${source} shocked to 70% (${ethPrice} -> ${(ethPrice * 70n) / 100n})\ndebtBase ${debtBefore} -> ${debtAfter}\nliquidator WETH +${ethers.formatEther(wAfter - wBefore)}\ntx ${receipt.hash}`,
      error: ok ? null : "position was not liquidatable or liquidation did not seize collateral",
    });
  } finally {
    await restore();
  }
}

// ---------- Morpho ----------

async function morphoMarket(provider) {
  const { fetchMarketId, ABI } = require("./morphoBlue");
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const weth = COMMON_TOKENS.WETH.ethereum;
  const id = (process.env.MORPHO_MARKET_ID || "").trim() || (await fetchMarketId(1, usdc, weth));
  const morpho = new ethers.Contract(
    MORPHO_BLUE,
    [
      ...ABI,
      "function liquidate((address,address,address,address,uint256) marketParams,address borrower,uint256 seizedAssets,uint256 repaidShares,bytes data) returns (uint256,uint256)",
    ],
    provider
  );
  const raw = await morpho.idToMarketParams(id);
  const params = [raw[0], raw[1], raw[2], raw[3], raw[4]];
  return { id, morpho, params, usdc, weth };
}

async function morphoFlash(base) {
  const provider = getProvider(base.chain);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100000", 6);
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const receiver = await deploy("MorphoFlashReceiver", signer, MORPHO_BLUE);
  const recv = await receiver.getAddress();
  const token = new ethers.Contract(usdc, BAL, provider);
  const mBefore = await token.balanceOf(MORPHO_BLUE);
  const receipt = await (await receiver.run(usdc, amount)).wait();
  const mAfter = await token.balanceOf(MORPHO_BLUE);
  const seenAmount = await receiver.seenAmount();
  const seenBalance = await receiver.seenBalance();
  const left = await token.balanceOf(recv);
  const ok = seenAmount === amount && seenBalance === amount && mAfter === mBefore && left === 0n;
  return finish({
    ...base,
    ok,
    key: `borrowed=${formatUnits(seenAmount, 6)} morphoUSDC=${formatUnits(mBefore, 6)}->${formatUnits(mAfter, 6)}`,
    detail: `Morpho.flashLoan ${formatUnits(amount, 6)} USDC to ${recv}\nbalance inside callback ${formatUnits(seenBalance, 6)}\nMorpho USDC unchanged (fee-free)\ntx ${receipt.hash}`,
    error: ok ? null : "flash loan did not deliver or return the exact amount",
  });
}

async function morphoLiquidate(base) {
  const provider = getProvider(base.chain);
  const { id, morpho, params, usdc, weth } = await morphoMarket(provider);
  const oracle = new ethers.Contract(params[2], ["function price() view returns (uint256)"], provider);
  const price = await oracle.price(); // loan per collateral, scaled 1e36
  const collateral = ethers.parseEther("1");
  const borrower = await impersonateFunded(base.chain, "WETH", weth, collateral);
  const user = await borrower.getAddress();
  await (await new ethers.Contract(weth, BAL, borrower).approve(MORPHO_BLUE, collateral)).wait();
  await (await morpho.connect(borrower).supplyCollateral(params, collateral, user, "0x")).wait();
  const maxBorrow = (((collateral * price) / 10n ** 36n) * BigInt(params[4])) / 10n ** 18n;
  const borrow = (maxBorrow * 95n) / 100n;
  await (await morpho.connect(borrower).borrow(params, borrow, 0, user, user)).wait();
  const before = await morpho.position(id, user);

  const restore = await shockPrice(provider, params[2], (price * 70n) / 100n);
  try {
    const liq = await impersonateFunded(base.chain, "USDC", usdc, borrow);
    const liqAddr = await liq.getAddress();
    await (await new ethers.Contract(usdc, BAL, liq).approve(MORPHO_BLUE, borrow)).wait();
    const seize = collateral / 2n;
    const wethTok = new ethers.Contract(weth, BAL, provider);
    const wBefore = await wethTok.balanceOf(liqAddr);
    const receipt = await (await morpho.connect(liq).liquidate(params, user, seize, 0, "0x")).wait();
    const after = await morpho.position(id, user);
    const wAfter = await wethTok.balanceOf(liqAddr);
    const ok =
      after.collateral === before.collateral - seize &&
      after.borrowShares < before.borrowShares &&
      wAfter - wBefore === seize;
    return finish({
      ...base,
      ok,
      key: `collateral=${ethers.formatEther(before.collateral)}->${ethers.formatEther(after.collateral)} borrowShares=${before.borrowShares}->${after.borrowShares}`,
      detail: `market ${id}\nborrowed ${formatUnits(borrow, 6)} USDC on 1 WETH (LLTV ${ethers.formatEther(params[4])})\noracle ${params[2]} shocked to 70%\nliquidator seized ${ethers.formatEther(seize)} WETH\ntx ${receipt.hash}`,
      error: ok ? null : "liquidation did not seize collateral and cut debt",
    });
  } finally {
    await restore();
  }
}

// ---------- Compound III ----------

const COMET_ABI = [
  "function supply(address,uint256)",
  "function withdraw(address,uint256)",
  "function borrowBalanceOf(address) view returns (uint256)",
  "function userCollateral(address,address) view returns (uint128 balance,uint128 reserved)",
  "function getAssetInfoByAddress(address) view returns ((uint8 offset,address asset,address priceFeed,uint64 scale,uint64 borrowCollateralFactor,uint64 liquidateCollateralFactor,uint64 liquidationFactor,uint128 supplyCap))",
  "function getPrice(address) view returns (uint256)",
  "function isLiquidatable(address) view returns (bool)",
  "function absorb(address,address[])",
  "function getCollateralReserves(address) view returns (uint256)",
  "function getReserves() view returns (int256)",
  "function targetReserves() view returns (uint256)",
  "function quoteCollateral(address,uint256) view returns (uint256)",
  "function buyCollateral(address asset,uint256 minAmount,uint256 baseAmount,address recipient)",
];

async function compoundUnderwater(base, provider) {
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const weth = COMMON_TOKENS.WETH.ethereum;
  const comet = new ethers.Contract(COMPOUND_CUSDC_V3, COMET_ABI, provider);
  const info = await comet.getAssetInfoByAddress(weth);
  const price = await comet.getPrice(info.priceFeed); // 8 dec
  const collateral = ethers.parseEther("1");
  const borrower = await impersonateFunded(base.chain, "WETH", weth, collateral);
  const user = await borrower.getAddress();
  await (await new ethers.Contract(weth, BAL, borrower).approve(COMPOUND_CUSDC_V3, collateral)).wait();
  await (await comet.connect(borrower).supply(weth, collateral)).wait();
  // USD (8 dec) * borrowCF -> USDC (6 dec), 95% of the limit.
  const borrow = (((price * BigInt(info.borrowCollateralFactor)) / 10n ** 18n / 100n) * 95n) / 100n;
  await (await comet.connect(borrower).withdraw(usdc, borrow)).wait();
  const restore = await shockPrice(provider, info.priceFeed, (price * 70n) / 100n);
  return { comet, info, price, user, borrow, restore, weth, usdc };
}

async function compoundAbsorb(base) {
  const provider = getProvider(base.chain);
  const { comet, user, borrow, restore, weth } = await compoundUnderwater(base, provider);
  try {
    const liquidatable = await comet.isLiquidatable(user);
    const debtBefore = await comet.borrowBalanceOf(user);
    const resBefore = await comet.getCollateralReserves(weth);
    const absorber = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
    const receipt = await (await comet.connect(absorber).absorb(await absorber.getAddress(), [user])).wait();
    const debtAfter = await comet.borrowBalanceOf(user);
    const collAfter = (await comet.userCollateral(user, weth)).balance;
    const resAfter = await comet.getCollateralReserves(weth);
    const ok =
      liquidatable &&
      debtBefore >= borrow &&
      debtAfter === 0n &&
      collAfter === 0n &&
      resAfter - resBefore === ethers.parseEther("1");
    return finish({
      ...base,
      ok,
      key: `liquidatable=${liquidatable} debt=${formatUnits(debtBefore, 6)}->${formatUnits(debtAfter, 6)} wethReserves+=${ethers.formatEther(resAfter - resBefore)}`,
      detail: `1 WETH collateral, borrowed ${formatUnits(borrow, 6)} USDC, ETH/USD feed shocked to 70%\nabsorb wiped debt and moved the WETH into protocol reserves\ntx ${receipt.hash}`,
      error: ok ? null : "absorb did not clear the account",
    });
  } finally {
    await restore();
  }
}

async function compoundBuyCollateral(base) {
  const provider = getProvider(base.chain);
  const { comet, user, restore, weth, usdc } = await compoundUnderwater(base, provider);
  const absorber = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  try {
    await (await comet.connect(absorber).absorb(await absorber.getAddress(), [user])).wait();
  } finally {
    await restore();
  }
  const reserves = await comet.getReserves();
  const target = await comet.targetReserves();
  if (reserves >= BigInt(target)) {
    return finish({
      ...base,
      ok: false,
      error: `reserves ${reserves} >= target ${target}: buyCollateral is closed; no tx sent`,
    });
  }
  const baseAmount = ethers.parseUnits("500", 6);
  const quote = await comet.quoteCollateral(weth, baseAmount);
  const buyer = await impersonateFunded(base.chain, "USDC", usdc, baseAmount);
  const buyerAddr = await buyer.getAddress();
  const wethTok = new ethers.Contract(weth, BAL, provider);
  const wBefore = await wethTok.balanceOf(buyerAddr);
  const resBefore = await comet.getCollateralReserves(weth);
  await (await new ethers.Contract(usdc, BAL, buyer).approve(COMPOUND_CUSDC_V3, baseAmount)).wait();
  const receipt = await (
    await comet.connect(buyer).buyCollateral(weth, (quote * 99n) / 100n, baseAmount, buyerAddr)
  ).wait();
  const wAfter = await wethTok.balanceOf(buyerAddr);
  const resAfter = await comet.getCollateralReserves(weth);
  const got = wAfter - wBefore;
  // Reserves gain the USDC paid; interest accrued in the same block can add a few wei.
  const resGain = (await comet.getReserves()) - reserves;
  const ok =
    got === quote &&
    resBefore - resAfter === got &&
    resGain >= BigInt(baseAmount) &&
    resGain <= BigInt(baseAmount) + 1_000_000n;
  return finish({
    ...base,
    ok,
    key: `paid=500USDC got=${ethers.formatEther(got)}WETH quote=${ethers.formatEther(quote)}`,
    detail: `absorbed a shocked 1 WETH position, then bought ${ethers.formatEther(got)} WETH for 500 USDC at the discounted quote\nWETH reserves ${ethers.formatEther(resBefore)} -> ${ethers.formatEther(resAfter)}\ntx ${receipt.hash}`,
    error: ok ? null : "buyCollateral did not deliver the quoted WETH",
  });
}

// ---------- Curve LlamaLend ----------

const CONTROLLER_ABI = [
  "function create_loan(uint256 collateral,uint256 debt,uint256 N)",
  "function repay(uint256 debt)",
  "function liquidate(address user,uint256 min_x)",
  "function debt(address) view returns (uint256)",
  "function loan_exists(address) view returns (bool)",
  "function health(address,bool) view returns (int256)",
  "function max_borrowable(uint256,uint256) view returns (uint256)",
  "function user_state(address) view returns (uint256[4])",
];

async function llamaLoan(base, provider, fraction) {
  const vault = new ethers.Contract(
    LLAMALEND.vault,
    [
      "function controller() view returns (address)",
      "function collateral_token() view returns (address)",
      "function amm() view returns (address)",
    ],
    provider
  );
  const controllerAddr = await vault.controller();
  const collateralToken = await vault.collateral_token();
  if (collateralToken.toLowerCase() !== WSTETH.toLowerCase())
    throw new Error(`market ${LLAMALEND.marketIndex} collateral is ${collateralToken}, not wstETH`);
  const controller = new ethers.Contract(controllerAddr, CONTROLLER_ABI, provider);
  const collateral = ethers.parseEther("1");
  const N = 10n;
  const borrower = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await borrower.getAddress();
  if (!(await dealErc20(base.chain, WSTETH, user, collateral))) throw new Error("could not fund wstETH");
  const debt = ((await controller.max_borrowable(collateral, N)) * fraction) / 100n;
  await (await new ethers.Contract(WSTETH, BAL, borrower).approve(controllerAddr, collateral)).wait();
  const crv = new ethers.Contract(LLAMALEND.asset, BAL, provider);
  const cBefore = await crv.balanceOf(user);
  const receipt = await (await controller.connect(borrower).create_loan(collateral, debt, N)).wait();
  const cAfter = await crv.balanceOf(user);
  return { vault, controller, controllerAddr, borrower, user, debt, cBefore, cAfter, receipt, crv };
}

async function llamaBorrow(base) {
  const provider = getProvider(base.chain);
  const { controller, user, debt, cBefore, cAfter, receipt } = await llamaLoan(base, provider, 50n);
  const recorded = await controller.debt(user);
  const ok = (await controller.loan_exists(user)) && cAfter - cBefore === debt && recorded >= debt;
  return finish({
    ...base,
    ok,
    key: `crvUSD=${ethers.formatEther(cBefore)}->${ethers.formatEther(cAfter)} debt=${ethers.formatEther(recorded)}`,
    detail: `create_loan 1 wstETH, ${ethers.formatEther(debt)} crvUSD (50% of max_borrowable), N=10\ntx ${receipt.hash}`,
    error: ok ? null : "loan not created or crvUSD not received",
  });
}

async function llamaRepay(base) {
  const provider = getProvider(base.chain);
  const { controller, controllerAddr, borrower, user, debt, crv } = await llamaLoan(base, provider, 50n);
  await warp(provider, 3600);
  const before = await controller.debt(user);
  const part = debt / 2n;
  await (await crv.connect(borrower).approve(controllerAddr, part)).wait();
  const receipt = await (await controller.connect(borrower).repay(part)).wait();
  const after = await controller.debt(user);
  // Interest accrues between the read and the tx, so the drop is `part` within 0.001 crvUSD.
  const ok =
    before > after &&
    before - after >= part - 10n ** 15n &&
    before - after <= part &&
    (await controller.loan_exists(user));
  return finish({
    ...base,
    ok,
    key: `debt=${ethers.formatEther(before)}->${ethers.formatEther(after)}`,
    detail: `borrowed ${ethers.formatEther(debt)} crvUSD on 1 wstETH, 1h later repaid ${ethers.formatEther(part)}\ntx ${receipt.hash}`,
    error: ok ? null : "repay did not cut the debt by the amount paid",
  });
}

async function llamaLiquidate(base) {
  const provider = getProvider(base.chain);
  const { vault, controller, controllerAddr, user, debt } = await llamaLoan(base, provider, 95n);
  const amm = new ethers.Contract(
    await vault.amm(),
    ["function price_oracle_contract() view returns (address)", "function price_oracle() view returns (uint256)"],
    provider
  );
  const oracleAddr = await amm.price_oracle_contract();
  const p = await amm.price_oracle();
  const healthBefore = await controller.health(user, true);
  const restore = await shockPrice(provider, oracleAddr, (p * 60n) / 100n);
  try {
    const healthShock = await controller.health(user, true);
    const liq = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
    const liqAddr = await liq.getAddress();
    const need = debt * 2n;
    if (!(await dealErc20(base.chain, LLAMALEND.asset, liqAddr, need))) throw new Error("could not fund crvUSD");
    await (await new ethers.Contract(LLAMALEND.asset, BAL, liq).approve(controllerAddr, need)).wait();
    const wst = new ethers.Contract(WSTETH, BAL, provider);
    const wBefore = await wst.balanceOf(liqAddr);
    const receipt = await (await controller.connect(liq).liquidate(user, 0)).wait();
    const wAfter = await wst.balanceOf(liqAddr);
    const ok =
      healthBefore > 0n &&
      healthShock < 0n &&
      !(await controller.loan_exists(user)) &&
      (await controller.debt(user)) === 0n &&
      wAfter > wBefore;
    return finish({
      ...base,
      ok,
      key: `health=${ethers.formatEther(healthBefore)}->${ethers.formatEther(healthShock)} seized=${ethers.formatEther(wAfter - wBefore)}wstETH`,
      detail: `borrowed ${ethers.formatEther(debt)} crvUSD on 1 wstETH (95% of max)\nprice oracle ${oracleAddr} shocked to 60%\nliquidate closed the loan; liquidator got ${ethers.formatEther(wAfter - wBefore)} wstETH\ntx ${receipt.hash}`,
      error: ok ? null : "loan was not liquidatable or not closed",
    });
  } finally {
    await restore();
  }
}

const ACTIONS = {
  "aave:flashloan": base => aaveFlash(base, AAVE_POOL),
  "spark:flashloan": base => aaveFlash(base, SPARK_POOL),
  "aave:emode": aaveEmode,
  "aave:stake": aaveStake,
  "spark:liquidate": sparkLiquidate,
  "morpho:flashloan": morphoFlash,
  "morpho:liquidate": morphoLiquidate,
  "compound:absorb": compoundAbsorb,
  "compound:buycollateral": compoundBuyCollateral,
  "llamalend:borrow": llamaBorrow,
  "llamalend:repay": llamaRepay,
  "llamalend:liquidate": llamaLiquidate,
};

function handles(protocol, action) {
  return Boolean(ACTIONS[`${protocol}:${action}`]);
}

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  if (chain !== "ethereum") return finish({ ...base, ok: false, error: "lending extras run on an Ethereum fork only" });
  try {
    return await ACTIONS[`${protocol}:${action}`](base);
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run, handles };
