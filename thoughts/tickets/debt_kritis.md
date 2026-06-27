---
type: debt
priority: high
created: 2026-06-27
status: implemented
tags: [security, xss, race-condition, testing, validation]
keywords: [escapeAttr, RSVP, maxlength, QR check-in, Promise.all, Playwright, unit test]
patterns: [XSS prevention, race condition, Supabase RLS, rate limiting, testing]
---

# DEBT-KRITIS: Perbaikan 6 Temuan KRITIS — XSS, Rate Limiting, Validasi, Race Condition, Testing

## Deskripsi
Ticket ini mencakup perbaikan untuk **6 temuan kritis** dari QA Brutal Analysis yang memiliki dampak keamanan, integritas data, atau kehilangan data.

## Daftar Temuan
1. **1.1 — XSS via escapeAttr() Tidak Lengkap** (dashboard.js:86-88)
2. **1.2 — RSVP INSERT Tanpa Validasi / Rate Limiting** (index.html:1008-1017)
3. **1.3 — Nama RSVP Tanpa maxlength** (index.html:330-338)
4. **2.1 — QR Check-in Double-scan Race Condition** (dashboard.js:1148-1155)
5. **3.1 — Promise.all Partial Failure** (dashboard.js:486-497)
6. **10.1 — Testing Coverage Hanya DOM Presence**

---

## 1.1 — XSS via escapeAttr() Tidak Lengkap

### Masalah
Fungsi `escapeAttr()` di `dashboard.js:86-88` hanya meng-escape `'` dan `"`:
```js
function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
```
Karakter `<`, `>`, `` ` `` tidak diescape. Fungsi dipakai di `renderTamuTable()` untuk menyisipkan `onclick` string, misal:
```js
'<button class="btn-sm" onclick="copyGuestLink(\'' +
escapeAttr(t.nama) + ...
```
Nama tamu berisi `"><script>alert(1)</script>` bisa mengeksekusi XSS stored.

### Solusi
1. Escape SEMUA karakter HTML-berbahaya: `<`, `>`, `&`, `"`, `'`, `` ` ``
2. Alternatif: gunakan `encodeURIComponent()` untuk atribut onclick
3. Tambah unit test untuk `escapeAttr()`

### Perubahan yang Dibutuhkan
- **File:** `dashboard.js` — fungsi `escapeAttr()` baris 86-88
- **File:** `qa/wedding.spec.js` — test untuk escapeAttr

---

## 1.2 — RSVP INSERT Tanpa Validasi / Rate Limiting

### Masalah
Supabase anon key hardcoded di frontend. RLS untuk INSERT `rsvps` mengizinkan siapa pun (`with check (true)`). Tidak ada captcha, rate limiting, atau validasi origin. Bot bisa membanjiri database dengan ribuan RSVP palsu.

### Solusi
Implementasi **rate limiting via Supabase Edge Functions**:
1. Buat Edge Function `rate-limit-rsvp` yang:
   - Cek IP address / timestamp dari request
   - Batasi maksimal 5 RSVP per IP per 10 menit
2. Ubah flow RSVP: dari `supabaseClient.from("rsvps").insert(...)` langsung → panggil Edge Function dulu
3. Edge Function validasi rate limit, lalu INSERT via `SERVICE_ROLE` key (hanya di server)

### Perubahan yang Dibutuhkan
- **File baru:** `supabase/functions/rate-limit-rsvp/index.ts`
- **File:** `index.html` — ubah flow submit RSVP untuk panggil Edge Function
- **File:** `MD&DOC/` — dokumentasi Edge Function

---

## 1.3 — Nama RSVP Tanpa maxlength

### Masalah
Field `<input id="nama">` di `index.html:330-338` tidak punya atribut `maxlength`. Tabel `rsvps.nama` adalah `text NOT NULL` tanpa constraint panjang. User bisa mengirim nama >= 10.000 karakter → memenuhi storage, merusak layout dashboard, potensi DoS.

### Solusi
1. **Schema change (penjelasan):**
   - **Sekarang:** `rsvps.nama` adalah `text NOT NULL` — bisa diisi string sepanjang apapun
   - **Diubah:** tambah `CHECK (char_length(nama) <= 100)` — maksimal 100 karakter
   - **Record existing:** tetap apa adanya (tidak diubah). Perubahan hanya berlaku untuk INSERT/UPDATE baru
2. **HTML:** tambah `maxlength="100"` di `<input id="nama">`
3. **Update migration SQL:** file migrasi baru untuk constraint

### Perubahan yang Dibutuhkan
- **File baru:** `MD&DOC/supabase_migration_v3.sql`
- **File:** `index.html` — tambah `maxlength="100"` di input nama
- **File:** `dashboard.js` — tambah validasi nama di form edit tamu

---

## 2.1 — QR Check-in Double-scan Race Condition

### Masalah
Di `dashboard.js:1148-1155`, QR scan melakukan dua operasi berurutan:
```js
await sb.from("guest_checkins").insert([{ rsvp_id: tamu.id, ... }]);
await sb.from("rsvps").update({ checked_in: true }).eq("id", tamu.id);
```
Jika scanner memicu dua kali cepat:
- INSERT #1 sukses, INSERT #2 gagal (unique constraint), UPDATE #1 dan #2 keduanya jalan
- Atau: INSERT #1 sukses tapi UPDATE #1 gagal network → RSVP tidak pernah di-mark `checked_in=true`

### Solusi
Bungkus INSERT + UPDATE dalam satu **Supabase RPC function** (atomic transaction):
1. Buat fungsi SQL `process_checkin(rsvp_id uuid, checked_by uuid, method text)`
2. Di dalam fungsi: BEGIN; INSERT guest_checkins; UPDATE rsvps; COMMIT;
3. Panggil RPC dari dashboard JS

### Perubahan yang Dibutuhkan
- **File baru:** `MD&DOC/supabase_migration_v3.sql` — tambah RPC function
- **File:** `dashboard.js` — ubah panggilan check-in dari dua query → panggil RPC

---

## 3.1 — Promise.all Partial Failure

### Masalah
Di `dashboard.js:486-497`:
```js
var [guestsRes, rsvpsRes] = await Promise.all([
  sb.from("guests").select(...),
  sb.from("rsvps").select(...).limit(500),
]);
if (guestsRes.error) throw guestsRes.error;
if (rsvpsRes.error) throw rsvpsRes.error;
```
Jika SATU query gagal (network glitch), `Promise.all` throw dan KEDUA hasil dibuang. Data yang berhasil di-fetch hilang.

### Solusi
Gunakan `Promise.allSettled()` + handle partial failure:
- Jika guests gagal → tampilkan error guests saja, rsvps tetap tampil
- Jika rsvps gagal → tampilkan error rsvps saja, guests tetap tampil
- Tampilkan status element untuk bagian yang gagal (tombol "Coba lagi")

### Perubahan yang Dibutuhkan
- **File:** `dashboard.js` — baris 486-497, ganti `Promise.all` → `Promise.allSettled`

---

## 10.1 — Testing Coverage Hanya DOM Presence

### Masalah
Dari 13 Playwright test, SEMUA hanya cek DOM element existence. Tidak ada test untuk:
- Form submission (RSVP, guestbook)
- API mock / Supabase integration
- Login/logout
- QR scan simulation
- Error states
- Pagination
- Profanity filter
- Digital card download

### Solusi
Tambah test dengan **dua pendekatan**:
1. **Supabase local instance** (`supabase start`) — untuk integration test dengan database nyata
2. **Mocking** (MSW atau sinon) — untuk unit test tanpa database

Test yang harus ditambahkan (minimal):
- RSVP form submission + validasi
- Guestbook submit + counter
- Login dashboard (success + failure)
- Profanity filter (sensorKataKasar)
- escapeHtml() / escapeAttr()
- Auto-match orphan heuristic
- Digital card render (html2canvas mock)

### Perubahan yang Dibutuhkan
- **File:** `qa/wedding.spec.js` — tambah test suites
- **File baru:** `qa/unit/helpers.test.js` — unit test untuk fungsi helper
- **File:** `package.json` — mungkin perlu tambah devDependencies untuk mocking

---

## Konteks
Semua temuan berasal dari QA Brutal Analysis (27 Juni 2026). Proyek adalah wedding invitation system dengan stack vanilla HTML/CSS/JS + Supabase backend.

## Research Context

### Keywords
- `escapeAttr` — fungsi escape tidak lengkap, rawan XSS
- `rate-limit` — perlu Edge Function untuk batasi RSVP spam
- `maxlength` — tidak ada di input nama, perlu ditambah
- `process_checkin` — RPC function untuk atomic transaction
- `Promise.allSettled` — ganti Promise.all untuk partial failure handling
- `Playwright` — framework test, perlu tambah coverage

### Keputusan yang Sudah Dibuat
- Rate limiting via **Supabase Edge Functions** (bukan reCAPTCHA)
- Schema changes: **langsung ubah**, record existing dibiarkan
- Testing: **keduanya** — Supabase local instance + mocking library
- QR check-in: **RPC function** untuk atomic transaction
- Schema change 1.3: tambah `CHECK` constraint, record existing tidak diubah
- Untuk tamu dengan `jumlah_hadir > 2` tapi `nomor_wa` tidak ada saat kirim kartu: beri notifikasi

## Success Criteria

### Automated Verification
- [ ] `escapeAttr()` lolos dari karakter `<`, `>`, `` ` ``, `&`
- [ ] Nama RSVP > 100 karakter ditolak (SQL + HTML)
- [ ] QR check-in atomic: INSERT + UPDATE gagal/berhasil bersama
- [ ] `loadTamuRSVP()` tidak crash jika salah satu query gagal
- [ ] Playwright test baru minimal 10 test sukses
- [ ] Unit test untuk escapeAttr, sensorKataKasar, generateUUID minimal 1 test per fungsi

### Manual Verification
- [ ] XSS payload di nama tamu tidak tereksekusi di dashboard
- [ ] RSVP spam > 5 kali dari IP sama dalam 10 menit ditolak
- [ ] QR scan ganda dalam <1 detik tidak menyebabkan data corrupt
- [ ] Digital card tetap bisa di-render setelah perubahan
