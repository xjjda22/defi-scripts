// Example: Check wallet status before swapping
// Demonstrates pre-flight checks for token swaps
require("dotenv").config();
const { ethers } = require("ethers");
const { CHAINS } = require("../config/chains");
const { getCommonToken } = require("../swaps/swap");
const {
  getTokenBalance,
  getTokenAllowance,
  getNativeBalance,
  preFlightCheck,
} = require("../utils/tokenHelpers");

async function main() {
  // Configuration
  const CHAIN = process.env.CHAIN || "ethereum";
  const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!WALLET_ADDRESS && !PRIVATE_KEY) {
    console.error("Error: Set either WALLET_ADDRESS or PRIVATE_KEY in environment");
    console.log("\nUsage:");
    console.log("  export WALLET_ADDRESS=0x...");
    console.log("  OR");
    console.log("  export PRIVATE_KEY=0x...");
    console.log("  export CHAIN=ethereum");
    console.log("  node src/examples/checkWalletExample.js");
    process.exit(1);
  }

  // Get wallet address
  let walletAddr = WALLET_ADDRESS;
  if (!walletAddr && PRIVATE_KEY) {
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    walletAddr = wallet.address;
  }

  const chain = CHAINS[CHAIN];
  console.log(`\n=== Wallet Status Check ===`);
  console.log(`Chain: ${chain.name}`);
  console.log(`Wallet: ${walletAddr}\n`);

  // Check native balance
  console.log("💰 Native Balance:");
  try {
    const nativeBalance = await getNativeBalance(CHAIN, walletAddr);
    console.log(`  ${nativeBalance.formatted} ETH`);

    if (BigInt(nativeBalance.balance) < ethers.parseEther("0.001")) {
      console.log(`  ⚠️  Low balance - may not have enough for gas`);
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }

  // Check common token balances
  console.log("\n\n🪙 Token Balances:");

  const tokens = ["WETH", "USDC", "USDT"];
  const balances = [];

  for (const tokenSymbol of tokens) {
    try {
      const tokenAddr = getCommonToken(tokenSymbol, CHAIN);
      const balance = await getTokenBalance(CHAIN, tokenAddr, walletAddr);
      balances.push({ symbol: tokenSymbol, ...balance });

      const hasBalance = BigInt(balance.balance) > 0;
      const indicator = hasBalance ? "✅" : "  ";
      console.log(`${indicator} ${tokenSymbol}: ${balance.formatted}`);
    } catch (error) {
      console.log(`  ${tokenSymbol}: Not available on this chain`);
    }
  }

  // Check allowances for Uniswap routers
  console.log("\n\n🔐 Allowances (Uniswap Routers):");

  const tokensWithBalance = balances.filter(b => BigInt(b.balance) > 0);

  if (tokensWithBalance.length === 0) {
    console.log("  No tokens found to check allowances");
  } else {
    // Check V2 allowances
    if (chain.uniswap.v2?.router) {
      console.log("\n  Uniswap V2 Router:");
      for (const token of tokensWithBalance) {
        try {
          const tokenAddr = getCommonToken(token.symbol, CHAIN);
          const allowance = await getTokenAllowance(CHAIN, tokenAddr, walletAddr, chain.uniswap.v2.router);

          if (allowance.isUnlimited) {
            console.log(`    ✅ ${token.symbol}: Unlimited`);
          } else if (BigInt(allowance.allowance) > 0) {
            console.log(`    ⚠️  ${token.symbol}: ${allowance.formatted} (limited)`);
          } else {
            console.log(`    ❌ ${token.symbol}: Not approved`);
          }
        } catch (error) {
          console.log(`    ❌ ${token.symbol}: Error checking`);
        }
      }
    }

    // Check V3 allowances
    if (chain.uniswap.v3?.router) {
      console.log("\n  Uniswap V3 Router:");
      for (const token of tokensWithBalance) {
        try {
          const tokenAddr = getCommonToken(token.symbol, CHAIN);
          const allowance = await getTokenAllowance(CHAIN, tokenAddr, walletAddr, chain.uniswap.v3.router);

          if (allowance.isUnlimited) {
            console.log(`    ✅ ${token.symbol}: Unlimited`);
          } else if (BigInt(allowance.allowance) > 0) {
            console.log(`    ⚠️  ${token.symbol}: ${allowance.formatted} (limited)`);
          } else {
            console.log(`    ❌ ${token.symbol}: Not approved`);
          }
        } catch (error) {
          console.log(`    ❌ ${token.symbol}: Error checking`);
        }
      }
    }

    // Check V4 allowances
    if (chain.uniswap.v4?.poolManager) {
      console.log("\n  Uniswap V4 PoolManager:");
      for (const token of tokensWithBalance) {
        try {
          const tokenAddr = getCommonToken(token.symbol, CHAIN);
          const allowance = await getTokenAllowance(CHAIN, tokenAddr, walletAddr, chain.uniswap.v4.poolManager);

          if (allowance.isUnlimited) {
            console.log(`    ✅ ${token.symbol}: Unlimited`);
          } else if (BigInt(allowance.allowance) > 0) {
            console.log(`    ⚠️  ${token.symbol}: ${allowance.formatted} (limited)`);
          } else {
            console.log(`    ❌ ${token.symbol}: Not approved`);
          }
        } catch (error) {
          console.log(`    ❌ ${token.symbol}: Error checking`);
        }
      }
    }
  }

  // Pre-flight check for a sample swap
  if (tokensWithBalance.length >= 2) {
    console.log("\n\n✈️  Pre-Flight Check (Sample Swap):");

    const token1 = tokensWithBalance[0];
    const token2 = tokensWithBalance[1];

    // Try to swap 10% of first token for second token
    const swapAmount = (BigInt(token1.balance) * BigInt(10)) / BigInt(100);

    console.log(
      `  Checking swap: ${ethers.formatUnits(swapAmount, token1.decimals)} ${token1.symbol} → ${token2.symbol}`
    );

    try {
      const token1Addr = getCommonToken(token1.symbol, CHAIN);
      const spender = chain.uniswap.v3?.router || chain.uniswap.v2?.router;

      if (!spender) {
        console.log("  ❌ No Uniswap router available on this chain");
      } else {
        const check = await preFlightCheck(CHAIN, token1Addr, walletAddr, spender, swapAmount.toString());

        console.log(`\n  Balance: ${check.checks.balance.passed ? "✅" : "❌"}`);
        console.log(`  Allowance: ${check.checks.allowance.passed ? "✅" : "❌"}`);
        console.log(`  Gas: ${check.checks.gas.passed ? "✅" : "❌"}`);

        if (check.ready) {
          console.log(`\n  ✅ Ready to swap!`);
        } else {
          console.log(`\n  ❌ Not ready to swap`);

          if (!check.checks.balance.passed) {
            console.log(`     - Insufficient balance`);
          }
          if (!check.checks.allowance.passed) {
            console.log(`     - Approval needed`);
          }
          if (!check.checks.gas.passed) {
            console.log(`     - Insufficient gas (need at least 0.001 ETH)`);
          }
        }
      }
    } catch (error) {
      console.error(`  ❌ Pre-flight check failed: ${error.message}`);
    }
  }

  // Summary
  console.log("\n\n📋 Summary:");
  const hasTokens = tokensWithBalance.length > 0;
  const hasGas = (await getNativeBalance(CHAIN, walletAddr).then(b => BigInt(b.balance))) >= ethers.parseEther("0.001");

  if (hasTokens && hasGas) {
    console.log("  ✅ Wallet is ready for swaps");
    console.log(`  ${tokensWithBalance.length} token(s) with balance`);
  } else if (!hasTokens) {
    console.log("  ⚠️  No tokens found in wallet");
    console.log("  Fund wallet with tokens to start swapping");
  } else if (!hasGas) {
    console.log("  ⚠️  Low gas balance");
    console.log("  Fund wallet with ETH for transaction fees");
  }
}

main();
