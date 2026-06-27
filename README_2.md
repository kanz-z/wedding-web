# Reza & Ashila Wedding Invitation — Developer Documentation

> A full-featured digital wedding invitation website with guest RSVP, admin dashboard, QR check-in, and guestbook. Built with vanilla HTML/CSS/JS and Supabase.

**Live site:** [https://wedding-web-reza-shila-2026.netlify.app/](https://wedding-web-reza-shila-2026.netlify.app/)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Security Model (RLS)](#security-model-rls)
- [Admin Dashboard](#admin-dashboard)
- [Guest Flow Details](#guest-flow-details)
- [QR Check-in System](#qr-check-in-system)
- [Setup for Local Development](#setup-for-local-development)
- [Setting Up Supabase from Scratch](#setting-up-supabase-from-scratch)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known Pitfalls](#known-pitfalls)
- [License](#license)

---

## Architecture Overview

The project follows a **serverless JAMstack** architecture:

```
┌─────────────────────────────────────────────────────┐
│                   Netlify (CDN)                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │  index.html   │  │ dashboard.html│                │
│  │  (Public)     │  │  (Admin)      │                │
│  └──────┬───────┘  └──────┬───────┘                  │
│         │                  │                          │
└─────────┼──────────────────┼──────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                   Supabase                           │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ PostgreSQL│  │   Auth   │  │ Edge Function     │  │
│  │ + RLS    │  │(email/pw)│  │ rate-limit-rsvp   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Key design decisions:

- **Zero build step** — vanilla HTML/CSS/JS, no bundler, no framework. All dependencies loaded via CDN.
- **Supabase as Backend-as-a-Service** — PostgreSQL database, Row Level Security, Auth, and Edge Functions.
- **Netlify hosting** — auto-deploys from `main` branch with zero configuration.
- **Edge Function for RSVP** — rate limiting and approval logic lives in a Supabase Edge Function, not in the client.
- **No authentication for guests** — guestbook and RSVP use anon Supabase keys restricted by RLS policies.

---

## Tech Stack

| Category         | Technology                              | Version     | Load Method                |
| ---------------- | --------------------------------------- | ----------- | -------------------------- |
| Frontend         | HTML5 + CSS3 + JavaScript               | —           | Vanilla (no build)         |
| CSS Framework    | Bootstrap                               | 5.3.5       | CDN (jsDelivr)             |
| CSS Animations   | AOS (Animate on Scroll)                 | 2.3.4       | CDN (jsDelivr)             |
| Icons            | Bootstrap Icons                         | 1.11.3      | CDN (jsDelivr)             |
| Fonts            | Google Fonts (Playfair Display + Inter) | —           | CDN (Google)               |
| Countdown        | simplyCountdown                         | Self-hosted | Local file at `countdown/` |
| QR Generation    | qrcodejs                                | 1.0.0       | CDN (jsDelivr)             |
| QR Scanning      | html5-qrcode                            | 2.3.8       | CDN (jsDelivr)             |
| Canvas Rendering | html2canvas                             | 1.4.1       | CDN (jsDelivr)             |
| Backend Database | Supabase PostgreSQL                     | —           | Cloud (Supabase)           |
| Auth             | Supabase Auth                           | —           | Email/password             |
| Rate Limiting    | Supabase Edge Function                  | —           | Deno runtime               |
| E2E Testing      | Playwright                              | 1.61.1      | npm package                |
| Hosting          | Netlify                                 | —           | Git-connected auto-deploy  |

---

## Project Structure

```
wedding-invitation-1/
├── index.html              # Public invitation page (~1377 lines)
├── dashboard.html          # Admin dashboard shell (~674 lines)
├── dashboard.js            # Admin dashboard logic (~1415 lines, IIFE)
├── style.css               # Public page styles (dark theme)
├── dashboard.css           # Admin dashboard styles
├── AGENTS.md               # Agent instruction file (gitignored, local only)
├── README.md               # Basic project overview
├── package.json            # npm deps (playwright, markdown-it)
├── .gitignore              # Git ignore rules
├── LICENSE                 # MIT License
│
├── assets/
│   ├── audio/YASTOAI.mp3   # Background music (auto-plays on "Lihat Undangan")
│   └── img/                # Images, SVGs, icons
│
├── countdown/
│   ├── simplyCountdown.umd.js  # Countdown library
│   ├── simplyCountdown.js      # Dev version
│   └── circle.css              # Countdown circle theme
│
│
├── qa/
│   └── wedding.spec.js        # Playwright E2E tests (274 tests)
```

---

## Data Flow

### Guest RSVP Flow

```
Guest opens URL
      │
      ▼
?n=<slug>&p=<pronoun> params parsed
      │
      ▼
Hero section personalized with guest name
RSVP form pre-filled with guest name
      │
      ▼
Guest fills RSVP form (nama, jumlah hadir, status, WA, pesan)
      │
      ▼
Form submit → fetch (POST) to Supabase Edge Function:
  https://liyfsapgadickknsfbus.functions.supabase.co/rate-limit-rsvp
      │
      ├── Edge Function checks rate limit (max 5/IP/10min)
      ├── Edge Function inserts into `rsvps` table (using service_role)
      └── Edge Function returns { is_approved, qr_token, ... }
      │
      ▼
Client checks response:
  ├── jika jumlah_hadir <= 2 AND is_approved = true →
  │     Render digital card (html2canvas) → auto-download PNG
  │
  └── jika jumlah_hadir > 2 → is_approved = false →
        "Menunggu persetujuan admin" message
```

### Guestbook Flow

```
Guest submits guestbook form
      │
      ▼
Client-side profanity check (KATA_KASAR array of 18 words)
      │
      ▼
supabase.from("guestbook").insert({ nama, pesan })
  (RLS ensures char_length(pesan) <= 500)
      │
      ▼
Admin approves/rejects in dashboard
  (guestbook is_approved = true → visible to public)
```

### Admin Auth Flow

```
User navigates to /dashboard.html
      │
      ▼
init() checks existing Supabase session
      │
      ├── session exists → sb.rpc("check_current_admin")
      │     ├── true → show dashboard
      │     └── false → sign out → show login
      │
      └── no session → show login form
              │
              ▼
User enters email/password
      │
      ▼
sb.auth.signInWithPassword({ email, password })
      │
      ▼
sb.rpc("check_current_admin") → verifies user is in admin_users table
      │
      ├── true → enter dashboard
      └── false → sign out, show error
```

---

## Database Schema

The database has 5 tables. All migrations are applied sequentially.

### Table: `guests`

Pre-registered guests who receive personalized invitation links.

| Column        | Type        | Notes                                           |
| ------------- | ----------- | ----------------------------------------------- |
| id            | uuid        | PK, gen_random_uuid()                           |
| slug          | text        | UNIQUE, used in URL (?n=slug)                   |
| name          | text        | Guest full name                                 |
| pronoun       | text        | Bpk/Ibu/Sdr/etc for hero display                |
| invited_count | int         | Default 1, must be > 0                          |
| side          | text        | 'pria' / 'wanita' / 'both' (added in migration) |
| nomor_wa      | text        | Phone number (added in migration)               |
| created_at    | timestamptz | Default now()                                   |

### Table: `rsvps`

Guest RSVP submissions. Core table for the entire workflow.

| Column       | Type        | Notes                                                 |
| ------------ | ----------- | ----------------------------------------------------- |
| id           | uuid        | PK, gen_random_uuid()                                 |
| guest_id     | uuid        | FK → guests.id, UNIQUE                                |
| nama         | text        | Guest name                                            |
| nomor_wa     | text        | Nullable (migration v3)                               |
| jumlah_hadir | int         | Must be > 0                                           |
| status       | text        | 'Hadir' or 'Tidak Hadir'                              |
| qr_token     | uuid        | UNIQUE, auto-generated for QR check-in (migration v2) |
| is_approved  | boolean     | Default true (migration v2)                           |
| checked_in   | boolean     | Default false (migration v2)                          |
| card_sent_at | timestamptz | When card was sent (migration v2)                     |
| pesan        | text        | Private message to couple                             |
| created_at   | timestamptz | Default now()                                         |

Constraints: `rsvps_nama_wa_unq` (nama, nomor_wa), `rsvps_nama_length_check` (nama <= 100 chars)

### Table: `guestbook`

Public messages from guests.

| Column      | Type        | Notes                                         |
| ----------- | ----------- | --------------------------------------------- |
| id          | uuid        | PK, gen_random_uuid()                         |
| rsvp_id     | uuid        | FK → rsvps.id (nullable)                      |
| nama        | text        | Guest name                                    |
| pesan       | text        | Message, max 500 chars                        |
| is_approved | boolean     | Default true, must be true to appear publicly |
| created_at  | timestamptz | Default now()                                 |

### Table: `guest_checkins`

Check-in log for event day QR scanning.

| Column             | Type        | Notes                          |
| ------------------ | ----------- | ------------------------------ |
| id                 | uuid        | PK, gen_random_uuid()          |
| rsvp_id            | uuid        | FK → rsvps.id, UNIQUE          |
| checked_in_at      | timestamptz | Default now()                  |
| checked_in_by      | uuid        | FK → admin_users.id (nullable) |
| method             | text        | 'qr' or 'manual'               |
| guest_count_actual | int         | Actual headcount at check-in   |

### Table: `admin_users`

Admin accounts. **Must be inserted manually** — no self-registration.

| Column     | Type        | Notes                                     |
| ---------- | ----------- | ----------------------------------------- |
| id         | uuid        | PK, FK → auth.users.id                    |
| email      | text        | Admin email                               |
| role       | text        | 'admin' (super) or 'organizer' (standard) |
| created_at | timestamptz | Default now()                             |

---

## Security Model (RLS)

Row Level Security is enforced on all tables. Two roles interact with the API:

- **`anon`** — unauthenticated public (guests browsing invitation)
- **`authenticated`** — logged-in admin users

| Table            | anon                                                   | authenticated (admin)                  |
| ---------------- | ------------------------------------------------------ | -------------------------------------- |
| `guests`         | ❌ No direct SELECT                                    | ✅ ALL via `is_admin_user()`           |
| `rsvps`          | ✅ INSERT via Edge Function only                       | ✅ SELECT/UPDATE/DELETE                |
| `guestbook`      | ✅ INSERT (char_length check) + SELECT (approved only) | ✅ SELECT/UPDATE/DELETE                |
| `guest_checkins` | ❌ No access                                           | ✅ INSERT/SELECT                       |
| `admin_users`    | ❌ No access                                           | ✅ Self SELECT/UPDATE, super-admin ALL |
| `rate_limits`    | ❌ No access                                           | ✅ service_role only (Edge Function)   |

Key helper functions:

- `is_admin_user()` — checks if current auth.uid() exists in admin_users (security definer)
- `is_super_admin()` — checks if current auth.uid() has role = 'admin' in admin_users
- `get_guest_by_slug(text)` — security definer function for guest lookup (prevents mass scraping)
- `process_checkin(uuid, uuid, text, int)` — atomic check-in RPC (migration v3)

---

## Admin Dashboard

The admin panel has **6 tabs** accessed via side navigation:

### 1. Dashboard (Overview)

- **Metrics cards**: Total undangan, Hadir, Tidak Hadir, Total Ucapan
- **Pie chart**: Visual breakdown of Hadir vs Tidak Hadir
- **Activity log**: Merged chronological feed of RSVPs and guestbook entries
- Pagination: 5 items per page, client-side

### 2. Tamu & RSVP

- **Approval queue**: Pending RSVPs (when jumlah_hadir > 2)
- **Data table**: All guests merged with RSVP data
- **Filters**: All, Hadir, Tidak Hadir, Belum, Pending, Baru (orphan), Pria, Wanita
- **Search**: Debounced client-side filter by name
- **Edit guest**: Modal with guest data + RSVP fields
- **Copy link**: Generates personalized invitation URL
- **Approve**: Sets is_approved = true and records card_sent_at

### 3. Guestbook

- Lists all guestbook entries
- **Filters**: Semua, Menunggu, Tampil
- **Toggle**: Show/hide entries (sets is_approved)
- Limit: 500 entries

### 4. QR Scanner

- Camera-based QR code scanning using html5-qrcode
- **On success**: Looks up qr_token in rsvps → inserts guest_checkins → updates checked_in
- **Manual check-in**: ILIKE search by name → button to check in
- **Check-in log**: Today's check-ins (last 20)
- Scanner stops after single scan (must restart manually)

### 5. Pesan Privat

- Shows private messages (pesan field) from RSVPs where pesan IS NOT NULL
- Limit: 200 entries

### 6. Admin

- Lists all admin users from admin_users table
- No CRUD UI — must manage via Supabase Dashboard

### Polling Behavior

- A `setInterval` polls every **30 seconds** for pending approvals
- If new pending items detected, shows a toast notification
- ⚠️ **Bug**: Interval is never cleared on logout — continues hitting Supabase

---

## Guest Flow Details

### Personalized Invitation Links

```
https://wedding-web-reza-shila-2026.netlify.app/?n=Nama+Tamu&p=Bpk
```

- `?n=` — Name slug (used for hero personalization + pre-filling RSVP form)
- `?p=` — Pronoun (Bpk/Ibu/Sdr/etc.)

### Hero Section Lock

- `disableScroll()` fires immediately on page load
- Sets `overflow: hidden` + `position: fixed` to prevent scrolling
- User must click "Lihat Undangan" to unlock (`enableScroll()`)
- Audio also starts playing on unlock

### RSVP Anti-Spam

1. **Honeypot field**: Hidden `#website` input (positioned off-screen) traps bots
2. **Edge Function rate limit**: Max 5 RSVPs per IP per 10 minutes
3. **Client-side validation**: All required fields checked before submit

### Digital Card Download

When RSVP is immediately approved (jumlah_hadir <= 2):

1. Hidden `#digital-card` div is rendered with guest info + QR code
2. `html2canvas` captures the div as PNG (10s timeout)
3. PNG is auto-downloaded with filename `Undangan_{Nama}.png`
4. If html2canvas fails, the card appears inline for manual screenshot

### Guestbook Anti-Spam

- Client-side profanity filter (`KATA_KASAR` array with 18 Indonesian swear words)
- RLS enforces `char_length(pesan) <= 500`
- Admin must approve entries before they appear publicly

---

## QR Check-in System

### Flow

1. Admin clicks "Mulai Scan" → camera activates
2. Guest shows QR code (from their digital card)
3. Scanner decodes the token (UUID or URL with `?token=`)
4. System looks up `rsvps.qr_token` matching the decoded value
5. Two writes occur (⚠️ race condition — see pitfalls):
   - INSERT into `guest_checkins` (unique constraint on rsvp_id)
   - UPDATE `rsvps.checked_in = true`
6. Result displayed: success (guest name + count) or error
7. Scanner stops after one scan

### Migration v3 Improvement

The `process_checkin` RPC wraps both writes in a single atomic transaction.
Currently the frontend still uses two separate writes — the RPC is available
but not yet adopted in `dashboard.js`.

### Manual Check-in

- ILIKE search across `rsvps.nama` with debounce (300ms)
- Shows results with status badges
- Confirmation dialog before check-in
- Same two-write pattern

---

## Setup for Local Development

### Prerequisites

- Node.js 18+ (for Playwright)
- A Supabase project
- A Netlify account (for deployment)

### Quick Start

```bash
# 1. Clone the repository
git clone <your-fork-url>
cd wedding-invitation-1

# 2. Install dependencies (Playwright only)
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Run tests to verify everything works
npx playwright test qa/wedding.spec.js
```

No build step, no dev server — just open the HTML files in a browser.
For full functionality (Supabase queries), you need the project to be
hosted or use a local HTTPS server (browsers block Supabase from `file://`).

```bash
# Quick local server with Python
python -m http.server 8080

# Or with Node's serve
npx serve .
```

### Running Tests

```powershell
# Run all tests
npx playwright test qa/wedding.spec.js

# Run a specific test file
npx playwright test qa/wedding.spec.js --grep "hero"

# Run with visible browser
npx playwright test qa/wedding.spec.js --headed

# View HTML report
npx playwright show-report
```

**Note:** Tests are DOM-presence only. They verify elements exist and basic
form behavior. They do NOT test Supabase integration (no mock setup).

---

## Setting Up Supabase from Scratch

If you want to fork this project and use your own Supabase instance:

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Apply Database Schema

Run these SQL files in order in Supabase SQL Editor:

1. `MD&DOC/supabase_schema.sql`
2. `MD&DOC/supabase_migration_v2.sql`
3. `MD&DOC/supabase_migration_v3.sql`

### 3. Create Admin User

1. Go to **Authentication → Users** and create a user (email/password)
2. Copy the user's UUID
3. Run in SQL Editor:
   ```sql
   INSERT INTO public.admin_users (id, email, role)
   VALUES ('<user-uuid>', '<admin-email>', 'admin');
   ```

### 4. Create Guest Records

Insert guests manually or through the admin dashboard:

```sql
INSERT INTO public.guests (slug, name, pronoun, invited_count, side)
VALUES ('nama-tamu', 'Nama Tamu', 'Bpk', 2, 'pria');
```

### 5. Deploy Edge Function

The `rate-limit-rsvp` Edge Function must be deployed to Supabase:

```bash
# Using Supabase CLI
supabase functions deploy rate-limit-rsvp
```

The Edge Function source is not in this repository — it lives in Supabase.

### 6. Update Supabase Credentials

Replace the hardcoded values in both `index.html` and `dashboard.js`:

```javascript
const supabaseUrl = "https://<your-project>.supabase.co";
const supabaseKey = "<your-anon-key>";
```

Also update the Edge Function URL in `index.html`:

```javascript
"https://<your-project>.functions.supabase.co/rate-limit-rsvp";
```

---

## Deployment

The project auto-deploys to Netlify from the `main` branch.

```bash
git add .
git commit -m "your changes"
git push origin main
# → Netlify auto-deploys
```

**Live URL:** `https://wedding-web-reza-shila-2026.netlify.app/`

### Manual Deploy

1. Fork the repository
2. Connect your fork to Netlify (New site → Import from Git)
3. Set build command: (none — static HTML)
4. Set publish directory: `/`
5. Deploy

### Important Notes

- No environment variables needed (Supabase keys are hardcoded)
- No build step required
- No HTTPS configuration needed (Netlify handles it)
- All assets served from CDN (Bootstrap, AOS, etc.)

---

## Known Pitfalls

These are known issues that future developers should be aware of:

### 1. Polling Never Cleared on Logout

```javascript
// dashboard.js line ~1396
setInterval(async function () {
  // polls rsvps for pending approvals every 30 seconds
}, 30000);
```

The interval keeps running after logout, continuing to hit Supabase.
Fix: Clear the interval on logout with `clearInterval()`.

### 2. QR Check-in Race Condition

When the QR scanner fires twice quickly, both writes happen:

- `INSERT guest_checkins` — caught by unique constraint on `rsvp_id`
- `UPDATE rsvps.checked_in = true` — runs twice (harmless but wasteful)

Migration v3 provides `process_checkin` RPC as an atomic fix, but
`dashboard.js` still uses the two-write pattern.

### 3. QR Scanner is One-Shot

After a successful scan, the scanner stops. Admin must click "Mulai Scan"
again. This is intentional (prevents accidental double-scans) but
inconvenient for scanning multiple guests in sequence.

### 4. 500-Row Limit on RSVP Fetch

```javascript
// dashboard.js line ~502
.limit(500)
```

If the event has more than 500 RSVPs, merged data will be incomplete.
The guest list also has no limit, but RSVPs are capped.

### 5. Client-Side Pagination

Activity log and guestbook in the admin dashboard use client-side
pagination. Works fine for moderate data but will break with thousands
of entries. Server-side pagination would be needed at scale.

### 6. disableScroll() Fights Programmatic Scroll

The `position: fixed` + `width: 100%` approach locks scroll by capturing
the scroll position. This works but interferes with any programmatic
scroll attempts. Relies on the DOM being fully loaded.

### 7. escapeAttr() is Naive

```javascript
function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
```

Only escapes `'` and `"` — does NOT escape `<`, `>`, `` ` ``.
Dangerous if used in HTML attribute contexts beyond the current usage.

### 8. No Offline Fallback

The entire application requires network connectivity for:

- Supabase API (database queries, auth)
- CDN assets (Bootstrap, fonts, libraries)

No Service Worker or offline fallback is configured.

### 9. NoWA Field Missing maxlength

The WhatsApp number input (`#noWA`) lacks a `maxlength` attribute in HTML.
While the database has constraints, the frontend allows arbitrarily long input.

---

## License

This project is licensed under the [MIT License](LICENSE).

Based on the original template by [elix-stack](https://github.com/elix-stack),
modified and customized for this wedding project.
