/* =========================================================
   Off Watch Wellness — zero-dependency dev/self-host server
   Serves the static landing page and persists waitlist
   signups to data/waitlist.json. No npm install required.

   Run:  node server.js   (then open http://localhost:3000)
   ========================================================= */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "waitlist.json");

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
  ".woff2": "font/woff2"
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- storage helpers ---------- */
function readList() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (_) {
    return [];
  }
}

function saveEntry(entry) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const list = readList();
  const exists = list.some(function (e) {
    return e.email && e.email.toLowerCase() === entry.email.toLowerCase();
  });
  if (exists) return { duplicate: true, count: list.length };
  list.push(entry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
  return { duplicate: false, count: list.length };
}

/* ---------- request handlers ---------- */
function handleWaitlist(req, res) {
  let body = "";
  let tooBig = false;
  req.on("data", function (chunk) {
    body += chunk;
    if (body.length > 10000) { tooBig = true; req.destroy(); }
  });
  req.on("end", function () {
    if (tooBig) return sendJson(res, 413, { error: "Payload too large" });

    let data;
    try { data = JSON.parse(body || "{}"); }
    catch (_) { return sendJson(res, 400, { error: "Invalid JSON" }); }

    // Honeypot — silently accept without storing.
    if (data.company && String(data.company).trim() !== "") {
      return sendJson(res, 200, { ok: true });
    }

    const email = String(data.email || "").trim();
    if (!EMAIL_RE.test(email)) {
      return sendJson(res, 400, { error: "A valid email is required" });
    }
    if (!data.consent) {
      return sendJson(res, 400, { error: "Consent is required" });
    }

    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString("hex"),
      name: String(data.name || "").slice(0, 120),
      email: email.slice(0, 200),
      role: String(data.role || "").slice(0, 80),
      province: String(data.province || "").slice(0, 80),
      consent: true,
      source: String(data.source || "").slice(0, 40),
      submittedAt: new Date().toISOString(),
      ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim()
    };

    let result;
    try { result = saveEntry(entry); }
    catch (err) {
      console.error("Failed to save waitlist entry:", err);
      return sendJson(res, 500, { error: "Could not save signup" });
    }

    if (result.duplicate) {
      console.log("Waitlist (duplicate):", email);
      return sendJson(res, 409, { ok: true, message: "Already on the list" });
    }
    console.log("Waitlist signup #" + result.count + ":", email, entry.role || "");
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

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  // Prevent path traversal.
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  // Never serve the data directory.
  if (filePath.startsWith(DATA_DIR)) {
    res.writeHead(404); return res.end("Not found");
  }

  fs.readFile(filePath, function (err, content) {
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
const server = http.createServer(function (req, res) {
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

server.listen(PORT, function () {
  console.log("Off Watch Wellness running at http://localhost:" + PORT);
  console.log("Waitlist signups are stored in " + path.relative(ROOT, DATA_FILE));
});
