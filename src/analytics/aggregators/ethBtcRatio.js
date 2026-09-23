/**
 * ETH / BTC spot and ratio across last month / this month / this week.
 *
 *   npm run analytics:ethbtc:ratio
 *
 * Chain TVL windows: npm run analytics:ethbtc:tvl
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { getTokenPrices, getDailyUsdPrices } = require("../../utils/prices");
const { createTable } = require("../utils/displayHelpers");
const { windowDates, nearest, pct } = require("./ethBtcTvl");

function formatPx(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

function formatRatio(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(4);
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function seriesToTvlMap(rows) {
  const byDate = {};
  for (const r of rows || []) {
    if (r && r.date && typeof r.price === "number") byDate[r.date] = r.price;
  }
  return byDate;
}

function ratioPoint(eth, btc) {
  if (!eth || !btc || !eth.tvl || !btc.tvl) return null;
  return { date: eth.date, tvl: eth.tvl / btc.tvl };
}

async function buildEthBtcRatio(now) {
  const when = now || new Date();
  const dates = windowDates(when);
  let ethSeries = [];
  let btcSeries = [];
  try {
    [ethSeries, btcSeries] = await Promise.all([
      getDailyUsdPrices("ethereum", 60),
      getDailyUsdPrices("bitcoin", 60),
    ]);
  } catch (err) {
    console.warn(chalk.yellow(`daily chart failed (${err.message || err}); windows use spot only`));
  }
  const spot = await getTokenPrices(["ethereum", "bitcoin"]);
  const ethSpot = spot.ethereum && typeof spot.ethereum.usd === "number" ? spot.ethereum.usd : null;
  const btcSpot = spot.bitcoin && typeof spot.bitcoin.usd === "number" ? spot.bitcoin.usd : null;
  const ethMap = seriesToTvlMap(ethSeries);
  const btcMap = seriesToTvlMap(btcSeries);
  const pick = (map, d) => nearest(map, d);
  const windows = {
    lastMonthStart: { eth: pick(ethMap, dates.lastMonthStart), btc: pick(btcMap, dates.lastMonthStart) },
    lastMonthEnd: { eth: pick(ethMap, dates.lastMonthEnd), btc: pick(btcMap, dates.lastMonthEnd) },
    thisMonthStart: { eth: pick(ethMap, dates.thisMonthStart), btc: pick(btcMap, dates.thisMonthStart) },
    thisWeekStart: { eth: pick(ethMap, dates.thisWeekStart), btc: pick(btcMap, dates.thisWeekStart) },
    latest: { eth: pick(ethMap, dates.today), btc: pick(btcMap, dates.today) },
  };
  const lastMonthEth = pct(windows.lastMonthStart.eth, windows.lastMonthEnd.eth);
  const lastMonthBtc = pct(windows.lastMonthStart.btc, windows.lastMonthEnd.btc);
  const thisMonthEth = pct(windows.thisMonthStart.eth, windows.latest.eth);
  const thisMonthBtc = pct(windows.thisMonthStart.btc, windows.latest.btc);
  const thisWeekEth = pct(windows.thisWeekStart.eth, windows.latest.eth);
  const thisWeekBtc = pct(windows.thisWeekStart.btc, windows.latest.btc);
  const r0 = ratioPoint(windows.lastMonthStart.eth, windows.lastMonthStart.btc);
  const r1 = ratioPoint(windows.lastMonthEnd.eth, windows.lastMonthEnd.btc);
  const r2 = ratioPoint(windows.thisMonthStart.eth, windows.thisMonthStart.btc);
  const r3 = ratioPoint(windows.thisWeekStart.eth, windows.thisWeekStart.btc);
  const r4 = ratioPoint(windows.latest.eth, windows.latest.btc);
  return {
    generatedAt: when.toISOString(),
    dates,
    spot: { eth: ethSpot, btc: btcSpot, ratio: ethSpot && btcSpot ? ethSpot / btcSpot : null },
    lastMonth: { eth: lastMonthEth, btc: lastMonthBtc, ratioFrom: r0, ratioTo: r1, ratioPct: pct(r0, r1) },
    thisMonth: { eth: thisMonthEth, btc: thisMonthBtc, ratioFrom: r2, ratioTo: r4, ratioPct: pct(r2, r4) },
    thisWeek: { eth: thisWeekEth, btc: thisWeekBtc, ratioFrom: r3, ratioTo: r4, ratioPct: pct(r3, r4) },
    windows,
  };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nETH / BTC price and ratio windows (CoinGecko)\n"));
  const board = await buildEthBtcRatio();
  const d = board.dates;
  console.log(
    chalk.gray(
      `Last month ${d.lastMonthStart} → ${d.lastMonthEnd}` +
        `  |  this month ${d.thisMonthStart} → ${d.today}` +
        `  |  this week ${d.thisWeekStart} → ${d.today}\n`
    )
  );
  const spot = createTable(["", "ETH", "BTC", "ETH/BTC"], {
    colAligns: ["left", "right", "right", "right"],
  });
  spot.push(["Spot", formatPx(board.spot.eth), formatPx(board.spot.btc), formatRatio(board.spot.ratio)]);
  const w = board.windows;
  spot.push([
    "Daily latest",
    formatPx(w.latest.eth && w.latest.eth.tvl),
    formatPx(w.latest.btc && w.latest.btc.tvl),
    formatRatio(board.thisWeek.ratioTo && board.thisWeek.ratioTo.tvl),
  ]);
  console.log(spot.toString());

  const t = createTable(["Window", "ETH", "BTC", "ETH/BTC Δ"], {
    colAligns: ["left", "right", "right", "right"],
  });
  t.push(["Last month", formatPct(board.lastMonth.eth), formatPct(board.lastMonth.btc), formatPct(board.lastMonth.ratioPct)]);
  t.push(["This month", formatPct(board.thisMonth.eth), formatPct(board.thisMonth.btc), formatPct(board.thisMonth.ratioPct)]);
  t.push(["This week", formatPct(board.thisWeek.eth), formatPct(board.thisWeek.btc), formatPct(board.thisWeek.ratioPct)]);
  console.log("");
  console.log(t.toString());
  console.log(chalk.gray("\nChain TVL: npm run analytics:ethbtc:tvl\n"));
}

module.exports = { buildEthBtcRatio, seriesToTvlMap };

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
