// Price fetching utilities
const axios = require("axios");

async function getTokenPrice(coingeckoId) {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: coingeckoId,
        vs_currencies: "usd",
      },
    });
    return response.data[coingeckoId]?.usd || 0;
  } catch (error) {
    console.warn(`Failed to fetch price for ${coingeckoId}:`, error.message);
    return 0;
  }
}

async function getTokenPrices(coingeckoIds) {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: coingeckoIds.join(","),
        vs_currencies: "usd,eth",
      },
    });
    return response.data;
  } catch (error) {
    console.warn(`Failed to fetch prices:`, error.message);
    return {};
  }
}

function formatUSD(value) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatETH(value, ethPrice) {
  return `Ξ ${(value / ethPrice).toFixed(6)}`;
}

module.exports = {
  getTokenPrice,
  getTokenPrices,
  formatUSD,
  formatETH,
};

