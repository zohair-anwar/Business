/* =========================================================
   Off Watch Wellness — zero-dependency dev/self-host server
   Serves the static landing page and captures waitlist
   signups. Always stores to data/waitlist.json locally, and
   ALSO forwards to any configured remote providers (Supabase
   / Resend) via lib/waitlist.js. No npm install required.

   Run:  node server.js   (then open http://localhost:3000)
   ========================================================= */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const wl = require("./lib/waitlist");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "waitlist.json");
const NO_FILE = process.env.DISABLE_FILE_STORE === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2"
};

/* ---------- local file storage ---------- */
function readList() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (_) { return []; }
}

function saveToFile(entry) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const list = readList();
  const exists = list.some(e => e.email && e.email.toLowerCase() === entry.email.toLowerCase());
  if (exists) return { duplicate: true, count: list.length };
  list.push(entry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
  return { duplicate: false, count: list.length };
}

/* ---------- /api/waitlist ---------- */
function handleWaitlist(req, res) {
  let body = "";
  let tooBig = false;
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 10000) { tooBig = true; req.destroy(); }
  });
  req.on("end", async () => {
    if (tooBig) return sendJson(res, 413, { error: "Payload too large" });

    let data;
    try { data = JSON.parse(body || "{}"); }
    catch (_) { return sendJson(res, 400, { error: "Invalid JSON" }); }

    const v = wl.validate(data);
    if (!v.ok) {
      if (v.drop) return sendJson(res, 200, { ok: true }); // honeypot
      return sendJson(res, 400, { error: v.error });
    }

    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
      .split(",")[0].trim();
    const entry = wl.buildEntry(data, { ip });

    let duplicate = false;
    try {
      if (!NO_FILE) {
        const fileResult = saveToFile(entry);
        duplicate = duplicate || fileResult.duplicate;
        console.log(
          (fileResult.duplicate ? "Waitlist (duplicate): " : "Waitlist signup #" + fileResult.count + ": ") +
          entry.email + " " + (entry.role || "")
        );
      }
      if (wl.remoteConfigured()) {
        const remote = await wl.persistRemote(entry);
        duplicate = duplicate || remote.duplicate;
      }
    } catch (err) {
      console.error("Failed to save waitlist entry:", err.message);
      return sendJson(res, 500, { error: "Could not save signup" });
    }

    if (duplicate) return sendJson(res, 409, { ok: true, message: "Already on the list" });
    return sendJson(res, 201, { ok: true, message: "Added to waitlist" });
  });
}

function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

/* ---------- static files ---------- */
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  if (filePath.startsWith(DATA_DIR)) { res.writeHead(404); return res.end("Not found"); }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<h1>404 — Not found</h1>");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

/* ---------- server ---------- */
const server = http.createServer((req, res) => {
  if (req.url.split("?")[0] === "/api/waitlist") {
    if (req.method === "POST") return handleWaitlist(req, res);
    res.writeHead(405, { Allow: "POST" });
    return res.end("Method Not Allowed");
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405); return res.end("Method Not Allowed");
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log("Off Watch Wellness running at http://localhost:" + PORT);
  console.log(
    wl.remoteConfigured()
      ? "Remote persistence: ENABLED"
      : "Remote persistence: off (storing to " + path.relative(ROOT, DATA_FILE) + ")"
  );
});
