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
| TVL | `npm run crosschain:uniswap:tvl` | Tracks V1-V4 TVL across all chains with version breakdowns |
| Volume | `npm run crosschain:uniswap:volume` | Tracks 24h trading volume across V1-V4 versions |
| Liquidity | `npm run crosschain:uniswap:liquidity` | Tracks liquidity flows via mint/burn events |

#### Weekly Trackers
| Script | Command | Description |
|--------|---------|-------------|
| TVL | `npm run crosschain:uniswap:weekly:tvl` | Daily TVL stats for current week |
| Volume | `npm run crosschain:uniswap:weekly:volume` | Daily volume stats for current week |
| Liquidity | `npm run crosschain:uniswap:weekly:liquidity` | Daily liquidity changes for current week |

#### Analytics
| Script | Command | Description |
|--------|---------|-------------|
| Efficiency | `npm run analytics:efficiency` | Compares volume/TVL ratios across versions |
| Milestones | `npm run analytics:milestones` | Tracks key milestones and metrics |
| Liquidity Depth | `npm run analytics:liquidity` | Analyzes liquidity depth and price impact |
| Arbitrage | `npm run analytics:arbitrage` | Identifies cross-chain arbitrage opportunities |
| V4 Efficiency | `npm run analytics:v4efficiency` | Analyzes V4 capital efficiency improvements |
| Gas Cost | `npm run analytics:gas` | Compares gas costs across versions and chains |
| Fee Density | `npm run analytics:feedensity` | Analyzes fee generation density |
| Price Discrepancy | `npm run analytics:pricediscrepancy` | Identifies price discrepancies across chains |

#### Weekly Analytics
| Script | Command | Description |
|--------|---------|-------------|
| Fee Density | `npm run analytics:weekly:feedensity` | Daily fee density for current week |
| Milestones | `npm run analytics:weekly:milestones` | Daily growth rates and milestone progress |
| Efficiency | `npm run analytics:weekly:efficiency` | Daily efficiency ratios for current week |
| V4 Efficiency | `npm run analytics:weekly:v4efficiency` | Daily V4 capital efficiency for current week |

---

### [Future Protocols]

_Additional protocols will follow the same structure: Trackers → Weekly Trackers → Analytics → Weekly Analytics_

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
