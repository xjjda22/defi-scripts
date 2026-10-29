/* eslint-env browser */
const REPO_BLOB = "https://github.com/xjjda22/defi-scripts/blob/main/";
const MONITOR = "covered by a dedicated monitor";
const TEXT_KEYS = new Set(["name", "category", "coverage"]);
// Fallbacks for data.json built before source metadata carried its own url.
// Source branding and fallbacks for data.json built before the metadata carried
// its own url/name. Only the brand name is linked, so both credits look alike.
const SOURCE_META = {
  coingecko: { name: "CoinGecko", url: "https://www.coingecko.com" },
  nansen: { name: "Nansen API", url: "https://www.nansen.ai" },
};

const PROTOCOL_PAGE = document.body.dataset.page === "protocol";
const SCRIPT_GROUPS = [
  ["analytics", "Analytics"],
  ["smoke", "API smoke"],
  ["fork", "Fork test"],
  ["quote", "Quote"],
  ["swap", "Swap"],
];

const state = {
  data: null,
  tab: "overall",
  query: "",
  sortKey: "rank",
  sortDir: 1,
  protocol: "",
};

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]
  );
}

function isNum(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function money(value) {
  if (!isNum(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function signedPct(value, digits = 1) {
  if (!isNum(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function changeCell(row) {
  if (row.isNew) {
    const age = isNum(row.ageDays) ? ` · ${row.ageDays}d` : "";
    return `<span class="badge new" title="No TVL 180 days ago. Judged on TVL gathered since launch.">New${age}</span>`;
  }
  const pct = row.tvlChange6m;
  if (!isNum(pct)) return '<span class="chg">—</span>';
  const dir = pct >= 0 ? "up" : "down";
  const width = Math.max(6, Math.min(100, (Math.min(Math.abs(pct), 200) / 200) * 100));
  const title = isNum(row.tvl6mAgo) ? ` title="${esc(`180 days ago: ${money(row.tvl6mAgo)}`)}"` : "";
  return `<span class="bar ${dir}"${title} aria-hidden="true"><i style="width:${width}%"></i></span><span class="chg ${dir}">${signedPct(pct)}</span>`;
}

function addedCell(value) {
  if (!isNum(value)) return '<span class="chg">—</span>';
  const dir = value >= 0 ? "up" : "down";
  return `<span class="chg ${dir}">${value > 0 ? "+" : ""}${money(value)}</span>`;
}

function coverageBadge(row) {
  if (row.coverage === MONITOR) return '<span class="badge monitor">Has monitor</span>';
  return '<span class="badge">Ranking only</span>';
}

function signalsCell(row) {
  const signals = row.signals;
  if (!signals) return '<span class="chg">—</span>';
  const parts = [];
  if (isNum(signals.attention)) {
    const title = `CoinGecko turnover percentile: ${Math.round(signals.attention * 100)}`;
    parts.push(`<span class="sig" title="${esc(title)}">A ${Math.round(signals.attention * 100)}</span>`);
  }
  if (isNum(signals.smartMoney)) {
    const title = `Nansen smart-money percentile: ${Math.round(signals.smartMoney * 100)}`;
    parts.push(`<span class="sig smart" title="${esc(title)}">S ${Math.round(signals.smartMoney * 100)}</span>`);
  }
  return parts.length ? parts.join("") : '<span class="chg">—</span>';
}

function mentionBadge(row) {
  const n = row.xMentions || 0;
  if (!n) return '<span class="chg">0</span>';
  const lists = (row.xLists || []).join(", ");
  return `<span class="badge mentions" title="${esc(`${n} distinct posts${lists ? ` on ${lists}` : ""}`)}">${n}</span>`;
}

function scriptKind(name) {
  const script = String(name || "");
  if (script.startsWith("fork:")) return "fork";
  if (script.startsWith("swap:")) return "swap";
  if (script.startsWith("analytics:") || script.startsWith("crosschain:")) return "analytics";
  if (script.includes(":smoke")) return "smoke";
  if (/^simulate:(uniswapx:fill|aave:(v3:fork|liquidations|versions)|morpho:fork|lido:fork)/.test(script)) return "fork";
  if (script.startsWith("simulate:")) return "quote";
  return "other";
}

function scriptName(script) {
  return typeof script === "string" ? script : script.name;
}

function findProtocol(slug) {
  const needle = String(slug || "").toLowerCase();
  if (!needle || !state.data) return null;
  const pools = [state.data.overall || []].concat(Object.values(state.data.byCategory || {}));
  for (const rows of pools) {
    const found = rows.find(row => String(row.slug || "").toLowerCase() === needle || String(row.id || "").toLowerCase() === needle);
    if (found) return found;
  }
  return null;
}

function copyButton(text) {
  return `<button type="button" class="copy" data-copy="${esc(text)}">Copy</button>`;
}

function commandRow(text) {
  return `<div class="cmd"><code>${esc(text)}</code>${copyButton(text)}</div>`;
}

function scriptGroups(scripts) {
  const items = (scripts || []).map(script => ({
    name: scriptName(script),
    file: typeof script === "string" ? null : script.file,
    kind: (typeof script === "string" ? null : script.kind) || scriptKind(scriptName(script)),
  }));
  const blocks = SCRIPT_GROUPS.map(([kind, label]) => {
    const rows = items.filter(item => item.kind === kind);
    if (!rows.length) return "";
    const body = rows
      .map(item => {
        const command = `npm run ${item.name}`;
        const link = item.file
          ? `<a href="${esc(REPO_BLOB + item.file)}" target="_blank" rel="noreferrer" title="${esc(item.file)}">${esc(item.file)}</a>`
          : "";
        return `<div class="script-row"><code>${esc(command)}</code>${copyButton(command)}${link}</div>`;
      })
      .join("");
    return `<div class="kind-block"><h4>${esc(label)}</h4>${body}</div>`;
  }).filter(Boolean);
  return blocks.length ? blocks.join("") : "<p>No npm scripts for this row.</p>";
}

function chainTvlHtml(row) {
  const chains = row.chainTvls || [];
  if (!chains.length) return "<p>Per-chain TVL is not in this snapshot.</p>";
  return `<ul class="chain-list">${chains
    .map(item => `<li>${esc(item.chain)} <b>${esc(money(item.tvl))}</b></li>`)
    .join("")}</ul>`;
}

function faucetsHtml(chainKey) {
  const testnets = (state.data.methodology && state.data.methodology.testnets) || [];
  const chainlink = state.data.methodology && state.data.methodology.chainlinkFaucet;
  const rows = testnets.filter(item => item.chain === chainKey);
  const shown = rows.length ? rows : testnets.filter(item => item.chain === "ethereum");
  const lists = shown
    .map(item => {
      const links = (item.faucets || [])
        .map(faucet => `<a href="${esc(faucet.url)}" target="_blank" rel="noreferrer">${esc(faucet.name)}</a>`)
        .join(" · ");
      return `<li><b>${esc(item.name)}</b> — ${links}</li>`;
    })
    .join("");
  const extra = chainlink
    ? `<li><a href="${esc(chainlink.url)}" target="_blank" rel="noreferrer">${esc(chainlink.name)}</a> covers several of these networks.</li>`
    : "";
  return `<ul class="chain-list">${lists}${extra}</ul>`;
}

function contractsHtml(contracts) {
  if (!contracts || !contracts.length) return "<p>No contract addresses are configured for this protocol in the repo.</p>";
  return `<ul class="chain-list">${contracts
    .map(
      item =>
        `<li>${esc(item.chain)} ${esc(item.label)} <code>${esc(item.address)}</code>${
          item.explorerUrl ? ` <a href="${esc(item.explorerUrl)}" target="_blank" rel="noreferrer">explorer</a>` : ""
        }${item.doc ? ` <a href="${esc(item.doc)}" target="_blank" rel="noreferrer">docs</a>` : ""}</li>`
    )
    .join("")}</ul>`;
}

/** Escape first, then allow the small amount of inline markdown the registry uses. */
function inline(value) {
  return esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

/**
 * What each fork test on this protocol does, what makes it PASS, and the dials
 * a player can set. Fed from src/catalog/forkFeatures.js via data.json.
 */
function featuresHtml(features) {
  if (!features || !features.length) return "";
  return `<ol class="features">${features
    .map(feature => {
      const badges = [
        feature.readOnly ? `<span class="badge api">read-only</span>` : "",
        feature.gated ? `<span class="badge">can skip</span>` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const params = (feature.params || []).length
        ? `<div class="params"><span>Set</span>${feature.params
            .map(
              param =>
                `<code>${esc(param.env)}</code>${param.label ? ` ${esc(param.label)}` : ""}${
                  param.default ? ` <b>${esc(param.default)}</b>` : ""
                }${param.unit ? ` ${esc(param.unit)}` : ""}`
            )
            .join("")}</div>`
        : "";
      return `<li class="feature">
        <div class="feature-head"><b>${esc(feature.title || feature.script)}</b> ${badges}</div>
        <p class="what">${inline(feature.action || "")}</p>
        <p class="assert"><span class="pass">PASS when</span> ${inline(feature.assertion || "")}</p>
        ${params}
        ${commandRow(`npm run ${feature.script}`)}
      </li>`;
    })
    .join("")}</ol>`;
}

function detailHtml(row) {
  const testing = row.testing || { mode: "api-only", note: "No fork test for this protocol.", recipe: null };
  const fork = testing.mode === "fork";
  const mode = fork
    ? `<span class="badge fork">${esc(testing.label || "Fork test")}</span>`
    : `<span class="badge api">${esc(testing.label || "API-only")}</span>`;
  const back = PROTOCOL_PAGE
    ? `<a class="back" href="index.html">← Back to the board</a>`
    : `<a class="back" href="#${state.tab === "overall" ? "" : `tab=${encodeURIComponent(state.tab)}`}">← Back to the board</a>`;
  const app = testing.appUrl || row.appUrl;
  // The feature cards above already list every fork test, so keep them out of the
  // generic script list to avoid printing the same command twice.
  const listed =
    fork && testing.features && testing.features.length
      ? row.scripts.filter(script => scriptKind(scriptName(script)) !== "fork")
      : row.scripts;
  const links = [
    app ? `<a href="${esc(app)}" target="_blank" rel="noreferrer">Official app</a>` : "",
    row.llamaUrl ? `<a href="${esc(row.llamaUrl)}" target="_blank" rel="noreferrer">DefiLlama</a>` : "",
  ]
    .filter(Boolean)
    .join("");
  const commands = fork
    ? `<h3>Fork commands</h3>
       <p>RPC env var: <code>${esc(testing.rpcEnv || "")}</code> on ${esc(testing.chain || "")}. Start Anvil, then point that variable at the local fork. <code>FORK_BLOCK</code> pins the block.</p>
       ${(testing.commands || []).map(commandRow).join("")}
       ${testing.note ? `<p>${esc(testing.note)}</p>` : ""}`
    : `<h3>API-only</h3>
       <p>${esc(testing.note || "No fork test for this protocol.")}</p>
       ${
         testing.recipe
           ? `<p><b>${esc(testing.recipe.title)}</b>. ${esc(testing.recipe.note || "")}</p>${(testing.recipe.commands || []).map(commandRow).join("")}`
           : ""
       }`;
  return `<article class="detail-card">
    ${back}
    <p class="kicker">${esc(labelFor(row.category))} · ${esc(row.slug || "")}</p>
    <h2>${esc(row.name)} ${mode}</h2>
    <div class="links">${links}</div>
    <div class="facts">
      <div class="fact"><b>${esc(money(row.tvl))}</b><span>TVL</span></div>
      <div class="fact"><b>${row.isNew ? "New" : esc(signedPct(row.tvlChange6m))}</b><span>6-month TVL</span></div>
      <div class="fact"><b>${esc(money(row.fees30d))}</b><span>30d fees</span></div>
      <div class="fact"><b>${esc(money(row.tvlAdded6m))}</b><span>6-month added</span></div>
      ${row.signals && isNum(row.signals.attention) ? `<div class="fact"><b>${Math.round(row.signals.attention * 100)}</b><span>Attention pct</span></div>` : ""}
      ${row.signals && isNum(row.signals.smartMoney) ? `<div class="fact"><b>${Math.round(row.signals.smartMoney * 100)}</b><span>Smart money pct</span></div>` : ""}
    </div>
    ${row.token ? `<p class="muted">${esc(row.token.symbol || "")} · market cap ${money(row.token.marketCap)} · 24h volume ${money(row.token.volume24h)}${isNum(row.token.turnover) ? ` · turnover ${(row.token.turnover * 100).toFixed(2)}%` : ""}</p>` : ""}
    <h3>TVL by chain</h3>
    ${chainTvlHtml(row)}
    <h3>Test it</h3>
    ${
      fork
        ? featuresHtml(testing.features)
        : `<p class="muted">No fork test is configured for this protocol, so there is nothing to run against a local fork here. The API recipes below are the closest check the repo has.</p>`
    }
    ${scriptGroups(listed)}
    ${commands}
    <h3>Contracts</h3>
    ${contractsHtml(testing.contracts)}
    <h3>Testnets &amp; faucets</h3>
    ${faucetsHtml(testing.chain || "ethereum")}
  </article>`;
}

function renderDetail() {
  const host = $("detail");
  if (!host) return;
  const row = findProtocol(state.protocol);
  const table = $("table-wrap");
  if (!state.protocol) {
    host.hidden = true;
    host.innerHTML = "";
    if (table) table.hidden = false;
    const status = $("status");
    if (status) status.hidden = false;
    return;
  }
  host.hidden = false;
  if (table) table.hidden = true;
  const status = $("status");
  if (status) status.hidden = true;
  if (!row) {
    host.innerHTML = `<article class="detail-card"><a class="back" href="index.html">← Back to the board</a><h2>Protocol not found</h2><p>No row matches <code>${esc(state.protocol)}</code>.</p></article>`;
    return;
  }
  document.title = `${row.name} · Trending DeFi`;
  host.innerHTML = detailHtml(row);
}

function scriptsCell(scripts) {
  if (!scripts || !scripts.length) return "—";
  const link = script => {
    const name = typeof script === "string" ? script : script.name;
    const file = typeof script === "string" ? null : script.file;
    if (!file) return `<code>${esc(name)}</code>`;
    return `<a href="${esc(REPO_BLOB + file)}" target="_blank" rel="noreferrer" title="${esc(file)}"><code>${esc(name)}</code></a>`;
  };
  const shown = scripts.slice(0, 3).map(link).join("");
  if (scripts.length <= 3) return shown;
  const rest = scripts.slice(3).map(link).join("");
  return `${shown}<details class="more"><summary>+${scripts.length - 3} more</summary>${rest}</details>`;
}

function breakdown(row) {
  const parts = [];
  const c = row.components;
  if (c) {
    const pct = value => (isNum(value) ? `${Math.round(value * 100)}` : "—");
    const signalBits = [
      isNum(c.attention) ? `attention ${pct(c.attention)}` : "",
      isNum(c.smartMoney) ? `smart money ${pct(c.smartMoney)}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(
      `<p>Score ${isNum(row.score) ? row.score.toFixed(3) : "—"}. Percentiles: size ${pct(c.size)}, growth ${pct(c.growth)}, TVL added ${pct(c.tvlAdded)}, fees momentum ${pct(c.feesMomentum)}, volume momentum ${pct(c.volumeMomentum)}${signalBits ? `, ${signalBits}` : ""}. X bonus +${isNum(c.mentions) ? c.mentions.toFixed(3) : "0"}.</p>`
    );
  }
  const facts = [];
  if (isNum(row.feesChange30d)) facts.push(`30d fees ${signedPct(row.feesChange30d)} vs prior 30d`);
  if (isNum(row.volume30d)) facts.push(`30d volume ${money(row.volume30d)}${isNum(row.volumeChange30d) ? ` (${signedPct(row.volumeChange30d)})` : ""}`);
  if (row.llamaCategories && row.llamaCategories.length) facts.push(`DefiLlama: ${row.llamaCategories.join(", ")}`);
  if (facts.length) parts.push(`<p>${esc(facts.join(" · "))}</p>`);
  if (row.signals) {
    const signalFacts = [];
    if (isNum(row.signals.attention)) signalFacts.push(`attention ${Math.round(row.signals.attention * 100)}`);
    if (isNum(row.signals.smartMoney)) signalFacts.push(`smart money ${Math.round(row.signals.smartMoney * 100)}`);
    if (signalFacts.length) parts.push(`<p>Signal percentiles: ${esc(signalFacts.join(", "))}.</p>`);
  }
  if (row.token) {
    const turnover = isNum(row.token.turnover) ? ` · turnover ${(row.token.turnover * 100).toFixed(2)}%` : "";
    parts.push(
      `<p>${esc(row.token.symbol || "")} · market cap ${money(row.token.marketCap)} · 24h volume ${money(row.token.volume24h)}${turnover}</p>`
    );
  }
  if (row.members && row.members.length) {
    parts.push(
      `<p>Combines ${row.members.map(m => `<a href="https://defillama.com/protocol/${encodeURIComponent(m.slug)}" target="_blank" rel="noreferrer">${esc(m.name)}</a> ${money(m.tvl)}`).join(", ")}</p>`
    );
  }
  if (!parts.length) return "";
  return `<details class="why"><summary>Details</summary>${parts.join("")}</details>`;
}

function categoryById(id) {
  return (state.data.categories || []).find(cat => cat.id === id) || null;
}

function labelFor(id) {
  const found = categoryById(id);
  return found ? found.label : id;
}

function rowsForTab() {
  if (state.tab === "overall") return state.data.overall || [];
  return (state.data.byCategory && state.data.byCategory[state.tab]) || [];
}

function sortValue(row, key) {
  if (key === "tvlChange6m" && row.isNew) return null;
  return row[key];
}

function compare(a, b, key) {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const aMissing = av == null || av === "";
  const bMissing = bv == null || bv === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * state.sortDir;
  return String(av).localeCompare(String(bv)) * state.sortDir;
}

function visibleRows() {
  const q = state.query.trim().toLowerCase();
  let rows = rowsForTab();
  if (q) {
    rows = rows.filter(row =>
      [row.name, row.slug, labelFor(row.category), ...(row.members || []).map(m => m.name)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  return rows.slice().sort((a, b) => compare(a, b, state.sortKey) || (a.rank || 0) - (b.rank || 0));
}

// Tabs use short labels so all twelve fit without clipping; the table and the
// detail panel still show the full category name.
const TAB_LABELS = {
  dex: "Spot DEX",
  aggregator: "Aggregators",
  perps: "Perps",
  lending: "Lending",
  vaults: "Vaults",
  staking: "Liquid staking",
  restaking: "Restaking",
  "stable-rwa": "Stablecoins & RWA",
  "bridge-chain": "Bridges & chains",
  other: "Launchpads & other",
  boards: "Boards",
  tooling: "Tooling",
};

function tabList() {
  return [{ id: "overall", label: "Top 200", count: null }].concat(
    (state.data.categories || []).map(cat => ({
      id: cat.id,
      label: TAB_LABELS[cat.id] || cat.label,
      count: cat.count,
    }))
  );
}

function renderTabs() {
  const host = $("tabs");
  host.innerHTML = tabList()
    .map(tab => {
      const selected = tab.id === state.tab;
      const count = tab.count == null ? "" : ` <span class="count">${esc(tab.count)}</span>`;
      return `<button type="button" role="tab" id="tab-${esc(tab.id)}" data-tab="${esc(tab.id)}" aria-selected="${selected}" aria-controls="board" tabindex="${selected ? 0 : -1}">${esc(tab.label)}${count}</button>`;
    })
    .join("");
  $("board").setAttribute("aria-labelledby", `tab-${state.tab}`);
  const active = host.querySelector('[aria-selected="true"]');
  if (active && host.scrollWidth > host.clientWidth + 1) {
    const delta = active.getBoundingClientRect().left - host.getBoundingClientRect().left;
    if (delta < 0 || delta + active.offsetWidth > host.clientWidth) host.scrollLeft += delta - 16;
  }
}

function renderStats() {
  const stats = state.data.stats || {};
  const bits = [
    [stats.overall ?? (state.data.overall || []).length, "in the top 200"],
    [stats.dedicatedMonitor ?? "—", "with a monitor"],
    [stats.forkInTop200 ?? "—", "with a fork test"],
    [stats.apiOnlyInTop200 ?? "—", "API-only"],
    [stats.rankingOnly ?? "—", "ranking only"],
    [stats.newInTop200 ?? "—", "new in 6 months"],
  ];
  const host = $("stats");
  host.hidden = false;
  host.innerHTML = bits
    .map(([n, label]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`)
    .join("");
}

function renderMethod() {
  const m = state.data.methodology || {};
  const w = m.weights || {};
  const floors = m.floors || {};
  const corpus = m.mentionCorpus;
  const labels = {
    size: "size",
    growth: "6-month growth",
    tvlAdded: "6-month TVL added",
    feesMomentum: "fees momentum",
    volumeMomentum: "volume momentum",
    attention: "token attention",
    smartMoney: "smart-money flow",
  };
  const weightLine = Object.entries(w)
    .map(([key, value]) => `${esc(labels[key] || key)} ${esc(value)}`)
    .join(" · ");
  const corpusLine = corpus
    ? `<li>X mentions: ${esc(corpus.posts)} distinct posts from ${esc((corpus.lists || []).length)} lists, ${esc(corpus.from)} to ${esc(corpus.to)}. ${esc(m.mentionBonus || "")}.</li>`
    : `<li>X mentions: ${esc(m.mentionBonus || "")}.</li>`;
  const sources = (m.sources || [])
    .map(source => {
      const stateLabel = !source.enabled ? "off" : source.available ? `${source.matched} rows` : "unavailable";
      const preview = source.available && source.public === false ? " (preview)" : "";
      return `${esc(source.label || source.id)} ${esc(stateLabel)}${preview}`;
    })
    .join(" · ");
  const sourceLine = sources
    ? `<li>External sources: ${sources}. ${esc(m.tokenCoverage || 0)} rows have a mapped token; the rest score a neutral 0.5.</li>`
    : "";
  const legends = [];
  if (isNum(w.attention)) legends.push("<b>A</b> = CoinGecko attention percentile");
  if (isNum(w.smartMoney)) legends.push("<b>S</b> = Nansen smart-money percentile");
  const legendLine = legends.length
    ? `<li>Signals column: ${legends.join(", ")}. A dash means the row has no mapped token.</li>`
    : "";
  $("method-body").innerHTML = `
    <p>${esc(m.summary || "")}</p>
    <ul>
      <li>Weights: ${weightLine}.</li>
      ${sourceLine}
      ${legendLine}
      ${corpusLine}
      <li>${esc(state.data.stats && state.data.stats.eligible)} protocol rows scored. Floors: TVL ${money(floors.minTvlUsd)}, or 30-day fees ${money(floors.minFees30dUsd)}, or 30-day volume ${money(floors.minVolume30dUsd)}. Excluded: ${esc((m.excluded || []).join(", "))}.</li>
    </ul>`;
}

function renderTable() {
  const meta = categoryById(state.tab);
  const note = $("tab-note");
  if (state.tab !== "overall" && meta && meta.note) {
    note.hidden = false;
    note.textContent = meta.note;
  } else {
    note.hidden = true;
    note.textContent = "";
  }
  const rows = visibleRows();
  $("status").textContent = rows.length ? `${rows.length} shown` : "No protocols match.";
  $("rows").innerHTML = rows
    .map(row => {
      const link = row.llamaUrl
        ? ` <a class="llama" href="${esc(row.llamaUrl)}" target="_blank" rel="noreferrer">DefiLlama</a>`
        : "";
      const overall =
        state.tab !== "overall" && row.overallRank ? `<span class="slug">#${esc(row.overallRank)} overall</span>` : "";
      return `<tr>
        <td data-label="#">${esc(row.rank ?? "—")}</td>
        <td data-label="Protocol"><a class="name" href="${PROTOCOL_PAGE ? `protocol.html?slug=${encodeURIComponent(row.slug || row.id)}` : `#p=${encodeURIComponent(row.slug || row.id)}`}">${esc(row.name)}</a><span class="slug">${esc(row.slug)}${link}</span>${overall}${breakdown(row)}</td>
        <td class="col-cat" data-label="Category">${esc(labelFor(row.category))}</td>
        <td class="num" data-label="TVL">${money(row.tvl)}</td>
        <td class="num" data-label="6-month TVL">${changeCell(row)}</td>
        <td class="num" data-label="6-month added">${addedCell(row.tvlAdded6m)}</td>
        <td class="num" data-label="30d fees">${money(row.fees30d)}</td>
        <td class="num" data-label="X posts">${mentionBadge(row)}</td>
        <td class="num" data-label="Signals">${signalsCell(row)}</td>
        <td data-label="Monitor">${coverageBadge(row)}</td>
        <td class="scripts" data-label="Scripts">${scriptsCell(row.scripts)}</td>
      </tr>`;
    })
    .join("");
  document.querySelectorAll("#board th[data-sort]").forEach(th => {
    const key = th.getAttribute("data-sort");
    th.setAttribute("aria-sort", key === state.sortKey ? (state.sortDir > 0 ? "ascending" : "descending") : "none");
  });
}

function generatedLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Generated ${iso}`;
  const local = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return `Data generated ${local} (your time), ${iso.slice(0, 16).replace("T", " ")} UTC.`;
}

function readHash() {
  if (PROTOCOL_PAGE) {
    state.protocol = new URLSearchParams(location.search).get("slug") || "";
    return;
  }
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const tab = params.get("tab");
  if (tab && tabList().some(t => t.id === tab)) state.tab = tab;
  state.query = params.get("q") || "";
  state.protocol = params.get("p") || "";
  const search = $("search");
  if (search) search.value = state.query;
}

function writeHash() {
  if (PROTOCOL_PAGE) return;
  const params = new URLSearchParams();
  if (state.tab !== "overall") params.set("tab", state.tab);
  if (state.query) params.set("q", state.query);
  if (state.protocol) params.set("p", state.protocol);
  const next = params.toString();
  history.replaceState(null, "", next ? `#${next}` : location.pathname + location.search);
}

function selectTab(id, focus) {
  state.tab = id;
  state.protocol = "";
  state.sortKey = "rank";
  state.sortDir = 1;
  renderTabs();
  renderTable();
  renderDetail();
  writeHash();
  if (focus) {
    const button = $(`tab-${id}`);
    if (button) {
      button.focus();
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
}

function bind() {
  document.addEventListener("click", event => {
    const button = event.target.closest("button[data-copy]");
    if (!button) return;
    const text = button.getAttribute("data-copy") || "";
    const done = () => {
      button.classList.add("done");
      button.textContent = "Copied";
      setTimeout(() => {
        button.classList.remove("done");
        button.textContent = "Copy";
      }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => done());
    } else {
      done();
    }
  });
  if (PROTOCOL_PAGE || !$("tabs")) return;
  $("tabs").addEventListener("click", event => {
    const button = event.target.closest("button[data-tab]");
    if (button) selectTab(button.getAttribute("data-tab"), false);
  });
  $("tabs").addEventListener("keydown", event => {
    const ids = tabList().map(t => t.id);
    const idx = ids.indexOf(state.tab);
    let next = null;
    if (event.key === "ArrowRight") next = ids[(idx + 1) % ids.length];
    else if (event.key === "ArrowLeft") next = ids[(idx - 1 + ids.length) % ids.length];
    else if (event.key === "Home") next = ids[0];
    else if (event.key === "End") next = ids[ids.length - 1];
    if (next) {
      event.preventDefault();
      selectTab(next, true);
    }
  });
  $("search").addEventListener("input", event => {
    state.query = event.target.value;
    renderTable();
    writeHash();
  });
  document.querySelector("#board thead").addEventListener("click", event => {
    const th = event.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.getAttribute("data-sort");
    if (state.sortKey === key) state.sortDir *= -1;
    else {
      state.sortKey = key;
      state.sortDir = key === "rank" || TEXT_KEYS.has(key) ? 1 : -1;
    }
    renderTable();
  });
  window.addEventListener("hashchange", () => {
    readHash();
    renderTabs();
    renderTable();
    renderDetail();
  });
}

async function init() {
  try {
    const response = await fetch("data.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (err) {
    $("lede").textContent = `Could not load data.json (${err.message}). Run npm run showcase:build, then npm run showcase:serve.`;
    return;
  }
  const stats = state.data.stats || {};
  const methodology = state.data.methodology || {};
  const signalCount = (stats.signalsEnabled || []).length;
  const signalText = signalCount
    ? signalCount === 2
      ? "token attention and smart-money flow, "
      : "an external signal, "
    : "";
  $("lede").textContent = `The top ${stats.overall || 200} DeFi protocols by a six-month trend score: size, TVL growth in percent and in dollars, fees and volume momentum, ${signalText}and a small bonus for posts on the tracked X lists.`;
  $("generated").textContent = generatedLabel(state.data.generatedAt);

  const sourcesLine = $("sources-line");
  if (sourcesLine) {
    const credits = (methodology.sources || [])
      .filter(source => source.enabled && source.available && source.attribution)
      .map(source => {
        const branding = SOURCE_META[source.id] || {};
        const url = source.url || branding.url;
        const name = source.name || branding.name;
        const attribution = String(source.attribution);
        const anchor = target =>
          `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(target)}</a>`;
        if (!url) return esc(attribution);
        if (name && attribution.endsWith(name)) {
          return `${esc(attribution.slice(0, -name.length))}${anchor(name)}`;
        }
        return anchor(attribution);
      })
      .join(". ");
    const defillama = 'Core market data from <a href="https://defillama.com" target="_blank" rel="noreferrer">DefiLlama</a>.';
    sourcesLine.innerHTML = credits ? `${credits}. ${defillama}` : defillama;
  }
  const warn = $("warn");
  if (warn && methodology.publishSafe === false) {
    warn.hidden = false;
    warn.textContent =
      "Local preview: this build includes smart-money data that is not cleared for public redistribution. Do not deploy until Nansen approval is in place.";
  }
  readHash();
  if (PROTOCOL_PAGE) {
    const lede = $("lede");
    if (lede) lede.textContent = "Protocol test panel.";
    renderDetail();
    bind();
    return;
  }
  renderStats();
  renderMethod();
  renderTabs();
  renderTable();
  renderDetail();
  bind();
}

init();
