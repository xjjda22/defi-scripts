/**
 * Balancer token swap implementation
 * Supports swaps through Balancer V2 Vault across all configured chains
 */
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getProvider } = require("../utils/web3");
const { validateChainKey, validateWallet, validateAddress, validateAmount, validateSlippage } = require("../utils/validation");
const VAULT_ABI = require("../abis/BalancerVault.json");
const ERC20_ABI = require("../abis/IERC20.json");

/**
 * Execute Balancer swap through V2 Vault
 * @param {string} chainKey - Chain identifier
 * @param {ethers.Wallet} wallet - Wallet for signing
 * @param {string} poolId - Balancer pool ID (bytes32)
 * @param {string} tokenIn - Input token address
 * @param {string} tokenOut - Output token address
 * @param {string} amountIn - Amount to swap (in wei)
 * @param {number} slippageBps - Slippage tolerance in basis points (default: 50 = 0.5%)
 * @param {string} recipient - Recipient address (default: wallet address)
 * @returns {Promise<{hash: string, amountOut: string}>}
 */
async function swapV2(chainKey, wallet, poolId, tokenIn, tokenOut, amountIn, slippageBps = 50, recipient = null) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, 'tokenIn');
  validateAddress(tokenOut, 'tokenOut');
  validateAmount(amountIn, 'amountIn');
  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  if (!chain?.balancer?.v2?.vault) {
    throw new Error(`Balancer V2 not available on ${chainKey}`);
  }

  const provider = wallet.provider || getProvider(chainKey);
  const walletWithProvider = wallet.connect(provider);
  
  const vault = new ethers.Contract(
    chain.balancer.v2.vault,
    VAULT_ABI,
    walletWithProvider,
  );

  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, walletWithProvider);
  
  const allowance = await tokenInContract.allowance(wallet.address, chain.balancer.v2.vault);
  if (BigInt(allowance) < BigInt(amountIn)) {
    console.log("Approving Balancer Vault...");
    const approveTx = await tokenInContract.approve(chain.balancer.v2.vault, amountIn);
    await approveTx.wait();
  }

  const minAmountOut = (BigInt(amountIn) * BigInt(10000 - slippageBps)) / BigInt(10000);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const to = recipient || wallet.address;

  const singleSwap = {
    poolId: poolId,
    kind: 0, // GIVEN_IN
    assetIn: tokenIn,
    assetOut: tokenOut,
    amount: amountIn,
    userData: "0x",
  };

  const funds = {
    sender: wallet.address,
    fromInternalBalance: false,
    recipient: to,
    toInternalBalance: false,
  };

  const tx = await vault.swap(
    singleSwap,
    funds,
    minAmountOut,
    deadline,
  );

  const receipt = await tx.wait();
  
  return {
    version: "v2",
    hash: receipt.hash,
    poolId: poolId,
  };
}

/**
 * Get pool tokens and balances
 */
async function getPoolInfo(chainKey, poolId) {
  validateChainKey(chainKey);

  const chain = CHAINS[chainKey];
  if (!chain?.balancer?.v2?.vault) {
    throw new Error(`Balancer V2 not available on ${chainKey}`);
  }

  const provider = getProvider(chainKey);
  const vault = new ethers.Contract(
    chain.balancer.v2.vault,
    VAULT_ABI,
    provider,
  );

  try {
    const [tokens, balances, lastChangeBlock] = await vault.getPoolTokens(poolId);
    return {
      tokens,
      balances: balances.map(b => b.toString()),
      lastChangeBlock: lastChangeBlock.toString(),
    };
  } catch (error) {
    throw new Error(`Failed to get pool info: ${error.message}`);
  }
}

/**
 * Auto-route between Balancer V2 and V3 vaults (if both available)
 * Note: Currently only V2 is implemented with swap functionality
 */
async function swapTokens(chainKey, wallet, poolId, tokenIn, tokenOut, amountIn, options = {}) {
  validateChainKey(chainKey);
  validateWallet(wallet);
  validateAddress(tokenIn, 'tokenIn');
  validateAddress(tokenOut, 'tokenOut');
  validateAmount(amountIn, 'amountIn');

  const {
    slippageBps = 50,
    recipient = null,
    version = null,
  } = options;

  validateSlippage(slippageBps);

  const chain = CHAINS[chainKey];
  
  // Force specific version if requested
  if (version === 'v2' || !chain?.balancer?.v3?.vault) {
    console.log(`Using Balancer V2 on ${chain.name}...`);
    return await swapV2(chainKey, wallet, poolId, tokenIn, tokenOut, amountIn, slippageBps, recipient);
  }
  
  if (version === 'v3') {
    console.log(`Using Balancer V3 on ${chain.name}...`);
    // V3 implementation would go here when available
    throw new Error("Balancer V3 swaps not yet implemented");
  }

  // Default to V2 for now (V3 swap implementation can be added later)
  console.log(`Auto-routing: Using Balancer V2 on ${chain.name}...`);
  return await swapV2(chainKey, wallet, poolId, tokenIn, tokenOut, amountIn, slippageBps, recipient);
}

module.exports = {
  swapTokens,
  swapV2,
  getPoolInfo,
};
