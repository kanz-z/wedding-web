---
type: debt
priority: medium
created: 2026-06-27
status: implemented
tags: [data-integrity, performance, ux, schema, compatibility]
keywords: [guestbook, auto-approve, pagination, filter, tbody, activity-log, scanner, loading, toast, toLocaleString, backdrop-filter, nomor_wa, status, checked_in_by]
patterns: [pagination, rendering, UX, schema constraints, format compatibility]
---

# DEBT-MEDIUM: Perbaikan 14 Temuan MEDIUM — Data Integrity, Performance, UX, Schema

## Daftar Temuan
1. **3.5 — Guestbook Auto-approved by Default** (SQL schema)
2. **6.1 — Guestbook Pagination Double Query** (index.html:1206-1220)
3. **6.2 — Render Ulang Tbody Setiap Filter** (dashboard.js:592-676)
4. **6.3 — Activity Log Client-side Pagination** (dashboard.js:375-398)
5. **6.4 — Guestbook Limit 500** (dashboard.js:970)
6. **7.1 — Scanner One-shot Only → Continuous Scan** (dashboard.js:1163, 1127, 1144, 1170)
7. **7.2 — No Loading State Awal Guestbook** (index.html:1257-1273)
8. **7.3 — Toast Collision** (dashboard.js:38-46, index.html:946-963)
9. **7.4 — Copy Link Fallback Prompt** (dashboard.js:704-705)
10. **8.2 — toLocaleString dateStyle** (dashboard.js:60-62)
11. **8.3 — backdrop-filter di Firefox** (style.css:437, dashboard.css:220)
12. **9.1 — rsvps.nomor_wa NOT NULL Tapi Bisa Kosong dari Admin** (dashboard.js:874-881, 908-914)
13. **9.2 — rsvps.status CHECK Constraint Bisa Dilewati** (dashboard.js:904)
14. **9.3 — guest_checkins.checked_in_by Tidak Pernah Diisi** (dashboard.js:1148-1154, 1228-1234)

---

## 3.5 — Guestbook Auto-approved by Default

### Masalah
Di SQL schema, `is_approved` default `true`:
```sql
is_approved boolean not null default true,
```
Semua pesan guestbook langsung approved tanpa review. Dashboard ada tombol "Sembunyikan" tapi pesan tidak pantas sudah sempat tampil publik.

### Solusi
1. **Schema change (penjelasan):**
   - **Sekarang:** `is_approved` default `true` — pesan langsung tampil
   - **Diubah:** default `false` — admin harus approve manual
   - **Record existing:** tetap apa adanya (yang sudah approved tetap approved)
2. Admin dashboard: tambah tab/filter "Pending Approval" di guestbook

### Perubahan
- **File baru:** `MD&DOC/supabase_migration_v3.sql` — alter default `is_approved`
- **File:** `dashboard.js` — tambah filter pending approval di guestbook

---

## 6.1 — Guestbook Pagination Double Query

### Masalah
Di `index.html:1206-1220`, dua query sequential:
```js
var countRes = await supabaseClient.from("guestbook").select("id", { count: "exact", head: true })...
var res = await supabaseClient.from("guestbook").select("nama, pesan, created_at")...
```
`count: "exact"` scan semua baris di PostgreSQL untuk tabel besar.

### Solusi
Ganti `count: "exact"` dengan `count: "estimated"` (kurang akurat tapi jauh lebih cepat) atau hapus count dan implementasi cursor-based pagination.

### Perubahan
- **File:** `index.html` — baris 1207, ganti `count: "exact"` → `count: "estimated"`

---

## 6.2 — Render Ulang Tbody Setiap Filter

### Masalah
Di `dashboard.js:592-676`, setiap filter/search, seluruh `<tbody>` dihapus (`innerHTML = ""`) dan di-render ulang. Untuk 500 tamu → 500 DOM insertions.

### Solusi
Gunakan **DocumentFragment** untuk batch DOM insertion:
```js
var fragment = document.createDocumentFragment();
// append rows ke fragment
tbody.innerHTML = "";
tbody.appendChild(fragment);
```

### Perubahan
- **File:** `dashboard.js` — fungsi render tabel, pakai DocumentFragment

---

## 6.3 — Activity Log Client-side Pagination

### Masalah
Di `dashboard.js:375-398`, semua RSVP + guestbook di-fetch tanpa limit, lalu pagination di client. Untuk data besar (10.000+) transfer data sia-sia.

### Solusi
Pindahkan pagination ke server-side: pakai `.range()` dan `.count()` di query Supabase.

### Perubahan
- **File:** `dashboard.js` — implementasi server-side pagination di activity log

---

## 6.4 — Guestbook Limit 500

### Masalah
`.limit(500)` di `dashboard.js:970`. Guestbook dengan 1000+ pesan hanya tampil 500 terbaru.

### Solusi
Implementasi server-side pagination, atau naikkan limit ke 2000.

### Perubahan
- **File:** `dashboard.js` — naikkan limit atau implementasi pagination

---

## 7.1 — Scanner One-shot Only → Continuous Scan

### Masalah
QR scanner berhenti setelah satu scan (sukses/error/gagal). Admin harus klik "Mulai Scan" 200 kali untuk 200 tamu.

### Solusi
Ubah ke **continuous scan mode**:
1. Setelah scan sukses → delay 1.5 detik (biar tidak scan QR sama dua kali) → restart scanner otomatis
2. Setelah scan error → langsung restart
3. Sediakan tombol **"Stop Scan"** untuk menghentikan scanner secara manual
4. Indikator visual bahwa scanner aktif (misal border hijau berkedip)

### Perubahan
- **File:** `dashboard.js` — fungsi scanner, tambah auto-restart + stop button

---

## 7.2 — No Loading State Awal Guestbook

### Masalah
`retryFetchGuestbook(0)` dipanggil tanpa menampilkan loading state. Area guestbook kosong selama fetch.

### Solusi
Tampilkan spinner/loading text sebelum fetch dimulai, sembunyikan setelah data diterima.

### Perubahan
- **File:** `index.html` — tambah loading state sebelum fetch guestbook

---

## 7.3 — Toast Collision

### Masalah
Dua implementasi toast berbeda:
- Dashboard: punya `toastTimer` global — timer bisa overwrite
- Public page: buat toast baru setiap panggilan
- Keduanya durasi 3200ms

### Solusi
Satu implementasi konsisten. Pilih salah satu (misal yang di dashboard) dan pakai di kedua tempat.

### Perubahan
- **File:** `dashboard.js` dan `index.html` — konsolidasi implementasi toast

---

## 7.4 — Copy Link Fallback Prompt

### Masalah
Di `dashboard.js:704-705`:
```js
.catch(function () { prompt("Salin link ini:", link); });
```
`prompt()` tidak didukung di beberapa browser mobile.

### Solusi
Ganti fallback `prompt()` dengan select text otomatis (membuat `<textarea>` temporary, select, execCommand copy) atau modal custom.

### Perubahan
- **File:** `dashboard.js` — ganti prompt() dengan fallback copy modern

---

## 8.2 — toLocaleString dateStyle

### Masalah
Di `dashboard.js:60-62`:
```js
return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
```
`dateStyle`/`timeStyle` tidak didukung di iOS <14.5.

### Solusi
Tambah fallback manual formatting untuk browser yang tidak mendukung `dateStyle`.

### Perubahan
- **File:** `dashboard.js` — fungsi formatDate, tambah fallback

---

## 8.3 — backdrop-filter di Firefox

### Masalah
Firefox lawas dan IE tidak mendukung `backdrop-filter`. Efek glass-morphism hilang.

### Solusi
Tambah CSS fallback dengan `background-color: rgba(0,0,0,0.8)` untuk browser yang tidak support `backdrop-filter`.

### Perubahan
- **File:** `style.css` dan `dashboard.css` — tambah fallback untuk backdrop-filter

---

## 9.1 — rsvps.nomor_wa NOT NULL Tapi Bisa Kosong dari Admin

### Masalah
**Schema change (penjelasan):**
- **Sekarang:** `nomor_wa text NOT NULL` — semua RSVP harus punya nomor WA
- **Masalah:** Admin bisa kosongkan field nomor WA di modal edit tamu. Kode kirim `nomor_wa: nomorWa || null` → error `"null value in column nomor_wa violates not-null constraint"`
- **Diubah:** `nomor_wa` menjadi nullable (`DROP NOT NULL`)
- Untuk tamu dengan `jumlah_hadir > 2` dan `nomor_wa` NULL saat akan kirim kartu undangan WhatsApp → beri notifikasi ke admin bahwa nomor WA tidak ada

### Solusi
1. Ubah schema: `ALTER TABLE public.rsvps ALTER COLUMN nomor_wa DROP NOT NULL;`
2. Di frontend: validasi saat kirim kartu, jika `nomor_wa` null → tampilkan warning

### Perubahan
- **File:** `MD&DOC/supabase_migration_v3.sql` — drop NOT NULL constraint
- **File:** `dashboard.js` — validasi + notifikasi nomor_wa kosong

---

## 9.2 — rsvps.status CHECK Constraint Bisa Dilewati

### Masalah
Di `dashboard.js:904`, `<select>` default value `""` (string kosong). Jika admin tidak memilih status, kode kirim status: `""` → SQL CHECK (`status in ('Hadir', 'Tidak Hadir')`) reject → error tanpa pesan user-friendly.

### Solusi
Validasi status sebelum INSERT:
```js
if (!status) { showToast("Status harus dipilih", "error"); return; }
```
Atau buat `<select>` required + disabled option sebagai placeholder.

### Perubahan
- **File:** `dashboard.js` — validasi status sebelum save
- **File:** `dashboard.html` — tambah `required` di select status

---

## 9.3 — guest_checkins.checked_in_by Tidak Pernah Diisi

### Masalah
Kolom `checked_in_by` di tabel `guest_checkins` selalu `null` meskipun admin login. Tidak ada audit trail siapa yang check-in.

### Solusi
Set `checked_in_by: currentUser.id` saat INSERT guest_checkins (baik via QR scan maupun manual check-in).

### Perubahan
- **File:** `dashboard.js` — tambah `checked_in_by` di insert check-in

---

## Konteks
Semua temuan dari QA Brutal Analysis (27 Juni 2026). Proyek wedding invitation system — vanilla HTML/CSS/JS + Supabase.

## Success Criteria

### Automated Verification
- [ ] Guestbook baru default `is_approved = false`
- [ ] Guestbook count query pakai `estimated` bukan `exact`
- [ ] DocumentFragment dipakai untuk render tabel
- [ ] Activity log pakai server-side pagination
- [ ] Scanner bisa continuous dengan stop button
- [ ] Loading state muncul sebelum guestbook fetch
- [ ] Toast implementasi konsisten
- [ ] Copy link punya fallback selain prompt()
- [ ] `nomor_wa` nullable — insert tanpa WA tidak error
- [ ] Status empty string tidak lolos ke database
- [ ] `checked_in_by` terisi dengan user ID admin

### Manual Verification
- [ ] Scanner tidak perlu restart manual setelah scan
- [ ] Tombol stop scan berfungsi
- [ ] Admin dapat warning saat nomor WA kosong untuk kirim kartu
- [ ] Guestbook pending visible di dashboard admin
- [ ] copyGuestLink() berfungsi di browser mobile
