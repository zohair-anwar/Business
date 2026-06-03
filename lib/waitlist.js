/* =========================================================
   Off Watch Wellness — shared waitlist logic
   Validation, entry building, and remote persistence.

   Remote persistence uses plain fetch() against provider
   REST APIs, so there are NO npm dependencies. Each
   integration turns on only when its env vars are present:

     Supabase (storage):  SUPABASE_URL, SUPABASE_SERVICE_KEY
     Resend   (notify):   RESEND_API_KEY, WAITLIST_TO[, WAITLIST_FROM]

   When nothing is configured, persistRemote() is a no-op
   (the local server.js still stores to data/waitlist.json).
   ========================================================= */
"use strict";

const crypto = require("crypto");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(data) {
  data = data || {};
  // Honeypot: pretend success, signal "drop".
  if (data.company && String(data.company).trim() !== "") {
    return { ok: false, drop: true };
  }
  const email = String(data.email || "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "A valid email is required" };
  if (!data.consent) return { ok: false, error: "Consent is required" };
  return { ok: true };
}

function buildEntry(data, meta) {
  meta = meta || {};
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString("hex"),
    name: String(data.name || "").slice(0, 120),
    email: String(data.email || "").trim().slice(0, 200),
    role: String(data.role || "").slice(0, 80),
    province: String(data.province || "").slice(0, 80),
    consent: true,
    source: String(data.source || "landing").slice(0, 40),
    submittedAt: new Date().toISOString(),
    ip: String(meta.ip || "").slice(0, 60)
  };
}

const hasSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const hasResend = () => !!(process.env.RESEND_API_KEY && process.env.WAITLIST_TO);

function remoteConfigured() {
  return hasSupabase() || hasResend();
}

async function saveToSupabase(entry) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/waitlist";
  const key = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      name: entry.name,
      email: entry.email,
      role: entry.role,
      province: entry.province,
      consent: entry.consent,
      source: entry.source,
      submitted_at: entry.submittedAt
    })
  });

  if (res.ok) return { duplicate: false };

  // Unique-violation on email → already on the list.
  let body = "";
  try { body = await res.text(); } catch (_) {}
  if (res.status === 409 || body.indexOf("23505") !== -1 || /duplicate key/i.test(body)) {
    return { duplicate: true };
  }
  throw new Error("Supabase insert failed (" + res.status + "): " + body.slice(0, 300));
}

async function notifyViaResend(entry) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.WAITLIST_FROM || "Off Watch Wellness <onboarding@resend.dev>",
      to: String(process.env.WAITLIST_TO).split(",").map(s => s.trim()),
      subject: "New waitlist signup: " + entry.email,
      text:
        "New Off Watch Wellness waitlist signup\n\n" +
        "Email:    " + entry.email + "\n" +
        "Name:     " + (entry.name || "—") + "\n" +
        "Role:     " + (entry.role || "—") + "\n" +
        "Province: " + (entry.province || "—") + "\n" +
        "Source:   " + entry.source + "\n" +
        "Time:     " + entry.submittedAt + "\n"
    })
  });
  if (!res.ok) {
    let body = ""; try { body = await res.text(); } catch (_) {}
    throw new Error("Resend send failed (" + res.status + "): " + body.slice(0, 300));
  }
}

/**
 * Persist to configured remote providers.
 * Returns { stored, duplicate, notified }. Throws on hard failure
 * so the caller can return a 500.
 */
async function persistRemote(entry) {
  const result = { stored: "none", duplicate: false, notified: false };

  if (hasSupabase()) {
    const r = await saveToSupabase(entry);
    result.stored = "supabase";
    result.duplicate = r.duplicate;
  }

  // Only notify for genuinely new signups (avoid duplicate emails).
  if (hasResend() && !result.duplicate) {
    try {
      await notifyViaResend(entry);
      result.notified = true;
    } catch (err) {
      // A failed notification shouldn't lose the signup if it was stored.
      console.error("Resend notification failed:", err.message);
      if (result.stored === "none") throw err;
    }
  }

  if (result.stored === "none" && !result.notified) {
    // Nothing configured — log so signups aren't silently lost pre-launch.
    console.log("WAITLIST_SIGNUP", JSON.stringify(entry));
  }
  return result;
}

module.exports = {
  EMAIL_RE,
  validate,
  buildEntry,
  remoteConfigured,
  persistRemote
};
