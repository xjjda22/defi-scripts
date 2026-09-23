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

/**
 * Daily USD closes from CoinGecko. `days` is inclusive lookback.
 * @param {string} coingeckoId
 * @param {number} [days]
 * @returns {Promise<Array<{ date: string, price: number }>>}
 */
async function getDailyUsdPrices(coingeckoId, days = 60) {
  const { data } = await axios.get(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}/market_chart`,
    {
      params: { vs_currency: "usd", days, interval: "daily" },
      timeout: 60000,
    }
  );
  const pts = Array.isArray(data && data.prices) ? data.prices : [];
  const byDate = {};
  for (const row of pts) {
    const ts = row && row[0];
    const px = row && row[1];
    if (typeof ts !== "number" || typeof px !== "number" || !Number.isFinite(px)) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
    byDate[date] = px;
  }
  return Object.keys(byDate)
    .sort()
    .map((date) => ({ date, price: byDate[date] }));
}

module.exports = {
  getTokenPrice,
  getTokenPrices,
  getDailyUsdPrices,
  formatUSD,
  formatETH,
};
