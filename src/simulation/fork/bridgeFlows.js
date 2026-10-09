/**
 * Source-chain bridge deposits on an Ethereum fork.
 * Destination delivery needs relayers or off-chain messaging and is not checked here.
 * Addresses: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { BRIDGES } = require("../../catalog/contracts");
const { impersonateAccount } = require("../../utils/impersonate");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const DEST_NOTE =
  "Destination delivery needs relayers or off-chain messaging. This fork only checks the source chain.";

const SEND_PARAM =
  "tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd)";

function topicOf(sig) {
  return ethers.id(sig);
}

function logged(receipt, address, sig) {
  const topic = topicOf(sig);
  return receipt.logs.some(
    log => log.address.toLowerCase() === address.toLowerCase() && log.topics[0] === topic
  );
}

async function run() {
  const chain = "ethereum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  try {
    if (protocol === "arbitrum") return await arbitrumDeposit(base);
    if (protocol === "base") return await opDeposit(base, "Base", BRIDGES.baseL1Bridge, BRIDGES.basePortal);
    if (protocol === "optimism") return await opDeposit(base, "Optimism", BRIDGES.optimismL1Bridge, BRIDGES.optimismPortal);
    if (protocol === "across") return await acrossDeposit(base);
    if (protocol === "stargate" && action === "quote") return await stargateQuote(base);
    if (protocol === "stargate" && action === "deposit") return await stargateDeposit(base);
    return finish({ ...base, ok: false, error: `Unknown bridge action ${protocol}:${action}` });
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

async function arbitrumDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const inbox = new ethers.Contract(BRIDGES.arbitrumInbox, ["function depositEth() payable returns (uint256)", "function bridge() view returns (address)"], signer);
  const bridgeAddr = BRIDGES.arbitrumBridge;
  const before = await provider.getBalance(bridgeAddr);
  const tx = await inbox.depositEth({ value });
  const receipt = await tx.wait();
  const after = await provider.getBalance(bridgeAddr);
  const event = logged(receipt, BRIDGES.arbitrumInbox, "InboxMessageDelivered(uint256,bytes)");
  const ok = after === before + value && event;
  const message = receipt.logs.find(log => log.topics[0] === topicOf("InboxMessageDelivered(uint256,bytes)"));
  const nonce = message ? BigInt(message.topics[1]).toString() : "-";
  return finish({
    ...base,
    ok,
    key: `bridgeEth=${formatUnits(before, 18)}->${formatUnits(after, 18)} message=${nonce}`,
    detail: `depositEth ${formatUnits(value, 18)} from ${user}\nbridge ETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nInboxMessageDelivered nonce ${nonce}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : "Arbitrum inbox did not lock ETH and emit InboxMessageDelivered",
  });
}

async function lockedEth(provider, addresses) {
  let total = 0n;
  for (const address of addresses) total += await provider.getBalance(address);
  return total;
}

async function opDeposit(base, name, bridgeAddr, portalAddr) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const bridge = new ethers.Contract(
    bridgeAddr,
    ["function depositETH(uint32 _minGasLimit, bytes _extraData) payable"],
    signer
  );
  // Newer OP Stack portals keep ETH in an ETHLockbox (OP Mainnet does; Base returned none
  // on 2026-10-10). Read it from the portal so the lock check follows the real custody.
  const portal = new ethers.Contract(portalAddr, ["function ethLockbox() view returns (address)"], provider);
  let lockbox = null;
  try {
    lockbox = await portal.ethLockbox();
    if (lockbox === ethers.ZeroAddress) lockbox = null;
  } catch {
    lockbox = null;
  }
  const locks = lockbox ? [bridgeAddr, portalAddr, lockbox] : [bridgeAddr, portalAddr];
  const before = await lockedEth(provider, locks);
  const tx = await bridge.depositETH(200000, "0x", { value });
  const receipt = await tx.wait();
  const after = await lockedEth(provider, locks);
  const event = logged(receipt, bridgeAddr, "ETHDepositInitiated(address,address,uint256,bytes)");
  const ok = after === before + value && event;
  return finish({
    ...base,
    ok,
    key: `lockedEth=${formatUnits(before, 18)}->${formatUnits(after, 18)} event=${event}${lockbox ? " lockbox=yes" : ""}`,
    detail: `${name} L1StandardBridge depositETH ${formatUnits(value, 18)} from ${user}\n${lockbox ? `ETHLockbox ${lockbox}\n` : ""}bridge+portal${lockbox ? "+lockbox" : ""} ETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nETHDepositInitiated ${event}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : `${name} bridge did not lock ETH and emit ETHDepositInitiated`,
  });
}

async function acrossDeposit(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "20", 6);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const signer = await impersonateFunded(base.chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const spoke = new ethers.Contract(
    BRIDGES.acrossSpoke,
    [
      "function getCurrentTime() view returns (uint256)",
      "function depositV3(address depositor,address recipient,address inputToken,address outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,address exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityDeadline,bytes message) payable",
    ],
    signer
  );
  const now = Number(await spoke.getCurrentTime());
  const output = (amount * 99n) / 100n;
  const token = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
  const before = await token.balanceOf(user);
  await (await token.approve(BRIDGES.acrossSpoke, amount)).wait();
  const tx = await spoke.depositV3(
    user,
    user,
    usdc,
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount,
    output,
    8453,
    ethers.ZeroAddress,
    now,
    now + 3600,
    0,
    "0x"
  );
  const receipt = await tx.wait();
  const after = await token.balanceOf(user);
  const fromSpoke = receipt.logs.some(log => log.address.toLowerCase() === BRIDGES.acrossSpoke.toLowerCase());
  const ok = before - after === amount && fromSpoke;
  return finish({
    ...base,
    ok,
    key: `usdc=${formatUnits(before, 6)}->${formatUnits(after, 6)} dest=base`,
    detail: `Across depositV3 ${formatUnits(amount, 6)} USDC toward Base, output floor ${formatUnits(output, 6)}\nUSDC ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\nSpokePool logs ${fromSpoke}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : "Across did not lock the USDC deposit on the source fork",
  });
}

function stargateAbi() {
  return [
    `function quoteOFT(${SEND_PARAM}) view returns (tuple(uint256 minAmountLD, uint256 maxAmountLD) limit, tuple(int256 feeAmountLD, string description)[] details, tuple(uint256 amountSentLD, uint256 amountReceivedLD) receipt)`,
    `function quoteSend(${SEND_PARAM}, bool payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))`,
    `function send(${SEND_PARAM}, tuple(uint256 nativeFee, uint256 lzTokenFee) fee, address refundAddress) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee), tuple(uint256 amountSentLD, uint256 amountReceivedLD))`,
    "function token() view returns (address)",
  ];
}

function sendParam(amount, user, minOut) {
  return {
    dstEid: BRIDGES.stargateArbEid,
    to: ethers.zeroPadValue(user, 32),
    amountLD: amount,
    minAmountLD: minOut,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };
}

async function stargateQuote(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "10", 6);
  const provider = getProvider(base.chain);
  const pool = new ethers.Contract(BRIDGES.stargateUsdcPool, stargateAbi(), provider);
  const user = ethers.Wallet.createRandom().address;
  const quoted = await pool.quoteOFT(sendParam(amount, user, 0));
  const received = quoted.receipt.amountReceivedLD;
  const fee = await pool.quoteSend(sendParam(amount, user, received), false);
  const ok = fee.nativeFee > 0n && received > 0n;
  return finish({
    ...base,
    ok,
    key: `amountReceivedLD=${formatUnits(received, 6)} nativeFee=${formatUnits(fee.nativeFee, 18)}`,
    detail: `quoteOFT/quoteSend ${formatUnits(amount, 6)} USDC to Arbitrum eid ${BRIDGES.stargateArbEid}\namountReceivedLD ${formatUnits(received, 6)}\nnativeFee ${formatUnits(fee.nativeFee, 18)} ETH\n${DEST_NOTE}`,
    error: ok ? null : "Stargate quote was empty",
  });
}

async function stargateDeposit(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "10", 6);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const signer = await impersonateFunded(base.chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const pool = new ethers.Contract(BRIDGES.stargateUsdcPool, stargateAbi(), signer);
  const quoted = await pool.quoteOFT(sendParam(amount, user, 0));
  const received = quoted.receipt.amountReceivedLD;
  const param = sendParam(amount, user, received);
  const fee = await pool.quoteSend(param, false);
  const token = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
  const before = await token.balanceOf(user);
  await (await token.approve(BRIDGES.stargateUsdcPool, amount)).wait();
  const tx = await pool.send(param, { nativeFee: fee.nativeFee, lzTokenFee: fee.lzTokenFee }, user, {
    value: fee.nativeFee,
  });
  const receipt = await tx.wait();
  const after = await token.balanceOf(user);
  const sent = logged(receipt, BRIDGES.stargateUsdcPool, "OFTSent(bytes32,uint32,address,uint256,uint256)");
  const ok = before - after === amount && (sent || receipt.logs.length > 0);
  return finish({
    ...base,
    ok,
    key: `usdc=${formatUnits(before, 6)}->${formatUnits(after, 6)} fee=${formatUnits(fee.nativeFee, 18)} oftSent=${sent}`,
    detail: `Stargate send ${formatUnits(amount, 6)} USDC toward Arbitrum\nUSDC ${formatUnits(before, 6)} -> ${formatUnits(after, 6)}\nnativeFee ${formatUnits(fee.nativeFee, 18)}\nOFTSent ${sent}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : "Stargate did not lock USDC on the source fork",
  });
}

module.exports = { run };
