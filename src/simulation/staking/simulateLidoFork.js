require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { impersonateWhale } = require("../../utils/impersonate");
const { getForkContext, printForkContext, exitUnlessFork } = require("../lib/forkSimEnv");

const CHAIN = process.env.CHAIN || "ethereum";
const SIMULATE_ONLY = process.env.SIMULATE_ONLY === "true";
const SUBMIT_WEI = process.env.LIDO_SUBMIT_WEI || "10000000000000000";

const STETH_ABI = [
  "function submit(address referral) payable",
  "function balanceOf(address) view returns (uint256)",
  "function getTotalPooledEther() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];
const WSTETH_ABI = ["function wrap(uint256) returns (uint256)"];

async function main() {
  if (CHAIN !== "ethereum") {
    console.error(chalk.red("Lido submit simulation is scoped to ethereum mainnet fork."));
    process.exit(1);
  }

  const ctx = await getForkContext(CHAIN);
  printForkContext(CHAIN, ctx, { simulateOnly: SIMULATE_ONLY });

  const stAddr = COMMON_TOKENS.stETH?.[CHAIN];
  const wstAddr = COMMON_TOKENS.wstETH?.[CHAIN];
  if (!stAddr) {
    console.error(chalk.red("stETH address not configured"));
    process.exit(1);
  }

  const provider = getProvider(CHAIN);
  const steth = new ethers.Contract(stAddr, STETH_ABI, provider);
  const [pooled, supply] = await Promise.all([steth.getTotalPooledEther(), steth.totalSupply()]);
  console.log(chalk.cyan("\nRead-only (stETH)"));
  console.log(`  totalPooledEther: ${ethers.formatEther(pooled)} ETH`);
  console.log(`  totalSupply: ${ethers.formatEther(supply)} stETH shares`);

  if (SIMULATE_ONLY) {
    console.log(chalk.yellow("\nSIMULATE_ONLY=true — skipping submit\n"));
    return;
  }

  exitUnlessFork(ctx.isFork);

  const signer = await impersonateWhale("WETH", CHAIN);
  const user = await signer.getAddress();
  const stSigned = new ethers.Contract(stAddr, STETH_ABI, signer);
  const value = BigInt(SUBMIT_WEI);

  console.log(chalk.cyan(`\nSubmitting ${ethers.formatEther(value)} ETH to Lido (fork)`));
  const tx = await stSigned.submit(ethers.ZeroAddress, { value });
  const rec = await tx.wait();
  console.log(chalk.green(`  submit tx: ${rec.hash}`));

  const bal = await stSigned.balanceOf(user);
  console.log(`  stETH balance: ${ethers.formatEther(bal)}`);

  if (wstAddr && bal > 0n) {
    const wrapAmt = bal / 2n > 0n ? bal / 2n : bal;
    const wst = new ethers.Contract(wstAddr, WSTETH_ABI, signer);
    const a = new ethers.Contract(stAddr, ["function approve(address,uint256) returns (bool)"], signer);
    let ap = await a.approve(wstAddr, wrapAmt);
    await ap.wait();
    const wtx = await wst.wrap(wrapAmt);
    const wr = await wtx.wait();
    console.log(chalk.green(`  wrap tx: ${wr.hash}`));
  }

  console.log(chalk.gray("\nDone (fork only).\n"));
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
