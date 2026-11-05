/**
 * Exit / withdrawal-request / redeem fork actions for staking, LST/LRT, vault and stablecoin
 * protocols (docs/08 feature gaps). One FORK_TARGET (`exits`), dispatched on FORK_PROTOCOL
 * and FORK_ACTION. Every test sends real transactions on a local Anvil fork and asserts the
 * on-chain state the protocol documents; any revert is a FAIL.
 * Addresses and doc links: src/catalog/contracts.js (EXITS).
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { COMMON_TOKENS } = require("../../config/chains");
const { EXITS, VEDA, SKY, ETHERFI, KELP, RENZO, STAKEWISE, LISTA_STAKE } = require("../../catalog/contracts");
const { requireFork, impersonateFunded, formatUnits, finish } = require("./runtime");

const GAS = { gasLimit: 2_000_000n };
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
];

function explain(err) {
  const data = typeof err.data === "string" ? err.data : "";
  if (data.startsWith("0x08c379a0")) {
    try {
      return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    } catch {
      // fall through
    }
  }
  return `${err.reason || err.shortMessage || err.message || err} ${data}`.trim();
}

async function ethSigner(chain, ether = "10") {
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
  await getProvider(chain).send("anvil_setBalance", [
    await signer.getAddress(),
    ethers.toQuantity(ethers.parseEther(ether)),
  ]);
  return signer;
}

async function warp(chain, seconds) {
  const provider = getProvider(chain);
  await provider.send("evm_increaseTime", [Number(seconds)]);
  await provider.send("evm_mine", []);
}

/** Veda Liquid ETH: Teller deposit WETH, wait out the share lock, BoringOnChainQueue.requestOnChainWithdraw. */
async function vedaRequest(base) {
  const provider = getProvider(base.chain);
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const teller = new ethers.Contract(
    VEDA.teller,
    [
      "function deposit(address depositAsset, uint256 depositAmount, uint256 minimumMint) payable returns (uint256)",
      "function isPaused() view returns (bool)",
      "function shareLockPeriod() view returns (uint64)",
    ],
    provider
  );
  const queueAbi = [
    "function boringVault() view returns (address)",
    "function isPaused() view returns (bool)",
    "function withdrawAssets(address) view returns (bool allowWithdraws, uint24 secondsToMaturity, uint24 minimumSecondsToDeadline, uint16 minDiscount, uint16 maxDiscount, uint96 minimumShares)",
    "function requestOnChainWithdraw(address assetOut, uint128 amountOfShares, uint16 discount, uint24 secondsToDeadline) returns (bytes32 requestId)",
    "function getRequestIds() view returns (bytes32[])",
  ];
  const queueRead = new ethers.Contract(EXITS.vedaQueue, queueAbi, provider);
  const bound = await queueRead.boringVault();
  if (bound.toLowerCase() !== VEDA.vault.toLowerCase())
    return finish({ ...base, ok: false, error: `queue boringVault() is ${bound}, not ${VEDA.vault}` });
  if (await teller.isPaused()) return finish({ ...base, ok: false, error: "Veda teller is paused; no tx sent" });
  if (await queueRead.isPaused())
    return finish({ ...base, ok: false, error: "BoringOnChainQueue is paused; no tx sent" });
  // The queue pays out weETH (WETH and eETH are closed on 2026-11-02); pick the first open asset.
  let assetOut = null;
  let cfg = null;
  for (const [sym, addr] of [
    ["WETH", VEDA.weth],
    ["weETH", ETHERFI.weETH],
    ["eETH", ETHERFI.eETH],
  ]) {
    const c = await queueRead.withdrawAssets(addr);
    if (c.allowWithdraws) {
      assetOut = { sym, addr };
      cfg = c;
      break;
    }
  }
  if (!assetOut)
    return finish({
      ...base,
      ok: false,
      error: "BoringOnChainQueue: no withdraw asset (WETH/weETH/eETH) is open; no tx sent",
    });

  const signer = await impersonateFunded(base.chain, "WETH", VEDA.weth, amount);
  const user = await signer.getAddress();
  const shares = new ethers.Contract(VEDA.vault, ERC, signer);
  await (await new ethers.Contract(VEDA.weth, ERC, signer).approve(VEDA.vault, amount)).wait();
  await (await teller.connect(signer).deposit(VEDA.weth, amount, 0, GAS)).wait();
  const minted = await shares.balanceOf(user);
  const lock = await teller.shareLockPeriod();
  if (lock > 0n) await warp(base.chain, lock + 1n);

  const idsBefore = (await queueRead.getRequestIds()).length;
  const queueSharesBefore = await shares.balanceOf(EXITS.vedaQueue);
  await (await shares.approve(EXITS.vedaQueue, minted)).wait();
  const deadline = Number(cfg.minimumSecondsToDeadline) > 0 ? Number(cfg.minimumSecondsToDeadline) : 3 * 86400;
  const queue = new ethers.Contract(EXITS.vedaQueue, queueAbi, signer);
  const receipt = await (
    await queue.requestOnChainWithdraw(assetOut.addr, minted, cfg.minDiscount, deadline, GAS)
  ).wait();
  const idsAfter = (await queueRead.getRequestIds()).length;
  const userAfter = await shares.balanceOf(user);
  const queueSharesAfter = await shares.balanceOf(EXITS.vedaQueue);
  const ok =
    minted > 0n && userAfter === 0n && queueSharesAfter - queueSharesBefore === minted && idsAfter === idsBefore + 1;
  return finish({
    ...base,
    ok,
    key: `liquidETH=${formatUnits(minted, 18)}->queue requests=${idsBefore}->${idsAfter} discountBps=${cfg.minDiscount} out=${assetOut.sym}`,
    detail: `deposited ${formatUnits(amount, 18)} WETH, minted ${formatUnits(minted, 18)} liquidETH, share lock ${lock}s\nrequestOnChainWithdraw(${assetOut.sym}, all shares, discount ${cfg.minDiscount}, deadline ${deadline}s): shares moved to the queue, one open request added. Solver fill is off-chain.\ntx ${receipt.hash}`,
    error: ok ? null : "shares did not move into the queue or no request was recorded",
  });
}

/** Sky LitePSM wrapper: sellGem USDC -> USDS, then buyGem USDS -> USDC. */
async function skyPsm(base) {
  const provider = getProvider(base.chain);
  const usdc = COMMON_TOKENS.USDC.ethereum;
  const gemAmt = ethers.parseUnits(process.env.FORK_AMOUNT || "1000", 6);
  const abi = [
    "function tin() view returns (uint256)",
    "function tout() view returns (uint256)",
    "function usds() view returns (address)",
    "function gem() view returns (address)",
    "function sellGem(address usr, uint256 gemAmt) returns (uint256 usdsOutWad)",
    "function buyGem(address usr, uint256 gemAmt) returns (uint256 usdsInWad)",
  ];
  const read = new ethers.Contract(EXITS.skyPsmWrapper, abi, provider);
  const [tin, tout, usdsAddr, gem] = await Promise.all([read.tin(), read.tout(), read.usds(), read.gem()]);
  if (usdsAddr.toLowerCase() !== SKY.usds.toLowerCase() || gem.toLowerCase() !== usdc.toLowerCase()) {
    return finish({ ...base, ok: false, error: `wrapper usds()/gem() ${usdsAddr}/${gem} do not match USDS/USDC` });
  }
  if (tin === ethers.MaxUint256 || tout === ethers.MaxUint256)
    return finish({ ...base, ok: false, error: "PSM direction halted (tin/tout = max); no tx sent" });
  const signer = await impersonateFunded(base.chain, "USDC", usdc, gemAmt);
  const user = await signer.getAddress();
  const usdcC = new ethers.Contract(usdc, ERC, signer);
  const usdsC = new ethers.Contract(SKY.usds, ERC, signer);
  const psm = new ethers.Contract(EXITS.skyPsmWrapper, abi, signer);
  const WAD = 10n ** 18n;
  const usdc0 = await usdcC.balanceOf(user);
  const usds0 = await usdsC.balanceOf(user);
  await (await usdcC.approve(EXITS.skyPsmWrapper, gemAmt)).wait();
  await (await psm.sellGem(user, gemAmt, GAS)).wait();
  const usdc1 = await usdcC.balanceOf(user);
  const usds1 = await usdsC.balanceOf(user);
  const expectedOut = gemAmt * 10n ** 12n - (gemAmt * 10n ** 12n * tin) / WAD;
  const back = gemAmt / 2n;
  const expectedIn = back * 10n ** 12n + (back * 10n ** 12n * tout) / WAD;
  await (await usdsC.approve(EXITS.skyPsmWrapper, expectedIn)).wait();
  const receipt = await (await psm.buyGem(user, back, GAS)).wait();
  const usdc2 = await usdcC.balanceOf(user);
  const usds2 = await usdsC.balanceOf(user);
  const ok =
    usdc0 - usdc1 === gemAmt && usds1 - usds0 === expectedOut && usdc2 - usdc1 === back && usds1 - usds2 === expectedIn;
  return finish({
    ...base,
    ok,
    key: `sellGem USDC=${formatUnits(gemAmt, 6)}->USDS=${formatUnits(usds1 - usds0, 18)} buyGem USDC=${formatUnits(back, 6)}<-USDS=${formatUnits(usds1 - usds2, 18)} tin=${tin} tout=${tout}`,
    detail: `UsdsPsmWrapper sellGem ${formatUnits(gemAmt, 6)} USDC -> ${formatUnits(usds1 - usds0, 18)} USDS (expected ${formatUnits(expectedOut, 18)})\nbuyGem ${formatUnits(back, 6)} USDC for ${formatUnits(usds1 - usds2, 18)} USDS (expected ${formatUnits(expectedIn, 18)})\ntx ${receipt.hash}`,
    error: ok ? null : "PSM amounts did not match tin/tout",
  });
}

/** sUSDS: deposit USDS (from DAI->USDS is covered elsewhere, so deal USDS) then redeem every share. */
async function skyRedeem(base) {
  const provider = getProvider(base.chain);
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1000");
  const abi = [
    ...ERC,
    "function deposit(uint256 assets, address receiver) returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
    "function previewRedeem(uint256 shares) view returns (uint256)",
    "function asset() view returns (address)",
  ];
  const read = new ethers.Contract(SKY.susds, abi, provider);
  if ((await read.asset()).toLowerCase() !== SKY.usds.toLowerCase())
    return finish({ ...base, ok: false, error: "sUSDS asset() is not USDS" });
  const signer = await impersonateFunded(base.chain, "USDS", SKY.usds, amount);
  const user = await signer.getAddress();
  const usds = new ethers.Contract(SKY.usds, ERC, signer);
  const susds = new ethers.Contract(SKY.susds, abi, signer);
  await (await usds.approve(SKY.susds, amount)).wait();
  await (await susds.deposit(amount, user, GAS)).wait();
  const shares = await susds.balanceOf(user);
  await warp(base.chain, 86400);
  const preview = await susds.previewRedeem(shares);
  const usdsBefore = await usds.balanceOf(user);
  const receipt = await (await susds.redeem(shares, user, user, GAS)).wait();
  const got = (await usds.balanceOf(user)) - usdsBefore;
  const left = await susds.balanceOf(user);
  // preview is read one block before the redeem lands, so the redeem can only pay more.
  const ok = shares > 0n && left === 0n && got >= preview && got - preview <= got / 1_000_000n && got >= amount - 2n;
  return finish({
    ...base,
    ok,
    key: `sUSDS=${formatUnits(shares, 18)}->0 USDS out=${formatUnits(got, 18)} (in ${formatUnits(amount, 18)}, +1 day)`,
    detail: `deposited ${formatUnits(amount, 18)} USDS, ${formatUnits(shares, 18)} sUSDS; warped 1 day; redeem(all) returned ${formatUnits(got, 18)} USDS (previewRedeem one block earlier ${formatUnits(preview, 18)})\ntx ${receipt.hash}`,
    error: ok ? null : "sUSDS redeem did not burn all shares for previewRedeem USDS",
  });
}

/** ether.fi: deposit ETH -> eETH, LiquidityPool.requestWithdraw -> WithdrawRequestNFT. */
async function etherfiRequest(base) {
  const provider = getProvider(base.chain);
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await ethSigner(base.chain);
  const user = await signer.getAddress();
  const pool = new ethers.Contract(
    ETHERFI.liquidityPool,
    [
      "function deposit() payable returns (uint256)",
      "function requestWithdraw(address recipient, uint256 amount) returns (uint256)",
      "function withdrawRequestNFT() view returns (address)",
    ],
    signer
  );
  const nftAddr = await pool.withdrawRequestNFT();
  if (nftAddr.toLowerCase() !== EXITS.etherfiWithdrawNft.toLowerCase())
    return finish({ ...base, ok: false, error: `withdrawRequestNFT() is ${nftAddr}` });
  const nft = new ethers.Contract(
    nftAddr,
    [
      "function balanceOf(address) view returns (uint256)",
      "function ownerOf(uint256) view returns (address)",
      "function nextRequestId() view returns (uint256)",
      "function isFinalized(uint256) view returns (bool)",
      "function paused() view returns (bool)",
    ],
    provider
  );
  if (await nft.paused()) return finish({ ...base, ok: false, error: "WithdrawRequestNFT is paused; no tx sent" });
  const eeth = new ethers.Contract(ETHERFI.eETH, ERC, signer);
  await (await pool["deposit()"]({ value, ...GAS })).wait();
  const bal = await eeth.balanceOf(user);
  const amount = bal - 2n;
  await (await eeth.approve(ETHERFI.liquidityPool, amount)).wait();
  const id = await nft.nextRequestId();
  const nftBefore = await nft.balanceOf(user);
  const receipt = await (await pool.requestWithdraw(user, amount, GAS)).wait();
  const owner = await nft.ownerOf(id);
  const eethAfter = await eeth.balanceOf(user);
  const ok =
    (await nft.balanceOf(user)) === nftBefore + 1n &&
    owner.toLowerCase() === user.toLowerCase() &&
    eethAfter <= 4n &&
    !(await nft.isFinalized(id));
  return finish({
    ...base,
    ok,
    key: `eETH=${formatUnits(bal, 18)}->${formatUnits(eethAfter, 18)} nft#${id} finalized=false`,
    detail: `deposited ${formatUnits(value, 18)} ETH -> ${formatUnits(bal, 18)} eETH; requestWithdraw(${formatUnits(amount, 18)}) minted WithdrawRequestNFT #${id} to the user (not finalized; finalization is the oracle's)\ntx ${receipt.hash}`,
    error: ok ? null : "requestWithdraw did not lock eETH into an NFT owned by the user",
  });
}

/** Kelp: deposit ETH -> rsETH, LRTWithdrawalManager.initiateWithdrawal(ETH). */
async function kelpRequest(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const signer = await ethSigner(base.chain);
  const user = await signer.getAddress();
  const depositPool = new ethers.Contract(
    KELP.depositPool,
    ["function depositETH(uint256 minRSETHAmountExpected, string referralId) payable"],
    signer
  );
  const rseth = new ethers.Contract(KELP.rsETH, ERC, signer);
  const mgrAbi = [
    "function paused() view returns (bool)",
    "function initiateWithdrawal(address asset, uint256 rsETHUnstaked, string referralId)",
    "function getExpectedAssetAmount(address asset, uint256 amount) view returns (uint256)",
    "function userAssociatedNonces(address asset, address user) view returns (uint128 start, uint128 end)",
    "function minRsEthAmountToWithdraw(address asset) view returns (uint256)",
  ];
  const mgr = new ethers.Contract(EXITS.kelpWithdrawalManager, mgrAbi, signer);
  if (await mgr.paused()) return finish({ ...base, ok: false, error: "LRTWithdrawalManager is paused; no tx sent" });
  await (await depositPool.depositETH(0, "", { value, ...GAS })).wait();
  const bal = await rseth.balanceOf(user);
  const expected = await mgr.getExpectedAssetAmount(ETH, bal);
  const [, endBefore] = await mgr.userAssociatedNonces(ETH, user);
  await (await rseth.approve(EXITS.kelpWithdrawalManager, bal)).wait();
  const receipt = await (await mgr.initiateWithdrawal(ETH, bal, "", GAS)).wait();
  const [, endAfter] = await mgr.userAssociatedNonces(ETH, user);
  const after = await rseth.balanceOf(user);
  const ok = bal > 0n && after === 0n && endAfter === endBefore + 1n && expected > 0n;
  return finish({
    ...base,
    ok,
    key: `rsETH=${formatUnits(bal, 18)}->0 requests=${endBefore}->${endAfter} expectedETH=${formatUnits(expected, 18)}`,
    detail: `depositETH ${formatUnits(value, 18)} -> ${formatUnits(bal, 18)} rsETH; initiateWithdrawal(ETH, all) queued one request worth ${formatUnits(expected, 18)} ETH (claimable after the withdrawal delay and an operator unlock)\ntx ${receipt.hash}`,
    error: ok ? null : "rsETH not taken or no request queued",
  });
}

/** Renzo: deposit ETH -> ezETH, WithdrawQueue.withdraw(ezETH, ETH). */
async function renzoRequest(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const signer = await ethSigner(base.chain);
  const user = await signer.getAddress();
  const rm = new ethers.Contract(
    RENZO.restakeManager,
    ["function depositETH() payable", "function paused() view returns (bool)"],
    signer
  );
  const ez = new ethers.Contract(RENZO.ezETH, ERC, signer);
  const q = new ethers.Contract(
    EXITS.renzoWithdrawQueue,
    [
      "function paused() view returns (bool)",
      "function withdraw(uint256 _amount, address _assetOut)",
      "function getOutstandingWithdrawRequests(address user) view returns (uint256)",
      "function getAvailableToWithdraw(address) view returns (uint256)",
    ],
    signer
  );
  if (await q.paused()) return finish({ ...base, ok: false, error: "Renzo WithdrawQueue is paused; no tx sent" });
  await (await rm["depositETH()"]({ value, ...GAS })).wait();
  const bal = await ez.balanceOf(user);
  const before = await q.getOutstandingWithdrawRequests(user);
  await (await ez.approve(EXITS.renzoWithdrawQueue, bal)).wait();
  const receipt = await (await q.withdraw(bal, ETH, GAS)).wait();
  const after = await q.getOutstandingWithdrawRequests(user);
  const left = await ez.balanceOf(user);
  const ok = bal > 0n && left === 0n && after === before + 1n;
  return finish({
    ...base,
    ok,
    key: `ezETH=${formatUnits(bal, 18)}->0 outstanding=${before}->${after}`,
    detail: `depositETH ${formatUnits(value, 18)} -> ${formatUnits(bal, 18)} ezETH; WithdrawQueue.withdraw(all, ETH) locked the ezETH and opened one request (claim after coolDownPeriod)\ntx ${receipt.hash}`,
    error: ok ? null : "ezETH not locked or no withdraw request opened",
  });
}

/** Rocket Pool: deposit ETH -> rETH, then burn half of it back to ETH. */
async function rocketBurn(base) {
  const provider = getProvider(base.chain);
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await ethSigner(base.chain);
  const user = await signer.getAddress();
  const reth = new ethers.Contract(
    EXITS.rETH,
    [
      ...ERC,
      "function burn(uint256 rethAmount)",
      "function getEthValue(uint256) view returns (uint256)",
      "function getTotalCollateral() view returns (uint256)",
    ],
    signer
  );
  const pool = new ethers.Contract(
    require("../../catalog/contracts").ROCKET_DEPOSIT_POOL,
    ["function deposit() payable", "function getExcessBalance() view returns (uint256)"],
    signer
  );
  await (await pool.deposit({ value, ...GAS })).wait();
  const bal = await reth.balanceOf(user);
  const burnAmt = bal / 2n;
  const ethValue = await reth.getEthValue(burnAmt);
  // The burn is paid out of the deposit pool's free balance. When there is no excess it pays
  // dust, which looked like a broken assertion; say why instead and send no tx.
  const excess = await pool.getExcessBalance();
  if (excess < ethValue)
    return finish({
      ...base,
      ok: false,
      error: `deposit pool excess ${formatUnits(excess, 18)} ETH < burn value ${formatUnits(ethValue, 18)}; burn would return dust, no tx sent`,
    });
  const collateral = await reth.getTotalCollateral();
  if (collateral < ethValue)
    return finish({
      ...base,
      ok: false,
      error: `rETH collateral ${formatUnits(collateral, 18)} ETH < burn value ${formatUnits(ethValue, 18)}; no burn sent`,
    });
  const ethBefore = await provider.getBalance(user);
  const tx = await reth.burn(burnAmt, GAS);
  const receipt = await tx.wait();
  const gasCost = receipt.gasUsed * receipt.gasPrice;
  const ethGot = (await provider.getBalance(user)) + gasCost - ethBefore;
  const left = await reth.balanceOf(user);
  const ok = burnAmt > 0n && left === bal - burnAmt && ethGot === ethValue;
  return finish({
    ...base,
    ok,
    key: `rETH=${formatUnits(bal, 18)}->${formatUnits(left, 18)} ETH out=${formatUnits(ethGot, 18)} collateral=${formatUnits(collateral, 18)}`,
    detail: `deposited ${formatUnits(value, 18)} ETH -> ${formatUnits(bal, 18)} rETH; burn(${formatUnits(burnAmt, 18)}) paid ${formatUnits(ethGot, 18)} ETH = getEthValue\ntx ${receipt.hash}`,
    error: ok ? null : "rETH burn did not pay getEthValue",
  });
}

/** StakeWise V3 Genesis Vault: deposit ETH, enterExitQueue for all shares. */
async function stakewiseExit(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await ethSigner(base.chain);
  const user = await signer.getAddress();
  const abi = [
    "function deposit(address receiver, address referrer) payable returns (uint256)",
    "function getShares(address) view returns (uint256)",
    "function isStateUpdateRequired() view returns (bool)",
    "function enterExitQueue(uint256 shares, address receiver) returns (uint256 positionTicket)",
    "function convertToAssets(uint256) view returns (uint256)",
  ];
  const vault = new ethers.Contract(STAKEWISE.genesisVault, abi, signer);
  if (await vault.isStateUpdateRequired())
    return finish({
      ...base,
      ok: false,
      error: "Genesis Vault needs a keeper updateState before deposits; no tx sent",
    });
  await (await vault.deposit(user, ethers.ZeroAddress, { value, ...GAS })).wait();
  const shares = await vault.getShares(user);
  const tx = await vault.enterExitQueue(shares, user, GAS);
  const receipt = await tx.wait();
  const iface = new ethers.Interface([
    "event ExitQueueEntered(address indexed owner, address indexed receiver, uint256 positionTicket, uint256 shares)",
    "event V2ExitQueueEntered(address indexed owner, address indexed receiver, uint256 positionTicket, uint256 shares, uint256 assets)",
  ]);
  let ticket = null;
  let queued = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== STAKEWISE.genesisVault.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed) {
        ticket = parsed.args.positionTicket;
        queued = parsed.args.shares;
      }
    } catch {
      // other vault events
    }
  }
  const left = await vault.getShares(user);
  const ok = shares > 0n && left === 0n && ticket !== null && queued === shares;
  return finish({
    ...base,
    ok,
    key: `shares=${formatUnits(shares, 18)}->${formatUnits(left, 18)} ticket=${ticket}`,
    detail: `deposited ${formatUnits(value, 18)} ETH, ${formatUnits(shares, 18)} vault shares; enterExitQueue(all) emitted ExitQueueEntered ticket ${ticket} (claimable after validators exit)\ntx ${receipt.hash}`,
    error: ok ? null : "shares not moved into the exit queue",
  });
}

/** Lista (BSC): deposit BNB -> slisBNB, StakeManager.requestWithdraw(all). */
async function listaUnstake(base) {
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await ethSigner(base.chain);
  const user = await signer.getAddress();
  const mgr = new ethers.Contract(
    LISTA_STAKE.manager,
    [
      "function deposit() payable",
      "function requestWithdraw(uint256 _amountInSlisBnb)",
      "function getUserWithdrawalRequests(address) view returns (tuple(uint256 uuid, uint256 amountInSnBnb, uint256 startTime)[])",
      "function paused() view returns (bool)",
    ],
    signer
  );
  if (await mgr.paused()) return finish({ ...base, ok: false, error: "ListaStakeManager is paused; no tx sent" });
  const slis = new ethers.Contract(LISTA_STAKE.slisBNB, ERC, signer);
  await (await mgr.deposit({ value, ...GAS })).wait();
  const bal = await slis.balanceOf(user);
  const before = (await mgr.getUserWithdrawalRequests(user)).length;
  await (await slis.approve(LISTA_STAKE.manager, bal)).wait();
  const receipt = await (await mgr.requestWithdraw(bal, GAS)).wait();
  const reqs = await mgr.getUserWithdrawalRequests(user);
  const left = await slis.balanceOf(user);
  const last = reqs[reqs.length - 1];
  const ok = bal > 0n && left === 0n && reqs.length === before + 1 && last.amountInSnBnb === bal;
  return finish({
    ...base,
    ok,
    key: `slisBNB=${formatUnits(bal, 18)}->0 requests=${before}->${reqs.length}`,
    detail: `deposit ${formatUnits(value, 18)} BNB -> ${formatUnits(bal, 18)} slisBNB; requestWithdraw(all) recorded request uuid ${last ? last.uuid : "-"} (claimable after the unbonding period)\ntx ${receipt.hash}`,
    error: ok ? null : "slisBNB not taken or no withdrawal request recorded",
  });
}

const HANDLERS = {
  "veda:request": vedaRequest,
  "sky:psm": skyPsm,
  "sky:redeem": skyRedeem,
  "etherfi:request": etherfiRequest,
  "kelp:request": kelpRequest,
  "renzo:request": renzoRequest,
  "rocketpool:burn": rocketBurn,
  "stakewise:exit": stakewiseExit,
  "lista:unstake": listaUnstake,
};

async function run() {
  const chain = process.env.CHAIN || "ethereum";
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  let ctx;
  try {
    ctx = await requireFork(chain);
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const base = { protocol, action, chain, block: ctx.forkBlock };
  const handler = HANDLERS[`${protocol}:${action}`];
  if (!handler) return finish({ ...base, ok: false, error: `Unknown exit action ${protocol}:${action}` });
  try {
    return await handler(base);
  } catch (err) {
    // A revert is a FAIL.
    return finish({ ...base, ok: false, error: explain(err) });
  }
}

module.exports = { run };
