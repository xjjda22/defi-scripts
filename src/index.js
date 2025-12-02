// Main entry point for Uniswap analytics scripts

const uniswapTVLAggregator = require("./crosschain/uniswap/tvlAggregator");

module.exports = {
  // Cross-Chain
  crosschain: {
    uniswapTVLAggregator,
  },
};

