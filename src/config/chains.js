// Chain configuration for Uniswap analysis across multiple chains
require("dotenv").config();

const CHAINS = {
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || process.env.ETH_RPC_URL,
    explorer: "https://etherscan.io",
    uniswap: {
      v2: {
        factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      },
      v3: {
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        nftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      },
      v4: {
        // V4 launched January 31, 2025 - uses singleton PoolManager architecture
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
    },
    curve: {
      // AddressProvider - use get_address(7) to get MetaRegistry
      addressProvider: "0x5ffe7FB82894076ECB99A30D6A32e969e6e35E98",
      // Major pools (V1 = StableSwap, V2 = TriCrypto/Volatile)
      pools: {
        "3pool": {
          name: "3pool (USDC/USDT/DAI)",
          version: "V1",
          type: "StableSwap",
          address: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
          lpToken: "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490",
          coins: ["USDC", "USDT", "DAI"],
        },
        tricrypto2: {
          name: "TriCrypto2 (USDT/WBTC/WETH)",
          version: "V2",
          type: "Crypto",
          address: "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46",
          lpToken: "0xc4AD29ba4B3c580e6D59105FFf484999997675Ff",
          coins: ["USDT", "WBTC", "WETH"],
        },
        steth: {
          name: "stETH/ETH",
          version: "V1",
          type: "StableSwap",
          address: "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022",
          lpToken: "0x06325440D014e39736583c165C2963BA99fAf14E",
          coins: ["ETH", "stETH"],
        },
        fraxusdc: {
          name: "FRAX/USDC",
          version: "V1",
          type: "StableSwap",
          address: "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2",
          lpToken: "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC",
          coins: ["FRAX", "USDC"],
        },
        rethwsteth: {
          name: "rETH/wstETH",
          version: "V1",
          type: "StableSwap",
          address: "0x447Ddd4960d9fdBF6af9a790560d0AF76795CB08",
          lpToken: "0x447Ddd4960d9fdBF6af9a790560d0AF76795CB08",
          coins: ["rETH", "wstETH"],
        },
        tbtcwbtc: {
          name: "tBTC/WBTC",
          version: "V1",
          type: "StableSwap",
          address: "0xf95AaCB582520f8e5B7Dec1b3C97a4f6B39f9c09",
          lpToken: "0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd",
          coins: ["tBTC", "WBTC"],
        },
      },
    },
    balancer: {
      v2: {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        // Major V2 pools (poolId format: 32 bytes)
        pools: {
          wethUsdc5050: {
            name: "WETH/USDC (50/50)",
            version: "V2",
            poolId: "0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019",
            tokens: ["WETH", "USDC"],
            weights: [50, 50],
          },
          wstethWeth8020: {
            name: "wstETH/WETH (80/20)",
            version: "V2",
            poolId: "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080",
            tokens: ["wstETH", "WETH"],
            weights: [80, 20],
          },
          rethWeth5050: {
            name: "rETH/WETH (50/50)",
            version: "V2",
            poolId: "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112",
            tokens: ["rETH", "WETH"],
            weights: [50, 50],
          },
          wbtcWeth5050: {
            name: "WBTC/WETH (50/50)",
            version: "V2",
            poolId: "0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e",
            tokens: ["WBTC", "WETH"],
            weights: [50, 50],
          },
          balWeth8020: {
            name: "BAL/WETH (80/20)",
            version: "V2",
            poolId: "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014",
            tokens: ["BAL", "WETH"],
            weights: [80, 20],
          },
        },
      },
      v3: {
        vault: "0xba1333333333a1BA1108E8412f11850A5C319bA9",
        // V3 pools (if any configured)
        pools: {},
      },
    },
    sushiswap: {
      v2: {
        factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
        router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
      },
      // SushiSwap V3 uses same contracts as Uniswap V3
      v3: {
        factory: "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F",
        quoter: "0x64e8802FE490fa7cc61d3463958199161Bb608A7",
        router: "0x2E6cd2d30aa43f40aa81619ff4b6E0a41479B13F",
      },
    },
  },
  arbitrum: {
    name: "Arbitrum",
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    explorer: "https://arbiscan.io",
    uniswap: {
      v2: {
        factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
        router: "0x4752ba5DBc23f44D87826288BF4d6A27Cf9A024E",
      },
      v3: {
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        nftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      },
      v4: {
        // V4 - uses same singleton PoolManager address across chains
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
    },
    curve: {
      // Curve on Arbitrum
      addressProvider: "0x0000000022D53366457F9d5E68Ec105046FC4383",
      pools: {},
    },
    balancer: {
      v2: {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        pools: {},
      },
      v3: {
        vault: "0xba1333333333a1BA1108E8412f11850A5C319bA9",
        pools: {},
      },
    },
    sushiswap: {
      v2: {
        factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      },
      v3: {
        factory: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e",
        quoter: "0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1",
        router: "0xF0cBce1942A68BEB3d1b73F0dd86C8DCc363eF49",
      },
    },
  },
  optimism: {
    name: "Optimism",
    chainId: 10,
    rpcUrl: process.env.OPTIMISM_RPC_URL,
    explorer: "https://optimistic.etherscan.io",
    uniswap: {
      v2: {
        factory: "0x6eccab422D763aC031210895C81787E87B43A652",
        router: "0x4a7b5da61326A6739856dB9B4FFeb2baE32C8ACE",
      },
      v3: {
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        nftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      },
      v4: {
        // V4 - uses same singleton PoolManager address across chains
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
    },
    curve: {
      // Curve on Optimism
      addressProvider: "0x0000000022D53366457F9d5E68Ec105046FC4383",
      pools: {},
    },
    balancer: {
      v2: {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        pools: {},
      },
      v3: {
        vault: "0xba1333333333a1BA1108E8412f11850A5C319bA9",
        pools: {},
      },
    },
    sushiswap: {
      v2: {
        factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      },
      v3: {
        factory: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e",
        quoter: "0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1",
        router: "0xF0cBce1942A68BEB3d1b73F0dd86C8DCc363eF49",
      },
    },
  },
  base: {
    name: "Base",
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL,
    explorer: "https://basescan.org",
    uniswap: {
      v2: {
        factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
        router: "0x4752ba5DBc23f44D87826288BF4d6A27Cf9A024E",
      },
      v3: {
        factory: "0x33128a8fC17869897dcE68Ed026d69B80cc6b6C0",
        quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
        router: "0x2626664c2603336E57B271c5C0b26F421741e481",
        nftPositionManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
      },
      v4: {
        // V4 - uses same singleton PoolManager address across chains
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
    },
    curve: {
      // Curve on Base
      addressProvider: "0x0000000022D53366457F9d5E68Ec105046FC4383",
      pools: {},
    },
    balancer: {
      v2: {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        pools: {},
      },
      v3: {
        vault: "0xba1333333333a1BA1108E8412f11850A5C319bA9",
        pools: {},
      },
    },
    sushiswap: {
      v2: {
        factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      },
      v3: {
        factory: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e",
        quoter: "0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1",
        router: "0xF0cBce1942A68BEB3d1b73F0dd86C8DCc363eF49",
      },
    },
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL,
    explorer: "https://polygonscan.com",
    uniswap: {
      v2: {
        factory: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
        router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
      },
      v3: {
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
        router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        nftPositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      },
      v4: {
        // V4 - uses same singleton PoolManager address across chains
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
    },
    curve: {
      // Curve on Polygon
      addressProvider: "0x0000000022D53366457F9d5E68Ec105046FC4383",
      pools: {},
    },
    balancer: {
      v2: {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        pools: {},
      },
      v3: {
        vault: "0xba1333333333a1BA1108E8412f11850A5C319bA9",
        pools: {},
      },
    },
    sushiswap: {
      v2: {
        factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      },
      v3: {
        factory: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e",
        quoter: "0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1",
        router: "0xF0cBce1942A68BEB3d1b73F0dd86C8DCc363eF49",
      },
    },
  },
  bsc: {
    name: "BSC",
    chainId: 56,
    rpcUrl: process.env.BSC_RPC_URL,
    explorer: "https://bscscan.com",
    uniswap: {
      v2: {
        factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
        router: "0x4752ba5DBc23f44D87826288BF4d6A27Cf9A024E",
      },
      v3: {
        factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
        quoter: "0x78D78E420Da98ad378D7799bE8f4AF69033EB077",
        router: "0x83c346Ba3d4b36E6Bf6F401e9954B7e8C5e1F18c",
        nftPositionManager: "0x7b8A07B6356C1ad843c34d0C5baD61160aC36FE3",
      },
      v4: {
        // V4 - uses same singleton PoolManager address across chains
        poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
    },
    curve: {
      // Curve on BSC
      addressProvider: "0x0000000022D53366457F9d5E68Ec105046FC4383",
      pools: {},
    },
    balancer: {
      v2: {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        pools: {},
      },
      v3: {
        vault: "0xba1333333333a1BA1108E8412f11850A5C319bA9",
        pools: {},
      },
    },
    sushiswap: {
      v2: {
        factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      },
      v3: {
        factory: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e",
        quoter: "0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1",
        router: "0xF0cBce1942A68BEB3d1b73F0dd86C8DCc363eF49",
      },
    },
  },
};

// Common tokens for analysis
const COMMON_TOKENS = {
  WETH: {
    ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    optimism: "0x4200000000000000000000000000000000000006",
    base: "0x4200000000000000000000000000000000000006",
    polygon: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    bsc: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  },
  USDC: {
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  },
  USDT: {
    ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    optimism: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    base: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    bsc: "0x55d398326f99059fF775485246999027B3197955",
  },
  DAI: {
    ethereum: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    arbitrum: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    optimism: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    base: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    polygon: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    bsc: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
  },
  WBTC: {
    ethereum: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    arbitrum: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    optimism: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
    polygon: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  },
  // DeFi Blue Chips
  UNI: {
    ethereum: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    arbitrum: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0",
    optimism: "0x6fd9d7AD17242c41f7131d257212c54A0e816691",
    polygon: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",
  },
  LINK: {
    ethereum: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    arbitrum: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
    optimism: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
    polygon: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
  },
  AAVE: {
    ethereum: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    arbitrum: "0xba5DdD1f9d7F570dc94a51479a000E3BCE967196",
    optimism: "0x76FB31fb4af56892A25e32cFC43De717950c9278",
    polygon: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
  },
  MKR: {
    ethereum: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    arbitrum: "0x2e9a6Df78E42a30712c10a9Dc4b1C8656f8F2879",
    optimism: "0xab7bAdEF82E9Fe11f6f33f87BC9bC2AA27F2fCB5",
    polygon: "0x6f7C932e7684666C9fd1d44527765433e01fF61d",
  },
  CRV: {
    ethereum: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    arbitrum: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
    optimism: "0x0994206dfE8De6Ec6920FF4D779B0d950605Fb53",
    polygon: "0x172370d5Cd63279eFa6d502DAB29171933a610AF",
  },
  LDO: {
    ethereum: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    arbitrum: "0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60",
    optimism: "0xFdb794692724153d1488CcdBE0C56c252596735F",
    polygon: "0xC3C7d422809852031b44ab29EEC9F1EfF2A58756",
  },
  // Liquid Staking Derivatives
  wstETH: {
    ethereum: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    arbitrum: "0x5979D7b546E38E414F7E9822514be443A4800529",
    optimism: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
    polygon: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD",
  },
  rETH: {
    ethereum: "0xae78736Cd615f374D3085123A210448E74Fc6393",
    arbitrum: "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8",
    optimism: "0x9Bcef72be871e61ED4fBbc7630889beE758eb81D",
    polygon: "0x0266F4F08D82372CF0FcbCCc0Ff74309089c74d1",
  },
};

module.exports = {
  CHAINS,
  COMMON_TOKENS,
};

