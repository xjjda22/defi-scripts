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
};

module.exports = {
  CHAINS,
  COMMON_TOKENS,
};

