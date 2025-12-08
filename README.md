## Overview

Ethereum DeFi analytics scripts focusing on cross-chain DEX analytics and MEV analysis. Supports Ethereum, Arbitrum, Optimism, Base, Polygon, and BSC.

<p align="center">
  <img src="no-money-meme.jpg" alt="No Money Meme" width="500"/>
</p>

## Setup

```bash
npm install
```

Create `.env` with RPC URLs:
```env
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org/
```

## Scripts

### Bridge Liquidity Flow
```bash
npm run crosschain:bridge:flow
```

Tracks token flows from Ethereum Mainnet to L2s (Arbitrum, Optimism, Base) by monitoring bridge transfers for major tokens (WETH, USDC, USDT).

### TVL Tracker
```bash
npm run crosschain:uniswap:tvl
```

Tracks Uniswap V1-V4 TVL across all chains using DefiLlama API. Outputs console reports with version breakdowns, market share analysis, and CSV exports to `output/`.

### Volume Tracker
```bash
npm run crosschain:uniswap:volume
```

Tracks 24h trading volume across V1-V4 Uniswap versions on all chains. Includes version breakdowns, market share analysis, and CSV exports.

### Liquidity Tracker
```bash
npm run crosschain:uniswap:liquidity
```

Tracks liquidity flows across Uniswap V2, V3, and V4 by monitoring mint/burn events and liquidity changes across all supported chains.

### Weekly TVL Tracker
```bash
npm run crosschain:uniswap:weekly:tvl
```

Tracks daily TVL stats for each day of the current week (Monday-Sunday). Provides daily breakdowns, weekly trends, chain-by-chain analysis, and CSV exports with day-over-day changes.

### Weekly Volume Tracker
```bash
npm run crosschain:uniswap:weekly:volume
```

Tracks daily trading volume for each day of the current week. Includes daily volume breakdowns, weekly trends, highest/lowest volume days, and chain-by-chain daily comparisons.

### Weekly Liquidity Tracker
```bash
npm run crosschain:uniswap:weekly:liquidity
```

Tracks daily liquidity/TVL changes for each day of the current week. Monitors liquidity flows (inflows/outflows), calculates net weekly flow, and provides daily change percentages with visualizations.

## Analytics Scripts

### Efficiency Comparison
```bash
npm run analytics:efficiency
```

Compares volume/TVL ratios across Uniswap versions (V1-V4) to demonstrate capital efficiency improvements, particularly V3's concentrated liquidity superiority over V2.

### Milestone Tracker
```bash
npm run analytics:milestones
```

Tracks key milestones and metrics for Uniswap protocols across different versions and chains.

### Liquidity Depth Analysis
```bash
npm run analytics:liquidity
```

Analyzes liquidity depth and price impact for popular trading pairs (ETH/USDC, WBTC/ETH, etc.) to show real-world V3 benefits for LPs and traders.

### Cross-Chain Arbitrage
```bash
npm run analytics:arbitrage
```

Identifies arbitrage opportunities across different chains by analyzing price discrepancies for the same token pairs.

### V4 Capital Efficiency
```bash
npm run analytics:v4efficiency
```

Analyzes Uniswap V4 capital efficiency improvements and features compared to previous versions.

### Gas Cost Comparison
```bash
npm run analytics:gas
```

Compares gas costs across different Uniswap versions and chains to understand transaction cost differences.

### Fee Density
```bash
npm run analytics:feedensity
```

Analyzes fee generation density across Uniswap pools and versions to identify the most profitable liquidity positions.

### Price Discrepancy
```bash
npm run analytics:pricediscrepancy
```

Identifies price discrepancies for tokens across different chains to find cross-chain arbitrage opportunities.

### Weekly Fee Density Tracker
```bash
npm run analytics:weekly:feedensity
```

Tracks daily fee density (fees per dollar of TVL) for each day of the current week. Monitors fee generation trends across protocols, identifies when protocols become more/less profitable, and provides daily rankings.

### Weekly Milestone Tracker
```bash
npm run analytics:weekly:milestones
```

Tracks daily growth rates and milestone progress for each day of the current week. Monitors progress toward ATH, daily TVL changes per version, and weekly growth trends.

### Weekly Efficiency Tracker
```bash
npm run analytics:weekly:efficiency
```

Tracks daily efficiency ratios (volume/TVL) for each day of the current week. Shows which versions are improving/declining in capital efficiency and tracks efficiency trends over time.

### Weekly V4 Efficiency Tracker
```bash
npm run analytics:weekly:v4efficiency
```

Tracks daily V4 capital efficiency for each day of the current week. Monitors V4 performance trends, efficiency changes, and chain-by-chain V4 performance.

## Planned Protocols

### Established Protocols (Pre-2025)
- [ ] **Lido Finance** - Liquid Staking (~$26.4B TVL)
- [ ] **Aave** - Lending & Borrowing (~$33.4B TVL)
- [ ] **Curve Finance** - DEX Stablecoin-Focused (~$2.6B TVL)
- [ ] **Balancer** - DEX & Liquidity Management (~$260M TVL)
- [ ] **Morpho** - Lending Optimizer (~$5.93B TVL)
- [ ] **SushiSwap** - AMM DEX (~$108M TVL)

### 2025 Launched Protocols
- [ ] **Reya Network** - High-Speed AMM DEX L2 (~$500M+ TVL)
- [ ] **Aster DEX** - Multi-Chain AMM Perp/Spot (~$300M TVL)
- [ ] **Ammalgam** - Hybrid AMM + Lending (~$80M TVL)
- [ ] **Kinto** - KYC-Modular AMM DEX (~$200M TVL)
- [ ] **Curvy v2** - ZK Stealth AMM Aggregator (~$50M TVL)
- [ ] **Milk Road Swap** - Gasless Multi-Chain AMM (~$150M TVL)
- [ ] **HumidiFi** - Prop AMM DEX (~$100M TVL)
- [ ] **Lighter** - ZK Perp AMM Starknet L2 (~$120M TVL)
- [ ] **Drake Exchange** - CLOB-AMM Perp DEX (~$40M TVL)
- [ ] **Kintsu** - Liquid Staking AMM (~$60M TVL)
- [ ] **Curvance** - Multi-Chain Isolated AMM (~$70M TVL)
- [ ] **Resolv Labs** - Trustless Stablecoin AMM (~$272M TVL)
- [ ] **StakeStone** - LST AMM DEX (~$51M TVL)
- [ ] **Zama FHEVM DEX** - Privacy AMM FHE (~$30M TVL)
- [ ] **Aztec Ignition DEX** - Decentralized Privacy AMM L2 (~$80M TVL)
- [ ] **Monad AMM (Native)** - EVM-Compatible AMM L1 (~$187M TVL)
- [ ] **Base Liquidity AMM (AERO Fork)** - Base Ecosystem AMM (~$250M TVL)
- [ ] **Morpho Base AMM** - Lending-Optimized AMM (~$2.04B TVL)
- [ ] **Soneium DEX** - Enterprise AMM L2 (~$45M TVL)
- [ ] **MegaETH AMM** - High-Perf AMM L2 (~$90M TVL)

## Contributing

Contributions for additional chains, protocols, or analysis methods are welcome.
