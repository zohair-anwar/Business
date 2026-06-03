# Off Watch Wellness

Landing page and waitlist for **Off Watch Wellness** — confidential, specialized
counselling for Canada's police, RCMP, and first responders.

> *"When you're off watch, who looks after you?"*

The site is intentionally dependency-free: hand-written HTML, CSS, and a small
amount of vanilla JavaScript, plus a zero-dependency Node server that serves the
page and captures waitlist signups. No build step, no `npm install`.

---

## Run it locally

```bash
node server.js
# → http://localhost:3000
```

Waitlist signups are written to `data/waitlist.json` (gitignored — it contains
personal data). To inspect signups:

```bash
cat data/waitlist.json
```

Change the port with `PORT=8080 node server.js`.

---

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | The full single-page landing site |
| `styles.css` | All styling (calm slate + steady teal theme) |
| `script.js` | Waitlist form validation + submission + success state |
| `server.js` | Zero-dependency server: serves the site, stores signups to `data/waitlist.json` |
| `api/waitlist.js` | Serverless endpoint for Vercel-style hosting (see deploy notes) |
| `data/` | Where signups are stored locally (contents gitignored) |

---

## Deploying

### Option A — Vercel (recommended for a quick public launch)

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com). No framework / build command needed.
3. The static files are served as-is and `api/waitlist.js` becomes `/api/waitlist`.
4. **Wire up persistence.** Serverless filesystems are ephemeral, so `api/waitlist.js`
   only *logs* signups by default. Before launch, open it and enable one of the
   `TODO` integrations (Resend email, Supabase, Airtable, etc.) and set the
   matching environment variables.

### Option B — Netlify Forms (no backend code)

Add `data-netlify="true"` and a hidden `form-name` field to the `<form>` in
`index.html`, and Netlify captures submissions automatically — no `api/` or
`server.js` needed.

### Option C — Self-host with `server.js`

Run `node server.js` behind a reverse proxy (nginx/Caddy) on any VPS. Signups
persist to `data/waitlist.json` on disk. Back that file up.

---

## Customizing

- **Brand name / copy:** edit `index.html`. The name "Off Watch Wellness" and the
  tagline appear in the header, hero, waitlist, footer, and `<title>`/meta tags.
- **Colours & type:** the theme lives in CSS custom properties at the top of
  `styles.css` (`--ink`, `--accent`, fonts, etc.).
- **Form fields:** add/remove fields in the `<form id="waitlist-form">` block;
  the server stores any of the known fields and ignores the rest.

---

## Important note on scope

This is a **marketing landing page and waitlist**, not a clinical or crisis
platform. The site states clearly that it is not an emergency service and points
visitors in crisis to **988** (Suicide Crisis Helpline) and **911**. Keep that
messaging in place. Before collecting personal information at scale, review
Canadian privacy obligations (PIPEDA and any applicable provincial legislation)
and, once counselling begins, the relevant provincial regulatory college
requirements for the clinicians involved.
