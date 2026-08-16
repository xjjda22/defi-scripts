/**
 * Airdrop / points calendar (research only).
 * Does not claim, sybil, or submit txs. Optional join to defi-mev trends-report.
 *
 *   npm run analytics:airdrop:watch
 *   TRENDS_REPORT=/path/to/trends-report.json npm run analytics:airdrop:watch
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { createTable } = require("../utils/displayHelpers");

const WATCHLIST_PATH = path.join(__dirname, "watchlist.json");

function defaultTrendsPath() {
  if (process.env.TRENDS_REPORT) return process.env.TRENDS_REPORT;
  return path.join(__dirname, "..", "..", "..", "..", "defi-mev", "data", "trends-report.json");
}

function loadWatchlist(filePath = WATCHLIST_PATH) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const campaigns = Array.isArray(raw.campaigns) ? raw.campaigns : [];
  return { updated: raw.updated || null, notes: raw.notes || "", campaigns };
}

function loadTrendsJoin(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const cats = [...(report.categories || []), ...(report.weakCategories || [])];
    const hit = cats.find(c => c.key === "points-airdrop") || null;
    return {
      path: filePath,
      generatedAt: report.generatedAt || null,
      packs: report.packs || [],
      points: hit,
    };
  } catch {
    return null;
  }
}

async function main() {
  installCliSafeStdout();
  const watch = loadWatchlist();
  console.log(chalk.cyan.bold("\nAirdrop landscape — research calendar (not a claimer)\n"));
  if (watch.notes) console.log(chalk.gray(watch.notes + "\n"));

  const table = createTable(["Protocol", "Chain", "Season", "Status", "Claim window"], {
    colAligns: ["left", "left", "left", "left", "left"],
  });
  for (const c of watch.campaigns) {
    table.push([
      c.protocol || "—",
      c.chain || "—",
      c.season || "—",
      c.status || "—",
      c.claimWindow || "—",
    ]);
  }
  console.log(table.toString());

  for (const c of watch.campaigns) {
    if (c.notes) console.log(chalk.gray(`  • ${c.protocol}: ${c.notes}`));
  }

  const join = loadTrendsJoin(defaultTrendsPath());
  console.log(chalk.yellow("\nSocial join (points-airdrop)"));
  if (!join) {
    console.log(chalk.gray("No trends-report.json found. Run defi-mev `npm run trends` first."));
  } else if (!join.points) {
    console.log(chalk.gray(`Trends at ${join.generatedAt || "?"} — no points-airdrop hits in this window.`));
  } else {
    console.log(
      chalk.white(
        `  ${join.points.total} hits, momentum=${join.points.momentum}, sentiment=${join.points.sentimentLabel}`
      )
    );
    console.log(chalk.gray(`  source: ${join.path}`));
  }
  console.log("");
}

module.exports = { WATCHLIST_PATH, loadWatchlist, loadTrendsJoin, defaultTrendsPath };

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
