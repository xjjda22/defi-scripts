/**
 * Swell swETH / rswETH exchange-rate check after the 2026-10-21 oracle-bot key compromise.
 *
 * Reads on Ethereum: swETH `swETHToETHRate()`, rswETH `rswETHToETHRate()` and both `totalSupply()`,
 * compares each rate with the pre-incident rate published in the incident report, and prints the
 * DefiLlama `/hacks` entry (name `Swell`, since 2026-10-21; DefiLlama records no amount).
 * The report: the attacker controlled the hot keys from 14:25 UTC on 2026-10-21 and raised both rates
 * by up to 1% per hour with no new ETH behind them (swETH from 1.133254, rswETH from 1.082464).
 *
 * Env:
 *   ETHEREUM_RPC_URL  (required) Ethereum RPC
 *   SWELL_RATE_SMOKE=1 (optional) one-line OK per token, non-zero exit when a read fails or a rate is not > 1
 */

require("dotenv").config();
const { ethers } = require("ethers");
const chalk = require("chalk");
const { getProvider } = require("../../../utils/web3");
const { SWELL } = require("../../../catalog/contracts");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { createTable } = require("../../utils/displayHelpers");
const { fetchLlamaHacks } = require("../../utils/defiLlamaProtocol");
const { hackFilterFromEnv, matchHacks } = require("../llama/llamaHacksMonitor");

// Pre-incident rates from the researcher report (Crypto Briefing, 2026-10-22).
const TOKENS = [
  { key: "swETH", address: SWELL.swETH, rateFn: "swETHToETHRate", baseline: 1.133254 },
  { key: "rswETH", address: SWELL.rswETH, rateFn: "rswETHToETHRate", baseline: 1.082464 },
];

async function readRates(provider = getProvider("ethereum")) {
  const block = await provider.getBlockNumber();
  return Promise.all(
    TOKENS.map(async t => {
      const c = new ethers.Contract(
        t.address,
        [`function ${t.rateFn}() view returns (uint256)`, "function totalSupply() view returns (uint256)"],
        provider
      );
      const [rate, supply] = await Promise.all([c[t.rateFn]({ blockTag: block }), c.totalSupply({ blockTag: block })]);
      const r = Number(ethers.formatUnits(rate, 18));
      return {
        ...t,
        block,
        rate: r,
        supply: Number(ethers.formatUnits(supply, 18)),
        vsBaselinePct: ((r - t.baseline) / t.baseline) * 100,
      };
    })
  );
}

async function main() {
  installCliSafeStdout();
  const smoke = process.env.SWELL_RATE_SMOKE === "1";
  const rows = await readRates();

  if (smoke) {
    let bad = false;
    for (const r of rows) {
      const ok = Number.isFinite(r.rate) && r.rate > 1;
      if (!ok) bad = true;
      console.log(
        `${ok ? chalk.green("OK") : chalk.red("FAIL")}: ${r.key} rate ${r.rate.toFixed(6)} ETH (${r.vsBaselinePct >= 0 ? "+" : ""}${r.vsBaselinePct.toFixed(2)}% vs ${r.baseline}) @ block ${r.block}`
      );
    }
    if (bad) process.exit(1);
    return;
  }

  console.log(chalk.cyan.bold("\nSwell swETH / rswETH rates (on-chain, Ethereum)\n"));
  const t = createTable(["Token", "Rate (ETH)", "Pre-incident", "Change", "Supply", "ETH-equivalent"], {
    colAligns: ["left", "right", "right", "right", "right", "right"],
  });
  for (const r of rows) {
    t.push([
      `${r.key} (${r.address})`,
      r.rate.toFixed(6),
      r.baseline.toFixed(6),
      `${r.vsBaselinePct >= 0 ? "+" : ""}${r.vsBaselinePct.toFixed(2)}%`,
      r.supply.toFixed(2),
      (r.supply * r.rate).toFixed(2),
    ]);
  }
  console.log(t.toString());
  console.log(
    chalk.gray(`  block ${rows[0].block}. A rate rising faster than staking yield (~3%/yr) means unbacked markups.`)
  );

  try {
    const filter = hackFilterFromEnv({ LLAMA_HACK_NAME: "Swell", LLAMA_HACK_SINCE: "2026-10-21" });
    const hits = matchHacks(await fetchLlamaHacks(), filter);
    const ht = createTable(["Date", "Amount", "Classification", "Chains"], {
      colAligns: ["left", "right", "left", "left"],
    });
    for (const h of hits) {
      const amt = Number(h.amount);
      ht.push([
        new Date(h.date * 1000).toISOString().slice(0, 10),
        Number.isFinite(amt) && amt > 0 ? `$${amt.toLocaleString("en-US")}` : "not recorded",
        `${h.classification || "—"} / ${h.technique || "—"}`,
        (h.chain || []).join(", "),
      ]);
    }
    console.log(chalk.yellow("\nDefiLlama /hacks (Swell, since 2026-10-21)\n"));
    console.log(hits.length ? ht.toString() : chalk.gray("  no matching incident"));
  } catch (e) {
    console.log(chalk.gray(`  /hacks unavailable: ${e.message || e}`));
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}

module.exports = { readRates, TOKENS };
