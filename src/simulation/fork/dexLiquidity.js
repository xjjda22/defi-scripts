/**
 * DEX liquidity flows on a fork: Uniswap V2/V3/V4 LP, PancakeSwap V2 swap + V3 LP + MasterChef V3
 * farm, Curve 3pool add/remove/gauge. Every flow starts from a fresh account funded with native
 * gas token only (anvil_setBalance), wraps it and swaps for the second leg on the protocol's own
 * V2 router, so no whale is needed. Any revert is a FAIL.
 *
 * Addresses (each checked for code on the fork):
 *   Uniswap: https://docs.uniswap.org/contracts/v2/reference/smart-contracts/v2-deployments
 *            https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments
 *            https://docs.uniswap.org/contracts/v4/deployments
 *   PancakeSwap (BSC): https://developer.pancakeswap.finance/contracts/v2/addresses
 *            https://developer.pancakeswap.finance/contracts/v3/addresses
 *            https://developer.pancakeswap.finance/contracts/farms/masterchef-v3
 *   Curve 3pool + gauge: https://docs.curve.finance/developer/deployments
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { DEX_LP } = require("../../catalog/contracts");
const { requireFork, formatUnits, finish } = require("./runtime");

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function deposit() payable",
];
const V2_ROUTER = [
  "function factory() view returns (address)",
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
  "function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])",
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
];
const V2_FACTORY = ["function getPair(address,address) view returns (address)"];
const V2_PAIR = [
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];
const NPM = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
  "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) payable returns (uint256,uint256)",
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns (uint256,uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function safeTransferFrom(address,address,uint256)",
  "event IncreaseLiquidity(uint256 indexed tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
];
const V3_FACTORY = ["function getPool(address,address,uint24) view returns (address)"];
const V3_POOL = ["function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint32,bool)"];
const MASTERCHEF_V3 = [
  "function v3PoolAddressPid(address) view returns (uint256)",
  "function poolInfo(uint256) view returns (uint256 allocPoint,address v3Pool,address token0,address token1,uint24 fee,uint256,uint256)",
  "function userPositionInfos(uint256) view returns (uint128 liquidity,uint128 boostLiquidity,int24 tickLower,int24 tickUpper,uint256 rewardGrowthInside,uint256 reward,address user,uint256 pid,uint256 boostMultiplier)",
  "function pendingCake(uint256) view returns (uint256)",
];
const V3_SWAP_ROUTER = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256)",
];
const POSM = [
  "function modifyLiquidities(bytes unlockData,uint256 deadline) payable",
  "function nextTokenId() view returns (uint256)",
  "function getPositionLiquidity(uint256) view returns (uint128)",
  "function ownerOf(uint256) view returns (address)",
];
const PERMIT2 = ["function approve(address token,address spender,uint160 amount,uint48 expiration)"];
const STATE_VIEW = ["function getSlot0(bytes32) view returns (uint160 sqrtPriceX96,int24 tick,uint24,uint24)"];
const CURVE_3POOL = [
  "function add_liquidity(uint256[3],uint256)",
  "function calc_token_amount(uint256[3],bool) view returns (uint256)",
  "function remove_liquidity_one_coin(uint256,int128,uint256)",
  "function calc_withdraw_one_coin(uint256,int128) view returns (uint256)",
  "function get_virtual_price() view returns (uint256)",
];
const GAUGE = [
  "function deposit(uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function lp_token() view returns (address)",
];

const coder = ethers.AbiCoder.defaultAbiCoder();
// Fixed far-future deadline: forks warp time (evm_increaseTime), so wall-clock + 1h can be stale.
const deadline = () => 4102444800;
const MAX = ethers.MaxUint256;

async function freshNative(chain, amount) {
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
  await getProvider(chain).send("anvil_setBalance", [await signer.getAddress(), ethers.toQuantity(amount)]);
  return signer;
}

/** Swap native for `token` on a V2 router with a 1% bound against getAmountsOut. */
async function buyOnV2(router, wrapped, token, value, user) {
  const path = [wrapped, token];
  const quoted = (await router.getAmountsOut(value, path))[1];
  const tokenC = new ethers.Contract(token, ERC20, router.runner);
  const before = await tokenC.balanceOf(user);
  await (await router.swapExactETHForTokens((quoted * 99n) / 100n, path, user, deadline(), { value })).wait();
  const got = (await tokenC.balanceOf(user)) - before;
  if (got < (quoted * 99n) / 100n) throw new Error(`swap got ${got} < 99% of quote ${quoted}`);
  return { got, quoted };
}

function sortPair(a, b) {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

/** Ticks one spacing-aligned band of `width` spacings either side of the current tick. */
function band(tick, spacing, width) {
  const t = Number(tick);
  const base = Math.floor(t / spacing) * spacing;
  return [base - spacing * width, base + spacing * (width + 1)];
}

/** Mint a V3 position (Uniswap or Pancake NPM). Returns tokenId, liquidity, amounts. */
async function mintV3({ npmAddr, factoryAddr, wrapped, other, fee, spacing, signer, wrapAmt, otherAmt }) {
  const user = await signer.getAddress();
  const [token0, token1] = sortPair(wrapped, other);
  const pool = await new ethers.Contract(factoryAddr, V3_FACTORY, signer).getPool(token0, token1, fee);
  if (pool === ethers.ZeroAddress) throw new Error(`no V3 pool fee ${fee}`);
  const { tick } = await new ethers.Contract(pool, V3_POOL, signer).slot0();
  const [tickLower, tickUpper] = band(tick, spacing, 20);
  for (const t of [wrapped, other]) await (await new ethers.Contract(t, ERC20, signer).approve(npmAddr, MAX)).wait();
  const amounts = wrapped === token0 ? [wrapAmt, otherAmt] : [otherAmt, wrapAmt];
  const npm = new ethers.Contract(npmAddr, NPM, signer);
  const params = {
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0Desired: amounts[0],
    amount1Desired: amounts[1],
    amount0Min: 0,
    amount1Min: 0,
    recipient: user,
    deadline: deadline(),
  };
  const preview = await npm.mint.staticCall(params);
  const receipt = await (await npm.mint(params)).wait();
  const ev = receipt.logs
    .map(l => {
      try {
        return npm.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find(e => e && e.name === "IncreaseLiquidity");
  if (!ev) throw new Error("no IncreaseLiquidity event");
  const tokenId = ev.args.tokenId;
  const pos = await npm.positions(tokenId);
  if ((await npm.ownerOf(tokenId)).toLowerCase() !== user.toLowerCase()) throw new Error("NFT not owned by minter");
  if (pos[7] === 0n || pos[7] !== ev.args.liquidity)
    throw new Error(`position liquidity ${pos[7]} != event ${ev.args.liquidity}`);
  if (ev.args.amount0 === 0n || ev.args.amount1 === 0n) throw new Error("in-range mint used only one token");
  if (preview.liquidity !== ev.args.liquidity) throw new Error("staticCall preview != mined liquidity");
  return {
    npm,
    tokenId,
    liquidity: ev.args.liquidity,
    amount0: ev.args.amount0,
    amount1: ev.args.amount1,
    token0,
    token1,
    pool,
    tick,
    tickLower,
    tickUpper,
    hash: receipt.hash,
  };
}

async function removeV3(m, signer) {
  const user = await signer.getAddress();
  const t0 = new ethers.Contract(m.token0, ERC20, signer);
  const t1 = new ethers.Contract(m.token1, ERC20, signer);
  const b0 = await t0.balanceOf(user);
  const b1 = await t1.balanceOf(user);
  const dec = { tokenId: m.tokenId, liquidity: m.liquidity, amount0Min: 0, amount1Min: 0, deadline: deadline() };
  const [owed0, owed1] = await m.npm.decreaseLiquidity.staticCall(dec);
  await (await m.npm.decreaseLiquidity(dec)).wait();
  const U128 = (1n << 128n) - 1n;
  const receipt = await (
    await m.npm.collect({ tokenId: m.tokenId, recipient: user, amount0Max: U128, amount1Max: U128 })
  ).wait();
  const got0 = (await t0.balanceOf(user)) - b0;
  const got1 = (await t1.balanceOf(user)) - b1;
  const pos = await m.npm.positions(m.tokenId);
  if (pos[7] !== 0n) throw new Error(`liquidity left ${pos[7]}`);
  if (got0 < owed0 || got1 < owed1) throw new Error(`collected ${got0}/${got1} < owed ${owed0}/${owed1}`);
  // Same block, no swaps in between: the exit must return >= 99.9% of each leg (rounding only).
  if (got0 * 1000n < m.amount0 * 999n || got1 * 1000n < m.amount1 * 999n) {
    throw new Error(`returned ${got0}/${got1} vs deposited ${m.amount0}/${m.amount1}`);
  }
  return { got0, got1, hash: receipt.hash };
}

async function uniswapV2Add(chain) {
  const C = DEX_LP.ethereum;
  const signer = await freshNative(chain, ethers.parseEther("10"));
  const user = await signer.getAddress();
  const router = new ethers.Contract(C.uniV2Router, V2_ROUTER, signer);
  await buyOnV2(router, C.WETH, C.USDC, ethers.parseEther("0.5"), user);
  await (await new ethers.Contract(C.WETH, ERC20, signer).deposit({ value: ethers.parseEther("1") })).wait();
  const pairAddr = await new ethers.Contract(await router.factory(), V2_FACTORY, signer).getPair(C.WETH, C.USDC);
  const pair = new ethers.Contract(pairAddr, V2_PAIR, signer);
  const [r0, r1] = await pair.getReserves();
  const usdc = await new ethers.Contract(C.USDC, ERC20, signer).balanceOf(user);
  for (const t of [C.WETH, C.USDC])
    await (await new ethers.Contract(t, ERC20, signer).approve(C.uniV2Router, MAX)).wait();
  const supply = await pair.totalSupply();
  const args = [C.USDC, C.WETH, usdc, ethers.parseEther("1"), (usdc * 98n) / 100n, 0, user, deadline()];
  const [usedUsdc, usedWeth, lpPreview] = await router.addLiquidity.staticCall(...args);
  const receipt = await (await router.addLiquidity(...args)).wait();
  const lp = await pair.balanceOf(user);
  const [n0, n1] = await pair.getReserves();
  const [usdcIs0] = [C.USDC.toLowerCase() < C.WETH.toLowerCase()];
  const dUsdc = usdcIs0 ? n0 - r0 : n1 - r1;
  const dWeth = usdcIs0 ? n1 - r1 : n0 - r0;
  // LP minted must equal min(share of each leg) * supply, within 0.1%.
  const expected = (usedUsdc * supply) / (usdcIs0 ? r0 : r1);
  const ok =
    lp > 0n &&
    lp === lpPreview &&
    dUsdc === usedUsdc &&
    dWeth === usedWeth &&
    lp * 1000n >= expected * 999n &&
    lp * 1000n <= expected * 1001n;
  return {
    ok,
    key: `lp=${lp}`,
    detail: `pair ${pairAddr}\nused ${formatUnits(usedUsdc, 6)} USDC + ${formatUnits(usedWeth, 18)} WETH\nLP ${lp} (expected ~${expected})\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `LP ${lp} preview ${lpPreview} expected ${expected}; reserves +${dUsdc}/+${dWeth} vs used ${usedUsdc}/${usedWeth}`,
  };
}

async function v3Setup(chain, which) {
  const C = DEX_LP[chain];
  const signer = await freshNative(chain, ethers.parseEther("20"));
  const user = await signer.getAddress();
  const isPancake = which === "pancake";
  const router = new ethers.Contract(isPancake ? C.pancakeV2Router : C.uniV2Router, V2_ROUTER, signer);
  const wrapped = isPancake ? C.WBNB : C.WETH;
  const other = isPancake ? C.USDT : C.USDC;
  const { got } = await buyOnV2(router, wrapped, other, ethers.parseEther(isPancake ? "2" : "0.5"), user);
  const wrapAmt = ethers.parseEther(isPancake ? "2" : "0.5");
  await (await new ethers.Contract(wrapped, ERC20, signer).deposit({ value: wrapAmt })).wait();
  const m = await mintV3({
    signer,
    wrapped,
    other,
    wrapAmt,
    otherAmt: got,
    npmAddr: isPancake ? C.pancakeV3Npm : C.uniV3Npm,
    factoryAddr: isPancake ? C.pancakeV3Factory : C.uniV3Factory,
    fee: 500,
    spacing: 10,
  });
  return { C, signer, user, m };
}

async function v3Mint(chain, which) {
  const { m } = await v3Setup(chain, which);
  return {
    ok: true,
    key: `tokenId=${m.tokenId} liquidity=${m.liquidity}`,
    detail: `pool ${m.pool} fee 500 tick ${m.tick} range [${m.tickLower}, ${m.tickUpper}]\namount0 ${m.amount0} amount1 ${m.amount1}\ntx ${m.hash}`,
  };
}

async function v3Remove(chain, which) {
  const { signer, m } = await v3Setup(chain, which);
  const r = await removeV3(m, signer);
  return {
    ok: true,
    key: `tokenId=${m.tokenId} back0=${r.got0} back1=${r.got1}`,
    detail: `minted ${m.liquidity} liquidity (${m.amount0} / ${m.amount1}), removed all\ncollected ${r.got0} / ${r.got1}\ntx ${r.hash}`,
  };
}

async function pancakeFarm(chain) {
  const { C, signer, user, m } = await v3Setup(chain, "pancake");
  const chef = new ethers.Contract(C.pancakeMasterChefV3, MASTERCHEF_V3, signer);
  const pid = await chef.v3PoolAddressPid(m.pool);
  const info = await chef.poolInfo(pid);
  if (pid === 0n || info.allocPoint === 0n)
    throw new Error(`pool ${m.pool} has no farm (pid ${pid}, alloc ${info.allocPoint})`);
  const receipt = await (await m.npm.safeTransferFrom(user, C.pancakeMasterChefV3, m.tokenId)).wait();
  const staked = await chef.userPositionInfos(m.tokenId);
  const owner = await m.npm.ownerOf(m.tokenId);
  const provider = getProvider(chain);
  await provider.send("evm_increaseTime", [3600]);
  await provider.send("evm_mine", []);
  // The LM pool only books CAKE growth when the V3 pool is touched, so swap 0.01 WBNB through
  // the farmed pool (Pancake V3 SwapRouter) before reading pendingCake.
  await (await new ethers.Contract(C.WBNB, ERC20, signer).deposit({ value: ethers.parseEther("0.01") })).wait();
  await (await new ethers.Contract(C.WBNB, ERC20, signer).approve(C.pancakeV3Router, MAX)).wait();
  await (
    await new ethers.Contract(C.pancakeV3Router, V3_SWAP_ROUTER, signer).exactInputSingle({
      tokenIn: C.WBNB,
      tokenOut: C.USDT,
      fee: 500,
      recipient: user,
      deadline: deadline(),
      amountIn: ethers.parseEther("0.01"),
      amountOutMinimum: 1,
      sqrtPriceLimitX96: 0,
    })
  ).wait();
  const pending = await chef.pendingCake(m.tokenId);
  const ok =
    owner.toLowerCase() === C.pancakeMasterChefV3.toLowerCase() &&
    staked.user.toLowerCase() === user.toLowerCase() &&
    staked.pid === pid &&
    staked.liquidity === m.liquidity &&
    pending > 0n;
  return {
    ok,
    key: `pid=${pid} pendingCake=${formatUnits(pending, 18)}`,
    detail: `NFT ${m.tokenId} staked in MasterChef V3 pid ${pid} (alloc ${info.allocPoint})\nliquidity ${staked.liquidity}\npending CAKE after 1h ${formatUnits(pending, 18)}\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `owner ${owner} user ${staked.user} pid ${staked.pid} liq ${staked.liquidity} pending ${pending}`,
  };
}

async function pancakeV2Swap(chain) {
  const C = DEX_LP.bsc;
  const signer = await freshNative(chain, ethers.parseEther("5"));
  const user = await signer.getAddress();
  const router = new ethers.Contract(C.pancakeV2Router, V2_ROUTER, signer);
  const value = ethers.parseEther("1");
  const { got, quoted } = await buyOnV2(router, C.WBNB, C.USDT, value, user);
  const ok = got >= quoted && got > 0n;
  return {
    ok,
    key: `out=${formatUnits(got, 18)}USDT`,
    detail: `in 1 BNB\nquoted ${formatUnits(quoted, 18)} USDT\nout ${formatUnits(got, 18)} USDT`,
    error: ok ? null : `got ${got} < quoted ${quoted} (same block)`,
  };
}

/** Uniswap V4 native ETH / USDC 0.05% pool, MINT_POSITION + SETTLE_PAIR + SWEEP through PositionManager. */
async function uniswapV4Add(chain) {
  const C = DEX_LP.ethereum;
  const signer = await freshNative(chain, ethers.parseEther("10"));
  const user = await signer.getAddress();
  const router = new ethers.Contract(C.uniV2Router, V2_ROUTER, signer);
  const { got: usdcAmt } = await buyOnV2(router, C.WETH, C.USDC, ethers.parseEther("1"), user);
  const key = {
    currency0: ethers.ZeroAddress,
    currency1: C.USDC,
    fee: 500,
    tickSpacing: 10,
    hooks: ethers.ZeroAddress,
  };
  const poolId = ethers.keccak256(
    coder.encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    )
  );
  const { sqrtPriceX96, tick } = await new ethers.Contract(C.uniV4StateView, STATE_VIEW, signer).getSlot0(poolId);
  if (sqrtPriceX96 === 0n) throw new Error(`V4 pool ${poolId} not initialized`);
  const [tickLower, tickUpper] = band(tick, 10, 20);
  // Liquidity for ~0.5 ETH on the token0 side: L = amount0 * sqrtP * sqrtB / (sqrtB - sqrtP) (Q96 math).
  const Q96 = 1n << 96n;
  const sqrtAt = t => BigInt(Math.floor(Math.sqrt(1.0001 ** t) * 2 ** 96));
  const sB = sqrtAt(tickUpper);
  const sA = sqrtAt(tickLower);
  const L0 = (ethers.parseEther("0.5") * ((sqrtPriceX96 * sB) / Q96)) / (sB - sqrtPriceX96);
  const L1 = (usdcAmt * Q96) / (sqrtPriceX96 - sA);
  const liquidity = ((L0 < L1 ? L0 : L1) * 90n) / 100n;
  const usdc = new ethers.Contract(C.USDC, ERC20, signer);
  await (await usdc.approve(C.permit2, MAX)).wait();
  await (
    await new ethers.Contract(C.permit2, PERMIT2, signer).approve(
      C.USDC,
      C.uniV4PositionManager,
      (1n << 160n) - 1n,
      2n ** 48n - 1n
    )
  ).wait();
  const posm = new ethers.Contract(C.uniV4PositionManager, POSM, signer);
  const tokenId = await posm.nextTokenId();
  const actions = "0x020d14"; // MINT_POSITION, SETTLE_PAIR, SWEEP(ETH)
  const keyT = "(address,address,uint24,int24,address)";
  const params = [
    coder.encode(
      [keyT, "int24", "int24", "uint256", "uint128", "uint128", "address", "bytes"],
      [Object.values(key), tickLower, tickUpper, liquidity, ethers.parseEther("1"), usdcAmt, user, "0x"]
    ),
    coder.encode(["address", "address"], [key.currency0, key.currency1]),
    coder.encode(["address", "address"], [ethers.ZeroAddress, user]),
  ];
  const unlockData = coder.encode(["bytes", "bytes[]"], [actions, params]);
  const provider = getProvider(chain);
  const ethBefore = await provider.getBalance(user);
  const usdcBefore = await usdc.balanceOf(user);
  const receipt = await (
    await posm.modifyLiquidities(unlockData, deadline(), { value: ethers.parseEther("1") })
  ).wait();
  const gas = receipt.gasUsed * receipt.gasPrice;
  const ethSpent = ethBefore - (await provider.getBalance(user)) - gas;
  const usdcSpent = usdcBefore - (await usdc.balanceOf(user));
  const posLiq = await posm.getPositionLiquidity(tokenId);
  const owner = await posm.ownerOf(tokenId);
  const ok =
    owner.toLowerCase() === user.toLowerCase() &&
    posLiq === liquidity &&
    ethSpent > 0n &&
    ethSpent < ethers.parseEther("1") &&
    usdcSpent > 0n;
  return {
    ok,
    key: `tokenId=${tokenId} liquidity=${posLiq}`,
    detail: `pool ${poolId} tick ${tick} range [${tickLower}, ${tickUpper}]\nspent ${formatUnits(ethSpent, 18)} ETH + ${formatUnits(usdcSpent, 6)} USDC (excess ETH swept back)\ntx ${receipt.hash}`,
    error: ok ? null : `owner ${owner} liq ${posLiq}/${liquidity} eth ${ethSpent} usdc ${usdcSpent}`,
  };
}

async function curveSetup(chain) {
  const C = DEX_LP.ethereum;
  const signer = await freshNative(chain, ethers.parseEther("10"));
  const user = await signer.getAddress();
  const router = new ethers.Contract(C.uniV2Router, V2_ROUTER, signer);
  const { got: usdcAmt } = await buyOnV2(router, C.WETH, C.USDC, ethers.parseEther("0.5"), user);
  const pool = new ethers.Contract(C.curve3pool, CURVE_3POOL, signer);
  const lpToken = new ethers.Contract(C.curve3Crv, ERC20, signer);
  await (await new ethers.Contract(C.USDC, ERC20, signer).approve(C.curve3pool, usdcAmt)).wait();
  const amounts = [0n, usdcAmt, 0n]; // DAI, USDC, USDT
  const calc = await pool.calc_token_amount(amounts, true);
  const before = await lpToken.balanceOf(user);
  const receipt = await (await pool.add_liquidity(amounts, (calc * 99n) / 100n)).wait();
  const lp = (await lpToken.balanceOf(user)) - before;
  const vp = await pool.get_virtual_price();
  // USD value of LP (virtual price, 18 dp) vs USDC in (6 dp): within 1% (fees + imbalance).
  const lpUsd6 = (lp * vp) / 10n ** 30n;
  if (lp < (calc * 99n) / 100n) throw new Error(`3Crv ${lp} < 99% of calc ${calc}`);
  if (lpUsd6 * 100n < usdcAmt * 99n) throw new Error(`LP worth ${lpUsd6} < 99% of ${usdcAmt} USDC`);
  return { C, signer, user, pool, lpToken, lp, usdcAmt, calc, hash: receipt.hash };
}

async function curveAdd(chain) {
  const s = await curveSetup(chain);
  return {
    ok: true,
    key: `3crv=${formatUnits(s.lp, 18)}`,
    detail: `in ${formatUnits(s.usdcAmt, 6)} USDC\n3Crv ${formatUnits(s.lp, 18)} (calc ${formatUnits(s.calc, 18)})\ntx ${s.hash}`,
  };
}

async function curveRemove(chain) {
  const s = await curveSetup(chain);
  const usdc = new ethers.Contract(s.C.USDC, ERC20, s.signer);
  const before = await usdc.balanceOf(s.user);
  const expected = await s.pool.calc_withdraw_one_coin(s.lp, 1);
  const receipt = await (await s.pool.remove_liquidity_one_coin(s.lp, 1, (expected * 999n) / 1000n)).wait();
  const back = (await usdc.balanceOf(s.user)) - before;
  const left = await s.lpToken.balanceOf(s.user);
  const ok = back >= expected && left === 0n && back * 100n >= s.usdcAmt * 99n;
  return {
    ok,
    key: `back=${formatUnits(back, 6)}USDC`,
    detail: `in ${formatUnits(s.usdcAmt, 6)} USDC -> ${formatUnits(s.lp, 18)} 3Crv -> ${formatUnits(back, 6)} USDC (calc ${formatUnits(expected, 6)})\ntx ${receipt.hash}`,
    error: ok ? null : `back ${back} expected ${expected} left ${left}`,
  };
}

async function curveGauge(chain) {
  const s = await curveSetup(chain);
  const gauge = new ethers.Contract(s.C.curve3poolGauge, GAUGE, s.signer);
  if ((await gauge.lp_token()).toLowerCase() !== s.C.curve3Crv.toLowerCase())
    throw new Error("gauge lp_token is not 3Crv");
  await (await s.lpToken.approve(s.C.curve3poolGauge, s.lp)).wait();
  const receipt = await (await gauge.deposit(s.lp)).wait();
  const staked = await gauge.balanceOf(s.user);
  const left = await s.lpToken.balanceOf(s.user);
  const ok = staked === s.lp && left === 0n;
  return {
    ok,
    key: `gauge=${formatUnits(staked, 18)}`,
    detail: `deposited ${formatUnits(s.lp, 18)} 3Crv into ${s.C.curve3poolGauge}\ngauge balance ${formatUnits(staked, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : `gauge ${staked} vs ${s.lp}, wallet left ${left}`,
  };
}

const FLOWS = {
  "uniswap:v2-add": uniswapV2Add,
  "uniswap:v3-mint": c => v3Mint(c, "uniswap"),
  "uniswap:v3-remove": c => v3Remove(c, "uniswap"),
  "uniswap:v4-add": uniswapV4Add,
  "pancakeswap:v2-swap": pancakeV2Swap,
  "pancakeswap:v3-mint": c => v3Mint(c, "pancake"),
  "pancakeswap:v3-remove": c => v3Remove(c, "pancake"),
  "pancakeswap:farm": pancakeFarm,
  "curve:add": curveAdd,
  "curve:remove": curveRemove,
  "curve:gauge": curveGauge,
};

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const flow = FLOWS[`${protocol}:${action}`];
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  if (!flow)
    return finish({
      ok: false,
      protocol,
      action,
      chain,
      block: ctx.forkBlock,
      error: `no dexlp flow ${protocol}:${action}`,
    });
  try {
    const r = await flow(chain);
    return finish({ protocol, action, chain, block: ctx.forkBlock, ...r });
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: ctx.forkBlock, error: err.shortMessage || err.message });
  }
}

module.exports = { run };
