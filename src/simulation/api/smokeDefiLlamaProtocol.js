require("dotenv").config();
const chalk = require("chalk");
const {
  fetchDefiLlamaProtocol,
  fetchFeesSummary,
  fetchOpenInterestSummary,
  fetchVolumeSummary,
  lastTvlUsdFromSeries,
  llamaDeadLabel,
} = require("../../analytics/utils/defiLlamaProtocol");

const slug = (process.env.SMOKE_SLUG || "").trim();
// TVL must be above SMOKE_MIN_TVL_USD (default: any positive value). "0" allows a $0 / missing TVL row.
const allowZeroTvl = process.env.SMOKE_MIN_TVL_USD === "0";
const minTvl = parseFloat(process.env.SMOKE_MIN_TVL_USD || "0") || 0;
// SMOKE_FEES=1: also require a positive 24h revenue from /summary/fees/{slug}?dataType=dailyRevenue
const checkFees = process.env.SMOKE_FEES === "1";
// SMOKE_OI=1: also require a positive open interest (`total24h`) from /summary/open-interest/{slug}
const checkOi = process.env.SMOKE_OI === "1";
// SMOKE_VOLUME=dexs|aggregators: also require a positive 30d volume from /summary/{kind}/{slug}
const volumeKind = (process.env.SMOKE_VOLUME || "").trim();
// A venue whose liveness is proven by fees, OI or volume may legitimately hold $0 TVL (aggregators, launchpads).
const tvlOptional = allowZeroTvl || checkFees || checkOi || Boolean(volumeKind);

function positive(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function fail(msg) {
  console.error(chalk.red(msg));
  process.exit(1);
}

async function main() {
  if (!slug) fail("Set SMOKE_SLUG (e.g. reya-perps)");
  if (volumeKind && volumeKind !== "dexs" && volumeKind !== "aggregators") {
    fail(`SMOKE_VOLUME must be dexs or aggregators, got "${volumeKind}"`);
  }
  try {
    const d = await fetchDefiLlamaProtocol(slug);
    const tvl = lastTvlUsdFromSeries(d.tvl);
    if (d.name == null && tvl == null) fail("Unexpected payload");
    const name = d.name || slug;
    const dead = llamaDeadLabel(d);
    if (dead && process.env.SMOKE_ALLOW_DEAD !== "1") fail(`DefiLlama marks ${name} ${dead}`);
    console.log(chalk.green(`OK: ${name} | TVL ${tvl != null ? `$${tvl.toFixed(0)}` : "—"}`));
    if (!tvlOptional && !(tvl != null && tvl > minTvl)) {
      fail(`TVL ${tvl != null ? `$${tvl.toFixed(0)}` : "missing"} is not above $${minTvl}`);
    }
    if (checkFees) {
      const r = await fetchFeesSummary(slug, undefined, "dailyRevenue");
      const rev24h = positive(r?.total24h);
      if (rev24h == null) fail(`No positive 24h revenue on /summary/fees/${slug}`);
      console.log(chalk.green(`OK: ${name} | 24h revenue $${rev24h.toFixed(0)}`));
    }
    if (checkOi) {
      const r = await fetchOpenInterestSummary(slug);
      const oi = positive(r?.total24h);
      if (oi == null) fail(`No positive open interest on /summary/open-interest/${slug}`);
      console.log(chalk.green(`OK: ${name} | open interest $${oi.toFixed(0)}`));
    }
    if (volumeKind) {
      const r = await fetchVolumeSummary(slug, volumeKind);
      const vol30d = positive(r?.total30d);
      if (vol30d == null) fail(`No positive 30d volume on /summary/${volumeKind}/${slug}`);
      console.log(chalk.green(`OK: ${name} | 30d volume $${vol30d.toFixed(0)}`));
    }
  } catch (e) {
    const status = e.response?.status;
    if (process.env.SMOKE_ALLOW_NOT_LISTED === "1" && (status === 404 || status === 400)) {
      console.log(chalk.yellow(`skip: protocol not listed or invalid slug (HTTP ${status}) — ${slug}`));
      process.exit(0);
    }
    fail(e.message || String(e));
  }
}

main().catch(e => fail(e.message || e));
