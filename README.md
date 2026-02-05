## Overview

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?logo=ethereum&logoColor=white)](https://ethereum.org)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Chains](https://img.shields.io/badge/chains-6-orange.svg)](#setup)


Ethereum DeFi analytics and swap scripts for cross-chain DEX analytics, token swaps, and MEV analysis. Supports Ethereum, Arbitrum, Optimism, Base, Polygon, and BSC.

<p align="center">
  <img src="no-money-meme.jpg" alt="No Money Meme" width="500"/>
</p>

**⭐ Star this repo if you find it useful!**

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

# For swaps, also set:
PRIVATE_KEY=0x...  # Your wallet private key
CHAIN=ethereum     # Target chain
```

## Scripts

### Token Swaps

Execute token swaps across multiple DEX protocols on all supported chains.

#### Multi-Protocol DEX Aggregator
| Script | Command | Description |
|--------|---------|-------------|
| **All DEX Auto-Route** | `npm run swap:autoroute` | Compares Uniswap, SushiSwap, Curve, Balancer - picks best |

#### Per-Protocol Auto-Route Swaps
| Protocol | Command | Auto-Routes Between | Description |
|----------|---------|---------------------|-------------|
| **Uniswap** | `npm run swap:example` | V2 / V3 / V4 | Auto-detects best Uniswap version |
| **SushiSwap** | `npm run swap:sushiswap` | V2 / V3 | Auto-detects best SushiSwap version |
| **Balancer** | `npm run swap:balancer` | V2 / V3 | Auto-detects best Balancer vault |
| **Curve** | `npm run swap:curve` | Multiple pools | Can compare multiple Curve pools |

#### Individual Protocol Versions
| Protocol | Command | Description |
|----------|---------|-------------|
| **Uniswap V2** | `npm run swap:uniswap:v2` | Force Uniswap V2 with multi-hop routing |
| **Uniswap V3** | `npm run swap:uniswap:v3` | Force Uniswap V3 with fee tier optimization |
| **Uniswap V4** | `npm run swap:uniswap:v4` | Force Uniswap V4 singleton PoolManager |

**Features:**
- 🔄 Auto-routing to find best prices across versions
- 💰 Quote comparison across V2, V3, and V4
- 🎯 Slippage protection
- 🔗 Multi-hop routing
- ⚡ V3 fee tier optimization
- 🆕 V4 hooks support

**Quick Example:**
```javascript
const { swapTokens, getCommonToken } = require('./src/swaps/swap');

// Auto-route to best price across V2/V3/V4
const result = await swapTokens(
  'ethereum',
  wallet,
  getCommonToken('WETH', 'ethereum'),
  getCommonToken('USDC', 'ethereum'),
  ethers.parseEther('0.1').toString(),
  { slippageBps: 50 } // 0.5% slippage
);
```

### Cross-Chain Analytics

Track TVL and volume across **all major DEXs** on 6 chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC):

| Protocol | TVL | Volume |
|----------|-----|--------|
| **Uniswap** | `npm run crosschain:uniswap:tvl` | `npm run crosschain:uniswap:volume` |
| **Curve** | `npm run crosschain:curve:tvl` | `npm run crosschain:curve:volume` |
| **Balancer** | `npm run crosschain:balancer:tvl` | `npm run crosschain:balancer:volume` |
| **SushiSwap** | `npm run crosschain:sushiswap:tvl` | `npm run crosschain:sushiswap:volume` |

**Weekly Trackers (Historical Data):**
- Uniswap: `npm run crosschain:uniswap:weekly:tvl`, `npm run crosschain:uniswap:weekly:volume`, `npm run crosschain:uniswap:weekly:liquidity`
- Curve: `npm run crosschain:curve:weekly:tvl`, `npm run crosschain:curve:weekly:volume`
- Balancer: `npm run crosschain:balancer:weekly:tvl`, `npm run crosschain:balancer:weekly:volume`
- SushiSwap: `npm run crosschain:sushiswap:weekly:tvl`, `npm run crosschain:sushiswap:weekly:volume`

**Additional Uniswap Trackers:**
- `npm run crosschain:uniswap:liquidity` - Liquidity flows via mint/burn events

**Other Analytics:**
- `npm run analytics:weekly:blocks` - Comprehensive block-level transaction and gas analysis


## Planned Protocols

### Established Protocols (Pre-2025)
- [ ] **Uniswap** - DEX AMM [![Uniswap](https://img.shields.io/badge/Uniswap-V2%20%7C%20V3%20%7C%20V4-ff007a.svg)](https://uniswap.org)
- [ ] **Lido Finance** - Liquid Staking [![Lido](https://img.shields.io/badge/Lido-00A3FF?logo=lido&logoColor=white)](https://lido.fi)
- [ ] **Aave** - Lending & Borrowing [![Aave](https://img.shields.io/badge/Aave-1C202F?logo=aave&logoColor=white)](https://aave.com)
- [ ] **Curve Finance** - DEX Stablecoin-Focused [![Curve](https://img.shields.io/badge/Curve-0000FF?logo=curve&logoColor=white)](https://curve.fi)
- [ ] **Balancer** - DEX & Liquidity Management [![Balancer](https://img.shields.io/badge/Balancer-1E1E1E?logo=balancer&logoColor=white)](https://balancer.fi)
- [ ] **Morpho** - Lending Optimizer [![Morpho](https://img.shields.io/badge/Morpho-161C3D?logoColor=white)](https://morpho.org)
- [ ] **SushiSwap** - AMM DEX [![SushiSwap](https://img.shields.io/badge/SushiSwap-FA52A0?logo=sushi&logoColor=white)](https://sushi.com)

### 2025 Launched Protocols
- [ ] **Reya Network** - High-Speed AMM DEX L2 [![Reya](https://img.shields.io/badge/Reya-2B2D42?logoColor=white)](https://reya.network)
- [ ] **Aster DEX** - Multi-Chain AMM Perp/Spot [![Aster](https://img.shields.io/badge/Aster-7B2CBF?logoColor=white)](https://aster.finance)
- [ ] **Ammalgam** - Hybrid AMM + Lending [![Ammalgam](https://img.shields.io/badge/Ammalgam-06FFA5?logoColor=black)](https://ammalgam.fi)
- [ ] **Kinto** - KYC-Modular AMM DEX [![Kinto](https://img.shields.io/badge/Kinto-000000?logoColor=white)](https://kinto.xyz)
- [ ] **Curvy v2** - ZK Stealth AMM Aggregator [![Curvy](https://img.shields.io/badge/Curvy-FF6B6B?logoColor=white)](https://curvy.finance)
- [ ] **Milk Road Swap** - Gasless Multi-Chain AMM [![Milk Road](https://img.shields.io/badge/Milk_Road-FFFFFF?logoColor=black)](https://milkroad.com)
- [ ] **HumidiFi** - Prop AMM DEX [![HumidiFi](https://img.shields.io/badge/HumidiFi-4ECDC4?logoColor=white)](https://humidifi.xyz)
- [ ] **Lighter** - ZK Perp AMM Starknet L2 [![Lighter](https://img.shields.io/badge/Lighter-FFD93D?logoColor=black)](https://lighter.xyz)
- [ ] **Drake Exchange** - CLOB-AMM Perp DEX [![Drake](https://img.shields.io/badge/Drake-E63946?logoColor=white)](https://drake.exchange)
- [ ] **Kintsu** - Liquid Staking AMM [![Kintsu](https://img.shields.io/badge/Kintsu-F77F00?logoColor=white)](https://kintsu.xyz)
- [ ] **Curvance** - Multi-Chain Isolated AMM [![Curvance](https://img.shields.io/badge/Curvance-6A4C93?logoColor=white)](https://curvance.com)
- [ ] **Resolv Labs** - Trustless Stablecoin AMM [![Resolv](https://img.shields.io/badge/Resolv-2EC4B6?logoColor=white)](https://resolv.xyz)
- [ ] **StakeStone** - LST AMM DEX [![StakeStone](https://img.shields.io/badge/StakeStone-8B5CF6?logoColor=white)](https://stakestone.io)
- [ ] **Zama FHEVM DEX** - Privacy AMM FHE [![Zama](https://img.shields.io/badge/Zama-000000?logoColor=white)](https://zama.ai)
- [ ] **Aztec Ignition DEX** - Decentralized Privacy AMM L2 [![Aztec](https://img.shields.io/badge/Aztec-1E1E1E?logoColor=white)](https://aztec.network)
- [ ] **Monad AMM (Native)** - EVM-Compatible AMM L1 [![Monad](https://img.shields.io/badge/Monad-9333EA?logoColor=white)](https://monad.xyz)
- [ ] **Base Liquidity AMM (AERO Fork)** - Base Ecosystem AMM [![Base](https://img.shields.io/badge/Base-0052FF?logo=base&logoColor=white)](https://base.org)
- [ ] **Morpho Base AMM** - Lending-Optimized AMM [![Morpho](https://img.shields.io/badge/Morpho-161C3D?logoColor=white)](https://morpho.org)
- [ ] **Soneium DEX** - Enterprise AMM L2 [![Soneium](https://img.shields.io/badge/Soneium-00D4FF?logoColor=white)](https://soneium.org)
- [ ] **MegaETH AMM** - High-Perf AMM L2 [![MegaETH](https://img.shields.io/badge/MegaETH-FF6B35?logoColor=white)](https://megaeth.systems)

## Contributing

Contributions are welcome! Please follow these guidelines:

**Code Guidelines:**
- Follow existing code structure and style
- Add JSDoc comments for functions
- Run `npm run prettier` before committing
- Test with fork tests when applicable

**Submitting:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request with clear description

**Security:** Never commit private keys or `.env` files.

## License
MIT
