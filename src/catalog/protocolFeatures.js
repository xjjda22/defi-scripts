/**
 * Feature x test matrix: every public, permissionless feature of each protocol the repo
 * covers, mapped to the fork:* / simulate:* scripts that exercise it on a local Anvil fork.
 *
 * Source of truth for docs/08-feature-test-gaps.md and data/feature-gaps.json
 * (`npm run coverage:features`). `npm run coverage:features:check` (also run by
 * catalog:check) fails when:
 *   - a pinned forkable row (data/coverage-snapshot.json) has no entry here,
 *   - a referenced script is missing from package.json,
 *   - a fork:* script is referenced by no feature,
 *   - the generated JSON or doc is stale.
 *
 * Feature status:
 *   t(...scripts)  tested: `direct` (or `failing-paused` when every script is in forkStatus PAUSED)
 *   l(script, why) linked: another product's test covers it
 *   g(note)        gap: permissionless and forkable, no test yet (the playground backlog)
 *   n(reason)      not-testable on an Anvil fork, with the reason
 *
 * Features come from each protocol's official docs (listed per entry). `key` is the
 * showcase row id (rank is read from showcase/data.json); `catalog:*` keys are catalog
 * protocols with fork tests that are not in the current top 200.
 */

const t = (...scripts) => ({ kind: "tested", scripts });
const l = (script, why) => ({ kind: "linked", scripts: [script], note: why });
const g = note => ({ kind: "gap", note });
const n = reason => ({ kind: "not-testable", note: reason });

const DECISION_HL = "Recorded decision: Hyperliquid Bridge perps fork coverage closed.";
const DECISION_TC = "Recorded decision: Tornado Cash is skipped.";
const OFFCHAIN_FILL = "Filled by off-chain solvers/relayers; the destination leg never lands on a single-chain fork.";
const KYC = "Permissioned: KYC/whitelist gate on mint and redeem.";
const NOT_EVM = "Settles on a non-EVM chain that Anvil cannot fork.";

const P = [
  // ---- top-50 ------------------------------------------------------------------------
  { key: "layerzero-v2", name: "LayerZero V2", docs: "https://docs.layerzero.network/v2", features: {
    "send message (OApp/OFT send)": t("fork:layerzero:send"),
    "quote fee": t("fork:layerzero:send"),
    "receive / lzReceive": n("Executed by DVNs and the executor on the destination chain; needs a signed packet."),
  } },
  { key: "aave", name: "Aave", docs: "https://aave.com/docs/developers/smart-contracts/pool", features: {
    supply: t("fork:aave:supply"), borrow: t("fork:aave:borrow"), repay: t("fork:aave:repay"), withdraw: t("fork:aave:withdraw"),
    liquidate: t("simulate:aave:liquidations"),
    "flash loan": g("Pool.flashLoanSimple with a receiver contract deployed on the fork."),
    "set collateral / e-mode": g("setUserUseReserveAsCollateral and setUserEMode on a supplied position."),
    "stake AAVE (Umbrella/stkAAVE)": g("stkAAVE stake + cooldown."),
  } },
  { key: "sparklend", name: "SparkLend", docs: "https://docs.spark.fi/dev/sparklend", features: {
    supply: t("fork:spark:supply"), borrow: t("fork:spark:borrow"), repay: t("fork:spark:repay"), withdraw: t("fork:spark:withdraw"),
    liquidate: g("Aave-fork liquidationCall on a price-shocked position."),
    "flash loan": g("Pool.flashLoanSimple."),
  } },
  { key: "morpho", name: "Morpho", docs: "https://docs.morpho.org/build/borrow/concepts", features: {
    supply: t("fork:morpho:supply"), borrow: t("fork:morpho:borrow"),
    "repay + withdraw collateral": t("fork:morpho:repay"), "withdraw (lender)": t("fork:morpho:withdraw"),
    "MetaMorpho vault deposit": l("fork:steakhouse:deposit", "Curated MetaMorpho vault deposit."),
    liquidate: g("Morpho.liquidate after an oracle price override on the fork."),
    "flash loan": g("Morpho.flashLoan with a callback contract."),
  } },
  { key: "lido", name: "Lido", docs: "https://docs.lido.fi/contracts/lido", features: {
    "stake ETH (submit)": t("fork:lido:submit"), "wrap stETH -> wstETH": t("fork:lido:wrap"),
    "request withdrawal (unstETH)": t("fork:lido:request"),
    "claim withdrawal": n("Needs an oracle report to finalize the request; finalize() is role-gated."),
    "unwrap wstETH": t("fork:lido:unwrap"),
  } },
  { key: "sentora-curator", name: "Sentora Curator", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:sentora:deposit"), "vault withdraw/redeem": g("maxDeposit=0 on 2026-11-02, so fork:sentora:deposit runs as a read; redeem needs shares from an open vault or a whale."),
  } },
  { key: "veda", name: "Veda", docs: "https://docs.veda.tech", features: {
    "Teller deposit": t("fork:veda:deposit"),
    "withdraw request (AtomicQueue)": g("AtomicQueue.updateAtomicRequest; solver fill is off-chain."),
  } },
  { key: "hyperliquid-bridge", name: "Hyperliquid Bridge", docs: "https://hyperliquid.gitbook.io", features: {
    "bridge deposit": n(DECISION_HL), "bridge withdraw": n(DECISION_HL),
  } },
  { key: "ccip", name: "CCIP", docs: "https://docs.chain.link/ccip", features: {
    "ccipSend (token/message)": t("fork:ccip:send"), "getFee quote": t("fork:ccip:send"),
    "receive on destination": n("Executed by the Chainlink DON on the destination chain."),
  } },
  { key: "steakhouse-financial", name: "Steakhouse Financial", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:steakhouse:deposit"), "vault withdraw/redeem": t("fork:steakhouse:deposit"),
  } },
  { key: "maple", name: "Maple", docs: "https://docs.maple.finance", features: {
    "syrup deposit": n("Permissioned: syrupUSDC deposits need an allowlisted account (Maple permission manager)."),
    "withdraw request": n("Permissioned and processed by the pool delegate."),
  } },
  { key: "re", name: "Re", docs: "https://docs.re.xyz", features: { "mint / redeem": n(KYC) } },
  { key: "unit", name: "Unit", docs: "https://docs.hyperunit.xyz", features: { "bridge deposit / withdraw": n("MPC/TSS guardian custody; BTC/ETH/SOL legs settle off-EVM.") } },
  { key: "ethena", name: "Ethena", docs: "https://docs.ethena.fi/solution-design/staking-usde", features: {
    "stake USDe -> sUSDe": t("fork:ethena:stake"), "start cooldown": t("fork:ethena:cooldown"),
    "unstake after cooldown": t("fork:ethena:unstake"),
    "mint / redeem USDe": n("Whitelisted minters only (EthenaMinting requires signed RFQ orders)."),
  } },
  { key: "rockawayx", name: "RockawayX", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:rockawayx:deposit"), "vault withdraw/redeem": t("fork:rockawayx:deposit"),
  } },
  { key: "tornado-cash", name: "Tornado Cash", docs: "https://docs.tornado.ws", features: { "deposit / withdraw": n(DECISION_TC) } },
  { key: "plume-vaults", name: "Plume Vaults", docs: "https://docs.plume.org", features: { "vault deposit": n("Compliance-gated (allowlist).") } },
  { key: "nonce-capital", name: "Nonce Capital", docs: "https://docs.veda.tech", features: {
    "vault deposit": l("fork:veda:deposit", "Curator of ether.fi Liquid vaults; uses the Veda Teller."),
  } },
  { key: "lighter-bridge", name: "Lighter Bridge", docs: "https://docs.lighter.xyz", features: {
    "bridge deposit": t("fork:lighter-bridge:deposit"), "withdraw": n("Released by the Lighter zk-rollup proof on L1."),
  } },
  { key: "hyperithm", name: "Hyperithm", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:hyperithm:deposit"), "vault withdraw/redeem": t("fork:hyperithm:deposit"),
  } },
  { key: "upshift", name: "Upshift", docs: "https://docs.upshift.finance", features: {
    "vault deposit": t("fork:upshift:deposit"), "redeem (instant or request)": t("fork:upshift:deposit"),
  } },
  { key: "robinhood-chain-bridge", name: "Robinhood Chain Bridge", docs: "https://docs.robinhood.com/chain", features: {
    "L1 -> L2 deposit": t("fork:robinhood:deposit"), "L2 -> L1 withdraw": n("Needs the L2 fork and a finalized output proof."),
  } },
  { key: "concrete", name: "Concrete", docs: "https://docs.concrete.xyz", features: {
    "vault deposit": t("fork:concrete:deposit"), "vault withdraw": n("Epoch withdrawal queue processed about weekly by the operator."),
  } },
  { key: "polygon-bridge", name: "Polygon Bridge", docs: "https://docs.polygon.technology/pos/how-to/bridging", features: {
    "L1 -> PoS deposit": t("fork:polygon:deposit"), "PoS -> L1 exit": n("Needs a checkpointed burn proof."),
  } },
  { key: "gauntlet", name: "Gauntlet", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:gauntlet:deposit"), "vault withdraw/redeem": t("fork:gauntlet:deposit"),
  } },
  { key: "defi-saver-asset-management", name: "Defi Saver Asset Management", docs: "https://docs.defisaver.com", features: {
    "automation / recipes": g("DSProxy recipe executor over Aave/Maker positions; needs the recipe encoder."),
  } },
  { key: "curve-finance--lending", name: "Curve Finance (Lending)", docs: "https://docs.curve.finance/lending/overview", features: {
    "lend (vault deposit)": t("fork:llamalend:deposit"), "lend withdraw/redeem": t("fork:llamalend:deposit"),
    "create loan (borrow)": g("LlamaLend Controller.create_loan."),
    "repay": g("Controller.repay."),
    "liquidate": g("Controller.liquidate on a soft-liquidated band after price override."),
  } },
  { key: "world-chain-bridge", name: "World Chain Bridge", docs: "https://docs.world.org/world-chain", features: {
    "L1 -> L2 deposit": t("fork:world-chain:deposit"), "L2 -> L1 withdraw": n("OP Stack proof + 7-day window on the L2 fork."),
  } },
  { key: "coinbase-wrapped-staked-eth", name: "Coinbase Wrapped Staked ETH", docs: "https://www.coinbase.com/cbeth", features: {
    "exchange rate read": t("fork:cbeth:rate"), "mint / redeem cbETH": n("Coinbase-only minter."),
  } },
  { key: "binance-staked-eth", name: "Binance staked ETH", docs: "https://www.binance.com/en/wbeth", features: {
    "deposit ETH -> wBETH": t("fork:wbeth:deposit"), "redeem": n("Redeemed through Binance (custodial)."),
  } },
  { key: "aera", name: "Aera", docs: "https://docs.aera.finance", features: {
    "deposit request": t("fork:aera:request"), "solver fill / withdraw": n("Filled by the Aera solver (role-gated)."),
  } },
  { key: "lista-liquid-staking", name: "Lista Liquid Staking", docs: "https://docs.bsc.lista.org", features: {
    "stake BNB -> slisBNB": t("fork:lista:stake"), "request unstake": g("StakeManager.requestWithdraw on the BSC fork."),
  } },
  { key: "huma", name: "Huma", docs: "https://docs.huma.finance", features: { "deposit": n("Primary TVL on Solana; EVM pools are allowlisted.") } },
  // ---- 51-100 ------------------------------------------------------------------------
  { key: "pancakeswap--dex", name: "PancakeSwap (DEX)", docs: "https://docs.pancakeswap.finance/developers/smart-contracts", features: {
    "swap (V3)": t("fork:pancakeswap:v3"), "swap (V2)": g("V2 router swap on the BSC fork."),
    "add liquidity (V3 NFT)": g("NonfungiblePositionManager.mint."), "remove liquidity": g("decreaseLiquidity + collect."),
    "stake CAKE / farm": g("MasterChef v3 deposit of the position NFT."),
  } },
  { key: "clearstar", name: "Clearstar", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:clearstar:deposit"), "vault withdraw/redeem": t("fork:clearstar:deposit"),
  } },
  { key: "near-intents", name: "NEAR Intents", docs: "https://docs.near-intents.org", features: { "intent swap": n(NOT_EVM + " (NEAR verifier).") } },
  { key: "etherfi-borrowing-market", name: "EtherFi Borrowing Market", docs: "https://etherfi.gitbook.io/cash", features: {
    "supply": t("fork:etherfi-cash:supply"), "borrow": n("Borrowing is per Cash card account (UserSafe, owner-signed)."),
  } },
  { key: "lista-dao--lending", name: "Lista DAO (Lending)", docs: "https://docs.bsc.lista.org", features: {
    "vault deposit": t("fork:lista-dao:deposit"), "vault redeem": t("fork:lista-dao:deposit"), "borrow": g("Lista Moolah borrow (Morpho-fork) on BSC."),
  } },
  { key: "etherfi-cash-liquid", name: "EtherFi Cash Liquid", docs: "https://etherfi.gitbook.io/cash", features: {
    "supply": t("fork:etherfi-cash:supply"),
  } },
  { key: "zama", name: "Zama", docs: "https://docs.zama.ai/protocol", features: {
    "wrap to confidential token": t("fork:zama:wrap"), "unwrap / decrypt": n("Needs the Zama KMS/gateway decryption off-chain."),
  } },
  { key: "optimism-bridge", name: "Optimism Bridge", docs: "https://docs.optimism.io/app-developers/bridging/standard-bridge", features: {
    "L1 -> L2 deposit": t("fork:optimism:deposit"), "L2 -> L1 withdraw": n("Proof + 7-day challenge window on the L2 fork."),
  } },
  { key: "near-bridge", name: "NEAR Bridge", docs: "https://docs.near.org", features: {
    "lock on Ethereum": t("fork:near-bridge:deposit"), "unlock": n(NOT_EVM),
  } },
  { key: "opentrade", name: "OpenTrade", docs: "https://docs.opentrade.io", features: { "subscribe / redeem": n(KYC) } },
  { key: "stakewise-v3", name: "StakeWise V3", docs: "https://docs.stakewise.io", features: {
    "vault deposit (osETH)": t("fork:stakewise:deposit"), "mint osETH": g("Vault.mintOsToken against the staked position."),
    "exit queue": g("enterExitQueue."),
  } },
  { key: "avalon-superearn", name: "Avalon Superearn", docs: "https://docs.avalonfinance.xyz", features: { "vault deposit": g("Ethereum vault deposit; contract address not yet verified against docs.") } },
  { key: "base-bridge", name: "Base Bridge", docs: "https://docs.base.org/chain/bridges", features: {
    "L1 -> L2 deposit": t("fork:base:deposit"), "L2 -> L1 withdraw": n("Proof + challenge window on the L2 fork."),
  } },
  { key: "falcon-finance", name: "Falcon Finance", docs: "https://docs.falcon.finance", features: {
    "stake USDf -> sUSDf": t("fork:falcon:stake"), "mint USDf": n(KYC), "unstake cooldown": g("sUSDf cooldown + time warp."),
  } },
  { key: "starknet-bridge", name: "Starknet Bridge", docs: "https://docs.starknet.io", features: {
    "L1 deposit": t("fork:starknet:deposit"), "withdraw": n("Cairo VM on L2 (not EVM)."),
  } },
  { key: "uniswap--dex", name: "Uniswap (DEX)", docs: "https://docs.uniswap.org/contracts", features: {
    "swap V2": t("fork:uniswap:v2"), "swap V3": t("fork:uniswap:v3"), "swap V4": t("fork:uniswap:v4"),
    "quote (all versions)": t("simulate:dex:uniswap:v3"),
    "UniswapX fill": t("simulate:uniswapx:fill"),
    "add liquidity V2": g("Router02.addLiquidity, assert LP tokens."),
    "add liquidity V3 (mint NFT)": g("NonfungiblePositionManager.mint."),
    "remove liquidity V3": g("decreaseLiquidity + collect."),
    "add liquidity V4": g("PositionManager.modifyLiquidities."),
  } },
  { key: "cooler-loans", name: "Cooler Loans", docs: "https://docs.olympusdao.finance", features: {
    "borrow against gOHM": t("fork:cooler:borrow"), "repay": g("MonoCooler.repay."),
  } },
  { key: "compound-finance", name: "Compound Finance", docs: "https://docs.compound.finance", features: {
    "supply": t("fork:compound:supply"), "borrow": t("fork:compound:borrow"),
    "repay": t("fork:compound:repay"), "withdraw": t("fork:compound:withdraw"),
    "absorb (liquidate)": g("Comet.absorb on an underwater account after an oracle override."),
    "buyCollateral": g("Comet.buyCollateral when reserves are below target."),
    "claim COMP rewards": g("CometRewards.claim after time warp."),
  } },
  { key: "galaxy-curation", name: "Galaxy Curation", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:galaxy:deposit"), "vault withdraw/redeem": t("fork:galaxy:deposit"),
  } },
  { key: "ether.fi-liquid", name: "ether.fi Liquid", docs: "https://etherfi.gitbook.io", features: {
    "Liquid ETH deposit": l("fork:veda:deposit", "Same Veda Teller recipe."),
    "Liquid USD / BTC deposit": g("Teller deposit into the USD and BTC BoringVaults."),
  } },
  { key: "dolomite", name: "Dolomite", docs: "https://docs.dolomite.io", features: {
    "supply": t("fork:dolomite:supply"), "borrow": n("Markets closing since 2026-11-02 (getMarketIsClosing=true)."),
  } },
  { key: "curvance", name: "Curvance", docs: "https://docs.curvance.com", features: {
    "deposit": t("fork:curvance:deposit"), "redeem": t("fork:curvance:deposit"), "borrow": g("Monad market borrow."),
  } },
  { key: "fluid-lite", name: "Fluid Lite", docs: "https://docs.fluid.instadapp.io", features: {
    "vault deposit": t("fork:fluid-lite:deposit"), "withdraw/redeem (net of fee)": t("fork:fluid-lite:deposit"),
  } },
  { key: "kpk", name: "KPK", docs: "https://docs.morpho.org", features: {
    "vault deposit": t("fork:kpk:deposit"), "withdraw/redeem": t("fork:kpk:deposit"),
  } },
  // ---- 101-200 -----------------------------------------------------------------------
  { key: "obol", name: "Obol", docs: "https://docs.obol.org", features: { "create DV cluster": n("Distributed validator setup needs validator keys and the beacon chain.") } },
  { key: "arbitrum-bridge", name: "Arbitrum Bridge", docs: "https://docs.arbitrum.io/build-decentralized-apps/token-bridging", features: {
    "L1 -> L2 deposit": t("fork:arbitrum:deposit"), "L2 -> L1 withdraw": n("Outbox proof + 7-day window on the L2 fork."),
  } },
  { key: "fx-protocol", name: "fx Protocol", docs: "https://docs.aladdin.club/f-x-protocol", features: {
    "mint fxUSD / open position": g("PoolManager operate()."), "stability pool deposit": g("fxUSD stability pool deposit."),
  } },
  { key: "eigencloud", name: "EigenCloud", docs: "https://docs.eigenlayer.xyz", features: {
    "deposit LST into strategy": t("fork:eigenlayer:deposit"), "queue withdrawal": t("fork:eigenlayer:queue"),
    "complete withdrawal": g("completeQueuedWithdrawal after time warp past the delay."),
    "delegate to operator": g("DelegationManager.delegateTo."),
  } },
  { key: "meth-protocol", name: "mETH Protocol", docs: "https://docs.mantle.xyz/meth", features: {
    "stake ETH -> mETH": t("fork:meth:stake"), "unstake request": g("Staking.unstakeRequest."),
  } },
  { key: "rsk-bridge", name: "RSK Bridge", docs: "https://dev.rootstock.io", features: { "peg in / out": n(NOT_EVM + " (Bitcoin leg).") } },
  { key: "spark--vaults", name: "Spark (Vaults)", docs: "https://docs.spark.fi", features: {
    "vault deposit": t("fork:spark-vaults:deposit"), "withdraw/redeem": t("fork:spark-vaults:deposit"),
  } },
  { key: "meta-pool", name: "Meta Pool", docs: "https://docs.metapool.app", features: {
    "deposit ETH -> mpETH": t("fork:meta-pool:deposit"), "withdraw request": g("Withdrawal contract requestWithdraw."),
  } },
  { key: "bedrock-unibtc", name: "Bedrock uniBTC", docs: "https://docs.bedrock.technology", features: { "mint uniBTC from WBTC": g("Vault.mint with WBTC on Ethereum.") } },
  { key: "saturn", name: "Saturn", docs: "https://saturncredit.gitbook.io/saturn-docs", features: {
    "stake USDat": t("fork:saturn:stake"), "unstake": g("Unstake / cooldown."),
  } },
  { key: "maker", name: "Sky", docs: "https://developers.sky.money", features: {
    "DAI <-> USDS convert": t("fork:sky:convert"), "sUSDS deposit": t("fork:sky:susds"), "sDAI deposit": t("fork:sky:sdai"),
    "sUSDS withdraw": g("ERC-4626 redeem."), "PSM swap (USDC <-> USDS)": g("LitePSM sellGem/buyGem."),
    "open vault / draw USDS": g("Sky Lockstake or ilk vault."),
  } },
  { key: "ether.fi-stake", name: "ether.fi Stake", docs: "https://etherfi.gitbook.io", features: {
    "deposit ETH -> eETH": t("fork:etherfi:deposit"), "wrap eETH -> weETH": t("fork:etherfi:wrap"),
    "request withdrawal": g("LiquidityPool.requestWithdraw (WithdrawRequestNFT)."),
  } },
  { key: "lagoon", name: "Lagoon", docs: "https://docs.lagoon.finance", features: { "ERC-7540 deposit request": g("requestDeposit on a Lagoon vault.") } },
  { key: "usdt0", name: "USDT0", docs: "https://docs.usdt0.to", features: {
    "OFT send": t("fork:usdt0:send"), "receive": n("Executed by LayerZero on the destination chain."),
  } },
  { key: "usdd", name: "USDD", docs: "https://docs.usdd.io", features: { "PSM / mint": g("Ethereum PSM swap; main TVL on Tron (not forkable).") } },
  { key: "liquity", name: "Liquity", docs: "https://docs.liquity.org", features: {
    "stability pool deposit": t("fork:liquity:deposit"), "open trove": g("BorrowerOperations.openTrove."),
    "redeem": g("redeemCollateral."), "liquidate": g("liquidate after price override."),
  } },
  { key: "avant-protocol", name: "Avant Protocol", docs: "https://docs.avantprotocol.com", features: { "stake avUSD": g("Avalanche/Ethereum staking vault.") } },
  { key: "solv-protocol--stable-rwa", name: "Solv Protocol (Stablecoin)", docs: "https://docs.solv.finance", features: { "subscribe": g("BSC vault subscribe.") } },
  { key: "theo", name: "Theo", docs: "https://docs.theo.xyz", features: { "stake": t("fork:theo:stake"), "unstake": g("Unstake / redeem.") } },
  { key: "cian-yield-layer", name: "CIAN Yield Layer", docs: "https://docs.cian.app", features: { "vault deposit": t("fork:cian:deposit"), "withdraw request": g("requestRedeem.") } },
  { key: "polymarket", name: "Polymarket", docs: "https://docs.polymarket.com", features: {
    "split / merge positions (CTF)": g("ConditionalTokens splitPosition on Polygon."),
    "trade": n("CLOB orders are matched off-chain by the operator; exploited 2026-10."),
  } },
  { key: "ssv-network", name: "SSV Network", docs: "https://docs.ssv.network", features: { "register validator": n("Needs validator keyshares from the SSV operator set.") } },
  { key: "solvbtc", name: "SolvBTC", docs: "https://docs.solv.finance", features: { "subscribe": t("fork:solvbtc:subscribe"), "redeem": g("Redemption request.") } },
  { key: "portal", name: "Portal", docs: "https://docs.wormhole.com", features: {
    "token transfer out": t("fork:portal:transfer"), "redeem on destination": n("Needs a guardian-signed VAA."),
  } },
  { key: "venus-core-pool", name: "Venus Core Pool", docs: "https://docs-v4.venus.io", features: {
    "supply": t("fork:venus:supply"), "borrow": g("vToken.borrow on BSC."), "repay": g("repayBorrow."), "redeem": g("redeemUnderlying."),
  } },
  { key: "curve-dex", name: "Curve DEX", docs: "https://docs.curve.finance", features: {
    "swap": t("fork:curve:swap"), "quote": t("simulate:dex:curve"),
    "add liquidity": g("pool.add_liquidity, assert LP."), "remove liquidity": g("remove_liquidity_one_coin."),
    "gauge deposit": g("LiquidityGauge.deposit."),
  } },
  { key: "convex-finance", name: "Convex Finance", docs: "https://docs.convexfinance.com", features: { "deposit / stake": t("fork:convex:deposit"), "claim rewards": g("getReward after time warp.") } },
  { key: "fluid-dex", name: "Fluid DEX", docs: "https://docs.fluid.instadapp.io", features: { "swap": g("FluidDexT1.swapIn on Ethereum.") } },
  { key: "avalanche-core-bridge", name: "Avalanche Core Bridge", docs: "https://core.app/bridge", features: { "bridge": n("Intel SGX warden custody; releases signed off-chain.") } },
  { key: "astherus--bridge-chain", name: "Aster (Bridge)", docs: "https://docs.asterdex.com", features: { "deposit": g("Aster deposit vault on BSC.") } },
  { key: "railgun", name: "Railgun", docs: "https://docs.railgun.org", features: { "shield": g("RailgunSmartWallet.shield (needs a note commitment)."), "unshield": n("Needs a zk proof generated off-chain.") } },
  { key: "bitfi-basis", name: "BitFi Basis", docs: "https://docs.bitfi.org", features: { "deposit": g("Basis vault deposit on BSC.") } },
  { key: "benqi-staked-avax", name: "Benqi Staked Avax", docs: "https://docs.benqi.fi", features: { "stake AVAX -> sAVAX": t("fork:benqi:stake"), "request unlock": g("requestUnlock + cooldown.") } },
  { key: "pendle-v2", name: "Pendle V2", docs: "https://docs.pendle.finance", features: {
    "markets read": t("simulate:eth:pendle-markets:smoke"),
    "mint PT/YT": g("Router mintPyFromToken."), "swap PT": g("Router swapExactTokenForPt."), "add liquidity": g("addLiquiditySingleToken."),
  } },
  { key: "rocket-pool", name: "Rocket Pool", docs: "https://docs.rocketpool.net", features: { "deposit ETH -> rETH": t("fork:rocketpool:deposit"), "burn rETH": g("rETH.burn against deposit pool liquidity.") } },
  { key: "liquid-collective", name: "Liquid Collective", docs: "https://docs.liquidcollective.io", features: { "deposit": n(KYC) } },
  { key: "fluid-lending", name: "Fluid Lending", docs: "https://docs.fluid.instadapp.io", features: { "fToken deposit": g("fUSDC ERC-4626 deposit."), "vault borrow": g("Fluid vault operate().") } },
  { key: "yearn", name: "Yearn", docs: "https://docs.yearn.fi", features: { "vault deposit": t("fork:yearn:deposit"), "withdraw/redeem": t("fork:yearn:deposit") } },
  { key: "aero-protocol--dex", name: "Aero (DEX)", docs: "https://aerodrome.finance/docs", features: {
    "swap (Aerodrome)": t("fork:aerodrome:swap"), "swap (Velodrome)": t("fork:velodrome:swap"),
    "add liquidity": g("Router.addLiquidity."), "gauge stake": g("Gauge.deposit."), "lock AERO (veNFT)": g("VotingEscrow.createLock."),
  } },
  { key: "mellow-core", name: "Mellow Core", docs: "https://docs.mellow.finance", features: { "vault deposit": g("Mellow vault deposit on Ethereum.") } },
  { key: "usd-ai", name: "USD AI", docs: "https://docs.usd.ai", features: { "stake USDai": t("fork:usdai:stake"), "mint USDai": g("USDai mint from USDC on Arbitrum.") } },
  { key: "gmx--perps", name: "GMX (Perps)", docs: "https://docs.gmx.io", features: {
    "market read": t("fork:gmx:read"), "open/close position": n("Two-step: keeper executes the order with signed oracle prices."),
    "GM deposit": n("Keeper-executed deposit with signed prices."),
  } },
  { key: "sosovalue-indexes", name: "SoSoValue Indexes", docs: "https://sosovalue.com", features: { "mint index": n("Mint through the issuer (custodial basket).") } },
  // ---- pinned rows not in the current build ------------------------------------------
  { key: "armitage-by-wintermute", name: "Armitage by Wintermute", docs: "https://wintermute.com", features: { "vault deposit": n("Permissioned institutional vault.") } },
  { key: "rysk-v12", name: "Rysk V12", docs: "https://docs.rysk.finance", features: { "options trade": g("HyperEVM/Arbitrum options; chain not configured.") } },
  { key: "axelar", name: "Axelar", docs: "https://docs.axelar.dev", features: { "callContract / sendToken": g("Gateway.sendToken / ITS interchainTransfer on Ethereum.") } },
  { key: "xdai-stake-bridge", name: "xDai Stake Bridge", docs: "https://docs.gnosischain.com", features: { "relay tokens": g("Omnibridge relayTokens on Ethereum.") } },
  { key: "lyra", name: "Lyra / Derive", docs: "https://docs.derive.xyz", features: { "deposit": g("Socket bridge deposit to Derive chain.") } },
  { key: "benqi-lending", name: "Benqi Lending", docs: "https://docs.benqi.fi", features: { "supply": t("fork:benqi:supply"), "borrow": g("qiToken.borrow on Avalanche."), "redeem": g("redeemUnderlying.") } },
  // ---- catalog protocols with fork tests, outside the current top 200 -----------------
  { key: "catalog:sushiswap", name: "SushiSwap", docs: "https://docs.sushi.com", features: { "swap V2": t("fork:sushiswap:v2"), "swap V3": t("fork:sushiswap:v3"), "add liquidity": g("Router addLiquidity.") } },
  { key: "catalog:balancer", name: "Balancer", docs: "https://docs.balancer.fi", features: { "swap": t("fork:balancer:swap"), "join pool": g("Vault.joinPool / V3 addLiquidity.") } },
  { key: "catalog:monad-v3", name: "Uniswap V3 on Monad", docs: "https://docs.uniswap.org", features: { "swap": t("fork:monad:v3") } },
  { key: "catalog:kelp", name: "Kelp DAO", docs: "https://kelp.gitbook.io", features: { "deposit ETH -> rsETH": t("fork:kelp:deposit"), "withdraw request": g("LRTWithdrawalManager.initiateWithdrawal.") } },
  { key: "catalog:renzo", name: "Renzo", docs: "https://docs.renzoprotocol.com", features: { "deposit ETH -> ezETH": t("fork:renzo:deposit"), "withdraw request": g("WithdrawQueue.withdraw.") } },
  { key: "catalog:symbiotic", name: "Symbiotic", docs: "https://docs.symbiotic.fi", features: { "vault read": t("fork:symbiotic:read"), "vault deposit": g("Vault.deposit.") } },
  { key: "catalog:swell", name: "Swell", docs: "https://docs.swellnetwork.io", features: { "deposit ETH -> swETH": t("fork:swell:deposit") } },
  { key: "catalog:puffer", name: "Puffer", docs: "https://docs.puffer.fi", features: { "deposit ETH -> pufETH": t("fork:puffer:deposit") } },
  { key: "catalog:frax", name: "Frax", docs: "https://docs.frax.finance", features: { "sfrxETH rate": t("fork:frax:rate"), "mint frxETH": g("frxETHMinter.submit.") } },
  { key: "catalog:buidl", name: "BlackRock BUIDL", docs: "https://securitize.io", features: { "read": t("fork:buidl:read"), "subscribe": n(KYC) } },
  { key: "catalog:ondo", name: "Ondo", docs: "https://docs.ondo.finance", features: { "rate read": t("fork:ondo:rate"), "mint / redeem": n(KYC) } },
  { key: "catalog:superstate", name: "Superstate", docs: "https://docs.superstate.co", features: { "NAV read": t("fork:superstate:nav"), "subscribe": n(KYC) } },
  { key: "catalog:circle", name: "Circle USDC", docs: "https://developers.circle.com", features: { "transfer": t("fork:circle:transfer"), "mint / redeem": n("Circle-only minters.") } },
  { key: "catalog:tether", name: "Tether USDT", docs: "https://tether.to", features: { "transfer": t("fork:tether:transfer"), "mint / redeem": n("Tether-only issuer.") } },
  { key: "catalog:across", name: "Across", docs: "https://docs.across.to", features: { "deposit (origin)": t("fork:across:deposit"), "fill (destination)": n(OFFCHAIN_FILL) } },
  { key: "catalog:stargate", name: "Stargate", docs: "https://stargateprotocol.gitbook.io", features: { "quote": t("fork:stargate:quote"), "deposit / send": t("fork:stargate:deposit") } },
  { key: "catalog:euler", name: "Euler", docs: "https://docs.euler.finance", features: { "vault deposit": t("fork:euler:deposit"), "vault redeem": t("fork:euler:deposit"), "borrow (EVC)": g("EVC enableController + borrow.") } },
  { key: "catalog:concentrator", name: "Concentrator", docs: "https://docs.aladdin.club", features: { "vault deposit": t("fork:concentrator:deposit"), "vault redeem": t("fork:concentrator:deposit") } },
  { key: "catalog:stakelink", name: "stake.link", docs: "https://docs.stake.link", features: { "stake LINK": t("fork:stakelink:deposit") } },
  { key: "catalog:ember", name: "Ember", docs: "https://docs.ember.so", features: { "deposit + queued exit": t("fork:ember:deposit") } },
  { key: "catalog:vesper", name: "Vesper", docs: "https://docs.vesper.finance", features: { "deposit + queued exit": t("fork:vesper:deposit") } },
];

module.exports = { PROTOCOL_FEATURES: P };
