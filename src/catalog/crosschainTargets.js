/**
 * Targets for the single `crosschain` driver (`npm run crosschain -- <key>`).
 *
 * One row per Subgraph-backed tracker that used to be its own npm script
 * (`crosschain:<key>`). Fields: key, module, env.
 */
const TARGETS = [
  { key: "balancer:tvl", module: "src/crosschain/balancer/tvlTracker.js" },
  { key: "balancer:volume", module: "src/crosschain/balancer/volumeTracker.js" },
  { key: "balancer:weekly:tvl", module: "src/crosschain/balancer/weeklyTvlTracker.js" },
  { key: "balancer:weekly:volume", module: "src/crosschain/balancer/weeklyVolumeTracker.js" },
  { key: "curve:tvl", module: "src/crosschain/curve/tvlTracker.js" },
  { key: "curve:volume", module: "src/crosschain/curve/volumeTracker.js" },
  { key: "curve:weekly:tvl", module: "src/crosschain/curve/weeklyTvlTracker.js" },
  { key: "curve:weekly:volume", module: "src/crosschain/curve/weeklyVolumeTracker.js" },
  { key: "sushiswap:tvl", module: "src/crosschain/sushiswap/tvlTracker.js" },
  { key: "sushiswap:volume", module: "src/crosschain/sushiswap/volumeTracker.js" },
  { key: "sushiswap:weekly:tvl", module: "src/crosschain/sushiswap/weeklyTvlTracker.js" },
  { key: "sushiswap:weekly:volume", module: "src/crosschain/sushiswap/weeklyVolumeTracker.js" },
  { key: "uniswap:tvl", module: "src/crosschain/uniswap/tvlTracker.js" },
  { key: "uniswap:volume", module: "src/crosschain/uniswap/volumeTracker.js" },
  { key: "uniswap:liquidity", module: "src/crosschain/uniswap/liquidityTracker.js" },
  { key: "uniswap:weekly:tvl", module: "src/crosschain/uniswap/weeklyTvlTracker.js" },
  { key: "uniswap:weekly:volume", module: "src/crosschain/uniswap/weeklyVolumeTracker.js" },
  { key: "uniswap:weekly:liquidity", module: "src/crosschain/uniswap/weeklyLiquidityTracker.js" },
];

module.exports = { TARGETS };
