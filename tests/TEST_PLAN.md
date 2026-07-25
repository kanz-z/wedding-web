# Test Plan — Wedding Web (Reza & Ashila) E2E

**Project:** Digital Invitation & Guestbook
**Base URL:** https://wedding-web-reza-shila-2026.vercel.app
**Generated:** 2026-07-25

---

## Flow 1: Tamu — Landing Page

| ID | Test Case | Objective | Preconditions | Steps | Expected Result | Artifacts |
|----|-----------|-----------|---------------|-------|-----------------|-----------|
| L01 | Cover display | Verifikasi halaman pembuka tampil | None (anonim) | Buka `/` | Heading Dear, nama pasangan, link "Lihat Undangan" visible | Screenshot on failure |
| L02 | Klik Lihat Undangan | Verifikasi anchor scroll ke Beranda | Di halaman cover | Klik "Lihat Undangan" | URL berubah ke `#welcome` | Screenshot on failure |
| L03 | Bottom-tab navigasi | Verifikasi 3 tab navigasi berfungsi | Di halaman cover | Klik RSVP → Guestbook → Gifts | Tiap klik mengubah URL hash + section visible | Screenshot on failure |
| L04 | Section Acara — Maps | Verifikasi Google Maps embed | Di halaman undangan | Scroll ke `#info` | iframe maps atau link maps.app.goo.gl visible | Screenshot on failure |
| L05 | Countdown | Verifikasi countdown timer | Di halaman undangan | Scroll ke `#cd` | Label "days" visible | Screenshot on failure |
| L06 | Guestbook form | Verifikasi form ucapan tampil | Di halaman undangan | Scroll ke `#guestbook-section` | Input nama + textarea + tombol kirim visible | Screenshot on failure |

## Flow 2: Tamu — RSVP (Konfirmasi Kehadiran)

| ID | Test Case | Objective | Preconditions | Steps | Expected Result | Artifacts |
|----|-----------|-----------|---------------|-------|-----------------|-----------|
| R01 | Form RSVP lengkap | Verifikasi semua field form | Di halaman undangan | Scroll ke `#rsvp` | Nama, jumlah tamu, hadir/tidak, WA, doa, tombol kirim visible | Screenshot on failure |
| R02 | Submit RSVP valid | Verifikasi end-to-end submit | Di halaman undangan | Isi semua field → klik Kirim → tunggu edge function | Toast sukses ATAU tombol berubah "Lihat Kartu" | Screenshot + trace on first retry |
| R03 | Submit tanpa nama | Verifikasi validasi client-side | Di halaman undangan | Kosongkan nama, isi field lain → klik Kirim | Tidak redirect ke `/invitation/`, tetap di RSVP | Screenshot on failure |
| R04 | RSVP >2 tamu luar keluarga | [QUARANTINED #RSVP-LIMIT-NOT-READY] | test.fixme | N/A | Notifikasi admin belum implementasi (Fase 6) | N/A |

## Flow 3: Tamu — Guestbook (Ucapan)

| ID | Test Case | Objective | Preconditions | Steps | Expected Result | Artifacts |
|----|-----------|-----------|---------------|-------|-----------------|-----------|
| G01 | Form guestbook tampil | Verifikasi form input ucapan | Di halaman undangan | Scroll ke `#guestbook-section` | Nama + ucapan + tombol visible | Screenshot on failure |
| G02 | Kirim ucapan | Verifikasi submit ucapan → edge function | Di halaman undangan | Isi nama unik + ucapan → kirim → tunggu network | Toast/alert sukses muncul | Screenshot on failure |
| G03 | Daftar ucapan tampil | Verifikasi guestbook section visible | Di halaman undangan | Scroll ke `#guestbook-section` | Section container visible | Screenshot on failure |
| G04 | Karakter counter | [QUARANTINED #GB-CHAR-COUNTER] | test.skip di CI | N/A | Counter 0/500 kadang tidak dirender | N/A |

## Flow 4: Tamu — Kartu Undangan (Dynamic Route)

| ID | Test Case | Objective | Preconditions | Steps | Expected Result | Artifacts |
|----|-----------|-----------|---------------|-------|-----------------|-----------|
| C01 | Akses via slug | Verifikasi dynamic route berfungsi | Slug di DB | GET `/invitation/test-slug/card` | Halaman render, body visible | Screenshot on failure |
| C02 | Nama pasangan | Verifikasi brand konsisten | Di halaman kartu | Tunggu load | "Reza & Ashila" visible | Screenshot on failure |
| C03 | QR Code render | Verifikasi qrcodejs client-side | Di halaman kartu, slug valid | Tunggu render 2s | Canvas QR ada | Screenshot + trace |
| C04 | Tombol kembali | Verifikasi navigasi kembali | Di halaman kartu | Cek tombol kembali | Link kembali tersedia (jika ada) | Screenshot on failure |
| C05 | Lokasi RIVEA | Verifikasi info venue | Di halaman kartu | Cek teks lokasi | "RIVEA" muncul di kartu | Screenshot on failure |
| C06 | Download PDF | [QUARANTINED #CARD-DOWNLOAD-VERIFY] | test.skip | N/A | File .pdf terdownload (tidak terverifikasi di CI) | N/A |

## Flow 5: Admin — Login & Logout

| ID | Test Case | Objective | Preconditions | Steps | Expected Result | Artifacts |
|----|-----------|-----------|---------------|-------|-----------------|-----------|
| A01 | Form login tampil | Verifikasi UI login | Tidak login | GET `/dashboard.html` | Brand, subtitle, email, password, tombol Masuk visible | Screenshot on failure |
| A02 | Login sukses | Verifikasi Supabase Auth | Preview mode | Isi email + password → klik Masuk → tunggu redirect | URL `#hub`, brand visible | Screenshot + trace |
| A03 | Login gagal — password kosong | Verifikasi error state | Tidak login | Isi email saja → klik Masuk | Tidak redirect ke `#hub` | Screenshot on failure |
| A04 | Logout | Verifikasi session clear | Sudah login | Klik tombol logout → tunggu redirect | URL kembali ke `/dashboard.html` tanpa hash | Screenshot on failure |
| A05 | Session expired | [QUARANTINED #AUTH-SESSION-EXPIRY] | test.skip | N/A | Perlu manipulasi token — terlalu kompleks | N/A |

## Flow 6: Admin — Dashboard Navigasi

| ID | Test Case | Objective | Preconditions | Steps | Expected Result | Artifacts |
|----|-----------|-----------|---------------|-------|-----------------|-----------|
| D01 | Hub navigasi | Verifikasi widget hub lengkap | Login sukses | Lihat halaman hub | Semua 5 widget navigasi visible | Screenshot on failure |
| D02 | Navigasi → Kelola Tamu | Verifikasi tabel tamu | Login sukses | Klik nav Tamu | Tabel atau empty state visible | Screenshot on failure |
| D03 | Navigasi → Check-in | Verifikasi scanner halaman | Login sukses | Klik nav Check-in | Scanner area atau search box visible | Screenshot on failure |
| D04 | Navigasi → Pesan Publik | Verifikasi guestbook moderation | Login sukses | Klik nav Publik | Tabel pesan atau empty state visible | Screenshot on failure |
| D05 | Search tamu | Verifikasi debounce search | Login sukses, di halaman Tamu | Ketik "test" di search box | Tidak crash, halaman tetap stabil | Screenshot on failure |
| D06 | Realtime update | [QUARANTINED #RT-UPDATE-TEST] | test.fixme | N/A | Butuh 2 session simultan | N/A |

---

## Quarantined Tests Summary

| ID | Test | Issue | Reason |
|----|------|-------|--------|
| R04 | RSVP >2 notifikasi | #RSVP-LIMIT-NOT-READY | Fase 6 — notifikasi >2 tamu belum diimplementasikan |
| G04 | Karakter counter | #GB-CHAR-COUNTER | Counter tidak dirender di semua environment |
| C06 | Download PDF | #CARD-DOWNLOAD-VERIFY | jspdf download tidak terverifikasi di headless CI |
| A05 | Session expired | #AUTH-SESSION-EXPIRY | Perlu manipulasi token Supabase yang kompleks |
| D06 | Realtime update | #RT-UPDATE-TEST | Butuh 2 admin session simultan |

## Artifacts Policy

| Condition | Artifact |
|-----------|----------|
| Always | JUnit XML, JSON results, HTML report |
| On failure | Screenshot (PNG), Video (WebM) |
| On first retry | Trace (ZIP) |
| CI | Semua artifacts di-upload ke GitHub Actions (retention 30 days) |

## Running in CI

```bash
# Run with production URL (default)
npm run test:ci

# Run against custom env
BASE_URL=https://staging.example.com npm run test:ci
```

## Running Locally

```bash
npm test                    # Headless, 0 retries
npm run test:headed         # Browser visible
npm run test:debug          # Step-by-step debugger
npx playwright test -g "RSVP"  # Filter by test name
```
