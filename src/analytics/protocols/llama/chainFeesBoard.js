/**
 * Fees and revenue board for chains (or any DefiLlama fees slug), from the free
 * /summary/fees/{slug} endpoint. For "chain X made $Y in fees" claims (e.g. Tron monthly revenue,
 * Algorand 24h fees, ICP monthly fees, Ethereum fees up N% in 30 days).
 *
 *   LLAMA_FEES_SLUGS   comma-separated DefiLlama fees slugs (default: tron), e.g. tron,ethereum,icp
 *   LLAMA_FEES_LABEL   optional banner title
 *   LLAMA_FEES_SMOKE=1 print one OK line per slug and exit non-zero unless every slug has
 *                      positive 30d fees (used by simulate:*:smoke)
 *   LLAMA_FEES_DAYS=N  optional (1-60, off unless set): also print each slug's last N daily fee points, their
 *                      mean and the 30d total annualized (x 365/30), for "fees are $X per day" /
 *                      "about $Y a year" claims
 *
 * Prints 24h / 7d / 30d fees, the previous 30 days and the 30d change, 30d revenue and
 * the all-time totals. Chain "revenue" on DefiLlama is the burned / protocol-kept part of gas.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchFeesChart, trailingWindowTotals } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency, formatPercent } = require("../../utils/displayHelpers");

function slugsFromEnv(env = process.env) {
  const raw = (env.LLAMA_FEES_SLUGS || "tron").trim();
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function money(v) {
  const n = num(v);
  return n == null ? "—" : formatCurrency(n);
}

function daysFromEnv(env = process.env) {
  const n = parseInt(String(env.LLAMA_FEES_DAYS || "").trim(), 10);
  return Number.isFinite(n) && n >= 1 && n <= 60 ? n : 0;
}

function printDaily(r, days) {
  const pts = (Array.isArray(r.chart) ? r.chart : []).filter(
    p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(Number(p[1]))
  );
  if (!pts.length) {
    console.log(chalk.gray(`  ${r.slug}: no daily fee points`));
    return;
  }
  const last = pts.slice(-days);
  const t = createTable(["Date (UTC)", "Fees"], { colAligns: ["left", "right"] });
  for (const p of last) t.push([new Date(p[0] * 1000).toISOString().slice(0, 10), formatCurrency(Number(p[1]))]);
  const mean = last.reduce((a, p) => a + Number(p[1]), 0) / last.length;
  t.push([`Mean of ${last.length} days`, formatCurrency(mean)]);
  t.push(["30d fees annualized (x 365/30)", r.fees30d != null ? formatCurrency((r.fees30d * 365) / 30) : "—"]);
  console.log(chalk.yellow(`\n${r.name}: last ${last.length} daily fee points (/summary/fees/${r.slug})\n`));
  console.log(t.toString());
}

async function loadSlug(slug) {
  const [fees, revenue] = await Promise.all([
    fetchFeesChart(slug).catch(e => ({ error: e })),
    fetchFeesChart(slug, "dailyRevenue").catch(e => ({ error: e })),
  ]);
  const w = fees && !fees.error ? trailingWindowTotals(fees.totalDataChart, 30) : null;
  const change = w && w.prior != null && w.prior > 0 ? ((w.last - w.prior) / w.prior) * 100 : null;
  return {
    slug,
    name: (fees && !fees.error && (fees.displayName || fees.name)) || slug,
    error: fees && fees.error ? fees.error : null,
    fees24h: fees && !fees.error ? num(fees.total24h) : null,
    fees7d: fees && !fees.error ? num(fees.total7d) : null,
    fees30d: fees && !fees.error ? num(fees.total30d) : null,
    feesPrior30d: w ? w.prior : null,
    change30d: change,
    rev30d: revenue && !revenue.error ? num(revenue.total30d) : null,
    feesAllTime: fees && !fees.error ? num(fees.totalAllTime) : null,
    revAllTime: revenue && !revenue.error ? num(revenue.totalAllTime) : null,
    chart: fees && !fees.error ? fees.totalDataChart : null,
  };
}

async function main() {
  installCliSafeStdout();
  const slugs = slugsFromEnv();
  const smoke = process.env.LLAMA_FEES_SMOKE === "1";
  const rows = await Promise.all(slugs.map(loadSlug));

  if (smoke) {
    let bad = false;
    for (const r of rows) {
      if (r.fees30d != null && r.fees30d > 0) {
        console.log(chalk.green(`OK: ${r.name} | 30d fees ${money(r.fees30d)} | 30d revenue ${money(r.rev30d)}`));
      } else {
        bad = true;
        console.error(chalk.red(`${r.slug}: no positive 30d fees${r.error ? ` (${r.error.message || r.error})` : ""}`));
      }
    }
    process.exit(bad ? 1 : 0);
  }

  const label = (process.env.LLAMA_FEES_LABEL || "Chain fees / revenue").trim();
  console.log(chalk.cyan.bold(`\n${label} (DefiLlama /summary/fees)\n`));
  const t = createTable(
    ["Slug", "Fees 24h", "Fees 7d", "Fees 30d", "Prior 30d", "30d change", "Revenue 30d", "Fees all-time"],
    { colAligns: ["left", "right", "right", "right", "right", "right", "right", "right"] }
  );
  for (const r of rows) {
    t.push([
      r.slug,
      money(r.fees24h),
      money(r.fees7d),
      money(r.fees30d),
      money(r.feesPrior30d),
      r.change30d == null ? "—" : formatPercent(r.change30d),
      money(r.rev30d),
      money(r.feesAllTime),
    ]);
  }
  console.log(t.toString());
  for (const r of rows) {
    if (r.error) console.log(chalk.gray(`  ${r.slug}: ${r.error.message || r.error}`));
  }
  console.log(chalk.gray("\n30d windows are the last 30 daily points; prior 30d is the 30 points before that.\n"));
  const days = daysFromEnv();
  if (days) for (const r of rows) printDaily(r, days);
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  });
}

module.exports = { slugsFromEnv, daysFromEnv };
