/* =========================================================
   Off Watch Wellness — serverless waitlist endpoint
   Deployed by Vercel as /api/waitlist.

   Persistence is handled by ../lib/waitlist.js using plain
   fetch() against Supabase / Resend (no dependencies). It
   turns on automatically when the relevant env vars are set:

     SUPABASE_URL, SUPABASE_SERVICE_KEY   (store signups)
     RESEND_API_KEY, WAITLIST_TO          (email notification)

   Until you configure at least one, signups are only logged
   to the function logs. See README + .env.example.
   ========================================================= */
"use strict";

const wl = require("../lib/waitlist");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let data = req.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data || "{}"); } catch (_) { data = {}; }
  }
  data = data || {};

  const v = wl.validate(data);
  if (!v.ok) {
    if (v.drop) return res.status(200).json({ ok: true }); // honeypot
    return res.status(400).json({ error: v.error });
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const entry = wl.buildEntry(data, { ip });

  let result;
  try {
    result = await wl.persistRemote(entry);
  } catch (err) {
    console.error("Failed to persist waitlist entry:", err.message);
    return res.status(500).json({ error: "Could not save signup" });
  }

  if (result.duplicate) return res.status(409).json({ ok: true, message: "Already on the list" });
  return res.status(201).json({ ok: true, message: "Added to waitlist" });
};
