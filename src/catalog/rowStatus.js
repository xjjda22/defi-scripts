/**
 * Per-row protocol state badge: paused | closing | exploited | shut-down | deprecated.
 * Sources, in order: data/row-status.json (health + claims), fork pause pre-checks
 * (forkStatus.PAUSED, kind "closing" or "paused"), DefiLlama deprecated flag.
 * Scores are never changed by a status.
 */
const fs = require("fs");
const path = require("path");
const { PAUSED } = require("./forkStatus");

const FILE = path.join(__dirname, "..", "..", "data", "row-status.json");
const ORDER = ["exploited", "shut-down", "closing", "paused", "deprecated"];

function loadCurated() {
  try {
    return (JSON.parse(fs.readFileSync(FILE, "utf8")).statuses || []).filter(item => !item.resolved);
  } catch {
    return [];
  }
}

function keysOf(row) {
  const keys = [row.id, row.slug, ...(row.members || []).map(m => m.slug)];
  return keys.filter(Boolean).map(key => String(key).toLowerCase());
}

function statusesFor(row, curated) {
  const out = [];
  const keys = new Set(keysOf(row));
  for (const item of curated) {
    if ((item.rowIds || []).some(id => keys.has(String(id).toLowerCase()))) {
      out.push({ status: item.status, since: item.since || null, reason: item.reason, source: item.source || "data/row-status.json" });
    }
  }
  for (const t of (row.testing && row.testing.tests) || []) {
    const paused = PAUSED[t.script];
    if (paused) out.push({ status: paused.kind || "paused", since: paused.since, reason: paused.reason, source: `fork pre-check ${t.script}` });
  }
  if (row.llamaFlags && row.llamaFlags.deprecated) {
    out.push({ status: "deprecated", since: null, reason: "DefiLlama marks this protocol deprecated.", source: "DefiLlama /protocols" });
  }
  const seen = new Set();
  return out
    .filter(item => (seen.has(item.status) ? false : seen.add(item.status)))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

function applyRowStatus(data) {
  const curated = loadCurated();
  const visit = row => {
    const list = statusesFor(row, curated);
    row.protocolStatus = list.length ? list[0].status : null;
    row.protocolStatuses = list;
  };
  for (const row of data.overall || []) visit(row);
  for (const list of Object.values(data.byCategory || {})) for (const row of list) visit(row);
  const counts = {};
  for (const row of data.overall || []) if (row.protocolStatus) counts[row.protocolStatus] = (counts[row.protocolStatus] || 0) + 1;
  data.stats = data.stats || {};
  data.stats.protocolStatus = counts;
  return data;
}

module.exports = { applyRowStatus, statusesFor, ORDER };
