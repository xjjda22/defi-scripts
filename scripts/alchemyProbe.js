#!/usr/bin/env node
/**
 * Probe every Alchemy EVM mainnet and write `<CHAIN>_RPC_URL` into the repo `.env`.
 *
 *   node scripts/alchemyProbe.js --dry            # probe only, print the matrix
 *   node scripts/alchemyProbe.js --write ../../defi-mev/.env .env
 *
 * The key is taken from an existing `*_RPC_URL` that already points at
 * `<network>.g.alchemy.com/v2/<key>`, or from `ALCHEMY_API_KEY`. It is never printed;
 * the matrix reports host + chainId only.
 *
 * A network is written only when `eth_chainId` answers with a plausible id, so a chain the
 * key is not entitled to stays out of `.env` instead of becoming a silent fork failure.
 * Existing non-Alchemy URLs (a public RPC someone chose deliberately) are never replaced.
 */

const fs = require("fs");
const path = require("path");

// Alchemy EVM mainnets, from the Alchemy network list. `varName` is the env var; the
// default is the uppercased id with `-mainnet` stripped, and the exceptions are the
// names the repos already used before this script existed.
const NETWORKS = [
  ["Ethereum", "eth-mainnet", "ETHEREUM"],
  ["Arbitrum", "arb-mainnet", "ARBITRUM"],
  ["Arbitrum Nova", "arbnova-mainnet"],
  ["Base", "base-mainnet", "BASE"],
  ["BNB Chain", "bnb-mainnet", "BSC"],
  ["Avalanche", "avax-mainnet", "AVALANCHE"],
  ["Polygon", "polygon-mainnet", "POLYGON"],
  ["Polygon zkEVM", "polygonzkevm-mainnet"],
  ["Optimism", "opt-mainnet", "OPTIMISM"],
  ["zkSync", "zksync-mainnet", "ZKSYNC"],
  ["Linea", "linea-mainnet"],
  ["Scroll", "scroll-mainnet", "SCROLL"],
  ["Blast", "blast-mainnet"],
  ["Gnosis", "gnosis-mainnet", "GNOSIS"],
  ["Metis", "metis-mainnet"],
  ["Celo", "celo-mainnet"],
  ["Mantle", "mantle-mainnet"],
  ["Mode", "mode-mainnet"],
  ["Moonbeam", "moonbeam-mainnet"],
  ["Astar", "astar-mainnet"],
  ["Ronin", "ronin-mainnet"],
  ["Rootstock", "rootstock-mainnet"],
  ["Frax", "frax-mainnet"],
  ["Sei", "sei-mainnet"],
  ["Sonic", "sonic-mainnet"],
  ["Zora", "zora-mainnet"],
  ["Shape", "shape-mainnet"],
  ["Soneium", "soneium-mainnet"],
  ["Ink", "ink-mainnet"],
  ["Unichain", "unichain-mainnet", "UNICHAIN"],
  ["ApeChain", "apechain-mainnet"],
  ["Lens", "lens-mainnet"],
  ["ZetaChain", "zetachain-mainnet"],
  ["WorldChain", "worldchain-mainnet"],
  ["Hyperliquid", "hyperliquid-mainnet"],
  ["Bob", "bob-mainnet"],
  ["Boba", "boba-mainnet"],
  ["Degen", "degen-mainnet"],
  ["Flow", "flow-mainnet"],
  ["opBNB", "opbnb-mainnet"],
  ["CrossFi", "crossfi-mainnet"],
  ["Mythos", "mythos-mainnet"],
  ["Race", "race-mainnet"],
  ["Polynomial", "polynomial-mainnet"],
  ["Story", "story-mainnet"],
  ["Superseed", "superseed-mainnet"],
  ["Abstract", "abstract-mainnet"],
  ["Anime", "anime-mainnet"],
  ["Berachain", "berachain-mainnet"],
  ["MegaETH", "megaeth-mainnet"],
  ["Monad", "monad-mainnet", "MONAD"],
  ["Humanity", "humanity-mainnet"],
  ["Botanix", "botanix-mainnet"],
  ["Citrea", "citrea-mainnet"],
  ["Edge", "edge-mainnet"],
  ["EarnM", "earnm-mainnet"],
  ["Galactica", "galactica-mainnet"],
  ["Gensyn", "gensyn-mainnet"],
  ["Plasma", "plasma-mainnet"],
  ["Stable", "stable-mainnet"],
  ["Standard", "standard-mainnet"],
  ["Settlus", "settlus-mainnet"],
  ["Unite", "unite-mainnet"],
  ["World Mobile", "worldmobilechain-mainnet"],
  ["XMTP", "xmtp-mainnet"],
  ["xProtocol", "xprotocol-mainnet"],
  ["ADI", "adi-mainnet"],
  ["Alterscope", "alterscope-mainnet"],
  ["Clankermon", "clankermon-mainnet"],
  ["Commons", "commons-mainnet"],
  ["Celestia Bridge", "celestiabridge-mainnet"],
  ["Synd", "synd-mainnet"],
];

// Host aliases: Alchemy has published both spellings for these.
const HOST_ALIASES = {
  "avax-mainnet": ["avax-mainnet", "avalanche-mainnet"],
  "polygonzkevm-mainnet": ["polygonzkevm-mainnet", "polygon-zkevm-mainnet"],
};

// Public fallbacks, used only when the Alchemy app has not enabled that network. Each is
// probed like the Alchemy URL, so a dead endpoint never lands in .env. These are
// best-effort and rate-limited; the Alchemy URL is always preferred when it answers.
const FALLBACKS = {
  "arbnova-mainnet": "https://nova.arbitrum.io/rpc",
  "avax-mainnet": "https://api.avax.network/ext/bc/C/rpc",
  "polygonzkevm-mainnet": "https://zkevm-rpc.com",
  "zksync-mainnet": "https://mainnet.era.zksync.io",
  "linea-mainnet": "https://rpc.linea.build",
  "blast-mainnet": "https://rpc.blast.io",
  "metis-mainnet": "https://andromeda.metis.io/?owner=1088",
  "celo-mainnet": "https://forno.celo.org",
  "mantle-mainnet": "https://rpc.mantle.xyz",
  "mode-mainnet": "https://mainnet.mode.network",
  "moonbeam-mainnet": "https://rpc.api.moonbeam.network",
  "astar-mainnet": "https://rpc.astar.network",
  "ronin-mainnet": "https://api.roninchain.com/rpc",
  "rootstock-mainnet": "https://public-node.rsk.co",
  "frax-mainnet": "https://rpc.frax.com",
  "sei-mainnet": "https://evm-rpc.sei-apis.com",
  "sonic-mainnet": "https://rpc.soniclabs.com",
  "zora-mainnet": "https://rpc.zora.energy",
  "shape-mainnet": "https://mainnet.shape.network",
  "soneium-mainnet": "https://rpc.soneium.org",
  "ink-mainnet": "https://rpc-gel.inkonchain.com",
  "apechain-mainnet": "https://rpc.apechain.com/http",
  "lens-mainnet": "https://rpc.lens.xyz",
  "worldchain-mainnet": "https://worldchain-mainnet.g.alchemy.com/public",
  "hyperliquid-mainnet": "https://rpc.hyperliquid.xyz/evm",
  "bob-mainnet": "https://rpc.gobob.xyz",
  "boba-mainnet": "https://mainnet.boba.network",
  "degen-mainnet": "https://rpc.degen.tips",
  "flow-mainnet": "https://mainnet.evm.nodes.onflow.org",
  "opbnb-mainnet": "https://opbnb-mainnet-rpc.bnbchain.org",
  "abstract-mainnet": "https://api.mainnet.abs.xyz",
  "berachain-mainnet": "https://rpc.berachain.com",
  "plasma-mainnet": "https://rpc.plasma.to",
  "story-mainnet": "https://mainnet.storyrpc.io",
  "superseed-mainnet": "https://mainnet.superseed.xyz",
  "zetachain-mainnet": "https://zetachain-evm.blockpi.network/v1/rpc/public",
  "megaeth-mainnet": "https://mainnet.megaeth.com/rpc",
  "anime-mainnet": "https://rpc.animechain.ai",
};

const MARKER = "# --- Alchemy mainnets (generated by scripts/alchemyProbe.js; re-run, do not hand-edit) ---";

function varName(id, explicit) {
  const base = explicit || id.replace(/-mainnet$/, "").replace(/-/g, "_").toUpperCase();
  return base.endsWith("_RPC_URL") ? base : `${base}_RPC_URL`;
}

function readEnv(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function keyFrom(text) {
  const m = text.match(/ALCHEMY_API_KEY\s*=\s*([A-Za-z0-9_-]{8,})/);
  if (m) return m[1];
  const u = text.match(/alchemy\.com\/v2\/([A-Za-z0-9_-]{8,})/);
  return u ? u[1] : null;
}

async function rpc(url, method, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
      signal: ctrl.signal,
    });
    if (res.status === 429) return { retry: true };
    const json = await res.json();
    if (json.error) return { error: json.error.message || "rpc error" };
    return { result: json.result };
  } catch (e) {
    return { error: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(t);
  }
}

async function probeOne(net, key) {
  const hosts = HOST_ALIASES[net.id] || [net.id];
  let last = null;
  for (const host of hosts) {
    const url = `https://${host}.g.alchemy.com/v2/${key}`;
    let out = await rpc(url, "eth_chainId");
    if (out.retry) {
      await new Promise((r) => setTimeout(r, 1500));
      out = await rpc(url, "eth_chainId");
    }
    if (out.result) {
      const chainId = Number.parseInt(out.result, 16);
      if (Number.isFinite(chainId) && chainId > 0) return { ok: true, url, host, chainId, source: "alchemy" };
    }
    last = out.error || "no result";
  }
  const pub = FALLBACKS[net.id];
  if (pub) {
    const out = await rpc(pub, "eth_chainId");
    if (out.result) {
      const chainId = Number.parseInt(out.result, 16);
      if (Number.isFinite(chainId) && chainId > 0) {
        return { ok: true, url: pub, host: new URL(pub).host, chainId, source: "public" };
      }
    }
    if (last) last = `${last} | public: ${out.error || "no result"}`;
  }
  return { ok: false, error: last };
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

function writeEnv(file, rows, failed, key) {
  const original = readEnv(file);
  const lines = original ? original.split("\n") : [];
  const byVar = new Map(rows.map((r) => [r.varName, r]));
  const seen = new Set();
  let replaced = 0;
  let kept = 0;

  const out = lines.map((line) => {
    const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return line;
    const name = m[1];
    const value = m[2].replace(/^["']|["']$/g, "");
    const row = byVar.get(name);
    if (!row) return line;
    seen.add(name);
    // Alchemy always wins when it answers. A public fallback never overwrites a
    // non-Alchemy endpoint the operator chose deliberately.
    if (row.source !== "alchemy" && value && !/alchemy\.com\/v2\//.test(value)) {
      kept++;
      return line;
    }
    replaced++;
    return `${name}=${row.url}`;
  });

  // Drop a previous generated block, then append a fresh one.
  const filtered = [];
  let skipping = false;
  for (const line of out) {
    if (line.trim() === MARKER) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/^# ---/.test(line) || line.trim() === "") {
        skipping = line.trim() !== "";
        if (!skipping) filtered.push(line);
        continue;
      }
      if (/^[A-Z][A-Z0-9_]*=/.test(line)) continue;
      skipping = false;
    }
    filtered.push(line);
  }

  const missing = rows.filter((r) => !seen.has(r.varName));
  const block = [
    MARKER,
    `ALCHEMY_API_KEY=${key}`,
    ...rows.filter((r) => seen.has(r.varName)).map((r) => `# ${r.varName} kept from your .env (non-Alchemy endpoint)`),
    ...missing.map((r) => `${r.varName}=${r.url}`),
    "",
    "# Alchemy mainnets this key cannot reach yet. Enable them at",
    "# https://dashboard.alchemy.com/apps/qds3behg6koeuejy/networks, then re-run scripts/alchemyProbe.js.",
    ...failed.map((r) => `# ${r.varName}=   # ${r.chain} (${r.id})`),
  ];
  while (filtered.length && filtered[filtered.length - 1].trim() === "") filtered.pop();
  const body = [...filtered, "", ...block, ""].join("\n");
  fs.writeFileSync(file, body);
  return { replaced, kept, added: missing.length };
}

(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const wi = args.indexOf("--write");
  const targets = wi >= 0 ? args.slice(wi + 1).filter((a) => a !== "--dry") : [];

  const seed = readEnv(path.resolve(process.cwd(), ".env")) || readEnv(path.resolve(process.cwd(), "../defi-mev/.env"));
  const key = keyFrom(seed) || process.env.ALCHEMY_API_KEY;
  if (!key) {
    console.error("No Alchemy key found. Set ALCHEMY_API_KEY or keep one existing <chain>.g.alchemy.com URL in .env.");
    process.exit(1);
  }

  console.log(`Probing ${NETWORKS.length} Alchemy EVM mainnets...\n`);
  const results = await pool(NETWORKS, 6, async ([chain, id, explicit]) => {
    const r = await probeOne({ chain, id }, key);
    return { chain, id, varName: varName(id, explicit), ...r };
  });

  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);
  console.log(`ok ${ok.length} / ${results.length}\n`);
  for (const r of ok) console.log(`  ${r.varName.padEnd(22)} ${r.id.padEnd(24)} chainId=${r.chainId}`);
  if (bad.length) {
    console.log(`\nnot entitled or unreachable (${bad.length}):`);
    for (const r of bad) console.log(`  ${r.id.padEnd(24)} ${r.error}`);
  }

  const outDir = path.resolve(process.cwd(), "output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "alchemy-chains.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), ok: ok.map((r) => ({ chain: r.chain, id: r.id, varName: r.varName, chainId: r.chainId, host: r.host, source: r.source })), failed: bad }, null, 2)
  );
  console.log(`\nmatrix: output/alchemy-chains.json`);

  if (dry || !targets.length) return;
  for (const t of targets) {
    const file = path.resolve(process.cwd(), t);
    const res = writeEnv(file, ok, bad, key);
    console.log(`wrote ${t}: replaced ${res.replaced}, kept non-Alchemy ${res.kept}, added ${res.added}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
