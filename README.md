## Overview

This repository contains scripts in the Ethereum space, specifically focusing on:

- **DeFi / MEV Builders**
- **Cross-Chain Analytics**

All scripts analyze DeFi protocols activity across multiple chains including Ethereum, Arbitrum, Optimism, Base, Polygon, and BSC.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with RPC URLs:
```env
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org/
```

## Scripts

### Cross-Chain Analytics Scripts

#### 1. Pool TVL Aggregator
Aggregates Uniswap pool TVL across multiple chains with detailed version breakdowns.

```bash
npm run crosschain:uniswap:tvl
```

**What it does:**
- Fetches TVL data for Uniswap V1, V2, V3, and V4 from DefiLlama API
- Aggregates TVL across all supported chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC)
- Calculates market share by chain and version distribution
- Provides detailed breakdowns showing:
  - Total TVL per chain
  - TVL by Uniswap version (V1-V4) per chain
  - Market share percentages
  - Version adoption rates across the ecosystem
- Generates visual charts and tables in console output
- Exports comprehensive data to CSV

**Data Source:** DefiLlama API (`api.llama.fi`)

**Output Format:**
- **Console:** Detailed report with:
  - Executive summary with total TVL across all chains
  - Version breakdown with percentage shares and visual bars
  - Detailed table showing TVL by chain and version
  - Market share visualization by chain
- **CSV:** `output/uniswap-tvl-aggregator.csv` with columns:
  - Chain name
  - V1 TVL (USD)
  - V2 TVL (USD)
  - V3 TVL (USD)
  - V4 TVL (USD)
  - Total TVL (USD)
  - Market Share (%)

## Output

All CSV reports are saved to the `output/` directory. Make sure this directory exists or it will be created automatically.

## Chain Support

Currently supported chains:
- Ethereum (Mainnet)
- Arbitrum
- Optimism
- Base
- Polygon
- BSC (Binance Smart Chain)

## Dependencies

- `ethers` - Ethereum library for blockchain interactions
- `axios` - HTTP client for API calls
- `csv-writer` - CSV export functionality
- `dotenv` - Environment variable management

## TODO: Upcoming DeFi Protocols

The following top DEX protocols are planned for future analysis and integration:

- [ ] **Curve Finance** - Stablecoin and pegged asset DEX aggregator
- [ ] **Balancer** - Automated market maker with customizable pools
- [ ] **PancakeSwap** - Leading DEX on BSC and other chains
- [ ] **SushiSwap** - Multi-chain DEX with yield farming
- [ ] **1inch** - DEX aggregator and router
- [ ] **dYdX** - Decentralized exchange and perpetuals platform
- [ ] **GMX** - Decentralized spot and perpetual exchange

## Contributing

Feel free to extend these scripts with additional chains, protocols, or analysis methods.

