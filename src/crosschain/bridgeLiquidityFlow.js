// Ethereum L1 Bridge Liquidity Flow Tracker
// Tracks token flows from Ethereum Mainnet to L2s (Arbitrum, Optimism, Base)

require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const { CHAINS, COMMON_TOKENS } = require("../config/chains");
const { getProvider, getBlockNumber } = require("../utils/web3");
const { formatUSD } = require("../utils/prices");
const { writeCSV } = require("../utils/csv");

// ERC20 Transfer ABI
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Canonical L2 Bridge addresses on Ethereum L1
// These are the official bridges where tokens are locked when bridging FROM Ethereum TO L2s
const BRIDGE_ADDRESSES = {
  ethereum: {
    // Arbitrum One: L1 Gateway Router (handles ERC20 bridging)
    arbitrum: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
    // Optimism: L1StandardBridge (handles ERC20 bridging)
    optimism: "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1", 
    // Base: L1StandardBridge (handles ERC20 bridging)
    base: "0x3154Cf16ccdb4C6C9224f07Fd54f0F0E659b1653",
  },
};

const BLOCKS_TO_ANALYZE = process.env.BLOCKS_TO_ANALYZE ? parseInt(process.env.BLOCKS_TO_ANALYZE) : 1000; // Last N blocks
const CHUNK_SIZE = 10; // Alchemy free tier limit: max 10 blocks per eth_getLogs request
const TEST_MODE = process.env.TEST_MODE === "true"; // Set TEST_MODE=true to see all transfers
const START_BLOCK = process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : null; // Set specific start block

// Note: This script tracks ERC20 token transfers (WETH, USDC, USDT), NOT native ETH transfers.
// Bridge transfers are relatively rare. With free tier, we can only check small ranges.
// For comprehensive analysis, upgrade to Alchemy PAYG which allows larger block ranges.

async function trackBridgeFlow(chainKey, tokenAddress) {
  const chain = CHAINS[chainKey];
  if (!chain) {
    console.warn(`   ⚠️  Unknown chain: ${chainKey}`);
    return [];
  }
  
  if (!chain.rpcUrl) {
    console.warn(`   ⚠️  No RPC URL configured for ${chain.name}. Set ${chainKey.toUpperCase()}_RPC_URL in .env`);
    return [];
  }

  const provider = getProvider(chainKey);
  const currentBlock = await getBlockNumber(chainKey);
  const startBlock = START_BLOCK || Math.max(0, currentBlock - BLOCKS_TO_ANALYZE);
  const endBlock = START_BLOCK ? Math.min(START_BLOCK + BLOCKS_TO_ANALYZE, currentBlock) : currentBlock;

  console.log(`   📍 Analyzing blocks ${startBlock} to ${endBlock} (${endBlock - startBlock} blocks)`);
  console.log(`   ℹ️  Current block: ${currentBlock}`);

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const bridges = BRIDGE_ADDRESSES[chainKey] || {};

  if (Object.keys(bridges).length === 0) {
    console.warn(`   ⚠️  No bridge addresses configured for ${chain.name}`);
  }

  const flows = [];

  // TEST MODE: Check if we can detect ANY transfers at all
  if (TEST_MODE) {
    console.log(`   🧪 TEST MODE: Checking for any transfers (not just bridges)...`);
    try {
      const testFilter = token.filters.Transfer();
      const testTransfers = await token.queryFilter(testFilter, startBlock, Math.min(startBlock + 10, currentBlock));
      console.log(`   ✅ Found ${testTransfers.length} total transfers in first 10 blocks`);
      if (testTransfers.length > 0) {
        const sample = testTransfers[0];
        console.log(`   📋 Sample transfer: from ${sample.args.from} to ${sample.args.to}`);
      }
    } catch (testError) {
      console.error(`   ❌ Test mode error:`, testError.message);
    }
  }

  // Track transfers to/from bridge addresses
  for (const [targetChain, bridgeAddress] of Object.entries(bridges)) {
    try {
      // Ensure proper address checksum
      const checksummedAddress = ethers.getAddress(bridgeAddress.toLowerCase());
      
      console.log(`   🔍 Querying bridge: ${chain.name} <-> ${targetChain} (${checksummedAddress})`);
      
      // Query in chunks to avoid rate limits
      const allOutboundTransfers = [];
      const allInboundTransfers = [];
      
      const totalChunks = Math.ceil((currentBlock - startBlock) / CHUNK_SIZE);
      let chunkCount = 0;
      
      for (let fromBlock = startBlock; fromBlock < endBlock; fromBlock += CHUNK_SIZE) {
        const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, endBlock);
        chunkCount++;
        
        try {
          // Query transfers FROM bridge (outbound)
          const outboundFilter = token.filters.Transfer(checksummedAddress, null);
          const outboundTransfers = await token.queryFilter(outboundFilter, fromBlock, toBlock);
          allOutboundTransfers.push(...outboundTransfers);

          // Query transfers TO bridge (inbound)
          const inboundFilter = token.filters.Transfer(null, checksummedAddress);
          const inboundTransfers = await token.queryFilter(inboundFilter, fromBlock, toBlock);
          allInboundTransfers.push(...inboundTransfers);
          
          // Progress indicator
          if (chunkCount % 5 === 0 || chunkCount === totalChunks) {
            console.log(`      📊 Progress: ${chunkCount}/${totalChunks} chunks (${allOutboundTransfers.length + allInboundTransfers.length} transfers found)`);
          }
          
          // Delay to avoid rate limiting (200ms between requests)
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (chunkError) {
          console.warn(`      ⚠️  Error querying blocks ${fromBlock}-${toBlock}: ${chunkError.message}`);
        }
      }

      console.log(`      Outbound: ${allOutboundTransfers.length} transfers`);
      console.log(`      Inbound: ${allInboundTransfers.length} transfers`);

      // Process outbound transfers
      for (const transfer of allOutboundTransfers) {
        const amount = parseFloat(ethers.formatUnits(transfer.args.value, await token.decimals()));
        flows.push({
          chain: chain.name,
          targetChain: targetChain,
          sourceChain: chain.name,
          direction: "outbound",
          amount,
          txHash: transfer.transactionHash,
          block: transfer.blockNumber,
          timestamp: (await provider.getBlock(transfer.blockNumber)).timestamp,
          explorer: chain.explorer,
        });
      }

      // Process inbound transfers
      for (const transfer of allInboundTransfers) {
        const amount = parseFloat(ethers.formatUnits(transfer.args.value, await token.decimals()));
        flows.push({
          chain: chain.name,
          targetChain: chain.name,
          sourceChain: targetChain,
          direction: "inbound",
          amount,
          txHash: transfer.transactionHash,
          block: transfer.blockNumber,
          timestamp: (await provider.getBlock(transfer.blockNumber)).timestamp,
          explorer: chain.explorer,
        });
      }
    } catch (error) {
      console.warn(`      ❌ Error tracking flows for ${chain.name} -> ${targetChain}:`, error.message);
    }
  }

  return flows;
}

async function generateReport() {
  console.log(`\n🌉 Ethereum L1 Bridge Liquidity Flow Tracker`);
  console.log(`============================================\n`);

  // Check Ethereum configuration
  if (!CHAINS.ethereum?.rpcUrl) {
    console.error(`❌ Ethereum RPC URL not configured. Please set ETHEREUM_RPC_URL in .env file.`);
    return;
  }

  console.log(`📡 Tracking: Ethereum Mainnet → L2 Bridges`);
  console.log(`ℹ️  Free tier limit: Analyzing last ${BLOCKS_TO_ANALYZE} blocks in ${CHUNK_SIZE}-block chunks`);
  console.log(`   (Upgrade to Alchemy PAYG for larger block ranges)\n`);

  if (TEST_MODE) {
    console.log(`🧪 TEST MODE ENABLED - Will show sample transfers\n`);
  }

  const allFlows = [];
  const tokensToTrack = ["WETH", "USDC", "USDT"];

  for (const tokenSymbol of tokensToTrack) {
    console.log(`\n📊 Tracking ${tokenSymbol} flows on Ethereum L1...`);

    const tokenAddress = COMMON_TOKENS[tokenSymbol]?.ethereum;
    if (!tokenAddress) {
      console.log(`   ⏭️  Skipping ${tokenSymbol} (no address configured)`);
      continue;
    }

    try {
      console.log(`\n   🔄 Processing Ethereum Mainnet...`);
      const flows = await trackBridgeFlow("ethereum", tokenAddress);
      allFlows.push(...flows.map((f) => ({ ...f, token: tokenSymbol })));
      console.log(`   ✅ Ethereum: ${flows.length} bridge transfers found`);
    } catch (error) {
      console.error(`   ❌ Error on Ethereum:`, error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    }
  }

  if (allFlows.length === 0) {
    console.log(`\n✅ No significant liquidity flows detected in analyzed blocks.\n`);
    return;
  }

  // Get token prices
  const prices = await axios
    .get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: "ethereum,usd-coin,tether",
        vs_currencies: "usd",
      },
    })
    .then((res) => ({
      WETH: res.data.ethereum.usd,
      USDC: res.data["usd-coin"].usd,
      USDT: res.data.tether.usd,
    }))
    .catch(() => ({ WETH: 3000, USDC: 1, USDT: 1 }));

  // Calculate flow statistics
  const flowStats = {};
  for (const flow of allFlows) {
    const key = `${flow.sourceChain} -> ${flow.targetChain}`;
    if (!flowStats[key]) {
      flowStats[key] = {
        route: key,
        count: 0,
        totalVolume: 0,
        token: flow.token,
      };
    }
    flowStats[key].count++;
    flowStats[key].totalVolume += flow.amount * (prices[flow.token] || 1);
  }

  console.log(`\n📈 Bridge Flow Summary:\n`);

  const sortedFlows = Object.values(flowStats).sort((a, b) => b.totalVolume - a.totalVolume);

  sortedFlows.slice(0, 10).forEach((flow) => {
    console.log(`🔹 ${flow.route}`);
    console.log(`   Volume: ${formatUSD(flow.totalVolume)}`);
    console.log(`   Transfers: ${flow.count}\n`);
  });

  // Export to CSV
  const csvData = sortedFlows.map((flow) => ({
    route: flow.route,
    token: flow.token,
    volumeUSD: flow.totalVolume,
    transferCount: flow.count,
  }));

  await writeCSV(
    "output/ethereum-l1-bridge-flows.csv",
    [
      { id: "route", title: "Route" },
      { id: "token", title: "Token" },
      { id: "volumeUSD", title: "Volume (USD)" },
      { id: "transferCount", title: "Transfer Count" },
    ],
    csvData,
  );

  console.log(`\n✅ Report generated!\n`);
}

if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { trackBridgeFlow, generateReport };


