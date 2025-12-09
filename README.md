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

### Cross-Chain

#### Bridge Liquidity Flow
```bash
npm run crosschain:bridge:flow
```
Tracks token flows from Ethereum to L2s (Arbitrum, Optimism, Base) for WETH, USDC, USDT.

---

### Uniswap

#### Trackers
| Script | Command | Description |
|--------|---------|-------------|
| TVL | `npm run crosschain:uniswap:tvl` <br> `npm run crosschain:uniswap:weekly:tvl` | Tracks V1-V4 TVL across all chains with version breakdowns |
| Volume | `npm run crosschain:uniswap:volume` <br> `npm run crosschain:uniswap:weekly:volume` | Tracks 24h trading volume across V1-V4 versions |
| Liquidity | `npm run crosschain:uniswap:liquidity` <br> `npm run crosschain:uniswap:weekly:liquidity` | Tracks liquidity flows via mint/burn events |


#### Analytics
| Script | Command | Description |
|--------|---------|-------------|
| Efficiency | `npm run analytics:efficiency` <br> `npm run analytics:weekly:efficiency` | Compares volume/TVL ratios across versions |
| Milestones | `npm run analytics:milestones` <br> `npm run analytics:weekly:milestones` | Tracks key milestones and metrics |
| Liquidity Depth | `npm run analytics:liquidity` | Analyzes liquidity depth and price impact |
| Arbitrage | `npm run analytics:arbitrage` | Identifies cross-chain arbitrage opportunities |
| V4 Efficiency | `npm run analytics:v4efficiency` <br> `npm run analytics:weekly:v4efficiency` | Analyzes V4 capital efficiency improvements |
| Gas Cost | `npm run analytics:gas` | Compares gas costs across versions and chains |
| Fee Density | `npm run analytics:feedensity` <br> `npm run analytics:weekly:feedensity` | Analyzes fee generation density |
| Price Discrepancy | `npm run analytics:pricediscrepancy` | Identifies price discrepancies across chains |

---


## Planned Protocols

### Established Protocols (Pre-2025)
- [ ] **Uniswap** - DEX AMM
- [ ] **Lido Finance** - Liquid Staking
- [ ] **Aave** - Lending & Borrowing
- [ ] **Curve Finance** - DEX Stablecoin-Focused
- [ ] **Balancer** - DEX & Liquidity Management
- [ ] **Morpho** - Lending Optimizer
- [ ] **SushiSwap** - AMM DEX

### 2025 Launched Protocols
- [ ] **Reya Network** - High-Speed AMM DEX L2
- [ ] **Aster DEX** - Multi-Chain AMM Perp/Spot
- [ ] **Ammalgam** - Hybrid AMM + Lending
- [ ] **Kinto** - KYC-Modular AMM DEX
- [ ] **Curvy v2** - ZK Stealth AMM Aggregator
- [ ] **Milk Road Swap** - Gasless Multi-Chain AMM
- [ ] **HumidiFi** - Prop AMM DEX
- [ ] **Lighter** - ZK Perp AMM Starknet L2
- [ ] **Drake Exchange** - CLOB-AMM Perp DEX
- [ ] **Kintsu** - Liquid Staking AMM
- [ ] **Curvance** - Multi-Chain Isolated AMM
- [ ] **Resolv Labs** - Trustless Stablecoin AMM
- [ ] **StakeStone** - LST AMM DEX
- [ ] **Zama FHEVM DEX** - Privacy AMM FHE
- [ ] **Aztec Ignition DEX** - Decentralized Privacy AMM L2
- [ ] **Monad AMM (Native)** - EVM-Compatible AMM L1
- [ ] **Base Liquidity AMM (AERO Fork)** - Base Ecosystem AMM
- [ ] **Morpho Base AMM** - Lending-Optimized AMM
- [ ] **Soneium DEX** - Enterprise AMM L2
- [ ] **MegaETH AMM** - High-Perf AMM L2

## Contributing

Contributions for additional chains, protocols, or analysis methods are welcome.
