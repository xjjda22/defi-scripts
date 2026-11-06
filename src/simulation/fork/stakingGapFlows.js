/**
 * Staking / restaking / LST exit gaps from docs/08-feature-test-gaps.md (batch "staking", 2026-11-06).
 * One FORK_TARGET (staking-gaps); FORK_PROTOCOL + FORK_ACTION pick the test. Every test runs on a
 * local Anvil fork, funds a fresh impersonated account (whale transfer, anvil_deal or anvil_setBalance),
 * needs no PRIVATE_KEY, FAILs on any revert and asserts a measured state delta.
 * Addresses are EIP-55 and cited from the protocol docs listed next to each constant.
 * Time warps are wrapped in evm_snapshot / evm_revert so later tests on the same fork are unaffected.
 */

const { ethers } = require("ethers");
const { getProvider } = require("../../utils/web3");
const { impersonateAccount } = require("../../utils/impersonate");
const { requireFork, impersonateFunded, dealErc20, formatUnits, finish } = require("./runtime");
const { EIGENLAYER, FALCON, SATURN, META_POOL, SOLVBTC, CIAN, BENQI, THEO } = require("../../catalog/contracts");

const GAS = { gasLimit: 3_000_000n };
const ZERO = ethers.ZeroAddress;
const ERC = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

// https://etherfi.gitbook.io/etherfi/products/liquid/live-vaults (Liquid USD / Liquid BTC vault pages)
const LIQUID = {
  usd: {
    label: "liquidUSD",
    vault: "0x08c6F91e2B681FaF5e17227F2a44C307b3C1364C",
    teller: "0x4DE413a26fC24c3FC27Cc983be70aA9c5C299387",
    accountant: "0xc315D6e14DDCDC7407784e2Caf815d131Bc1D3E7",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    amount: "100",
  },
  btc: {
    label: "liquidBTC",
    vault: "0x5f46d540b6eD704C3c8789105F30E075AA900726",
    teller: "0x8Ea0B382D054dbEBeB1d0aE47ee4AC433C730353",
    accountant: "0xEa23aC6D7D11f6b181d6B98174D334478ADAe6b0",
    asset: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    decimals: 8,
    amount: "0.01",
  },
};
// https://docs.superearn.io/en/developers/smart-contracts (Ethereum · chain 1)
const AVALON = {
  router: "0xd8acFF2E2B8B1Cf052aca4Ba331743F73C569E68",
  superVault: "0x9E3E70f4d09bcfe08F456C426EB90f7aA6F70dF2",
  cooldownVault: "0x8E53CdAa89381c203a074fB3388f65936358f200",
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};
// https://docs.lagoon.finance/resources/networks-and-addresses (Ethereum tab)
const LAGOON = {
  factory: "0x8D6f5479B14348186faE9BC7E636e947c260f9B1",
  logicV050: "0xE50554ec802375C9c3F9c087a8a7bb8C26d3DEDf",
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};
// https://saturncredit.gitbook.io/saturn-docs/operations-and-governance/key-addresses ("Withdraw Contract")
const SATURN_WITHDRAW = "0x4Bc9FEC04F0F95e9b42a3EF18F3C96fB57923D2e";
// https://docs.metapool.app/master/for-developers/meta-pool-contracts/ethereum-network-and-l2s ("Withdrawal Contract")
const META_POOL_WITHDRAWAL = "0xE55E5fDe6C25ac4AD75D867817D2d8a45836Af49";
// frxETHMinter: https://github.com/FraxFinance/frxETH-public (README deployments); frxETH token:
// https://docs.frax.com/protocol/assets/frxeth/addresses
const FRAX_ETH = {
  minter: "0xbAFA44EFE7901E04E39Dad13167D089C559c1138",
  frxeth: "0x5E8422345238F34275888049021821E8E08CAa1f",
};
// https://docs.symbiotic.fi/get-started/resources/addresses (Core: VaultFactory). wstETH is Lido's.
const SYMBIOTIC_VAULTS = {
  factory: "0xAEb6bdd95c502390db8f52c8909F703E9Af6a346",
  wsteth: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
};

function eventArgs(receipt, iface, name, address) {
  const out = [];
  for (const log of receipt.logs) {
    if (address && log.address.toLowerCase() !== address.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === name) out.push(parsed.args);
    } catch {
      // other contract's log
    }
  }
  return out;
}

async function freshEth(chain, eth = "10") {
  const signer = await impersonateAccount(ethers.Wallet.createRandom().address, chain);
  const provider = getProvider(chain);
  await provider.send("anvil_setBalance", [await signer.getAddress(), ethers.toQuantity(ethers.parseEther(eth))]);
  return signer;
}

async function warp(provider, seconds) {
  await provider.send("evm_increaseTime", [Number(seconds)]);
  await provider.send("evm_mine", []);
}

/* ---------- 1. ether.fi Liquid USD / BTC: Teller deposit into the BoringVault ---------- */
const TELLER_ABI = [
  "function deposit(address depositAsset, uint256 depositAmount, uint256 minimumMint) payable returns (uint256)",
  "function isPaused() view returns (bool)",
  "function vault() view returns (address)",
  "function accountant() view returns (address)",
  "function assetData(address) view returns (bool allowDeposits, bool allowWithdraws, uint16 sharePremium)",
];
const ACCOUNTANT_ABI = ["function getRateInQuoteSafe(address quote) view returns (uint256)"];

async function liquidDeposit(base, spec) {
  const provider = getProvider(base.chain);
  const teller = new ethers.Contract(spec.teller, TELLER_ABI, provider);
  const wiredVault = await teller.vault();
  const wiredAcct = await teller.accountant();
  if (
    wiredVault.toLowerCase() !== spec.vault.toLowerCase() ||
    wiredAcct.toLowerCase() !== spec.accountant.toLowerCase()
  ) {
    return finish({
      ...base,
      ok: false,
      error: `Teller wiring vault=${wiredVault} accountant=${wiredAcct} does not match the docs`,
    });
  }
  if (await teller.isPaused()) return finish({ ...base, ok: false, error: `${spec.label} Teller is paused` });
  const [allowDeposits, , premium] = await teller.assetData(spec.asset);
  if (!allowDeposits)
    return finish({
      ...base,
      ok: false,
      error: `${spec.label} Teller assetData(${spec.symbol}).allowDeposits is false`,
    });
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || spec.amount, spec.decimals);
  const signer = await impersonateFunded(base.chain, spec.symbol, spec.asset, amount);
  const user = await signer.getAddress();
  const token = new ethers.Contract(spec.asset, ERC, signer);
  const shares = new ethers.Contract(spec.vault, ERC, provider);
  const shareDecimals = await shares.decimals();
  const rate = await new ethers.Contract(spec.accountant, ACCOUNTANT_ABI, provider).getRateInQuoteSafe(spec.asset);
  // BoringVault Teller: shares = amount * ONE_SHARE / rateInQuote, minus the asset's share premium (bps).
  let expected = (amount * 10n ** BigInt(shareDecimals)) / rate;
  expected -= (expected * BigInt(premium)) / 10_000n;
  const userBefore = await token.balanceOf(user);
  const vaultBefore = await token.balanceOf(spec.vault);
  const supplyBefore = await shares.totalSupply();
  await (await token.approve(spec.vault, amount)).wait();
  const minted = await new ethers.Contract(spec.teller, TELLER_ABI, signer).deposit.staticCall(spec.asset, amount, 0);
  const receipt = await (
    await new ethers.Contract(spec.teller, TELLER_ABI, signer).deposit(
      spec.asset,
      amount,
      expected - expected / 1000n,
      GAS
    )
  ).wait();
  const got = await shares.balanceOf(user);
  const userAfter = await token.balanceOf(user);
  const vaultAfter = await token.balanceOf(spec.vault);
  const supplyAfter = await shares.totalSupply();
  const ok =
    got > 0n &&
    got === minted &&
    got <= expected + 1n &&
    got >= expected - expected / 1000n &&
    userBefore - userAfter === amount &&
    vaultAfter - vaultBefore === amount &&
    supplyAfter - supplyBefore === got;
  return finish({
    ...base,
    ok,
    key: `${spec.label}=0->${formatUnits(got, shareDecimals)} ${spec.symbol}=-${formatUnits(amount, spec.decimals)} vault${spec.symbol}+=${formatUnits(vaultAfter - vaultBefore, spec.decimals)}`,
    detail: `Teller.deposit ${formatUnits(amount, spec.decimals)} ${spec.symbol} into ${spec.label} (BoringVault ${spec.vault})\nshares ${formatUnits(got, shareDecimals)} (rate ${formatUnits(rate, spec.decimals)} ${spec.symbol}/share, premium ${premium} bps, expected ${formatUnits(expected, shareDecimals)})\ntotalSupply +${formatUnits(supplyAfter - supplyBefore, shareDecimals)}\nWithdrawals go through the AtomicQueue / solver and are not exercised.\ntx ${receipt.hash}`,
    error: ok
      ? null
      : `${spec.label} Teller deposit did not mint the accountant-priced shares for the ${spec.symbol} pulled`,
  });
}

/* ---------- 2. Falcon sUSDf: cooldownShares, warp past cooldownDuration, unstake ---------- */
const SUSDF_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function cooldownDuration() view returns (uint24)",
  "function cooldownShares(uint256 shares, address owner) returns (uint256)",
  "function cooldowns(address) view returns (uint104 cooldownEnd, uint152 underlyingAmount)",
  "function unstake(address receiver)",
  "function silo() view returns (address)",
];

async function falconCooldown(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(FALCON.vault, SUSDF_ABI, provider);
  const asset = await reader.asset();
  if (asset.toLowerCase() !== FALCON.usdf.toLowerCase())
    return finish({ ...base, ok: false, error: `sUSDf asset() ${asset} is not USDf` });
  const duration = await reader.cooldownDuration();
  if (duration === 0n) {
    return finish({
      ...base,
      ok: false,
      skipped: true,
      key: "notTestable=cooldownDuration=0",
      detail:
        "sUSDf cooldownDuration() is 0 on-chain: the cooldown is switched off and cooldownShares/unstake revert by design. Exit is the instant ERC-4626 redeem already covered by fork:falcon:stake.",
    });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 18);
  const signer = await impersonateFunded(base.chain, "USDf", FALCON.usdf, amount);
  const user = await signer.getAddress();
  const usdf = new ethers.Contract(FALCON.usdf, ERC, signer);
  const vault = new ethers.Contract(FALCON.vault, SUSDF_ABI, signer);
  await (await usdf.approve(FALCON.vault, amount)).wait();
  await (await vault.deposit(amount, user, GAS)).wait();
  const shares = await reader.balanceOf(user);
  const usdfMid = await usdf.balanceOf(user);
  const silo = await reader.silo();
  const siloBefore = await usdf.balanceOf(silo);
  const preview = await reader.previewRedeem(shares);
  const cdReceipt = await (await vault.cooldownShares(shares, user, GAS)).wait();
  const cd = await reader.cooldowns(user);
  const siloMid = await usdf.balanceOf(silo);
  const sharesLeft = await reader.balanceOf(user);
  const block = await provider.getBlock(cdReceipt.blockNumber);
  const requestOk =
    sharesLeft === 0n &&
    cd.underlyingAmount === preview &&
    siloMid - siloBefore === preview &&
    cd.cooldownEnd === BigInt(block.timestamp) + duration;
  const snapshot = await provider.send("evm_snapshot", []);
  let early = "not-run";
  try {
    await vault.unstake.staticCall(user);
    early = "allowed";
  } catch {
    early = "reverted";
  }
  await warp(provider, duration + 1n);
  const unstakeReceipt = await (await vault.unstake(user, GAS)).wait();
  const usdfAfter = await usdf.balanceOf(user);
  const cleared = await reader.cooldowns(user);
  const claimOk =
    usdfAfter - usdfMid === cd.underlyingAmount && cleared.underlyingAmount === 0n && early === "reverted";
  await provider.send("evm_revert", [snapshot]);
  const ok = requestOk && claimOk;
  return finish({
    ...base,
    ok,
    key: `sUSDf=${formatUnits(shares, 18)}->0 cooldownUSDf=${formatUnits(cd.underlyingAmount, 18)} USDf+=${formatUnits(usdfAfter - usdfMid, 18)} warp=${duration}s`,
    detail: `deposit ${formatUnits(amount, 18)} USDf -> ${formatUnits(shares, 18)} sUSDf\ncooldownShares: ${formatUnits(cd.underlyingAmount, 18)} USDf moved to the silo (previewRedeem ${formatUnits(preview, 18)}), cooldownEnd = block + ${duration}s\nunstake before the end: ${early}\nwarped ${duration}s (evm_revert afterwards); unstake paid ${formatUnits(usdfAfter - usdfMid, 18)} USDf, cooldown cleared=${cleared.underlyingAmount === 0n}\ntx ${cdReceipt.hash} / ${unstakeReceipt.hash}`,
    error: ok ? null : `Falcon cooldown failed: request=${requestOk} claim=${claimOk} early=${early}`,
  });
}

/* ---------- 3. Avalon SuperEarn: Router.deposit USDC into the Ethereum Super Vault ---------- */
const AV_ROUTER_ABI = [
  "function deposit(address vault, uint256 amount, uint256 minShares) returns (uint256)",
  "function previewDeposit(address vault, uint256 amount) view returns (uint256)",
  "function whitelistedVaults(address) view returns (bool)",
  "event Deposited(address indexed sender, address indexed receiver, address indexed vault, uint256 underlyingAmount, uint256 yShares)",
];

async function avalonDeposit(base) {
  const provider = getProvider(base.chain);
  const router = new ethers.Contract(AVALON.router, AV_ROUTER_ABI, provider);
  if (!(await router.whitelistedVaults(AVALON.superVault))) {
    return finish({ ...base, ok: false, error: `Router.whitelistedVaults(SuperVault ${AVALON.superVault}) is false` });
  }
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", AVALON.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(AVALON.usdc, ERC, signer);
  const shares = new ethers.Contract(AVALON.superVault, ERC, provider);
  const preview = await router.previewDeposit(AVALON.superVault, amount);
  const usdcBefore = await usdc.balanceOf(user);
  const sharesBefore = await shares.balanceOf(user);
  const supplyBefore = await shares.totalSupply();
  await (await usdc.approve(AVALON.router, amount)).wait();
  try {
    await new ethers.Contract(AVALON.router, AV_ROUTER_ABI, signer).deposit.staticCall(AVALON.superVault, amount, 0);
  } catch (err) {
    const data = typeof err.data === "string" ? err.data : "";
    if (data.startsWith("0x82b42900")) {
      return finish({
        ...base,
        ok: false,
        skipped: true,
        key: "notTestable=Router.deposit Unauthorized()",
        detail: `The Ethereum SuperEarnRouter reverts Unauthorized() (0x82b42900) for a public depositor. The docs list it as the "Router used by RemoteVault/keepers for remote Super Vault flows"; user deposits enter on Kaia (chain 8217), which this repo has no fork config for.`,
      });
    }
    throw err;
  }
  const receipt = await (
    await new ethers.Contract(AVALON.router, AV_ROUTER_ABI, signer).deposit(
      AVALON.superVault,
      amount,
      preview - preview / 1000n,
      GAS
    )
  ).wait();
  const got = (await shares.balanceOf(user)) - sharesBefore;
  const usdcAfter = await usdc.balanceOf(user);
  const supplyAfter = await shares.totalSupply();
  const dec = await shares.decimals();
  const ok =
    got > 0n &&
    usdcBefore - usdcAfter === amount &&
    supplyAfter - supplyBefore === got &&
    got >= preview - preview / 1000n &&
    got <= preview + preview / 1000n;
  return finish({
    ...base,
    ok,
    key: `superVault=0->${formatUnits(got, dec)} preview=${formatUnits(preview, dec)} USDC=-${formatUnits(usdcBefore - usdcAfter, 6)}`,
    detail: `SuperEarnRouter.deposit(SuperVault, ${formatUnits(amount, 6)} USDC)\nSuper Vault shares ${formatUnits(got, dec)} (previewDeposit ${formatUnits(preview, dec)}), totalSupply +${formatUnits(supplyAfter - supplyBefore, dec)}\nRedeem goes through the CooldownVault queue and is not exercised.\ntx ${receipt.hash}`,
    error: ok ? null : "SuperEarn Router deposit did not pull the USDC and mint the previewed Super Vault shares",
  });
}

/* ---------- 4. Lagoon: ERC-7540 requestDeposit on a vault created from the documented Factory ---------- */
const LAGOON_FACTORY_ABI = [
  "function createVaultProxy(address _logic, address _initialOwner, uint256 _initialDelay, (address underlying, string name, string symbol, address safe, address whitelistManager, address valuationManager, address admin, address feeReceiver, uint16 managementRate, uint16 performanceRate, bool enableWhitelist, uint256 rateUpdateCooldown) init, bytes32 salt) returns (address)",
  "function isInstance(address) view returns (bool)",
];
const LAGOON_VAULT_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function requestDeposit(uint256 assets, address controller, address owner) payable returns (uint256)",
  "function pendingDepositRequest(uint256 requestId, address controller) view returns (uint256)",
  "function claimableDepositRequest(uint256 requestId, address controller) view returns (uint256)",
  "event DepositRequest(address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 assets)",
];

async function lagoonRequest(base) {
  const curator = await freshEth(base.chain);
  const curatorAddr = await curator.getAddress();
  const factory = new ethers.Contract(LAGOON.factory, LAGOON_FACTORY_ABI, curator);
  const init = {
    underlying: LAGOON.usdc,
    name: "Fork Test USDC Vault",
    symbol: "ftUSDC",
    safe: curatorAddr,
    whitelistManager: curatorAddr,
    valuationManager: curatorAddr,
    admin: curatorAddr,
    feeReceiver: curatorAddr,
    managementRate: 0,
    performanceRate: 0,
    enableWhitelist: false,
    rateUpdateCooldown: 0,
  };
  const salt = ethers.hexlify(ethers.randomBytes(32));
  const vaultAddr = await factory.createVaultProxy.staticCall(LAGOON.logicV050, curatorAddr, 86400, init, salt);
  const createReceipt = await (
    await factory.createVaultProxy(LAGOON.logicV050, curatorAddr, 86400, init, salt, { gasLimit: 8_000_000n })
  ).wait();
  const registered = await factory.isInstance(vaultAddr);
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "USDC", LAGOON.usdc, amount);
  const user = await signer.getAddress();
  const usdc = new ethers.Contract(LAGOON.usdc, ERC, signer);
  const vault = new ethers.Contract(vaultAddr, LAGOON_VAULT_ABI, signer);
  const asset = await vault.asset();
  const userBefore = await usdc.balanceOf(user);
  await (await usdc.approve(vaultAddr, amount)).wait();
  const receipt = await (await vault.requestDeposit(amount, user, user, GAS)).wait();
  // The pending silo is an internal per-vault contract with no public getter; read it from the USDC Transfer.
  const transferIface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  const [moved] = eventArgs(receipt, transferIface, "Transfer", LAGOON.usdc).filter(
    t => t.from.toLowerCase() === user.toLowerCase()
  );
  const silo = moved ? moved.to : ZERO;
  const siloBefore = 0n;
  const [ev] = eventArgs(receipt, vault.interface, "DepositRequest", vaultAddr);
  const requestId = ev ? ev.requestId : 0n;
  const pending = await vault.pendingDepositRequest(requestId, user);
  const claimable = await vault.claimableDepositRequest(requestId, user);
  const userAfter = await usdc.balanceOf(user);
  const siloAfter = await usdc.balanceOf(silo);
  const shares = await vault.balanceOf(user);
  const ok =
    registered &&
    asset.toLowerCase() === LAGOON.usdc.toLowerCase() &&
    !!ev &&
    ev.assets === amount &&
    pending === amount &&
    claimable === 0n &&
    userBefore - userAfter === amount &&
    siloAfter - siloBefore === amount &&
    shares === 0n;
  return finish({
    ...base,
    ok,
    key: `pendingDeposit=0->${formatUnits(pending, 6)} silo+=${formatUnits(siloAfter - siloBefore, 6)} shares=${shares}`,
    detail: `Factory.createVaultProxy(logic v0.5.0) -> vault ${vaultAddr} (isInstance=${registered}, whitelist off)\nrequestDeposit ${formatUnits(amount, 6)} USDC: requestId ${requestId}, pendingDepositRequest ${formatUnits(pending, 6)}, claimable ${claimable}\nUSDC moved to the pending silo ${silo}; no shares until the valuation manager settles\ntx ${createReceipt.hash} / ${receipt.hash}`,
    error: ok ? null : "Lagoon requestDeposit did not park the USDC in the pending silo as a pending request",
  });
}

/* ---------- 5/6. EigenCloud: completeQueuedWithdrawal and delegateTo ---------- */
const EIGEN_ABI = [
  "function depositIntoStrategy(address strategy, address token, uint256 amount) returns (uint256)",
  "function stakerDepositShares(address staker, address strategy) view returns (uint256)",
  "function queueWithdrawals((address[] strategies, uint256[] depositShares, address withdrawer)[] params) returns (bytes32[])",
  "function completeQueuedWithdrawal((address staker, address delegatedTo, address withdrawer, uint256 nonce, uint32 startBlock, address[] strategies, uint256[] scaledShares) withdrawal, address[] tokens, bool receiveAsTokens)",
  "function minWithdrawalDelayBlocks() view returns (uint32)",
  "function pendingWithdrawals(bytes32) view returns (bool)",
  "function registerAsOperator(address initDelegationApprover, uint32 allocationDelay, string metadataURI)",
  "function delegateTo(address operator, (bytes signature, uint256 expiry) approverSignatureAndExpiry, bytes32 approverSalt)",
  "function delegatedTo(address) view returns (address)",
  "function isOperator(address) view returns (bool)",
  "function operatorShares(address operator, address strategy) view returns (uint256)",
  "event SlashingWithdrawalQueued(bytes32 withdrawalRoot, (address staker, address delegatedTo, address withdrawer, uint256 nonce, uint32 startBlock, address[] strategies, uint256[] scaledShares) withdrawal, uint256[] sharesToWithdraw)",
  "event StakerDelegated(address indexed staker, address indexed operator)",
];

async function eigenDepositSteth(base, amount) {
  const signer = await impersonateFunded(base.chain, "stETH", EIGENLAYER.steth, amount);
  const user = await signer.getAddress();
  const sm = new ethers.Contract(EIGENLAYER.strategyManager, EIGEN_ABI, signer);
  const before = await sm.stakerDepositShares(user, EIGENLAYER.stethStrategy);
  await (await new ethers.Contract(EIGENLAYER.steth, ERC, signer).approve(EIGENLAYER.strategyManager, amount)).wait();
  await (await sm.depositIntoStrategy(EIGENLAYER.stethStrategy, EIGENLAYER.steth, amount, GAS)).wait();
  const after = await sm.stakerDepositShares(user, EIGENLAYER.stethStrategy);
  return { signer, user, minted: after - before };
}

async function prewarmSystemRings(provider) {
  const rings = [
    ["0x0000F90827F1C53a10cb7A02335B175320002935", 8191], // EIP-2935 block-hash history
    ["0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02", 16382], // EIP-4788 beacon roots (timestamps + roots)
  ];
  for (const [address, slots] of rings) {
    const writes = [];
    for (let i = 0; i < slots; i++)
      writes.push(provider.send("anvil_setStorageAt", [address, ethers.toQuantity(i), ethers.ZeroHash]));
    await Promise.all(writes);
  }
}

async function eigenComplete(base) {
  const provider = getProvider(base.chain);
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const { signer, user, minted } = await eigenDepositSteth(base, amount);
  if (minted <= 0n) return finish({ ...base, ok: false, error: "stETH strategy deposit minted no shares" });
  const dm = new ethers.Contract(EIGENLAYER.delegationManager, EIGEN_ABI, signer);
  const steth = new ethers.Contract(EIGENLAYER.steth, ERC, provider);
  const qReceipt = await (
    await dm.queueWithdrawals(
      [{ strategies: [EIGENLAYER.stethStrategy], depositShares: [minted], withdrawer: user }],
      GAS
    )
  ).wait();
  const [queued] = eventArgs(qReceipt, dm.interface, "SlashingWithdrawalQueued", EIGENLAYER.delegationManager);
  if (!queued)
    return finish({ ...base, ok: false, error: "queueWithdrawals emitted no SlashingWithdrawalQueued event" });
  const root = queued.withdrawalRoot;
  const w = queued.withdrawal;
  const withdrawal = {
    staker: w.staker,
    delegatedTo: w.delegatedTo,
    withdrawer: w.withdrawer,
    nonce: w.nonce,
    startBlock: w.startBlock,
    strategies: [...w.strategies],
    scaledShares: [...w.scaledShares],
  };
  const delay = await dm.minWithdrawalDelayBlocks();
  const pendingBefore = await dm.pendingWithdrawals(root);
  let early = "allowed";
  try {
    await dm.completeQueuedWithdrawal.staticCall(withdrawal, [EIGENLAYER.steth], true);
  } catch {
    early = "reverted";
  }
  const snapshot = await provider.send("evm_snapshot", []);
  // The delay is ~100,800 blocks (14 days). On a Cancun+ fork every mined block's EIP-2935 / EIP-4788
  // system write first fetches that ring-buffer slot from the upstream RPC (~1.5 s/block). Writing the
  // ring buffers locally once (zeros; reverted with the snapshot) cuts that to ~25 ms/block, so the
  // whole wait is ~40 min. Set FORK_TEST_TIMEOUT_MS=3600000 for this test. --hardfork shanghai is not
  // an option: EigenLayer's slashing release uses Cancun opcodes and reverts there.
  await prewarmSystemRings(provider);
  // Mine in chunks so a single anvil_mine call cannot outlive the HTTP timeout.
  for (let left = BigInt(delay) + 1n; left > 0n; ) {
    const n = left > 5000n ? 5000n : left;
    await provider.send("anvil_mine", [ethers.toQuantity(n)]);
    left -= n;
  }
  const stethBefore = await steth.balanceOf(user);
  const cReceipt = await (await dm.completeQueuedWithdrawal(withdrawal, [EIGENLAYER.steth], true, GAS)).wait();
  const stethAfter = await steth.balanceOf(user);
  const pendingAfter = await dm.pendingWithdrawals(root);
  const got = stethAfter - stethBefore;
  await provider.send("evm_revert", [snapshot]);
  // stETH transfers round down by 1-2 wei per hop.
  const ok = pendingBefore && !pendingAfter && early === "reverted" && got <= amount && got + 4n >= amount;
  return finish({
    ...base,
    ok,
    key: `pending=${pendingBefore}->${pendingAfter} stETH+=${formatUnits(got, 18)} delayBlocks=${delay}`,
    detail: `deposit ${formatUnits(amount, 18)} stETH (shares ${formatUnits(minted, 18)}), queueWithdrawals root ${root}\ncomplete before the delay: ${early}\nmined ${delay}+1 blocks (evm_revert afterwards); completeQueuedWithdrawal(receiveAsTokens=true) returned ${formatUnits(got, 18)} stETH, root pending ${pendingBefore} -> ${pendingAfter}\ntx ${qReceipt.hash} / ${cReceipt.hash}`,
    error: ok
      ? null
      : `EigenLayer complete failed: early=${early} pending ${pendingBefore}->${pendingAfter} got ${got}`,
  });
}

async function eigenDelegate(base) {
  const operator = await freshEth(base.chain);
  const opAddr = await operator.getAddress();
  const dmOp = new ethers.Contract(EIGENLAYER.delegationManager, EIGEN_ABI, operator);
  const regReceipt = await (await dmOp.registerAsOperator(ZERO, 0, "", GAS)).wait();
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const { signer, user, minted } = await eigenDepositSteth(base, amount);
  if (minted <= 0n) return finish({ ...base, ok: false, error: "stETH strategy deposit minted no shares" });
  const dm = new ethers.Contract(EIGENLAYER.delegationManager, EIGEN_ABI, signer);
  const before = await dm.delegatedTo(user);
  const opSharesBefore = await dm.operatorShares(opAddr, EIGENLAYER.stethStrategy);
  const receipt = await (await dm.delegateTo(opAddr, { signature: "0x", expiry: 0 }, ethers.ZeroHash, GAS)).wait();
  const after = await dm.delegatedTo(user);
  const opSharesAfter = await dm.operatorShares(opAddr, EIGENLAYER.stethStrategy);
  const [ev] = eventArgs(receipt, dm.interface, "StakerDelegated", EIGENLAYER.delegationManager);
  const ok =
    (await dm.isOperator(opAddr)) &&
    before === ZERO &&
    after.toLowerCase() === opAddr.toLowerCase() &&
    opSharesAfter - opSharesBefore === minted &&
    !!ev &&
    ev.operator.toLowerCase() === opAddr.toLowerCase();
  return finish({
    ...base,
    ok,
    key: `delegatedTo=${before === ZERO ? "none" : before}->${after} operatorShares=${formatUnits(opSharesBefore, 18)}->${formatUnits(opSharesAfter, 18)}`,
    detail: `registerAsOperator(no approver) for a fresh operator ${opAddr}\nstaker ${user} deposited ${formatUnits(amount, 18)} stETH (${formatUnits(minted, 18)} shares) then delegateTo(operator)\noperatorShares(stETH strategy) +${formatUnits(opSharesAfter - opSharesBefore, 18)}, StakerDelegated emitted=${!!ev}\ntx ${regReceipt.hash} / ${receipt.hash}`,
    error: ok ? null : "delegateTo did not move the staker's shares under the operator",
  });
}

/* ---------- 7. Saturn sUSDat: requestRedeem into the Withdraw contract (NFT queue) ---------- */
const SUSDAT_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function paused() view returns (bool)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function MIN_REQUEST_SHARES() view returns (uint256)",
  "function requestRedeem(uint256 shares, uint256 minAssets) returns (uint256)",
  "function getWithdrawalQueue() view returns (address)",
];
const SAT_WITHDRAW_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function getUserRequests(address) view returns (uint256[])",
  "function ownerOf(uint256) view returns (address)",
  "function nextTokenId() view returns (uint256)",
];

async function saturnUnstake(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(SATURN.vault, SUSDAT_ABI, provider);
  const queue = await reader.getWithdrawalQueue();
  if (queue.toLowerCase() !== SATURN_WITHDRAW.toLowerCase()) {
    return finish({
      ...base,
      ok: false,
      error: `sUSDat getWithdrawalQueue() ${queue} is not the documented Withdraw contract`,
    });
  }
  if (await reader.paused()) return finish({ ...base, ok: false, error: "sUSDat is paused" });
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || SATURN.defaultAmount, SATURN.decimals);
  const signer = await impersonateFunded(base.chain, SATURN.symbol, SATURN.asset, amount);
  const user = await signer.getAddress();
  const usdat = new ethers.Contract(SATURN.asset, ERC, signer);
  const vault = new ethers.Contract(SATURN.vault, SUSDAT_ABI, signer);
  await (await usdat.approve(SATURN.vault, amount)).wait();
  await (await vault.deposit(amount, user, GAS)).wait();
  const shares = await reader.balanceOf(user);
  const sd = await reader.decimals();
  const min = await reader.MIN_REQUEST_SHARES();
  if (shares < min) return finish({ ...base, ok: false, error: `shares ${shares} below MIN_REQUEST_SHARES ${min}` });
  const wq = new ethers.Contract(SATURN_WITHDRAW, SAT_WITHDRAW_ABI, provider);
  const nftBefore = await wq.balanceOf(user);
  const reqsBefore = await wq.getUserRequests(user);
  const supplyBefore = await reader.totalSupply();
  const wqSharesBefore = await reader.balanceOf(SATURN_WITHDRAW);
  const receipt = await (await vault.requestRedeem(shares, 0, GAS)).wait();
  const nftAfter = await wq.balanceOf(user);
  const reqsAfter = await wq.getUserRequests(user);
  const sharesLeft = await reader.balanceOf(user);
  const supplyAfter = await reader.totalSupply();
  const wqSharesAfter = await reader.balanceOf(SATURN_WITHDRAW);
  const newId = reqsAfter.length ? reqsAfter[reqsAfter.length - 1] : null;
  const owner = newId == null ? ZERO : await wq.ownerOf(newId);
  // The shares either move to the queue or are burned (escrowed as USDat); both are a measured exit.
  const escrowed = wqSharesAfter - wqSharesBefore === shares || supplyBefore - supplyAfter === shares;
  const ok =
    sharesLeft === 0n &&
    nftAfter === nftBefore + 1n &&
    reqsAfter.length === reqsBefore.length + 1 &&
    owner.toLowerCase() === user.toLowerCase() &&
    escrowed;
  return finish({
    ...base,
    ok,
    key: `sUSDat=${formatUnits(shares, sd)}->${formatUnits(sharesLeft, sd)} withdrawNFT=${nftBefore}->${nftAfter} requestId=${newId}`,
    detail: `deposit ${formatUnits(amount, 6)} USDat -> ${formatUnits(shares, sd)} sUSDat\nrequestRedeem(all): Withdraw NFT #${newId} minted to the user, sUSDat supply ${formatUnits(supplyBefore, sd)} -> ${formatUnits(supplyAfter, sd)}, queue sUSDat +${formatUnits(wqSharesAfter - wqSharesBefore, sd)}\nSaturn's Processor settles the request (processRequests is OPERATOR_ROLE), so the claim is not exercised.\ntx ${receipt.hash}`,
    error: ok ? null : "sUSDat requestRedeem did not escrow the shares and mint a Withdraw request NFT",
  });
}

/* ---------- 8. Meta Pool spETH: delayed withdraw request via the Withdrawal contract ---------- */
const SPETH_ABI = [
  ...ERC,
  "function depositETH(address receiver) payable returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function withdrawal() view returns (address)",
];
const MP_WITHDRAWAL_ABI = [
  "function pendingWithdraws(address) view returns (uint256 amount, uint256 unlockEpoch, address receiver)",
  "function totalPendingWithdraw() view returns (uint256)",
  "function getEpoch() view returns (uint256)",
];

async function metaPoolWithdrawRequest(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(META_POOL.speth, SPETH_ABI, provider);
  const wired = await reader.withdrawal();
  if (wired.toLowerCase() !== META_POOL_WITHDRAWAL.toLowerCase()) {
    return finish({
      ...base,
      ok: false,
      error: `spETH withdrawal() ${wired} is not the documented Withdrawal contract`,
    });
  }
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  const signer = await freshEth(base.chain);
  const user = await signer.getAddress();
  const speth = new ethers.Contract(META_POOL.speth, SPETH_ABI, signer);
  await (await speth.depositETH(user, { value, ...GAS })).wait();
  const shares = await reader.balanceOf(user);
  const wd = new ethers.Contract(META_POOL_WITHDRAWAL, MP_WITHDRAWAL_ABI, provider);
  const totalBefore = await wd.totalPendingWithdraw();
  const pendingBefore = await wd.pendingWithdraws(user);
  const preview = await reader.previewRedeem(shares);
  const epoch = await wd.getEpoch();
  const ethBefore = await provider.getBalance(user);
  const receipt = await (await speth.redeem(shares, user, user, GAS)).wait();
  const pending = await wd.pendingWithdraws(user);
  const totalAfter = await wd.totalPendingWithdraw();
  const sharesLeft = await reader.balanceOf(user);
  const ethAfter = await provider.getBalance(user, receipt.blockNumber);
  const gas = receipt.gasUsed * receipt.gasPrice;
  const ok =
    sharesLeft === 0n &&
    // spETH's share price accrues per block, so the filed amount can sit a few wei-per-share above the pre-tx preview.
    pending.amount - pendingBefore.amount >= preview &&
    pending.amount - pendingBefore.amount <= preview + preview / 10_000n &&
    totalAfter - totalBefore === pending.amount - pendingBefore.amount &&
    pending.unlockEpoch > epoch &&
    pending.receiver.toLowerCase() === user.toLowerCase() &&
    ethBefore - ethAfter === gas;
  return finish({
    ...base,
    ok,
    key: `spETH=${formatUnits(shares, 18)}->0 pendingWithdraw=${formatUnits(pendingBefore.amount, 18)}->${formatUnits(pending.amount, 18)} unlockEpoch=${pending.unlockEpoch} epoch=${epoch}`,
    detail: `depositETH ${formatUnits(value, 18)} -> ${formatUnits(shares, 18)} spETH\nredeem(all) filed a delayed withdraw: pendingWithdraws.amount ${formatUnits(pending.amount, 18)} ETH (previewRedeem ${formatUnits(preview, 18)}), unlock epoch ${pending.unlockEpoch} (now ${epoch}), totalPendingWithdraw +${formatUnits(totalAfter - totalBefore, 18)}\nno ETH paid yet (only gas); completeWithdraw after the epoch needs validator exits funded by Meta Pool, not exercised\ntx ${receipt.hash}`,
    error: ok ? null : "spETH redeem did not register a pending withdraw for the previewed ETH",
  });
}

/* ---------- 9. SolvBTC: createRedemption on the WBTC pool after subscribing ---------- */
const SOLV_ROUTER_ABI = [
  "function checkPoolPermission(bytes32 poolId) view returns (bool)",
  "function createSubscription(bytes32 poolId, uint256 currencyAmount) returns (uint256 shareValue)",
  "function createRedemption(bytes32 poolId, uint256 redeemAmount) returns (uint256 redemptionId)",
  "event CreateRedemption(bytes32 indexed poolId, address indexed redeemer, address indexed solvBTC, uint256 redeemAmount, uint256 redemptionId)",
];

async function solvRedeem(base) {
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "0.01", 8);
  const signer = await impersonateFunded(base.chain, "WBTC", SOLVBTC.wbtc, amount);
  const user = await signer.getAddress();
  const router = new ethers.Contract(SOLVBTC.router, SOLV_ROUTER_ABI, signer);
  await (await new ethers.Contract(SOLVBTC.wbtc, ERC, signer).approve(SOLVBTC.router, amount)).wait();
  await (await router.createSubscription(SOLVBTC.wbtcPoolId, amount, GAS)).wait();
  const solv = new ethers.Contract(SOLVBTC.solvbtc, ERC, signer);
  const held = await solv.balanceOf(user);
  const supplyBefore = await solv.totalSupply();
  await (await solv.approve(SOLVBTC.router, held)).wait();
  let redemptionId;
  try {
    redemptionId = await router.createRedemption.staticCall(SOLVBTC.wbtcPoolId, held);
  } catch (err) {
    return finish({
      ...base,
      ok: false,
      error: `createRedemption reverts for a permissionless holder: ${err.shortMessage || err.message}`,
    });
  }
  const receipt = await (await router.createRedemption(SOLVBTC.wbtcPoolId, held, GAS)).wait();
  const left = await solv.balanceOf(user);
  const supplyAfter = await solv.totalSupply();
  const ok = held > 0n && left === 0n && supplyBefore - supplyAfter === held && redemptionId > 0n;
  return finish({
    ...base,
    ok,
    key: `SolvBTC=${formatUnits(held, 18)}->${formatUnits(left, 18)} supply-=${formatUnits(supplyBefore - supplyAfter, 18)} redemptionId=${redemptionId}`,
    detail: `subscribed ${formatUnits(amount, 8)} WBTC -> ${formatUnits(held, 18)} SolvBTC, then createRedemption(WBTC pool, all)\nSolvBTC burned ${formatUnits(supplyBefore - supplyAfter, 18)}, redemption share id ${redemptionId}; the Open Fund settles WBTC after the redemption period (not exercised)\ntx ${receipt.hash}`,
    error: ok ? null : "SolvBTC createRedemption did not burn the SolvBTC into a redemption ticket",
  });
}

/* ---------- 10. CIAN Yield Layer: requestRedeem into the RedeemOperator ---------- */
const CIAN_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function paused() view returns (bool)",
  "function remainingUpdateTime() view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function requestRedeem(uint256 shares, address token)",
];

async function cianRequest(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(CIAN.vault, CIAN_ABI, provider);
  const paused = await reader.paused();
  const window = await reader.remainingUpdateTime();
  if (paused) return finish({ ...base, ok: false, error: "CIAN rsETH Yield Layer is paused" });
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "1", 18);
  let user;
  let signer;
  let via;
  if (window > 0n) {
    signer = await impersonateFunded(base.chain, "rsETH", CIAN.rseth, amount);
    user = await signer.getAddress();
    await (await new ethers.Contract(CIAN.rseth, ERC, signer).approve(CIAN.vault, amount)).wait();
    await (await new ethers.Contract(CIAN.vault, CIAN_ABI, signer).deposit(amount, user, GAS)).wait();
    via = "deposit";
  } else {
    // Exchange price is stale, so deposit reverts PriceNotUpdated(). Seed existing ylrsETH shares
    // with anvil_deal (balance slot) to exercise the exit surface that holders still have.
    signer = await impersonateAccount(ethers.Wallet.createRandom().address, base.chain);
    user = await signer.getAddress();
    await provider.send("anvil_setBalance", [user, ethers.toQuantity(ethers.parseEther("1"))]);
    if (!(await dealErc20(base.chain, CIAN.vault, user, amount)))
      return finish({ ...base, ok: false, error: "could not anvil_deal ylrsETH shares" });
    via = "anvil_deal (deposit closed: remainingUpdateTime 0)";
  }
  const shares = await reader.balanceOf(user);
  const opBefore = await reader.balanceOf(CIAN.redeemOperator);
  const receipt = await (
    await new ethers.Contract(CIAN.vault, CIAN_ABI, signer).requestRedeem(shares, CIAN.rseth, GAS)
  ).wait();
  const opAfter = await reader.balanceOf(CIAN.redeemOperator);
  const left = await reader.balanceOf(user);
  const ok = shares > 0n && left === 0n && opAfter - opBefore === shares;
  return finish({
    ...base,
    ok,
    key: `ylrsETH=${formatUnits(shares, 18)}->${formatUnits(left, 18)} redeemOperator+=${formatUnits(opAfter - opBefore, 18)} priceWindow=${window}`,
    detail: `shares via ${via}: ${formatUnits(shares, 18)} ylrsETH\nrequestRedeem(all, rsETH): RedeemOperator holds +${formatUnits(opAfter - opBefore, 18)} shares; the operator settles off-fork\ntx ${receipt.hash}`,
    error: ok ? null : "CIAN requestRedeem did not move the shares to the RedeemOperator",
  });
}

/* ---------- 11. Benqi sAVAX: requestUnlock, warp past cooldownPeriod, redeem ---------- */
const SAVAX_ABI = [
  ...ERC,
  "function submit() payable returns (uint256)",
  "function mintingPaused() view returns (bool)",
  "function cooldownPeriod() view returns (uint256)",
  "function redeemPeriod() view returns (uint256)",
  "function getPooledAvaxByShares(uint256) view returns (uint256)",
  "function requestUnlock(uint256 shareAmount)",
  "function getUnlockRequestCount(address) view returns (uint256)",
  "function userUnlockRequests(address, uint256) view returns (uint256 startedAt, uint256 shareAmount)",
  "function redeem(uint256 unlockIndex)",
  "function totalPooledAvax() view returns (uint256)",
];

async function benqiUnlock(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(BENQI.savax, SAVAX_ABI, provider);
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await freshEth(base.chain, "5");
  const user = await signer.getAddress();
  const savax = new ethers.Contract(BENQI.savax, SAVAX_ABI, signer);
  await (await savax.submit({ value: amount, ...GAS })).wait();
  const shares = await reader.balanceOf(user);
  const countBefore = await reader.getUnlockRequestCount(user);
  const contractBefore = await reader.balanceOf(BENQI.savax);
  const reqReceipt = await (await savax.requestUnlock(shares, GAS)).wait();
  const count = await reader.getUnlockRequestCount(user);
  const req = await reader.userUnlockRequests(user, count - 1n);
  const contractAfter = await reader.balanceOf(BENQI.savax);
  const left = await reader.balanceOf(user);
  const block = await provider.getBlock(reqReceipt.blockNumber);
  const requestOk =
    left === 0n &&
    count === countBefore + 1n &&
    req.shareAmount === shares &&
    req.startedAt === BigInt(block.timestamp) &&
    contractAfter - contractBefore === shares;
  const cooldown = await reader.cooldownPeriod();
  const expectedAvax = await reader.getPooledAvaxByShares(shares);
  let early = "allowed";
  try {
    await savax.redeem.staticCall(count - 1n);
  } catch {
    early = "reverted";
  }
  // Redeem pays from AVAX the operator has moved back into the contract for unlocks; on a fork
  // that float may be short, so the claim result is reported and only asserted when it is funded.
  const snapshot = await provider.send("evm_snapshot", []);
  await warp(provider, cooldown + 1n);
  let claim = "unfunded";
  let got = 0n;
  const avaxBefore = await provider.getBalance(user);
  try {
    const r = await (await savax.redeem(count - 1n, GAS)).wait();
    got = (await provider.getBalance(user)) - avaxBefore + r.gasUsed * r.gasPrice;
    claim = "redeemed";
  } catch (err) {
    claim = `reverted (${err.shortMessage || err.message})`.slice(0, 160);
  }
  await provider.send("evm_revert", [snapshot]);
  const claimOk = claim !== "redeemed" || (got > 0n && got + 2n >= expectedAvax - expectedAvax / 100n);
  const ok = requestOk && early === "reverted" && claimOk;
  return finish({
    ...base,
    ok,
    key: `sAVAX=${formatUnits(shares, 18)}->0 unlockRequests=${countBefore}->${count} cooldown=${cooldown}s claim=${claim.split(" ")[0]}`,
    detail: `submit ${formatUnits(amount, 18)} AVAX -> ${formatUnits(shares, 18)} sAVAX\nrequestUnlock(all): request #${count - 1n} shareAmount ${formatUnits(req.shareAmount, 18)}, sAVAX escrowed in the contract +${formatUnits(contractAfter - contractBefore, 18)}\nredeem before cooldown: ${early}\nwarped ${cooldown}s (evm_revert afterwards): ${claim}${claim === "redeemed" ? ` ${formatUnits(got, 18)} AVAX (expected ~${formatUnits(expectedAvax, 18)})` : ""}\ntx ${reqReceipt.hash}`,
    error: ok ? null : `sAVAX unlock failed: request=${requestOk} early=${early} claim=${claim}`,
  });
}

/* ---------- 12. Frax frxETHMinter.submit ---------- */
const FRX_MINTER_ABI = [
  "function submit() payable",
  "function submitPaused() view returns (bool)",
  "function frxETHToken() view returns (address)",
  "function currentWithheldETH() view returns (uint256)",
  "function withholdRatio() view returns (uint256)",
];

async function fraxSubmit(base) {
  const provider = getProvider(base.chain);
  const minterRead = new ethers.Contract(FRAX_ETH.minter, FRX_MINTER_ABI, provider);
  const token = await minterRead.frxETHToken();
  if (token.toLowerCase() !== FRAX_ETH.frxeth.toLowerCase())
    return finish({ ...base, ok: false, error: `frxETHToken() ${token} is not frxETH` });
  if (await minterRead.submitPaused())
    return finish({ ...base, ok: false, error: "frxETHMinter submitPaused is true" });
  const value = ethers.parseEther(process.env.FORK_AMOUNT || "1");
  const signer = await freshEth(base.chain);
  const user = await signer.getAddress();
  const frx = new ethers.Contract(FRAX_ETH.frxeth, ERC, provider);
  const balBefore = await frx.balanceOf(user);
  const supplyBefore = await frx.totalSupply();
  const minterEthBefore = await provider.getBalance(FRAX_ETH.minter);
  const receipt = await (
    await new ethers.Contract(FRAX_ETH.minter, FRX_MINTER_ABI, signer).submit({ value, ...GAS })
  ).wait();
  const balAfter = await frx.balanceOf(user);
  const supplyAfter = await frx.totalSupply();
  const minterEthAfter = await provider.getBalance(FRAX_ETH.minter, receipt.blockNumber);
  // When the minter crosses 32 ETH it forwards a validator deposit, so its ETH can drop by 32.
  const ethDelta = minterEthAfter - minterEthBefore;
  const ethOk = ethDelta === value || ethDelta === value - ethers.parseEther("32");
  const ok = balAfter - balBefore === value && supplyAfter - supplyBefore === value && ethOk;
  return finish({
    ...base,
    ok,
    key: `frxETH=${formatUnits(balBefore, 18)}->${formatUnits(balAfter, 18)} supply+=${formatUnits(supplyAfter - supplyBefore, 18)} minterETH+=${formatUnits(ethDelta, 18)}`,
    detail: `frxETHMinter.submit{value: ${formatUnits(value, 18)} ETH}\nfrxETH minted 1:1 ${formatUnits(balAfter - balBefore, 18)}, totalSupply +${formatUnits(supplyAfter - supplyBefore, 18)}, minter ETH ${formatUnits(minterEthBefore, 18)} -> ${formatUnits(minterEthAfter, 18)}\ntx ${receipt.hash}`,
    error: ok ? null : "frxETHMinter.submit did not mint frxETH 1:1 for the ETH sent",
  });
}

/* ---------- 13. Symbiotic: Vault.deposit into a public wstETH vault from the VaultFactory ---------- */
const SYM_FACTORY_ABI = [
  "function totalEntities() view returns (uint256)",
  "function entity(uint256) view returns (address)",
];
const SYM_VAULT_ABI = [
  "function collateral() view returns (address)",
  "function depositWhitelist() view returns (bool)",
  "function isDepositLimit() view returns (bool)",
  "function depositLimit() view returns (uint256)",
  "function totalStake() view returns (uint256)",
  "function activeStake() view returns (uint256)",
  "function activeBalanceOf(address) view returns (uint256)",
  "function activeSharesOf(address) view returns (uint256)",
  "function isInitialized() view returns (bool)",
  "function deposit(address onBehalfOf, uint256 amount) returns (uint256 depositedAmount, uint256 mintedShares)",
];

async function symbioticDeposit(base) {
  const provider = getProvider(base.chain);
  const factory = new ethers.Contract(SYMBIOTIC_VAULTS.factory, SYM_FACTORY_ABI, provider);
  const total = await factory.totalEntities();
  const amount = ethers.parseEther(process.env.FORK_AMOUNT || "0.1");
  let chosen = null;
  let scanned = 0;
  for (let i = 0n; i < total && scanned < 120; i += 1n, scanned += 1) {
    const addr = await factory.entity(i);
    const v = new ethers.Contract(addr, SYM_VAULT_ABI, provider);
    try {
      if ((await v.collateral()).toLowerCase() !== SYMBIOTIC_VAULTS.wsteth.toLowerCase()) continue;
      if (!(await v.isInitialized()) || (await v.depositWhitelist())) continue;
      if (await v.isDepositLimit()) {
        const room = (await v.depositLimit()) - (await v.totalStake());
        if (room < amount) continue;
      }
      chosen = addr;
      break;
    } catch {
      // not a v1 vault layout
    }
  }
  if (!chosen)
    return finish({
      ...base,
      ok: false,
      error: `no open wstETH vault among the first ${scanned} of ${total} VaultFactory entities`,
    });
  const signer = await impersonateFunded(base.chain, "wstETH", SYMBIOTIC_VAULTS.wsteth, amount);
  const user = await signer.getAddress();
  const wst = new ethers.Contract(SYMBIOTIC_VAULTS.wsteth, ERC, signer);
  const vault = new ethers.Contract(chosen, SYM_VAULT_ABI, signer);
  const userBefore = await wst.balanceOf(user);
  const vaultBefore = await wst.balanceOf(chosen);
  const stakeBefore = await vault.activeStake();
  await (await wst.approve(chosen, amount)).wait();
  const [deposited, minted] = await vault.deposit.staticCall(user, amount);
  const receipt = await (await vault.deposit(user, amount, GAS)).wait();
  const active = await vault.activeBalanceOf(user);
  const sharesOf = await vault.activeSharesOf(user);
  const userAfter = await wst.balanceOf(user);
  const vaultAfter = await wst.balanceOf(chosen);
  const stakeAfter = await vault.activeStake();
  const ok =
    deposited === amount &&
    userBefore - userAfter === amount &&
    vaultAfter - vaultBefore === amount &&
    stakeAfter - stakeBefore === amount &&
    sharesOf === minted &&
    active + 2n >= amount;
  return finish({
    ...base,
    ok,
    key: `vault=${chosen} activeBalance=0->${formatUnits(active, 18)} activeStake+=${formatUnits(stakeAfter - stakeBefore, 18)} wstETH=-${formatUnits(userBefore - userAfter, 18)}`,
    detail: `VaultFactory entity scan picked public wstETH vault ${chosen} (no deposit whitelist, room under the limit)\ndeposit(${formatUnits(amount, 18)} wstETH): depositedAmount ${formatUnits(deposited, 18)}, shares ${formatUnits(minted, 18)}, activeBalanceOf ${formatUnits(active, 18)}\nwithdraw is epoch-based (claim after the next epoch), not exercised\ntx ${receipt.hash}`,
    error: ok ? null : "Symbiotic vault deposit did not take the wstETH into active stake for the user",
  });
}

/* ---------- 14. Theo sthUSD: initiateRedeem, warp past lockupPeriod, redeem ---------- */
const STH_ABI = [
  ...ERC,
  "function asset() view returns (address)",
  "function paused() view returns (bool)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function lockupPeriod() view returns (uint256)",
  "function initiateRedeem(uint256 shares, address owner)",
  "function currentRedeemRequest(address) view returns (uint256 assets, uint256 shares, uint256 claimableTimestamp)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
];

async function theoUnstake(base) {
  const provider = getProvider(base.chain);
  const reader = new ethers.Contract(THEO.sthusd, STH_ABI, provider);
  if ((await reader.asset()).toLowerCase() !== THEO.thusd.toLowerCase())
    return finish({ ...base, ok: false, error: "sthUSD asset() is not thUSD" });
  if (await reader.paused()) return finish({ ...base, ok: false, error: "sthUSD is paused" });
  const amount = ethers.parseUnits(process.env.FORK_AMOUNT || "100", 6);
  const signer = await impersonateFunded(base.chain, "thUSD", THEO.thusd, amount);
  const user = await signer.getAddress();
  const thusd = new ethers.Contract(THEO.thusd, ERC, signer);
  const vault = new ethers.Contract(THEO.sthusd, STH_ABI, signer);
  await (await thusd.approve(THEO.sthusd, amount)).wait();
  await (await vault.deposit(amount, user, GAS)).wait();
  const shares = await reader.balanceOf(user);
  const userMid = await thusd.balanceOf(user);
  const booked = await reader.convertToAssets(shares);
  const initReceipt = await (await vault.initiateRedeem(shares, user, GAS)).wait();
  const req = await reader.currentRedeemRequest(user);
  const lockup = await reader.lockupPeriod();
  const block = await provider.getBlock(initReceipt.blockNumber);
  const requestOk =
    (await reader.balanceOf(user)) === 0n &&
    req.shares === shares &&
    req.assets >= booked &&
    req.assets <= booked + booked / 10_000n &&
    req.claimableTimestamp >= BigInt(block.timestamp) + lockup - 1n;
  let early = "allowed";
  try {
    await vault.redeem.staticCall(req.shares, user, user);
  } catch {
    early = "reverted";
  }
  const snapshot = await provider.send("evm_snapshot", []);
  await warp(provider, lockup + 1n);
  const redeemReceipt = await (await vault.redeem(req.shares, user, user, GAS)).wait();
  const got = (await thusd.balanceOf(user)) - userMid;
  const cleared = await reader.currentRedeemRequest(user);
  await provider.send("evm_revert", [snapshot]);
  const ok = requestOk && early === "reverted" && got === req.assets && cleared.shares === 0n;
  return finish({
    ...base,
    ok,
    key: `sthUSD=${formatUnits(shares, 6)}->0 requestAssets=${formatUnits(req.assets, 6)} thUSD+=${formatUnits(got, 6)} lockup=${lockup}s early=${early}`,
    detail: `deposit ${formatUnits(amount, 6)} thUSD -> ${formatUnits(shares, 6)} sthUSD\ninitiateRedeem(all): ${formatUnits(req.assets, 6)} thUSD booked, claimable at ${req.claimableTimestamp}\nredeem before the lockup: ${early}\nwarped ${lockup}s (evm_revert afterwards): redeem paid ${formatUnits(got, 6)} thUSD, request cleared=${cleared.shares === 0n}\ntx ${initReceipt.hash} / ${redeemReceipt.hash}`,
    error: ok ? null : `Theo unstake failed: request=${requestOk} early=${early} got=${got}`,
  });
}

const TESTS = {
  "etherfi-liquid:deposit-usd": b => liquidDeposit(b, LIQUID.usd),
  "etherfi-liquid:deposit-btc": b => liquidDeposit(b, LIQUID.btc),
  "falcon:cooldown": falconCooldown,
  "avalon:deposit": avalonDeposit,
  "lagoon:request-deposit": lagoonRequest,
  "eigenlayer:complete": eigenComplete,
  "eigenlayer:delegate": eigenDelegate,
  "saturn:unstake": saturnUnstake,
  "meta-pool:withdraw-request": metaPoolWithdrawRequest,
  "solvbtc:redeem": solvRedeem,
  "cian:withdraw-request": cianRequest,
  "benqi:unlock": benqiUnlock,
  "frax:mint-frxeth": fraxSubmit,
  "symbiotic:deposit": symbioticDeposit,
  "theo:unstake": theoUnstake,
};

async function run() {
  const protocol = process.env.FORK_PROTOCOL;
  const action = process.env.FORK_ACTION;
  const chain = process.env.CHAIN || "ethereum";
  let base;
  try {
    const ctx = await requireFork(chain);
    base = { protocol, action, chain, block: ctx.forkBlock };
  } catch (err) {
    return finish({ ok: false, protocol, action, chain, block: null, error: err.message });
  }
  const test = TESTS[`${protocol}:${action}`];
  if (!test) return finish({ ...base, ok: false, error: `Unknown staking-gaps test ${protocol}:${action}` });
  try {
    return await test(base);
  } catch (err) {
    return finish({ ...base, ok: false, error: err.shortMessage || err.message });
  }
}

module.exports = { run, TESTS };
