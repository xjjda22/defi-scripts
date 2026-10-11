/**
 * Shared fork-test helpers: require an Anvil/Hardhat fork, fund a whale, print PASS/FAIL.
 * No PRIVATE_KEY. Impersonation uses src/utils/impersonate.js; dealErc20 tops up if the
 * configured whale is short (anvil_dealERC20 / anvil_deal when present, else it writes the
 * balance slot with anvil_setStorageAt).
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
    USDe: ["0xF977814e90dA44bFA03b6295A0616a897441aceC", "0x28C6c06298d514Db089934071355E5743bf21d60"],
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

const BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];
const MAX_PROBE_SLOT = parseInt(process.env.FORK_DEAL_MAX_SLOT || "100", 10);
// token(lowercase) -> storage key builder that worked, so later deals skip the probe
const dealSlotCache = new Map();

function mappingKey(holder, slot, vyper) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  // Solidity: keccak(abi.encode(key, slot)). Vyper: keccak(abi.encode(slot, key)).
  return vyper
    ? ethers.keccak256(coder.encode(["uint256", "address"], [slot, holder]))
    : ethers.keccak256(coder.encode(["address", "uint256"], [holder, slot]));
}

function word(value) {
  return typeof value === "string" ? ethers.zeroPadValue(value, 32) : ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

function dealVia(token, via) {
  if (process.env.FORK_DEAL_DEBUG === "1") console.log(`dealErc20 ${token}: ${via}`);
  return true;
}

async function setStorage(provider, token, key, value) {
  try {
    await provider.send("anvil_setStorageAt", [token, key, word(value)]);
  } catch {
    await provider.send("hardhat_setStorageAt", [token, key, word(value)]);
  }
}

async function readBalance(contract, account) {
  try {
    return await contract.balanceOf(account);
  } catch {
    return null;
  }
}

/**
 * Write `amount` into one storage key and confirm with balanceOf.
 * Returns true when balanceOf >= amount. Rebasing tokens (stETH stores shares) are
 * handled by scaling: write once, measure what balanceOf reports, then write the
 * proportional value. A key that does not move balanceOf is restored.
 */
async function tryKey(provider, contract, token, account, key, amount, before) {
  const original = await provider.send("eth_getStorageAt", [token, key, "latest"]);
  await setStorage(provider, token, key, amount);
  const got = await readBalance(contract, account);
  if (got === null || got === before) {
    await setStorage(provider, token, key, original).catch(() => {});
    return false;
  }
  if (got >= amount && got - amount <= amount / 1000n) return true;
  if (got > 0n) {
    // Rebasing token: balanceOf is stored value x rate. Write the value that lands on `amount`.
    const scaled = (amount * amount) / got + 2n;
    await setStorage(provider, token, key, scaled);
    const again = await readBalance(contract, account);
    if (again !== null && again >= amount) return true;
    if (got >= amount) {
      await setStorage(provider, token, key, amount);
      return true;
    }
  }
  await setStorage(provider, token, key, original).catch(() => {});
  return false;
}

async function storageKeysRead(provider, token, account) {
  // eth_createAccessList reports every slot balanceOf touched, which finds
  // unstructured layouts (and proxy storage) without brute force.
  try {
    const data = new ethers.Interface(BALANCE_ABI).encodeFunctionData("balanceOf", [account]);
    const res = await provider.send("eth_createAccessList", [{ to: token, data }, "latest"]);
    const entry = (res?.accessList || []).find(e => e.address.toLowerCase() === token.toLowerCase());
    return entry?.storageKeys || [];
  } catch {
    return [];
  }
}

/**
 * Give `account` at least `amount` of `token` on a local fork. Order:
 *   1. anvil_dealERC20 or anvil_deal, when the node has them (anvil 1.3.0 answers anvil_deal
 *      with Method not found; FORK_DEAL_MODE=storage skips this step)
 *   2. the slot that worked last time for this token
 *   3. slots balanceOf reads, from eth_createAccessList (FORK_DEAL_MODE=probe skips this)
 *   4. brute force: balances mapping at slot 0..FORK_DEAL_MAX_SLOT, Solidity and Vyper layouts
 *      (covers proxies such as USDC FiatTokenV2, balances at slot 9, because storage lives at the proxy)
 * Every path is confirmed with balanceOf. Returns true on success, false otherwise.
 */
async function dealErc20(chainKey, token, account, amount) {
  const provider = getProvider(chainKey);
  const contract = new ethers.Contract(token, BALANCE_ABI, provider);
  amount = BigInt(amount);
  const before = await readBalance(contract, account);
  if (before === null) return false;
  if (before >= amount) return true;

  // FORK_DEAL_MODE=storage skips the node's own deal methods; =probe also skips the access
  // list, so only the slot brute force runs. Both exist to exercise the fallbacks.
  const mode = process.env.FORK_DEAL_MODE || "auto";
  const native =
    mode !== "auto"
      ? []
      : [
          ["anvil_dealERC20", [account, token, ethers.toBeHex(amount)]],
          ["anvil_deal", [token, account, ethers.toBeHex(amount)]],
        ];
  for (const [method, params] of native) {
    try {
      await provider.send(method, params);
      const got = await readBalance(contract, account);
      if (got !== null && got >= amount) return dealVia(token, method);
    } catch {
      // method missing on this node, or it could not find the slot
    }
  }

  const cached = dealSlotCache.get(token.toLowerCase());
  if (cached) {
    const key = mappingKey(account, cached.slot, cached.vyper);
    if (await tryKey(provider, contract, token, account, key, amount, before)) return dealVia(token, "cached slot");
  }

  const listed = mode === "probe" ? [] : await storageKeysRead(provider, token, account);
  for (const key of listed) {
    if (await tryKey(provider, contract, token, account, key, amount, before))
      return dealVia(token, `access-list key ${key}`);
  }

  for (let slot = 0; slot <= MAX_PROBE_SLOT; slot++) {
    for (const vyper of [false, true]) {
      const key = mappingKey(account, slot, vyper);
      if (await tryKey(provider, contract, token, account, key, amount, before)) {
        dealSlotCache.set(token.toLowerCase(), { slot, vyper });
        return dealVia(token, `${vyper ? "vyper" : "solidity"} mapping slot ${slot}`);
      }
    }
  }
  return false;
}

async function impersonateFunded(chainKey, symbol, token, minimum) {
  const candidates = [];
  const configured = getWhaleAddress(symbol, chainKey);
  if (configured) candidates.push(configured);
  for (const extra of EXTRA_WHALES[chainKey]?.[symbol] || []) {
    if (!candidates.map(a => a.toLowerCase()).includes(extra.toLowerCase())) candidates.push(extra);
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

  if (!best || bestBal < minimum) {
    // No whale holds enough. Write the balance straight into a brand-new account rather
    // than into the whale: some whales are contracts (wstETH holds stETH, WETH holds WETH),
    // and editing their balances would break their own accounting for later tests.
    const fresh = await impersonateAccount(ethers.Wallet.createRandom().address, chainKey);
    const user = await fresh.getAddress();
    const dealt = await dealErc20(chainKey, token, user, minimum);
    const why = candidates.length
      ? `best ${symbol} whale holds ${bestBal.toString()}`
      : `no ${symbol} whale on ${chainKey}`;
    if (!dealt) throw new Error(`${why}, need ${minimum.toString()}, and dealErc20 could not write a balance`);
    const bal = await getTokenBalance(token, user, chainKey);
    if (bal < minimum) throw new Error(`${symbol} balance still ${bal.toString()} after dealErc20`);
    if (process.env.FORK_DEAL_DEBUG === "1") console.log(`${why}; dealt ${minimum.toString()} to fresh ${user}`);
    return fresh;
  }

  const signer = await impersonateAccount(best, chainKey);
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
