/**
 * NFT landscape: Llama marketplace fees + a 10-collection watchlist.
 * Floor quotes are optional (Reservoir). Not a snipe / wash bot.
 *
 *   npm run analytics:nft:markets
 *   RESERVOIR_API_KEY=... npm run analytics:nft:markets
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const chalk = require("chalk");
const { installCliSafeStdout } = require("../utils/cliSafeOutput");
const { fetchFeesSummary } = require("../utils/defiLlamaProtocol");
const { createTable, formatCurrency } = require("../utils/displayHelpers");

const WATCHLIST_PATH = path.join(__dirname, "watchlist.json");

const NFT_MARKETPLACES = [
  ["Blur", "blur"],
  ["OpenSea", "opensea"],
  ["Magic Eden", "magiceden"],
  ["LooksRare", "looksrare"],
  ["Tensor", "tensor"],
];

function loadWatchlist(filePath = WATCHLIST_PATH) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const collections = Array.isArray(raw.collections) ? raw.collections : [];
  return { updated: raw.updated || null, notes: raw.notes || "", collections };
}

async function fetchMarketplaceFees() {
  const rows = [];
  for (const [label, slug] of NFT_MARKETPLACES) {
    try {
      const d = await fetchFeesSummary(slug);
      rows.push({
        label,
        slug,
        name: d.displayName || d.name || label,
        total24h: typeof d.total24h === "number" ? d.total24h : null,
        total7d: typeof d.total7d === "number" ? d.total7d : null,
        total30d: typeof d.total30d === "number" ? d.total30d : null,
        change1d: typeof d.change_1d === "number" ? d.change_1d : null,
        ok: true,
      });
    } catch (e) {
      rows.push({ label, slug, name: label, ok: false, error: e.message || String(e) });
    }
  }
  return rows;
}

async function enrichReservoirFloors(collections) {
  const key = process.env.RESERVOIR_API_KEY;
  if (!key) return { floors: {}, skipped: "no RESERVOIR_API_KEY" };
  const floors = {};
  const headers = { accept: "*/*", "x-api-key": key };
  for (const c of collections) {
    if (!c.contract) continue;
    try {
      const { data } = await axios.get("https://api.reservoir.tools/collections/v7", {
        params: { id: c.contract },
        headers,
        timeout: 20000,
      });
      const col = (data && data.collections && data.collections[0]) || null;
      const floor = col && col.floorAsk && col.floorAsk.price && col.floorAsk.price.amount;
      floors[c.contract.toLowerCase()] = {
        name: col && col.name,
        floorNative: floor && floor.native != null ? Number(floor.native) : null,
        floorUsd: floor && floor.usd != null ? Number(floor.usd) : null,
        volume1d: col && col.volume && col.volume["1day"] != null ? Number(col.volume["1day"]) : null,
      };
    } catch (e) {
      floors[c.contract.toLowerCase()] = { error: e.message || String(e) };
    }
  }
  return { floors, skipped: null };
}

async function main() {
  installCliSafeStdout();
  console.log(chalk.cyan.bold("\nNFT landscape — marketplace fees (DefiLlama) + watchlist\n"));
  console.log(chalk.gray("Llama /overview/nfts is currently 500; using /summary/fees/{marketplace}.\n"));

  const markets = await fetchMarketplaceFees();
  const mt = createTable(["Marketplace", "Slug", "Fees 24h", "Fees 7d", "Fees 30d"], {
    colAligns: ["left", "left", "right", "right", "right"],
  });
  let ok = 0;
  for (const m of markets) {
    if (m.ok) ok++;
    mt.push([
      m.label,
      m.slug,
      m.ok ? (m.total24h != null ? formatCurrency(m.total24h) : "—") : chalk.red("fetch failed"),
      m.ok && m.total7d != null ? formatCurrency(m.total7d) : "—",
      m.ok && m.total30d != null ? formatCurrency(m.total30d) : "—",
    ]);
  }
  console.log(mt.toString());

  const watch = loadWatchlist();
  const { floors, skipped } = await enrichReservoirFloors(watch.collections);
  console.log(chalk.yellow("\nCollection watchlist"));
  if (skipped) console.log(chalk.gray(`Floors skipped (${skipped}). Set RESERVOIR_API_KEY to enrich.\n`));
  const ct = createTable(["Collection", "Chain", "Contract", "Floor"], {
    colAligns: ["left", "left", "left", "right"],
  });
  for (const c of watch.collections) {
    const f = c.contract ? floors[c.contract.toLowerCase()] : null;
    let floor = "—";
    if (f && f.floorNative != null) {
      floor = `${f.floorNative} ETH`;
      if (f.floorUsd != null) floor += ` (${formatCurrency(f.floorUsd)})`;
    } else if (f && f.error) {
      floor = chalk.red("err");
    }
    ct.push([c.name, c.chain || "—", (c.contract || "").slice(0, 10) + "…", floor]);
  }
  console.log(ct.toString());
  console.log(chalk.gray("\nDetect-only NFT MEV stays in defi-mev (nft-arb taxonomy). No snipe bot."));
  if (ok === 0) process.exit(1);
}

module.exports = {
  NFT_MARKETPLACES,
  WATCHLIST_PATH,
  loadWatchlist,
  fetchMarketplaceFees,
};

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red(e.message || e));
    process.exit(1);
  });
}
