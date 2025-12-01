// Main entry point for Uniswap analytics scripts

const uniswapTVLAggregator = require("./crosschain/uniswapTVLAggregator");

module.exports = {
  // Cross-Chain
  crosschain: {
    uniswapTVLAggregator,
  },
};

