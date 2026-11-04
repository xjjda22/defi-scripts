/**
 * Contract addresses for the fork suite and the showcase panel.
 *
 * Addresses already configured in src/config/chains.js are read from there.
 * The rest are copied from the official docs linked on each entry.
 * Do not add an address that is not in the repo config or those docs.
 */

const { CHAINS, COMMON_TOKENS } = require("../config/chains");

/** @typedef {{ label: string, address: string, chain: string, doc: string }} ContractEntry */

const DOCS = {
  aave: "https://aave.com/docs/resources/addresses",
  spark: "https://docs.spark.fi/dev/sparklend/core-contracts/pool",
  compound: "https://docs.compound.finance/#networks",
  morpho: "https://docs.morpho.org/get-started/resources/addresses/",
  pancake: "https://developer.pancakeswap.finance/contracts/v3/addresses",
  lido: "https://docs.lido.fi/contracts/lido",
  rocket: "https://rocketpool.net/protocol/integrations",
  cbeth: "https://docs.cdp.coinbase.com/staking/docs/wrapped-eth",
  etherfi: "https://etherfi.gitbook.io/etherfi/contracts-and-integrations/ethereum-mainnet",
  kelp: "https://kelp.gitbook.io/kelp/contracts/rs-eth-contract-addresses",
  renzo: "https://docs.renzoprotocol.com/docs/contracts/ethereum",
  uniswap: "https://docs.uniswap.org/contracts/v3/reference/deployments/",
  sky: "https://developers.skyeco.com/protocol/tokens/usds/",
  ethena: "https://docs.ethena.fi/technical-design/key-addresses",
  usdc: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
  usdt: "https://tether.to/en/transparency/",
  frax: "https://docs.frax.com/frxusd/frxusd-contracts",
  buidl: "https://securitize.io/blackrock/BUIDL",
  ondo: "https://docs.ondo.finance/addresses",
  superstate: "https://docs.superstate.com/investors/smart-contracts",
  arbitrum: "https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses",
  base: "https://docs.base.org/base-chain/network-information/base-contracts",
  optimism: "https://docs.optimism.io/chain/addresses",
  across: "https://docs.across.to/chains-and-contracts",
  stargate: "https://docs.stargate.finance/resources/contracts/mainnet-contracts",
  // V1 is sunset; this is the archived address list.
  gmx: "https://docs.gmx.io/docs/archived/contracts-v1",
  // Curator vault pages on the official Morpho app. MetaMorpho is ERC-4626.
  steakhouse: "https://app.morpho.org/ethereum/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB/steakhouse-usdc",
  gauntlet: "https://app.morpho.org/ethereum/vault/0xdd0f28e19C1780eb6396170735D45153D261490d/gauntlet-usdc-prime",
  sentora: "https://app.morpho.org/ethereum/vault/0x6dC58a0FdfC8D694e571DC59B9A52EEEa780E6bf/sentora-rlusd-main",
  rlusd: "https://docs.ripple.com/products/stablecoin/overview/token-addresses",
  yearn: "https://yearn.fi/api/vault/markdown?address=0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204&chainId=1",
  euler: "https://github.com/euler-xyz/euler-labels/blob/master/1/earn-vaults.json",
  veda: "https://etherfi.gitbook.io/etherfi/products/liquid/live-vaults/liquid-eth-vault",
  upshift: "https://docs.upshift.finance/contracts/fee-sharing",
  eigenlayer: "https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/README.md",
  symbiotic: "https://docs.symbiotic.fi/get-started/resources/addresses",
  // Address is the mainnet deployment recorded in Balancer's review of Swell's rate provider.
  // deposit() is RswETH.sol in the Swell repo.
  swell: "https://github.com/balancer/code-review/blob/main/rate-providers/rswethRateProvider.md",
  puffer: "https://github.com/PufferFinance/pufETH",
  // Curator vault page on the official Morpho app. RockawayX vaults on Ethereum are Morpho Vault V2.
  rockawayx: "https://app.morpho.org/ethereum/vault/0xE0181090c22579B6A217f1522cbf8c9f1F0C1965/rockawayx-usdc-yield",
  // Searchable directory of every Curve deployment (Llamalend V1/V2 factories, crvUSD, Savings crvUSD).
  curve: "https://docs.curve.finance/developer/deployments",
  dolomite: "https://docs.dolomite.io/smart-contract-addresses/core-immutable",
  dolomiteRouters: "https://docs.dolomite.io/smart-contract-addresses/core-routers",
  re: "https://docs.re.xyz/products/smart-contracts",
  // Nest is the Plume Vaults product. Ethereum (chainId 1) deployments come from the vault's
  // record in the official Nest API that the docs page renders from.
  nest: "https://docs.nest.credit/developers/smart-contracts/",
  nestAlpha: "https://docs.nest.credit/developers/integration-guides/nalpha/",
  nestBasis: "https://docs.nest.credit/developers/integration-guides/nbasis/",
  maple: "https://docs.maple.finance/integrate/ethereum-mainnet/smart-contract-integration",
  listaStake: "https://docs.bsc.lista.org/for-developer/liquid-staking-slisbnb/smart-contract",
  listaLending: "https://docs.bsc.lista.org/for-developer/lista-lending/smart-contract/smart-contract-bsc-core",
  venus: "https://docs-v4.venus.io/deployed-contracts/markets",
  usdai: "https://docs.usd.ai/technical-overview/contract-addresses",
  sparkVaults: "https://docs.spark.fi/dev/savings/spark-vaults-v2",
  fx: "https://docs.aladdin.club/f-x-protocol/contracts",
  iporFusion: "https://docs.ipor.io/build-on-fusion/developer-guide/addresses",
  // Avalon SuperEarn product docs (Kaia primary; Ethereum remote vaults).
  avalon: "https://docs.superearn.io/en/developers/smart-contracts",
  layerzero: "https://docs.layerzero.network/v2/deployments/chains/ethereum",
  worldChain: "https://docs.world.org/world-chain/developers/world-chain-contracts",
  // Official StarkGate token registry (StarkWare), linked from docs.starknet.io/learn/protocol/starkgate.
  starkgate: "https://github.com/starknet-io/starknet-addresses/blob/master/bridged_tokens/mainnet.json",
  starknetCore: "https://docs.starknet.io/learn/cheatsheets/chain-info",
  wbeth: "https://www.binance.com/en/support/faq/what-is-wbeth-e252366155174ba6887f6b32e3798273",
  lighter: "https://apidocs.lighter.xyz/docs/environments",
  metaPool: "https://docs.metapool.app/master/for-developers/meta-pool-contracts/ethereum-network-and-l2s",
  // Polygon's own contract registry for mainnet (POSContracts section).
  polygonPos: "https://static.polygon.technology/network/mainnet/v1/index.json",
  robinhoodChain: "https://docs.robinhood.com/chain/protocol-contracts/",
  // Omni Bridge README, "Contract Addresses" (Mainnet). DefiLlama's near-bridge row runs the omni-bridge adapter.
  omniBridge: "https://github.com/Near-One/omni-bridge#contract-addresses",
  wormhole: "https://wormhole.com/docs/products/reference/contract-addresses/",
  ccip: "https://docs.chain.link/ccip/directory/mainnet/chain/mainnet",
  ccipLink: "https://docs.chain.link/ccip/directory/mainnet/token/LINK",
  stakewise: "https://docs.stakewise.io/contracts/networks/Mainnet",
  // Curator vault pages on the official Morpho app (both are Morpho Vault V2).
  clearstar: "https://app.morpho.org/base/vault/0x91C056B6d4311a743614FBc03ac32d4E6A2d3a3c/clearstar-cbassets-vault",
  clearstarEth: "https://app.morpho.org/ethereum/vault/0x69A238Ae7ebeb3c53ff3B544E48B96a2142fc284/clearstar-usdc-core",
  hyperithm: "https://app.morpho.org/ethereum/vault/0x093272C07700d3cA5301C3Bf9B3A392624179E2F/hyperithm-usdc-apex",
  hyperithmMonad: "https://app.morpho.org/monad/vault/0x78999cc96d2Ba0341588C60CcB0E91c6C33CF371/hyperithm-usdc-apex",
  // Concrete's official vault API (the feed app.concrete.xyz and DefiLlama's concrete-xyz adapter read).
  concrete: "https://apy.api.concrete.xyz/v1/vault:tvl/all",
  // rsksmart/tokenbridge "MainNet Addresses" (On Ethereum). The Token Bridge was sunset at the end of March 2026:
  // https://rootstock.io/blog/token-bridge-sunset-how-to-move-your-assets-and-bridge-to-rootstock-via-stargate/
  rskTokenBridge: "https://github.com/rsksmart/tokenbridge/blob/master/docs/ContractAddresses.md",
  // Huma's announcement of PST on Ethereum (Fluid, Chainlink CCIP). docs.huma.finance lists the Solana PST mint.
  humaPst: "https://blog.huma.finance/pst-now-live-on-fluid-powered-by-chain-link",
  curvanceMonad: "https://docs.curvance.com/app/protocol-overview/monad-contract-addresses",
  saturn: "https://saturncredit.gitbook.io/saturn-docs/operations-and-governance/key-addresses",
  concentrator: "https://docs.aladdin.club/concentrator/contracts",
  olympus: "https://docs.olympusdao.finance/main/contracts/addresses",
  stakeLink: "https://docs.stake.link/resources/contracts-and-integrations",
  fluidLite: "https://lite.guides.instadapp.io/getting-started/vault-receipt-tokens",
  "xdai-stake-bridgeDoc": "https://github.com/DefiLlama/DefiLlama-Adapters/blob/08239f856c/projects/xdai/index.js",
  "armitageDoc": "https://armitage.wintermute.com/docs/vaults/select",
  "polymarketDoc": "https://docs.polymarket.com/developers/CTF/overview",
  "hyperliquid-bridgeDoc": "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/usdc",
  "avantDoc": "https://docs.avantprotocol.com/security/contract-addresses",
  "fraxtalDoc": "https://docs.frax.com/fraxtal/addresses/fraxtal-contracts",
  "axelarDoc": "https://docs.axelar.dev/resources/contract-addresses/mainnet/",
  "mellow-coreDoc": "https://docs.mellow.finance/lido-earn/deployments",
  "fluid-lendingDoc": "https://github.com/instadapp/fluid-contracts-public/blob/main/deployments/deployments.md",
  "railgunDoc": "https://docs.railgun.org/wiki/learn/helpful-links",
  "derive-v3Doc": "https://docs.derive.xyz/getting-started/contracts",
  "bedrock-unibtcDoc": "https://docs.bedrock.technology/security/smart-contracts/unibtc.md",
  "bitfi-basisDoc": "https://docs.bitfi.one/developer/bfbtc-overview/deployed-contracts",
  "aster-bridgeDoc": "https://docs.asterdex.com/overview/smart-contracts",
  pendleDoc: "https://github.com/pendle-finance/pendle-core-v2-public/blob/main/deployments/1-core.json",
  usddDoc: "https://docs.usdd.io/developers/deployment-addresses",
  obolDoc: "https://docs.obol.org/community-and-governance/obol-token",
  groveDoc: "https://github.com/grove-labs/grove-address-registry/blob/master/src/Base.sol",
  fluidDex: "https://docs.fluid.instadapp.io/integrate/dex-swaps.html",
  tornadoCash: "https://github.com/tornadocash/docs/blob/en/general/tornado-cash-smart-contracts.md",
  // Ember's vault API (OpenAPI spec linked from learn.ember.so/ember-protocol/api-docs); the ember.so app reads it.
  ember: "https://vaults.api.sui-prod.bluefin.io/api/v2/vaults?chain=ethereum",
  lombard: "https://docs.lombard.finance/learn/transparency/smart-contracts",
  vesper: "https://docs.vesper.finance/vesper-2/contract-addresses",
  // ether.fi Cash lending (ether.fi-managed Aave V4 on OP Mainnet).
  etherfiCash: "https://etherfi.gitbook.io/etherfi/products/borrow/lending-market-parameters",
  // DeFi Saver's "Deployed contracts" page links its own addresses/mainnet.json.
  defisaver: "https://github.com/defisaver/defisaver-v3-contracts/blob/main/addresses/mainnet.json",
  // Enzyme Blue (Sulu release) deployment file in Enzyme's SDK.
  enzyme: "https://github.com/enzymefinance/sdk/blob/main/packages/environment/src/deployments/ethereum.ts",
  falcon: "https://docs.falcon.finance/resources/smart-contracts",
  meth: "https://docs.mantle.xyz/meth/components/smart-contracts/staking-meth",
  // Aera's gtUSDa integration guide (Base). The Provisioner and PriceAndFeeCalculator are read from the
  // vault's provisioner() / feeCalculator(), as that page instructs.
  aeraGtusda: "https://docs.aera.finance/integrating-with-gtusda",
  opentrade: "https://docs.opentrade.io/developers/contract-addresses",
  kpkUsdcPrime: "https://docs.kpk.io/vaults/vaults/morpho/ethereum/usdc-prime",
  kpkUsdcPrimeCore: "https://docs.kpk.io/vaults/vaults/morpho/ethereum/usdc-prime-core",
  galaxy: "https://docs.curation.galaxy.com/products/deployed-vaults",
  usdt0: "https://docs.usdt0.to/technical-documentation/developer",
  benqiCore: "https://docs.benqi.fi/resources/contracts/core-markets",
  benqi: "https://docs.benqi.fi/resources/contracts",
  liquityV1: "https://docs.liquity.org/liquity-v1/documentation/resources",
  liquityV2: "https://docs.liquity.org/v2-documentation/technical-docs-and-audits",
  convex: "https://docs.convexfinance.com/convexfinance/faq/contract-addresses",
  theo: "https://docs.theo.xyz/developers/deployed-addresses",
  theoSthusd: "https://docs.theo.xyz/developers/contract-reference/sthusd",
  cian: "https://docs.cian.app/yieldlayer/for-builders-developer-documentation/yield-layer-contracts",
  solv: "https://docs.solv.finance/developer-guide/contracts",
  // SolvBTC storage pool ids per chain and currency (Ethereum WBTC pool used by the fork test).
  solvPools: "https://docs.solv.finance/developer-guide/data-services/solvbtc-solvbtc.lsts-storage-pools",
  zama: "https://docs.zama.org/protocol/protocol-apps/addresses/mainnet/ethereum",
  ssv: "https://docs.ssv.network/developers/smart-contracts/",
  lagoon: "https://docs.lagoon.finance/resources/networks-and-addresses",
};

/**
 * Explorer link for one address, from the chain map. The showcase renders this
 * so a reader can confirm the contract exists instead of trusting the address.
 */
function explorerFor(chain, address) {
  const base = CHAINS[chain] && CHAINS[chain].explorer;
  if (!base || !/^0x[a-fA-F0-9]{40}$/.test(String(address || ""))) return null;
  return `${base}/address/${address}`;
}

function push(list, chain, label, address, doc) {
  if (!address) return;
  list.push({ chain, label, address, doc, explorerUrl: explorerFor(chain, address) });
}

/**
 * Curated addresses keyed by showcase slug / catalog id.
 * @returns {Record<string, ContractEntry[]>}
 */
function contractBook() {
  const eth = "ethereum";
  const uni = CHAINS.ethereum.uniswap;
  const book = {
    uniswap: [],
    curve: [],
    balancer: [],
    sushiswap: [],
    aerodrome: [],
    velodrome: [],
    pancakeswap: [],
    aave: [],
    spark: [],
    compound: [],
    morpho: [],
    lido: [],
    rocketpool: [],
    "rocket-pool": [],
    cbeth: [],
    "coinbase-wrapped-staked-eth": [],
    etherfi: [],
    "ether.fi": [],
    "ether.fi-stake": [],
    kelp: [],
    renzo: [],
    sky: [],
    maker: [],
    ethena: [],
    circle: [],
    usdc: [],
    tether: [],
    usdt: [],
    frax: [],
    "frax-finance": [],
    buidl: [],
    securitize: [],
    "blackrock-buidl": [],
    ondo: [],
    "ondo-finance": [],
    superstate: [],
    ustb: [],
    arbitrum: [],
    "arbitrum-bridge": [],
    base: [],
    "base-bridge": [],
    optimism: [],
    "optimism-bridge": [],
    across: [],
    stargate: [],
    "stargate-finance": [],
    gmx: [],
    hyperliquid: [],
    "hyperliquid-bridge": [],
    steakhouse: [],
    "steakhouse-financial": [],
    gauntlet: [],
    sentora: [],
    "sentora-curator": [],
    yearn: [],
    "yearn-finance": [],
    euler: [],
    "euler-v2": [],
    veda: [],
    upshift: [],
    eigenlayer: [],
    eigencloud: [],
    symbiotic: [],
    swell: [],
    "swell-liquid-restaking": [],
    puffer: [],
    "puffer-stake": [],
    rockawayx: [],
    llamalend: [],
    "curve-llamalend": [],
    dolomite: [],
    re: [],
    "plume-vaults": [],
    maple: [],
    "lista-liquid-staking": [],
    lista: [],
    "lista-dao": [],
    "venus-core-pool": [],
    venus: [],
    "usd-ai": [],
    usdai: [],
    "spark-vaults": [],
    "fx-protocol": [],
    fx: [],
    "fusion-by-ipor": [],
    "avalon-superearn": [],
    "layerzero-v2": [],
    "world-chain": [],
    "starknet-bridge": [],
    "binance-staked-eth": [],
    "lighter-bridge": [],
    "meta-pool": [],
    "meta-pool-eth": [],
    "polygon-bridge": [],
    "robinhood-chain-bridge": [],
    "near-bridge": [],
    portal: [],
    ccip: [],
    "stakewise-v3": [],
    stakewise: [],
    clearstar: [],
    hyperithm: [],
    concrete: [],
    "k3-capital": [],
    "rsk-bridge": [],
    huma: [],
    curvance: [],
    saturn: [],
    concentrator: [],
    "cooler-loans": [],
    "stake.link": [],
    "stake.link-liquid": [],
    "fluid-lite": [],
    "ember-protocol": [],
    "lombard-vaults": [],
    vesper: [],
    "etherfi-borrowing-market": [],
    "etherfi-cash-liquid": [],
    "defi-saver-asset-management": [],
    "enzyme-finance": [],
    "falcon-finance": [],
    "meth-protocol": [],
    aera: [],
    opentrade: [],
    kpk: [],
    "galaxy-curation": [],
    usdt0: [],
    liquity: [],
    "convex-finance": [],
    theo: [],
    "cian-yield-layer": [],
    solvbtc: [],
    zama: [],
    "ssv-network": [],
    lagoon: [],
    "benqi-lending": [],
    "benqi-staked-avax": [],
  };

  push(book.uniswap, eth, "V2 router", uni.v2.router, DOCS.uniswap);
  push(book.uniswap, eth, "V2 factory", uni.v2.factory, DOCS.uniswap);
  push(book.uniswap, eth, "V3 router", uni.v3.router, DOCS.uniswap);
  push(book.uniswap, eth, "V3 quoter", uni.v3.quoter, DOCS.uniswap);
  push(book.uniswap, eth, "V4 pool manager", uni.v4.poolManager, "https://docs.uniswap.org/contracts/v4/deployments");
  push(book.uniswap, eth, "V4 quoter", "0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203", "https://docs.uniswap.org/contracts/v4/deployments");
  push(book.uniswap, eth, "Universal Router (V4)", "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af", "https://docs.uniswap.org/contracts/v4/deployments");
  push(book.curve, eth, "3pool", CHAINS.ethereum.curve.pools["3pool"].address, "https://curve.readthedocs.io/registry-registry.html");
  push(book.balancer, eth, "V2 vault", CHAINS.ethereum.balancer.v2.vault, "https://docs.balancer.fi/reference/contracts/deployment-addresses/mainnet.html");
  push(book.sushiswap, eth, "V2 router", CHAINS.ethereum.sushiswap.v2.router, "https://docs.sushi.com/contracts/route-processor");
  push(book.sushiswap, eth, "V3 router", CHAINS.ethereum.sushiswap.v3.router, "https://docs.sushi.com/contracts/route-processor");
  push(book.aerodrome, "base", "Slipstream router", CHAINS.base.aerodrome?.v3?.router, "https://github.com/aerodrome-finance/slipstream");
  push(book.velodrome, "optimism", "Slipstream router", CHAINS.optimism.velodrome?.v3?.router, "https://github.com/velodrome-finance/slipstream");

  // https://developer.pancakeswap.finance/contracts/v3/addresses — same CREATE2 addresses on BSC and Ethereum
  const pancake = {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    quoter: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997",
  };
  for (const chain of ["ethereum", "bsc"]) {
    push(book.pancakeswap, chain, "V3 factory", pancake.factory, DOCS.pancake);
    push(book.pancakeswap, chain, "V3 router", pancake.router, DOCS.pancake);
    push(book.pancakeswap, chain, "V3 quoter", pancake.quoter, DOCS.pancake);
  }

  push(book.aave, eth, "V3 pool", CHAINS.ethereum.aave.v3.pool, DOCS.aave);
  push(book.aave, eth, "V3 data provider", CHAINS.ethereum.aave.v3.poolDataProvider, DOCS.aave);
  // SparkLend Pool proxy. Docs describe the Pool; the address is the Ethereum deployment
  // named Spark: SparkLend on etherscan (0xC13e21B648A5Ee794902342038FF3aDAB66BE987).
  push(book.spark, eth, "SparkLend pool", "0xC13e21B648A5Ee794902342038FF3aDAB66BE987", DOCS.spark);
  // https://docs.compound.finance/#networks — Ethereum USDC Comet
  push(book.compound, eth, "cUSDCv3", "0xc3d688B66703497DAA19211EEdff47f25384cdc3", DOCS.compound);
  push(book.morpho, eth, "Morpho Blue", "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", DOCS.morpho);

  push(book.lido, eth, "stETH", COMMON_TOKENS.stETH.ethereum, DOCS.lido);
  push(book.lido, eth, "wstETH", COMMON_TOKENS.wstETH.ethereum, "https://docs.lido.fi/contracts/wsteth");
  push(book.lido, eth, "WithdrawalQueueERC721", "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1", "https://docs.lido.fi/contracts/withdrawal-queue-erc721");
  // Current proxy from RocketStorage.getAddress(keccak256("contract.addressrocketDepositPool")).
  // The integrations page still lists the previous proxy 0xDD3f50F8A6CafbE9b31a427582963f465E745AF8,
  // which reverts "Invalid or outdated contract".
  // RocketStorage: 0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46
  push(book.rocketpool, eth, "Deposit pool", "0xCE15294273CFb9D9b628F4D61636623decDF4fdC", DOCS.rocket);
  push(book.rocketpool, eth, "rETH", COMMON_TOKENS.rETH.ethereum, DOCS.rocket);
  book["rocket-pool"] = book.rocketpool;
  // https://docs.cdp.coinbase.com/staking/docs/wrapped-eth — cbETH has no public mint; exchangeRate() is the read
  push(book.cbeth, eth, "cbETH", "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", DOCS.cbeth);
  book["coinbase-wrapped-staked-eth"] = book.cbeth;

  // https://etherfi.gitbook.io/etherfi/contracts-and-integrations/ethereum-mainnet
  push(book.etherfi, eth, "Liquidity pool", "0x308861A430be4cce5502d0A12724771Fc6DaF216", DOCS.etherfi);
  push(book.etherfi, eth, "eETH", "0x35fA164735182de50811E8e2E824cFb9B6118ac2", DOCS.etherfi);
  push(book.etherfi, eth, "weETH", "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee", DOCS.etherfi);
  book["ether.fi"] = book.etherfi;
  book["ether.fi-stake"] = book.etherfi;

  // https://kelp.gitbook.io/kelp/contracts/rs-eth-contract-addresses
  push(book.kelp, eth, "LRT deposit pool", "0x036676389e48133B63a802f8635AD39E752D375D", DOCS.kelp);
  push(book.kelp, eth, "rsETH", "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7", DOCS.kelp);

  // https://docs.renzoprotocol.com/docs/contracts/ethereum
  push(book.renzo, eth, "Restake manager", "0x74a09653A083691711cF8215a6ab074BB4e99ef5", DOCS.renzo);
  push(book.renzo, eth, "ezETH", "0xbf5495Efe5DB9ce00f80364C8B423567e58d2110", DOCS.renzo);

  // Sky chainlog getAddress: USDS, DAI_USDS, SUSDS. https://developers.skyeco.com/protocol/tokens/usds/
  // sDAI asset() is DAI. https://docs.makerdao.com/smart-contract-modules/dai-module/sdai-core-module
  for (const key of ["sky", "maker"]) {
    push(book[key], eth, "DAI", COMMON_TOKENS.DAI.ethereum, DOCS.sky);
    push(book[key], eth, "USDS", "0xdC035D45d973E3EC169d2276DDab16f1e407384F", DOCS.sky);
    push(book[key], eth, "DAI/USDS converter", "0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A", DOCS.sky);
    push(book[key], eth, "sUSDS", "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD", "https://developers.skyeco.com/protocol/tokens/susds/");
    push(book[key], eth, "sDAI", "0x83F20F44975D03b1b09e64809B757c47f942BEeA", "https://docs.makerdao.com/smart-contract-modules/dai-module/sdai-core-module");
  }
  // https://docs.ethena.fi/technical-design/key-addresses — mint is whitelisted; stake is the public path
  for (const key of ["ethena"]) {
    push(book[key], eth, "USDe", "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3", DOCS.ethena);
    push(book[key], eth, "sUSDe", "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497", DOCS.ethena);
  }
  push(book.circle, eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  push(book.usdc, eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  push(book.tether, eth, "USDT", COMMON_TOKENS.USDT.ethereum, DOCS.usdt);
  push(book.usdt, eth, "USDT", COMMON_TOKENS.USDT.ethereum, DOCS.usdt);
  // https://docs.frax.com/frxusd/frxusd-contracts — Ethereum sfrxUSD maxDeposit is 0
  for (const key of ["frax", "frax-finance"]) {
    push(book[key], eth, "frxUSD", "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29", DOCS.frax);
    push(book[key], eth, "sfrxUSD", "0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6", DOCS.frax);
  }
  // BUIDL address is already in .sample.env. https://securitize.io/blackrock/BUIDL
  for (const key of ["buidl", "securitize", "blackrock-buidl"]) {
    push(book[key], eth, "BUIDL", "0x7712c34205737192402172409a8F7ccef8aA2AEc", DOCS.buidl);
  }
  // https://docs.ondo.finance/addresses
  for (const key of ["ondo", "ondo-finance"]) {
    push(book[key], eth, "USDY", "0x96F6eF951840721AdBF46Ac996b59E0235CB985C", DOCS.ondo);
    push(book[key], eth, "USDY oracle", "0x87b126e5518b6a1Bb8465779b4607C45C643DF90", DOCS.ondo);
    push(book[key], eth, "OUSG", "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92", DOCS.ondo);
    push(book[key], eth, "Ondo oracle", "0x9Cad45a8BF0Ed41Ff33074449B357C7a1fAb4094", DOCS.ondo);
  }
  // https://docs.superstate.com/investors/smart-contracts
  for (const key of ["superstate", "ustb"]) {
    push(book[key], eth, "USTB", "0x43415eB6ff9DB7E26A15b704e7A3eDCe97d31C4e", DOCS.superstate);
    push(book[key], eth, "USTB price oracle", "0xE4fA682f94610cCd170680cc3B045d77D9E528a8", DOCS.superstate);
  }
  // https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses
  for (const key of ["arbitrum", "arbitrum-bridge"]) {
    push(book[key], eth, "Inbox", "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f", DOCS.arbitrum);
    push(book[key], eth, "Bridge", "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a", DOCS.arbitrum);
  }
  // https://docs.base.org/base-chain/network-information/base-contracts
  for (const key of ["base", "base-bridge"]) {
    push(book[key], eth, "L1StandardBridge", "0x3154Cf16ccdb4C6d922629664174b904d80F2C35", DOCS.base);
    push(book[key], eth, "OptimismPortal", "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e", DOCS.base);
  }
  // https://docs.optimism.io/chain/addresses
  for (const key of ["optimism", "optimism-bridge"]) {
    push(book[key], eth, "L1StandardBridge", "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1", DOCS.optimism);
    push(book[key], eth, "OptimismPortal", "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed", DOCS.optimism);
  }
  // GMX V1 on Arbitrum, sunset and read-only. Addresses from the archived official list.
  push(book.gmx, "arbitrum", "Vault", "0x489ee077994B6658eAfA855C308275EAd8097C4A", DOCS.gmx);
  push(book.gmx, "arbitrum", "GlpManager", "0x3963FfC9dff443c2A94f21b129D429891E32ec18", DOCS.gmx);
  push(book.gmx, "arbitrum", "GlpRewardRouter", "0xB95DB5B167D75e6d04227CfFFA61069348d271F5", DOCS.gmx);
  push(book.gmx, "arbitrum", "GLP", "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258", DOCS.gmx);
  // https://docs.across.to/chains-and-contracts — Ethereum SpokePool 0x5c7B…35C5
  push(book.across, eth, "SpokePool", "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5", DOCS.across);
  // https://docs.stargate.finance/resources/contracts/mainnet-contracts
  for (const key of ["stargate", "stargate-finance"]) {
    push(book[key], eth, "StargatePoolUSDC", "0xc026395860Db2d07ee33e05fE50ed7bD583189C7", DOCS.stargate);
    push(book[key], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  }

  // Steakhouse USDC, MetaMorpho V1. https://app.morpho.org/ethereum/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB/steakhouse-usdc
  for (const key of ["steakhouse", "steakhouse-financial"]) {
    push(book[key], eth, "Steakhouse USDC", "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB", DOCS.steakhouse);
    push(book[key], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  }
  // Gauntlet USDC Prime, MetaMorpho V1. The V2 vault 0x8c106EED…A3D0 has maxDeposit 0.
  // https://app.morpho.org/ethereum/vault/0xdd0f28e19C1780eb6396170735D45153D261490d/gauntlet-usdc-prime
  for (const key of ["gauntlet"]) {
    push(book[key], eth, "Gauntlet USDC Prime", "0xdd0f28e19C1780eb6396170735D45153D261490d", DOCS.gauntlet);
    push(book[key], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  }
  // Sentora RLUSD Main is Morpho Vault V2 on Ethereum. maxDeposit was 0 when checked.
  // https://app.morpho.org/ethereum/vault/0x6dC58a0FdfC8D694e571DC59B9A52EEEa780E6bf/sentora-rlusd-main
  for (const key of ["sentora", "sentora-curator"]) {
    push(book[key], eth, "Sentora RLUSD Main", "0x6dC58a0FdfC8D694e571DC59B9A52EEEa780E6bf", DOCS.sentora);
    push(book[key], eth, "RLUSD", "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD", DOCS.rlusd);
  }
  // Yearn V3 USDC-1. https://yearn.fi/v3/1/0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204
  for (const key of ["yearn", "yearn-finance"]) {
    push(book[key], eth, "USDC-1 yVault", "0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204", DOCS.yearn);
    push(book[key], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  }
  // First non-deprecated Ethereum Earn vault in euler-labels 1/earn-vaults.json.
  // https://docs.euler.finance/developers/euler-earn/
  for (const key of ["euler", "euler-v2"]) {
    push(book[key], eth, "K3 Capital Earn USDC", "0x3B4802FDb0E5d74aA37d58FD77d63e93d4f9A4AF", DOCS.euler);
    push(book[key], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  }
  // ether.fi Liquid ETH is a Veda BoringVault. Teller.deposit is a public capability; bulkWithdraw is not.
  for (const key of ["veda"]) {
    push(book[key], eth, "Liquid ETH BoringVault", "0xf0bb20865277aBd641a307eCe5Ee04E79073416C", DOCS.veda);
    push(book[key], eth, "Teller", "0x9AA79C84b79816ab920bBcE20f8f74557B514734", DOCS.veda);
    push(book[key], eth, "WETH", COMMON_TOKENS.WETH.ethereum, "https://docs.veda.tech/integrations/deposits-and-withdrawals-overview");
  }
  // Vault address is the Ethereum example in the Upshift fee-sharing docs. Receipt token is sentUSD.
  for (const key of ["upshift"]) {
    push(book[key], eth, "Sentora USD vault", "0x74aD2F789Ed583DBd141bbdafC673fE1F033718b", DOCS.upshift);
    push(book[key], eth, "sentUSD", "0xe8aA1A9eC6b9BC455D8f33E4BDC685dedFf82407", DOCS.upshift);
    push(book[key], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  }
  // https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/README.md — mainnet StrategyManager, DelegationManager, stETH strategy
  for (const key of ["eigenlayer", "eigencloud"]) {
    push(book[key], eth, "StrategyManager", "0x858646372CC42E1A627fcE94aa7A7033e7CF075A", DOCS.eigenlayer);
    push(book[key], eth, "DelegationManager", "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A", DOCS.eigenlayer);
    push(book[key], eth, "stETH strategy", "0x93c4b944D05dfe6df7645A86cd2206016c51564D", DOCS.eigenlayer);
    push(book[key], eth, "stETH", COMMON_TOKENS.stETH.ethereum, DOCS.lido);
  }
  // Docs list the factory. They do not publish one permissionless vault.
  for (const key of ["symbiotic"]) {
    push(book[key], eth, "VaultFactory", "0xAEb6bdd95c502390db8f52c8909F703E9Af6a346", DOCS.symbiotic);
  }
  // https://github.com/SwellNetwork/v3-core-public/blob/master/contracts/lrt/contracts/implementations/RswETH.sol
  for (const key of ["swell", "swell-liquid-restaking"]) {
    push(book[key], eth, "rswETH", "0xFAe103DC9cf190eD75350761e95403b7b8aFa6c0", DOCS.swell);
  }
  // PufferVault (pufETH). depositETH(address) is the public ETH path.
  for (const key of ["puffer", "puffer-stake"]) {
    push(book[key], eth, "pufETH", "0xD9A442856C234a39a81a089C06451EBAa4306a72", DOCS.puffer);
  }
  // RockawayX USDC Yield, Morpho Vault V2 curated by RockawayX. All four gates are unset.
  // https://app.morpho.org/ethereum/vault/0xE0181090c22579B6A217f1522cbf8c9f1F0C1965/rockawayx-usdc-yield
  push(book.rockawayx, eth, "RockawayX USDC Yield (Vault V2)", "0xE0181090c22579B6A217f1522cbf8c9f1F0C1965", DOCS.rockawayx);
  push(book.rockawayx, eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  // https://docs.curve.finance/developer/deployments — Ethereum: Llamalend V1 one-way-lending-factory,
  // Llamalend V2 lending-factory, crvUSD (Tokens). The wstETH-long vault is OneWayLendingFactory.vaults(13)
  // on that factory; its borrowed token is crvUSD and its collateral is wstETH.
  for (const key of ["llamalend", "curve-llamalend"]) {
    push(book[key], eth, "Llamalend V1 OneWayLendingFactory", "0xeA6876DDE9e3467564acBeE1Ed5bac88783205E0", DOCS.curve);
    push(book[key], eth, "Llamalend V2 LendFactory", "0x8f6B56EC5ddF1F2691a1059f1D3cd97Ac9EaB0bd", DOCS.curve);
    push(book[key], eth, "Llamalend wstETH-long vault (factory vaults(13))", "0x21CF1c5Dc48C603b89907FE6a7AE83EA5e3709aF", DOCS.curve);
    push(book[key], eth, "crvUSD", "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", DOCS.curve);
  }
  // https://docs.dolomite.io/smart-contract-addresses/core-immutable and /core-routers — Ethereum Mainnet
  push(book.dolomite, eth, "DolomiteMargin", "0x003Ca23Fd5F0ca87D01F6eC6CD14A8AE60c2b97D", DOCS.dolomite);
  push(book.dolomite, eth, "DepositWithdrawalRouter", "0xf8b2c637A68cF6A17b1DF9F8992EeBeFf63d2dFf", DOCS.dolomiteRouters);
  push(book.dolomite, eth, "BorrowPositionRouter", "0xF579b345cdA0860668b857De10ABD62442133D0F", DOCS.dolomiteRouters);
  push(book.dolomite, eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  // https://docs.re.xyz/products/smart-contracts — Ethereum tokens and NAV oracles. Mint is KYC-gated.
  push(book.re, eth, "reUSD", "0x5086bf358635B81D8C47C66d1C8b9E567Db70c72", DOCS.re);
  push(book.re, eth, "reUSDe", "0xdDC0f880ff6e4e22E4B74632fBb43Ce4DF6cCC5a", DOCS.re);
  push(book.re, eth, "reUSD NAV oracle", "0xb45AC37Cc7fF7ec317e7D8C308781ECe431639f6", DOCS.re);
  push(book.re, eth, "reUSDe NAV oracle", "0x7844441f13C61CBD3d297F5d2D7fcaBf17f0b843", DOCS.re);
  // Nest (Plume Vaults) share tokens and USDC NestVaults. The Nest API lists chainId 1 for these
  // NestVaults (https://api.nest.credit/v1/vaults/nest-alpha-vault). Deposits need a Predicate attestation.
  push(book["plume-vaults"], eth, "nALPHA share token", "0x593cCcA4c4bf58b7526a4C164cEEf4003C6388db", DOCS.nestAlpha);
  push(book["plume-vaults"], eth, "nALPHA USDC NestVault", "0x0342EE795e7864319fB8D48651b47feBf1163C34", DOCS.nestAlpha);
  push(book["plume-vaults"], eth, "nBASIS share token", "0x11113Ff3a60C2450F4b22515cB760417259eE94B", DOCS.nestBasis);
  push(book["plume-vaults"], eth, "nBASIS USDC NestVault", "0x5F35D1cef957467F4c7b35B36371355170A0DbB1", DOCS.nestBasis);
  // https://docs.maple.finance/integrate/ethereum-mainnet/smart-contract-integration — deposits are
  // permissioned through SyrupRouter + PoolPermissionManager.
  push(book.maple, eth, "syrupUSDC (PoolV2)", "0x80ac24aA929eaF5013f6436cdA2a7ba190f5Cc0b", DOCS.maple);
  push(book.maple, eth, "syrupUSDC SyrupRouter", "0x134cCaaA4F1e4552eC8aEcb9E4A2360dDcF8df76", DOCS.maple);
  push(book.maple, eth, "syrupUSDC WithdrawalManagerQueue", "0x1bc47a0Dd0FdaB96E9eF982fdf1F34DC6207cfE3", DOCS.maple);
  push(book.maple, eth, "syrupUSDT (PoolV2)", "0x356B8d89c1e1239Cbbb9dE4815c39A1474d5BA7D", DOCS.maple);
  push(book.maple, eth, "PoolPermissionManager", "0xBe10aDcE8B6E3E02Db384E7FaDA5395DD113D8b3", DOCS.maple);


  // Lista liquid staking (slisBNB) on BSC.
  // https://docs.bsc.lista.org/for-developer/liquid-staking-slisbnb/smart-contract
  for (const key of ["lista-liquid-staking", "lista"]) {
    push(book[key], "bsc", "ListaStakeManager", "0x1adB950d8bB3dA4bE104211D5AB038628e477fE6", DOCS.listaStake);
    push(book[key], "bsc", "slisBNB", "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B", DOCS.listaStake);
  }
  // Lista DAO lending (Moolah) on BSC.
  // https://docs.bsc.lista.org/for-developer/lista-lending/smart-contract/smart-contract-bsc-core
  for (const key of ["lista-dao"]) {
    push(book[key], "bsc", "Moolah", "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C", DOCS.listaLending);
    push(book[key], "bsc", "MoolahVault (USDT)", "0x6d6783C146F2B0B2774C1725297f1845dc502525", DOCS.listaLending);
    push(book[key], "bsc", "USDT", COMMON_TOKENS.USDT.bsc, DOCS.listaLending);
  }
  // Venus Core Pool on BSC.
  // https://docs-v4.venus.io/deployed-contracts/markets
  for (const key of ["venus-core-pool", "venus"]) {
    push(book[key], "bsc", "Comptroller (Unitroller)", "0xfD36E2c2a6789Db23113685031d7F16329158384", DOCS.venus);
    push(book[key], "bsc", "vUSDC", "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8", DOCS.venus);
    push(book[key], "bsc", "vUSDT", "0xfD5840Cd36d94D7229439859C0112a4185BC0255", DOCS.venus);
    push(book[key], "bsc", "USDC", COMMON_TOKENS.USDC.bsc, DOCS.venus);
  }
  // USD.AI on Arbitrum hub. Protocol mint/redeem is whitelisted; staking USDai→sUSDai is open.
  // https://docs.usd.ai/technical-overview/contract-addresses
  for (const key of ["usd-ai", "usdai"]) {
    push(book[key], "arbitrum", "USDai", "0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF", DOCS.usdai);
    push(book[key], "arbitrum", "sUSDai", "0x0B2b2B2076d95dda7817e785989fE353fe955ef9", DOCS.usdai);
  }
  // Spark Savings Vaults V2 (spUSDC etc). Separate from SparkLend (book.spark).
  // https://docs.spark.fi/dev/savings/spark-vaults-v2
  push(book["spark-vaults"], eth, "Spark Savings USDC (spUSDC)", "0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d", DOCS.sparkVaults);
  push(book["spark-vaults"], eth, "Spark Savings USDT (spUSDT)", "0xe2e7a17dFf93280dec073C995595155283e3C372", DOCS.sparkVaults);
  push(book["spark-vaults"], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  // f(x) Protocol: fxUSD + arUSD (ERC-4626 over rUSD).
  // https://docs.aladdin.club/f-x-protocol/contracts
  for (const key of ["fx-protocol", "fx"]) {
    push(book[key], eth, "fxUSD", "0x085780639CC2cACd35E474e71f4d000e2405d8f6", DOCS.fx);
    push(book[key], eth, "rUSD", "0x65D72AA8DA931F047169112fcf34f52DbaAE7D18", DOCS.fx);
    push(book[key], eth, "arUSD (4626)", "0x07D1718fF05a8C53C8F05aDAEd57C0d672945f9a", DOCS.fx);
    push(book[key], eth, "Market (stETH beta=0.1)", "0xe7b9c7c9cA85340b8c06fb805f7775e3015108dB", DOCS.fx);
  }
  // IPOR Fusion factory only — curator vaults are cloned per deployment.
  // https://docs.ipor.io/build-on-fusion/developer-guide/addresses
  push(book["fusion-by-ipor"], eth, "IporFusionFactoryProxy", "0xcd05909C4A1F8E501e4ED554cEF4Ed5E48D9b852", DOCS.iporFusion);
  // Avalon SuperEarn: user deposits are on Kaia via SuperEarnRouter; Ethereum holds remote vaults.
  // https://docs.superearn.io/en/developers/smart-contracts
  push(book["avalon-superearn"], eth, "Super Vault (USDC remote)", "0x9E3E70f4d09bcfe08F456C426EB90f7aA6F70dF2", DOCS.avalon);
  push(book["avalon-superearn"], eth, "CooldownVault (USDC)", "0x8E53CdAa89381c203a074fB3388f65936358f200", DOCS.avalon);
  push(book["avalon-superearn"], eth, "Super Vault (USDT remote)", "0x7Eec57beB20576Cb35c500aE5826e16960aA878b", DOCS.avalon);

  // LayerZero V2 messaging on Ethereum (eid 30101). Value sits in each OApp/OFT, not the endpoint.
  // https://docs.layerzero.network/v2/deployments/chains/ethereum
  push(book["layerzero-v2"], eth, "EndpointV2", "0x1a44076050125825900e736c501f859c50fE728c", DOCS.layerzero);
  push(book["layerzero-v2"], eth, "SendUln302", "0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1", DOCS.layerzero);
  push(book["layerzero-v2"], eth, "ReceiveUln302", "0xc02Ab410f0734EFa3F14628780e6e695156024C2", DOCS.layerzero);
  push(book["layerzero-v2"], eth, "LZ Executor", "0x173272739Bd7Aa6e4e214714048a9fE699453059", DOCS.layerzero);
  // World Chain (OP Stack) L1 contracts.
  // https://docs.world.org/world-chain/developers/world-chain-contracts
  push(book["world-chain"], eth, "L1StandardBridgeProxy", "0x470458C91978D2d929704489Ad730DC3E3001113", DOCS.worldChain);
  push(book["world-chain"], eth, "OptimismPortalProxy", "0xd5ec14a83B7d95BE1E2Ac12523e2dEE12Cbeea6C", DOCS.worldChain);
  push(book["world-chain"], eth, "SystemConfigProxy", "0x6ab0777fD0e609CE58F939a7F70Fe41F5Aa6300A", DOCS.worldChain);
  // StarkGate ETH bridge on Ethereum and the Starknet core contract that relays L1→L2 messages.
  push(book["starknet-bridge"], eth, "StarkGate ETH bridge", "0xae0Ee0A63A2cE6BaeEFFE56e7714FB4EFE48D419", DOCS.starkgate);
  push(book["starknet-bridge"], eth, "StarkGate USDC bridge", "0xF6080D9fbEEbcd44D89aFfBFd42F098cbFf92816", DOCS.starkgate);
  push(book["starknet-bridge"], eth, "Starknet core contract", "0xc662c410C0ECf747543f5bA90660f6ABeBD9C8c4", DOCS.starknetCore);
  // Binance wBETH. The same address is used on Ethereum and BNB Chain.
  push(book["binance-staked-eth"], eth, "wBETH", "0xa2E3356610840701BDf5611a53974510Ae27E2e1", DOCS.wbeth);
  // Lighter's main Ethereum contract: collateral, deposits, secure withdrawals.
  push(book["lighter-bridge"], eth, "Lighter (ZkLighter proxy)", "0x3B4D794a66304F130a4Db8F2551B0070dfCf5ca7", DOCS.lighter);
  push(book["lighter-bridge"], eth, "USDC", COMMON_TOKENS.USDC.ethereum, DOCS.usdc);
  // Meta Pool on Ethereum. The docs list spETH; the older mpETH contract returns "contract is paused".
  for (const key of ["meta-pool", "meta-pool-eth"]) {
    push(book[key], eth, "spETH (ERC-4626 staking)", "0xD06f6a56c5f599cB375B616DF306f32B7F6f4A0E", DOCS.metaPool);
    push(book[key], eth, "Liquid Unstake Pool", "0xdF261F967E87B2aa44e18a22f4aCE5d7f74f03Cc", DOCS.metaPool);
  }
  // Polygon PoS bridge on Ethereum.
  push(book["polygon-bridge"], eth, "RootChainManagerProxy", "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77", DOCS.polygonPos);
  push(book["polygon-bridge"], eth, "EtherPredicateProxy", "0x8484Ef722627bf18ca5Ae6BcF031c23E6e922B30", DOCS.polygonPos);
  push(book["polygon-bridge"], eth, "ERC20PredicateProxy", "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf", DOCS.polygonPos);
  // Robinhood Chain (Arbitrum Orbit) L1 contracts.
  push(book["robinhood-chain-bridge"], eth, "Delayed Inbox", "0x1A07cc4BD17E0118BdB54D70990D2158AbAD7a2D", DOCS.robinhoodChain);
  push(book["robinhood-chain-bridge"], eth, "Bridge", "0xDf8755334ce7A73cCF6b581C02eA649AE3E864b3", DOCS.robinhoodChain);
  push(book["robinhood-chain-bridge"], eth, "Outbox", "0xf0ce991ea4A0d2400A4AB49b20ae333f6Dce3DE9", DOCS.robinhoodChain);
  push(book["robinhood-chain-bridge"], eth, "Rollup", "0x23A19d23e89166adedbDcB432518AB01e4272D94", DOCS.robinhoodChain);
  // NEAR Omni Bridge on Ethereum (initTransfer locks ETH/ERC-20 for NEAR).
  push(book["near-bridge"], eth, "Omni Bridge", "0xe00c629aFaCCb0510995A2B95560E446A24c85B9", DOCS.omniBridge);
  // Portal = Wormhole Wrapped Token Transfers (Token Bridge) + the Core Contract that publishes its messages.
  push(book.portal, eth, "Token Bridge (WTT)", "0x3ee18B2214AFF97000D974cf647E7C347E8fa585", DOCS.wormhole);
  push(book.portal, eth, "Wormhole Core", "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B", DOCS.wormhole);
  // Chainlink CCIP on Ethereum (chain selector 5009297550715157269).
  push(book.ccip, eth, "Router", "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D", DOCS.ccip);
  push(book.ccip, eth, "TokenAdminRegistry", "0xb22764f98dD05c789929716D677382Df22C05Cb6", DOCS.ccip);
  push(book.ccip, eth, "OnRamp (Ethereum lanes incl. Base)", "0xc3423F3FB30857D9C14717b119884b1B63d250b7", DOCS.ccip);
  push(book.ccip, eth, "LINK LockReleaseTokenPool", "0x1B7492C3bD23A4aDB448710e4275FF14A5288932", DOCS.ccipLink);
  // StakeWise V3 on Ethereum.
  for (const key of ["stakewise-v3", "stakewise"]) {
    push(book[key], eth, "Genesis Vault", "0xAC0F906E433d58FA868F936E8A43230473652885", DOCS.stakewise);
    push(book[key], eth, "osETH (OsToken)", "0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38", DOCS.stakewise);
    push(book[key], eth, "OsTokenVaultController", "0x2A261e60FB14586B474C208b1B7AC6D0f5000306", DOCS.stakewise);
    push(book[key], eth, "VaultsRegistry", "0x3a0008a588772446f6e656133C2D5029CC4FC20E", DOCS.stakewise);
  }
  // Clearstar Morpho Vault V2s. The Base cbAssets vault is the largest.
  push(book.clearstar, "base", "Clearstar cbAssets Vault (USDC, Vault V2)", "0x91C056B6d4311a743614FBc03ac32d4E6A2d3a3c", DOCS.clearstar);
  push(book.clearstar, eth, "Clearstar USDC Core (Vault V2)", "0x69A238Ae7ebeb3c53ff3B544E48B96a2142fc284", DOCS.clearstarEth);
  // Hyperithm Morpho Vault V2s. Monad holds most of the row; the fork test runs the Ethereum vault.
  push(book.hyperithm, eth, "Hyperithm USDC Apex (Vault V2)", "0x093272C07700d3cA5301C3Bf9B3A392624179E2F", DOCS.hyperithm);
  push(book.hyperithm, "monad", "Hyperithm USDC Apex (Vault V2)", "0x78999cc96d2Ba0341588C60CcB0E91c6C33CF371", DOCS.hyperithmMonad);
  // Concrete Earn V2 async vaults on Ethereum.
  push(book.concrete, eth, "Concrete Decentralized Finance USDT (ctDefiUSDT)", "0x0E609b710da5e0AA476224b6c0e5445cCc21251E", DOCS.concrete);
  push(book.concrete, eth, "Concrete Delta WeETH (ctDeltaWeETH)", "0xB9DC54c8261745CB97070CeFBE3D3d815aee8f20", DOCS.concrete);
  // K3 Capital curates the Euler Earn vault that fork:euler:deposit runs.
  push(book["k3-capital"], eth, "K3 Capital Earn USDC (Euler Earn)", "0x3B4802FDb0E5d74aA37d58FD77d63e93d4f9A4AF", DOCS.euler);
  // Rootstock Token Bridge, Ethereum side (sunset end of March 2026). Most of the row is the Powpeg on Bitcoin.
  push(book["rsk-bridge"], eth, "Token Bridge (Ethereum, sunset)", "0x12eD69359919Fc775bC2674860E8Fe2d2b6a7B5D", DOCS.rskTokenBridge);
  push(book["rsk-bridge"], eth, "Federation (Ethereum)", "0x5e29C223d99648C88610519f96E85E627b3ABe17", DOCS.rskTokenBridge);
  push(book["rsk-bridge"], eth, "AllowTokens (Ethereum)", "0xA3FC98e0a7a979677BC14d541Be770b2cb0A15F3", DOCS.rskTokenBridge);
  // Huma PST on Ethereum (a CCIP cross-chain token; PST is minted on Solana).
  push(book.huma, eth, "PST (Ethereum)", "0x22aE3D9a738471f405169Af055d31c687087d4c7", DOCS.humaPst);
  // Curvance on Monad, WMON | USDC market (DeFi Bluechip).
  push(book.curvance, "monad", "MarketManager (WMON | USDC)", "0xa6A2A92F126b79Ee0804845ee6B52899b4491093", DOCS.curvanceMonad);
  push(book.curvance, "monad", "cWMON (WMON | USDC)", "0x1e240E30E51491546deC3aF16B0b4EAC8Dd110D4", DOCS.curvanceMonad);
  push(book.curvance, "monad", "cUSDC (WMON | USDC)", "0x8EE9FC28B8Da872c38A496e9dDB9700bb7261774", DOCS.curvanceMonad);
  // Saturn USDat / sUSDat on Ethereum.
  push(book.saturn, eth, "USDat", "0x23238f20b894f29041f48D88eE91131C395Aaa71", DOCS.saturn);
  push(book.saturn, eth, "sUSDat (StakedUSDat, ERC-4626)", "0xD166337499E176bbC38a1FBd113Ab144e5bd2Df7", DOCS.saturn);
  push(book.saturn, eth, "Withdraw contract (WithdrawalQueueERC721)", "0x4Bc9FEC04F0F95e9b42a3EF18F3C96fB57923D2e", DOCS.saturn);
  // Aladdin Concentrator on Ethereum.
  push(book.concentrator, eth, "AladdinCRV (aCRV)", "0x2b95A1Dcc3D405535f9ed33c219ab38E8d7e0884", DOCS.concentrator);
  push(book.concentrator, eth, "CvxCrvStakingWrapperStrategy", "0x94cC627Db80253056B2130aAC39abB252A75F345", DOCS.concentrator);
  push(book.concentrator, eth, "AladdinSdCRV (asdCRV)", "0x43E54C2E7b3e294De3A155785F52AB49d87B9922", DOCS.concentrator);
  push(book.concentrator, eth, "CvxCompounder (aCVX)", "0xb0903Ab70a7467eE5756074b31ac88aEBb8fB777", DOCS.concentrator);
  // Olympus Cooler V2 (MonoCooler) on Ethereum.
  push(book["cooler-loans"], eth, "Cooler V2 (MonoCooler)", "0xdb591Ea2e5Db886dA872654D58f6cc584b68e7cC", DOCS.olympus);
  push(book["cooler-loans"], eth, "Cooler V2 LTV Oracle", "0x9ee9f0c2e91E4f6B195B988a9e6e19efcf91e8dc", DOCS.olympus);
  push(book["cooler-loans"], eth, "Cooler V2 Treasury Borrower", "0xD58d7406E9CE34c90cf849Fc3eed3764EB3779B0", DOCS.olympus);
  push(book["cooler-loans"], eth, "gOHM", "0x0ab87046fBb341D058F17CBC4c1133F25a20a52f", DOCS.olympus);
  // stake.link LINK staking on Ethereum.
  for (const key of ["stake.link", "stake.link-liquid"]) {
    push(book[key], eth, "LINK Priority Pool", "0xDdC796a66E8b83d0BcCD97dF33A6CcFBA8fd60eA", DOCS.stakeLink);
    push(book[key], eth, "LINK Staking Pool (stLINK)", "0xb8b295df2cd735b15BE5Eb419517Aa626fc43cD5", DOCS.stakeLink);
    push(book[key], eth, "LINK Withdrawal Pool", "0xa60B5146E44ff755e32BD51532842ceB41D0C248", DOCS.stakeLink);
    push(book[key], eth, "wstLINK", "0x911D86C72155c33993d594B0Ec7E6206B4C803da", DOCS.stakeLink);
  }
  // Fluid Lite (Instadapp Lite) vault receipt tokens on Ethereum (ERC-4626).
  push(book["fluid-lite"], eth, "iETHv2 (stETH vault)", "0xA0D3707c569ff8C87FA923d3823eC5D81c98Be78", DOCS.fluidLite);
  push(book["fluid-lite"], eth, "fLiteUSD (USDC vault)", "0x273DA948ACa9261043fbdb2a857BC255ECC29012", DOCS.fluidLite);
  // Ember EVM vaults on Ethereum (ERC-4626 deposit, queued redeemShares). The largest public USDC vaults.
  push(book["ember-protocol"], eth, "Ember Earn (eEARN)", "0x9be9294722f8AAd37b11a9792Be2C782182caFA2", DOCS.ember);
  push(book["ember-protocol"], eth, "Bitwise Premium+ RWA (PPLUS)", "0xbc5d3722376d44f3bC316C6EA61C9Bd553Be8CBe", DOCS.ember);
  push(book["ember-protocol"], eth, "Pharos Alpha (pALPHA)", "0xC3AaCb558aFB635307B66FDb405188138576fc4c", DOCS.ember);
  // Lombard on Ethereum. The Veda Teller for LBTCv is not on Lombard's contract page, so it is not listed.
  push(book["lombard-vaults"], eth, "LBTCv (Lombard DeFi Vault)", "0x5401b8620E5FB570064CA9114fd1e135fd77D57c", DOCS.lombard);
  push(book["lombard-vaults"], eth, "BTCe", "0x3a4baaBf4DC9910596821615e848f0e6545762F3", DOCS.lombard);
  push(book["lombard-vaults"], eth, "LBTC", "0x8236a87084f8B84306f72007F36F2618A5634494", DOCS.lombard);
  // Vesper 2 (Vesper USD) on Ethereum.
  push(book.vesper, eth, "USDv (PeggedToken)", "0xC9aD6eD9f522e8Ac2dE8FFc8B081005CCE50c8AB", DOCS.vesper);
  push(book.vesper, eth, "sUSDv (StakingVault, ERC-4626)", "0x7473Da16F17abA0D920605e1F9560A99a6F6314A", DOCS.vesper);
  push(book.vesper, eth, "Vesper USD Gateway", "0x9a1800B63d40a19539017a8C6F0D005F9c9F8A00", DOCS.vesper);
  push(book.vesper, eth, "Vesper USD Treasury", "0xd4765523Fd844eddF9e6EFe136a48012BCd5503a", DOCS.vesper);
  push(book.vesper, eth, "USDC YieldVault", "0x3aEd4dd0b5ba616156Fa352274670c18D2Ec2A81", DOCS.vesper);
  push(book.vesper, eth, "ETHv (PeggedToken)", "0x2D376B65dCd18F67E596C4cF815Ecadb960E0dEa", DOCS.vesper);
  push(book.vesper, eth, "sETHv (StakingVault)", "0x1E0cFbFA5BD27beC4e26b7fE6F4b55E83C2b4a2c", DOCS.vesper);
  push(book.vesper, eth, "Vesper ETH Gateway", "0xE2976cf9749BE7b6ADdA6707d066ef1D2319A0b4", DOCS.vesper);
  // ether.fi Cash lending protocol on OP Mainnet (both ether.fi Cash rows sit on it).
  for (const key of ["etherfi-borrowing-market", "etherfi-cash-liquid"]) {
    push(book[key], "optimism", "Liquidity Hub (Aave V4)", "0x66753c4e3fC84f1eD0e3C267C927284E9d90C572", DOCS.etherfiCash);
    push(book[key], "optimism", "Spoke (Aave V4)", "0xdffcC3536D932eb51Df51a7F5FA407c4270d5308", DOCS.etherfiCash);
    push(book[key], "optimism", "AaveV4Lens", "0x35Ba1a778359421F2757154a35BD4881AcE98C91", DOCS.etherfiCash);
  }
  // DeFi Saver v3 core on Ethereum.
  push(book["defi-saver-asset-management"], eth, "DFSRegistry", "0x287778F121F134C66212FB16c9b53eC991D32f5b", DOCS.defisaver);
  push(book["defi-saver-asset-management"], eth, "RecipeExecutor", "0xbc3Fc959FeF3F12a41738f406c02198cdeE7481F", DOCS.defisaver);
  push(book["defi-saver-asset-management"], eth, "SafeModuleAuth", "0x7407974DDBF539e552F1d051e44573090912CC3D", DOCS.defisaver);
  // Enzyme Blue (Sulu) on Ethereum.
  push(book["enzyme-finance"], eth, "FundDeployer (Sulu)", "0x4f1C53F096533C04d8157EFB6Bca3eb22ddC6360", DOCS.enzyme);
  push(book["enzyme-finance"], eth, "DepositWrapper", "0x65BbAD6545B7ac9C30Fb0f07e64e25106Bf05eEc", DOCS.enzyme);
  push(book["enzyme-finance"], eth, "ValueInterpreter", "0xD7B0610dB501b15Bfb9B7DDad8b3869de262a327", DOCS.enzyme);
  // Falcon Finance on Ethereum.
  push(book["falcon-finance"], eth, "USDf", "0xFa2B947eEc368f42195f24F36d2aF29f7c24CeC2", DOCS.falcon);
  push(book["falcon-finance"], eth, "sUSDf (ERC-4626 over USDf)", "0xc8CF6D7991f15525488b2A83Df53468D682Ba4B0", DOCS.falcon);
  push(book["falcon-finance"], eth, "sUSDf Staking Rewards Distributor", "0x8AF2EFa47efB2095b80D82577c597186Ea2FFFea", DOCS.falcon);
  push(book["falcon-finance"], eth, "Falcon Position NFT", "0x8407e9864F42374Cb9DACfDEDe0e6962d634edCB", DOCS.falcon);
  // mETH Protocol (Mantle LST) on Ethereum.
  push(book["meth-protocol"], eth, "Staking", "0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f", DOCS.meth);
  push(book["meth-protocol"], eth, "mETH (L1)", "0xd5F7838F5C461fefF7FE49ea5ebaF7728bB0ADfa", DOCS.meth);
  push(book["meth-protocol"], eth, "UnstakeRequestsManager", "0x38fDF7b489316e03eD8754ad339cb5c4483FDcf9", DOCS.meth);
  push(book["meth-protocol"], eth, "Oracle", "0x8735049F496727f824Cc0f2B174d826f5c408192", DOCS.meth);
  // Aera V3 gtUSDa (Gauntlet USD Alpha) multi-depositor vault on Base.
  push(book.aera, "base", "gtUSDa (MultiDepositorVault)", "0x000000000001CdB57E58Fa75Fe420a0f4D6640D5", DOCS.aeraGtusda);
  push(book.aera, "base", "ProvisionerV2 (gtUSDa.provisioner())", "0x128Afda4351deCE9d51Eb9d7e9C687C58cfff731", DOCS.aeraGtusda);
  push(book.aera, "base", "PriceAndFeeCalculator (gtUSDa.feeCalculator())", "0xa90fd5C2020DBf19c6c29609dF85F7e4DBAC30db", DOCS.aeraGtusda);
  // KPK-curated Morpho Vault V2s on Ethereum.
  push(book.kpk, eth, "KPK USDC Prime (Morpho Vault V2)", "0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6", DOCS.kpkUsdcPrime);
  push(book.kpk, eth, "KPK USDC Prime Markets V1 Adapter", "0x1d511811ACA9d8817a3e50F29CadFf6243A02902", DOCS.kpkUsdcPrime);
  push(book.kpk, eth, "KPK USDC Prime Core (Morpho Vault V2)", "0x1a1985F50352b58090eb36425AfdFacbaC7806F4", DOCS.kpkUsdcPrimeCore);
  // Galaxy Curation Morpho Vault V2s on Ethereum.
  push(book["galaxy-curation"], eth, "Galaxy USDC Quality (gUSDCq, Morpho Vault V2)", "0x91600E31fBeDc72433d4a57F16639cfe661Be7d8", DOCS.galaxy);
  push(book["galaxy-curation"], eth, "Galaxy USDT Quality (gUSDTq)", "0x71ffB6a81786eC285D429d531Cf655107B9D878d", DOCS.galaxy);
  push(book["galaxy-curation"], eth, "Galaxy WETH Quality (gWETHq)", "0x1878805799273d10aE96a58201A6f5254CF9824F", DOCS.galaxy);
  push(book["galaxy-curation"], eth, "Galaxy USDC Enhanced (gUSDCe)", "0xd95fE7adF5075fad9D6Bf853E0f9Fe53369E8D96", DOCS.galaxy);
  // OpenTrade vaults on Ethereum (KYC-onboarded lenders only).
  push(book.opentrade, eth, "Flexible Term USDC Vault (XTBT)", "0x0f8CbdC544dC1D4Bd1bDafE0039Be07B825aF82A", DOCS.opentrade);
  push(book.opentrade, eth, "Flexible Term EURC Vault (XEVT)", "0x3Ee320c9F73a84D1717557af00695A34b26d1F1d", DOCS.opentrade);
  push(book.opentrade, eth, "USD Money Market Fund Vault (XMMF)", "0x1e571c87556F216662fa8D25143b1b0618512Ef6", DOCS.opentrade);
  push(book.opentrade, eth, "USD Money Market Fund Vault USDT (XMMF-USDT)", "0xD06f235DF80D4981816F7fB0936973155CDe1f4C", DOCS.opentrade);

  // USDT0 on Ethereum: the OFT Adapter locks USDT for every other USDT0 chain.
  push(book.usdt0, eth, "USDT0 OFT Adapter (locks USDT)", "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee", DOCS.usdt0);
  push(book.usdt0, eth, "USDT (locked asset)", "0xdAC17F958D2ee523a2206206994597C13D831ec7", DOCS.usdt0);
  push(book.usdt0, eth, "XAUT0 OFT Adapter", "0xb9c2321BB7D0Db468f570D10A424d1Cc8EFd696C", DOCS.usdt0);
  push(book.usdt0, eth, "USDT0 IOTA lockbox (OFT Adapter)", "0xAEf027F94008430BF4Fc27FFABB49ea6F1dd3414", DOCS.usdt0);
  // Liquity V1 (LUSD) and V2 (BOLD, ETH branch) on Ethereum.
  push(book.liquity, eth, "V1 StabilityPool", "0x66017D22b0f8556afDd19FC67041899Eb65a21bb", DOCS.liquityV1);
  push(book.liquity, eth, "V1 BorrowerOperations", "0x24179CD81c9e782A4096035f7eC97fB8B783e007", DOCS.liquityV1);
  push(book.liquity, eth, "V1 TroveManager", "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2", DOCS.liquityV1);
  push(book.liquity, eth, "LUSD", "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0", DOCS.liquityV1);
  push(book.liquity, eth, "V2 BOLD", "0x6440f144b7e50D6a8439336510312d2F54beB01D", DOCS.liquityV2);
  push(book.liquity, eth, "V2 CollateralRegistry", "0xf949982B91C8c61e952B3bA942cbbfaef5386684", DOCS.liquityV2);
  push(book.liquity, eth, "V2 ETH branch StabilityPool", "0x5721cbbd64fc7Ae3Ef44A0A3F9a790A9264Cf9BF", DOCS.liquityV2);
  // Convex (Curve) on Ethereum. The 3pool reward pool is Booster.poolInfo(9).crvRewards.
  push(book["convex-finance"], eth, "Booster (main deposit contract)", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", DOCS.convex);
  push(book["convex-finance"], eth, "3pool BaseRewardPool (Booster.poolInfo(9).crvRewards)", "0x689440f2Ff927E1f24c72F1087E1FAF471eCe1c8", DOCS.convex);
  push(book["convex-finance"], eth, "CVX", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B", DOCS.convex);
  push(book["convex-finance"], eth, "cvxCRV", "0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7", DOCS.convex);
  push(book["convex-finance"], eth, "CRV Depositor", "0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae", DOCS.convex);
  push(book["convex-finance"], eth, "CVX Locker (vlCVX)", "0x72a19342e8F1838460eBFCCEf09F6585e32db86E", DOCS.convex);
  // Theo on Ethereum.
  push(book.theo, eth, "thUSD", "0xa3fE5c7596024E6811E14F029937D5bd8Ae485b3", DOCS.theo);
  push(book.theo, eth, "sthUSD (ERC-4626 staking vault)", "0xA808Bc9775cb41c52C7842f8b50427fE7A770326", DOCS.theo);
  push(book.theo, eth, "thUSD Mint & Redeem (whitelisted signed orders)", "0x2D99aC801DC0edadD53f5688FeF2317932E8696e", DOCS.theo);
  push(book.theo, eth, "thBILL", "0x5FA487BCa6158c64046B2813623e20755091DA0b", DOCS.theo);
  push(book.theo, eth, "thBILL minter", "0x8a2c307D1462Ff4fA98c9c119D3A3457AD505Eb1", DOCS.theo);
  // CIAN Yield Layer on Ethereum.
  push(book["cian-yield-layer"], eth, "rsETH Yield Layer vault (ylrsETH)", "0xd87a19fF681AE98BF10d2220D1AE3Fbd374ADE4e", DOCS.cian);
  push(book["cian-yield-layer"], eth, "rsETH Yield Layer RedeemOperator", "0x47DBD71Db64617f6cBD45eB9D9Ba876F40ED239E", DOCS.cian);
  push(book["cian-yield-layer"], eth, "stETH Yield Layer vault (ylstETH)", "0xB13aa2d0345b0439b064f26B82D8dCf3f508775d", DOCS.cian);
  push(book["cian-yield-layer"], eth, "stETH Yield Layer RedeemOperator", "0xdAc6748CbB7CD9DA1868eB7aD598273122f012db", DOCS.cian);
  // SolvBTC on Ethereum.
  push(book.solvbtc, eth, "SolvBTC", "0x7A56E1C57C7475CCf742a1832B028F0456652F97", DOCS.solv);
  push(book.solvbtc, eth, "xSolvBTC", "0xd9D920AA40f578ab794426F5C90F6C731D159DEf", DOCS.solv);
  push(book.solvbtc, eth, "SolvBTC Router", "0x1fF7d7C0A7D8E94046708C611DeC5056A9d2B823", DOCS.solv);
  push(book.solvbtc, eth, "SolvBTC LST RouterV2", "0x3d93B9e8F0886358570646dAd9421564C5fE6334", DOCS.solv);
  // Zama confidential token wrappers on Ethereum.
  push(book.zama, eth, "Wrappers Registry", "0xeb5015fF021DB115aCe010f23F55C2591059bBA0", DOCS.zama);
  push(book.zama, eth, "Confidential USDC (cUSDC)", "0xe978F22157048E5DB8E5d07971376e86671672B2", DOCS.zama);
  push(book.zama, eth, "Confidential USDT (cUSDT)", "0xAe0207C757Aa2B4019Ad96edD0092ddc63EF0c50", DOCS.zama);
  push(book.zama, eth, "Confidential WETH (cWETH)", "0xda9396b82634Ea99243cE51258B6A5Ae512D4893", DOCS.zama);
  push(book.zama, eth, "Zama Token", "0xA12CC123ba206d4031D1c7f6223D1C2Ec249f4f3", DOCS.zama);
  // SSV Network on Ethereum.
  push(book["ssv-network"], eth, "SSV Network (ssvnetwork.eth)", "0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1", DOCS.ssv);
  push(book["ssv-network"], eth, "SSV Network Views (views.ssvnetwork.eth)", "0xafE830B6Ee262ba11cce5F32fDCd760FFE6a66e4", DOCS.ssv);
  // Lagoon protocol contracts on Ethereum (vaults are deployed per curator from the Factory).
  push(book.lagoon, eth, "Vault Factory", "0x8D6f5479B14348186faE9BC7E636e947c260f9B1", DOCS.lagoon);
  push(book.lagoon, eth, "ProtocolRegistry", "0x6dA4D1859bA1d02D095D2246142CdAd52233e27C", DOCS.lagoon);
  push(book.lagoon, eth, "Vault logic v0.6.0", "0x6C77c47FB8168E22976C3B0338CB1769c952249f", DOCS.lagoon);
  // LayerZero V2: the OApp the fork test sends through (EndpointV2 and libraries are listed above).
  push(book["layerzero-v2"], eth, "USDT0 OFT Adapter (OApp used by fork:layerzero:send)", "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee", DOCS.usdt0);
  // Benqi on Avalanche C-Chain.
  push(book["benqi-lending"], "avalanche", "Comptroller", "0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4", DOCS.benqiCore);
  push(book["benqi-lending"], "avalanche", "qiUSDCn (native USDC market)", "0xB715808a78F6041E46d61Cb123C9B4A27056AE9C", DOCS.benqiCore);
  push(book["benqi-lending"], "avalanche", "USDC (native, qiUSDCn underlying)", "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", DOCS.benqiCore);
  push(book["benqi-staked-avax"], "avalanche", "sAVAX (BENQI Staked AVAX)", "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", DOCS.benqi);

  // Fork tests added 2026-11-03 (docs/07-fork-coverage-plan.md).
  book["tornado-cash"] = [];
  push(book["tornado-cash"], eth, "Tornado Cash Classic 0.1 ETH pool", "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", DOCS.tornadoCash);
  book["fluid-dex"] = [];
  push(book["fluid-dex"], eth, "Fluid DEX USDC/native-ETH pool", "0x836951EB21F3Df98273517B7249dCEFF270d34bf", DOCS.fluidDex);

  book["grove"] = [];
  push(book["grove"], "base", "Grove x Steakhouse USDC (Morpho Vault V2, symbol grove-steakUSDC)", "0xbeef0786756810478b88982DE00F3CD7fdB8e7c7", DOCS.groveDoc);
  push(book["grove"], "base", "USDC (Base, the vault asset)", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", DOCS.groveDoc);
  push(book["grove"], "base", "Grove Base Executor (owner() of the vault)", "0x491EDFB0B8b608044e227225C715981a30F3A44E", DOCS.groveDoc);

  book["obol"] = [];
  push(book["obol"], "ethereum", "stOBOL (FixedStakedObol, non-rebasing staked OBOL)", "0x6590cBBCCbE6B83eF3774Ef1904D86A7B02c2fCC", DOCS.obolDoc);
  push(book["obol"], "ethereum", "OBOL token (the staked asset)", "0x0B010000b7624eb9B3DfBC279673C76E9D29D5F7", DOCS.obolDoc);
  push(book["obol"], "ethereum", "ObolStaker (reward-streaming staking contract)", "0x30641013934ec7625c9e73a4D63aab4201004259", DOCS.obolDoc);
  push(book["obol"], "ethereum", "rstOBOL (rebasing staked OBOL, the stOBOL accounting core; read from stOBOL.LST())", "0x1932e815254c53B3Ecd81CECf252A5AC7f0e8BeA", DOCS.obolDoc);

  book["usdd"] = [];
  push(book["usdd"], "ethereum", "USDD PSM — MCD_PSM_USDT_A (UsddPsm, DssPsm fork)", "0xcE355440c00014A229bbEc030A2B8f8EB45a2897", DOCS.usddDoc);
  push(book["usdd"], "ethereum", "USDD (USDD 2.0 token, Ethereum)", "0x4f8e5DE400DE08B164E7421B3EE387f461beCD1A", DOCS.usddDoc);
  push(book["usdd"], "ethereum", "USDT Join — JOIN_PSM_USDT_A (AuthGemJoin, the approval target)", "0x217e42CEB2eAE9ECB788fDF0e31c806c531760A3", DOCS.usddDoc);
  push(book["usdd"], "ethereum", "USDT (Tether USD, the PSM gem, 6 decimals)", "0xdAC17F958D2ee523a2206206994597C13D831ec7", DOCS.usddDoc);

  book["pendle"] = [];
  push(book["pendle"], "ethereum", "Pendle Router V4", "0x888888888889758F76e7103c6CbF23ABbF58F946", DOCS.pendleDoc);
  push(book["pendle"], "ethereum", "Pendle RouterStatic (swapExactTokenForPtStatic quote)", "0x263833d47eA3fA4a30f269323aba6a107f9eB14C", DOCS.pendleDoc);
  push(book["pendle"], "ethereum", "Pendle market PT-stETH-30DEC2027", "0x34280882267ffa6383b363e278b027be083bbe3b", DOCS.pendleDoc);
  push(book["pendle"], "ethereum", "SY stETH (the market's SY)", "0xcbC72d92b2dc8187414F6734718563898740C0BC", DOCS.pendleDoc);
  push(book["pendle"], "ethereum", "PT-stETH-30DEC2027", "0xb253Eff1104802b97aC7E3aC9FdD73AecE295a2c", DOCS.pendleDoc);
  push(book["pendle"], "ethereum", "wstETH (input token, the market's underlyingAsset)", "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", DOCS.pendleDoc);

  book["aster-bridge"] = [];
  push(book["aster-bridge"], "bsc", "Aster Deposit Bridge (AstherusVault, ERC-1967 proxy)", "0x128463A60784c4D3f46c23Af3f65Ed859Ba87974", DOCS["aster-bridgeDoc"]);

  book["bitfi-basis"] = [];
  push(book["bitfi-basis"], "bsc", "bfBTC (BitFi Bitcoin, the BSC basis vault)", "0x623F2774d9f27B59bc6b954544487532CE79d9DF", DOCS["bitfi-basisDoc"]);
  push(book["bitfi-basis"], "bsc", "BTCB (BSC BTC, the vault's underlyingAsset)", "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", DOCS["bitfi-basisDoc"]);

  book["bedrock-unibtc"] = [];
  push(book["bedrock-unibtc"], "ethereum", "Bedrock Vault (TransparentUpgradeableProxy) — the permissionless wrapped-BTC mint", "0x047D41F2544B7F63A8e991aF2068a363d210d6Da", DOCS["bedrock-unibtcDoc"]);
  push(book["bedrock-unibtc"], "ethereum", "uniBTC (Bedrock universal BTC, 8 decimals; the Vault is its only MINTER_ROLE holder)", "0x004E9C3EF86bc1ca1f0bB5C7662861Ee93350568", DOCS["bedrock-unibtcDoc"]);
  push(book["bedrock-unibtc"], "ethereum", "WBTC (Wrapped BTC, 8 decimals) — the token minted against", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", DOCS["bedrock-unibtcDoc"]);

  book["derive-v3"] = [];
  push(book["derive-v3"], "ethereum", "Derive v3 ACTION_MANAGER (OnchainActionManager proxy; depositToNewSubaccount)", "0xE366CcA474968e33b777E13905829A3b800CFAD3", DOCS['derive-v3Doc']);
  push(book["derive-v3"], "ethereum", "Derive v3 WITHDRAWAL_OUTBOX (asset registry: USDC spot label -> USDC token + SPOT_VAULT)", "0x7c743D79C9C595cE332314503d84cBBb4E85FA63", DOCS['derive-v3Doc']);
  push(book["derive-v3"], "ethereum", "Derive v3 SPOT_VAULT (collateral custody; receives the deposit)", "0x2e7dF4fAf35a1599979C7E764444e112d936ec42", DOCS['derive-v3Doc']);
  push(book["derive-v3"], "ethereum", "USDC (Ethereum ERC-20 pulled by the deposit)", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", DOCS['derive-v3Doc']);

  book["railgun"] = [];
  push(book["railgun"], "ethereum", "RailgunSmartWallet (Ethereum proxy, EIP-1967)", "0xFA7093CDD9EE6932B4eb2c9e1cde7CE00B1FA4b9", DOCS['railgunDoc']);
  push(book["railgun"], "ethereum", "RailgunSmartWallet implementation (proxy's implementation slot)", "0xD662C4B1F22AcEb0BEaCdf3A493De6f478686A0C", DOCS['railgunDoc']);
  push(book["railgun"], "ethereum", "USDC (the shielded token)", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", DOCS['railgunDoc']);
  push(book["railgun"], "ethereum", "Railgun Treasury (receives the shield deduction)", "0xE8A8B458BcD1Ececc6b6b58F80929b29cCecFF40", DOCS['railgunDoc']);

  book["fluid-lending"] = [];
  push(book["fluid-lending"], "ethereum", "Fluid fUSDC (fToken_fUSDC, ERC-4626 lending token)", "0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33", DOCS['fluid-lendingDoc']);
  push(book["fluid-lending"], "ethereum", "USDC (fUSDC underlying)", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", DOCS['fluid-lendingDoc']);
  push(book["fluid-lending"], "ethereum", "Fluid Liquidity (liquidity layer that holds all fToken underlying)", "0x52Aa899454998Be5b000Ad077a46Bbe360F4e497", DOCS['fluid-lendingDoc']);

  book["mellow-core"] = [];
  push(book["mellow-core"], "ethereum", "Lido Earn USD (earnUSD), a Mellow Core Vault / MetaVault", "0x014e6DA8F283C4aF65B2AA0f201438680A004452", DOCS['mellow-coreDoc']);
  push(book["mellow-core"], "ethereum", "SyncDepositQueue (USDC) of the earnUSD vault", "0xf6AFAf6afcAe116dD37A779D50fE6c5fa6f8C8f5", DOCS['mellow-coreDoc']);
  push(book["mellow-core"], "ethereum", "ShareManager of earnUSD (share ERC-20, totalShares, whitelist flags)", "0x4Ce1ac8F43E0E5BD7A346A98aF777bF8fbeA1981", DOCS['mellow-coreDoc']);
  push(book["mellow-core"], "ethereum", "Oracle of earnUSD (USDC priceD18 with shares = assets * price)", "0x827044735c9708a2cf850e7Ea37EBa43bc786028", DOCS['mellow-coreDoc']);
  push(book["mellow-core"], "ethereum", "FeeManager of earnUSD (baseAsset, deposit fee)", "0x72fa23f40e08eB9E45953233b2Dd9665E347e8Dc", DOCS['mellow-coreDoc']);
  push(book["mellow-core"], "ethereum", "USDC (Ethereum, the vault asset)", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", DOCS['mellow-coreDoc']);

  book["axelar"] = [];
  push(book["axelar"], "ethereum", "AxelarGateway (Ethereum)", "0x4F4495243837681061C4743b74B3eEdf548D56A5", DOCS['axelarDoc']);
  push(book["axelar"], "ethereum", "AxelarGasService (Ethereum)", "0x2d5d7d31F671F86C782533cc367F14109a082712", DOCS['axelarDoc']);
  push(book["axelar"], "ethereum", "Interchain Token Service (Polygon, message destination)", "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C", DOCS['axelarDoc']);

  book["fraxtal"] = [];
  push(book["fraxtal"], "ethereum", "Fraxtal L1StandardBridgeProxy", "0x34C0bD5877A5Ee7099D0f5688D65F4bB9158BDE2", DOCS['fraxtalDoc']);
  push(book["fraxtal"], "ethereum", "Fraxtal OptimismPortalProxy", "0x36cb65c1967A0Fb0EEE11569C51C2f2aA1Ca6f6D", DOCS['fraxtalDoc']);
  push(book["fraxtal"], "ethereum", "frxUSD (Ethereum; L2 representation 0xFc00000000000000000000000000000000000001)", "0x853d955aCEf822Db058eb8505911ED77F175b99e", DOCS['fraxtalDoc']);

  book["avant"] = [];
  push(book["avant"], "avalanche", "savUSD (Staked avUSD — ERC-4626 vault, symbol savUSD, asset avUSD)", "0x06d47F3fb376649c3A9Dafe069B3D6E35572219E", DOCS['avantDoc']);
  push(book["avant"], "avalanche", "avUSD (Avant USD, the staked asset; 18 decimals)", "0x24dE8771bC5DdB3362Db529Fc3358F2df3A0E346", DOCS['avantDoc']);
  push(book["avant"], "avalanche", "AvantMintingV2 (avUSD's approved minter; read-only evidence that the mint leg is gated)", "0xcb43139E90f019624e3B76C56FB05394B162A49c", DOCS['avantDoc']);

  book["hyperliquid-bridge"] = [];
  push(book["hyperliquid-bridge"], "arbitrum", "Hyperliquid Bridge (Bridge2, Arbitrum USDC escrow)", "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7", DOCS['hyperliquid-bridgeDoc']);
  push(book["hyperliquid-bridge"], "arbitrum", "Arbitrum native USDC (asset the escrow holds; also read back from usdcToken())", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", DOCS['hyperliquid-bridgeDoc']);

  book["polymarket"] = [];
  push(book["polymarket"], "polygon", "ConditionalTokens (Gnosis CTF, Polymarket deployment)", "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045", DOCS['polymarketDoc']);
  push(book["polymarket"], "polygon", "USDC (USDC.e, the CTF collateral)", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", DOCS['polymarketDoc']);
  push(book["polymarket"], "polygon", "UMA CTF Adapter V4 (oracle of regular Polymarket conditions; PolygonScan label 'Polymarket: UMA CTF Adapter V4')", "0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7", DOCS['polymarketDoc']);
  push(book["polymarket"], "polygon", "CTF Exchange V2", "0xE111180000d2663C0091e4f400237545B87B996B", DOCS['polymarketDoc']);
  push(book["polymarket"], "polygon", "CtfCollateralAdapter V2 (unwraps pUSD to USDC.e and splits the CTF)", "0xADa100874d00e3331D00F2007a9c336a65009718", DOCS['polymarketDoc']);
  push(book["polymarket"], "polygon", "pUSD / Polymarket USD (PMCT, the V2 exchange collateral wrapper)", "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB", DOCS['polymarketDoc']);

  book["armitage"] = [];
  push(book["armitage"], "ethereum", "Wintermute USDC Select (Morpho Vault V2, symbol armUSDCs; largest of the seven Armitage-curated vaults)", "0xA2EAaD0D586cF9FD73bb2c09cF6A7E3e187D68cd", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "USDC (Ethereum; asset() of five of the seven vaults)", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Armitage curator (curator() of all seven vaults; a 3-of-6 Gnosis Safe)", "0x4687E45bB5518a995913a24BB2816fe2031d74D8", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Wintermute USDC Prime (Morpho Vault V2, symbol armUSDCp)", "0x5dc53a23AdC9f2Bed98de6F59F7F309a7c71FF2B", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Wintermute USDT Prime (Morpho Vault V2, symbol armUSDTp)", "0xBf29043164660C60A2a72Cd15FFe2304e87B6838", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Wintermute USDT Select (Morpho Vault V2, symbol armUSDTs)", "0x500aE64100D7DbDb640531085C2F5d40cDC8930D", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Pendle Ecosystem USDC (Morpho Vault V2, symbol pendleUSDC)", "0x55C1B6e461a6334B567bAF0FEb5D728715446f05", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Pendle Ecosystem High Yield USDC (Morpho Vault V2, symbol pendleUSDChy)", "0xcf609F8327E68b42AF54F9D529b9f65d68038435", DOCS['armitageDoc']);
  push(book["armitage"], "ethereum", "Wintermute Confidential WBTC (Morpho Vault V2, symbol armcWBTC)", "0x3d5EcCb62974178236A768A7ef14D3ce468Fbe91", DOCS['armitageDoc']);

  book["xdai-stake-bridge"] = [];
  push(book["xdai-stake-bridge"], "ethereum", "xDAI Stake Bridge, Ethereum side (POA EternalStorageProxy; implementation 0x257bDD093Cab1Bd39eBF837dCB60f33d031d7d49)", "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016", DOCS['xdai-stake-bridgeDoc']);
  push(book["xdai-stake-bridge"], "ethereum", "USDS (the bridge's collateral: erc20token(); locked on Ethereum, xDAI minted on Gnosis)", "0xdC035D45d973E3EC169d2276DDab16f1e407384F", DOCS['xdai-stake-bridgeDoc']);
  push(book["xdai-stake-bridge"], "ethereum", "Gnosis OmniBridge, Ethereum side (erc-to-erc sibling; holds the bulk of the row's TVL)", "0x88ad09518695c6c3712AC10a214bE5109a655671", DOCS['xdai-stake-bridgeDoc']);
  push(book["xdai-stake-bridge"], "ethereum", "Retired SAI bridge, Ethereum side (maxPerTx() and dailyLimit() are 0, so it is closed)", "0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6", DOCS['xdai-stake-bridgeDoc']);

  return book;
}

const BOOK = contractBook();

function contractsForKeys(keys) {
  const seen = new Set();
  const out = [];
  for (const key of keys) {
    const rows = BOOK[String(key || "").toLowerCase()];
    if (!rows) continue;
    for (const row of rows) {
      const id = `${row.chain}:${row.label}:${row.address}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

module.exports = {
  DOCS,
  BOOK,
  contractsForKeys,
  // DEX liquidity fork flows (src/simulation/fork/dexLiquidity.js). Sources in that file's header.
  DEX_LP: {
    ethereum: {
      WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      uniV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      uniV3Npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      uniV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      uniV4PositionManager: "0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e",
      uniV4StateView: "0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227",
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      curve3pool: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
      curve3Crv: "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490",
      curve3poolGauge: "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A",
    },
    bsc: {
      WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      USDT: "0x55d398326f99059fF775485246999027B3197955",
      pancakeV2Router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      pancakeV3Npm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
      pancakeV3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
      pancakeV3Router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
      pancakeMasterChefV3: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
    },
  },
  PANCAKE_V3: {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    quoter: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997",
    doc: DOCS.pancake,
  },
  // https://docs.uniswap.org/contracts/v4/deployments (Ethereum)
  UNISWAP_V4: {
    quoter: "0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203",
    universalRouter: "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af",
  },
  SPARK_POOL: "0xC13e21B648A5Ee794902342038FF3aDAB66BE987",
  COMPOUND_CUSDC_V3: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
  MORPHO_BLUE: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  // https://docs.lido.fi/deployed-contracts/ (WithdrawalQueueERC721, name() "Lido: stETH Withdrawal NFT")
  LIDO_WITHDRAWAL_QUEUE: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1",
  ROCKET_DEPOSIT_POOL: "0xCE15294273CFb9D9b628F4D61636623decDF4fdC",
  // Exit / withdrawal-request contracts for src/simulation/fork/exitFlows.js.
  EXITS: {
    // https://etherfi.gitbook.io/etherfi/products/liquid/live-vaults/liquid-eth-vault (BoringOnChainQueue)
    vedaQueue: "0x0D2dF071207E18Ca8638b4f04E98c53155eC2cE0",
    // https://developers.skyeco.com/guides/psm/litepsm/ (LitePSMWrapper-USDS-USDC)
    skyPsmWrapper: "0xA188EEC8F81263234dA3622A406892F3D630f98c",
    // https://etherfi.gitbook.io/etherfi/developers/contracts-and-integrations/deployed-contracts
    etherfiWithdrawNft: "0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c",
    // https://github.com/Kelp-DAO/LRT-rsETH (LRTWithdrawalManager)
    kelpWithdrawalManager: "0x62De59c08eB5dAE4b7E6F7a8cAd3006d6965ec16",
    // https://docs.renzoprotocol.com/docs/contracts/ethereum-mainnet (Renzo Withdrawal Contract)
    renzoWithdrawQueue: "0x5efc9D10E42FB517456f4ac41EB5e2eBe42C8918",
    // https://docs.rocketpool.net/overview/contracts-integrations (rETH)
    rETH: "0xae78736Cd615f374D3085123A210448E74Fc6393",
  },
  CBETH: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
  ETHERFI: {
    liquidityPool: "0x308861A430be4cce5502d0A12724771Fc6DaF216",
    eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
  },
  KELP: {
    depositPool: "0x036676389e48133B63a802f8635AD39E752D375D",
    rsETH: "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7",
  },
  RENZO: {
    restakeManager: "0x74a09653A083691711cF8215a6ab074BB4e99ef5",
    ezETH: "0xbf5495Efe5DB9ce00f80364C8B423567e58d2110",
  },
  SKY: {
    dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    usds: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
    converter: "0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A",
    susds: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",
    sdai: "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
  },
  ETHENA: {
    usde: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3",
    susde: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
  },
  FRAX: {
    frxusd: "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29",
    sfrxusd: "0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6",
  },
  RWA: {
    buidl: "0x7712c34205737192402172409a8F7ccef8aA2AEc",
    usdy: "0x96F6eF951840721AdBF46Ac996b59E0235CB985C",
    usdyOracle: "0x87b126e5518b6a1Bb8465779b4607C45C643DF90",
    ousg: "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92",
    ondoOracle: "0x9Cad45a8BF0Ed41Ff33074449B357C7a1fAb4094",
    ustb: "0x43415eB6ff9DB7E26A15b704e7A3eDCe97d31C4e",
    ustbOracle: "0xE4fA682f94610cCd170680cc3B045d77D9E528a8",
  },
  VAULTS: {
    steakhouse: {
      vault: "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
      asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      defaultAmount: "100",
      label: "steakUSDC",
    },
    gauntlet: {
      vault: "0xdd0f28e19C1780eb6396170735D45153D261490d",
      asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      defaultAmount: "100",
      label: "gtUSDC",
    },
    sentora: {
      vault: "0x6dC58a0FdfC8D694e571DC59B9A52EEEa780E6bf",
      asset: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
      symbol: "RLUSD",
      decimals: 18,
      defaultAmount: "100",
      label: "senRLUSDv2",
    },
    yearn: {
      vault: "0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204",
      asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      defaultAmount: "100",
      label: "yvUSDC-1",
    },
    euler: {
      vault: "0x3B4802FDb0E5d74aA37d58FD77d63e93d4f9A4AF",
      asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      defaultAmount: "100",
      label: "k3USDC",
    },
  },
  VEDA: {
    vault: "0xf0bb20865277aBd641a307eCe5Ee04E79073416C",
    teller: "0x9AA79C84b79816ab920bBcE20f8f74557B514734",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  UPSHIFT: {
    vault: "0x74aD2F789Ed583DBd141bbdafC673fE1F033718b",
    receipt: "0xe8aA1A9eC6b9BC455D8f33E4BDC685dedFf82407",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  EIGENLAYER: {
    strategyManager: "0x858646372CC42E1A627fcE94aa7A7033e7CF075A",
    delegationManager: "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A",
    stethStrategy: "0x93c4b944D05dfe6df7645A86cd2206016c51564D",
    steth: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  },
  SYMBIOTIC: {
    vaultFactory: "0xAEb6bdd95c502390db8f52c8909F703E9Af6a346",
  },
  SWELL: {
    rswETH: "0xFAe103DC9cf190eD75350761e95403b7b8aFa6c0",
    // swETH LST on Ethereum (Etherscan "Swell Network: swETH Token"; DefiLlama dimension-adapters fees/swell.ts).
    swETH: "0xf951E335afb289353dc249e82926178EaC7DEd78",
  },
  PUFFER: {
    pufETH: "0xD9A442856C234a39a81a089C06451EBAa4306a72",
  },
  // Morpho Vault V2. maxDeposit() returns 0 by design in V2, so gates are the pre-check.
  ROCKAWAYX: {
    vault: "0xE0181090c22579B6A217f1522cbf8c9f1F0C1965",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "roxUSDCy",
  },
  // Curve Llamalend V1 wstETH-long vault (ERC-4626, lends crvUSD). OneWayLendingFactory.vaults(13).
  LLAMALEND: {
    factory: "0xeA6876DDE9e3467564acBeE1Ed5bac88783205E0",
    marketIndex: 13,
    vault: "0x21CF1c5Dc48C603b89907FE6a7AE83EA5e3709aF",
    asset: "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E",
    symbol: "crvUSD",
    decimals: 18,
    defaultAmount: "100",
    label: "cvcrvUSD",
  },
  DOLOMITE: {
    margin: "0x003Ca23Fd5F0ca87D01F6eC6CD14A8AE60c2b97D",
    router: "0xf8b2c637A68cF6A17b1DF9F8992EeBeFf63d2dFf",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  LISTA_STAKE: {
    manager: "0x1adB950d8bB3dA4bE104211D5AB038628e477fE6",
    slisBNB: "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B",
  },
  LISTA_LENDING: {
    vault: "0x6d6783C146F2B0B2774C1725297f1845dc502525",
    asset: "0x55d398326f99059fF775485246999027B3197955",
    symbol: "USDT",
    decimals: 18,
    defaultAmount: "100",
    label: "vGauntletUSDT",
  },
  VENUS: {
    vUSDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  },
  USDAI: {
    usdai: "0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF",
    susdai: "0x0B2b2B2076d95dda7817e785989fE353fe955ef9",
  },
  SPARK_VAULTS: {
    vault: "0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "spUSDC",
  },
  BRIDGES: {
    arbitrumInbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
    arbitrumBridge: "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a",
    baseL1Bridge: "0x3154Cf16ccdb4C6d922629664174b904d80F2C35",
    // https://docs.base.org/base-chain/network-information/base-contracts — ETH is locked in the portal
    basePortal: "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e",
    optimismL1Bridge: "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1",
    // https://docs.optimism.io/chain/addresses — ETH is locked in the portal
    optimismPortal: "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed",
    acrossSpoke: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
    stargateUsdcPool: "0xc026395860Db2d07ee33e05fE50ed7bD583189C7",
    stargateArbEid: 30110,
    // https://docs.world.org/world-chain/developers/world-chain-contracts
    worldL1Bridge: "0x470458C91978D2d929704489Ad730DC3E3001113",
    worldPortal: "0xd5ec14a83B7d95BE1E2Ac12523e2dEE12Cbeea6C",
    // https://docs.robinhood.com/chain/protocol-contracts/
    robinhoodInbox: "0x1A07cc4BD17E0118BdB54D70990D2158AbAD7a2D",
    robinhoodBridge: "0xDf8755334ce7A73cCF6b581C02eA649AE3E864b3",
    // https://github.com/starknet-io/starknet-addresses/blob/master/bridged_tokens/mainnet.json
    starkgateEthBridge: "0xae0Ee0A63A2cE6BaeEFFE56e7714FB4EFE48D419",
    // StarkGate's l1_token_address for native ETH (the registry's sentinel, not a contract).
    starkgateEthToken: "0x0000000000000000000000000000000000455448",
    // https://docs.starknet.io/learn/cheatsheets/chain-info
    starknetCore: "0xc662c410C0ECf747543f5bA90660f6ABeBD9C8c4",
    // https://static.polygon.technology/network/mainnet/v1/index.json (POSContracts)
    polygonRootChainManager: "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77",
    polygonEtherPredicate: "0x8484Ef722627bf18ca5Ae6BcF031c23E6e922B30",
    // https://apidocs.lighter.xyz/docs/environments; USDC asset index 3 from /api/v1/assetDetails
    lighter: "0x3B4D794a66304F130a4Db8F2551B0070dfCf5ca7",
    lighterUsdcAssetIndex: 3,
  },
  // https://github.com/Near-One/omni-bridge#contract-addresses
  OMNI_BRIDGE: "0xe00c629aFaCCb0510995A2B95560E446A24c85B9",
  // https://wormhole.com/docs/products/reference/contract-addresses/ (Wormhole chain id 23 = Arbitrum)
  WORMHOLE: {
    tokenBridge: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
    core: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    arbitrumChainId: 23,
  },
  // https://docs.chain.link/ccip/directory/mainnet/chain/mainnet and /token/LINK
  CCIP: {
    router: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
    tokenAdminRegistry: "0xb22764f98dD05c789929716D677382Df22C05Cb6",
    link: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    linkPool: "0x1B7492C3bD23A4aDB448710e4275FF14A5288932",
    // Base. LINK's Ethereum pool does not list Arbitrum (ChainNotAllowed on 2026-10-23).
    baseSelector: "15971525489660198786",
  },
  // https://docs.stakewise.io/contracts/networks/Mainnet
  STAKEWISE: {
    genesisVault: "0xAC0F906E433d58FA868F936E8A43230473652885",
    osETH: "0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38",
    controller: "0x2A261e60FB14586B474C208b1B7AC6D0f5000306",
  },
  // Morpho Vault V2s (gates are the pre-check, as for RockawayX).
  CLEARSTAR: {
    vault: "0x91C056B6d4311a743614FBc03ac32d4E6A2d3a3c",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "CSCBUSDC",
  },
  HYPERITHM: {
    vault: "0x093272C07700d3cA5301C3Bf9B3A392624179E2F",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "hyperUSDCa",
  },
  // https://docs.kpk.io/vaults/vaults/morpho/ethereum/usdc-prime (Morpho Vault V2)
  KPK: {
    vault: "0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "KPK_USDC_Prime",
  },
  // https://docs.curation.galaxy.com/products/deployed-vaults (Morpho Vault V2)
  GALAXY: {
    vault: "0x91600E31fBeDc72433d4a57F16639cfe661Be7d8",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "gUSDCq",
  },
  // Concrete Earn V2 async vault: ERC-4626 deposit, epoch-queued withdrawal.
  // https://docs.curvance.com/app/protocol-overview/monad-contract-addresses (WMON | USDC market)
  CURVANCE: {
    vault: "0x1e240E30E51491546deC3aF16B0b4EAC8Dd110D4",
    marketManager: "0xa6A2A92F126b79Ee0804845ee6B52899b4491093",
    asset: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    symbol: "WMON",
    decimals: 18,
    defaultAmount: "100",
    label: "cWMON",
  },
  // https://saturncredit.gitbook.io/saturn-docs/operations-and-governance/key-addresses
  SATURN: {
    vault: "0xD166337499E176bbC38a1FBd113Ab144e5bd2Df7",
    asset: "0x23238f20b894f29041f48D88eE91131C395Aaa71",
    // USDC <> USDat Curve pool from the same page; it is the USDat source on the fork.
    curvePool: "0xF4d0CF32908b2C7f1021339c43Df0F77f06896d7",
    symbol: "USDat",
    decimals: 6,
    defaultAmount: "100",
    label: "sUSDat",
  },
  // https://docs.aladdin.club/concentrator/contracts (Concentrator for cvxCRV)
  CONCENTRATOR: {
    vault: "0x2b95A1Dcc3D405535f9ed33c219ab38E8d7e0884",
    asset: "0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7",
    symbol: "cvxCRV",
    decimals: 18,
    defaultAmount: "100",
    label: "aCRV",
  },
  // https://lite.guides.instadapp.io/getting-started/vault-receipt-tokens
  FLUID_LITE: {
    vault: "0xA0D3707c569ff8C87FA923d3823eC5D81c98Be78",
    asset: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    symbol: "stETH",
    decimals: 18,
    defaultAmount: "1",
    label: "iETHv2",
  },
  // https://docs.olympusdao.finance/main/contracts/addresses (Cooler V2)
  COOLER_V2: {
    monoCooler: "0xdb591Ea2e5Db886dA872654D58f6cc584b68e7cC",
    treasuryBorrower: "0xD58d7406E9CE34c90cf849Fc3eed3764EB3779B0",
    gohm: "0x0ab87046fBb341D058F17CBC4c1133F25a20a52f",
    usds: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
    // DLGTE module (same page) holds Cooler V2's undelegated gOHM; it is the gOHM source on the fork.
    dlgte: "0xD3204Ae00d6599Ba6e182c6D640A79d76CdAad74",
  },
  // https://docs.stake.link/resources/contracts-and-integrations (LINK Staking)
  STAKE_LINK: {
    priorityPool: "0xDdC796a66E8b83d0BcCD97dF33A6CcFBA8fd60eA",
    stakingPool: "0xb8b295df2cd735b15BE5Eb419517Aa626fc43cD5",
    link: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  },
  CONCRETE: {
    vault: "0x0E609b710da5e0AA476224b6c0e5445cCc21251E",
    asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    decimals: 6,
    defaultAmount: "200",
    label: "ctDefiUSDT",
  },
  // Ember Earn on Ethereum (Ember vault API, see DOCS.ember). ERC-4626 deposit; exits use redeemShares (queued).
  EMBER: {
    vault: "0x9be9294722f8AAd37b11a9792Be2C782182caFA2",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "eEARN",
  },
  // https://etherfi.gitbook.io/etherfi/products/borrow/lending-market-parameters (OP Mainnet)
  ETHERFI_CASH: {
    hub: "0x66753c4e3fC84f1eD0e3C267C927284E9d90C572",
    spoke: "0xdffcC3536D932eb51Df51a7F5FA407c4270d5308",
    // Native USDC on OP Mainnet is reserve 0 of the Spoke (getReserve(0).underlying).
    asset: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    reserveId: 0,
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
  },
  // https://docs.vesper.finance/vesper-2/contract-addresses (Vesper USD)
  VESPER: {
    gateway: "0x9a1800B63d40a19539017a8C6F0D005F9c9F8A00",
    usdv: "0xC9aD6eD9f522e8Ac2dE8FFc8B081005CCE50c8AB",
    vault: "0x7473Da16F17abA0D920605e1F9560A99a6F6314A",
    treasury: "0xd4765523Fd844eddF9e6EFe136a48012BCd5503a",
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    defaultAmount: "100",
    label: "sUSDv",
  },
  // https://docs.falcon.finance/resources/smart-contracts
  FALCON: {
    usdf: "0xFa2B947eEc368f42195f24F36d2aF29f7c24CeC2",
    vault: "0xc8CF6D7991f15525488b2A83Df53468D682Ba4B0",
    symbol: "USDf",
    decimals: 18,
    defaultAmount: "100",
    label: "sUSDf",
  },
  // https://docs.mantle.xyz/meth/components/smart-contracts/staking-meth
  METH: {
    staking: "0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f",
    meth: "0xd5F7838F5C461fefF7FE49ea5ebaF7728bB0ADfa",
    unstakeRequestsManager: "0x38fDF7b489316e03eD8754ad339cb5c4483FDcf9",
  },
  // https://docs.aera.finance/integrating-with-gtusda (Base). provisioner() / feeCalculator() are
  // re-read from the vault at run time and must equal these.
  AERA: {
    vault: "0x000000000001CdB57E58Fa75Fe420a0f4D6640D5",
    provisioner: "0x128Afda4351deCE9d51Eb9d7e9C687C58cfff731",
    calculator: "0xa90fd5C2020DBf19c6c29609dF85F7e4DBAC30db",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  // https://www.binance.com/en/support/faq/what-is-wbeth-e252366155174ba6887f6b32e3798273
  WBETH: "0xa2E3356610840701BDf5611a53974510Ae27E2e1",
  // https://docs.metapool.app/master/for-developers/meta-pool-contracts/ethereum-network-and-l2s
  META_POOL: {
    speth: "0xD06f6a56c5f599cB375B616DF306f32B7F6f4A0E",
    liquidPool: "0xdF261F967E87B2aa44e18a22f4aCE5d7f74f03Cc",
  },
  // GMX V1 on Arbitrum. The official docs state V1 is sunset and that trading and
  // providing liquidity are no longer supported, so the fork coverage is read-only.
  // https://docs.gmx.io/docs/archived/contracts-v1
  // GLP/fsGLP come from the interface config that page links to:
  // https://github.com/gmx-io/gmx-interface/blob/master/sdk/src/configs/contracts.ts
  GMX: {
    gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
    vault: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    router: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
    reader: "0x22199a49A999c351eF7927602CFB187ec3cae489",
    glpManager: "0x3963FfC9dff443c2A94f21b129D429891E32ec18",
    glpRewardRouter: "0xB95DB5B167D75e6d04227CfFFA61069348d271F5",
    rewardRouter: "0x5E4766F932ce00aA4a1A82d3Da85adf15C5694A1",
    glp: "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258",
    fsGlp: "0x1aDDD80E6039594eE970E5872D247bf0414C8903",
  },
  // https://docs.usdt0.to/technical-documentation/developer (Ethereum OFT Adapter, Arbitrum EID)
  USDT0: {
    adapter: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    arbitrumEid: 30110,
  },
  // EndpointV2: docs.layerzero.network/v2/deployments/chains/ethereum (Ethereum EID 30101).
  LAYERZERO: {
    endpointV2: "0x1a44076050125825900e736c501f859c50fE728c",
    ethereumEid: 30101,
  },
  // https://docs.benqi.fi/resources/contracts (+ /core-markets). qiUSDCn underlying() is native USDC.
  BENQI: {
    comptroller: "0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4",
    qiUsdcn: "0xB715808a78F6041E46d61Cb123C9B4A27056AE9C",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    savax: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE",
  },
  // https://docs.liquity.org/liquity-v1/documentation/resources
  LIQUITY: {
    stabilityPool: "0x66017D22b0f8556afDd19FC67041899Eb65a21bb",
    lusd: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0",
  },
  // https://docs.convexfinance.com/convexfinance/faq/contract-addresses. LP token, gauge and
  // reward pool are read from Booster.poolInfo(pid) at run time (pid 9 = Curve 3pool).
  CONVEX: {
    booster: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
    pid: "9",
  },
  // https://docs.theo.xyz/developers/deployed-addresses
  THEO: {
    thusd: "0xa3fE5c7596024E6811E14F029937D5bd8Ae485b3",
    sthusd: "0xA808Bc9775cb41c52C7842f8b50427fE7A770326",
  },
  // https://docs.cian.app/yieldlayer/for-builders-developer-documentation/yield-layer-contracts (Yield Layer rsETH).
  // rsETH is the vault's asset() (Kelp rsETH).
  CIAN: {
    vault: "0xd87a19fF681AE98BF10d2220D1AE3Fbd374ADE4e",
    redeemOperator: "0x47DBD71Db64617f6cBD45eB9D9Ba876F40ED239E",
    rseth: "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7",
  },
  // https://docs.solv.finance/developer-guide/contracts and the storage-pools page (Ethereum WBTC pool).
  SOLVBTC: {
    router: "0x1fF7d7C0A7D8E94046708C611DeC5056A9d2B823",
    solvbtc: "0x7A56E1C57C7475CCf742a1832B028F0456652F97",
    wbtc: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    wbtcPoolId: "0x716db7dc196abe78d5349c7166896f674ab978af26ada3e5b3ea74c5a1b48307",
  },
  // https://docs.zama.org/protocol/protocol-apps/addresses/mainnet/ethereum
  ZAMA: {
    registry: "0xeb5015fF021DB115aCe010f23F55C2591059bBA0",
    cusdc: "0xe978F22157048E5DB8E5d07971376e86671672B2",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
};
