/**
 * Smoke for analytics:derive:options.
 * Fails when /summary/options/derive-options dailyNotionalVolume errors
 * or 30d notional is missing or not > 0.
 * Also reads /protocol/derive and /overview/options so the OK line includes TVL and share.
 */

require("dotenv").config();
const chalk = require("chalk");
const {
  fetchDefiLlamaProtocol,
  fetchOptionsSummary,
  fetchOptionsOverview,
  lastTvlUsdFromSeries,
} = require("../../analytics/utils/defiLlamaProtocol");

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function matchVenue(protocols, slug, name) {
  const list = protocols || [];
  return list.find(p => p.slug === slug) || list.find(p => String(p.displayName || p.name || "") === name) || null;
}

async function main() {
  const notional = await fetchOptionsSummary("derive-options", "dailyNotionalVolume");
  const n30 = numOrNull(notional?.total30d);
  if (n30 == null || n30 <= 0) {
    console.error(chalk.red("Derive 30d notional is not > 0"));
    process.exit(1);
  }

  const [protocol, overview] = await Promise.all([
    fetchDefiLlamaProtocol("derive"),
    fetchOptionsOverview("dailyNotionalVolume"),
  ]);
  const tvl = lastTvlUsdFromSeries(protocol.tvl);
  const total30 = numOrNull(overview?.total30d);
  const deriveRow = matchVenue(overview?.protocols, "derive-options", "Derive Options");
  const paradexRow = matchVenue(overview?.protocols, "paradex-options", "Paradex Options");
  const derive30 = numOrNull(deriveRow?.total30d);
  const paradex30 = numOrNull(paradexRow?.total30d);
  const share = derive30 != null && total30 ? (derive30 / total30) * 100 : null;
  const paradexShare = paradex30 != null && total30 ? (paradex30 / total30) * 100 : null;

  const tvlText = tvl != null ? `$${tvl.toFixed(0)}` : "—";
  const shareText = share != null ? `${share.toFixed(1)}%` : "—";
  const paradexText = paradex30 != null ? `$${paradex30.toFixed(0)}` : "—";
  const paradexShareText = paradexShare != null ? `${paradexShare.toFixed(1)}%` : "—";
  const totalText = total30 != null ? `$${total30.toFixed(0)}` : "—";
  console.log(
    chalk.green(
      `OK: Derive Options | 30d notional $${n30.toFixed(0)} | TVL ${tvlText} | 30d share ${shareText} | Paradex 30d ${paradexText} (${paradexShareText}) | market 30d ${totalText}`
    )
  );
}

main().catch(e => {
  console.error(chalk.red(e.message || e));
  process.exit(1);
});
