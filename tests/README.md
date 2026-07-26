# Dokumentasi Testing — Wedding Invitation (Reza & Ashila)

## Strategi Testing

Testing dilakukan secara end-to-end (E2E) menggunakan [Playwright](https://playwright.dev/) terhadap URL production https://wedding-web-reza-shila-2026.vercel.app. Tidak ada test unit atau integration. Seluruh verifikasi dilakukan melalui interaksi browser sungguhan.

| Dimensi       | Pendekatan                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| **Tools**     | Playwright, TypeScript, Page Object Model                                                            |
| **Target**    | Deployed production URL (bukan local dev server)                                                     |
| **Browser**   | Dashboard: 1 browser (Chromium). Publik: 4 browser (Chromium, Firefox, WebKit, Mobile Chrome)        |
| **Auth**      | Cached via `storageState`. Login dilakukan sekali di setup project, reuse di seluruh test dashboard  |
| **Data**      | Seluruh data test bersifat sintetis (bukan PII asli), didefinisikan di `tests/fixtures/test-data.ts` |
| **CI**        | GitHub Actions matrix 5 job paralel (setup + dashboard + 3 publik cross-browser)                     |
| **Artifacts** | Screenshot on failure, trace on first retry, video retain on failure, JUnit XML + JSON + HTML report |

### Prinsip Testing

1. Verifikasi keberadaan, bukan nilai absolut. Test memeriksa elemen muncul di DOM, bukan konten eksaknya (nilai database berubah-ubah).
2. Selector berbasis ID dan role, bukan CSS class. Lebih stabil terhadap perubahan styling.
3. Page Object Model (POM). Semua selector dan action method dienkapsulasi di `tests/pages/XxxPage.ts`.
4. Tidak ada test cleanup. Data E2E yang masuk ke production dibiarkan (pakai data unik timestamp agar tidak mengganggu).

---

## Cakupan Pengujian

```
Dashboard (1 browser, Chromium)
├── Auth/login         — form login, spinner, error message, logout, session expired
├── Hub                — summary cards, widget navigasi, panel notifikasi
├── Kelola Tamu        — tabel, search/filter, pagination, bulk bar, modal detail/edit, checkin dialog
├── Check-in           — scanner, start/stop kamera, switch camera, manual search
├── Reservasi          — reservation cards, approve/reject, copy link, search
├── Pesan Publik       — daftar ucapan, visibility toggle, skeleton loading
├── Pesan Privat       — daftar pesan, skeleton loading
└── Admin              — tabel admin, role badges

Publik (4 browser: Chromium, Firefox, WebKit, Mobile Chrome)
├── Landing            — cover, navigasi, Google Maps, countdown, dresscode, audio, gift copy, nav toggle
├── RSVP               — form submit valid/invalid, >2 tamu, already-submitted, tidak-hadir flow
├── Guestbook          — form, submit, daftar, profanity filter, pagination
└── Kartu Undangan     — render, QR code, lokasi, orientasi toggle, error state, download loading
```

---

## Daftar Skenario Uji

### 1. Auth — Login Admin (`tests/e2e/auth/login.spec.ts`)

| ID  | Skenario                      | Hasil yang Diharapkan                                                       |
| --- | ----------------------------- | --------------------------------------------------------------------------- |
| A01 | Form login tampil             | Brand "Reza & Ashila", subtitle, input email/password, tombol Masuk visible |
| A02 | Login sukses                  | Redirect ke `/dashboard.html#hub`, brand name visible di navbar             |
| A03 | Password kosong               | Tidak redirect ke `#hub`, tetap di halaman login                            |
| A04 | Logout                        | Redirect kembali ke `/dashboard.html` tanpa hash                            |
| A05 | Spinner saat autentikasi      | `#login-spinner` muncul setelah klik Masuk                                  |
| A06 | Login gagal — error message   | `#login-error` muncul saat password salah                                   |
| A07 | Session expired (QUARANTINED) | Redirect ke login + toast notifikasi                                        |

### 2. Hub Dashboard (`tests/e2e/hub.spec.ts`)

| ID  | Skenario           | Hasil yang Diharapkan                                          |
| --- | ------------------ | -------------------------------------------------------------- |
| H01 | Summary stat cards | Setidaknya 1 `.summary-card` visible                           |
| H02 | Widget navigasi    | Setiap `.widget-card` memiliki atribut `data-goto`             |
| H03 | Panel notifikasi   | Klik bell → panel notifikasi muncul, klik close → panel hilang |

### 3. Dashboard — Navigasi (`tests/e2e/dashboard.spec.ts`)

| ID  | Skenario                      | Hasil yang Diharapkan                                         |
| --- | ----------------------------- | ------------------------------------------------------------- |
| D01 | Hub navigasi                  | Widget Tamu, Check-in, Reservasi, Pesan Publik, Admin visible |
| D02 | Navigasi → Kelola Tamu        | Tabel atau empty state atau skeleton visible                  |
| D03 | Navigasi → Check-in           | Scanner area atau search manual visible                       |
| D04 | Navigasi → Pesan Publik       | Tabel atau empty state visible                                |
| D05 | Search tamu                   | Input search berfungsi tanpa crash (debounce 250ms)           |
| D06 | Realtime update (QUARANTINED) | Row berkedip saat data berubah oleh admin lain                |

### 4. Kelola Tamu (`tests/e2e/guests.spec.ts`)

| ID  | Skenario              | Hasil yang Diharapkan                                               |
| --- | --------------------- | ------------------------------------------------------------------- |
| G01 | Tabel render          | `#guest-table-wrap`, `#guest-empty`, atau `#guest-skeleton` visible |
| G02 | Search                | Ketik di `#guest-search` → hasil terfilter tanpa crash              |
| G03 | Filter RSVP           | Select "Hadir" → halaman tidak crash                                |
| G04 | Filter Check-in       | Select "Sudah" → halaman tidak crash                                |
| G05 | Filter Kategori       | Select "Keluarga" → halaman tidak crash                             |
| G06 | Pagination            | Ubah page size ke 25 → halaman tidak crash                          |
| G07 | Select all → bulk bar | Klik `#select-all-guests` → bulk bar muncul (jika ada data)         |
| G08 | Modal detail          | Klik `[data-action="detail"]` → `#guest-modal-overlay` muncul       |
| G09 | Modal edit            | Klik `[data-action="edit"]` → `#edit-modal-overlay` muncul          |
| G10 | Dialog check-in       | Klik `[data-action="checkin"]` → `#checkin-dialog-overlay` muncul   |
| G11 | Reload data           | Klik `#btn-reload-guests` → halaman tidak crash                     |
| G12 | Skeleton loading      | `#guest-skeleton` atau table muncul setelah navigasi                |

### 5. Check-in (`tests/e2e/checkin.spec.ts`)

| ID  | Skenario        | Hasil yang Diharapkan                                |
| --- | --------------- | ---------------------------------------------------- |
| C01 | Scanner area    | `#checkin-mode-scan` dan `#btn-start-scan` visible   |
| C02 | Start/stop scan | `#btn-stop-scan` muncul setelah klik mulai scan      |
| C03 | Switch camera   | `#btn-switch-camera` ada di DOM setelah scan dimulai |
| C04 | Manual search   | Panel `#manual-search-panel` bisa di-toggle          |
| C05 | Scan results    | `#scan-results-list` ada di DOM                      |

### 6. Reservasi (`tests/e2e/reservations.spec.ts`)

| ID  | Skenario          | Hasil yang Diharapkan                        |
| --- | ----------------- | -------------------------------------------- |
| R01 | Reservation cards | `.reservation-card` atau empty state visible |
| R02 | Approve           | Klik `.btn-approve` → tidak crash            |
| R03 | Reject            | Klik `.btn-reject` → tidak crash             |
| R04 | Copy link         | Klik `[data-copy-link]` → tidak crash        |
| R05 | Search            | Ketik di `#res-search` → cards terfilter     |
| R06 | Event toggle      | Klik `#event-status-switch` → label berubah  |

### 7. Pesan Publik (`tests/e2e/public-messages.spec.ts`)

| ID  | Skenario          | Hasil yang Diharapkan                                                     |
| --- | ----------------- | ------------------------------------------------------------------------- |
| P01 | Daftar ucapan     | `#public-messages-list`, `#public-empty`, atau `#public-skeleton` visible |
| P02 | Visibility toggle | Klik `.visibility-switch input` → tidak crash                             |
| P03 | Skeleton loading  | Skeleton atau konten muncul setelah navigasi                              |

### 8. Pesan Privat (`tests/e2e/private-messages.spec.ts`)

| ID  | Skenario         | Hasil yang Diharapkan                                                        |
| --- | ---------------- | ---------------------------------------------------------------------------- |
| V01 | Daftar pesan     | `#private-messages-list`, `#private-empty`, atau `#private-skeleton` visible |
| V02 | Skeleton loading | Skeleton atau konten muncul setelah navigasi                                 |

### 9. Manajemen Admin (`tests/e2e/admin-management.spec.ts`)

| ID  | Skenario    | Hasil yang Diharapkan                                          |
| --- | ----------- | -------------------------------------------------------------- |
| M01 | Tabel admin | `#admin-tbody`, `#admin-empty`, atau `#admin-skeleton` visible |
| M02 | Role badges | `.badge-dash` count terdefinisi (bisa 0)                       |

### 10. Landing Page (`tests/e2e/landing.spec.ts`)

| ID  | Skenario            | Hasil yang Diharapkan                                    |
| --- | ------------------- | -------------------------------------------------------- |
| L01 | Cover               | "Reza & Ashila", "Lihat Undangan", "Dear" visible        |
| L02 | Klik Lihat Undangan | URL berubah ke `#welcome`                                |
| L03 | Bottom-tab navigasi | Klik RSVP/Guestbook/Gifts → URL dan section sesuai       |
| L04 | Section Acara       | Google Maps embed iframe ATAU link external maps visible |
| L05 | Countdown           | Label "days" visible                                     |
| L06 | Guestbook form      | Input nama + tombol submit visible                       |
| L07 | Dress code          | `#dresscode` visible setelah navigasi                    |
| L08 | Welcome             | `#welcome` visible setelah scroll                        |
| L09 | Audio toggle        | Klik `.audio-icon-wrapper` → tidak crash                 |
| L10 | Copy gift           | Klik `.btn-copy-icon` → `#gift-toast` mungkin muncul     |
| L11 | Nav toggle          | Klik `#navToggle` → `nav-hidden` class toggle            |

### 11. RSVP (`tests/e2e/rsvp.spec.ts`)

| ID  | Skenario              | Hasil yang Diharapkan                                                      |
| --- | --------------------- | -------------------------------------------------------------------------- |
| S01 | Form tampil           | Semua field RSVP visible: nama, jumlah tamu, hadir/tidak, WA, tombol kirim |
| S02 | Submit valid          | Feedback sukses: toast/alert/atau tombol "Kartu" muncul                    |
| S03 | Submit tanpa nama     | Tidak redirect ke `/invitation/`, tetap di RSVP                            |
| S04 | >2 tamu luar keluarga | Submit 5 tamu → tidak crash, notifikasi terkirim                           |
| S05 | Already-submitted     | Set `localStorage.setItem('rsvp_submitted', 'true')` → state terblokir     |
| S06 | Tidak hadir           | Submit "Tidak Hadir" → feedback sukses tanpa crash                         |

### 12. Guestbook (`tests/e2e/guestbook.spec.ts`)

| ID  | Skenario                       | Hasil yang Diharapkan                                  |
| --- | ------------------------------ | ------------------------------------------------------ |
| B01 | Form tampil                    | Input nama + textarea + tombol kirim visible           |
| B02 | Kirim ucapan                   | Feedback sukses muncul setelah edge function selesai   |
| B03 | Daftar ucapan                  | `#guestbook-section` visible                           |
| B04 | Profanity filter               | Submit kata kasar → `.gb-error-msg` mungkin muncul     |
| B05 | Pagination                     | `#gb-pagination` atau `.pagination` mungkin ada        |
| B06 | Entry structure                | `.gb-entry` memiliki `.gb-name`, `.gb-msg`, `.gb-time` |
| B07 | Karakter counter (QUARANTINED) | `0/500` counter visible                                |

### 13. Kartu Undangan (`tests/e2e/card.spec.ts`)

| ID  | Skenario                   | Hasil yang Diharapkan                             |
| --- | -------------------------- | ------------------------------------------------- |
| K01 | Halaman kartu              | `/invitation/test-slug/card` dapat diakses        |
| K02 | Nama pasangan              | "Reza & Ashila" tampil                            |
| K03 | QR Code                    | Canvas QR code dirender client-side               |
| K04 | Tombol kembali             | Link/button kembali tersedia                      |
| K05 | Lokasi RIVEA               | Teks venue "RIVEA" tampil                         |
| K06 | Orientasi toggle           | Klik `#cardOrientationPortrait` → tidak crash     |
| K07 | Error state                | Visit invalid slug → `.card-error` mungkin muncul |
| K08 | Download loading           | Klik download → spinner mungkin muncul            |
| K09 | Download PDF (QUARANTINED) | File PDF terdownload                              |

---

## Skenario Pengujian Otomatis

### Menjalankan Test

```bash
# Semua test (5 project paralel)
npm test

# Hanya dashboard (1 browser, lebih cepat)
npx playwright test --project=dashboard

# Hanya publik — chromium
npx playwright test --project=chromium

# Test spesifik
npx playwright test tests/e2e/guests.spec.ts

# List semua test (tanpa menjalankan)
npx playwright test --list
```

### Struktur File

```
tests/
├── auth.setup.ts                    # Login setup (sekali, cache state)
├── README.md                        # File ini
├── fixtures/
│   └── test-data.ts                 # Data sintetis (RSVP_GUEST, ADMIN_CREDENTIALS, ROUTES, dsb.)
├── pages/                           # Page Object Models
│   ├── LoginPage.ts                 # Halaman login + auth helpers
│   ├── DashboardPage.ts             # Navigasi dashboard
│   ├── HubPage.ts                   # Hub (summary + notifikasi)
│   ├── GuestsPage.ts                # Kelola Tamu
│   ├── CheckinPage.ts               # Check-in
│   ├── ReservationsPage.ts          # Reservasi
│   ├── PublicMessagesPage.ts        # Pesan Publik
│   ├── PrivateMessagesPage.ts       # Pesan Privat
│   ├── AdminPage.ts                 # Manajemen Admin
│   ├── LandingPage.ts               # Landing page publik
│   └── CardPage.ts                  # Kartu undangan
└── e2e/                             # Test specs
    ├── auth/login.spec.ts           # 7 test — Auth
    ├── hub.spec.ts                  # 3 test — Hub
    ├── dashboard.spec.ts            # 6 test — Dashboard navigasi
    ├── guests.spec.ts               # 12 test — Kelola Tamu
    ├── checkin.spec.ts              # 5 test — Check-in
    ├── reservations.spec.ts         # 6 test — Reservasi
    ├── public-messages.spec.ts      # 3 test — Pesan Publik
    ├── private-messages.spec.ts     # 2 test — Pesan Privat
    ├── admin-management.spec.ts     # 2 test — Admin
    ├── landing.spec.ts              # 11 test — Landing
    ├── rsvp.spec.ts                 # 6 test — RSVP
    ├── guestbook.spec.ts            # 7 test — Guestbook
    └── card.spec.ts                 # 9 test — Kartu Undangan
```

### Group Test per Project

| Project         | Browser  | TestMatch                                                                                              | Keterangan                                             |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `setup`         | Chromium | `auth.setup.ts`                                                                                        | Login sekali, simpan state ke `.auth/admin-state.json` |
| `dashboard`     | Chromium | 9 spec (auth, hub, dashboard, guests, checkin, reservations, public-messages, private-messages, admin) | Reuse auth → cepat                                     |
| `chromium`      | Chromium | 4 spec (landing, rsvp, guestbook, card)                                                                | Publik — cross-browser                                 |
| `firefox`       | Firefox  | 4 spec                                                                                                 | Publik — cross-browser                                 |
| `webkit`        | Safari   | 4 spec                                                                                                 | Publik — cross-browser                                 |
| `mobile-chrome` | Pixel 5  | 4 spec                                                                                                 | Publik — cross-browser                                 |

### Konvensi Penulisan Test

| Hal            | Konvensi                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Pola test**  | Arrange (beforeEach) → Act (method POM) → Assert (`toBeVisible`, `.count()`, `toHaveURL`)               |
| **Naming**     | `'halaman -- expected-outcome'` (kebab-case + `--`)                                                     |
| **Selector**   | `getByRole` > `getByPlaceholder` > `getByText` > `locator('#id')` > CSS class                           |
| **Network**    | `waitForResponse().catch(() => null)` untuk edge function — jangan fail kalau cold start                |
| **Safety**     | Test tidak mengandalkan data spesifik di DB; `.catch(() => false)` untuk elemen opsional                |
| **Quarantine** | `test.skip()` / `test.fixme()` — 4 test di-skip (char counter, session expired, realtime, PDF download) |

### Status Quarantine

| Test                      | Alasan                                             | Issue                   |
| ------------------------- | -------------------------------------------------- | ----------------------- |
| Session expired redirect  | Manipulasi token Supabase rumit                    | `#AUTH-SESSION-EXPIRY`  |
| Realtime update row flash | Butuh 2 admin session simultan                     | `#RT-UPDATE-TEST`       |
| Karakter counter 0/500    | Elemen counter kadang tidak dirender di production | `#GB-CHAR-COUNTER`      |
| Download PDF              | Tidak terverifikasi di headless CI                 | `#CARD-DOWNLOAD-VERIFY` |
