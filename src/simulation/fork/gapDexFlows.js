/**
 * Feature-gap fork tests (batch "dex"): Aerodrome LP / gauge / veAERO lock on Base, Balancer V2
 * joinPool, SushiSwap V2 addLiquidity, Pendle V2 mintPyFromToken + addLiquiditySingleToken,
 * f(x) Protocol PoolManager.operate + fxUSD stability pool deposit, Convex getReward after a time
 * warp, and USD.AI USDai deposit (mint) from USDC on Arbitrum.
 *
 * Every flow runs on an Anvil fork, funds a fresh impersonated account (anvil_setBalance / whale /
 * anvil_deal), asserts on-chain state deltas, and fails on any revert. No PRIVATE_KEY.
 *
 * Run: CHAIN=<chain> FORK_PROTOCOL=<p> FORK_ACTION=<a> node src/simulation/fork/gapDexFlows.js
 *
 * Addresses (EIP-55, each checked for code on the fork):
 *   Aerodrome (Base): https://github.com/aerodrome-finance/contracts#deployment
 *     Router 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43, PoolFactory 0x420DD381b31aEf6683db6B902084cB0FFECe40Da,
 *     Voter 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5, VotingEscrow 0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4,
 *     AERO 0x940181a94A35A4569E4529A3CDfB74e38FD98631
 *   Balancer V2 Vault: https://docs.balancer.fi/reference/contracts/deployment-addresses/mainnet.html
 *     Vault 0xBA12222222228d8Ba445958a75a0704d566BF2C8, pool B-80BAL-20WETH (id 0x5c6e…0014)
 *   SushiSwap V2 (Ethereum): https://docs.sushi.com/contracts/cpamm  Router 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F
 *   Pendle V2: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/deployments/1-core.json
 *     Router V4 0x888888888889758F76e7103c6CbF23ABbF58F946, market PT-stETH-30DEC2027 (same as flows/pendle.js)
 *   f(x) Protocol V2: https://docs.aladdin.club/f-x-protocol/contracts
 *     PoolManager 0x250893CA4Ba5d05626C785e8da758026928FCD24, wstETH pool 0x6Ecfa38FeE8a5277B91eFdA204c235814F0122E8,
 *     FxUSDBasePool (stability pool) 0x65C9A641afCEB9C0E6034e558A319488FA0FA3be, fxUSD 0x085780639CC2cACd35E474e71f4d000e2405d8f6
 *   Convex: https://docs.convexfinance.com/convexfinance/faq/contract-addresses  Booster 0xF403C135812408BFbE8713b5A23a04b3D48AAE31
 *   USD.AI (Arbitrum): https://docs.usd.ai/technical-overview/contract-addresses  USDai 0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { CONVEX, USDAI } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("./runtime");

const MAX = ethers.MaxUint256;
const DEADLINE = 4102444800;
const GAS = { gasLimit: 4_000_000n };
const f18 = v => formatUnits(v, 18);
const f6 = v => formatUnits(v, 6);

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function deposit() payable",
];

const A = {
  base: {
    weth: "0x4200000000000000000000000000000000000006",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    aeroRouter: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    aeroFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    aeroVoter: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
    aeroVe: "0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4",
    aero: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    // Aero (successor to Aerodrome, live 2026-10-22): https://aero.xyz/aero-upgrade/ and
    // app.aero.xyz/docs/security (as listed at https://docs.iaero.finance/getting-started/aero-migration)
    newAero: "0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee",
    newVe: "0xBF7977E1521e9a3032bf7243Ee4712f311f13915",
    newVoter: "0x49d7d4f17Ec56Ef8fA04E464AF5D1A4942CC31e6",
    newV2Factory: "0x8E6a9FCd1d638CC760Ffba397605Fe3355dE76D2",
    newAeroUsdcPool: "0xF634058dC94e6BF8e828E27621320C423bC8B18E",
  },
  ethereum: {
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    wsteth: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    crv: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    balVault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    balPoolId: "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014",
    sushiRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    sushiFactory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
    pendleRouter: "0x888888888889758F76e7103c6CbF23ABbF58F946",
    pendleMarket: "0x34280882267ffa6383B363E278B027Be083bBe3b",
    fxPoolManager: "0x250893CA4Ba5d05626C785e8da758026928FCD24",
    fxWstethPool: "0x6Ecfa38FeE8a5277B91eFdA204c235814F0122E8",
    fxBasePool: "0x65C9A641afCEB9C0E6034e558A319488FA0FA3be",
    fxusd: "0x085780639CC2cACd35E474e71f4d000e2405d8f6",
  },
  arbitrum: {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
};

async function assertCode(chain, pairs) {
  const p = getProvider(chain);
  for (const [name, addr] of pairs) {
    const code = await p.getCode(addr);
    if (!code || code === "0x") throw new Error(`${name} ${addr} has no code on the fork`);
  }
}

async function freshNative(chain, eth = "100") {
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
  await getProvider(chain).send("anvil_setBalance", [
    await signer.getAddress(),
    ethers.toQuantity(ethers.parseEther(eth)),
  ]);
  return signer;
}

async function fundToken(chain, symbol, token, amount, signer, donor) {
  const user = await signer.getAddress();
  if (!(await dealErc20(chain, token, user, amount))) {
    if (donor) {
      // Storage slot not found: move from a named on-chain holder (isolated fork, holder is not under test).
      const d = await impersonateAccount(donor, chain);
      await (await new ethers.Contract(token, ["function transfer(address,uint256)"], d).transfer(user, amount)).wait();
      return;
    }
    // Fall back to whale -> fresh account; hand the tokens to `signer`.
    const w = await impersonateFunded(chain, symbol, token, amount);
    await (await new ethers.Contract(token, ["function transfer(address,uint256)"], w).transfer(user, amount)).wait();
  }
}

// ---------------------------------------------------------------- Aerodrome (Base)
const AERO_ROUTER = [
  "function addLiquidity(address tokenA,address tokenB,bool stable,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB,uint256 liquidity)",
  "function quoteAddLiquidity(address tokenA,address tokenB,bool stable,address factory,uint256 amountADesired,uint256 amountBDesired) view returns (uint256 amountA,uint256 amountB,uint256 liquidity)",
];
const AERO_FACTORY = ["function getPool(address,address,bool) view returns (address)"];
const AERO_VOTER = ["function gauges(address) view returns (address)", "function isAlive(address) view returns (bool)"];
const AERO_GAUGE = [
  "function deposit(uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function stakingToken() view returns (address)",
];
const AERO_VE = [
  "function createLock(uint256 value,uint256 lockDuration) returns (uint256)",
  "function locked(uint256) view returns (int128 amount,uint256 end,bool isPermanent)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOfNFT(uint256) view returns (uint256)",
  "function supply() view returns (uint256)",
  "event Deposit(address indexed provider,uint256 indexed tokenId,uint8 indexed depositType,uint256 value,uint256 locktime,uint256 ts)",
];

async function aeroAddLiquidity(chain, signer) {
  const C = A.base;
  await assertCode(chain, [
    ["Aerodrome Router", C.aeroRouter],
    ["Aerodrome PoolFactory", C.aeroFactory],
  ]);
  const user = await signer.getAddress();
  const wethAmt = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  await (await new ethers.Contract(C.weth, ERC, signer).deposit({ value: wethAmt })).wait();
  const usdcAmt = 10_000n * 10n ** 6n;
  await fundToken(chain, "USDC", C.usdc, usdcAmt, signer);
  const pool = await new ethers.Contract(C.aeroFactory, AERO_FACTORY, signer).getPool(C.weth, C.usdc, false);
  if (pool === ethers.ZeroAddress) throw new Error("no Aerodrome vAMM-WETH/USDC pool");
  const router = new ethers.Contract(C.aeroRouter, AERO_ROUTER, signer);
  const q = await router.quoteAddLiquidity(C.weth, C.usdc, false, C.aeroFactory, wethAmt, usdcAmt);
  for (const t of [C.weth, C.usdc]) await (await new ethers.Contract(t, ERC, signer).approve(C.aeroRouter, MAX)).wait();
  const lp = new ethers.Contract(pool, ERC, signer);
  const weth = new ethers.Contract(C.weth, ERC, signer);
  const usdc = new ethers.Contract(C.usdc, ERC, signer);
  const [lp0, w0, u0] = [await lp.balanceOf(user), await weth.balanceOf(user), await usdc.balanceOf(user)];
  const rc = await (
    await router.addLiquidity(
      C.weth,
      C.usdc,
      false,
      wethAmt,
      usdcAmt,
      (q.amountA * 99n) / 100n,
      (q.amountB * 99n) / 100n,
      user,
      DEADLINE,
      GAS
    )
  ).wait();
  const [lp1, w1, u1] = [await lp.balanceOf(user), await weth.balanceOf(user), await usdc.balanceOf(user)];
  const minted = lp1 - lp0;
  const ok = minted > 0n && w0 - w1 > 0n && u0 - u1 > 0n && minted * 1000n >= q.liquidity * 990n;
  return {
    ok,
    pool,
    minted,
    hash: rc.hash,
    key: `LP=+${f18(minted)} WETH=-${f18(w0 - w1)} USDC=-${f6(u0 - u1)}`,
    detail: `Router.addLiquidity vAMM-WETH/USDC ${pool}: LP +${f18(minted)} (quote ${f18(q.liquidity)}), WETH -${f18(w0 - w1)}, USDC -${f6(u0 - u1)}\ntx ${rc.hash}`,
  };
}

async function aeroGauge(chain, signer) {
  const C = A.base;
  const add = await aeroAddLiquidity(chain, signer);
  if (!add.ok) return { ...add, ok: false, error: "addLiquidity leg failed" };
  const user = await signer.getAddress();
  const voter = new ethers.Contract(C.aeroVoter, AERO_VOTER, signer);
  const gaugeAddr = await voter.gauges(add.pool);
  // Voter.isAlive() reads false for every gauge on the current Aero Voter, so check the gauge directly.
  if (gaugeAddr === ethers.ZeroAddress) throw new Error(`no gauge for ${add.pool}`);
  const gauge = new ethers.Contract(gaugeAddr, AERO_GAUGE, signer);
  if ((await gauge.stakingToken()).toLowerCase() !== add.pool.toLowerCase())
    throw new Error("gauge stakingToken != pool");
  const lp = new ethers.Contract(add.pool, ERC, signer);
  await (await lp.approve(gaugeAddr, add.minted)).wait();
  const [s0, t0] = [await gauge.balanceOf(user), await gauge.totalSupply()];
  const rc = await (await gauge.deposit(add.minted, GAS)).wait();
  const [s1, t1, lpLeft] = [await gauge.balanceOf(user), await gauge.totalSupply(), await lp.balanceOf(user)];
  const ok = s1 - s0 === add.minted && t1 - t0 === add.minted && lpLeft === 0n;
  return {
    ok,
    key: `gaugeBal=${f18(s0)}->${f18(s1)} gaugeSupply=+${f18(t1 - t0)}`,
    detail: `${add.detail}\nGauge ${gaugeAddr}.deposit(${f18(add.minted)}): staked ${f18(s0)} -> ${f18(s1)}, totalSupply +${f18(t1 - t0)}\ntx ${rc.hash}`,
  };
}

async function aeroLock(chain, signer) {
  const C = A.base;
  await assertCode(chain, [
    ["VotingEscrow", C.aeroVe],
    ["AERO", C.aero],
  ]);
  const user = await signer.getAddress();
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1000");
  await fundToken(chain, "AERO", C.aero, amount, signer);
  const aero = new ethers.Contract(C.aero, ERC, signer);
  const ve = new ethers.Contract(C.aeroVe, AERO_VE, signer);
  await (await aero.approve(C.aeroVe, amount)).wait();
  const [a0, sup0] = [await aero.balanceOf(user), await ve.supply()];
  const duration = 4n * 365n * 86400n;
  const rc = await (await ve.createLock(amount, duration, GAS)).wait();
  const ev = rc.logs
    .map(l => {
      try {
        return ve.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find(e => e && e.name === "Deposit");
  if (!ev) throw new Error("no VotingEscrow Deposit event");
  const tokenId = ev.args.tokenId;
  const locked = await ve.locked(tokenId);
  const [a1, sup1, power, owner] = [
    await aero.balanceOf(user),
    await ve.supply(),
    await ve.balanceOfNFT(tokenId),
    await ve.ownerOf(tokenId),
  ];
  const ok =
    a0 - a1 === amount &&
    sup1 - sup0 === amount &&
    BigInt(locked.amount) === amount &&
    power > 0n &&
    owner.toLowerCase() === user.toLowerCase();
  return {
    ok,
    key: `veNFT=${tokenId} locked=${f18(BigInt(locked.amount))} power=${f18(power)} AERO=-${f18(a0 - a1)}`,
    detail: `VotingEscrow.createLock(${f18(amount)} AERO, 4y): veNFT #${tokenId}, locked ${f18(BigInt(locked.amount))} until ${new Date(Number(locked.end) * 1000).toISOString()}, voting power ${f18(power)}, ve supply +${f18(sup1 - sup0)}\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- Balancer V2 joinPool
const BAL_VAULT = [
  "function getPoolTokens(bytes32) view returns (address[] tokens,uint256[] balances,uint256 lastChangeBlock)",
  "function getPool(bytes32) view returns (address,uint8)",
  "function joinPool(bytes32 poolId,address sender,address recipient,(address[] assets,uint256[] maxAmountsIn,bytes userData,bool fromInternalBalance) request) payable",
];
async function balancerJoin(chain, signer) {
  const C = A.ethereum;
  await assertCode(chain, [["Balancer Vault", C.balVault]]);
  const user = await signer.getAddress();
  const vault = new ethers.Contract(C.balVault, BAL_VAULT, signer);
  const [poolAddr] = await vault.getPool(C.balPoolId);
  const { tokens, balances } = await vault.getPoolTokens(C.balPoolId);
  const wi = tokens.findIndex(t => t.toLowerCase() === C.weth.toLowerCase());
  if (wi < 0) throw new Error("WETH not in pool");
  const amt = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  await (await new ethers.Contract(C.weth, ERC, signer).deposit({ value: amt })).wait();
  await (await new ethers.Contract(C.weth, ERC, signer).approve(C.balVault, amt)).wait();
  const assets = [...tokens];
  const amounts = assets.map((_, i) => (i === wi ? amt : 0n));
  // WeightedPool JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT = 1
  const userData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256[]", "uint256"], [1, amounts, 0]);
  const bpt = new ethers.Contract(poolAddr, ERC, signer);
  const weth = new ethers.Contract(C.weth, ERC, signer);
  const [b0, w0] = [await bpt.balanceOf(user), await weth.balanceOf(user)];
  const rc = await (
    await vault.joinPool(
      C.balPoolId,
      user,
      user,
      { assets, maxAmountsIn: amounts, userData, fromInternalBalance: false },
      GAS
    )
  ).wait();
  const [b1, w1] = [await bpt.balanceOf(user), await weth.balanceOf(user)];
  const { balances: after } = await vault.getPoolTokens(C.balPoolId);
  const ok = b1 - b0 > 0n && w0 - w1 === amt && after[wi] - balances[wi] === amt;
  return {
    ok,
    key: `BPT=+${f18(b1 - b0)} WETH=-${f18(w0 - w1)} poolWETH=+${f18(after[wi] - balances[wi])}`,
    detail: `Vault.joinPool B-80BAL-20WETH (${poolAddr}) EXACT_TOKENS_IN: WETH -${f18(w0 - w1)}, BPT +${f18(b1 - b0)}, pool WETH balance +${f18(after[wi] - balances[wi])}\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- SushiSwap V2 addLiquidity
const V2_ROUTER = [
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
  "function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])",
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
];
async function sushiAdd(chain, signer) {
  const C = A.ethereum;
  await assertCode(chain, [["Sushi V2 Router", C.sushiRouter]]);
  const user = await signer.getAddress();
  const router = new ethers.Contract(C.sushiRouter, V2_ROUTER, signer);
  const swapIn = ethers.parseEther("1");
  const path = [C.weth, C.usdc];
  const quoted = (await router.getAmountsOut(swapIn, path))[1];
  await (await router.swapExactETHForTokens((quoted * 99n) / 100n, path, user, DEADLINE, { value: swapIn })).wait();
  const weth = new ethers.Contract(C.weth, ERC, signer);
  const usdc = new ethers.Contract(C.usdc, ERC, signer);
  await (await weth.deposit({ value: ethers.parseEther("1") })).wait();
  const pair = await new ethers.Contract(
    C.sushiFactory,
    ["function getPair(address,address) view returns (address)"],
    signer
  ).getPair(C.weth, C.usdc);
  const lp = new ethers.Contract(pair, ERC, signer);
  for (const t of [weth, usdc]) await (await t.approve(C.sushiRouter, MAX)).wait();
  const [l0, w0, u0] = [await lp.balanceOf(user), await weth.balanceOf(user), await usdc.balanceOf(user)];
  const rc = await (await router.addLiquidity(C.weth, C.usdc, w0, u0, 0, 0, user, DEADLINE, GAS)).wait();
  const [l1, w1, u1] = [await lp.balanceOf(user), await weth.balanceOf(user), await usdc.balanceOf(user)];
  const ok = l1 - l0 > 0n && w0 - w1 > 0n && u0 - u1 > 0n;
  return {
    ok,
    key: `SLP=+${f18(l1 - l0)} WETH=-${f18(w0 - w1)} USDC=-${f6(u0 - u1)}`,
    detail: `Sushi V2 Router.addLiquidity WETH/USDC pair ${pair}: SLP +${f18(l1 - l0)}, WETH -${f18(w0 - w1)}, USDC -${f6(u0 - u1)}\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- Pendle V2
const ORDER =
  "(uint256 salt, uint256 expiry, uint256 nonce, uint8 orderType, address token, address YT, address maker, address receiver, uint256 makingAmount, uint256 lnImpliedRate, uint256 failSafeRate, bytes permit)";
const FILL = `((${ORDER.slice(1, -1)}) order, bytes signature, uint256 makingAmount)`;
const TOKEN_INPUT =
  "(address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData)";
const APPROX = "(uint256 guessMin, uint256 guessMax, uint256 guessOffchain, uint256 maxIteration, uint256 eps)";
const LIMIT = `(address limitRouter, uint256 epsSkipMarket, ${FILL}[] normalFills, ${FILL}[] flashFills, bytes optData)`;
const PENDLE_ROUTER = [
  `function mintPyFromToken(address receiver, address YT, uint256 minPyOut, ${TOKEN_INPUT} input) payable returns (uint256 netPyOut, uint256 netSyInterm)`,
  `function addLiquiditySingleToken(address receiver, address market, uint256 minLpOut, ${APPROX} guessPtReceivedFromSy, ${TOKEN_INPUT} input, ${LIMIT} limit) payable returns (uint256 netLpOut, uint256 netSyFee, uint256 netSyInterm)`,
];
const MARKET_ABI = [
  "function readTokens() view returns (address,address,address)",
  "function isExpired() view returns (bool)",
  ...ERC,
];
const tokenInput = (tok, amt) => ({
  tokenIn: tok,
  netTokenIn: amt,
  tokenMintSy: tok,
  pendleSwap: ethers.ZeroAddress,
  swapData: { swapType: 0, extRouter: ethers.ZeroAddress, extCalldata: "0x", needScale: false },
});

async function pendle(chain, action) {
  const C = A.ethereum;
  await assertCode(chain, [
    ["Pendle Router V4", C.pendleRouter],
    ["Pendle market", C.pendleMarket],
  ]);
  const market = new ethers.Contract(C.pendleMarket, MARKET_ABI, getProvider(chain));
  if (await market.isExpired()) throw new Error("Pendle market expired");
  const [, ptAddr, ytAddr] = await market.readTokens();
  const amt = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await impersonateFunded(chain, "wstETH", C.wsteth, amt);
  const user = await signer.getAddress();
  const wst = new ethers.Contract(C.wsteth, ERC, signer);
  await (await wst.approve(C.pendleRouter, amt)).wait();
  const router = new ethers.Contract(C.pendleRouter, PENDLE_ROUTER, signer);
  const w0 = await wst.balanceOf(user);
  if (action === "mint-py") {
    const pt = new ethers.Contract(ptAddr, ERC, signer);
    const yt = new ethers.Contract(ytAddr, ERC, signer);
    const [p0, y0] = [await pt.balanceOf(user), await yt.balanceOf(user)];
    const preview = await router.mintPyFromToken.staticCall(user, ytAddr, 0, tokenInput(C.wsteth, amt), GAS);
    const rc = await (await router.mintPyFromToken(user, ytAddr, 0, tokenInput(C.wsteth, amt), GAS)).wait();
    const [p1, y1, w1] = [await pt.balanceOf(user), await yt.balanceOf(user), await wst.balanceOf(user)];
    const ok = p1 - p0 > 0n && p1 - p0 === y1 - y0 && w0 - w1 === amt && p1 - p0 === preview.netPyOut;
    return {
      ok,
      key: `PT=+${f18(p1 - p0)} YT=+${f18(y1 - y0)} wstETH=-${f18(w0 - w1)}`,
      detail: `Router.mintPyFromToken(YT ${ytAddr}, 1 wstETH): PT +${f18(p1 - p0)}, YT +${f18(y1 - y0)} (preview ${f18(preview.netPyOut)}, SY interm ${f18(preview.netSyInterm)})\ntx ${rc.hash}`,
    };
  }
  const approx = { guessMin: 0, guessMax: MAX, guessOffchain: 0, maxIteration: 256, eps: 10n ** 14n };
  const limit = { limitRouter: ethers.ZeroAddress, epsSkipMarket: 0, normalFills: [], flashFills: [], optData: "0x" };
  const l0 = await market.balanceOf(user);
  const preview = await router.addLiquiditySingleToken.staticCall(
    user,
    C.pendleMarket,
    0,
    approx,
    tokenInput(C.wsteth, amt),
    limit,
    GAS
  );
  const rc = await (
    await router.addLiquiditySingleToken(user, C.pendleMarket, 0, approx, tokenInput(C.wsteth, amt), limit, GAS)
  ).wait();
  const [l1, w1] = [await market.balanceOf(user), await wst.balanceOf(user)];
  const got = l1 - l0;
  const ok = got > 0n && w0 - w1 === amt && got * 1000n >= preview.netLpOut * 995n;
  return {
    ok,
    key: `LPT=+${f18(got)} wstETH=-${f18(w0 - w1)}`,
    detail: `Router.addLiquiditySingleToken(market ${C.pendleMarket}, 1 wstETH): LP +${f18(got)} (preview ${f18(preview.netLpOut)}, SY fee ${f18(preview.netSyFee)})\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- f(x) Protocol V2
const FX_PM = [
  "function operate(address pool,uint256 positionId,int256 newColl,int256 newDebt) returns (uint256)",
  "function fxUSD() view returns (address)",
];
const FX_POOL = [
  "function collateralToken() view returns (address)",
  "function getPosition(uint256) view returns (uint256 rawColls,uint256 rawDebts)",
  "function ownerOf(uint256) view returns (address)",
  "function getNextPositionId() view returns (uint32)",
];
const FX_BASE = [
  ...ERC,
  "function deposit(address receiver,address tokenIn,uint256 amountTokenToDeposit,uint256 minSharesOut) returns (uint256)",
  "function previewDeposit(address tokenIn,uint256 amount) view returns (uint256)",
];
async function fxOperate(chain) {
  const C = A.ethereum;
  await assertCode(chain, [
    ["fx PoolManager", C.fxPoolManager],
    ["fx wstETH pool", C.fxWstethPool],
  ]);
  const pm0 = new ethers.Contract(C.fxPoolManager, FX_PM, getProvider(chain));
  if ((await pm0.fxUSD()).toLowerCase() !== C.fxusd.toLowerCase()) throw new Error("PoolManager.fxUSD changed");
  const coll = ethers.parseEther(process.env.FORK_AMOUNT || "2");
  const debt = ethers.parseEther(process.env.FORK_BORROW || "2000");
  const signer = await impersonateFunded(chain, "wstETH", C.wsteth, coll);
  const user = await signer.getAddress();
  const wst = new ethers.Contract(C.wsteth, ERC, signer);
  const fx = new ethers.Contract(C.fxusd, ERC, signer);
  await (await wst.approve(C.fxPoolManager, coll)).wait();
  const pm = pm0.connect(signer);
  const [w0, x0] = [await wst.balanceOf(user), await fx.balanceOf(user)];
  const posId = await pm.operate.staticCall(C.fxWstethPool, 0, coll, debt, GAS);
  const rc = await (await pm.operate(C.fxWstethPool, 0, coll, debt, GAS)).wait();
  const pool = new ethers.Contract(C.fxWstethPool, FX_POOL, signer);
  const [w1, x1] = [await wst.balanceOf(user), await fx.balanceOf(user)];
  const pos = await pool.getPosition(posId);
  const owner = await pool.ownerOf(posId);
  // Opening fee is taken from minted fxUSD, so received <= debt.
  const ok =
    w0 - w1 === coll &&
    x1 - x0 > 0n &&
    x1 - x0 <= debt &&
    pos.rawColls > 0n &&
    pos.rawDebts > 0n &&
    owner.toLowerCase() === user.toLowerCase();
  return {
    ok,
    signer,
    minted: x1 - x0,
    key: `position=${posId} wstETH=-${f18(w0 - w1)} fxUSD=+${f18(x1 - x0)} rawColl=${f18(pos.rawColls)} rawDebt=${f18(pos.rawDebts)}`,
    detail: `PoolManager.operate(wstETH pool, new, +${f18(coll)} coll, +${f18(debt)} debt): position #${posId} owned by user, fxUSD +${f18(x1 - x0)}, rawColls ${f18(pos.rawColls)}, rawDebts ${f18(pos.rawDebts)}\ntx ${rc.hash}`,
  };
}
async function fxStability(chain) {
  const C = A.ethereum;
  await assertCode(chain, [
    ["FxUSDBasePool", C.fxBasePool],
    ["fxUSD", C.fxusd],
  ]);
  const amt = ethers.parseEther(process.env.FORK_AMOUNT || "1000");
  const signer = await freshNative(chain, "1");
  await fundToken(chain, "fxUSD", C.fxusd, amt, signer);
  const user = await signer.getAddress();
  const fx = new ethers.Contract(C.fxusd, ERC, signer);
  const sp = new ethers.Contract(C.fxBasePool, FX_BASE, signer);
  await (await fx.approve(C.fxBasePool, amt)).wait();
  const [x0, s0, ts0] = [await fx.balanceOf(user), await sp.balanceOf(user), await sp.totalSupply()];
  const preview = await sp.previewDeposit(C.fxusd, amt);
  const rc = await (await sp.deposit(user, C.fxusd, amt, (preview * 99n) / 100n, GAS)).wait();
  const [x1, s1, ts1] = [await fx.balanceOf(user), await sp.balanceOf(user), await sp.totalSupply()];
  const ok = x0 - x1 === amt && s1 - s0 > 0n && ts1 - ts0 === s1 - s0;
  return {
    ok,
    key: `fxUSD=-${f18(x0 - x1)} fxBASE=+${f18(s1 - s0)}`,
    detail: `FxUSDBasePool.deposit(${f18(amt)} fxUSD): shares +${f18(s1 - s0)} (preview ${f18(preview)}), totalSupply +${f18(ts1 - ts0)}\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- Convex claim
const BOOSTER = [
  "function poolInfo(uint256) view returns (address lptoken,address token,address gauge,address crvRewards,address stash,bool shutdown)",
  "function deposit(uint256,uint256,bool) returns (bool)",
  "function earmarkRewards(uint256) returns (bool)",
];
const BRP = [
  "function balanceOf(address) view returns (uint256)",
  "function earned(address) view returns (uint256)",
  "function getReward() returns (bool)",
];
async function convexClaim(chain) {
  const C = A.ethereum;
  const provider = getProvider(chain);
  const booster = new ethers.Contract(CONVEX.booster, BOOSTER, provider);
  const pid = BigInt(process.env.CONVEX_PID || CONVEX.pid);
  const info = await booster.poolInfo(pid);
  if (info.shutdown) throw new Error(`Convex pid ${pid} shut down`);
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "100000");
  const signer = await impersonateFunded(chain, "3Crv", info.lptoken, amount);
  const user = await signer.getAddress();
  await (await new ethers.Contract(info.lptoken, ERC, signer).approve(CONVEX.booster, amount)).wait();
  await (await booster.connect(signer).deposit(pid, amount, true, GAS)).wait();
  const rewards = new ethers.Contract(info.crvRewards, BRP, signer);
  // pid 9's reward period may have ended; earmarkRewards pulls the gauge's accrued CRV into the
  // BaseRewardPool and starts a new 7-day period, then a second warp accrues rewards to the user.
  await provider.send("evm_increaseTime", [86400]);
  await provider.send("evm_mine", []);
  await (await booster.connect(signer).earmarkRewards(pid, GAS)).wait();
  const warp = 3 * 86400;
  await provider.send("evm_increaseTime", [warp]);
  await provider.send("evm_mine", []);
  const earned = await rewards.earned(user);
  const crv = new ethers.Contract(C.crv, ERC, provider);
  const c0 = await crv.balanceOf(user);
  const rc = await (await rewards.getReward(GAS)).wait();
  const c1 = await crv.balanceOf(user);
  const after = await rewards.earned(user);
  const ok = earned > 0n && c1 - c0 >= earned && after === 0n;
  return {
    ok,
    key: `CRV=+${f18(c1 - c0)} earned=${f18(earned)}->${f18(after)}`,
    detail: `Booster.deposit(pid ${pid}, ${f18(amount)} LP, stake) -> warp 1d, earmarkRewards, warp ${warp}s -> BaseRewardPool ${info.crvRewards}.getReward(): earned ${f18(earned)}, CRV +${f18(c1 - c0)}, earned after ${f18(after)}\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- USD.AI mint
const USDAI_ABI = [
  ...ERC,
  "function baseToken() view returns (address)",
  "function deposit(address depositToken,uint256 depositAmount,uint256 usdaiAmountMinimum,address recipient) returns (uint256)",
];
/**
 * USDai mints 1:1 from its baseToken (PYUSD on Arbitrum at this fork). USDC is rejected: both the
 * 4-arg deposit(USDC,…) and the 5-arg swap-path deposit revert InvalidAddress() (0xe6c4247b), so the
 * test mints from the live baseToken() and records the USDC rejection as a static-call check.
 * Funding: anvil_dealERC20 finds no PYUSD slot, so PYUSD is moved from the USDai contract's own
 * reserve (fresh fork, isolated) when the slot probe also misses.
 */
async function usdaiMint(chain) {
  const C = A.arbitrum;
  await assertCode(chain, [
    ["USDai", USDAI.usdai],
    ["USDC", C.usdc],
  ]);
  const provider = getProvider(chain);
  const reader = new ethers.Contract(USDAI.usdai, USDAI_ABI, provider);
  const baseToken = await reader.baseToken();
  const amt = 1000n * 10n ** 6n;
  const signer = await freshNative(chain, "1");
  const user = await signer.getAddress();
  // USDC must be rejected (documents the gap note "mint from USDC").
  let usdcRejected = false;
  try {
    await reader.deposit.staticCall(C.usdc, amt, 0, user, { from: user });
  } catch (e) {
    usdcRejected = /e6c4247b|InvalidAddress/i.test(explain(e));
  }
  if (!(await dealErc20(chain, baseToken, user, amt))) {
    const donor = await impersonateAccount(USDAI.usdai, chain);
    await (
      await new ethers.Contract(baseToken, ["function transfer(address,uint256)"], donor).transfer(user, amt)
    ).wait();
  }
  const base = new ethers.Contract(baseToken, ERC, signer);
  const usdai = reader.connect(signer);
  await (await base.approve(USDAI.usdai, amt)).wait();
  const [u0, a0, s0] = [await base.balanceOf(user), await usdai.balanceOf(user), await usdai.totalSupply()];
  const minOut = (amt * 10n ** 12n * 99n) / 100n;
  const rc = await (await usdai.deposit(baseToken, amt, minOut, user, GAS)).wait();
  const [u1, a1, s1] = [await base.balanceOf(user), await usdai.balanceOf(user), await usdai.totalSupply()];
  const ok = u0 - u1 === amt && a1 - a0 >= minOut && s1 - s0 === a1 - a0;
  return {
    ok,
    key: `PYUSD=-${f6(u0 - u1)} USDai=+${f18(a1 - a0)} supply=+${f18(s1 - s0)} usdcRejected=${usdcRejected}`,
    detail: `USDai.deposit(baseToken ${baseToken}, ${f6(amt)}): base -${f6(u0 - u1)}, USDai +${f18(a1 - a0)}, totalSupply +${f18(s1 - s0)}\ndeposit(USDC) static call rejected with InvalidAddress(): ${usdcRejected}\ntx ${rc.hash}`,
  };
}

// ---------------------------------------------------------------- Aero (new, post 2026-10-22)
const AERO2_POOL = [
  ...ERC,
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function factory() view returns (address)",
  "function getReserves() view returns (uint256,uint256,uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function mint(address to) returns (uint256 liquidity)",
];
/** Aero v2 pool: transfer both legs pro-rata, then pool.mint(user) (core LP entry the Metarouter wraps). */
async function aero2AddLiquidity(chain, signer) {
  const C = A.base;
  await assertCode(chain, [
    ["Aero v2 factory", C.newV2Factory],
    ["Aero AERO/USDC pool", C.newAeroUsdcPool],
    ["AERO (Aero)", C.newAero],
  ]);
  const user = await signer.getAddress();
  const pool = new ethers.Contract(C.newAeroUsdcPool, AERO2_POOL, signer);
  if ((await pool.factory()).toLowerCase() !== C.newV2Factory.toLowerCase())
    throw new Error("pool factory is not the Aero v2 factory");
  const [t0, t1] = [await pool.token0(), await pool.token1()];
  const [r0, r1] = await pool.getReserves();
  const amt1 = 1000n * 10n ** 6n; // USDC leg
  const amt0 = (amt1 * r0) / r1 + 1n;
  await fundToken(chain, "AERO", t0, amt0, signer, C.newVe);
  await fundToken(chain, "USDC", t1, amt1, signer);
  const tok0 = new ethers.Contract(t0, [...ERC, "function transfer(address,uint256) returns (bool)"], signer);
  const tok1 = new ethers.Contract(t1, [...ERC, "function transfer(address,uint256) returns (bool)"], signer);
  const [l0, ts0] = [await pool.balanceOf(user), await pool.totalSupply()];
  await (await tok0.transfer(C.newAeroUsdcPool, amt0)).wait();
  await (await tok1.transfer(C.newAeroUsdcPool, amt1)).wait();
  const rc = await (await pool.mint(user, GAS)).wait();
  const [l1, ts1] = [await pool.balanceOf(user), await pool.totalSupply()];
  const [n0, n1] = await pool.getReserves();
  const minted = l1 - l0;
  const ok = minted > 0n && ts1 - ts0 === minted && n0 - r0 === amt0 && n1 - r1 === amt1;
  return {
    ok,
    key: `LP=+${f18(minted)} AERO=-${f18(amt0)} USDC=-${f6(amt1)} reserves=+${f18(n0 - r0)}/+${f6(n1 - r1)}`,
    detail: `Aero v2 AERO/USDC ${C.newAeroUsdcPool}: transferred ${f18(amt0)} AERO + ${f6(amt1)} USDC, mint(user): LP +${f18(minted)}, totalSupply +${f18(ts1 - ts0)}, reserves ${f18(r0)}/${f6(r1)} -> ${f18(n0)}/${f6(n1)}\ntx ${rc.hash}`,
  };
}
const AERO2_VE = [
  "function TOKEN() view returns (address)",
  "function createStake(uint128 amount,uint48 duration,bool permanent) returns (uint256)",
  "function staked(uint256) view returns (int128 amount,uint256 end,bool isPermanent)",
  "function balanceOfNFT(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function supply() view returns (uint256)",
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
];
/** Aero replaced veAERO locks with sAERO stakes: VotingEscrow.createStake(amount, duration, false). */
async function aero2Lock(chain, signer) {
  const C = A.base;
  await assertCode(chain, [
    ["Aero VotingEscrow", C.newVe],
    ["AERO (Aero)", C.newAero],
  ]);
  const user = await signer.getAddress();
  const ve = new ethers.Contract(C.newVe, AERO2_VE, signer);
  if ((await ve.TOKEN()).toLowerCase() !== C.newAero.toLowerCase())
    throw new Error("VotingEscrow.TOKEN is not Aero AERO");
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1000");
  await fundToken(chain, "AERO", C.newAero, amount, signer, C.newAeroUsdcPool);
  const aero = new ethers.Contract(C.newAero, ERC, signer);
  await (await aero.approve(C.newVe, amount)).wait();
  // duration is in weeks on Aero (52 ok; 604800 reverts 0xb0f8f3e6).
  const duration = BigInt(process.env.AERO_STAKE_WEEKS || 52);
  const [a0, sup0] = [await aero.balanceOf(user), await ve.supply()];
  const rc = await (await ve.createStake(amount, duration, false, GAS)).wait();
  const ev = rc.logs
    .map(l => {
      try {
        return ve.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find(e => e && e.name === "Transfer" && e.args.from === ethers.ZeroAddress);
  if (!ev) throw new Error("no sAERO NFT mint (Transfer from 0)");
  const tokenId = ev.args.tokenId;
  const st = await ve.staked(tokenId);
  const [a1, sup1, power, owner] = [
    await aero.balanceOf(user),
    await ve.supply(),
    await ve.balanceOfNFT(tokenId),
    await ve.ownerOf(tokenId),
  ];
  const ok =
    a0 - a1 === amount &&
    sup1 - sup0 === amount &&
    BigInt(st.amount) === amount &&
    power > 0n &&
    owner.toLowerCase() === user.toLowerCase();
  return {
    ok,
    key: `sAERO=${tokenId} staked=${f18(BigInt(st.amount))} power=${f18(power)} AERO=-${f18(a0 - a1)}`,
    detail: `Aero VotingEscrow.createStake(${f18(amount)} AERO, ${duration} weeks): NFT #${tokenId}, staked ${f18(BigInt(st.amount))} until ${new Date(Number(st.end) * 1000).toISOString()}, voting power ${f18(power)}, supply +${f18(sup1 - sup0)}\ntx ${rc.hash}`,
  };
}

const ACTIONS = {
  "aero:add-liquidity": { chain: "base", fn: async c => aero2AddLiquidity(c, await freshNative(c)) },
  "aero:lock": { chain: "base", fn: async c => aero2Lock(c, await freshNative(c)) },
  // Legacy Aerodrome (pre 2026-10-22) paths, kept for reference: gauge-stake reverts NotAlive().
  "aerodrome:add-liquidity": { chain: "base", fn: async c => aeroAddLiquidity(c, await freshNative(c)) },
  "aerodrome:gauge-stake": { chain: "base", fn: async c => aeroGauge(c, await freshNative(c)) },
  "aerodrome:lock": { chain: "base", fn: async c => aeroLock(c, await freshNative(c)) },
  "balancer:join": { chain: "ethereum", fn: async c => balancerJoin(c, await freshNative(c)) },
  "sushiswap:add-liquidity": { chain: "ethereum", fn: async c => sushiAdd(c, await freshNative(c)) },
  "pendle:mint-py": { chain: "ethereum", fn: c => pendle(c, "mint-py") },
  "pendle:add-liquidity": { chain: "ethereum", fn: c => pendle(c, "add-liquidity") },
  "fx:operate": { chain: "ethereum", fn: c => fxOperate(c) },
  "fx:stability-deposit": { chain: "ethereum", fn: c => fxStability(c) },
  "convex:claim": { chain: "ethereum", fn: c => convexClaim(c) },
  "usdai:mint": { chain: "arbitrum", fn: c => usdaiMint(c) },
};

function explain(err) {
  const data = typeof err?.data === "string" ? err.data : err?.info?.error?.data || "";
  return `${err?.shortMessage || err?.reason || err?.message || err} ${typeof data === "string" ? data : ""}`.trim();
}

async function run() {
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const spec = ACTIONS[`${protocol}:${action}`];
  const chain = spec?.chain || process.env.CHAIN || "ethereum";
  const base = { protocol, action, chain, block: null };
  if (!spec)
    return finish({
      ...base,
      ok: false,
      error: `Unknown action ${protocol}:${action}. Known: ${Object.keys(ACTIONS).join(", ")}`,
    });
  try {
    base.block = (await requireFork(chain)).forkBlock;
  } catch (err) {
    return finish({ ...base, ok: false, error: err.message });
  }
  try {
    const r = await spec.fn(chain);
    return finish({
      ...base,
      ok: r.ok,
      key: r.key,
      detail: r.detail,
      error: r.ok ? null : r.error || "state delta check failed",
    });
  } catch (err) {
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run, ACTIONS };
if (require.main === module) run();
