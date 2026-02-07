/**
 * Fork Detection Utility
 * Detects if RPC endpoint is a local fork (Hardhat, Anvil, Tenderly)
 */
const { getProvider } = require("./web3");
const { CHAINS } = require("../config/chains");

/**
 * Detect if current RPC endpoint is a fork
 * @param {string} chainKey - Chain identifier
 * @returns {Promise<{isFork: boolean, forkType: string|null}>}
 */
async function detectFork(chainKey) {
  const provider = getProvider(chainKey);
  const rpcUrl = CHAINS[chainKey].rpcUrl;

  // Check if localhost/127.0.0.1
  if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1")) {
    // Try to identify fork type
    const forkType = await identifyForkType(provider);
    return { isFork: true, forkType };
  }

  // Check for Tenderly fork
  if (rpcUrl.includes("tenderly.co/fork")) {
    return { isFork: true, forkType: "tenderly" };
  }

  return { isFork: false, forkType: null };
}

/**
 * Identify type of fork (Hardhat, Anvil, etc.)
 * @param {ethers.Provider} provider
 * @returns {Promise<string>}
 */
async function identifyForkType(provider) {
  // Check for Hardhat node
  try {
    await provider.send("hardhat_metadata", []);
    return "hardhat";
  } catch {
    // Not Hardhat
  }

  // Check for Anvil
  try {
    await provider.send("anvil_nodeInfo", []);
    return "anvil";
  } catch {
    // Not Anvil
  }

  // Check for Ganache
  try {
    const version = await provider.send("web3_clientVersion", []);
    if (version.includes("Ganache")) {
      return "ganache";
    }
  } catch {
    // Not Ganache
  }

  return "unknown";
}

/**
 * Get fork block number (if available)
 * @param {string} chainKey
 * @returns {Promise<number|null>}
 */
async function getForkBlockNumber(chainKey) {
  const { isFork, forkType } = await detectFork(chainKey);

  if (!isFork) return null;

  const provider = getProvider(chainKey);

  try {
    if (forkType === "hardhat") {
      const metadata = await provider.send("hardhat_metadata", []);
      return metadata.forkedNetwork?.blockNumber || null;
    }

    if (forkType === "anvil") {
      // Anvil doesn't have a direct method, use current block
      return await provider.getBlockNumber();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Check if impersonation is supported
 * @param {string} chainKey
 * @returns {Promise<boolean>}
 */
async function supportsImpersonation(chainKey) {
  const { isFork, forkType } = await detectFork(chainKey);

  if (!isFork) return false;

  // Hardhat and Anvil support impersonation
  return forkType === "hardhat" || forkType === "anvil";
}

module.exports = {
  detectFork,
  identifyForkType,
  getForkBlockNumber,
  supportsImpersonation,
};
