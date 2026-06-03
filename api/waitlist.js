/* =========================================================
   Off Watch Wellness — serverless waitlist endpoint
   Works on Vercel (and similar) as /api/waitlist.

   IMPORTANT: serverless filesystems are ephemeral/read-only,
   so signups can't be persisted to a file here the way the
   local `server.js` does. Wire up ONE of the integrations
   marked TODO below before going to production, otherwise
   signups are only logged (and lost on cold start).
   ========================================================= */
"use strict";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Vercel parses JSON bodies automatically; fall back to manual parse otherwise.
  let data = req.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data || "{}"); } catch (_) { data = {}; }
  }
  data = data || {};

  // Honeypot — silently accept.
  if (data.company && String(data.company).trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  const email = String(data.email || "").trim();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (!data.consent) {
    return res.status(400).json({ error: "Consent is required" });
  }

  const entry = {
    name: String(data.name || "").slice(0, 120),
    email: email.slice(0, 200),
    role: String(data.role || "").slice(0, 80),
    province: String(data.province || "").slice(0, 80),
    source: String(data.source || "").slice(0, 40),
    submittedAt: new Date().toISOString()
  };

  try {
    await persist(entry);
  } catch (err) {
    console.error("Failed to persist waitlist entry:", err);
    return res.status(500).json({ error: "Could not save signup" });
  }

  return res.status(201).json({ ok: true, message: "Added to waitlist" });
};

/**
 * Persist a waitlist entry. Replace the body with a real integration.
 *
 * TODO — pick one before launch:
 *
 *  1) Email notification (Resend):
 *       const { Resend } = require("resend");
 *       const resend = new Resend(process.env.RESEND_API_KEY);
 *       await resend.emails.send({
 *         from: "waitlist@offwatchwellness.ca",
 *         to: "hello@offwatchwellness.ca",
 *         subject: `Waitlist: ${entry.email}`,
 *         text: JSON.stringify(entry, null, 2)
 *       });
 *
 *  2) Database (Supabase):
 *       const { createClient } = require("@supabase/supabase-js");
 *       const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
 *       const { error } = await db.from("waitlist").insert(entry);
 *       if (error) throw error;
 *
 *  3) Google Sheet / Airtable / your CRM via their API.
 */
async function persist(entry) {
  // Default: log only. Visible in your hosting provider's function logs.
  console.log("WAITLIST_SIGNUP", JSON.stringify(entry));
}
