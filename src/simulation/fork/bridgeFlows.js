/**
 * Source-chain bridge deposits on an Ethereum fork.
 * Destination delivery needs relayers or off-chain messaging and is not checked here.
 * Addresses: src/catalog/contracts.js.
 */

const { ethers } = require("ethers");
const { COMMON_TOKENS } = require("../../config/chains");
const { getProvider } = require("../../utils/web3");
const { BRIDGES, OMNI_BRIDGE, WORMHOLE, CCIP } = require("../../catalog/contracts");
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
    if (protocol === "robinhood") return await orbitDeposit(base, "Robinhood Chain", BRIDGES.robinhoodInbox, BRIDGES.robinhoodBridge);
    if (protocol === "world-chain") return await opDeposit(base, "World Chain", BRIDGES.worldL1Bridge, BRIDGES.worldPortal);
    if (protocol === "starknet") return await starkgateDeposit(base);
    if (protocol === "polygon") return await polygonDeposit(base);
    if (protocol === "lighter-bridge") return await lighterDeposit(base);
    if (protocol === "near-bridge") return await omniBridgeDeposit(base);
    if (protocol === "portal") return await portalTransfer(base);
    if (protocol === "ccip") return await ccipSend(base);
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
  const after = await provider.getBalance(bridgeAddr, receipt.blockNumber);
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

/**
 * Arbitrum Orbit chain (Robinhood Chain): Delayed Inbox depositEth. The Inbox must report the
 * documented Bridge, the Bridge must hold exactly `value` more ETH, and the Inbox must emit
 * InboxMessageDelivered for the retryable.
 */
async function orbitDeposit(base, name, inboxAddr, bridgeAddr) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const inbox = new ethers.Contract(inboxAddr, ["function depositEth() payable returns (uint256)", "function bridge() view returns (address)"], signer);
  const reported = await inbox.bridge();
  if (reported.toLowerCase() !== bridgeAddr.toLowerCase()) {
    return finish({ ...base, ok: false, error: `${name} Inbox.bridge() is ${reported}, not ${bridgeAddr}` });
  }
  const before = await provider.getBalance(bridgeAddr);
  const receipt = await (await inbox.depositEth({ value })).wait();
  const after = await provider.getBalance(bridgeAddr, receipt.blockNumber);
  const message = receipt.logs.find(
    log => log.address.toLowerCase() === inboxAddr.toLowerCase() && log.topics[0] === topicOf("InboxMessageDelivered(uint256,bytes)")
  );
  const ok = after === before + value && Boolean(message);
  const nonce = message ? BigInt(message.topics[1]).toString() : "-";
  return finish({
    ...base,
    ok,
    key: `bridgeEth=${formatUnits(before, 18)}->${formatUnits(after, 18)} message=${nonce}`,
    detail: `${name} Delayed Inbox depositEth ${formatUnits(value, 18)} from ${user}\nbridge ETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nInboxMessageDelivered nonce ${nonce}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : `${name} inbox did not lock ETH in the bridge and emit InboxMessageDelivered`,
  });
}

/**
 * StarkGate 2.0 multi-bridge deposit of native ETH. msg.value is amount + the L1→L2 message fee
 * (estimateDepositFeeWei). The bridge keeps exactly `amount`, it emits Deposit, and the Starknet
 * core contract emits LogMessageToL2 for the L2 bridge.
 */
async function starkgateDeposit(base) {
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const bridgeAddr = BRIDGES.starkgateEthBridge;
  const bridge = new ethers.Contract(
    bridgeAddr,
    [
      "function deposit(address token, uint256 amount, uint256 l2Recipient) payable",
      "function estimateDepositFeeWei() view returns (uint256)",
    ],
    signer
  );
  const fee = await bridge.estimateDepositFeeWei();
  // Any Starknet felt works as a recipient; the destination credit is not checked on this fork.
  const l2Recipient = BigInt(user);
  const before = await provider.getBalance(bridgeAddr);
  const receipt = await (await bridge.deposit(BRIDGES.starkgateEthToken, amount, l2Recipient, { value: amount + fee })).wait();
  const after = await provider.getBalance(bridgeAddr, receipt.blockNumber);
  const deposit = logged(receipt, bridgeAddr, "Deposit(address,address,uint256,uint256,uint256,uint256)");
  const message = logged(receipt, BRIDGES.starknetCore, "LogMessageToL2(address,uint256,uint256,uint256[],uint256,uint256)");
  const ok = after === before + amount && deposit && message;
  return finish({
    ...base,
    ok,
    key: `bridgeEth=${formatUnits(before, 18)}->${formatUnits(after, 18)} fee=${formatUnits(fee, 18)} deposit=${deposit} l2Message=${message}`,
    detail: `StarkGate ETH deposit ${formatUnits(amount, 18)} + message fee ${formatUnits(fee, 18)} from ${user}\nbridge ETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nDeposit ${deposit}, core LogMessageToL2 ${message}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : "StarkGate did not lock the ETH, emit Deposit and send the L1→L2 message",
  });
}

/**
 * Polygon PoS: RootChainManager.depositEtherFor locks ETH in the EtherPredicate, which emits
 * LockedEther. The predicate must hold exactly `value` more ETH.
 */
async function polygonDeposit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const predicate = BRIDGES.polygonEtherPredicate;
  const manager = new ethers.Contract(BRIDGES.polygonRootChainManager, ["function depositEtherFor(address user) payable"], signer);
  const before = await provider.getBalance(predicate);
  const receipt = await (await manager.depositEtherFor(user, { value })).wait();
  const after = await provider.getBalance(predicate, receipt.blockNumber);
  const locked = logged(receipt, predicate, "LockedEther(address,address,uint256)");
  const ok = after === before + value && locked;
  return finish({
    ...base,
    ok,
    key: `predicateEth=${formatUnits(before, 18)}->${formatUnits(after, 18)} lockedEther=${locked}`,
    detail: `RootChainManager depositEtherFor ${formatUnits(value, 18)} from ${user}\nEtherPredicate ETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nLockedEther ${locked}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : "Polygon PoS bridge did not lock ETH in the EtherPredicate and emit LockedEther",
  });
}

/**
 * Lighter: deposit USDC (asset index 3, perps route 0) into the Ethereum contract. The user's
 * USDC must drop by exactly the amount, the contract's USDC must rise by it, and the contract
 * must log the deposit. Crediting on the Lighter L2 is off this machine.
 */
async function lighterDeposit(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "20", 6);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const signer = await impersonateFunded(base.chain, "USDC", usdc, amount);
  const user = await signer.getAddress();
  const lighterAddr = BRIDGES.lighter;
  const token = new ethers.Contract(usdc, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
  const lighter = new ethers.Contract(
    lighterAddr,
    ["function deposit(address _to, uint16 _assetIndex, uint8 _routeType, uint256 _amount) payable"],
    signer
  );
  const userBefore = await token.balanceOf(user);
  const poolBefore = await token.balanceOf(lighterAddr);
  await (await token.approve(lighterAddr, amount)).wait();
  const receipt = await (await lighter.deposit(user, BRIDGES.lighterUsdcAssetIndex, 0, amount)).wait();
  const userAfter = await token.balanceOf(user, { blockTag: receipt.blockNumber });
  const poolAfter = await token.balanceOf(lighterAddr, { blockTag: receipt.blockNumber });
  const fromLighter = receipt.logs.some(log => log.address.toLowerCase() === lighterAddr.toLowerCase());
  const ok = userBefore - userAfter === amount && poolAfter - poolBefore === amount && fromLighter;
  return finish({
    ...base,
    ok,
    key: `usdc=${formatUnits(userBefore, 6)}->${formatUnits(userAfter, 6)} lighterUsdc+=${formatUnits(poolAfter - poolBefore, 6)} log=${fromLighter}`,
    detail: `Lighter deposit ${formatUnits(amount, 6)} USDC (asset 3, perps) from ${user}\nuser USDC ${formatUnits(userBefore, 6)} -> ${formatUnits(userAfter, 6)}\nLighter USDC ${formatUnits(poolBefore, 6)} -> ${formatUnits(poolAfter, 6)}\ncontract log ${fromLighter}\n${DEST_NOTE}\ntx ${receipt.hash}`,
    error: ok ? null : "Lighter did not take the USDC deposit",
  });
}

const OMNI_INIT_TRANSFER =
  "event InitTransfer(address indexed sender, address indexed tokenAddress, uint64 indexed originNonce, uint128 amount, uint128 fee, uint128 nativeFee, string recipient, string message)";

/**
 * NEAR Omni Bridge: initTransfer(address(0), amount, 0, 0, "near:<account>", "") with value = amount
 * locks native ETH for NEAR. The bridge must hold exactly `amount` more ETH and emit InitTransfer
 * with the same sender, token (zero address), amount, fees and recipient.
 */
async function omniBridgeDeposit(base) {
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const recipient = process.env.FORK_NEAR_RECIPIENT || "near:defi-scripts-fork.near";
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const provider = getProvider(base.chain);
  const iface = new ethers.Interface([
    "function initTransfer(address tokenAddress, uint128 amount, uint128 fee, uint128 nativeFee, string recipient, string message) payable",
    OMNI_INIT_TRANSFER,
  ]);
  const bridge = new ethers.Contract(OMNI_BRIDGE, iface, signer);
  const before = await provider.getBalance(OMNI_BRIDGE);
  const receipt = await (await bridge.initTransfer(ethers.ZeroAddress, amount, 0, 0, recipient, "", { value: amount })).wait();
  const after = await provider.getBalance(OMNI_BRIDGE, receipt.blockNumber);
  const event = receipt.logs
    .filter(log => log.address.toLowerCase() === OMNI_BRIDGE.toLowerCase())
    .map(log => {
      try {
        return iface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(parsed => parsed && parsed.name === "InitTransfer");
  const eventOk =
    Boolean(event) &&
    event.args.sender === user &&
    event.args.tokenAddress === ethers.ZeroAddress &&
    event.args.amount === amount &&
    event.args.fee === 0n &&
    event.args.nativeFee === 0n &&
    event.args.recipient === recipient;
  const ok = after - before === amount && eventOk;
  const nonce = event ? event.args.originNonce.toString() : "-";
  return finish({
    ...base,
    ok,
    key: `omniEth+=${formatUnits(after - before, 18)} initTransfer=${eventOk} nonce=${nonce}`,
    detail: `Omni Bridge initTransfer ${formatUnits(amount, 18)} ETH to ${recipient} from ${user}\nbridge ETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nInitTransfer matches ${eventOk} (originNonce ${nonce})\nThe NEAR side verifies the Ethereum proof through its light client; this fork only checks the source chain.\ntx ${receipt.hash}`,
    error: ok ? null : "Omni Bridge did not lock the ETH and emit a matching InitTransfer",
  });
}

const WORMHOLE_PUBLISHED = new ethers.Interface([
  "event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)",
]);

/**
 * Portal (Wormhole Token Bridge): wrapAndTransferETH wraps the ETH into WETH, which the bridge keeps,
 * and the Core Contract publishes a transfer message. The bridge's WETH must rise by exactly `value`,
 * and the published payload (type 1 transfer) must carry the amount normalised to 8 decimals, the
 * WETH token on chain 2 (Ethereum) and the recipient chain.
 */
async function portalTransfer(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.05");
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
  const user = await signer.getAddress();
  const weth = new ethers.Contract(WORMHOLE.weth, ["function balanceOf(address) view returns (uint256)"], signer);
  const core = new ethers.Contract(WORMHOLE.core, ["function messageFee() view returns (uint256)"], signer);
  const bridge = new ethers.Contract(
    WORMHOLE.tokenBridge,
    ["function wrapAndTransferETH(uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64)"],
    signer
  );
  const fee = await core.messageFee();
  const recipient = ethers.zeroPadValue(user, 32);
  const before = await weth.balanceOf(WORMHOLE.tokenBridge);
  const receipt = await (await bridge.wrapAndTransferETH(WORMHOLE.arbitrumChainId, recipient, 0, 0, { value: value + fee })).wait();
  const after = await weth.balanceOf(WORMHOLE.tokenBridge, { blockTag: receipt.blockNumber });
  const published = receipt.logs
    .filter(log => log.address.toLowerCase() === WORMHOLE.core.toLowerCase())
    .map(log => {
      try {
        return WORMHOLE_PUBLISHED.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(parsed => parsed && parsed.args.sender.toLowerCase() === WORMHOLE.tokenBridge.toLowerCase());
  let payloadOk = false;
  let normalized = null;
  if (published) {
    // Transfer payload: u8 type(1) | u256 amount | bytes32 token | u16 tokenChain | bytes32 to | u16 toChain | u256 fee
    const bytes = ethers.getBytes(published.args.payload);
    const word = (start, len) => ethers.toBigInt(bytes.slice(start, start + len));
    normalized = word(1, 32);
    payloadOk =
      bytes[0] === 1 &&
      normalized === value / 10n ** 10n &&
      ethers.zeroPadValue(WORMHOLE.weth, 32).toLowerCase() === ethers.hexlify(bytes.slice(33, 65)).toLowerCase() &&
      Number(word(65, 2)) === 2 &&
      ethers.hexlify(bytes.slice(67, 99)).toLowerCase() === recipient.toLowerCase() &&
      Number(word(99, 2)) === WORMHOLE.arbitrumChainId;
  }
  const ok = after - before === value && payloadOk;
  return finish({
    ...base,
    ok,
    key: `bridgeWeth+=${formatUnits(after - before, 18)} payloadAmount=${normalized == null ? "-" : normalized.toString()} toChain=${WORMHOLE.arbitrumChainId} payload=${payloadOk}`,
    detail: `Portal wrapAndTransferETH ${formatUnits(value, 18)} ETH toward Wormhole chain ${WORMHOLE.arbitrumChainId} (Arbitrum) from ${user}\nmessage fee ${formatUnits(fee, 18)}\nToken Bridge WETH ${formatUnits(before, 18)} -> ${formatUnits(after, 18)}\nLogMessagePublished transfer payload matches ${payloadOk} (8-decimal amount ${normalized == null ? "-" : normalized.toString()})\nGuardians sign the VAA and the destination redeems it; this fork only checks the source chain.\ntx ${receipt.hash}`,
    error: ok ? null : "Portal did not keep the wrapped ETH and publish a matching transfer message",
  });
}

const CCIP_MESSAGE =
  "tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs)";

/**
 * Chainlink CCIP: Router.ccipSend of LINK from Ethereum to Base, fee paid in ETH. LINK uses a
 * LockReleaseTokenPool on Ethereum (the pool TokenAdminRegistry returns must be the documented one).
 * The user's LINK must drop by exactly `amount`, the pool's LINK must rise by exactly `amount`,
 * the Router must take exactly getFee() in ETH, and the lane's OnRamp must log the message.
 */
async function ccipSend(base) {
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const provider = getProvider(base.chain);
  const signer = await impersonateFunded(base.chain, "LINK", CCIP.link, amount);
  const user = await signer.getAddress();
  const registry = new ethers.Contract(CCIP.tokenAdminRegistry, ["function getPool(address) view returns (address)"], provider);
  const pool = await registry.getPool(CCIP.link);
  if (pool.toLowerCase() !== CCIP.linkPool.toLowerCase()) {
    return finish({ ...base, ok: false, error: `TokenAdminRegistry pool for LINK is ${pool}, not ${CCIP.linkPool}` });
  }
  const router = new ethers.Contract(
    CCIP.router,
    [
      `function getFee(uint64 destinationChainSelector, ${CCIP_MESSAGE} message) view returns (uint256)`,
      `function ccipSend(uint64 destinationChainSelector, ${CCIP_MESSAGE} message) payable returns (bytes32)`,
      "function getOnRamp(uint64 destChainSelector) view returns (address)",
    ],
    signer
  );
  const link = new ethers.Contract(
    CCIP.link,
    ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"],
    signer
  );
  const onRamp = await router.getOnRamp(CCIP.baseSelector);
  // EVMExtraArgsV1 with gasLimit 0: a token-only transfer to an EOA runs no receiver code.
  const extraArgs = ethers.concat(["0x97a657c9", ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [0])]);
  const message = {
    receiver: ethers.AbiCoder.defaultAbiCoder().encode(["address"], [user]),
    data: "0x",
    tokenAmounts: [{ token: CCIP.link, amount }],
    feeToken: ethers.ZeroAddress,
    extraArgs,
  };
  const fee = await router.getFee(CCIP.baseSelector, message);
  await provider.send("anvil_setBalance", [user, ethers.toQuantity(fee + ethers.parseEther("1"))]);
  await (await link.approve(CCIP.router, amount)).wait();
  const userBefore = await link.balanceOf(user);
  const poolBefore = await link.balanceOf(CCIP.linkPool);
  const ethBefore = await provider.getBalance(user);
  const receipt = await (await router.ccipSend(CCIP.baseSelector, message, { value: fee })).wait();
  const tag = { blockTag: receipt.blockNumber };
  const userAfter = await link.balanceOf(user, tag);
  const poolAfter = await link.balanceOf(CCIP.linkPool, tag);
  const ethAfter = await provider.getBalance(user, receipt.blockNumber);
  const gasPaid = receipt.gasUsed * (receipt.gasPrice || receipt.effectiveGasPrice || 0n);
  const feePaid = ethBefore - ethAfter - gasPaid;
  const fromOnRamp = receipt.logs.some(log => log.address.toLowerCase() === onRamp.toLowerCase());
  const ok = userBefore - userAfter === amount && poolAfter - poolBefore === amount && feePaid === fee && fromOnRamp;
  return finish({
    ...base,
    ok,
    key: `link=${formatUnits(userBefore, 18)}->${formatUnits(userAfter, 18)} poolLink+=${formatUnits(poolAfter - poolBefore, 18)} feeEth=${formatUnits(feePaid, 18)} quoted=${formatUnits(fee, 18)} onRampLog=${fromOnRamp}`,
    detail: `CCIP ccipSend ${formatUnits(amount, 18)} LINK Ethereum → Base (selector ${CCIP.baseSelector}) from ${user}\nuser LINK ${formatUnits(userBefore, 18)} -> ${formatUnits(userAfter, 18)}\nLockReleaseTokenPool LINK ${formatUnits(poolBefore, 18)} -> ${formatUnits(poolAfter, 18)}\nfee ${formatUnits(feePaid, 18)} ETH (getFee ${formatUnits(fee, 18)})\nOnRamp ${onRamp} logged ${fromOnRamp}\nThe DON commits and executes on Base; this fork only checks the source chain.\ntx ${receipt.hash}`,
    error: ok ? null : "CCIP did not lock exactly the LINK in the pool, charge getFee() and log on the OnRamp",
  });
}

// ethers caches an identical getBalance("latest") for ~250 ms; after-reads pass the receipt block.
async function lockedEth(provider, addresses, blockTag = "latest") {
  let total = 0n;
  for (const address of addresses) total += await provider.getBalance(address, blockTag);
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
  const after = await lockedEth(provider, locks, receipt.blockNumber);
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
