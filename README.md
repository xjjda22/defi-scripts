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

### Cross-Chain Uniswap

#### Trackers
| Script | Command | Description |
|--------|---------|-------------|
| TVL | `npm run crosschain:uniswap:tvl` <br> `npm run crosschain:uniswap:weekly:tvl` | Tracks V1-V4 TVL across all chains with version breakdowns |
| Volume | `npm run crosschain:uniswap:volume` <br> `npm run crosschain:uniswap:weekly:volume` | Tracks 24h trading volume across V1-V4 versions |
| Liquidity | `npm run crosschain:uniswap:liquidity` <br> `npm run crosschain:uniswap:weekly:liquidity` | Tracks liquidity flows via mint/burn events |

#### Analytics
| Script | Command | Description |
|--------|---------|-------------|
| Weekly Block Analysis | `npm run analytics:weekly:blocks` | Comprehensive block-level transaction and gas analysis |


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
