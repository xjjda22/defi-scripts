/**
 * Onchain options snapshot centered on Derive.
 * Notional and premium: /summary/options/derive-options (dailyNotionalVolume, dailyPremiumVolume).
 * TVL: /protocol/derive (parent; the options child has no TVL series).
 * Share: Derive vs Paradex vs the rest of /overview/options (dailyNotionalVolume).
 * Hypercall has a protocol page but no options-volume adapter, so this prints its TVL
 * and says volume is not tracked.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const {
  fetchDefiLlamaProtocol,
  fetchOptionsSummary,
  fetchOptionsOverview,
  lastTvlUsdFromSeries,
} = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const DERIVE_OPTIONS_SLUG = "derive-options";
const DERIVE_TVL_SLUG = "derive";
const HYPERCALL_SLUG = "hypercall";

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatShare(part, total) {
  if (part == null || total == null || total === 0) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function windowsOf(row) {
  return {
    h24: numOrNull(row?.total24h),
    d7: numOrNull(row?.total7d),
    d30: numOrNull(row?.total30d),
  };
}

function restOf(total, ...parts) {
  if (total == null) return null;
  let sum = 0;
  for (const p of parts) {
    if (p == null) return null;
    sum += p;
  }
  return total - sum;
}

function matchVenue(protocols, slug, name) {
  const list = protocols || [];
  return list.find(p => p.slug === slug) || list.find(p => String(p.displayName || p.name || "") === name) || null;
}

function printWindowTable(title, row) {
  const w = windowsOf(row);
  const t = createTable(["Window", "Value"], { colAligns: ["left", "right"] });
  t.push(["24h", w.h24 != null ? formatCurrency(w.h24) : "—"]);
  t.push(["7d", w.d7 != null ? formatCurrency(w.d7) : "—"]);
  t.push(["30d", w.d30 != null ? formatCurrency(w.d30) : "—"]);
  console.log(chalk.yellow(`\n${title}\n`));
  console.log(t.toString());
}

function printTvl(label, d) {
  const tvl = lastTvlUsdFromSeries(d.tvl);
  const t = createTable(["Field", "Value"], { colAligns: ["left", "right"] });
  t.push(["Name", d.name || "—"]);
  t.push(["TVL (latest)", tvl != null ? formatCurrency(tvl) : "—"]);
  t.push(["Category", d.category || "—"]);
  t.push(["URL", d.url || "—"]);
  console.log(chalk.yellow(`\n${label}\n`));
  console.log(t.toString());
  if (d.currentChainTvls && typeof d.currentChainTvls === "object") {
    const rows = Object.entries(d.currentChainTvls).filter(([, v]) => typeof v === "number" && v > 0);
    if (rows.length) {
      const ct = createTable(["Chain", "TVL"], { colAligns: ["left", "right"] });
      for (const [c, v] of rows) ct.push([c, formatCurrency(v)]);
      console.log(chalk.yellow("\nTVL by chain\n"));
      console.log(ct.toString());
    }
  }
  return tvl;
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nDerive options (DefiLlama)\n"));
  console.log(chalk.gray("Trailing 24h/7d/30d windows, not a calendar month.\n"));

  try {
    const [deriveProtocol, notional, premium, overview] = await Promise.all([
      fetchDefiLlamaProtocol(DERIVE_TVL_SLUG),
      fetchOptionsSummary(DERIVE_OPTIONS_SLUG, "dailyNotionalVolume"),
      fetchOptionsSummary(DERIVE_OPTIONS_SLUG, "dailyPremiumVolume"),
      fetchOptionsOverview("dailyNotionalVolume"),
    ]);

    printTvl(`TVL (DefiLlama /protocol/${DERIVE_TVL_SLUG})`, deriveProtocol);
    printWindowTable(
      `Notional (DefiLlama /summary/options/${DERIVE_OPTIONS_SLUG}?dataType=dailyNotionalVolume)`,
      notional
    );
    printWindowTable(
      `Premium (DefiLlama /summary/options/${DERIVE_OPTIONS_SLUG}?dataType=dailyPremiumVolume)`,
      premium
    );

    const protocols = Array.isArray(overview.protocols) ? overview.protocols : [];
    const deriveRow = matchVenue(protocols, "derive-options", "Derive Options");
    const paradexRow = matchVenue(protocols, "paradex-options", "Paradex Options");
    const total = windowsOf(overview);
    const derive = windowsOf(deriveRow);
    const paradex = windowsOf(paradexRow);
    const rest = {
      h24: restOf(total.h24, derive.h24, paradex.h24),
      d7: restOf(total.d7, derive.d7, paradex.d7),
      d30: restOf(total.d30, derive.d30, paradex.d30),
    };

    const share = createTable(["Venue", "24h", "7d", "30d", "24h share", "30d share"], {
      colAligns: ["left", "right", "right", "right", "right", "right"],
    });
    const pushVenue = (name, w) => {
      share.push([
        name,
        w.h24 != null ? formatCurrency(w.h24) : "—",
        w.d7 != null ? formatCurrency(w.d7) : "—",
        w.d30 != null ? formatCurrency(w.d30) : "—",
        formatShare(w.h24, total.h24),
        formatShare(w.d30, total.d30),
      ]);
    };
    pushVenue(deriveRow?.displayName || deriveRow?.name || "Derive", derive);
    pushVenue(paradexRow?.displayName || paradexRow?.name || "Paradex", paradex);
    pushVenue("Rest", rest);
    pushVenue("Total", total);
    console.log(chalk.yellow("\nNotional share (DefiLlama /overview/options?dataType=dailyNotionalVolume)\n"));
    console.log(share.toString());
    if (!deriveRow) console.log(chalk.gray("  Derive row missing on /overview/options"));
    if (!paradexRow) console.log(chalk.gray("  Paradex row missing on /overview/options"));
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }

  try {
    const hyper = await fetchDefiLlamaProtocol(HYPERCALL_SLUG);
    printTvl(`Hypercall TVL (DefiLlama /protocol/${HYPERCALL_SLUG})`, hyper);
    console.log(chalk.gray("\nOptions volume: not tracked on DefiLlama (no options-volume adapter).\n"));
  } catch (e) {
    console.log(chalk.yellow(`\nHypercall (DefiLlama /protocol/${HYPERCALL_SLUG})\n`));
    console.log(chalk.gray(`  TVL unavailable: ${e.message || e}`));
    console.log(chalk.gray("  Options volume: not tracked on DefiLlama (no options-volume adapter).\n"));
  }
}

if (require.main === module) {
  main();
}
