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
  // ?view=flow on the protocol page renders only the contract flow, for deep links and for
  // screenshotting every diagram in a batch without scrolling a 5,000px page.
  view: "",
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

/**
 * What the repo can prove about this row's contracts, not just whether a monitor exists.
 * A fork badge carries the counts you would otherwise have to open the panel to find.
 */
function coverageBadge(row) {
  const t = row.testing || {};
  const contracts = (t.contracts || []).length;
  const features = (t.features || []).length;
  if (t.mode === "fork") {
    const chains = [...new Set((t.contracts || []).map(c => c.chain))];
    const steps = ((t.flow && t.flow.edges) || []).length;
    const title = [
      `${contracts} contract address${contracts === 1 ? "" : "es"} on ${chains.length ? chains.join(", ") : t.chain || "—"}`,
      `${features} tested feature${features === 1 ? "" : "s"}`,
      steps ? `${steps}-step contract flow in the panel` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `<span class="badge fork" title="${esc(title)}">Fork · ${features}f/${contracts}c</span>`;
  }
  if (t.mode === "api") return `<span class="badge api" title="${esc(t.note || "No permissionless on-chain action.")}">API-only</span>`;
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

// CoinGecko product page. Falls back to the mapped token id so a data.json built
// before coingeckoUrl existed still renders the link.
/** X handle from DefiLlama's `twitter` field, normalised to a bare handle. */
function xHandle(row) {
  return String(row.twitter || "")
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .trim();
}
function xUrl(row) {
  const handle = xHandle(row);
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : null;
}

function geckoUrl(row) {
  if (row.coingeckoUrl) return row.coingeckoUrl;
  const id = row.token && row.token.coingeckoId;
  return id ? `https://www.coingecko.com/en/coins/${encodeURIComponent(id)}` : null;
}


/** CoinGecko icon beside the protocol name, or a monogram when none matched. */
function protocolMonogram(row) {
  const label = String(row && row.name ? row.name : "?").trim();
  return (label.charAt(0) || "?").toUpperCase();
}
function protocolIcon(row, sizeClass) {
  const cls = sizeClass ? `proto-icon ${sizeClass}` : "proto-icon";
  const mono = protocolMonogram(row);
  const url = row && row.icon && row.icon.url;
  if (url) {
    return `<img class="${cls}" src="${esc(url)}" alt="" width="20" height="20" loading="lazy" decoding="async" data-mono="${esc(mono)}" onerror="this.onerror=null;const s=document.createElement('span');s.className=this.className+' monogram';s.setAttribute('aria-hidden','true');s.textContent=this.dataset.mono||'?';this.replaceWith(s);" />`;
  }
  return `<span class="${cls} monogram" aria-hidden="true">${esc(mono)}</span>`;
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

const FLOW_KIND_LABEL = {
  actor: "actor",
  contract: "protocol contract",
  token: "token / position",
  external: "external contract",
  offchain: "off this machine",
};
const FLOW_ARROW = { call: "→", transfer: "⇒", event: "⇢", offchain: "⇢" };
const FM = { width: 196, height: 66, row: 92, col: 232, pad: 22 };

/** FNV-ish hash so every protocol gets a stable accent hue without a colour table. */
function hueOf(text) {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function wrapText(text, max = 24) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  const push = value => {
    if (value) lines.push(value);
  };
  for (const word of words) {
    // A long unbroken token ("ADDRESSES_PROVIDER()") must be split, or the clip path cuts it
    // mid-glyph with no ellipsis.
    if (word.length > max) {
      if (line) {
        push(line);
        line = "";
      }
      let rest = word;
      while (rest.length > max) {
        push(rest.slice(0, max));
        rest = rest.slice(max);
      }
      line = rest;
      continue;
    }
    if (line && `${line} ${word}`.length > max) {
      push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  push(line);
  if (lines.length <= 2) return lines;
  const tail = lines.slice(1).join(" ");
  const cut = tail.length > max - 1 ? `${tail.slice(0, max - 1).trimEnd()}…` : tail;
  return [lines[0], cut];
}

/**
 * Layered left-to-right layout: actors first, then one column per call hop. Cycles are allowed
 * and drawn as return arcs under the graph, so a supply/withdraw loop reads as a loop instead of
 * an infinite chain. Positions are deterministic, which matters when 91 diagrams share a style.
 */
function layoutFlow(flow) {
  const edges = flow.graph && flow.graph.edges ? flow.graph.edges : [];
  const layer = new Map();
  for (const node of flow.nodes) layer.set(node.id, node.kind === "actor" ? 0 : 1);
  const pinned = new Set(flow.nodes.filter(node => node.kind === "actor").map(node => node.id));
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (pinned.has(edge.to)) continue;
      // 0..2 = three columns (actor -> protocol -> token/off-machine). Four columns force a
      // 0.77 scale in a 780px panel, which pushes labels under 10px; three keep them legible.
      const next = Math.min(2, (layer.get(edge.from) || 0) + 1);
      if (next > (layer.get(edge.to) || 1)) {
        layer.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const columns = new Map();
  for (const node of flow.nodes) {
    const index = layer.get(node.id) || 0;
    if (!columns.has(index)) columns.set(index, []);
    columns.get(index).push(node);
  }
  const ordered = [...columns.entries()].sort((a, b) => a[0] - b[0]);
  // One barycenter pass: order each column by the mean row of the nodes that point at it, so a
  // token sits next to the contract that calls it instead of wherever the author listed it.
  const placed = new Map();
  for (const [layerIndex, list] of ordered) {
    if (layerIndex > 0) {
      const score = node => {
        const neighbours = edges
          .filter(edge => edge.to === node.id && placed.has(edge.from))
          .map(edge => placed.get(edge.from));
        return neighbours.length ? neighbours.reduce((sum, value) => sum + value, 0) / neighbours.length : Number.MAX_SAFE_INTEGER;
      };
      list.sort((a, b) => score(a) - score(b));
    }
    list.forEach((node, index) => placed.set(node.id, index));
  }
  const rows = Math.max(...ordered.map(([, list]) => list.length), 1);
  const positions = new Map();
  ordered.forEach(([, list], columnIndex) => {
    // Centre short columns, but never leave more than two empty rows above them: a 9-node
    // column next to a 1-node actor otherwise creates a dead band half the height of the graph.
    const offset = Math.min((rows - list.length) / 2, 2);
    list.forEach((node, rowIndex) => {
      positions.set(node.id, {
        x: FM.pad + columnIndex * FM.col,
        y: FM.pad + (rowIndex + offset) * FM.row,
      });
    });
  });
  const sameColumnEdges = edges.filter(edge => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    return from && to && from.x === to.x;
  });
  // A cycle travels below the cards, so only those graphs need the bottom gutter.
  const loops = edges.some(edge => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    return from && to && to.x <= from.x;
  });
  // Size the canvas from what is actually drawn, not from rows * row: centring leaves slack in
  // short columns and that slack was showing up as a dead band under the graph.
  const bottom = Math.max(...[...positions.values()].map(at => at.y + FM.height));
  const widest = Math.max(...[...positions.values()].map(at => at.x + FM.width));
  const loopRoom = sameColumnEdges.length ? 30 + (sameColumnEdges.length - 1) * 14 + 24 : 0;
  return {
    edges,
    positions,
    width: Math.max(widest, FM.pad + (ordered.length - 1) * FM.col + FM.width) + loopRoom + 14,
    height: bottom + (loops ? 44 : 10),
  };
}

function edgePath(from, to, mode, index = 0) {
  const mid = node => node.y + FM.height / 2;
  // Same column: loop out to the right of the column so the arrow is not hidden behind a card.
  if (mode === "same") {
    const sx = from.x + FM.width;
    const sy = mid(from);
    const tx = to.x + FM.width;
    const ty = mid(to);
    const bulge = 30 + index * 14;
    return `M ${sx} ${sy} C ${sx + bulge} ${sy}, ${tx + bulge} ${ty}, ${tx} ${ty}`;
  }
  // Target is left of the source (a cycle): travel under both cards and come back up.
  if (mode === "back") {
    const sx = from.x + FM.width / 2;
    const tx = to.x + FM.width / 2;
    const sy = from.y + FM.height;
    const ty = to.y + FM.height;
    const depth = 34 + index * 12;
    return `M ${sx} ${sy} C ${sx} ${sy + depth}, ${tx} ${ty + depth}, ${tx} ${ty}`;
  }
  const sx = from.x + FM.width;
  const sy = mid(from);
  const tx = to.x - 4;
  const ty = mid(to);
  // Short hops need a small control offset or the curve overshoots and loops back on itself.
  const curve = Math.max(10, Math.min(70, (tx - sx) / 2));
  return `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`;
}

/** The graph itself: nodes are cards, edges are deduped arrows labelled with step ranges. */
function flowSvg(flow) {
  const { edges, positions, width, height } = layoutFlow(flow);
  const marker = kind => `fm-arrow-${kind}`;
  const defs = `<clipPath id="fm-card-clip"><rect width="${FM.width - 6}" height="${FM.height - 4}" rx="11"/></clipPath>` + ["call", "transfer", "event", "offchain"]
    .map(
      kind => `<marker id="${marker(kind)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="fm-head fm-head--${kind}"/>
      </marker>`
    )
    .join("");

  let sameSeen = 0;
  let backSeen = 0;
  const badges = [];
  const paths = edges
    .map((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return "";
      const mode = to.x === from.x ? "same" : to.x < from.x ? "back" : "forward";
      // Bulges are counted per mode, not by the global edge index: with 28 edges the 27th loop
      // bulged 400px to the right and ran off the canvas.
      const modeIndex = mode === "same" ? sameSeen++ : mode === "back" ? backSeen++ : 0;
      const d = edgePath(from, to, mode, modeIndex);
      const label = edge.range ? `${edge.range}` : String(index + 1);
      const many = (edge.steps || []).length > 1;
      const badgeWidth = Math.max(32, label.length * 6 + 8);
      badges.push(
        `<g class="fm-step-badge" data-badge="${esc(edge.from)}->${esc(edge.to)}" transform="translate(${from.x + FM.width - 6} ${from.y + 12})">
          <rect x="${-badgeWidth / 2}" y="-8" width="${badgeWidth}" height="15" rx="7" />
          <text x="0" y="3">${esc(label)}</text>
        </g>`
      );
      return `<g class="fm-link" data-edge="${esc(edge.from)}->${esc(edge.to)}" data-kind="${esc(edge.kind)}">
        <path class="fm-hit" d="${d}" />
        <path class="fm-edge fm-edge--${esc(edge.kind)}" d="${d}" marker-end="url(#${marker(edge.kind)})" />
        ${many ? `<title>${esc((edge.labels || []).join(" → ").slice(0, 300))}</title>` : ""}
      </g>`;
    })
    .join("");

  const cards = flow.nodes
    .map(node => {
      const at = positions.get(node.id);
      if (!at) return "";
      const lines = wrapText(node.short || node.label, 22);
      const text = lines
        .map((line, index) => `<tspan x="14" dy="${index === 0 ? 0 : 15}">${esc(line)}</tspan>`)
        .join("");
      const address = node.address ? `<text class="fm-address" x="14" y="${FM.height - 12}">${esc(node.address.slice(0, 6))}…${esc(node.address.slice(-4))}</text>` : "";
      return `<g class="fm-node fm-node--${esc(node.kind)}" data-node="${esc(node.id)}" transform="translate(${at.x} ${at.y})">
        <rect class="fm-card" width="${FM.width}" height="${FM.height}" rx="12" />
        <rect class="fm-stripe" width="4" height="${FM.height}" rx="2" />
        <g clip-path="url(#fm-card-clip)">
          <text class="fm-label" y="${lines.length > 1 ? 26 : 33}">${text}</text>
          ${address}
        </g>
      </g>`;
    })
    .join("");

  const dense = edges.length > 18 ? " is-dense" : "";
  return `<div class="flowmap${dense}" data-flow="${esc(flow.key)}" style="--fm-hue:${hueOf(flow.key)}">
    <svg class="flowmap-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"
      aria-label="Contract flow: ${flow.nodes.length} nodes and ${edges.length} calls. Use the call log below for the ordered steps.">
      <defs>${defs}</defs>
      <g class="fm-links">${paths}</g>
      <g class="fm-nodes">${cards}</g>
      <g class="fm-badges">${badges.join("")}</g>
    </svg>
  </div>`;
}

/** The ordered call log. It is the accessible source of truth and the target of the play head. */
function flowLog(flow) {
  const rows = (flow.edges || [])
    .map(
      (edge, index) => `<li class="fm-row" data-step="${index + 1}" data-edge="${esc(edge.from)}->${esc(edge.to)}">
        <span class="fm-row-index">${index + 1}</span>
        <span class="fm-row-call">${esc(edge.label)}</span>
        <span class="fm-row-ends"><code>${esc(edge.from)}</code> ${FLOW_ARROW[edge.kind] || "→"} <code>${esc(edge.to)}</code></span>
      </li>`
    )
    .join("");
  return `<details class="flow-log">
    <summary>Call log <span>${(flow.edges || []).length} steps, in execution order</span></summary>
    <ol>${rows}</ol>
  </details>`;
}

function flowHtml(flow) {
  if (!flow || !flow.nodes || !flow.nodes.length) return "";
  const kinds = [...new Set(flow.nodes.map(node => node.kind))];
  const legend = kinds.map(kind => `<span class="flow-key ${esc(kind)}">${esc(FLOW_KIND_LABEL[kind] || kind)}</span>`).join("");
  const steps = (flow.edges || []).length;
  const notes = (flow.notes || []).length ? `<ul class="flow-notes">${flow.notes.map(note => `<li>${esc(note)}</li>`).join("")}</ul>` : "";
  const missing = (flow.missing || []).filter(item => item.status === "gap" || item.status === "failing-paused");
  const gaps = missing.length
    ? `<p class="muted">${missing.length} feature${missing.length === 1 ? "" : "s"} still without a fork test: ${missing
        .map(item => `<b>${esc(item.feature)}</b>${item.how ? ` — ${esc(item.how)}` : ""}`)
        .join("; ")}. Full matrix in <a href="https://github.com/xjjda22/defi-scripts/blob/main/docs/10-contract-flows.md" target="_blank" rel="noreferrer">docs/10</a>.</p>`
    : "";
  return `<h3>Contract flow</h3>
    <p class="muted">${esc(flow.summary || "")}</p>
    <div class="flow-legend">${legend}</div>
    <div class="flowmap-bar">
      <button class="fm-play" type="button" aria-pressed="false" data-play>▶ Play the ${steps}-call sequence</button>
      <span class="fm-readout" data-readout>${steps} calls · press play</span>
      <span class="fm-scroll-hint" data-scroll-hint hidden>scroll →</span>
      <button class="fm-expand" type="button" data-expand aria-pressed="false">⤢ Expand</button>
    </div>
    ${flowSvg(flow)}
    ${flowLog(flow)}
    ${notes}
    ${gaps}`;
}

/**
 * Size the graph to the panel and place the step badges. Re-runnable: the Expand overlay and a
 * window resize both change the available width, and the SVG has to re-fit without a reload.
 * The graph is allowed to grow up to 1.6x natural size (the expanded view) and to shrink to 0.5x
 * before the panel falls back to horizontal scrolling, so the animation is never cropped by a
 * narrow column.
 */
function fitFlowmap(map) {
  const svg = map.querySelector("svg");
  const hint = map.parentElement.querySelector("[data-scroll-hint]");
  if (!svg) return;
  const box = svg.viewBox.baseVal;
  const available = Math.max(320, map.clientWidth - 12);
  const target = Math.min(box.width * 1.6, Math.max(available, box.width * 0.5));
  svg.style.width = `${target}px`;
  svg.style.height = `${(target * box.height) / box.width}px`;
  if (hint) hint.hidden = map.scrollWidth <= map.clientWidth + 4;

  // Card rects in viewBox units. getBBox() + the transform matrix missed some cards, so measure
  // the painted rect and rescale it.
  const svgRect = svg.getBoundingClientRect();
  if (!svgRect.width) return;
  const unit = box.width / svgRect.width;
  const cards = [...map.querySelectorAll(".fm-node")].map(node => {
    const rect = node.querySelector(".fm-card").getBoundingClientRect();
    return {
      x: (rect.left - svgRect.left) * unit,
      y: (rect.top - svgRect.top) * unit,
      width: rect.width * unit,
      height: rect.height * unit,
    };
  });
  const taken = [];
  const MARGIN = 16;
  const onCanvas = point => point.x > MARGIN && point.x < box.width - MARGIN && point.y > 12 && point.y < box.height - 12;
  const offCards = point =>
    !cards.some(card => point.x > card.x - 26 && point.x < card.x + card.width + 26 && point.y > card.y - 16 && point.y < card.y + card.height + 16);
  const offBadges = point => !taken.some(other => Math.abs(other.x - point.x) < 34 && Math.abs(other.y - point.y) < 20);

  for (const link of map.querySelectorAll(".fm-link")) {
    const path = link.querySelector(".fm-edge");
    const badge = map.querySelector(`[data-badge="${link.dataset.edge}"]`);
    if (!path || !badge) continue;
    const total = path.getTotalLength();
    let chosen = null;
    for (const ratio of [0.46, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.9, 0.14, 0.86, 0.95]) {
      const point = path.getPointAtLength(total * ratio);
      if (onCanvas(point) && offCards(point) && offBadges(point)) {
        chosen = point;
        break;
      }
    }
    if (!chosen) {
      const mid = path.getPointAtLength(total * 0.5);
      for (const dy of [-16, 16, -32, 32, -48, 48]) {
        const point = {
          x: Math.min(Math.max(mid.x, MARGIN), box.width - MARGIN),
          y: Math.min(Math.max(mid.y + dy, 14), box.height - 14),
        };
        if (offCards(point) && offBadges(point)) {
          chosen = point;
          break;
        }
      }
    }
    let point = chosen || path.getPointAtLength(total * 0.5);
    if (cards.some(card => point.x > card.x && point.x < card.x + card.width && point.y > card.y && point.y < card.y + card.height)) {
      point = path.getPointAtLength(total * 0.95);
    }
    taken.push(point);
    badge.setAttribute("transform", `translate(${point.x} ${point.y})`);
  }
}

/**
 * Play head for one diagram: steps the ordered call log, highlights the matching arrow and both
 * endpoints, and prints the call. A second click pauses; prefers-reduced-motion turns the travel
 * animation off but keeps stepping.
 */
function wireFlow(root) {
  for (const map of root.querySelectorAll(".flowmap")) {
    const flowKey = map.dataset.flow;
    const readout = map.parentElement.querySelector("[data-readout]");
    const play = map.parentElement.querySelector("[data-play]");
    const log = map.parentElement.querySelector(".flow-log");
    const flowEl = map.parentElement;
    const rowFor = step => (log ? log.querySelector(`[data-step="${step}"]`) : null);
    const linkFor = step => {
      const row = rowFor(step);
      return row ? map.querySelector(`[data-edge="${row.dataset.edge}"]`) : null;
    };
    let current = 0;
    let timer = null;

    const focus = step => {
      map.querySelectorAll(".is-active").forEach(el => el.classList.remove("is-active"));
      if (log) log.querySelectorAll(".is-current").forEach(el => el.classList.remove("is-current"));
      if (!step) return;
      const row = rowFor(step);
      const link = linkFor(step);
      const badge = row ? map.querySelector(`.fm-step-badge[data-badge="${row.dataset.edge}"]`) : null;
      map.querySelectorAll(".fm-step-badge.is-active").forEach(el => el.classList.remove("is-active"));
      if (badge) badge.classList.add("is-active");
      if (link) {
        link.classList.add("is-active");
        const nodes = String(row.dataset.edge).split("->");
        for (const id of nodes) {
          const node = map.querySelector(`[data-node="${id}"]`);
          if (node) node.classList.add("is-active");
        }
      }
      if (row) {
        row.classList.add("is-current");
        if (readout) readout.textContent = `${step} / ${flowEl.querySelectorAll(".fm-row").length} · ${row.querySelector(".fm-row-call").textContent}`;
        // The highlighted row is the readable half of the animation: open the log and keep the
        // current step in view inside its scroll box.
        if (log && !log.open) log.open = true;
        const list = log && log.querySelector("ol");
        if (list) list.scrollTop = Math.max(0, row.offsetTop - list.clientHeight / 2);
      }
    };

    const stop = message => {
      if (timer) clearInterval(timer);
      timer = null;
      if (play) {
        play.setAttribute("aria-pressed", "false");
        play.textContent = `▶ Play the ${flowEl.querySelectorAll(".fm-row").length}-call sequence`;
      }
      if (message && readout) readout.textContent = message;
    };

    if (play) {
      play.addEventListener("click", () => {
        if (timer) {
          stop(`paused at step ${current}`);
          return;
        }
        play.setAttribute("aria-pressed", "true");
        play.textContent = "❚❚ Pause";
        current = 0;
        const total = flowEl.querySelectorAll(".fm-row").length;
        const tick = () => {
          current = (current % total) + 1;
          focus(current);
          if (readout) readout.textContent = `${current} / ${total} · ${rowFor(current).querySelector(".fm-row-call").textContent}`;
        };
        tick();
        timer = setInterval(tick, 1100);
      });
    }

    if (log) {
      log.addEventListener("click", event => {
        const row = event.target.closest(".fm-row");
        if (!row) return;
        if (timer) stop();
        current = Number(row.dataset.step);
        focus(current);
      });
    }

    map.addEventListener("mouseover", event => {
      const node = event.target.closest(".fm-node");
      map.classList.toggle("is-pointing", Boolean(node));
      map.querySelectorAll(".fm-node.is-hot").forEach(el => el.classList.remove("is-hot"));
      if (node) {
        node.classList.add("is-hot");
        map.dataset.hot = node.dataset.node;
      } else {
        delete map.dataset.hot;
      }
    });
    map.addEventListener("mouseleave", () => {
      map.classList.remove("is-pointing");
      delete map.dataset.hot;
    });

    const expand = map.parentElement.querySelector("[data-expand]");
    const setExpanded = on => {
      map.classList.toggle("is-expanded", on);
      document.body.classList.toggle("flow-lock", on);
      if (expand) {
        expand.setAttribute("aria-pressed", String(on));
        expand.textContent = on ? "✕ Close" : "⤢ Expand";
      }
      // The overlay changes the available width; re-fit after layout so badges move with it.
      requestAnimationFrame(() => fitFlowmap(map));
    };
    if (expand) expand.addEventListener("click", () => setExpanded(!map.classList.contains("is-expanded")));
    map.addEventListener("keydown", event => {
      if (event.key === "Escape") setExpanded(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && map.classList.contains("is-expanded")) setExpanded(false);
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => fitFlowmap(map), 120);
    });

    fitFlowmap(map);
    map.dataset.flowKey = flowKey;
  }
}

// Honest fork status: direct, linked (another product's test), failing-paused (fails on
// purpose while the protocol is paused) or none (API-only).
const STATUS_LABEL = {
  direct: "Fork test",
  linked: "Linked fork test",
  "failing-paused": "Fork test · protocol paused",
  none: "API-only",
};
function statusBadge(testing) {
  const status = testing.status || (testing.mode === "fork" ? "direct" : "none");
  const cls = status === "direct" ? "fork" : status === "none" ? "api" : "warn";
  const title =
    status === "linked"
      ? `Uses ${testing.via || "another product's test"}: ${testing.reason || ""}`
      : status === "failing-paused"
        ? (testing.paused || []).map(item => `${item.script}: ${item.reason}`).join(" ")
        : "";
  return `<span class="badge ${cls}"${title ? ` title="${esc(title)}"` : ""}>${esc(status === "direct" ? testing.label || STATUS_LABEL.direct : STATUS_LABEL[status])}</span>`;
}
function protocolStatusBadge(row) {
  if (!row.protocolStatus) return "";
  const title = (row.protocolStatuses || []).map(item => `${item.status}${item.since ? ` since ${item.since}` : ""}: ${item.reason}`).join(" · ");
  return ` <span class="badge state" title="${esc(title)}">${esc(row.protocolStatus)}</span>`;
}
function disputedBadge(row) {
  if (!row.dataDisputed) return "";
  const title = (row.disputes || []).map(item => `${item.metric}: claim ${item.claim}, DefiLlama ${item.defillama}`).join(" · ");
  return ` <span class="badge warn" title="${esc(title)}">data disputed</span>`;
}

function detailHtml(row) {
  const testing = row.testing || { mode: "api-only", note: "No fork test for this protocol.", recipe: null };
  const fork = testing.mode === "fork";
  const mode = statusBadge(testing) + protocolStatusBadge(row) + disputedBadge(row);
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
  const gecko = geckoUrl(row);
  const handle = xHandle(row);
  const xLink = xUrl(row);
  const pills = [
    app ? { href: app, glyph: "⌂", label: "Official app" } : null,
    row.llamaUrl ? { href: row.llamaUrl, glyph: "◈", label: "DefiLlama" } : null,
    gecko ? { href: gecko, glyph: "◉", label: "CoinGecko" } : null,
    xLink ? { href: xLink, glyph: "𝕏", label: `@${handle}` } : null,
  ].filter(Boolean);
  const links = pills
    .map(
      item =>
        `<a class="link-pill" href="${esc(item.href)}" target="_blank" rel="noreferrer"><span class="glyph" aria-hidden="true">${item.glyph}</span>${esc(item.label)}<span class="out" aria-hidden="true">↗</span></a>`
    )
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
    ${(t => {
      const c = (t.contracts || []).length;
      const f = (t.features || []).length;
      if (!c && !f) return "";
      const chains = [...new Set((t.contracts || []).map(x => x.chain))];
      return `<p class="muted">${c} contract address${c === 1 ? "" : "es"}${
        chains.length ? ` on ${esc(chains.join(", "))}` : ""
      } · ${f} tested feature${f === 1 ? "" : "s"}</p>`;
    })(testing)}
    <h2 class="detail-title">${protocolIcon(row, "proto-icon-lg")}<span>${esc(row.name)}</span> ${mode}</h2>
    <div class="links">${links}</div>
    <div class="facts">
      <div class="fact"><b>${esc(money(row.tvl))}</b><span>TVL</span></div>
      <div class="fact"><b>${row.isNew ? "New" : esc(signedPct(row.tvlChange6m))}</b><span>6-month TVL</span></div>
      <div class="fact"><b>${esc(money(row.fees30d))}</b><span>30d fees</span></div>
      <div class="fact"><b>${esc(money(row.tvlAdded6m))}</b><span>6-month added</span></div>
      ${row.signals && isNum(row.signals.attention) ? `<div class="fact"><b>${Math.round(row.signals.attention * 100)}</b><span>Attention pct</span></div>` : ""}
      ${row.signals && isNum(row.signals.smartMoney) ? `<div class="fact"><b>${Math.round(row.signals.smartMoney * 100)}</b><span>Smart money pct</span></div>` : ""}
    </div>
    ${(row.protocolStatuses || []).length ? `<p class="muted"><b>Protocol state:</b> ${(row.protocolStatuses || []).map(item => `${esc(item.status)}${item.since ? ` since ${esc(item.since)}` : ""}: ${esc(item.reason)} (${esc(item.source)})`).join("; ")}. Scores are not adjusted.</p>` : ""}
    ${row.volumeNote ? `<p class="muted"><b>Volume:</b> ${esc(row.volumeNote)}</p>` : ""}
    ${row.dataDisputed ? `<p class="muted"><b>Data disputed.</b> ${(row.disputes || []).map(item => `${esc(item.metric)}: claim ${esc(item.claim)} vs DefiLlama ${esc(item.defillama)} (${esc(item.recorded)})`).join("; ")}. The score still uses DefiLlama; see data/disputes.json.</p>` : ""}
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
    ${flowHtml(testing.flow)}
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
  if (state.view === "flow") {
    document.body.classList.add("flow-only-page");
    if (!row.testing || !row.testing.flow) {
      host.innerHTML = `<article class="detail-card flow-only"><h2 class="detail-title">${protocolIcon(row, "proto-icon-lg")}<span>${esc(row.name)}</span></h2><p class="muted">No contract flow is configured for this row.</p></article>`;
      return;
    }
    document.title = `${row.name} · Contract flow`;
    host.innerHTML = `<article class="detail-card flow-only">
      <p class="kicker">${esc(labelFor(row.category))} · ${esc(row.name)}</p>
      ${flowHtml(row.testing.flow)}
    </article>`;
    wireFlow(host);
    return;
  }
  host.innerHTML = detailHtml(row);
  wireFlow(host);
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
      `<p>Score ${isNum(row.score) ? row.score.toFixed(3) : "—"}. Percentiles: size ${pct(c.size)}, growth ${pct(c.growth)}, TVL added ${pct(c.tvlAdded)}, fees momentum ${pct(c.feesMomentum)}, volume momentum ${pct(c.volumeMomentum)}${signalBits ? `, ${signalBits}` : ""}.</p>`
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

function coverageBits(coverage) {
  if (!coverage) return [];
  const f = coverage.forkable || {};
  const snap = coverage.snapshot ? ` (snapshot ${coverage.snapshot.id})` : "";
  return [
    [`${f.direct ?? "—"}/${coverage.forkableRows ?? "—"}`, `forkable rows with a direct fork test${snap}`],
    [`${(coverage.top50 || {}).direct ?? "—"}/50`, "top 50 direct"],
    [(coverage.nonForkable || {}).rows ?? "—", "on non-forkable chains"],
  ];
}

function renderStats() {
  const stats = state.data.stats || {};
  const bits = [
    [stats.overall ?? (state.data.overall || []).length, "in the top 200"],
    ...coverageBits(stats.coverage),
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
      const gecko = geckoUrl(row);
      const x = xUrl(row);
      const link = [
        row.llamaUrl ? { href: row.llamaUrl, glyph: "◈", label: "DefiLlama" } : null,
        gecko ? { href: gecko, glyph: "◉", label: "CoinGecko" } : null,
        x ? { href: x, glyph: "𝕏", label: `@${xHandle(row)}` } : null,
      ]
        .filter(Boolean)
        .map(item => `<a class="link-chip" href="${esc(item.href)}" target="_blank" rel="noreferrer"><span class="glyph" aria-hidden="true">${item.glyph}</span>${esc(item.label)}</a>`)
        .join("");
      const overall =
        state.tab !== "overall" && row.overallRank ? `<span class="slug">#${esc(row.overallRank)} overall</span>` : "";
      return `<tr>
        <td data-label="#">${esc(row.rank ?? "—")}</td>
        <td data-label="Protocol"><span class="proto"><a class="name" href="${PROTOCOL_PAGE ? `protocol.html?slug=${encodeURIComponent(row.slug || row.id)}` : `#p=${encodeURIComponent(row.slug || row.id)}`}">${protocolIcon(row)}${esc(row.name)}</a>${protocolStatusBadge(row)}${disputedBadge(row)}</span><span class="meta-line"><span class="slug">${esc(row.slug)}</span><span class="row-links">${link}</span></span>${overall}${breakdown(row)}</td>
        <td class="col-cat" data-label="Category">${esc(labelFor(row.category))}</td>
        <td class="num" data-label="TVL">${money(row.tvl)}</td>
        <td class="num" data-label="6-month TVL">${changeCell(row)}</td>
        <td class="num" data-label="6-month added">${addedCell(row.tvlAdded6m)}</td>
        <td class="num" data-label="30d fees">${money(row.fees30d)}</td>
        <td class="num" data-label="Signals">${signalsCell(row)}</td>
        <td data-label="Contracts">${coverageBadge(row)}</td>
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
  const hours = (Date.now() - date.getTime()) / 3600000;
  const age = hours < 48 ? `${Math.max(0, Math.round(hours))} h old` : `${(hours / 24).toFixed(1)} days old: STALE, scores may not reflect current protocol state`;
  return `Data generated ${local} (your time), ${iso.slice(0, 16).replace("T", " ")} UTC · ${age}.`;
}

function readHash() {
  if (PROTOCOL_PAGE) {
    const params = new URLSearchParams(location.search);
    state.protocol = params.get("slug") || "";
    state.view = params.get("view") || "";
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
  $("lede").textContent = `The top ${stats.overall || 200} DeFi protocols by a six-month trend score: size, TVL growth in percent and in dollars, fees and volume momentum${signalText ? `, ${signalText.trim().replace(/,$/, "")}` : ""}.`;
  $("generated").textContent = generatedLabel(state.data.generatedAt);
  {
    const hours = (Date.now() - new Date(state.data.generatedAt).getTime()) / 3600000;
    $("generated").classList.toggle("stale", hours >= 48);
  }

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
