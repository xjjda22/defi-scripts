/** Foundry row registry. A file is not proof of execution. Only recorded receipts are passing.
 * W1 precedes W2; planned rows warn today, not a premature future-wave gate.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { attachTesting, RPC_ENV } = require("./forkRecipes");
const ROOT = path.resolve(__dirname, "../..");
const BUILT = {
  aave: {
    file: "test/contracts/protocols/aave/AaveV3.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  morpho: {
    file: "test/contracts/MorphoFlashReceiver.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "receiver",
    receipt: "docs/11-foundry-contract-plan.md#receiver-default-review-2026-11-08",
    reason: "Existing Ethereum receiver verified twice with shared pin defaults; not a new protocol-wave primitive.",
  },
  uniswap: {
    file: "test/contracts/protocols/uniswap/UniswapV3.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  lido: {
    file: "test/contracts/protocols/lido/Lido.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  "bedrock-unieth": {
    file: "test/contracts/protocols/bedrock/BedrockUniETH.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W0",
    receipt: "docs/11-foundry-contract-plan.md#infrastructure-receipt-2026-11-08",
  },
  "layerzero-v2": {
    file: "test/contracts/protocols/layerzero-v2/LayerZeroV2.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  sparklend: {
    file: "test/contracts/protocols/sparklend/SparkLend.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  ethena: {
    file: "test/contracts/protocols/ethena/Ethena.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "hyperliquid-bridge": {
    file: "test/contracts/protocols/hyperliquid-bridge/HyperliquidBridge.fork.t.sol",
    chain: "arbitrum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  veda: {
    file: "test/contracts/protocols/veda/Veda.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Shared ether.fi Liquid ETH BoringVault deposit; separate board-row attribution, not independent deployments or all curator exposure.",
  },
  "steakhouse-financial": {
    file: "test/contracts/protocols/steakhouse-financial/SteakhouseFinancial.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  ccip: {
    file: "test/contracts/protocols/ccip/Ccip.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  maple: {
    file: "test/contracts/protocols/maple/Maple.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  re: {
    file: "test/contracts/protocols/re/Re.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "binance-staked-eth": {
    file: "test/contracts/protocols/binance-staked-eth/Wbeth.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  rockawayx: {
    file: "test/contracts/protocols/rockawayx/Rockawayx.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "polygon-bridge": {
    file: "test/contracts/protocols/polygon-bridge/PolygonBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "plume-vaults": {
    file: "test/contracts/protocols/plume-vaults/PlumeVaults.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "nonce-capital": {
    file: "test/contracts/protocols/nonce-capital/NonceCapital.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Shared ether.fi Liquid ETH BoringVault deposit; separate board-row attribution, not independent deployments or all curator exposure.",
  },
  tether: {
    file: "test/contracts/protocols/tether/Tether.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  aera: {
    file: "test/contracts/protocols/aera/Aera.fork.t.sol",
    chain: "base",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "base-bridge": {
    file: "test/contracts/protocols/base-bridge/BaseBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "coinbase-wrapped-staked-eth": {
    file: "test/contracts/protocols/coinbase-wrapped-staked-eth/Cbeth.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    reason:
      "cbETH is custodial and outside the seven planned read-only exceptions. Its read-only test passes, but no mint/redeem primitive was completed; require explicit exception or leave coverage row blocked/skipped.",
    coverageStatus: "blocked",
    coverageReason:
      "Read-only rate/accounting execution passes, but this row is outside the seven permitted read-only exceptions; no approved mint/redeem primitive completion.",
  },
  concrete: {
    file: "test/contracts/protocols/concrete/Concrete.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "curve-finance": {
    file: "test/contracts/protocols/curve-finance/CurveLlamalend.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason: "Llamalend crvUSD lending-vault deposit primitive, not generic Curve pool coverage.",
  },
  "defi-saver-asset-management": {
    file: "test/contracts/protocols/defi-saver-asset-management/DefiSaver.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Real registry-resolved RecipeExecutor -> registered AaveV3Supply -> Aave; local delegatecall wallet fixture, not production DSProxy authorization coverage.",
  },
  "etherfi-borrowing-market": {
    file: "test/contracts/protocols/etherfi-borrowing-market/EtherfiCash.fork.t.sol",
    chain: "optimism",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  gauntlet: {
    file: "test/contracts/protocols/gauntlet/Gauntlet.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  hyperithm: {
    file: "test/contracts/protocols/hyperithm/Hyperithm.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "lighter-bridge": {
    file: "test/contracts/protocols/lighter-bridge/LighterBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  obol: {
    file: "test/contracts/protocols/obol/Obol.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  opentrade: {
    file: "test/contracts/protocols/opentrade/OpenTrade.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    reason: "KYC-gated: read-only rate, conversion, liquidity-asset wiring and lender gate invariants.",
    coverageStatus: "accepted",
  },
  pancakeswap: {
    file: "test/contracts/protocols/pancakeswap/Pancakeswap.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "robinhood-chain-bridge": {
    file: "test/contracts/protocols/robinhood-chain-bridge/RobinhoodBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "tornado-cash": {
    file: "test/contracts/protocols/tornado-cash/TornadoCash.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  upshift: {
    file: "test/contracts/protocols/upshift/Upshift.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#w1b-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "sentora-curator": {
    file: "test/contracts/protocols/sentora-curator/Sentora.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    coverageStatus: "accepted",
    receipt: "docs/11-foundry-contract-plan.md#sentora-and-event-review-2026-11-08",
    reason:
      "Permissionless accrueInterest settlement: exact cached RLUSD interest and fee-share deltas; not investor deposit or redemption.",
  },
  "ondo-finance": {
    file: "test/contracts/protocols/ondo-finance/OndoFinance.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W1",
    receipt: "docs/11-foundry-contract-plan.md#next-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Public rUSDY unwrap burns shares and returns USDY; issuer subscription remains registration-gated and is not claimed.",
  },
  // W2a batch 1 (2026-11-08): ten rows, each passed twice at the committed pins.
  "world-chain-bridge": {
    file: "test/contracts/protocols/world-chain-bridge/WorldChainBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  huma: {
    file: "test/contracts/protocols/huma/Huma.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Approved read-only exception: PST is minted and redeemed by the Solana program; the Ethereum CCIP token has no permissionless EVM mint.",
  },
  clearstar: {
    file: "test/contracts/protocols/clearstar/Clearstar.fork.t.sol",
    chain: "base",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Morpho V2 maxDeposit() is a zero sentinel; the test settles interest permissionlessly, then executes a USDC deposit/redeem round trip.",
  },
  "ether.fi-liquid": {
    file: "test/contracts/protocols/ether.fi-liquid/EtherfiLiquid.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Deposits into the same ether.fi Liquid ETH BoringVault used by the W1 Veda and Nonce Capital rows; a separate board-row attribution, not an independent deployment.",
  },
  "lista-liquid-staking": {
    file: "test/contracts/protocols/lista-liquid-staking/ListaLiquidStaking.fork.t.sol",
    chain: "bsc",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "etherfi-cash-liquid": {
    file: "test/contracts/protocols/etherfi-cash-liquid/EtherfiCashLiquid.fork.t.sol",
    chain: "optimism",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "near-bridge": {
    file: "test/contracts/protocols/near-bridge/NearBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "falcon-finance": {
    file: "test/contracts/protocols/falcon-finance/FalconFinance.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "stakewise-v3": {
    file: "test/contracts/protocols/stakewise-v3/StakewiseV3.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "fluid-lite": {
    file: "test/contracts/protocols/fluid-lite/FluidLite.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#w2a-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  // Next 20-protocol batch: ten remaining W2 rows and ten W3 rows.
  "galaxy-curation": {
    file: "test/contracts/protocols/galaxy-curation/GalaxyCuration.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "compound-finance": {
    file: "test/contracts/protocols/compound-finance/CompoundFinance.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  kpk: {
    file: "test/contracts/protocols/kpk/Kpk.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "meth-protocol": {
    file: "test/contracts/protocols/meth-protocol/MethProtocol.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  zama: {
    file: "test/contracts/protocols/zama/Zama.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "arbitrum-bridge": {
    file: "test/contracts/protocols/arbitrum-bridge/ArbitrumBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  eigencloud: {
    file: "test/contracts/protocols/eigencloud/Eigencloud.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  spark: {
    file: "test/contracts/protocols/spark/SparkVaults.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  saturn: {
    file: "test/contracts/protocols/saturn/Saturn.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "ether.fi-stake": {
    file: "test/contracts/protocols/ether.fi-stake/EtherfiStake.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "meta-pool": {
    file: "test/contracts/protocols/meta-pool/MetaPool.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "curve-dex": {
    file: "test/contracts/protocols/curve-dex/CurveDex.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "fluid-dex": {
    file: "test/contracts/protocols/fluid-dex/FluidDex.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "bedrock-unibtc": {
    file: "test/contracts/protocols/bedrock-unibtc/BedrockUnibtc.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  solvbtc: {
    file: "test/contracts/protocols/solvbtc/Solvbtc.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "fluid-lending": {
    file: "test/contracts/protocols/fluid-lending/FluidLending.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "cooler-loans": {
    file: "test/contracts/protocols/cooler-loans/CoolerLoans.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "convex-finance": {
    file: "test/contracts/protocols/convex-finance/ConvexFinance.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  sushi: {
    file: "test/contracts/protocols/sushi/Sushi.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  polymarket: {
    file: "test/contracts/protocols/polymarket/Polymarket.fork.t.sol",
    chain: "polygon",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  // Second next batch: one W2 row and nineteen W3 rows.
  lagoon: {
    file: "test/contracts/protocols/lagoon/Lagoon.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  liquity: {
    file: "test/contracts/protocols/liquity/Liquity.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "optimism-bridge": {
    file: "test/contracts/protocols/optimism-bridge/OptimismBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "fx-protocol": {
    file: "test/contracts/protocols/fx-protocol/FxProtocol.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "avant-protocol": {
    file: "test/contracts/protocols/avant-protocol/AvantProtocol.fork.t.sol",
    chain: "avalanche",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  lyra: {
    file: "test/contracts/protocols/lyra/Lyra.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  maker: {
    file: "test/contracts/protocols/maker/Maker.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "starknet-bridge": {
    file: "test/contracts/protocols/starknet-bridge/StarknetBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  railgun: {
    file: "test/contracts/protocols/railgun/Railgun.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  dolomite: {
    file: "test/contracts/protocols/dolomite/Dolomite.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "pendle-v2": {
    file: "test/contracts/protocols/pendle-v2/PendleV2.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "venus-core-pool": {
    file: "test/contracts/protocols/venus-core-pool/VenusCorePool.fork.t.sol",
    chain: "bsc",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "xdai-stake-bridge": {
    file: "test/contracts/protocols/xdai-stake-bridge/XdaiStakeBridge.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  fraxtal: {
    file: "test/contracts/protocols/fraxtal/Fraxtal.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "rocket-pool": {
    file: "test/contracts/protocols/rocket-pool/RocketPool.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  usdd: {
    file: "test/contracts/protocols/usdd/Usdd.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  yearn: {
    file: "test/contracts/protocols/yearn/Yearn.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "armitage-by-wintermute": {
    file: "test/contracts/protocols/armitage-by-wintermute/Armitage.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "axelar-network": {
    file: "test/contracts/protocols/axelar-network/AxelarNetwork.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  ember: {
    file: "test/contracts/protocols/ember/Ember.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#second-next-20-protocol-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  // Final backlog batch: five remaining rows with accepted permissionless primitives.
  curvance: {
    file: "test/contracts/protocols/curvance/Curvance.fork.t.sol",
    chain: "monad",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#final-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "lista-dao": {
    file: "test/contracts/protocols/lista-dao/ListaDao.fork.t.sol",
    chain: "bsc",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#final-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "aster-bridge": {
    file: "test/contracts/protocols/aster-bridge/AsterBridge.fork.t.sol",
    chain: "bsc",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#final-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "bitfi-basis": {
    file: "test/contracts/protocols/bitfi-basis/BitfiBasis.fork.t.sol",
    chain: "bsc",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#final-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "grove-finance": {
    file: "test/contracts/protocols/grove-finance/GroveFinance.fork.t.sol",
    chain: "base",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#final-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  // Remaining-backlog retry: six previously blocked/target rows accepted on public alternatives.
  usdt0: {
    file: "test/contracts/protocols/usdt0/Usdt0.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W2",
    receipt: "docs/11-foundry-contract-plan.md#next-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
  },
  "ssv-network": {
    file: "test/contracts/protocols/ssv-network/SsvNetwork.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Permissionless public operator registration; validator registration and consensus-layer duties are not claimed.",
  },
  portal: {
    file: "test/contracts/protocols/portal/Portal.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Source-chain WETH custody and Wormhole payload; guardian VAA and destination redemption are not claimed.",
  },
  "cian-yield-layer": {
    file: "test/contracts/protocols/cian-yield-layer/CianYieldLayer.fork.t.sol",
    chain: "ethereum",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Holder exit requestRedeem while the price window is stale; deposit is not claimed.",
  },
  "aero-protocol": {
    file: "test/contracts/protocols/aero-protocol/AeroProtocol.fork.t.sol",
    chain: "base",
    status: "passing",
    wave: "W3",
    receipt: "docs/11-foundry-contract-plan.md#next-backlog-batch-receipt-2026-11-08",
    coverageStatus: "accepted",
    reason:
      "Post-migration Aero v2 AERO/USDC core pool mint; Metarouter wrappers and gauge staking are not claimed.",
  },
};
function buildRegistry(board = require("../../showcase/data.json"), built = BUILT) {
  return board.overall.map(original => {
    // Reattach from contracts.js, rather than silently relying on stale board addresses.
    const row = attachTesting(structuredClone(original));
    const contracts = row.testing.contracts || [];
    const addressChains = [...new Set(contracts.map(c => c.chain))].sort();
    const forkChains = addressChains.filter(chain => RPC_ENV[chain]);
    const rank = row.overallRank || row.rank;
    const existing = built[row.slug];
    const queued = forkChains.length > 0 || !!existing;
    return {
      rank,
      protocol: row.name,
      slug: row.slug,
      category: row.category,
      unique_contracts: new Set(contracts.map(c => `${c.chain}:${c.address.toLowerCase()}`)).size,
      contract_entries: contracts.length,
      chains: addressChains,
      testing_mode: row.testing.mode,
      foundry_bucket:
        existing?.wave === "receiver" || row.slug === "aave" ? "already-covered" : queued ? "parity" : "not-queued",
      wave: existing?.wave || (queued ? (rank <= 50 ? "W1" : rank <= 100 ? "W2" : "W3") : "—"),
      status: existing?.status || "planned",
      file: existing?.file || null,
      chain: existing?.chain || (forkChains.includes(row.testing.chain) ? row.testing.chain : forkChains[0]) || null,
      receipt: existing?.receipt || null,
      coverageStatus:
        existing?.coverageStatus || (existing?.status === "passing" ? "accepted" : queued ? "planned" : "not-queued"),
      coverageReason: existing?.coverageReason || null,
      reason:
        existing?.reason ||
        (existing?.status === "passing"
          ? "Pinned execution proven; scope is limited to the registered primitive and receipt, not all protocol features."
          : queued
            ? "Contract primitive awaits implementation and two pinned runs; JS coverage is not Solidity coverage."
            : contracts.length
              ? "Configured addresses are outside the fork RPC map; deferred, not executed."
              : row.testing.note || "No configured contract address; out of this parity queue."),
    };
  });
}
function checkPassingProof(entry, proof, root) {
  const row = proof?.workerReceipts?.find(row => row.slug === entry.slug);
  if (
    !row ||
    row.file !== entry.file ||
    row.chain !== entry.chain ||
    row.runs?.length !== 2 ||
    row.runs.some(
      run =>
        run.PASS !== 1 ||
        run.FAIL !== 0 ||
        run.SKIP !== 0 ||
        run.exitCode !== 0 ||
        !(run.wallSeconds > 0 && run.wallSeconds < 60)
    )
  )
    return false;
  const pins = JSON.parse(fs.readFileSync(path.join(root, "data/fork-blocks.json")));
  if (
    !Object.values(pins.chainsById).some(
      pin => pin.chain === row.chain && pin.blockNumber === row.blockNumber && pin.blockHash === row.blockHash
    )
  )
    return false;
  if (!row.sourceHashes?.[entry.file] || !proof.commonSourceHashes) return false;
  return Object.entries({ ...proof.commonSourceHashes, ...row.sourceHashes }).every(
    ([file, expected]) =>
      fs.existsSync(path.join(root, file)) &&
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex") === expected
  );
}
function checkRegistry(entries = buildRegistry(), root = ROOT, proof) {
  if (proof === undefined) {
    try {
      proof = JSON.parse(fs.readFileSync(path.join(root, "data/foundry-test-receipts.json")));
    } catch {
      proof = null;
    }
  }
  const problems = [],
    warnings = [],
    seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slug)) problems.push(`Duplicate Foundry slug: ${entry.slug}`);
    seen.add(entry.slug);
    if (!["planned", "passing", "skipped"].includes(entry.status))
      problems.push(`Invalid Foundry status: ${entry.slug}`);
    if (!["accepted", "blocked", "planned", "not-queued"].includes(entry.coverageStatus))
      problems.push(`Invalid Foundry coverage status: ${entry.slug}`);
    if (entry.coverageStatus === "accepted" && entry.status !== "passing")
      problems.push(`Accepted Foundry coverage requires proven passing execution: ${entry.slug}`);
    if (entry.coverageStatus === "blocked" && !entry.coverageReason)
      problems.push(`Blocked Foundry coverage requires a reason: ${entry.slug}`);
    if (entry.status === "passing" && (!entry.file || !entry.receipt))
      problems.push(`Passing Foundry row requires file and receipt: ${entry.slug}`);
    if (entry.status === "passing" && entry.receipt && !fs.existsSync(path.join(root, entry.receipt.split("#")[0])))
      problems.push(`Missing Foundry receipt document: ${entry.slug}`);
    if (entry.status === "passing" && entry.wave === "W1") {
      let verified = false;
      try {
        verified = checkPassingProof(entry, proof, root);
      } catch {
        /* Fail closed on malformed proof. */
      }
      if (!verified)
        problems.push(`Passing W1 row requires two bounded pinned receipts for unchanged sources: ${entry.slug}`);
    }
    if (entry.file && (!RPC_ENV[entry.chain] || !entry.chains?.includes(entry.chain)))
      problems.push(`Foundry execution chain has no matching configured row address: ${entry.slug}`);
    if (entry.file && (!entry.file.endsWith(".t.sol") || !fs.existsSync(path.join(root, entry.file))))
      problems.push(`Missing Foundry file: ${entry.slug}: ${entry.file}`);
    if (entry.foundry_bucket !== "not-queued" && entry.status === "planned")
      warnings.push(`Foundry planned ${entry.wave}: ${entry.slug}`);
  }
  const registered = new Set(entries.filter(e => e.file).map(e => e.file));
  const walk = dir => {
    if (!fs.existsSync(path.join(root, dir))) return;
    for (const child of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${child.name}`;
      if (child.isDirectory()) walk(relative);
      else if (child.name.endsWith(".t.sol") && !registered.has(relative))
        problems.push(`Unregistered Foundry protocol file: ${relative}`);
    }
  };
  walk("test/contracts/protocols");
  return { problems, warnings };
}
module.exports = { BUILT, buildRegistry, checkRegistry };
