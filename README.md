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

### Pool TVL Aggregator
```bash
npm run crosschain:uniswap:tvl
```

Aggregates Uniswap V1-V4 TVL across all chains using DefiLlama API. Outputs console reports with version breakdowns, market share analysis, and CSV exports to `output/`.

### Volume Comparison
```bash
npm run crosschain:uniswap:volume
```

Compares 24h trading volume across V1-V4 Uniswap versions on all chains. Includes version breakdowns, market share analysis, and CSV exports.

### Liquidity Flow Tracker
```bash
npm run crosschain:uniswap:liquidity
```

Tracks token flows between Ethereum L1 and L2 bridges (Arbitrum, Optimism, Base) for major tokens (WETH, USDC, USDT).

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

## Planned Protocols

- [ ] Curve Finance
- [ ] Balancer
- [ ] PancakeSwap
- [ ] SushiSwap
- [ ] 1inch
- [ ] dYdX
- [ ] GMX

## Contributing

Contributions for additional chains, protocols, or analysis methods are welcome.
