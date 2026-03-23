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
```

## Scripts

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

### DEX Analytics

Compare prices and analyze pools across different DEX protocols:

| Script | Command | Description |
|--------|---------|-------------|
| **Uniswap Prices** | `npm run analytics:uniswap:prices` | Compare V2/V3/V4 prices and fees (`priceMonitor.js`; quote-centric, unlike `poolMonitor` on other DEXs). |
| **Curve Pools** | `npm run analytics:curve:pools` | Monitor pool balances and arbitrage opportunities |
| **Balancer Pools** | `npm run analytics:balancer:pools` | Track weighted pools and impermanent loss |
| **SushiSwap Pools** | `npm run analytics:sushiswap:pools` | Compare SushiSwap vs Uniswap prices |
| **Multi-DEX Prices** | `npm run analytics:dex:prices` | Aggregate prices across all DEXs |
| **AMM aggregate (Llama)** | `npm run analytics:amm:aggregate` | One-shot TVL snapshot for major AMMs via DefiLlama |
| **Reya (Llama)** | `npm run analytics:reya:dex` | Protocol summary when listed (slug overridable via env) |
| **Ammalgam (Llama)** | `npm run analytics:ammalgam:hybrid` | Hybrid AMM + lending summary when `AMMALGAM_LLAMA_SLUG` is set |
| **Curvy (Llama)** | `npm run analytics:curvy:aggregator` | Curvy / ZK aggregator monitor from DefiLlama |

### Lending Analytics

Track lending rates and compare protocols:

| Script | Command | Description |
|--------|---------|-------------|
| **Aave Markets** | `npm run analytics:aave:markets` | Aave V3 supply/borrow rates and utilization (all configured chains) |
| **Aave Versions** | `npm run analytics:aave:versions` | Aave V2 vs V3 comparison (L1/L2 labels) |
| **Aave Liquidations** | `npm run analytics:aave:liquidations` | Recent `LiquidationCall` logs; optional `AAVE_WATCH_ADDRESSES` for health factors |
| **Morpho vs Aave** | `npm run analytics:morpho:optimizer` | Morpho Blue (API) vs Aave V3 rates per chain |
| **Lending aggregator** | `npm run analytics:lending:rates` | Best supply/borrow across Aave + Morpho; cross-chain summary |
| **All lending (Llama)** | `npm run analytics:lending:aggregate` | Pull several lending protocols from DefiLlama in one run |

### Staking (LST) analytics

| Script | Command | Description |
|--------|---------|-------------|
| **Lido** | `npm run analytics:lido:staking` | stETH APR (Lido API), TVL (DefiLlama), mainnet peg; L2 wstETH needs RPCs |
| **StakeStone** | `npm run analytics:stakestone:staking` | TVL from DefiLlama; optional `STAKESTONE_YIELDS_POOL_ID` for chart APY |
| **Kintsu** | `npm run analytics:kintsu:staking` | TVL from DefiLlama; APY from yields chart (override with `KINTSU_YIELDS_POOL_ID`) |
| **LST compare** | `npm run analytics:staking:compare` | Lido vs StakeStone vs Kintsu — heuristic score + size-band notes |
| **All staking (Llama)** | `npm run analytics:staking:aggregate` | Pull multiple LST / staking protocols from DefiLlama in one run |

### Simulation and swaps

| Command | Purpose |
|---------|---------|
| `npm run simulate:quote` / `simulate:swap` | Quote or simulate a swap (`SIMULATE_ONLY=true` for quote-only) |
| `npm run simulate:multi:quote` / `simulate:multi` | Multi-protocol quote comparison |
| `npm run swap:example`, `swap:uniswap:v2`, `v3`, `v4`, `swap:sushiswap`, `swap:balancer`, `swap:curve`, `swap:autoroute`, `swap:crosschain`, `swap:check` | Example execution flows (require wallet config in `.env`) |

### Other Analytics

| Script | Command | Description |
|--------|---------|-------------|
| **Weekly Blocks** | `npm run analytics:weekly:blocks` | Block-level transaction and gas analysis |


## Planned Protocols

### Established Protocols (Pre-2025)
- [x] **Uniswap** - DEX AMM [![Uniswap](https://img.shields.io/badge/Uniswap-V2%20%7C%20V3%20%7C%20V4-ff007a.svg)](https://uniswap.org)
- [x] **Lido Finance** - Liquid Staking [![Lido](https://img.shields.io/badge/Lido-00A3FF?logo=lido&logoColor=white)](https://lido.fi)
- [x] **Aave** - Lending & Borrowing [![Aave](https://img.shields.io/badge/Aave-1C202F?logo=aave&logoColor=white)](https://aave.com)
- [x] **Curve Finance** - DEX Stablecoin-Focused [![Curve](https://img.shields.io/badge/Curve-0000FF?logo=curve&logoColor=white)](https://curve.fi)
- [x] **Balancer** - DEX & Liquidity Management [![Balancer](https://img.shields.io/badge/Balancer-1E1E1E?logo=balancer&logoColor=white)](https://balancer.fi)
- [x] **Morpho** - Lending Optimizer [![Morpho](https://img.shields.io/badge/Morpho-161C3D?logoColor=white)](https://morpho.org)
- [x] **SushiSwap** - AMM DEX [![SushiSwap](https://img.shields.io/badge/SushiSwap-FA52A0?logo=sushi&logoColor=white)](https://sushi.com)

### 2025 Launched Protocols
- [x] **Reya Network** - High-Speed AMM DEX L2 [![Reya](https://img.shields.io/badge/Reya-2B2D42?logoColor=white)](https://reya.network)
- [ ] **Aster DEX** - Multi-Chain AMM Perp/Spot [![Aster](https://img.shields.io/badge/Aster-7B2CBF?logoColor=white)](https://aster.finance)
- [x] **Ammalgam** - Hybrid AMM + Lending [![Ammalgam](https://img.shields.io/badge/Ammalgam-06FFA5?logoColor=black)](https://ammalgam.fi)
- [ ] **Kinto** - KYC-Modular AMM DEX [![Kinto](https://img.shields.io/badge/Kinto-000000?logoColor=white)](https://kinto.xyz)
- [x] **Curvy v2** - ZK Stealth AMM Aggregator [![Curvy](https://img.shields.io/badge/Curvy-FF6B6B?logoColor=white)](https://curvy.finance)
- [ ] **Milk Road Swap** - Gasless Multi-Chain AMM [![Milk Road](https://img.shields.io/badge/Milk_Road-FFFFFF?logoColor=black)](https://milkroad.com)
- [ ] **HumidiFi** - Prop AMM DEX [![HumidiFi](https://img.shields.io/badge/HumidiFi-4ECDC4?logoColor=white)](https://humidifi.xyz)
- [ ] **Lighter** - ZK Perp AMM Starknet L2 [![Lighter](https://img.shields.io/badge/Lighter-FFD93D?logoColor=black)](https://lighter.xyz)
- [ ] **Drake Exchange** - CLOB-AMM Perp DEX [![Drake](https://img.shields.io/badge/Drake-E63946?logoColor=white)](https://drake.exchange)
- [x] **Kintsu** - Liquid Staking AMM [![Kintsu](https://img.shields.io/badge/Kintsu-F77F00?logoColor=white)](https://kintsu.xyz)
- [x] **Curvance** - Multi-Chain Isolated AMM [![Curvance](https://img.shields.io/badge/Curvance-6A4C93?logoColor=white)](https://curvance.com) *(DefiLlama slug in `simulate:lending:aggregate:smoke`)*
- [x] **Resolv Labs** - Trustless Stablecoin AMM [![Resolv](https://img.shields.io/badge/Resolv-2EC4B6?logoColor=white)](https://resolv.xyz) *(DefiLlama slug in `simulate:lending:aggregate:smoke`)*
- [x] **StakeStone** - LST AMM DEX [![StakeStone](https://img.shields.io/badge/StakeStone-8B5CF6?logoColor=white)](https://stakestone.io)
- [ ] **Zama FHEVM DEX** - Privacy AMM FHE [![Zama](https://img.shields.io/badge/Zama-000000?logoColor=white)](https://zama.ai)
- [ ] **Aztec Ignition DEX** - Decentralized Privacy AMM L2 [![Aztec](https://img.shields.io/badge/Aztec-1E1E1E?logoColor=white)](https://aztec.network)
- [ ] **Monad AMM (Native)** - EVM-Compatible AMM L1 [![Monad](https://img.shields.io/badge/Monad-9333EA?logoColor=white)](https://monad.xyz)
- [ ] **Base Liquidity AMM (AERO Fork)** - Base Ecosystem AMM [![Base](https://img.shields.io/badge/Base-0052FF?logo=base&logoColor=white)](https://base.org)
- [x] **Morpho Base AMM** - Lending-Optimized AMM [![Morpho](https://img.shields.io/badge/Morpho-161C3D?logoColor=white)](https://morpho.org) *(same Morpho / lending stack as above)*
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
