/**
 * Exploit amount from the free DefiLlama hacks list (`/hacks`), for "protocol X lost $Y" claims.
 * Match by DefiLlama protocol id (LLAMA_HACK_ID, e.g. 6225 for NEAR Intents) or by incident
 * name (LLAMA_HACK_NAME, case-insensitive exact match). LLAMA_HACK_SINCE (YYYY-MM-DD, UTC)
 * drops older incidents. Prints every match: date, amount, chains, classification, technique,
 * returned funds. Does not read TVL; pair with the protocol's DefiLlama slug monitor for that.
 */

require("dotenv").config();
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchLlamaHacks } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

function hackFilterFromEnv(env = process.env) {
  const id = (env.LLAMA_HACK_ID || "").trim();
  const name = (env.LLAMA_HACK_NAME || "").trim();
  const sinceRaw = (env.LLAMA_HACK_SINCE || "").trim();
  let since = null;
  if (sinceRaw) {
    const ms = Date.parse(`${sinceRaw}T00:00:00Z`);
    if (!Number.isFinite(ms)) throw new Error(`LLAMA_HACK_SINCE is not YYYY-MM-DD: ${sinceRaw}`);
    since = ms / 1000;
  }
  if (!id && !name) throw new Error("Set LLAMA_HACK_ID (DefiLlama protocol id) or LLAMA_HACK_NAME");
  return { id, name, since };
}

/**
 * @param {Array<object>} hacks
 * @param {{ id: string, name: string, since: number|null }} f
 */
function matchHacks(hacks, f) {
  if (!Array.isArray(hacks)) return [];
  return hacks
    .filter(h => {
      if (!h || typeof h !== "object") return false;
      if (f.id && String(h.defillamaId ?? "") !== f.id) return false;
      if (f.name && String(h.name || "").toLowerCase() !== f.name.toLowerCase()) return false;
      if (f.since != null && !(Number(h.date) >= f.since)) return false;
      return true;
    })
    .sort((a, b) => Number(a.date) - Number(b.date));
}

async function main() {
  installCliSafeStdout();
  let f;
  try {
    f = hackFilterFromEnv();
  } catch (e) {
    console.error(chalk.red(e.message));
    process.exit(1);
  }
  const label = f.id ? `DefiLlama id ${f.id}` : f.name;
  console.log(chalk.cyan.bold(`\nExploits on DefiLlama /hacks: ${label}\n`));
  try {
    const rows = matchHacks(await fetchLlamaHacks(), f);
    if (!rows.length) {
      console.log(chalk.yellow("No matching incidents."));
      return;
    }
    const t = createTable(["Date (UTC)", "Name", "Amount", "Chains", "Classification", "Technique", "Returned"], {
      colAligns: ["left", "left", "right", "left", "left", "left", "right"],
    });
    for (const h of rows) {
      const amt = Number(h.amount);
      const ret = Number(h.returnedFunds);
      t.push([
        new Date(Number(h.date) * 1000).toISOString().slice(0, 10),
        h.name || "—",
        Number.isFinite(amt) ? formatCurrency(amt) : "—",
        Array.isArray(h.chain) ? h.chain.join(", ") : "—",
        h.classification || "—",
        h.technique || "—",
        h.returnedFunds == null ? "not recorded" : Number.isFinite(ret) ? formatCurrency(ret) : String(h.returnedFunds),
      ]);
    }
    console.log(t.toString());
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { hackFilterFromEnv, matchHacks };
