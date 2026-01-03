require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { CHAINS } = require("../config/chains");

// Configuration
const DAYS_TO_ANALYZE = 1;
const MAX_BLOCKS = 1000; // Maximum blocks to analyze per chain
const BATCH_SIZE = 100; // Process blocks in batches to avoid rate limits
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

// Chain configurations with block times (in seconds)
// Using chains from config/chains.js and adding block time metadata
const CHAIN_CONFIG = {
  ethereum: {
    name: "Ethereum L1",
    rpcUrl: CHAINS.ethereum?.rpcUrl || process.env.ETHEREUM_RPC_URL || process.env.ETH_RPC_URL,
    chainId: CHAINS.ethereum?.chainId || 1,
    blockTime: 12, // ~12 seconds per block
    estimatedBlocksPerDay: 7200, // ~7200 blocks per day
  },
  arbitrum: {
    name: "Arbitrum",
    rpcUrl: CHAINS.arbitrum?.rpcUrl || process.env.ARBITRUM_RPC_URL,
    chainId: CHAINS.arbitrum?.chainId || 42161,
    blockTime: 0.25, // ~0.25 seconds per block
    estimatedBlocksPerDay: 345600, // ~345,600 blocks per day
  },
  base: {
    name: "Base",
    rpcUrl: CHAINS.base?.rpcUrl || process.env.BASE_RPC_URL,
    chainId: CHAINS.base?.chainId || 8453,
    blockTime: 2, // ~2 seconds per block
    estimatedBlocksPerDay: 43200, // ~43,200 blocks per day
  },
  optimism: {
    name: "Optimism",
    rpcUrl: CHAINS.optimism?.rpcUrl || process.env.OPTIMISM_RPC_URL,
    chainId: CHAINS.optimism?.chainId || 10,
    blockTime: 2, // ~2 seconds per block
    estimatedBlocksPerDay: 43200, // ~43,200 blocks per day
  },
};

// Utility: Sleep function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Get block range for the last N days
async function getBlockRange(provider, days, estimatedBlocksPerDay) {
  const latestBlock = await provider.getBlockNumber();
  const latestBlockData = await provider.getBlock(latestBlock);
  const latestTimestamp = latestBlockData.timestamp;

  // Calculate target timestamp (N days ago)
  const targetTimestamp = latestTimestamp - days * 24 * 60 * 60;

  // Estimate start block (faster for L2 chains with many blocks)
  let estimatedStartBlock = Math.max(0, latestBlock - estimatedBlocksPerDay * days);
  
  // Binary search with better starting point
  let low = estimatedStartBlock;
  let high = latestBlock;
  let startBlock = latestBlock;

  // First, check if our estimate is close
  const estimatedBlock = await provider.getBlock(estimatedStartBlock);
  if (estimatedBlock.timestamp >= targetTimestamp) {
    // Estimate is too recent, search backwards
    high = estimatedStartBlock;
    low = Math.max(0, estimatedStartBlock - estimatedBlocksPerDay * days);
  } else {
    // Estimate is too old, search forwards
    low = estimatedStartBlock;
  }

  // Binary search to find the block number at target timestamp
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    if (block.timestamp >= targetTimestamp) {
      startBlock = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return {
    startBlock,
    endBlock: latestBlock,
    startTimestamp: (await provider.getBlock(startBlock)).timestamp,
    endTimestamp: latestTimestamp,
  };
}

// Analyze a single block
async function analyzeBlock(provider, blockNumber) {
  try {
    const block = await provider.getBlock(blockNumber, { includeTransactions: true });
    if (!block) return null;

    const analysis = {
      blockNumber: Number(block.number),
      timestamp: Number(block.timestamp),
      transactionCount: block.transactions.length,
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
      baseFeePerGas: block.baseFeePerGas
        ? block.baseFeePerGas.toString()
        : null,
      totalValue: 0n,
      contractCreations: 0,
      uniqueContracts: new Set(),
      uniqueAddresses: new Set(),
      totalDataSize: 0,
      failedTransactions: 0,
    };

    // Analyze transactions
    for (const tx of block.transactions) {
      try {
        // Get transaction receipt for gas usage
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (!receipt) continue;

        if (receipt.status === 0) {
          analysis.failedTransactions++;
        }

        // Track contract creations
        if (receipt.contractAddress) {
          analysis.contractCreations++;
          analysis.uniqueContracts.add(receipt.contractAddress.toLowerCase());
        }

        // Track unique addresses
        if (tx.from) {
          analysis.uniqueAddresses.add(tx.from.toLowerCase());
        }
        if (tx.to) {
          analysis.uniqueAddresses.add(tx.to.toLowerCase());
        } else {
          // Contract creation
          if (receipt.contractAddress) {
            analysis.uniqueAddresses.add(
              receipt.contractAddress.toLowerCase(),
            );
          }
        }

        // Sum value (ethers v6 uses bigint)
        if (tx.value) {
          analysis.totalValue = analysis.totalValue + BigInt(tx.value.toString());
        }

        // Data size
        if (tx.data && tx.data !== "0x") {
          analysis.totalDataSize += (tx.data.length - 2) / 2; // bytes
        }
      } catch (err) {
        // Skip if receipt not found (might be pending)
        continue;
      }
    }

    return {
      ...analysis,
      totalValue: analysis.totalValue.toString(),
      uniqueContractsCount: analysis.uniqueContracts.size,
      uniqueAddressesCount: analysis.uniqueAddresses.size,
    };
  } catch (err) {
    console.error(`Error analyzing block ${blockNumber}:`, err.message);
    return null;
  }
}

// Analyze blocks in batches
async function analyzeBlocks(provider, startBlock, endBlock, chainName) {
  const totalBlocks = endBlock - startBlock + 1;
  const batches = Math.ceil(totalBlocks / BATCH_SIZE);
  const results = [];

  console.log(
    `\n📊 Analyzing ${totalBlocks.toLocaleString()} blocks for ${chainName}...`,
  );
  console.log(`   Blocks ${startBlock} to ${endBlock}`);
  console.log(`   Processing in ${batches} batches of ${BATCH_SIZE} blocks\n`);

  for (let i = 0; i < batches; i++) {
    const batchStart = startBlock + i * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endBlock);

    console.log(
      `   Processing batch ${i + 1}/${batches}: blocks ${batchStart}-${batchEnd}`,
    );

    const batchPromises = [];
    for (let blockNum = batchStart; blockNum <= batchEnd; blockNum++) {
      batchPromises.push(analyzeBlock(provider, blockNum));
    }

    const batchResults = await Promise.all(batchPromises);
    const validResults = batchResults.filter((r) => r !== null);
    results.push(...validResults);

    // Progress update
    const processed = results.length;
    const progress = ((processed / totalBlocks) * 100).toFixed(1);
    console.log(
      `   ✓ Processed ${processed.toLocaleString()}/${totalBlocks.toLocaleString()} blocks (${progress}%)`,
    );

    // Delay between batches to avoid rate limits
    if (i < batches - 1) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return results;
}

// Aggregate analysis results
function aggregateResults(blockResults) {
  if (blockResults.length === 0) {
    return null;
  }

  const aggregated = {
    totalBlocks: blockResults.length,
    timeRange: {
      start: new Date(blockResults[0].timestamp * 1000).toISOString(),
      end: new Date(
        blockResults[blockResults.length - 1].timestamp * 1000,
      ).toISOString(),
      durationDays:
        (blockResults[blockResults.length - 1].timestamp -
          blockResults[0].timestamp) /
        (24 * 60 * 60),
    },
    transactions: {
      total: 0,
      failed: 0,
      successful: 0,
      averagePerBlock: 0,
      maxInBlock: 0,
    },
    gas: {
      totalUsed: 0n,
      totalLimit: 0n,
      averageUsed: 0n,
      averageLimit: 0n,
      utilizationRate: 0,
    },
    value: {
      total: 0n,
      averagePerBlock: 0n,
    },
    contracts: {
      totalCreations: 0,
      uniqueContracts: new Set(),
    },
    addresses: {
      unique: new Set(),
    },
    data: {
      totalBytes: 0,
      averagePerBlock: 0,
    },
    fees: {
      totalBaseFee: 0n,
      averageBaseFee: 0n,
      blocksWithBaseFee: 0,
    },
  };

  for (const block of blockResults) {
    // Transactions
    aggregated.transactions.total += block.transactionCount;
    aggregated.transactions.failed += block.failedTransactions;
    aggregated.transactions.maxInBlock = Math.max(
      aggregated.transactions.maxInBlock,
      block.transactionCount,
    );

    // Gas
    aggregated.gas.totalUsed = aggregated.gas.totalUsed + BigInt(block.gasUsed);
    aggregated.gas.totalLimit = aggregated.gas.totalLimit + BigInt(block.gasLimit);

    // Value
    aggregated.value.total = aggregated.value.total + BigInt(block.totalValue);

    // Contracts
    aggregated.contracts.totalCreations += block.contractCreations;

    // Data
    aggregated.data.totalBytes += block.totalDataSize;

    // Base fee
    if (block.baseFeePerGas) {
      const baseFee = BigInt(block.baseFeePerGas);
      const gasUsed = BigInt(block.gasUsed);
      aggregated.fees.totalBaseFee = aggregated.fees.totalBaseFee + (baseFee * gasUsed);
      aggregated.fees.blocksWithBaseFee++;
    }
  }

  // Calculate averages
  aggregated.transactions.successful =
    aggregated.transactions.total - aggregated.transactions.failed;
  aggregated.transactions.averagePerBlock =
    aggregated.transactions.total / aggregated.totalBlocks;

  aggregated.gas.averageUsed = aggregated.gas.totalUsed / BigInt(aggregated.totalBlocks);
  aggregated.gas.averageLimit = aggregated.gas.totalLimit / BigInt(aggregated.totalBlocks);
  
  // Calculate utilization rate
  const utilization = Number(aggregated.gas.totalUsed * 10000n / aggregated.gas.totalLimit);
  aggregated.gas.utilizationRate = utilization / 100;

  aggregated.value.averagePerBlock = aggregated.value.total / BigInt(aggregated.totalBlocks);

  aggregated.data.averagePerBlock = aggregated.data.totalBytes / aggregated.totalBlocks;

  if (aggregated.fees.blocksWithBaseFee > 0) {
    aggregated.fees.averageBaseFee = aggregated.fees.totalBaseFee / BigInt(aggregated.fees.blocksWithBaseFee);
  }

  // Convert BigInts to strings for JSON serialization
  return {
    ...aggregated,
    gas: {
      totalUsed: aggregated.gas.totalUsed.toString(),
      totalLimit: aggregated.gas.totalLimit.toString(),
      averageUsed: aggregated.gas.averageUsed.toString(),
      averageLimit: aggregated.gas.averageLimit.toString(),
      utilizationRate: aggregated.gas.utilizationRate,
    },
    value: {
      total: aggregated.value.total.toString(),
      totalETH: ethers.formatEther(aggregated.value.total.toString()),
      averagePerBlock: aggregated.value.averagePerBlock.toString(),
      averagePerBlockETH: ethers.formatEther(aggregated.value.averagePerBlock.toString()),
    },
    fees: {
      totalBaseFee: aggregated.fees.totalBaseFee.toString(),
      totalBaseFeeETH: ethers.formatEther(aggregated.fees.totalBaseFee.toString()),
      averageBaseFee: aggregated.fees.averageBaseFee.toString(),
      averageBaseFeeETH: ethers.formatEther(aggregated.fees.averageBaseFee.toString()),
      blocksWithBaseFee: aggregated.fees.blocksWithBaseFee,
    },
  };
}

// Analyze a single chain
async function analyzeChain(chainKey, chainConfig) {
  if (!chainConfig.rpcUrl) {
    console.error(`❌ No RPC URL configured for ${chainConfig.name}`);
    return null;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔗 Analyzing ${chainConfig.name}`);
  console.log(`${"=".repeat(60)}`);

  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

    // Get block range
    console.log(`\n📍 Determining block range for last ${DAYS_TO_ANALYZE} days...`);
    const blockRange = await getBlockRange(
      provider,
      DAYS_TO_ANALYZE,
      chainConfig.estimatedBlocksPerDay,
    );
    let totalBlocks = blockRange.endBlock - blockRange.startBlock + 1;
    
    // Limit to MAX_BLOCKS (analyze most recent blocks)
    if (totalBlocks > MAX_BLOCKS) {
      const originalStartBlock = blockRange.startBlock;
      blockRange.startBlock = blockRange.endBlock - MAX_BLOCKS + 1;
      blockRange.startTimestamp = (await provider.getBlock(blockRange.startBlock)).timestamp;
      totalBlocks = MAX_BLOCKS;
      console.log(`\n   ⚠️  Limiting analysis to most recent ${MAX_BLOCKS.toLocaleString()} blocks`);
      console.log(`   Original range would have been ${(blockRange.endBlock - originalStartBlock + 1).toLocaleString()} blocks\n`);
    }
    
    console.log(
      `   Start Block: ${blockRange.startBlock.toLocaleString()}`,
    );
    console.log(`   End Block: ${blockRange.endBlock.toLocaleString()}`);
    console.log(`   Total Blocks: ${totalBlocks.toLocaleString()}`);
    console.log(
      `   Start Time: ${new Date(blockRange.startTimestamp * 1000).toISOString()}`,
    );
    console.log(
      `   End Time: ${new Date(blockRange.endTimestamp * 1000).toISOString()}`,
    );

    // Analyze blocks
    const blockResults = await analyzeBlocks(
      provider,
      blockRange.startBlock,
      blockRange.endBlock,
      chainConfig.name,
    );

    if (blockResults.length === 0) {
      console.log(`\n⚠️  No blocks analyzed for ${chainConfig.name}`);
      return null;
    }

    // Aggregate results
    console.log(`\n📈 Aggregating results...`);
    const aggregated = aggregateResults(blockResults);

    return {
      chain: chainConfig.name,
      chainId: chainConfig.chainId,
      blockRange,
      blockResults,
      aggregated,
    };
  } catch (err) {
    console.error(`\n❌ Error analyzing ${chainConfig.name}:`, err.message);
    return null;
  }
}

// Export results to JSON
function exportResults(allResults, outputDir = "./output") {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summaryFile = path.join(outputDir, `weekly-analysis-summary-${timestamp}.json`);
  const detailedFile = path.join(
    outputDir,
    `weekly-analysis-detailed-${timestamp}.json`,
  );

  // Summary (aggregated data only)
  const summary = allResults.map((result) => ({
    chain: result.chain,
    chainId: result.chainId,
    blockRange: result.blockRange,
    aggregated: result.aggregated,
  }));

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Summary saved to: ${summaryFile}`);

  // Detailed (includes all block-level data)
  fs.writeFileSync(detailedFile, JSON.stringify(allResults, null, 2));
  console.log(`💾 Detailed data saved to: ${detailedFile}`);

  return { summaryFile, detailedFile };
}

// Print summary report
function printSummary(allResults) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 WEEKLY BLOCK ANALYSIS SUMMARY`);
  console.log(`${"=".repeat(60)}\n`);

  for (const result of allResults) {
    if (!result || !result.aggregated) continue;

    const agg = result.aggregated;
    console.log(`\n🔗 ${result.chain} (Chain ID: ${result.chainId})`);
    console.log(`   Time Range: ${agg.timeRange.start} to ${agg.timeRange.end}`);
    console.log(`   Duration: ${agg.timeRange.durationDays.toFixed(2)} days`);
    console.log(`   Blocks Analyzed: ${agg.totalBlocks.toLocaleString()}`);

    console.log(`\n   📝 Transactions:`);
    console.log(
      `      Total: ${agg.transactions.total.toLocaleString()}`,
    );
    console.log(
      `      Successful: ${agg.transactions.successful.toLocaleString()}`,
    );
    console.log(
      `      Failed: ${agg.transactions.failed.toLocaleString()}`,
    );
    console.log(
      `      Avg per Block: ${agg.transactions.averagePerBlock.toFixed(2)}`,
    );
    console.log(
      `      Max in Block: ${agg.transactions.maxInBlock.toLocaleString()}`,
    );

    console.log(`\n   ⛽ Gas:`);
    console.log(
      `      Total Used: ${parseInt(agg.gas.totalUsed).toLocaleString()}`,
    );
    console.log(
      `      Avg Used: ${parseInt(agg.gas.averageUsed).toLocaleString()}`,
    );
    console.log(
      `      Utilization Rate: ${agg.gas.utilizationRate.toFixed(2)}%`,
    );

    console.log(`\n   💰 Value:`);
    console.log(`      Total: ${agg.value.totalETH} ETH`);
    console.log(
      `      Avg per Block: ${agg.value.averagePerBlockETH} ETH`,
    );

    console.log(`\n   📦 Contracts:`);
    console.log(
      `      Total Creations: ${agg.contracts.totalCreations.toLocaleString()}`,
    );

    console.log(`\n   📊 Data:`);
    console.log(
      `      Total: ${(agg.data.totalBytes / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `      Avg per Block: ${(agg.data.averagePerBlock / 1024).toFixed(2)} KB`,
    );

    if (agg.fees.blocksWithBaseFee > 0) {
      console.log(`\n   💵 Fees:`);
      console.log(
        `      Total Base Fee: ${agg.fees.totalBaseFeeETH} ETH`,
      );
      console.log(
        `      Avg Base Fee: ${agg.fees.averageBaseFeeETH} ETH`,
      );
    }
  }

  console.log(`\n${"=".repeat(60)}\n`);
}

// Main execution
async function main() {
  console.log(`\n🚀 Starting Weekly Block Analysis`);
  console.log(`   Analyzing last ${DAYS_TO_ANALYZE} days of blocks\n`);

  const results = [];

  // Analyze each chain
  for (const [chainKey, chainConfig] of Object.entries(CHAIN_CONFIG)) {
    const result = await analyzeChain(chainKey, chainConfig);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.log(`\n❌ No chains were successfully analyzed.`);
    console.log(`   Please check your RPC URLs in .env file.`);
    return;
  }

  // Print summary
  printSummary(results);

  // Export results
  const outputFiles = exportResults(results);

  console.log(`\n✅ Analysis complete!`);
  console.log(`   Analyzed ${results.length} chain(s)`);
  console.log(`   Results saved to: ${outputFiles.summaryFile}`);
}

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

module.exports = {
  analyzeChain,
  analyzeBlocks,
  getBlockRange,
  aggregateResults,
};
