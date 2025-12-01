// Web3 utility functions for multi-chain support
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");

function getProvider(chainKey) {
  const chain = CHAINS[chainKey];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainKey}`);
  }
  if (!chain.rpcUrl) {
    throw new Error(`RPC URL not configured for ${chain.name}`);
  }
  return new ethers.JsonRpcProvider(chain.rpcUrl);
}

function getContract(address, abi, chainKey) {
  const provider = getProvider(chainKey);
  return new ethers.Contract(address, abi, provider);
}

async function getBlockNumber(chainKey) {
  const provider = getProvider(chainKey);
  return await provider.getBlockNumber();
}

async function getBlock(chainKey, blockNumber) {
  const provider = getProvider(chainKey);
  return await provider.getBlock(blockNumber);
}

module.exports = {
  getProvider,
  getContract,
  getBlockNumber,
  getBlock,
};

