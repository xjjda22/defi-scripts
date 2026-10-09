/**
 * Static server for showcase/. No extra dependencies.
 *
 *   npm run showcase:serve
 *   PORT=4173 npm run showcase:serve
 *   HOST=0.0.0.0 npm run showcase:serve   # reachable from other machines
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "showcase");
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function send(res, status, body, type, head) {
  res.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(head ? undefined : body);
}

const server = http.createServer((req, res) => {
  const head = req.method === "HEAD";
  if (req.method !== "GET" && !head) {
    send(res, 405, "Method not allowed");
    return;
  }
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  } catch {
    send(res, 400, "Bad request");
    return;
  }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, `.${rel}`);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      send(res, 404, "Not found", null, head);
      return;
    }
    send(res, 200, data, TYPES[path.extname(file)] || "application/octet-stream", head);
  });
});

server.on("error", err => {
  console.error(`showcase:serve failed: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`showcase http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
});
