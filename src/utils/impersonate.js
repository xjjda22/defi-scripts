/**
 * Account Impersonation Utility for Fork Testing
 * Allows testing with whale wallets on Hardhat/Anvil forks
 */
const { ethers } = require("ethers");
const { getProvider } = require("./web3");
const { detectFork } = require("./forkDetection");

// Pre-configured whale addresses with large token balances
const WHALES = {
  ethereum: {
    WETH: "0x2f0b23f53734252bda2277357e97e1517d6b042a", // Binance wallet
    USDC: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503", // Binance
    DAI: "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf", // Polygon Bridge
    USDT: "0x5754284f345afc66a98fbb0a0afe71e0f007b949", // Tether Treasury
    WBTC: "0xbf72da2bd84c5170618fbe5914b0eca9638d5eb5", // Large holder
  },
  arbitrum: {
    WETH: "0xf89d7b9c864f589bbf53a82105107622b35eaa40", // Arbitrum bridge
    USDC: "0xf89d7b9c864f589bbf53a82105107622b35eaa40", // Arbitrum bridge
    USDT: "0xb38e8c17e38363af6ebdcb3dae12e0243582891d", // Large holder
  },
  optimism: {
    WETH: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uniswap
    USDC: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Large holder
  },
  base: {
    WETH: "0x4200000000000000000000000000000000000006", // Native WETH
    USDC: "0x20fe51a9229eef2cf8ad9e89d91cab9312cf3b7a", // Large holder
  },
  polygon: {
    WETH: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // Wrapped ETH
    USDC: "0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245", // Large holder
  },
};

/**
 * Impersonate an account on fork
 * @param {string} address - Address to impersonate
 * @param {string} chainKey - Chain identifier
 * @returns {Promise<ethers.Signer>}
 */
async function impersonateAccount(address, chainKey) {
  const { isFork, forkType } = await detectFork(chainKey);

  if (!isFork) {
    throw new Error("Account impersonation only works on forked networks");
  }

  const provider = getProvider(chainKey);

  try {
    if (forkType === "hardhat") {
      await provider.send("hardhat_impersonateAccount", [address]);
      await provider.send("hardhat_setBalance", [address, "0x56BC75E2D63100000"]); // 100 ETH
    } else if (forkType === "anvil") {
      await provider.send("anvil_impersonateAccount", [address]);
      await provider.send("anvil_setBalance", [address, "0x56BC75E2D63100000"]); // 100 ETH
    } else {
      throw new Error(`Impersonation not supported for fork type: ${forkType}`);
    }

    return await provider.getSigner(address);
  } catch (error) {
    throw new Error(`Failed to impersonate account: ${error.message}`);
  }
}

/**
 * Stop impersonating an account
 * @param {string} address - Address to stop impersonating
 * @param {string} chainKey - Chain identifier
 */
async function stopImpersonating(address, chainKey) {
  const { isFork, forkType } = await detectFork(chainKey);

  if (!isFork) return;

  const provider = getProvider(chainKey);

  try {
    if (forkType === "hardhat") {
      await provider.send("hardhat_stopImpersonatingAccount", [address]);
    } else if (forkType === "anvil") {
      await provider.send("anvil_stopImpersonatingAccount", [address]);
    }
  } catch (error) {
    // Ignore errors when stopping impersonation
  }
}

/**
 * Get whale address for a token on a specific chain
 * @param {string} tokenSymbol - Token symbol (e.g., 'WETH', 'USDC')
 * @param {string} chainKey - Chain identifier
 * @returns {string|null}
 */
function getWhaleAddress(tokenSymbol, chainKey) {
  return WHALES[chainKey]?.[tokenSymbol] || null;
}

/**
 * Impersonate a whale account with tokens
 * @param {string} tokenSymbol - Token symbol
 * @param {string} chainKey - Chain identifier
 * @returns {Promise<ethers.Signer>}
 */
async function impersonateWhale(tokenSymbol, chainKey) {
  const whaleAddress = getWhaleAddress(tokenSymbol, chainKey);

  if (!whaleAddress) {
    throw new Error(`No whale address configured for ${tokenSymbol} on ${chainKey}`);
  }

  return await impersonateAccount(whaleAddress, chainKey);
}

/**
 * Get token balance of an address
 * @param {string} tokenAddress - ERC20 token address
 * @param {string} holderAddress - Address to check
 * @param {string} chainKey - Chain identifier
 * @returns {Promise<bigint>}
 */
async function getTokenBalance(tokenAddress, holderAddress, chainKey) {
  const provider = getProvider(chainKey);
  const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return await token.balanceOf(holderAddress);
}

module.exports = {
  impersonateAccount,
  stopImpersonating,
  getWhaleAddress,
  impersonateWhale,
  getTokenBalance,
  WHALES,
};
