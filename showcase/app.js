/* eslint-env browser */
const state = {
  data: null,
  tab: "overall",
  query: "",
  sortKey: "rank",
  sortDir: 1,
};

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]
  );
}

function money(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function changeCell(row) {
  const pct = row.tvlChange6m;
  if (pct == null || !Number.isFinite(pct)) return '<span class="chg">—</span>';
  const dir = pct >= 0 ? "up" : "down";
  const width = Math.max(6, Math.min(100, (Math.min(Math.abs(pct), 200) / 200) * 100));
  const label = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  const notes = [];
  if (row.tvlWindowDays && row.tvlWindowDays < 170) notes.push(`Window is ${row.tvlWindowDays} days`);
  if (row.tvlChange6mRaw != null && Math.abs(row.tvlChange6mRaw - pct) > 1) {
    notes.push(`Unclamped ${(row.tvlChange6mRaw > 0 ? "+" : "") + row.tvlChange6mRaw.toFixed(0)}%`);
  }
  const title = notes.length ? ` title="${esc(notes.join(". "))}"` : "";
  return `<span class="bar ${dir}"${title}><i style="width:${width}%"></i></span><span class="chg ${dir}">${label}</span>`;
}

function coverageBadge(row) {
  if (row.coverage === "covered by a dedicated monitor") return '<span class="badge monitor">Has monitor</span>';
  return '<span class="badge">Ranking only</span>';
}

function mentionBadge(count) {
  const n = count || 0;
  if (!n) return '<span class="chg">0</span>';
  return `<span class="badge mentions">${n}</span>`;
}

function scriptsCell(scripts) {
  if (!scripts || !scripts.length) return "—";
  const shown = scripts
    .slice(0, 3)
    .map(name => `<span>${esc(name)}</span>`)
    .join("");
  const more = scripts.length > 3 ? `<span>+${scripts.length - 3} more</span>` : "";
  return shown + more;
}

function labelFor(id) {
  const found = (state.data.categories || []).find(cat => cat.id === id);
  return found ? found.label : id;
}

function rowsForTab() {
  if (state.tab === "overall") return state.data.overall || [];
  return (state.data.byCategory && state.data.byCategory[state.tab]) || [];
}

function compare(a, b, key) {
  const dir = state.sortDir;
  const av = a[key];
  const bv = b[key];
  const aMissing = av == null || av === "";
  const bMissing = bv == null || bv === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
  return String(av).localeCompare(String(bv)) * dir;
}

function visibleRows() {
  const q = state.query.trim().toLowerCase();
  let rows = rowsForTab();
  if (q) {
    rows = rows.filter(row => `${row.name} ${row.slug}`.toLowerCase().includes(q));
  }
  return rows.slice().sort((a, b) => compare(a, b, state.sortKey) || (a.rank || 0) - (b.rank || 0));
}

function renderTabs() {
  const tabs = [{ id: "overall", label: "Top 200" }].concat(state.data.categories || []);
  $("tabs").innerHTML = tabs
    .map(tab => {
      const selected = tab.id === state.tab ? "true" : "false";
      return `<button type="button" role="tab" data-tab="${esc(tab.id)}" aria-selected="${selected}">${esc(tab.label)}</button>`;
    })
    .join("");
}

function renderStats() {
  const stats = state.data.stats || {};
  const bits = [
    [stats.overall ?? (state.data.overall || []).length, "in the top 200"],
    [stats.dedicatedMonitor ?? "—", "with a monitor"],
    [stats.rankingOnly ?? "—", "ranking only"],
    [stats.eligible ?? "—", "cleared the floor"],
  ];
  const host = $("stats");
  host.hidden = false;
  host.innerHTML = bits
    .map(([n, label]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`)
    .join("");
}

function renderMethod() {
  const m = state.data.methodology || {};
  const weights = m.weights || {};
  $("method-body").innerHTML = `
    <p>${esc(m.summary || "")}</p>
    <ul>
      <li>Size weight ${esc(weights.size)} · 6-month TVL growth ${esc(weights.tvlGrowth)} · fees/revenue momentum ${esc(weights.feesMomentum)} · volume momentum ${esc(weights.volumeMomentum)}</li>
      <li>Mention bonus: ${esc(m.mentionBonus || "")}</li>
      <li>TVL floor $${Number(m.floors && m.floors.minTvlUsd ? m.floors.minTvlUsd : 0).toLocaleString("en-US")}. Log baseline floor $${Number(m.floors && m.floors.tvlLogFloorUsd ? m.floors.tvlLogFloorUsd : 0).toLocaleString("en-US")}.</li>
    </ul>`;
}

function renderTable() {
  const meta = (state.data.categories || []).find(cat => cat.id === state.tab);
  const note = $("tab-note");
  if (state.tab !== "overall" && meta && meta.note) {
    note.hidden = false;
    note.textContent = meta.note;
  } else {
    note.hidden = true;
    note.textContent = "";
  }
  const rows = visibleRows();
  $("status").textContent = rows.length ? "" : "No protocols match.";
  $("rows").innerHTML = rows
    .map(row => {
      const link = row.llamaUrl
        ? `<a class="llama" href="${esc(row.llamaUrl)}" target="_blank" rel="noreferrer">DefiLlama</a>`
        : "";
      return `<tr>
        <td data-label="#">${esc(row.rank ?? "—")}</td>
        <td data-label="Protocol"><span class="name">${esc(row.name)}</span><span class="slug">${esc(row.slug)} ${link}</span></td>
        <td class="col-cat" data-label="Category">${esc(labelFor(row.category))}</td>
        <td class="num" data-label="TVL">${money(row.tvl)}</td>
        <td class="num" data-label="6-month TVL">${changeCell(row)}</td>
        <td class="num" data-label="30d fees">${money(row.fees30d)}</td>
        <td class="num" data-label="X">${mentionBadge(row.xMentions)}</td>
        <td data-label="Monitor">${coverageBadge(row)}</td>
        <td class="scripts" data-label="Scripts">${scriptsCell(row.scripts)}</td>
      </tr>`;
    })
    .join("");
  document.querySelectorAll("#board th").forEach(th => {
    const key = th.getAttribute("data-sort");
    if (!key) return;
    th.setAttribute("aria-sort", key === state.sortKey ? (state.sortDir > 0 ? "ascending" : "descending") : "none");
  });
}

function generatedLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Generated ${iso}`;
  return `Generated ${date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} UTC snapshot ${iso.slice(0, 16).replace("T", " ")}`;
}

function bind() {
  $("tabs").addEventListener("click", event => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    state.tab = button.getAttribute("data-tab");
    state.sortKey = "rank";
    state.sortDir = 1;
    renderTabs();
    renderTable();
  });
  $("search").addEventListener("input", event => {
    state.query = event.target.value;
    renderTable();
  });
  document.querySelector("#board thead").addEventListener("click", event => {
    const th = event.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.getAttribute("data-sort");
    if (state.sortKey === key) state.sortDir *= -1;
    else {
      state.sortKey = key;
      state.sortDir = key === "name" || key === "category" || key === "coverage" ? 1 : -1;
      if (key === "rank") state.sortDir = 1;
    }
    renderTable();
  });
}

async function init() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (err) {
    $("lede").textContent =
      `Could not load data.json (${err.message}). Run npm run showcase:build, then npm run showcase:serve.`;
    return;
  }
  const stats = state.data.stats || {};
  $("lede").textContent =
    `The top ${stats.overall || 200} protocols by a six-month score. Size and TVL growth lead; fees, volume and a small X-mention bonus break ties.`;
  $("generated").textContent = generatedLabel(state.data.generatedAt);
  renderStats();
  renderMethod();
  renderTabs();
  renderTable();
  bind();
}

init();
