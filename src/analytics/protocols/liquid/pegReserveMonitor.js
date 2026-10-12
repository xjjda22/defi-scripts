/**
 * Liquid Network (Blockstream sidechain) L-BTC peg vs federation BTC reserve, from the public
 * liquid.network audit API (the mempool.space Liquid instance):
 *   GET /api/v1/liquid/pegs          net L-BTC pegged in (circulating L-BTC), satoshis
 *   GET /api/v1/liquid/reserves      BTC held by the federation on Bitcoin, satoshis
 *   GET /api/v1/liquid/reserves/status  whether the reserve audit is synced to the Bitcoin tip
 *   GET /api/v1/liquid/pegs/month    net peg flow per month (summed into month-end supply)
 *   GET /api/v1/liquid/reserves/month  month-end reserve
 * Prints supply, reserve, shortfall (BTC and USD via the DefiLlama coins price) and coverage,
 * plus month-end coverage for the last LIQUID_MONTHS months (default 3). For "reserve sits ~603 BTC
 * short / ~86% coverage" claims. Peg-out status itself is not exposed by the API.
 *
 * Env: LIQUID_API (default https://liquid.network/api/v1/liquid), LIQUID_MONTHS, LIQUID_TIMEOUT_MS.
 */

require("dotenv").config();
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../../utils/cliSafeOutput");
const { fetchCoinPrices } = require("../../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../../utils/displayHelpers");

const SATS = 1e8;

function liquidApiBase(env = process.env) {
  return (env.LIQUID_API || "https://liquid.network/api/v1/liquid").replace(/\/+$/, "");
}

function timeoutMs(env = process.env) {
  const n = parseInt(env.LIQUID_TIMEOUT_MS || "", 10);
  return Number.isFinite(n) && n >= 5000 ? n : 30000;
}

async function getJson(path, env = process.env) {
  const { data } = await axios.get(`${liquidApiBase(env)}${path}`, { timeout: timeoutMs(env) });
  return data;
}

function satsToBtc(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n / SATS : null;
}

/** Current supply / reserve snapshot. Throws when either amount is missing. */
async function fetchPegReserve(env = process.env) {
  const [pegs, reserves, status] = await Promise.all([
    getJson("/pegs", env),
    getJson("/reserves", env),
    getJson("/reserves/status", env).catch(() => null),
  ]);
  const supplyBtc = satsToBtc(pegs?.amount);
  const reserveBtc = satsToBtc(reserves?.amount);
  if (supplyBtc == null || reserveBtc == null) throw new Error("liquid.network pegs/reserves response has no amount");
  return {
    supplyBtc,
    reserveBtc,
    gapBtc: supplyBtc - reserveBtc,
    coverage: supplyBtc > 0 ? reserveBtc / supplyBtc : null,
    liquidBlock: pegs?.lastBlockUpdate ?? null,
    bitcoinBlock: reserves?.lastBlockUpdate ?? null,
    auditSynced: status ? Boolean(status.isAuditSynced) : null,
  };
}

/**
 * Month-end coverage. `pegs/month` is net flow per month, so supply is its running sum;
 * `reserves/month` is the month-end balance.
 * @returns {Array<{ month: string, supplyBtc: number, reserveBtc: number, coverage: number|null }>}
 */
function monthlyCoverage(pegFlows, reserveRows) {
  if (!Array.isArray(pegFlows) || !Array.isArray(reserveRows)) return [];
  const supplyByMonth = new Map();
  let running = 0;
  for (const r of [...pegFlows].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    running += Number(r.amount) || 0;
    supplyByMonth.set(String(r.date), running / SATS);
  }
  return reserveRows
    .filter(r => supplyByMonth.has(String(r.date)))
    .map(r => {
      const supplyBtc = supplyByMonth.get(String(r.date));
      const reserveBtc = Number(r.amount) / SATS;
      return { month: String(r.date).slice(0, 7), supplyBtc, reserveBtc, coverage: supplyBtc > 0 ? reserveBtc / supplyBtc : null };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

function fmtBtc(n) {
  return Number.isFinite(n) ? `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BTC` : "—";
}

function fmtPct(r) {
  return Number.isFinite(r) ? `${(r * 100).toFixed(1)}%` : "—";
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nLiquid Network: L-BTC supply vs federation BTC reserve\n"));
  try {
    const snap = await fetchPegReserve();
    let btcUsd = null;
    try {
      const prices = await fetchCoinPrices(["coingecko:bitcoin"]);
      btcUsd = Number(prices["coingecko:bitcoin"]?.price) || null;
    } catch {
      btcUsd = null;
    }
    const t = createTable(["Metric", "Value"], { colAligns: ["left", "right"] });
    t.push(["L-BTC supply (net pegged in)", fmtBtc(snap.supplyBtc)]);
    t.push(["Federation BTC reserve", fmtBtc(snap.reserveBtc)]);
    t.push(["Shortfall (supply - reserve)", fmtBtc(snap.gapBtc)]);
    t.push(["Shortfall in USD", btcUsd ? formatCurrency(snap.gapBtc * btcUsd) : "—"]);
    t.push(["Reserve coverage", fmtPct(snap.coverage)]);
    t.push(["Liquid block / Bitcoin block", `${snap.liquidBlock ?? "—"} / ${snap.bitcoinBlock ?? "—"}`]);
    t.push(["Reserve audit synced", snap.auditSynced == null ? "unknown" : snap.auditSynced ? "yes" : "no"]);
    console.log(t.toString());

    const months = Math.max(1, parseInt(process.env.LIQUID_MONTHS || "3", 10) || 3);
    try {
      const [flows, reserves] = await Promise.all([getJson("/pegs/month"), getJson("/reserves/month")]);
      const rows = monthlyCoverage(flows, reserves).slice(-months);
      if (rows.length) {
        console.log(chalk.yellow("\nMonth-end coverage\n"));
        const m = createTable(["Month", "L-BTC supply", "Reserve", "Coverage"], {
          colAligns: ["left", "right", "right", "right"],
        });
        for (const r of rows) m.push([r.month, fmtBtc(r.supplyBtc), fmtBtc(r.reserveBtc), fmtPct(r.coverage)]);
        console.log(m.toString());
      }
    } catch (e) {
      console.log(chalk.yellow(`Monthly series unavailable: ${e.message || e}`));
    }
    console.log(
      chalk.gray(
        "\nPeg-out (redemption) status is not exposed by the audit API; the 2026-09-06 exploit is on DefiLlama /hacks as \"Liquid Network\"."
      )
    );
  } catch (e) {
    console.error(chalk.red(e.message || String(e)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchPegReserve, monthlyCoverage, liquidApiBase };
