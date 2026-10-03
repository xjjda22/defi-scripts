/**
 * Browse npm scripts by protocol.
 *
 *   npm run catalog                  # every protocol, grouped by category, with coverage
 *   npm run catalog -- aave          # one protocol card (id, name, or partial match)
 *   npm run catalog -- lending       # every protocol in a category
 *   npm run catalog:docs             # regenerate docs/02-protocol-catalog.md + README index
 *   npm run catalog:check            # fail on unregistered scripts, empty entries, or stale docs
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { createTable } = require("../src/analytics/utils/displayHelpers");
const { KINDS, buildCatalog, findEntries } = require("../src/catalog/catalog");
const { DOC_PATH, renderDoc, replaceReadmeSection } = require("../src/catalog/markdown");

const ROOT = path.resolve(__dirname, "..");
const README_PATH = path.join(ROOT, "README.md");
const KIND_COLORS = {
  Analytics: chalk.cyan,
  Smoke: chalk.green,
  Simulate: chalk.magenta,
  Swap: chalk.yellow,
  "Cross-chain": chalk.blue,
};

const tick = n => (n ? chalk.green(n > 1 ? `✓${n}` : "✓") : chalk.gray("·"));
const plain = md => md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`/g, "");

function printOverview(catalog, entries, title) {
  console.log(chalk.cyan.bold(`\n${title}`));
  for (const group of [...catalog.categories, ...catalog.boardGroups]) {
    const rows = entries.filter(e => (e.category || e.group) === group.id);
    if (!rows.length) continue;
    const t = createTable(["Protocol", "id", ...KINDS], {
      colWidths: [26, 14, ...KINDS.map(k => k.length + 2)],
      colAligns: ["left", "left", ...KINDS.map(() => "center")],
      chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
    });
    for (const e of rows) t.push([e.name, chalk.gray(e.id), ...KINDS.map(k => tick(e.kinds[k]))]);
    console.log(chalk.yellow.bold(`\n${group.label} (${rows.length})`));
    console.log(t.toString());
  }
  console.log(chalk.gray(`\nDetails: npm run catalog -- <id>   ·   Full catalog: ${DOC_PATH}\n`));
}

function printCard(entry) {
  console.log("\n" + chalk.cyan("═".repeat(72)));
  console.log(chalk.cyan.bold(`  ${entry.name}`) + chalk.gray(`  (${entry.id})`));
  const meta = [entry.url, entry.data !== "—" ? `Data: ${entry.data}` : null].filter(Boolean).join("  ·  ");
  if (meta) console.log(chalk.gray(`  ${meta}`));
  console.log(chalk.cyan("═".repeat(72)));
  console.log(`\n${plain(entry.about)}`);
  for (const n of entry.notes || []) console.log(chalk.gray(`  › ${plain(n)}`));
  const t = createTable(["Kind", "Command", "What it does"], { colWidths: [13, 42, 60], wordWrap: true });
  for (const s of entry.scripts) t.push([KIND_COLORS[s.kind](s.kind), `npm run ${s.name}`, plain(s.description || "")]);
  console.log("\n" + t.toString() + "\n");
}

function writeDocs(catalog) {
  fs.writeFileSync(path.join(ROOT, DOC_PATH), renderDoc(catalog));
  fs.writeFileSync(README_PATH, replaceReadmeSection(fs.readFileSync(README_PATH, "utf8"), catalog));
  console.log(chalk.green(`Wrote ${DOC_PATH} and the README catalog index.`));
}

function check(catalog) {
  const problems = [...catalog.problems];
  const docPath = path.join(ROOT, DOC_PATH);
  if (!fs.existsSync(docPath) || fs.readFileSync(docPath, "utf8") !== renderDoc(catalog)) {
    problems.push(`${DOC_PATH} is stale (run npm run catalog:docs)`);
  }
  const readme = fs.readFileSync(README_PATH, "utf8");
  try {
    if (replaceReadmeSection(readme, catalog) !== readme)
      problems.push("README catalog index is stale (run npm run catalog:docs)");
  } catch (e) {
    problems.push(e.message);
  }
  if (problems.length) {
    console.error(chalk.red(`Catalog check failed (${problems.length}):`));
    for (const p of problems) console.error(chalk.red(`  - ${p}`));
    process.exit(1);
  }
  console.log(chalk.green("Catalog OK: every script is registered, described, and the docs are current."));
}

function main() {
  const args = process.argv.slice(2);
  const catalog = buildCatalog();

  if (args.includes("--check")) return check(catalog);
  if (args.includes("--docs")) return writeDocs(catalog);

  const query = args.join(" ").trim();
  if (!query) {
    const n = catalog.protocols.length;
    return printOverview(catalog, [...catalog.protocols, ...catalog.boards], `defi-scripts: ${n} protocols`);
  }

  const { kind, entries } = findEntries(catalog, query);
  if (!entries.length) {
    console.error(chalk.red(`No protocol matches "${query}". Run npm run catalog to list them.`));
    process.exit(1);
  }
  if (kind === "group") return printOverview(catalog, entries, `Category: ${query}`);
  if (entries.length > 3) return printOverview(catalog, entries, `Matches for "${query}"`);
  entries.forEach(printCard);
}

main();
