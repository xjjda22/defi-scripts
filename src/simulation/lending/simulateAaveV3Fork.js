require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { CHAINS, COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { impersonateWhale, getTokenBalance } = require("../../utils/impersonate");
const { getForkContext, printForkContext, exitUnlessFork } = require("../lib/forkSimEnv");
const AaveV3PoolABI = require("../../abis/aave/AaveV3Pool.json");

const CHAIN = process.env.CHAIN || "ethereum";
const SIMULATE_ONLY = process.env.SIMULATE_ONLY === "true";
const ASSET = process.env.AAVE_SIM_ASSET || "USDC";
const SUPPLY_UNITS = process.env.AAVE_SIM_SUPPLY_UNITS || "1000";

const POOL_SUPPLY_WITHDRAW_ABI = [
  ...AaveV3PoolABI,
  "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)",
  "function withdraw(address asset,uint256 amount,address to) returns (uint256)",
];

async function main() {
  const ctx = await getForkContext(CHAIN);
  printForkContext(CHAIN, ctx, { simulateOnly: SIMULATE_ONLY });

  const chain = CHAINS[CHAIN];
  const poolAddr = chain?.aave?.v3?.pool;
  const assetAddr = COMMON_TOKENS[ASSET]?.[CHAIN];
  if (!poolAddr || !assetAddr) {
    console.error(chalk.red(`Missing Aave V3 pool or ${ASSET} on ${CHAIN}`));
    process.exit(1);
  }

  const provider = getProvider(CHAIN);
  const poolRO = new ethers.Contract(poolAddr, AaveV3PoolABI, provider);
  const rd = await poolRO.getReserveData(assetAddr);
  console.log(chalk.cyan("\nReserve (read-only)"));
  console.log(`  aToken: ${rd.aTokenAddress}`);
  console.log(`  liquidityIndex: ${rd.liquidityIndex}`);

  const zeroUser = ethers.ZeroAddress;
  const uad = await poolRO.getUserAccountData(zeroUser);
  console.log(chalk.cyan("\ngetUserAccountData(zero) — expect zeros"));
  console.log(`  totalCollateralBase: ${uad.totalCollateralBase}`);

  if (SIMULATE_ONLY) {
    console.log(chalk.yellow("\nSIMULATE_ONLY=true — skipping supply/withdraw\n"));
    return;
  }

  exitUnlessFork(ctx.isFork);

  const signer = await impersonateWhale(ASSET, CHAIN);
  const user = await signer.getAddress();
  const decimals = ASSET === "USDC" || ASSET === "USDT" ? 6 : 18;
  const amountIn = ethers.parseUnits(SUPPLY_UNITS, decimals);

  const bal = await getTokenBalance(assetAddr, user, CHAIN);
  if (bal < amountIn) {
    console.error(chalk.red(`Whale ${ASSET} balance too low for ${SUPPLY_UNITS}`));
    process.exit(1);
  }

  const pool = new ethers.Contract(poolAddr, POOL_SUPPLY_WITHDRAW_ABI, signer);
  const token = new ethers.Contract(assetAddr, ["function approve(address,uint256) returns (bool)"], signer);

  console.log(chalk.cyan("\nSupply → withdraw on fork"));
  let tx = await token.approve(poolAddr, amountIn);
  await tx.wait();
  tx = await pool.supply(assetAddr, amountIn, user, 0);
  const sup = await tx.wait();
  console.log(chalk.green(`  supply tx: ${sup.hash}`));

  const aTok = new ethers.Contract(rd.aTokenAddress, ["function balanceOf(address) view returns (uint256)"], provider);
  const aBal = await aTok.balanceOf(user);
  tx = await pool.withdraw(assetAddr, aBal, user);
  const wdr = await tx.wait();
  console.log(chalk.green(`  withdraw tx: ${wdr.hash}`));
  console.log(chalk.gray("\nDone (fork only).\n"));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
