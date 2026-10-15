/**
 * Sum DefiLlama TVL + borrowed across one or more lending-style slugs.
 * Set DEFILLAMA_SLUGS (comma-separated, required). Optional DEFILLAMA_LABEL.
 *
 * Borrowed is taken from the aggregate `borrowed` key when present, otherwise
 * the sum of per-chain `*-borrowed` keys — never both (DefiLlama double-counts).
 * TVL uses the latest protocol series point (excludes borrowed).
 *
 * Optional DEFILLAMA_SMOKE=1: print one OK line and exit non-zero if any slug
 * lacks positive borrowed (or, if DEFILLAMA_SMOKE_TVL=1, positive TVL).
 */
require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchDefiLlamaProtocol, lastTvlUsdFromSeries } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * @param {Record<string, number>|undefined|null} cct
 * @returns {number|null}
 */
function borrowedFromChainTvls(cct) {
  if (!cct || typeof cct !== "object") return null;
  const agg = numOrNull(cct.borrowed);
  if (agg != null) return agg;
  let sum = 0;
  let any = false;
  for (const [k, v] of Object.entries(cct)) {
    if (!k.endsWith("-borrowed")) continue;
    const n = numOrNull(v);
    if (n == null) continue;
    sum += n;
    any = true;
  }
  return any ? sum : null;
}

async function loadSlug(slug) {
  const d = await fetchDefiLlamaProtocol(slug);
  const tvl = lastTvlUsdFromSeries(d.tvl);
  const borrowed = borrowedFromChainTvls(d.currentChainTvls);
  return { slug, name: d.name || slug, tvl, borrowed, cct: d.currentChainTvls || {} };
}

async function main() {
  installCliSafeStdout();
  const raw = (process.env.DEFILLAMA_SLUGS || "").trim();
  const slugs = raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (!slugs.length) {
    throw new Error("Set DEFILLAMA_SLUGS (e.g. curve-llamalend,curve-llamalend-v2)");
  }
  const label = (process.env.DEFILLAMA_LABEL || slugs.join(" + ")).trim();
  const rows = [];
  for (const slug of slugs) {
    rows.push(await loadSlug(slug));
  }

  if (process.env.DEFILLAMA_SMOKE === "1") {
    const wantTvl = process.env.DEFILLAMA_SMOKE_TVL === "1";
    for (const r of rows) {
      const ok = wantTvl ? r.tvl != null && r.tvl > 0 : r.borrowed != null && r.borrowed > 0;
      if (!ok) {
        throw new Error(
          `${r.slug}: ${wantTvl ? "TVL" : "borrowed"} ${wantTvl ? r.tvl : r.borrowed} is not positive`
        );
      }
    }
    const sumB = rows.reduce((a, r) => a + (r.borrowed || 0), 0);
    const sumT = rows.reduce((a, r) => a + (r.tvl || 0), 0);
    console.log(
      chalk.green(
        `OK: ${label} | borrowed $${sumB.toFixed(0)} | TVL $${sumT.toFixed(0)} (${rows.length} slugs)`
      )
    );
    return;
  }

  console.log(chalk.cyan.bold(`\n${label} (DefiLlama borrowed sum)\n`));
  console.log(chalk.gray(`Slugs: ${slugs.join(", ")} (DEFILLAMA_SLUGS)\n`));
  console.log(
    chalk.gray(
      "Borrowed uses the aggregate `borrowed` key when present, else sum of `*-borrowed` (not both).\n"
    )
  );

  const t = createTable(["Slug", "Name", "TVL", "Borrowed"], {
    colAligns: ["left", "left", "right", "right"],
  });
  let sumTvl = 0;
  let sumBorrowed = 0;
  for (const r of rows) {
    if (r.tvl != null) sumTvl += r.tvl;
    if (r.borrowed != null) sumBorrowed += r.borrowed;
    t.push([
      r.slug,
      r.name,
      r.tvl != null ? formatCurrency(r.tvl) : "—",
      r.borrowed != null ? formatCurrency(r.borrowed) : "—",
    ]);
  }
  t.push(["SUM", "", formatCurrency(sumTvl), formatCurrency(sumBorrowed)]);
  console.log(t.toString());

  for (const r of rows) {
    const chainRows = Object.entries(r.cct).filter(([, v]) => typeof v === "number" && v > 0);
    if (!chainRows.length) continue;
    const ct = createTable(["Chain / key", "USD"], { colAligns: ["left", "right"] });
    for (const [c, v] of chainRows) ct.push([c, formatCurrency(v)]);
    console.log(chalk.yellow(`\n${r.slug} — currentChainTvls\n`));
    console.log(ct.toString());
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { borrowedFromChainTvls, loadSlug };
