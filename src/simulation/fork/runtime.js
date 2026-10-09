/**
 * Shared fork-test helpers: require an Anvil/Hardhat fork, fund a whale, print PASS/FAIL.
 * No PRIVATE_KEY. Impersonation uses src/utils/impersonate.js; anvil_deal tops up if the
 * configured whale is short.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { getForkContext } = require("../lib/forkSimEnv");
const { impersonateAccount, getWhaleAddress, getTokenBalance } = require("../../utils/impersonate");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const EXTRA_WHALES = {
  ethereum: {
    WETH: ["0xF977814e90dA44bFA03b6295A0616a897441aceC", "0x28C6c06298d514Db089934071355E5743bf21d60"],
    USDC: ["0xF977814e90dA44bFA03b6295A0616a897441aceC", "0x28C6c06298d514Db089934071355E5743bf21d60"],
    USDT: ["0xF977814e90dA44bFA03b6295A0616a897441aceC"],
    stETH: ["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"],
  },
  base: {
    WETH: ["0x46e6b214b524310239732D51387075E0e70970bf", "0x4200000000000000000000000000000000000006"],
    USDC: ["0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A"],
  },
  optimism: {
    WETH: ["0x4200000000000000000000000000000000000006"],
    USDC: ["0xacD03D601e5bB1B275Bb94076fF46ED9D753435A"],
  },
  bsc: {
    WETH: ["0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"],
    USDC: ["0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"],
  },
};

function decimalsOf(symbol) {
  return symbol === "USDC" || symbol === "USDT" ? 6 : 18;
}

function formatUnits(amount, decimals) {
  return ethers.formatUnits(amount, decimals);
}

async function requireFork(chainKey) {
  const ctx = await getForkContext(chainKey);
  if (!ctx.isFork) {
    const err = new Error(`Not a local fork. Start one with: CHAIN=${chainKey} node scripts/startFork.js`);
    err.code = "NOT_FORK";
    throw err;
  }
  return ctx;
}

async function dealErc20(chainKey, token, account, amount) {
  const provider = getProvider(chainKey);
  try {
    await provider.send("anvil_deal", [token, account, ethers.toBeHex(amount)]);
    return true;
  } catch {
    return false;
  }
}

async function impersonateFunded(chainKey, symbol, token, minimum) {
  const candidates = [];
  const configured = getWhaleAddress(symbol, chainKey);
  if (configured) candidates.push(configured);
  for (const extra of EXTRA_WHALES[chainKey]?.[symbol] || []) {
    if (!candidates.map(a => a.toLowerCase()).includes(extra.toLowerCase())) candidates.push(extra);
  }
  if (!candidates.length) {
    const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chainKey);
    const funded = await dealErc20(chainKey, token, await signer.getAddress(), minimum);
    if (!funded) throw new Error(`No ${symbol} whale on ${chainKey} and anvil_deal is unavailable`);
    return signer;
  }

  let best = null;
  let bestBal = 0n;
  for (const address of candidates) {
    const bal = await getTokenBalance(token, address, chainKey);
    if (bal > bestBal) {
      best = address;
      bestBal = bal;
    }
    if (bal >= minimum) break;
  }
  const signer = await impersonateAccount(best, chainKey);
  const user = await signer.getAddress();
  let bal = await getTokenBalance(token, user, chainKey);
  if (bal < minimum) {
    const dealt = await dealErc20(chainKey, token, user, minimum);
    if (!dealt) throw new Error(`${symbol} whale ${user} has ${bal.toString()} and anvil_deal failed`);
    bal = await getTokenBalance(token, user, chainKey);
    if (bal < minimum) throw new Error(`${symbol} balance still ${bal.toString()} after anvil_deal`);
  }
  if (process.env.FORK_SHARED_WHALE === "1") return signer;
  return freshFrom(chainKey, signer, token, minimum);
}

/**
 * Move the test amount from the whale to a brand-new impersonated account.
 * The suite runs every test on one Anvil fork, so a shared whale would carry positions
 * from earlier tests (an Aave borrow, a Spark supply) into later ones. A fresh account
 * starts with no positions. A little extra covers stETH-style 1-2 wei transfer rounding.
 * FORK_SHARED_WHALE=1 keeps the old behaviour.
 */
async function freshFrom(chainKey, whale, token, minimum) {
  const fresh = await impersonateAccount(ethers.Wallet.createRandom().address, chainKey);
  const to = await fresh.getAddress();
  const extra = minimum / 1000n + 2n;
  const total = minimum + extra;
  const whaleBal = await getTokenBalance(token, await whale.getAddress(), chainKey);
  const send = whaleBal >= total ? total : minimum;
  // No return value declared, so USDT (no bool return) works too.
  const erc = new ethers.Contract(token, ["function transfer(address,uint256)"], whale);
  await (await erc.transfer(to, send)).wait();
  const got = await getTokenBalance(token, to, chainKey);
  if (got + 2n < minimum) throw new Error(`fresh account got ${got.toString()} of ${minimum.toString()}`);
  return fresh;
}

function erc20(address, runner) {
  return new ethers.Contract(address, ERC20_ABI, runner);
}

function unavailable(message) {
  return /paused|cap|maximum|disabled|not supported|deposit pool|full|limit|onlysupported|unsupported|min amount|minimum/i.test(
    String(message || "")
  );
}

/**
 * Print one machine-readable line and exit.
 * SKIP and PASS exit 0. FAIL exits 1.
 */
function finish(result) {
  const status = result.skipped ? "SKIP" : result.ok ? "PASS" : "FAIL";
  const block = result.block == null ? "-" : String(result.block);
  const key = result.key ? ` ${result.key}` : "";
  const line = `FORK_RESULT status=${status} protocol=${result.protocol} action=${result.action} chain=${result.chain} block=${block}${key}`;
  console.log(`\n${line}`);
  if (result.detail) console.log(result.detail);
  if (result.error && status !== "PASS") console.error(result.error);
  process.exit(status === "FAIL" ? 1 : 0);
}

module.exports = {
  ERC20_ABI,
  decimalsOf,
  formatUnits,
  requireFork,
  dealErc20,
  impersonateFunded,
  erc20,
  unavailable,
  finish,
};
