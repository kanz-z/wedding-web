# Reza & Ashila Wedding Invitation — Developer Documentation

> Serverless wedding invitation website with guest RSVP, admin dashboard, QR check-in, and guestbook.  
> Vanilla HTML/CSS/JS + Supabase. vercel-hosted, zero build step.

**Live:** [wedding-web-reza-shila-2026.vercel.app](https://wedding-web-reza-shila-2026.vercel.app/)

---

## Architecture

```
┌───────────────────────────────────────────────────┐
│  vercel (CDN)                                    │
│  ┌─────────────┐  ┌──────────────────┐            │
│  │ index.html   │  │ dashboard.html   │            │
│  │ (public)     │  │ (admin, noindex) │            │
│  └──────┬──────┘  └───────┬──────────┘            │
└─────────┼─────────────────┼───────────────────────┘
          │                 │
          ▼                 ▼
┌──────────────────────────────────────────────────┐
│  Supabase                                        │
│  ┌─────────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ PostgreSQL  │ │ Auth     │ │ Edge Function │ │
│  │ + RLS       │ │ email/pw │ │ rate-limit    │ │
│  └─────────────┘ └──────────┘ └───────────────┘ │
└──────────────────────────────────────────────────┘
```

**Key decisions:**

- Zero build step — all dependencies loaded via CDN, all JS is vanilla global scope
- Supabase as the sole backend — database, auth, and rate-limiting via Edge Function
- No authentication for guests — guestbook and RSVP use anon key restricted by RLS
- Admin auth via Supabase email/password + `admin_users` table check
- **All credentials hardcoded** in `js/config.js` — no env vars, no `.env`

---

## Code Organization

| Directory             | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `index.html`          | Public invitation page. Params: `?n=<slug>&p=<pronoun>`                    |
| `dashboard.html`      | Admin panel shell (side-nav + tab panels + modals)                         |
| `js/main/`            | Public page JS (8 modular files)                                           |
| `js/dashboard/`       | Admin panel JS (11 modular files — load order in `dashboard.html` matters) |
| `js/card-utils.js`    | Shared card rendering (used by both public and admin pages)                |
| `js/config.js`        | Hardcoded Supabase URL, anon key, site URL, Edge Function URL              |
| `css/main/`           | Public page styles (dark theme)                                            |
| `css/dashboard/`      | Admin dashboard styles                                                     |
| `css/card.css`        | Digital invitation card template styles                                    |
| `supabase/functions/` | Deno Edge Function: `rate-limit-rsvp`                                      |
| `assets/`             | Images and audio (auto-plays when guest unlocks page)                      |
| `countdown/`          | Self-hosted simplyCountdown library                                        |

---

## Data Flow

### Guest RSVP

```
Guest opens URL with ?n=<slug>&p=<pronoun>
  → Hero personalized, scroll locked until "Lihat Undangan" click
  → Guest fills RSVP form (name, attendees, status, WA, message)
  → Form POSTs to Supabase Edge Function (rate-limited: 5/IP/10min)
  → Edge Function inserts into rsvps table (service_role)
  → Response determines digital card behavior:
      - jumlah_hadir ≤ 2 → auto-approved → renders & downloads card (PNG via html2canvas)
      - jumlah_hadir > 2 → is_approved = false → "Menunggu persetujuan admin"
```

### Guestbook

```
Guest submits guestbook form
  → Client-side profanity check (18 Indonesian words)
  → INSERT into guestbook (RLS enforces max 500 chars)
  → Admin approves in dashboard → visible to public
```

### Admin Auth

```
Admin visits /dashboard.html
  → Checks existing Supabase session
  → If session active: verify user in admin_users table via RPC
  → If no session: show login form → signInWithPassword → verify admin_users
```

---

## Database

Five tables, managed via Supabase PostgreSQL. RLS is enabled on all tables. Migrations were applied sequentially — see Supabase SQL Editor for current schema.

| Table            | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `guests`         | Pre-registered guest list with invitation slugs                  |
| `rsvps`          | RSVP submissions — the core workflow table, linked to guests     |
| `guestbook`      | Public messages requiring admin approval                         |
| `guest_checkins` | Event day check-in log (QR or manual)                            |
| `admin_users`    | Admin accounts — must be inserted manually, no self-registration |

**Key relationships:** `rsvps.guest_id` → `guests.id` (one-to-one). `guest_checkins.rsvp_id` → `rsvps.id` (one-to-one).

---

## Security (RLS)

Two roles: `anon` (public guests) and `authenticated` (logged-in admins).

- **Guests**: Cannot read `guests`, `rsvps`, or `admin_users`. Can INSERT into `rsvps` only via Edge Function (service_role). Can INSERT/SELECT (approved only) guestbook.
- **Admins**: Full CRUD on `guests`, `rsvps`, `guestbook`. Can INSERT/SELECT `guest_checkins`. Self-manage `admin_users`.
- **Edge Functions**: Use `service_role` — bypass all RLS.

Key PostgreSQL functions used by the app: `is_admin_user()`, `is_super_admin()`, `get_guest_by_slug(text)`, `process_checkin()`.

---

## Admin Dashboard

Six tabs accessed via side navigation:

| Tab          | Purpose                                                           |
| ------------ | ----------------------------------------------------------------- |
| Overview     | Metrics (total, hadir, absen, ucapan), pie chart, activity feed   |
| Tamu & RSVP  | Guest-RSVP merged table, filters, CRUD, approval queue, batch ops |
| Guestbook    | Approve/unapprove messages, filter by status                      |
| QR Scanner   | Camera-based QR check-in + manual name search check-in            |
| Pesan Privat | Private messages from RSVP form                                   |
| Admin        | Admin user list (read-only — manage via Supabase Dashboard)       |

**Batch features:** Select guests → download digital cards (PDF or individual PNG) or batch delete (cascades through checkins → rsvps → guests).

**Import:** Paste CSV-like text or upload CSV file to bulk-create guests and RSVPs.

---

## QR Check-in

1. Admin starts camera scanner → decodes QR from guest's digital card
2. QR content is a UUID token (`rsvps.qr_token`) or a URL containing it
3. Token looked up in `rsvps` → validates guest existence and checks-in status
4. On success: inserts into `guest_checkins` + updates `rsvps.checked_in = true`
5. Scanner stops after each scan (prevents double-scans)

**Known:** The two-write pattern (INSERT checkin + UPDATE rsvp) has a race condition. A `process_checkin` RPC exists in the DB for atomic execution but is not yet adopted by the frontend.

---

## Setup

```bash
# No build step. Serve statically:
python -m http.server 8080
# or: npx serve .

# Tests (DOM-presence only, no Supabase mocks):
npm install
npx playwright install chromium
npx playwright test js/qualityAssurance.spec.js
```

**Prerequisites:** A Supabase project with the schema applied, at least one admin user created manually in Supabase Auth + `admin_users` table, and the `rate-limit-rsvp` Edge Function deployed.

**Credentials:** Update `js/config.js` with your own Supabase URL, anon key, and Edge Function URL when forking.

---

## Deployment

```bash
git push origin main
```

### 1. Link local directory to a Vercel project

```
vercel link
```

### 2. Pull environment variables for local development

```
vercel env pull .env.local
```

### 3. Develop locally (use your framework's dev command, or vercel dev)

vercel env run -- npm run dev

### 4. Deploy a preview

vercel deploy

### 5. Verify the preview

```
vercel curl / --deployment <preview-url>
vercel logs --deployment <preview-deployment-id> --level error
```

### 6. Deploy to production

```
vercel deploy --prod
```

### 7. Add a custom domain (if needed; one arg when run from the linked project)

```
vercel domains add example.com
vercel domains inspect example.com
```

### 8. Confirm production is live

```
vercel curl / --deployment <production-url>
vercel logs --environment production --level error --since 5m
```

No build step, no environment variables to configure on vercel. Supabase credentials in `js/config.js` are the only thing to update when forking.

---

## License

MIT. Based on a template by [elix-stack](https://github.com/elix-stack).
