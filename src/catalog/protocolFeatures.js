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
// No open gaps after the 2026-11-06 batch; keep the helper for the next one.
// eslint-disable-next-line no-unused-vars
const g = note => ({ kind: "gap", note });
const n = reason => ({ kind: "not-testable", note: reason });

const OFFCHAIN_FILL = "Filled by off-chain solvers/relayers; the destination leg never lands on a single-chain fork.";
const KYC = "Permissioned: KYC/whitelist gate on mint and redeem.";
const NOT_EVM = "Settles on a non-EVM chain that Anvil cannot fork.";

const P = [
  // ---- top-50 ------------------------------------------------------------------------
  {
    key: "layerzero-v2",
    name: "LayerZero V2",
    docs: "https://docs.layerzero.network/v2",
    features: {
      "send message (OApp/OFT send)": t("fork:layerzero:send"),
      "quote fee": t("fork:layerzero:send"),
      "receive / lzReceive": n("Executed by DVNs and the executor on the destination chain; needs a signed packet."),
    },
  },
  {
    key: "aave",
    name: "Aave",
    docs: "https://aave.com/docs/developers/smart-contracts/pool",
    features: {
      supply: t("fork:aave:supply"),
      borrow: t("fork:aave:borrow"),
      repay: t("fork:aave:repay"),
      withdraw: t("fork:aave:withdraw"),
      liquidate: t("simulate:aave:liquidations"),
      "flash loan": t("fork:aave:flashloan"),
      "set collateral / e-mode": t("fork:aave:emode"),
      "stake AAVE (Umbrella/stkAAVE)": t("fork:aave:stake"),
    },
  },
  {
    key: "sparklend",
    name: "SparkLend",
    docs: "https://docs.spark.fi/dev/sparklend",
    features: {
      supply: t("fork:spark:supply"),
      borrow: t("fork:spark:borrow"),
      repay: t("fork:spark:repay"),
      withdraw: t("fork:spark:withdraw"),
      liquidate: t("fork:spark:liquidate"),
      "flash loan": t("fork:spark:flashloan"),
    },
  },
  {
    key: "morpho",
    name: "Morpho",
    docs: "https://docs.morpho.org/build/borrow/concepts",
    features: {
      supply: t("fork:morpho:supply"),
      borrow: t("fork:morpho:borrow"),
      "repay + withdraw collateral": t("fork:morpho:repay"),
      "withdraw (lender)": t("fork:morpho:withdraw"),
      "MetaMorpho vault deposit": l("fork:steakhouse:deposit", "Curated MetaMorpho vault deposit."),
      liquidate: t("fork:morpho:liquidate"),
      "flash loan": t("fork:morpho:flashloan"),
    },
  },
  {
    key: "lido",
    name: "Lido",
    docs: "https://docs.lido.fi/contracts/lido",
    features: {
      "stake ETH (submit)": t("fork:lido:submit"),
      "wrap stETH -> wstETH": t("fork:lido:wrap"),
      "request withdrawal (unstETH)": t("fork:lido:request"),
      "claim withdrawal": n("Needs an oracle report to finalize the request; finalize() is role-gated."),
      "unwrap wstETH": t("fork:lido:unwrap"),
    },
  },
  {
    key: "sentora-curator",
    name: "Sentora Curator",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:sentora:deposit"),
      "vault withdraw/redeem": t("fork:sentora:deposit"),
    },
  },
  {
    key: "veda",
    name: "Veda",
    docs: "https://docs.veda.tech",
    features: {
      "Teller deposit": t("fork:veda:deposit"),
      "withdraw request (BoringOnChainQueue)": t("fork:veda:request"),
    },
  },
  {
    key: "hyperliquid-bridge",
    name: "Hyperliquid Bridge",
    docs: "https://hyperliquid.gitbook.io",
    features: {
      "bridge deposit": t("fork:hyperliquid-bridge:deposit"),
      "bridge withdraw": n(
        "Withdrawals are validated on HyperCore and released by the L1 validators; only the Arbitrum escrow leg is forkable."
      ),
    },
  },
  {
    key: "ccip",
    name: "CCIP",
    docs: "https://docs.chain.link/ccip",
    features: {
      "ccipSend (token/message)": t("fork:ccip:send"),
      "getFee quote": t("fork:ccip:send"),
      "receive on destination": n("Executed by the Chainlink DON on the destination chain."),
    },
  },
  {
    key: "steakhouse-financial",
    name: "Steakhouse Financial",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:steakhouse:deposit"),
      "vault withdraw/redeem": t("fork:steakhouse:deposit"),
    },
  },
  {
    key: "maple",
    name: "Maple",
    docs: "https://docs.maple.finance",
    features: {
      "syrup deposit": n("Permissioned: syrupUSDC deposits need an allowlisted account (Maple permission manager)."),
      "withdraw request": n("Permissioned and processed by the pool delegate."),
    },
  },
  { key: "re", name: "Re", docs: "https://docs.re.xyz", features: { "mint / redeem": n(KYC) } },
  {
    key: "unit",
    name: "Unit",
    docs: "https://docs.hyperunit.xyz",
    features: { "bridge deposit / withdraw": n("MPC/TSS guardian custody; BTC/ETH/SOL legs settle off-EVM.") },
  },
  {
    key: "ethena",
    name: "Ethena",
    docs: "https://docs.ethena.fi/solution-design/staking-usde",
    features: {
      "stake USDe -> sUSDe": t("fork:ethena:stake"),
      "start cooldown": t("fork:ethena:cooldown"),
      "unstake after cooldown": t("fork:ethena:unstake"),
      "mint / redeem USDe": n("Whitelisted minters only (EthenaMinting requires signed RFQ orders)."),
    },
  },
  {
    key: "rockawayx",
    name: "RockawayX",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:rockawayx:deposit"),
      "vault withdraw/redeem": t("fork:rockawayx:deposit"),
    },
  },
  {
    key: "tornado-cash",
    name: "Tornado Cash",
    docs: "https://docs.tornado.ws",
    features: {
      deposit: t("fork:tornado-cash:deposit"),
      withdraw: n("Needs the secret/nullifier preimage behind the commitment; the deposit test discards it by design."),
    },
  },
  {
    key: "plume-vaults",
    name: "Plume Vaults",
    docs: "https://docs.plume.org",
    features: { "vault deposit": n("Compliance-gated (allowlist).") },
  },
  {
    key: "grove-finance",
    name: "Grove Finance",
    docs: "https://docs.grove.finance",
    features: {
      "vault deposit (Grove x Steakhouse USDC)": t("fork:grove:deposit"),
      "allocator doCall / controller actions": n("RELAYER/CONTROLLER-only; no permissionless entry point."),
    },
  },
  {
    key: "nonce-capital",
    name: "Nonce Capital",
    docs: "https://docs.veda.tech",
    features: {
      "vault deposit": l("fork:veda:deposit", "Curator of ether.fi Liquid vaults; uses the Veda Teller."),
    },
  },
  {
    key: "lighter-bridge",
    name: "Lighter Bridge",
    docs: "https://docs.lighter.xyz",
    features: {
      "bridge deposit": t("fork:lighter-bridge:deposit"),
      withdraw: n("Released by the Lighter zk-rollup proof on L1."),
    },
  },
  {
    key: "hyperithm",
    name: "Hyperithm",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:hyperithm:deposit"),
      "vault withdraw/redeem": t("fork:hyperithm:deposit"),
    },
  },
  {
    key: "upshift",
    name: "Upshift",
    docs: "https://docs.upshift.finance",
    features: {
      "vault deposit": t("fork:upshift:deposit"),
      "redeem (instant or request)": t("fork:upshift:deposit"),
    },
  },
  {
    key: "robinhood-chain-bridge",
    name: "Robinhood Chain Bridge",
    docs: "https://docs.robinhood.com/chain",
    features: {
      "L1 -> L2 deposit": t("fork:robinhood:deposit"),
      "L2 -> L1 withdraw": n("Needs the L2 fork and a finalized output proof."),
    },
  },
  {
    key: "concrete",
    name: "Concrete",
    docs: "https://docs.concrete.xyz",
    features: {
      "vault deposit": t("fork:concrete:deposit"),
      "vault withdraw": n("Epoch withdrawal queue processed about weekly by the operator."),
    },
  },
  {
    key: "polygon-bridge",
    name: "Polygon Bridge",
    docs: "https://docs.polygon.technology/pos/how-to/bridging",
    features: {
      "L1 -> PoS deposit": t("fork:polygon:deposit"),
      "PoS -> L1 exit": n("Needs a checkpointed burn proof."),
    },
  },
  {
    key: "tether",
    name: "Tether",
    docs: "https://tether.to",
    features: { transfer: t("fork:tether:transfer"), "mint / redeem": n("Tether-only issuer.") },
  },
  {
    key: "ondo-finance",
    name: "Ondo Finance",
    docs: "https://docs.ondo.finance",
    features: { "rate read": t("fork:ondo:rate"), "mint / redeem": n(KYC) },
  },
  {
    key: "gauntlet",
    name: "Gauntlet",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:gauntlet:deposit"),
      "vault withdraw/redeem": t("fork:gauntlet:deposit"),
    },
  },
  {
    key: "defi-saver-asset-management",
    name: "Defi Saver Asset Management",
    docs: "https://docs.defisaver.com",
    features: {
      "automation / recipes": t("fork:defisaver:recipe"),
    },
  },
  {
    key: "curve-finance--lending",
    name: "Curve Finance (Lending)",
    docs: "https://docs.curve.finance/lending/overview",
    features: {
      "lend (vault deposit)": t("fork:llamalend:deposit"),
      "lend withdraw/redeem": t("fork:llamalend:deposit"),
      "create loan (borrow)": t("fork:llamalend:borrow"),
      repay: t("fork:llamalend:repay"),
      liquidate: t("fork:llamalend:liquidate"),
    },
  },
  {
    key: "world-chain-bridge",
    name: "World Chain Bridge",
    docs: "https://docs.world.org/world-chain",
    features: {
      "L1 -> L2 deposit": t("fork:world-chain:deposit"),
      "L2 -> L1 withdraw": n("OP Stack proof + 7-day window on the L2 fork."),
    },
  },
  {
    key: "coinbase-wrapped-staked-eth",
    name: "Coinbase Wrapped Staked ETH",
    docs: "https://www.coinbase.com/cbeth",
    features: {
      "exchange rate read": t("fork:cbeth:rate"),
      "mint / redeem cbETH": n("Coinbase-only minter."),
    },
  },
  {
    key: "binance-staked-eth",
    name: "Binance staked ETH",
    docs: "https://www.binance.com/en/wbeth",
    features: {
      "deposit ETH -> wBETH": t("fork:wbeth:deposit"),
      redeem: n("Redeemed through Binance (custodial)."),
    },
  },
  {
    key: "aera",
    name: "Aera",
    docs: "https://docs.aera.finance",
    features: {
      "deposit request": t("fork:aera:request"),
      "solver fill / withdraw": n("Filled by the Aera solver (role-gated)."),
    },
  },
  {
    key: "lista-liquid-staking",
    name: "Lista Liquid Staking",
    docs: "https://docs.bsc.lista.org",
    features: {
      "stake BNB -> slisBNB": t("fork:lista:stake"),
      "request unstake": t("fork:lista:unstake"),
    },
  },
  {
    key: "huma",
    name: "Huma",
    docs: "https://docs.huma.finance",
    features: { deposit: n("Primary TVL on Solana; EVM pools are allowlisted.") },
  },
  // ---- 51-100 ------------------------------------------------------------------------
  {
    key: "pancakeswap--dex",
    name: "PancakeSwap (DEX)",
    docs: "https://docs.pancakeswap.finance/developers/smart-contracts",
    features: {
      "swap (V3)": t("fork:pancakeswap:v3"),
      "swap (V2)": t("fork:pancakeswap:v2-swap"),
      "add liquidity (V3 NFT)": t("fork:pancakeswap:v3-mint"),
      "remove liquidity": t("fork:pancakeswap:v3-remove"),
      "stake CAKE / farm": t("fork:pancakeswap:farm"),
    },
  },
  {
    key: "pancakeswap-aggregator",
    name: "PancakeSwap Aggregator",
    docs: "https://docs.pancakeswap.finance/developers/smart-contracts",
    features: {
      "swap (V3)": t("fork:pancakeswap:v3"),
      "swap (V2)": t("fork:pancakeswap:v2-swap"),
      "add liquidity (V3 NFT)": t("fork:pancakeswap:v3-mint"),
      "remove liquidity": t("fork:pancakeswap:v3-remove"),
      "stake CAKE / farm": t("fork:pancakeswap:farm"),
    },
  },
  {
    key: "clearstar",
    name: "Clearstar",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:clearstar:deposit"),
      "vault withdraw/redeem": t("fork:clearstar:deposit"),
    },
  },
  {
    key: "near-intents",
    name: "NEAR Intents",
    docs: "https://docs.near-intents.org",
    features: { "intent swap": n(NOT_EVM + " (NEAR verifier).") },
  },
  {
    key: "etherfi-borrowing-market",
    name: "EtherFi Borrowing Market",
    docs: "https://etherfi.gitbook.io/cash",
    features: {
      supply: t("fork:etherfi-cash:supply"),
      borrow: n("Borrowing is per Cash card account (UserSafe, owner-signed)."),
    },
  },
  {
    key: "lista-dao--lending",
    name: "Lista DAO (Lending)",
    docs: "https://docs.bsc.lista.org",
    features: {
      "vault deposit": t("fork:lista-dao:deposit"),
      "vault redeem": t("fork:lista-dao:deposit"),
      borrow: t("fork:lista-dao:borrow"),
    },
  },
  {
    key: "etherfi-cash-liquid",
    name: "EtherFi Cash Liquid",
    docs: "https://etherfi.gitbook.io/cash",
    features: {
      supply: t("fork:etherfi-cash:supply"),
    },
  },
  {
    key: "zama",
    name: "Zama",
    docs: "https://docs.zama.ai/protocol",
    features: {
      "wrap to confidential token": t("fork:zama:wrap"),
      "unwrap / decrypt": n("Needs the Zama KMS/gateway decryption off-chain."),
    },
  },
  {
    key: "optimism-bridge",
    name: "Optimism Bridge",
    docs: "https://docs.optimism.io/app-developers/bridging/standard-bridge",
    features: {
      "L1 -> L2 deposit": t("fork:optimism:deposit"),
      "L2 -> L1 withdraw": n("Proof + 7-day challenge window on the L2 fork."),
    },
  },
  {
    key: "near-bridge",
    name: "NEAR Bridge",
    docs: "https://docs.near.org",
    features: {
      "lock on Ethereum": t("fork:near-bridge:deposit"),
      unlock: n(NOT_EVM),
    },
  },
  {
    key: "opentrade",
    name: "OpenTrade",
    docs: "https://docs.opentrade.io",
    features: { "subscribe / redeem": n(KYC) },
  },
  {
    key: "stakewise-v3",
    name: "StakeWise V3",
    docs: "https://docs.stakewise.io",
    features: {
      "vault deposit (osETH)": t("fork:stakewise:deposit"),
      "mint osETH": t("fork:stakewise:deposit"),
      "exit queue": t("fork:stakewise:exit"),
    },
  },
  {
    key: "avalon-superearn",
    name: "Avalon Superearn",
    docs: "https://docs.avalonfinance.xyz",
    features: {
      "vault deposit": n(
        "The Ethereum SuperEarn router reverts Unauthorized for public callers (keeper-only); user deposits go through SuperEarnRouter on Kaia (chain 8217), which this repo does not fork."
      ),
    },
  },
  {
    key: "base-bridge",
    name: "Base Bridge",
    docs: "https://docs.base.org/chain/bridges",
    features: {
      "L1 -> L2 deposit": t("fork:base:deposit"),
      "L2 -> L1 withdraw": n("Proof + challenge window on the L2 fork."),
    },
  },
  {
    key: "falcon-finance",
    name: "Falcon Finance",
    docs: "https://docs.falcon.finance",
    features: {
      "stake USDf -> sUSDf": t("fork:falcon:stake"),
      "mint USDf": n(KYC),
      "unstake cooldown": n(
        "sUSDf cooldownDuration() is 0 on Ethereum (2026-11-06): the cooldown is switched off and exits are instant, so there is no cooldown to exercise."
      ),
    },
  },
  {
    key: "starknet-bridge",
    name: "Starknet Bridge",
    docs: "https://docs.starknet.io",
    features: {
      "L1 deposit": t("fork:starknet:deposit"),
      withdraw: n("Cairo VM on L2 (not EVM)."),
    },
  },
  {
    key: "uniswap--dex",
    name: "Uniswap (DEX)",
    docs: "https://docs.uniswap.org/contracts",
    features: {
      "swap V2": t("fork:uniswap:v2"),
      "swap V3": t("fork:uniswap:v3"),
      "swap V4": t("fork:uniswap:v4"),
      "quote (all versions)": t("simulate:dex:uniswap:v3"),
      "UniswapX fill": t("simulate:uniswapx:fill"),
      "add liquidity V2": t("fork:uniswap:v2-add"),
      "add liquidity V3 (mint NFT)": t("fork:uniswap:v3-mint"),
      "remove liquidity V3": t("fork:uniswap:v3-remove"),
      "add liquidity V4": t("fork:uniswap:v4-add"),
    },
  },
  {
    key: "cooler-loans",
    name: "Cooler Loans",
    docs: "https://docs.olympusdao.finance",
    features: {
      "borrow against gOHM": t("fork:cooler:borrow"),
      repay: t("fork:cooler:repay"),
    },
  },
  {
    key: "compound-finance",
    name: "Compound Finance",
    docs: "https://docs.compound.finance",
    features: {
      supply: t("fork:compound:supply"),
      borrow: t("fork:compound:borrow"),
      repay: t("fork:compound:repay"),
      withdraw: t("fork:compound:withdraw"),
      "absorb (liquidate)": t("fork:compound:absorb"),
      buyCollateral: t("fork:compound:buycollateral"),
      "claim COMP rewards": n(
        "baseTrackingSupplySpeed and baseTrackingBorrowSpeed are 0 on every Ethereum Comet (cUSDCv3, cWETHv3, cUSDTv3, cUSDSv3) as of 2026-11-02, so claim pays nothing to assert."
      ),
    },
  },
  {
    key: "galaxy-curation",
    name: "Galaxy Curation",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:galaxy:deposit"),
      "vault withdraw/redeem": t("fork:galaxy:deposit"),
    },
  },
  {
    key: "ether.fi-liquid",
    name: "ether.fi Liquid",
    docs: "https://etherfi.gitbook.io",
    features: {
      "Liquid ETH deposit": l("fork:veda:deposit", "Same Veda Teller recipe."),
      "Liquid USD / BTC deposit": t("fork:veda:liquid-usd", "fork:veda:liquid-btc"),
    },
  },
  {
    key: "dolomite",
    name: "Dolomite",
    docs: "https://docs.dolomite.io",
    features: {
      supply: t("fork:dolomite:supply"),
      borrow: n("Markets closing since 2026-11-02 (getMarketIsClosing=true)."),
    },
  },
  {
    key: "curvance",
    name: "Curvance",
    docs: "https://docs.curvance.com",
    features: {
      deposit: t("fork:curvance:deposit"),
      redeem: t("fork:curvance:deposit"),
      borrow: n(
        "Monad OracleManager.getPrice(USDC) returns (0, err=2) on the 2026-11-06 fork, so every borrow fails the collateral check. Harness in lendingBorrowExtras.curvanceBorrow; retest when the USDC oracle recovers."
      ),
    },
  },
  {
    key: "fluid-lite",
    name: "Fluid Lite",
    docs: "https://docs.fluid.instadapp.io",
    features: {
      "vault deposit": t("fork:fluid-lite:deposit"),
      "withdraw/redeem (net of fee)": t("fork:fluid-lite:deposit"),
    },
  },
  {
    key: "kpk",
    name: "KPK",
    docs: "https://docs.morpho.org",
    features: {
      "vault deposit": t("fork:kpk:deposit"),
      "withdraw/redeem": t("fork:kpk:deposit"),
    },
  },
  // ---- 101-200 -----------------------------------------------------------------------
  {
    key: "obol",
    name: "Obol",
    docs: "https://docs.obol.org",
    features: {
      "stake OBOL for stOBOL": t("fork:obol:stake"),
      "create DV cluster": n("Distributed validator setup needs validator keys and the beacon chain."),
    },
  },
  {
    key: "arbitrum-bridge",
    name: "Arbitrum Bridge",
    docs: "https://docs.arbitrum.io/build-decentralized-apps/token-bridging",
    features: {
      "L1 -> L2 deposit": t("fork:arbitrum:deposit"),
      "L2 -> L1 withdraw": n("Outbox proof + 7-day window on the L2 fork."),
    },
  },
  {
    key: "fx-protocol",
    name: "fx Protocol",
    docs: "https://docs.aladdin.club/f-x-protocol",
    features: {
      "mint fxUSD / open position": t("fork:fx:operate"),
      "stability pool deposit": t("fork:fx:stability-deposit"),
    },
  },
  {
    key: "eigencloud",
    name: "EigenCloud",
    docs: "https://docs.eigenlayer.xyz",
    features: {
      "deposit LST into strategy": t("fork:eigenlayer:deposit"),
      "queue withdrawal": t("fork:eigenlayer:queue"),
      "complete withdrawal": t("fork:eigenlayer:complete"),
      "delegate to operator": t("fork:eigenlayer:delegate"),
    },
  },
  {
    key: "meth-protocol",
    name: "mETH Protocol",
    docs: "https://docs.mantle.xyz/meth",
    features: {
      "stake ETH -> mETH": t("fork:meth:stake"),
      "unstake request": t("fork:meth:stake"),
    },
  },
  {
    key: "rsk-bridge",
    name: "RSK Bridge",
    docs: "https://dev.rootstock.io",
    features: { "peg in / out": n(NOT_EVM + " (Bitcoin leg).") },
  },
  {
    key: "spark--vaults",
    name: "Spark (Vaults)",
    docs: "https://docs.spark.fi",
    features: {
      "vault deposit": t("fork:spark-vaults:deposit"),
      "withdraw/redeem": t("fork:spark-vaults:deposit"),
    },
  },
  {
    key: "meta-pool",
    name: "Meta Pool",
    docs: "https://docs.metapool.app",
    features: {
      "deposit ETH -> mpETH": t("fork:meta-pool:deposit"),
      "withdraw request": t("fork:meta-pool:withdraw-request"),
    },
  },
  {
    key: "bedrock-unibtc",
    name: "Bedrock uniBTC",
    docs: "https://docs.bedrock.technology",
    features: { "mint uniBTC from WBTC": t("fork:bedrock-unibtc:mint") },
  },
  {
    key: "saturn",
    name: "Saturn",
    docs: "https://saturncredit.gitbook.io/saturn-docs",
    features: {
      "stake USDat": t("fork:saturn:stake"),
      unstake: t("fork:saturn:unstake"),
    },
  },
  {
    key: "maker",
    name: "Sky",
    docs: "https://developers.sky.money",
    features: {
      "DAI <-> USDS convert": t("fork:sky:convert"),
      "sUSDS deposit": t("fork:sky:susds"),
      "sDAI deposit": t("fork:sky:sdai"),
      "sUSDS withdraw": t("fork:sky:redeem"),
      "PSM swap (USDC <-> USDS)": t("fork:sky:psm"),
      "open vault / draw USDS": t("fork:sky:vault"),
    },
  },
  {
    key: "ether.fi-stake",
    name: "ether.fi Stake",
    docs: "https://etherfi.gitbook.io",
    features: {
      "deposit ETH -> eETH": t("fork:etherfi:deposit"),
      "wrap eETH -> weETH": t("fork:etherfi:wrap"),
      "request withdrawal": t("fork:etherfi:request"),
    },
  },
  {
    key: "lagoon",
    name: "Lagoon",
    docs: "https://docs.lagoon.finance",
    features: { "ERC-7540 deposit request": t("fork:lagoon:request-deposit") },
  },
  {
    key: "usdt0",
    name: "USDT0",
    docs: "https://docs.usdt0.to",
    features: {
      "OFT send": t("fork:usdt0:send"),
      receive: n("Executed by LayerZero on the destination chain."),
    },
  },
  { key: "usdd", name: "USDD", docs: "https://docs.usdd.io", features: { "PSM / mint": t("fork:usdd:mint") } },
  {
    key: "liquity",
    name: "Liquity",
    docs: "https://docs.liquity.org",
    features: {
      "stability pool deposit": t("fork:liquity:deposit"),
      "open trove": t("fork:liquity:open"),
      redeem: t("fork:liquity:redeem"),
      liquidate: t("fork:liquity:liquidate"),
    },
  },
  {
    key: "avant-protocol",
    name: "Avant Protocol",
    docs: "https://docs.avantprotocol.com",
    features: { "stake avUSD": t("fork:avant:stake") },
  },
  {
    key: "solv-protocol--stable-rwa",
    name: "Solv Protocol (Stablecoin)",
    docs: "https://docs.solv.finance",
    features: {
      subscribe: n(
        "BSC pools are whitelisted: SolvBTCRouter.checkPoolPermission is false and OpenFundMarket.subscribe is router-only; the one permissionless pool (SolvBTC.BNB) is the SolvBTC product. Verified 2026-11-03."
      ),
    },
  },
  {
    key: "theo",
    name: "Theo",
    docs: "https://docs.theo.xyz",
    features: { stake: t("fork:theo:stake"), unstake: t("fork:theo:unstake") },
  },
  {
    key: "cian-yield-layer",
    name: "CIAN Yield Layer",
    docs: "https://docs.cian.app",
    features: { "vault deposit": t("fork:cian:deposit"), "withdraw request": t("fork:cian:withdraw-request") },
  },
  {
    key: "polymarket",
    name: "Polymarket",
    docs: "https://docs.polymarket.com",
    features: {
      "split / merge positions (CTF)": t("fork:polymarket:split"),
      trade: n("CLOB orders are matched off-chain by the operator; exploited 2026-10."),
    },
  },
  {
    key: "ssv-network",
    name: "SSV Network",
    docs: "https://docs.ssv.network",
    features: { "register validator": n("Needs validator keyshares from the SSV operator set.") },
  },
  {
    key: "solvbtc",
    name: "SolvBTC",
    docs: "https://docs.solv.finance",
    features: { subscribe: t("fork:solvbtc:subscribe"), redeem: t("fork:solvbtc:redeem") },
  },
  {
    key: "portal",
    name: "Portal",
    docs: "https://docs.wormhole.com",
    features: {
      "token transfer out": t("fork:portal:transfer"),
      "redeem on destination": n("Needs a guardian-signed VAA."),
    },
  },
  {
    key: "venus-core-pool",
    name: "Venus Core Pool",
    docs: "https://docs-v4.venus.io",
    features: {
      supply: t("fork:venus:supply"),
      borrow: t("fork:venus:borrow"),
      repay: t("fork:venus:repay"),
      redeem: t("fork:venus:redeem"),
    },
  },
  {
    key: "curve-dex",
    name: "Curve DEX",
    docs: "https://docs.curve.finance",
    features: {
      swap: t("fork:curve:swap"),
      quote: t("simulate:dex:curve"),
      "add liquidity": t("fork:curve:add"),
      "remove liquidity": t("fork:curve:remove"),
      "gauge deposit": t("fork:curve:gauge"),
    },
  },
  {
    key: "convex-finance",
    name: "Convex Finance",
    docs: "https://docs.convexfinance.com",
    features: { "deposit / stake": t("fork:convex:deposit"), "claim rewards": t("fork:convex:claim") },
  },
  {
    key: "fluid-dex",
    name: "Fluid DEX",
    docs: "https://docs.fluid.instadapp.io",
    features: { swap: t("fork:fluid-dex:swap") },
  },
  {
    key: "avalanche-core-bridge",
    name: "Avalanche Core Bridge",
    docs: "https://core.app/bridge",
    features: { bridge: n("Intel SGX warden custody; releases signed off-chain.") },
  },
  {
    key: "astherus--bridge-chain",
    name: "Aster (Bridge)",
    docs: "https://docs.asterdex.com",
    features: { deposit: t("fork:aster-bridge:deposit-native") },
  },
  {
    key: "aster-bridge",
    name: "Aster Bridge",
    docs: "https://docs.asterdex.com",
    features: { deposit: t("fork:aster-bridge:deposit-native") },
  },
  {
    key: "railgun",
    name: "Railgun",
    docs: "https://docs.railgun.org",
    features: { shield: t("fork:railgun:shield"), unshield: n("Needs a zk proof generated off-chain.") },
  },
  {
    key: "bitfi-basis",
    name: "BitFi Basis",
    docs: "https://docs.bitfi.org",
    features: { deposit: t("fork:bitfi-basis:deposit") },
  },
  {
    key: "benqi-staked-avax",
    name: "Benqi Staked Avax",
    docs: "https://docs.benqi.fi",
    features: { "stake AVAX -> sAVAX": t("fork:benqi:stake"), "request unlock": t("fork:benqi:unlock") },
  },
  {
    key: "pendle-v2",
    name: "Pendle V2",
    docs: "https://docs.pendle.finance",
    features: {
      "markets read": t("simulate:eth:pendle-markets:smoke"),
      "mint PT/YT": t("fork:pendle:mint-py"),
      "swap PT": t("fork:pendle:buy-pt"),
      "add liquidity": t("fork:pendle:add-liquidity"),
    },
  },
  {
    key: "rocket-pool",
    name: "Rocket Pool",
    docs: "https://docs.rocketpool.net",
    features: { "deposit ETH -> rETH": t("fork:rocketpool:deposit"), "burn rETH": t("fork:rocketpool:burn") },
  },
  {
    key: "liquid-collective",
    name: "Liquid Collective",
    docs: "https://docs.liquidcollective.io",
    features: { deposit: n(KYC) },
  },
  {
    key: "fluid-lending",
    name: "Fluid Lending",
    docs: "https://docs.fluid.instadapp.io",
    features: { "fToken deposit": t("fork:fluid-lending:deposit"), "vault borrow": t("fork:fluid-lending:borrow") },
  },
  {
    key: "yearn",
    name: "Yearn",
    docs: "https://docs.yearn.fi",
    features: { "vault deposit": t("fork:yearn:deposit"), "withdraw/redeem": t("fork:yearn:deposit") },
  },
  {
    key: "aero-protocol--dex",
    name: "Aero (DEX)",
    docs: "https://aerodrome.finance/docs",
    features: {
      "swap (Aerodrome)": t("fork:aerodrome:swap"),
      "swap (Velodrome)": t("fork:velodrome:swap"),
      "add liquidity": t("fork:aerodrome:add-liquidity"),
      "gauge stake": n(
        "Every legacy Aerodrome gauge reverts NotAlive since the 2026-10-22 Aero migration, and the new Aero Voter has no on-chain pool-to-gauge lookup, so no live gauge can be derived on a fork."
      ),
      "lock AERO (veNFT)": t("fork:aerodrome:lock"),
    },
  },
  {
    key: "mellow-core",
    name: "Mellow Core",
    docs: "https://docs.mellow.finance",
    features: { "vault deposit": t("fork:mellow-core:deposit") },
  },
  {
    key: "usd-ai",
    name: "USD AI",
    docs: "https://docs.usd.ai",
    features: { "stake USDai": t("fork:usdai:stake"), "mint USDai": t("fork:usdai:mint") },
  },
  {
    key: "gmx--perps",
    name: "GMX (Perps)",
    docs: "https://docs.gmx.io",
    features: {
      "market read": t("fork:gmx:read"),
      "open/close position": n("Two-step: keeper executes the order with signed oracle prices."),
      "GM deposit": n("Keeper-executed deposit with signed prices."),
    },
  },
  {
    key: "sosovalue-indexes",
    name: "SoSoValue Indexes",
    docs: "https://sosovalue.com",
    features: {
      "mint index": n(
        "Base-only deployment (the row's Ethereum TVL is the ETH leg inside the Base baskets) and the mint is KYB-WLP gated: AssetToken.mint is ISSUER_ROLE, addMintRequest rejects non-participants. Verified 2026-11-03."
      ),
    },
  },
  // ---- pinned rows not in the current build ------------------------------------------
  {
    key: "armitage-by-wintermute",
    name: "Armitage by Wintermute",
    docs: "https://armitage.wintermute.com",
    features: {
      "vault deposit (Wintermute USDC Select, Morpho Vault V2)": t("fork:armitage:deposit"),
      "curator / owner functions": n(
        "curator() and owner() are Gnosis Safe proxies; allocation is not permissionless."
      ),
    },
  },
  {
    key: "rysk-v12",
    name: "Rysk V12",
    docs: "https://docs.rysk.finance",
    features: {
      "options trade": n(
        "RFQ only: each trade needs a market maker's EIP-712 signed quote from Rysk's off-chain service. The contracts are live on Ethereum and HyperEVM, but a fork cannot produce the quote."
      ),
    },
  },
  {
    key: "axelar",
    name: "Axelar",
    docs: "https://docs.axelar.dev",
    features: { "callContract / sendToken": t("fork:axelar:send-message") },
  },
  {
    key: "axelar-network",
    name: "Axelar Network",
    docs: "https://docs.axelar.dev",
    features: { "callContract / sendToken": t("fork:axelar:send-message") },
  },
  {
    key: "fraxtal",
    name: "Fraxtal",
    docs: "https://docs.frax.com/fraxtal",
    features: {
      "L1 ERC-20 deposit (canonical bridge)": t("fork:fraxtal:deposit-erc20"),
      "L1 ETH deposit": n("Custom gas token chain: depositETH reverts and the bridge holds no ETH."),
    },
  },
  {
    key: "xdai-stake-bridge",
    name: "xDai Stake Bridge",
    docs: "https://docs.gnosischain.com",
    features: {
      "relayTokens (USDS lockbox)": t("fork:xdai-stake-bridge:deposit"),
      "OmniBridge relayTokens (erc-to-erc sibling)": t("fork:xdai-stake-bridge:relay"),
    },
  },
  {
    key: "sushi--dex",
    name: "Sushi (DEX)",
    docs: "https://docs.sushi.com",
    features: {
      "swap V2": t("fork:sushiswap:v2"),
      "swap V3": t("fork:sushiswap:v3"),
      "add liquidity": t("fork:sushiswap:add-liquidity"),
    },
  },
  {
    key: "lyra",
    name: "Lyra / Derive",
    docs: "https://docs.derive.xyz",
    features: { deposit: t("fork:derive-v3:deposit") },
  },
  {
    key: "benqi-lending",
    name: "Benqi Lending",
    docs: "https://docs.benqi.fi",
    features: { supply: t("fork:benqi:supply"), borrow: t("fork:benqi:borrow"), redeem: t("fork:benqi:redeem") },
  },
  // ---- catalog protocols with fork tests, outside the current top 200 -----------------
  {
    key: "catalog:balancer",
    name: "Balancer",
    docs: "https://docs.balancer.fi",
    features: { swap: t("fork:balancer:swap"), "join pool": t("fork:balancer:join") },
  },
  {
    key: "catalog:monad-v3",
    name: "Uniswap V3 on Monad",
    docs: "https://docs.uniswap.org",
    features: { swap: t("fork:monad:v3") },
  },
  {
    key: "catalog:kelp",
    name: "Kelp DAO",
    docs: "https://kelp.gitbook.io",
    features: { "deposit ETH -> rsETH": t("fork:kelp:deposit"), "withdraw request": t("fork:kelp:request") },
  },
  {
    key: "catalog:renzo",
    name: "Renzo",
    docs: "https://docs.renzoprotocol.com",
    features: { "deposit ETH -> ezETH": t("fork:renzo:deposit"), "withdraw request": t("fork:renzo:request") },
  },
  {
    key: "catalog:symbiotic",
    name: "Symbiotic",
    docs: "https://docs.symbiotic.fi",
    features: { "vault read": t("fork:symbiotic:read"), "vault deposit": t("fork:symbiotic:deposit") },
  },
  {
    key: "catalog:swell",
    name: "Swell",
    docs: "https://docs.swellnetwork.io",
    features: { "deposit ETH -> swETH": t("fork:swell:deposit") },
  },
  {
    key: "catalog:puffer",
    name: "Puffer",
    docs: "https://docs.puffer.fi",
    features: { "deposit ETH -> pufETH": t("fork:puffer:deposit") },
  },
  {
    key: "catalog:frax",
    name: "Frax",
    docs: "https://docs.frax.finance",
    features: { "sfrxETH rate": t("fork:frax:rate"), "mint frxETH": t("fork:frax:mint-frxeth") },
  },
  {
    key: "catalog:buidl",
    name: "BlackRock BUIDL",
    docs: "https://securitize.io",
    features: { read: t("fork:buidl:read"), subscribe: n(KYC) },
  },
  {
    key: "catalog:superstate",
    name: "Superstate",
    docs: "https://docs.superstate.co",
    features: { "NAV read": t("fork:superstate:nav"), subscribe: n(KYC) },
  },
  {
    key: "catalog:circle",
    name: "Circle USDC",
    docs: "https://developers.circle.com",
    features: { transfer: t("fork:circle:transfer"), "mint / redeem": n("Circle-only minters.") },
  },
  {
    key: "catalog:across",
    name: "Across",
    docs: "https://docs.across.to",
    features: { "deposit (origin)": t("fork:across:deposit"), "fill (destination)": n(OFFCHAIN_FILL) },
  },
  {
    key: "catalog:stargate",
    name: "Stargate",
    docs: "https://stargateprotocol.gitbook.io",
    features: { quote: t("fork:stargate:quote"), "deposit / send": t("fork:stargate:deposit") },
  },
  {
    key: "catalog:euler",
    name: "Euler",
    docs: "https://docs.euler.finance",
    features: {
      "vault deposit": t("fork:euler:deposit"),
      "vault redeem": t("fork:euler:deposit"),
      "borrow (EVC)": t("fork:euler:borrow"),
    },
  },
  {
    key: "catalog:concentrator",
    name: "Concentrator",
    docs: "https://docs.aladdin.club",
    features: { "vault deposit": t("fork:concentrator:deposit"), "vault redeem": t("fork:concentrator:deposit") },
  },
  {
    key: "catalog:stakelink",
    name: "stake.link",
    docs: "https://docs.stake.link",
    features: { "stake LINK": t("fork:stakelink:deposit") },
  },
  {
    key: "catalog:ember",
    name: "Ember",
    docs: "https://docs.ember.so",
    features: { "deposit + queued exit": t("fork:ember:deposit") },
  },
  {
    key: "catalog:vesper",
    name: "Vesper",
    docs: "https://docs.vesper.finance",
    features: { "deposit + queued exit": t("fork:vesper:deposit") },
  },
];

module.exports = { PROTOCOL_FEATURES: P };
