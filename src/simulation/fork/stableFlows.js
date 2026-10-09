/**
 * Stablecoin and RWA fork checks on Ethereum.
 * Addresses and doc links: src/catalog/contracts.js.
 * Mint paths that are whitelisted or KYC-gated are not attempted.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { SKY, ETHENA, FRAX, RWA } = require("../../catalog/contracts");
const { impersonateAccount } = require("../../utils/impersonate");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
];
const ERC_NO_RETURN = ["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256)"];
const VAULT = [
  ...ERC,
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function asset() view returns (address)",
];

async function forkOrFail(chain, protocol, action) {
  try {
    return { ctx: await requireFork(chain) };
  } catch (err) {
    finish({ ok: false, protocol, action, chain, block: null, error: err.message });
    return null;
  }
}

async function approve(token, signer, spender, amount) {
  const erc = new ethers.Contract(token, ERC, signer);
  await (await erc.approve(spender, amount)).wait();
}

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  const reason = err.reason || (err.revert && err.revert.args && err.revert.args.join(" "));
  return `${reason || err.shortMessage || err.message} ${data}`.trim();
}

async function run() {
  const chain = "ethereum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const ready = await forkOrFail(chain, protocol, action);
  if (!ready) return;
  const base = { protocol, action, chain, block: ready.ctx.forkBlock };
  try {
    if (protocol === "sky" && action === "convert") return await skyConvert(base);
    if (protocol === "sky" && action === "susds") return await skyVault(base, "sUSDS", SKY.susds, SKY.usds, "USDS");
    if (protocol === "sky" && action === "sdai") return await skyVault(base, "sDAI", SKY.sdai, SKY.dai, "DAI");
    if (protocol === "ethena" && action === "stake") return await ethenaStake(base);
    if (protocol === "ethena" && action === "cooldown") return await ethenaCooldown(base);
    if (protocol === "circle") return await transferOnly(base, "USDC", COMMON_TOKENS.USDC.ethereum, 6, true);
    if (protocol === "tether") return await transferOnly(base, "USDT", COMMON_TOKENS.USDT.ethereum, 6, false);
    if (protocol === "frax") return await fraxRate(base);
    if (protocol === "buidl") return await buidlRead(base);
    if (protocol === "ondo") return await ondoRates(base);
    if (protocol === "superstate") return await ustbNav(base);
    return finish({ ...base, ok: false, error: `Unknown stable action ${protocol}:${action}` });
  } catch (err) {
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

async function skyConvert(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer = await impersonateFunded(base.chain, "DAI", SKY.dai, amount);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const dai = new ethers.Contract(SKY.dai, ERC, provider);
  const usds = new ethers.Contract(SKY.usds, ERC, provider);
  const conv = new ethers.Contract(
    SKY.converter,
    ["function daiToUsds(address,uint256)", "function usdsToDai(address,uint256)"],
    signer
  );
  const daiBefore = await dai.balanceOf(user);
  const usdsBefore = await usds.balanceOf(user);
  await approve(SKY.dai, signer, SKY.converter, amount);
  const toUsds = await conv.daiToUsds(user, amount);
  await toUsds.wait();
  const usdsMid = await usds.balanceOf(user);
  await approve(SKY.usds, signer, SKY.converter, amount);
  const toDai = await conv.usdsToDai(user, amount);
  const receipt = await toDai.wait();
  const daiAfter = await dai.balanceOf(user);
  const usdsAfter = await usds.balanceOf(user);
  const minted = usdsMid - usdsBefore;
  const ok = minted === amount && usdsAfter === usdsBefore && daiAfter + 1n >= daiBefore;
  return finish({
    ...base,
    ok,
    key: `usdsMinted=${formatUnits(minted, 18)} daiBack=${formatUnits(daiAfter, 18)}`,
    detail: `DAI ${formatUnits(daiBefore, 18)} -> ${formatUnits(daiAfter, 18)}\nUSDS minted ${formatUnits(minted, 18)} then converted back\ntx ${receipt.hash}`,
    error: ok ? null : "DAI/USDS round trip was not 1:1",
  });
}

async function skyVault(base, label, vaultAddr, assetAddr, symbol) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer =
    symbol === "DAI"
      ? await impersonateFunded(base.chain, "DAI", assetAddr, amount)
      : await impersonateFunded(base.chain, "DAI", SKY.dai, amount);
  const user = await signer.getAddress();
  if (symbol === "USDS") {
    await approve(SKY.dai, signer, SKY.converter, amount);
    const conv = new ethers.Contract(SKY.converter, ["function daiToUsds(address,uint256)"], signer);
    await (await conv.daiToUsds(user, amount)).wait();
  }
  const provider = getProvider(base.chain);
  const asset = new ethers.Contract(assetAddr, ERC, provider);
  const vault = new ethers.Contract(vaultAddr, VAULT, signer);
  const sharesBefore = await vault.balanceOf(user);
  const assetsBefore = await asset.balanceOf(user);
  await approve(assetAddr, signer, vaultAddr, amount);
  // sDAI's deposit/redeem call pot.drip(); eth_estimateGas on a fork undershoots it and the
  // transaction runs out of gas, so give both calls an explicit limit.
  await (await vault.deposit(amount, user, { gasLimit: 1_000_000n })).wait();
  const shares = (await vault.balanceOf(user)) - sharesBefore;
  const redeemed = await vault.redeem(shares, user, user, { gasLimit: 1_000_000n });
  const receipt = await redeemed.wait();
  const assetsAfter = await asset.balanceOf(user);
  const ok = shares > 0n && assetsAfter + amount / 100n >= assetsBefore;
  return finish({
    ...base,
    ok,
    key: `${label}Shares=${formatUnits(shares, 18)} ${symbol}=${formatUnits(assetsBefore, 18)}->${formatUnits(assetsAfter, 18)}`,
    detail: `deposited ${formatUnits(amount, 18)} ${symbol} into ${label}\nshares ${formatUnits(shares, 18)}\n${symbol} ${formatUnits(assetsBefore, 18)} -> ${formatUnits(assetsAfter, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : `${label} deposit/redeem did not return assets`,
  });
}

async function ethenaStake(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer = await impersonateFunded(base.chain, "USDe", ETHENA.usde, amount);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const vault = new ethers.Contract(ETHENA.susde, VAULT, signer);
  const before = await vault.balanceOf(user);
  await approve(ETHENA.usde, signer, ETHENA.susde, amount);
  const tx = await vault.deposit(amount, user);
  const receipt = await tx.wait();
  const after = await vault.balanceOf(user);
  const one = ethers.parseEther("1");
  const rate = await new ethers.Contract(ETHENA.susde, VAULT, provider).convertToAssets(one);
  const ok = after > before;
  return finish({
    ...base,
    ok,
    key: `sUSDe=${formatUnits(before, 18)}->${formatUnits(after, 18)} rate=${formatUnits(rate, 18)}`,
    detail: `staked ${formatUnits(amount, 18)} USDe\nsUSDe ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nconvertToAssets(1) ${formatUnits(rate, 18)} USDe\nUSDe mint is whitelisted and was not called\ntx ${receipt.hash}`,
    error: ok ? null : "sUSDe balance did not increase",
  });
}

async function ethenaCooldown(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer = await impersonateFunded(base.chain, "USDe", ETHENA.usde, amount);
  const user = await signer.getAddress();
  const susde = new ethers.Contract(
    ETHENA.susde,
    [
      ...VAULT,
      "function cooldownShares(uint256 shares) returns (uint256)",
      "function cooldownDuration() view returns (uint24)",
      "function cooldowns(address) view returns (uint104 cooldownEnd, uint152 underlyingAmount)",
    ],
    signer
  );
  await approve(ETHENA.usde, signer, ETHENA.susde, amount);
  const sharesBefore = await susde.balanceOf(user);
  await (await susde.deposit(amount, user)).wait();
  // Cool down the shares this test minted. cooldownAssets(amount) reverts with
  // ExcessiveWithdrawAmount because the shares round down to just under `amount` USDe.
  const shares = (await susde.balanceOf(user)) - sharesBefore;
  const duration = await susde.cooldownDuration();
  const tx = await susde.cooldownShares(shares);
  const receipt = await tx.wait();
  const cd = await susde.cooldowns(user);
  const ok = cd.underlyingAmount > 0n && (duration === 0n || cd.cooldownEnd > 0n);
  return finish({
    ...base,
    ok,
    key: `cooldownEnd=${cd.cooldownEnd} underlying=${formatUnits(cd.underlyingAmount, 18)} duration=${duration}`,
    detail: `cooldown started for ${formatUnits(shares, 18)} sUSDe (from ${formatUnits(amount, 18)} USDe)\ncooldownEnd ${cd.cooldownEnd} underlying ${formatUnits(cd.underlyingAmount, 18)}\nduration ${duration}s. Full unstake waits out that cooldown; a single fork does not advance it.\ntx ${receipt.hash}`,
    error: ok ? null : "cooldown did not record an unstake",
  });
}

async function transferOnly(base, symbol, token, decimals, returnsBool) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", decimals);
  const signer = await impersonateFunded(base.chain, symbol, token, amount);
  const from = await signer.getAddress();
  const sinkSigner = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const to = await sinkSigner.getAddress();
  const provider = getProvider(base.chain);
  const read = new ethers.Contract(token, ERC, provider);
  const writer = new ethers.Contract(token, returnsBool ? ERC : ERC_NO_RETURN, signer);
  const supply = await read.totalSupply();
  const beforeFrom = await read.balanceOf(from);
  const beforeTo = await read.balanceOf(to);
  const tx = await writer.transfer(to, amount);
  const receipt = await tx.wait();
  const afterFrom = await read.balanceOf(from);
  const afterTo = await read.balanceOf(to);
  const ok = afterFrom === beforeFrom - amount && afterTo === beforeTo + amount && supply > 0n;
  return finish({
    ...base,
    ok,
    key: `${symbol}=${formatUnits(beforeFrom, decimals)}->${formatUnits(afterFrom, decimals)} supply=${formatUnits(supply, decimals)}`,
    detail: `transfer ${formatUnits(amount, decimals)} ${symbol}\nsender ${formatUnits(beforeFrom, decimals)} -> ${formatUnits(afterFrom, decimals)}\nreceiver ${formatUnits(beforeTo, decimals)} -> ${formatUnits(afterTo, decimals)}\ntotalSupply ${formatUnits(supply, decimals)}\nMint and redeem are off-chain or KYC'd and were not called.\ntx ${receipt.hash}`,
    error: ok ? null : `${symbol} transfer did not move the full amount`,
  });
}

async function fraxRate(base) {
  const provider = getProvider(base.chain);
  const vault = new ethers.Contract(FRAX.sfrxusd, VAULT, provider);
  const one = ethers.parseEther("1");
  const assets = await vault.convertToAssets(one);
  const cap = await vault.maxDeposit(ethers.ZeroAddress);
  const ok = assets > one;
  return finish({
    ...base,
    ok,
    key: `sfrxUSDRate=${formatUnits(assets, 18)} maxDeposit=${cap.toString()}`,
    detail: `1 sfrxUSD converts to ${formatUnits(assets, 18)} frxUSD\nmaxDeposit ${cap.toString()} (0 means the Ethereum vault is not taking a local deposit)`,
    error: ok ? null : "sfrxUSD convertToAssets was not above 1",
  });
}

async function buidlRead(base) {
  const provider = getProvider(base.chain);
  const token = new ethers.Contract(RWA.buidl, ["function totalSupply() view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"], provider);
  const [supply, decimals, symbol] = await Promise.all([token.totalSupply(), token.decimals(), token.symbol()]);
  const ok = symbol === "BUIDL" && Number(decimals) === 6 && supply > 0n;
  return finish({
    ...base,
    ok,
    key: `BUIDL supply=${formatUnits(supply, 6)}`,
    detail: `KYC-gated: read-only. BUIDL rebases around $1. totalSupply ${formatUnits(supply, Number(decimals))} ${symbol}. Mint was not called.`,
    error: ok ? null : "BUIDL supply read was empty",
  });
}

async function ondoRates(base) {
  const provider = getProvider(base.chain);
  const usdyOracle = new ethers.Contract(RWA.usdyOracle, ["function getPrice() view returns (uint256)"], provider);
  const ondoOracle = new ethers.Contract(RWA.ondoOracle, ["function getAssetPrice(address) view returns (uint256)"], provider);
  const usdy = await usdyOracle.getPrice();
  const ousg = await ondoOracle.getAssetPrice(RWA.ousg);
  const ok = usdy > ethers.parseEther("1") && ousg > 0n;
  return finish({
    ...base,
    ok,
    key: `USDY=${formatUnits(usdy, 18)} OUSG=${formatUnits(ousg, 18)}`,
    detail: `KYC-gated: read-only.\nUSDY oracle price ${formatUnits(usdy, 18)}\nOUSG oracle price ${formatUnits(ousg, 18)}\nMint was not called.`,
    error: ok ? null : "Ondo NAV read was zero",
  });
}

async function ustbNav(base) {
  const provider = getProvider(base.chain);
  const oracle = new ethers.Contract(
    RWA.ustbOracle,
    ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)", "function decimals() view returns (uint8)"],
    provider
  );
  const round = await oracle.latestRoundData();
  const decimals = Number(await oracle.decimals());
  const answer = round[1];
  const ok = answer > 0n;
  return finish({
    ...base,
    ok,
    key: `USTBnav=${formatUnits(answer, decimals)}`,
    detail: `KYC-gated: read-only. USTB continuous oracle answer ${formatUnits(answer, decimals)} (round ${round[0]}). Mint was not called.`,
    error: ok ? null : "USTB oracle answer was not positive",
  });
}

module.exports = { run };
