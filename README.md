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
| `server.js` | Zero-dependency server: serves the site, stores signups to `data/waitlist.json`, forwards to any configured providers |
| `api/waitlist.js` | Serverless endpoint deployed by Vercel as `/api/waitlist` |
| `lib/waitlist.js` | Shared validation + persistence (Supabase / Resend via `fetch`, no deps) |
| `vercel.json` | Vercel config (clean URLs, security headers, asset caching) |
| `site.webmanifest` | PWA manifest |
| `db/supabase-schema.sql` | Table definition for the Supabase signup store |
| `tools/gen-icons.js` | Regenerates the favicons / app icons / social image |
| `assets/` | Generated icons, social image, and the SVG logo |
| `data/` | Where signups are stored locally (contents gitignored) |

---

## Real persistence (Supabase + Resend)

Signup storage is handled by `lib/waitlist.js` using plain `fetch()` against
provider REST APIs — **no npm packages**. Each integration turns on only when its
environment variables are set; with none set, signups are just logged (and the
local `server.js` still writes `data/waitlist.json`).

**Store signups in Supabase**

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`db/supabase-schema.sql`](db/supabase-schema.sql)
   (creates a `waitlist` table with a unique `email`, so duplicates return `409`).
3. From **Settings → API**, copy the project URL and the **service role** key into
   `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (server-side only — never ship the
   service key to the browser).

**Get emailed on each signup with Resend**

1. Create an API key at [resend.com](https://resend.com) → `RESEND_API_KEY`.
2. Set `WAITLIST_TO` (comma-separated allowed). Once your domain is verified in
   Resend, set `WAITLIST_FROM` to an address on it; otherwise leave it unset.

See [`.env.example`](.env.example) for the full list. Test locally with:

```bash
cp .env.example .env   # fill in values
node --env-file=.env server.js
```

---

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this on a branch).
2. At [vercel.com/new](https://vercel.com/new), **Import** the repo. No framework,
   build command, or output directory needed — `vercel.json` handles routing, and
   `api/waitlist.js` automatically becomes the `/api/waitlist` function.
3. In **Settings → Environment Variables**, add the Supabase/Resend values above
   (Production + Preview), then **Deploy**.

Or from the CLI:

```bash
npm i -g vercel
vercel            # preview deploy
vercel --prod     # production deploy
```

### Connecting your domain

Once you've registered the domain (see below), in the Vercel project go to
**Settings → Domains**, add `offwatchwellness.ca` (and `www`), and Vercel will show
the exact DNS records to enter at your registrar — typically:

- An **A** record `@ → 76.76.21.21`, or a `CNAME @ → cname.vercel-dns.com`
- A **CNAME** `www → cname.vercel-dns.com`

Vercel issues the HTTPS certificate automatically. After the domain is live,
update the three `og:url` / `og:image` / `twitter:image` URLs in `index.html` if
your final domain differs from `offwatchwellness.ca`.

### Alternatives

- **Netlify Forms:** add `data-netlify="true"` + a hidden `form-name` field to the
  `<form>` and Netlify captures submissions with no backend.
- **Self-host:** run `node server.js` behind nginx/Caddy on any VPS; signups
  persist to `data/waitlist.json` (back it up) and/or your configured providers.

---

## Customizing

- **Brand name / copy:** edit `index.html`. The name "Off Watch Wellness" and the
  tagline appear in the header, hero, waitlist, footer, and `<title>`/meta tags.
- **Colours & type:** the theme lives in CSS custom properties at the top of
  `styles.css` (`--ink`, `--accent`, fonts, etc.).
- **Form fields:** add/remove fields in the `<form id="waitlist-form">` block;
  the server stores any of the known fields and ignores the rest.
- **Logo / icons:** the mark is defined once in `tools/gen-icons.js` and as inline
  SVG in `index.html` / `favicon.svg`. After changing it, run `node tools/gen-icons.js`
  to regenerate all PNG sizes and the social image.

---

## Securing the domain

`offwatchwellness.ca` is referenced throughout as the intended domain. Registering
it requires a registrar account and payment, so it isn't checked in here — buy it,
then point it at Vercel using the steps above. Suggestions:

- **`.ca`** suits the Canadian focus (a CIRA-accredited registrar such as
  [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) — at-cost —
  or Namecheap/Hover). A `.ca` requires a Canadian presence, which a Canadian
  business satisfies.
- Grab the matching **`.com`** and redirect it to the `.ca` to protect the brand.
- Check availability and complete purchase at your registrar; everything in this
  repo is already wired to that hostname.

## Important note on scope

This is a **marketing landing page and waitlist**, not a clinical or crisis
platform. The site states clearly that it is not an emergency service and points
visitors in crisis to **988** (Suicide Crisis Helpline) and **911**. Keep that
messaging in place. Before collecting personal information at scale, review
Canadian privacy obligations (PIPEDA and any applicable provincial legislation)
and, once counselling begins, the relevant provincial regulatory college
requirements for the clinicians involved.
