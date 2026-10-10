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
};

function push(list, chain, label, address, doc) {
  if (!address) return;
  list.push({ chain, label, address, doc });
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
  // BUIDL address is already in sample.env. https://securitize.io/blackrock/BUIDL
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
    push(book[key], eth, "USTB price oracle", "0xe4fa682f94610ccd170680cc3b045d77d9e528a8", DOCS.superstate);
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
  ROCKET_DEPOSIT_POOL: "0xCE15294273CFb9D9b628F4D61636623decDF4fdC",
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
    ustbOracle: "0xe4fa682f94610ccd170680cc3b045d77d9e528a8",
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
  },
  PUFFER: {
    pufETH: "0xD9A442856C234a39a81a089C06451EBAa4306a72",
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
  },
};
