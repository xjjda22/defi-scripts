/**
 * Special-gap fork tests (batch "special"). Standalone runner, so it does not need a run.js target:
 *   CHAIN=ethereum FORK_PROTOCOL=sky FORK_ACTION=vault node src/simulation/fork/specialFlows.js
 *   CHAIN=ethereum FORK_PROTOCOL=xdai-stake-bridge FORK_ACTION=relay node src/simulation/fork/specialFlows.js
 * Needs a local Anvil fork of Ethereum (ETHEREUM_RPC_URL pointing at it). No PRIVATE_KEY.
 *
 * Sources:
 * - Sky/Maker chainlog (MCD_VAT, MCD_JOIN_ETH_A, USDS_JOIN): https://chainlog.sky.money/api/mainnet/active.json
 *   and https://developers.sky.money
 * - Gnosis OmniBridge (ForeignOmnibridge, Ethereum): https://docs.gnosischain.com/bridges/About%20Token%20Bridges/omnibridge
 *   (address also cited by the DefiLlama xdai adapter: src/catalog/contracts.js "xdai-stake-bridgeDoc")
 */

require("dotenv").config();
const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ADDR = {
  vat: "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B",
  ethAJoin: "0x2F0b23f53734252Bda2277357e97e1517d6B042A",
  usdsJoin: "0x3C0f895007CA717Aa01c8693e59DF1e8C3777FEB",
  usds: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  omnibridge: "0x88ad09518695c6c3712AC10a214bE5109a655671",
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};
const RAY = 10n ** 27n;
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function deposit() payable",
];

async function skyVault(provider, block) {
  const chain = "ethereum";
  const user = ethers.Wallet.createRandom().address;
  const signer = await impersonateAccount(user, chain);
  const ink = ethers.parseEther("10");
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(ink + ethers.parseEther("1"))]);
  const weth = new ethers.Contract(ADDR.weth, ERC, signer);
  const usds = new ethers.Contract(ADDR.usds, ERC, signer);
  const vat = new ethers.Contract(
    ADDR.vat,
    [
      "function ilks(bytes32) view returns (uint256 Art,uint256 rate,uint256 spot,uint256 line,uint256 dust)",
      "function urns(bytes32,address) view returns (uint256 ink,uint256 art)",
      "function frob(bytes32,address,address,address,int256,int256)",
      "function hope(address)",
    ],
    signer
  );
  const gemJoin = new ethers.Contract(ADDR.ethAJoin, ["function join(address,uint256)", "function ilk() view returns (bytes32)"], signer);
  const usdsJoin = new ethers.Contract(ADDR.usdsJoin, ["function exit(address,uint256)", "function usds() view returns (address)"], signer);
  const ilk = await gemJoin.ilk();
  if (ethers.decodeBytes32String(ilk) !== "ETH-A") throw new Error("MCD_JOIN_ETH_A ilk mismatch");
  if ((await usdsJoin.usds()).toLowerCase() !== ADDR.usds.toLowerCase()) throw new Error("USDS_JOIN.usds() mismatch");
  const { rate } = await vat.ilks(ilk);
  const wad = ethers.parseEther("8000"); // above the 7,500 dust floor
  const art = (wad * RAY + rate - 1n) / rate;

  const usdsBefore = await usds.balanceOf(user);
  await (await weth.deposit({ value: ink })).wait();
  await (await weth.approve(ADDR.ethAJoin, ink)).wait();
  await (await gemJoin.join(user, ink)).wait();
  await (await vat.frob(ilk, user, user, user, ink, art)).wait();
  await (await vat.hope(ADDR.usdsJoin)).wait();
  const receipt = await (await usdsJoin.exit(user, wad)).wait();
  const urn = await vat.urns(ilk, user);
  const usdsAfter = await usds.balanceOf(user);
  const delta = usdsAfter - usdsBefore;
  const ok = delta === wad && urn.ink === ink && urn.art === art;
  return {
    ok,
    block,
    key: `usds+=${formatUnits(delta, 18)} ink=${formatUnits(urn.ink, 18)} art=${formatUnits(urn.art, 18)}`,
    detail: `Sky ETH-A vault opened by ${user}: join ${formatUnits(ink, 18)} WETH, frob art ${formatUnits(art, 18)} (rate ${formatUnits(rate, 27)}), USDS_JOIN.exit ${formatUnits(wad, 18)} USDS\nUSDS ${formatUnits(usdsBefore, 18)} -> ${formatUnits(usdsAfter, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "vault urn or USDS balance did not match the drawn amount",
  };
}

async function xdaiRelay(provider, block) {
  const chain = "ethereum";
  const amount = 1000n * 10n ** 6n;
  const signer = await impersonateFunded(chain, "USDC", ADDR.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(ADDR.usdc, ERC, signer);
  const iface = new ethers.Interface([
    "function relayTokens(address token, address _receiver, uint256 _value)",
    "function isTokenRegistered(address) view returns (bool)",
    "function mediatorBalance(address) view returns (uint256)",
    "event TokensBridgingInitiated(address indexed token, address indexed sender, uint256 value, bytes32 indexed messageId)",
  ]);
  const bridge = new ethers.Contract(ADDR.omnibridge, iface, signer);
  if (!(await bridge.isTokenRegistered(ADDR.usdc))) throw new Error("USDC not registered on OmniBridge");
  const before = await usdc.balanceOf(ADDR.omnibridge);
  const mbBefore = await bridge.mediatorBalance(ADDR.usdc);
  await (await usdc.approve(ADDR.omnibridge, amount)).wait();
  const receipt = await (await bridge.relayTokens(ADDR.usdc, user, amount)).wait();
  const after = await usdc.balanceOf(ADDR.omnibridge);
  const mbAfter = await bridge.mediatorBalance(ADDR.usdc);
  const ev = receipt.logs
    .filter(l => l.address.toLowerCase() === ADDR.omnibridge.toLowerCase())
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e && e.name === "TokensBridgingInitiated");
  const eventOk = !!ev && ev.args.value === amount && ev.args.sender.toLowerCase() === user.toLowerCase();
  const ok = after - before === amount && mbAfter - mbBefore === amount && eventOk;
  return {
    ok,
    block,
    key: `omniUsdc+=${formatUnits(after - before, 6)} mediatorBalance+=${formatUnits(mbAfter - mbBefore, 6)} event=${eventOk}`,
    detail: `OmniBridge relayTokens(USDC, ${user}, ${formatUnits(amount, 6)})\nbridge USDC ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\nmessageId ${ev ? ev.args.messageId : "-"}\nGnosis side is not simulated; this asserts the Ethereum lock only.\ntx ${receipt.hash}`,
    error: ok ? null : "OmniBridge did not lock USDC and emit TokensBridgingInitiated",
  };
}


// DeFi Saver v3 (Ethereum). Addresses from defisaver-v3-contracts:
// contracts/core/helpers/MainnetCoreAddresses.sol (REGISTRY_ADDR) and
// contracts/utils/addresses/dsProxyFactory/MainnetProxyFactoryAddresses.sol (PROXY_FACTORY_ADDR).
// Action ids from https://docs.defisaver.com (AaveV3Supply 0xfc33bf00, AaveV3Borrow 0x9e9290b1);
// RecipeExecutor and action contracts are resolved through DFSRegistry.getAddr(bytes4(keccak256(name))).
const DFS = {
  registry: "0x287778F121F134C66212FB16c9b53eC991D32f5b",
  proxyFactory: "0xA26e15C895EFc0616177B7c1e7270A4C7D51C997",
};

async function defisaverRecipe(provider, block) {
  const chain = "ethereum";
  const { CHAINS } = require("../../config/chains");
  const poolAddr = CHAINS.ethereum.aave.v3.pool;
  const id = n => ethers.dataSlice(ethers.id(n), 0, 4);
  const registry = new ethers.Contract(DFS.registry, ["function getAddr(bytes4) view returns (address)"], provider);
  const executor = await registry.getAddr(id("RecipeExecutor"));
  for (const n of ["AaveV3Supply", "AaveV3Borrow"]) {
    const a = await registry.getAddr(id(n));
    if (a === ethers.ZeroAddress || (await provider.getCode(a)) === "0x") throw new Error(`${n} not registered`);
  }
  const user = ethers.Wallet.createRandom().address;
  const signer = await impersonateAccount(user, chain);
  const supply = ethers.parseEther("5");
  const borrow = 1000n * 10n ** 6n;
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(supply + ethers.parseEther("1"))]);

  const factory = new ethers.Contract(DFS.proxyFactory, ["function build(address) returns (address)"], signer);
  const proxyAddr = await factory.build.staticCall(user);
  await (await factory.build(user)).wait();
  const proxy = new ethers.Contract(proxyAddr, ["function execute(address,bytes) payable returns (bytes)", "function owner() view returns (address)"], signer);
  if ((await proxy.owner()).toLowerCase() !== user.toLowerCase()) throw new Error("DSProxy owner mismatch");

  const weth = new ethers.Contract(ADDR.weth, ERC, signer);
  await (await weth.deposit({ value: supply })).wait();
  await (await weth.approve(proxyAddr, supply)).wait();

  const pool = new ethers.Contract(poolAddr, [
    "function getReserveData(address) view returns (tuple(uint256 configuration,uint128 liquidityIndex,uint128 currentLiquidityRate,uint128 variableBorrowIndex,uint128 currentVariableBorrowRate,uint128 currentStableBorrowRate,uint40 lastUpdateTimestamp,uint16 id,address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint128 accruedToTreasury,uint128 unbacked,uint128 isolationModeTotalDebt))",
    "function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  ], provider);
  const wethRes = await pool.getReserveData(ADDR.weth);
  const usdcRes = await pool.getReserveData(ADDR.usdc);
  const marketProvider = await new ethers.Contract(poolAddr, ["function ADDRESSES_PROVIDER() view returns (address)"], provider).ADDRESSES_PROVIDER();

  const coder = ethers.AbiCoder.defaultAbiCoder();
  const supplyData = coder.encode(
    ["tuple(uint256,address,uint16,bool,bool,bool,address,address)"],
    [[supply, user, wethRes.id, true, false, false, marketProvider, ethers.ZeroAddress]]
  );
  const borrowData = coder.encode(
    ["tuple(uint256,address,uint8,uint16,bool,bool,address,address)"],
    [[borrow, user, 2, usdcRes.id, false, false, marketProvider, ethers.ZeroAddress]]
  );
  const recipe = [
    "AaveV3SupplyBorrow",
    [supplyData, borrowData],
    [],
    [id("AaveV3Supply"), id("AaveV3Borrow")],
    [Array(8).fill(0), Array(8).fill(0)],
  ];
  const execIface = new ethers.Interface([
    "function executeRecipe(tuple(string name,bytes[] callData,bytes32[] subData,bytes4[] actionIds,uint8[][] paramMapping))",
  ]);
  const usdc = new ethers.Contract(ADDR.usdc, ERC, provider);
  const aWeth = new ethers.Contract(wethRes.aTokenAddress, ERC, provider);
  const vDebt = new ethers.Contract(usdcRes.variableDebtTokenAddress, ERC, provider);
  const before = { usdc: await usdc.balanceOf(user), aweth: await aWeth.balanceOf(proxyAddr), debt: await vDebt.balanceOf(proxyAddr) };
  const receipt = await (await proxy.execute(executor, execIface.encodeFunctionData("executeRecipe", [recipe]), { gasLimit: 3_000_000 })).wait();
  const after = { usdc: await usdc.balanceOf(user), aweth: await aWeth.balanceOf(proxyAddr), debt: await vDebt.balanceOf(proxyAddr) };
  const acct = await pool.getUserAccountData(proxyAddr);
  const dUsdc = after.usdc - before.usdc;
  const dA = after.aweth - before.aweth;
  const dD = after.debt - before.debt;
  const ok = dUsdc === borrow && dA + 2n >= supply && dD >= borrow;
  return {
    ok,
    block,
    key: `userUsdc+=${formatUnits(dUsdc, 6)} proxyAWeth+=${formatUnits(dA, 18)} proxyVarDebtUsdc+=${formatUnits(dD, 6)} hf=${formatUnits(acct[5], 18)}`,
    detail: `DSProxy ${proxyAddr} (owner ${user}) -> RecipeExecutor ${executor}.executeRecipe([AaveV3Supply 0xfc33bf00, AaveV3Borrow 0x9e9290b1])\nsupply ${formatUnits(supply, 18)} WETH (reserve id ${wethRes.id}), borrow ${formatUnits(borrow, 6)} USDC variable (reserve id ${usdcRes.id}) on market ${marketProvider}\ntx ${receipt.hash}`,
    error: ok ? null : "recipe did not supply WETH and borrow USDC as encoded",
  };
}

const ACTIONS = { "defisaver:recipe": defisaverRecipe, "sky:vault": skyVault, "xdai-stake-bridge:relay": xdaiRelay };

async function run() {
  const chain = "ethereum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const fn = ACTIONS[`${protocol}:${action}`];
  const base = { protocol, action, chain };
  if (!fn) return finish({ ...base, ok: false, block: null, error: `unknown action ${protocol}:${action}` });
  try {
    await requireFork(chain);
    const provider = getProvider(chain);
    const block = await provider.getBlockNumber();
    finish({ ...base, ...(await fn(provider, block)) });
  } catch (err) {
    finish({ ...base, ok: false, block: null, error: err.shortMessage || err.message });
  }
}

if (require.main === module) run();
module.exports = { run };
