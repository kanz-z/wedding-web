---
type: debt
priority: high
created: 2026-06-27
status: implemented
tags: [security, race-condition, data-integrity, error-handling, logic-bug]
keywords: [profanity, UUID, polling, tab-switch, limit, orphan-match, verifyAdmin, allTamu, disableScroll, html2canvas, submitRSVP, slug-collision, fetchGuest, crypto]
patterns: [error handling, race condition, data integrity, pagination, closure]
---

# DEBT-HIGH: Perbaikan 12 Temuan HIGH — Security, Race Condition, Data Integrity, Error Handling

## Deskripsi
Ticket ini mencakup perbaikan untuk **12 temuan HIGH** dari QA Brutal Analysis.

## Daftar Temuan
1. **1.4 — Guestbook Profanity Filter Substring** (index.html:1116-1122)
2. **1.5 — UUID QR Token Predictable via Math.random()** (index.html:987-996)
3. **2.2 — Polling 30 Detik Tidak Pernah Di-clear** (dashboard.js:1382-1397)
4. **2.3 — Dashboard Tab Switch Double Load** (dashboard.js:178-199)
5. **3.2 — Guests Table Tanpa Limit** (dashboard.js:488-489)
6. **3.3 — RSVP Limit 500 Hardcoded** (dashboard.js:496)
7. **3.4 — Orphan Auto-match Heuristic Fragile** (dashboard.js:457-479)
8. **4.1 — Login catch Tidak Menangani verifyAdmin Error** (dashboard.js:153-174)
9. **4.2 — Guestbook Error Tidak Ditampilkan** (dashboard.js:961-979)
10. **4.3 — allTamu State Mutation Race** (dashboard.js:507)
11. **5.1 — disableScroll Closure Capture by Value** (index.html:733-743)
12. **5.2 — renderDigitalCard html2canvas Binary** (index.html:1040-1086)
13. **5.3 — submitRSVP Selalu Return is_approved: true** (index.html:999-1027)
14. **5.4 — Edit Orphan Slug Collision** (dashboard.js:736-745)
15. **5.5 — fetchGuest Declared Twice** (index.html:820, 980)
16. **8.1 — crypto.randomUUID di HTTP** (index.html:988-989)
17. **10.2 — Tidak Ada Unit Test** (global)

---

## 1.4 — Guestbook Profanity Filter Substring

### Masalah
`sensorKataKasar()` di `index.html:1116-1122` menggunakan `indexOf()` — substring matching. "babi" di "babikon" terdeteksi (false positive). Bisa dilewati dengan spasi, Unicode homoglyph, atau karakter ASCII alternatif.

### Solusi
Ganti `indexOf()` dengan **regex word boundary** (`\b`):
```js
function sensorKataKasar(text) {
  var lower = text.toLowerCase();
  for (var i = 0; i < KATA_KASAR.length; i++) {
    var regex = new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i");
    if (regex.test(text)) return true;
  }
  return false;
}
```

### Perubahan
- **File:** `index.html` — fungsi `sensorKataKasar()` baris 1116-1122
- **File:** `qa/wedding.spec.js` — test untuk profanity filter

---

## 1.5 — UUID QR Token Predictable via Math.random()

### Masalah
Di `index.html:987-996`, jika `crypto.randomUUID()` tidak tersedia (HTTP, Safari lawas), fallback ke `Math.random()` yang tidak aman secara kriptografis. QR token adalah kredensial check-in.

### Solusi
Hapus fallback `Math.random()`. Paksa crash jika `crypto.randomUUID()` tidak ada. Project sudah di-deploy via Netlify (HTTPS), jadi `crypto.randomUUID()` seharusnya selalu tersedia.

### Perubahan
- **File:** `index.html` — fungsi `generateUUID()` baris 987-996

---

## 2.2 — Polling 30 Detik Tidak Pernah Di-clear

### Masalah
`setInterval` di `dashboard.js:1382-1397` untuk polling approval count tidak pernah di-clear saat logout. Login lagi → interval baru bertumpuk. Setelah 3x login/logout → 3 polling paralel = 90 request/menit.

### Solusi
1. Simpan ID interval: `var pollTimer = setInterval(...)`
2. Di logout handler (baris 220-232): `clearInterval(pollTimer)`

### Perubahan
- **File:** `dashboard.js` — simpan interval ID + clear di logout

---

## 2.3 — Dashboard Tab Switch Double Load

### Masalah
`enterDashboard()` memanggil `loadOverview()`, `loadTamuRSVP()`, `loadGuestbook()`, `loadCheckinLog()` sekaligus. Tapi `switchTab("tab-overview")` juga memanggil `loadOverview()`. Overview di-load dua kali.

### Solusi
Hapus eager load di `enterDashboard()`, serahkan lazy-load ke `switchTab()`.

### Perubahan
- **File:** `dashboard.js` — baris 178-199, hapus panggilan load di enterDashboard()

---

## 3.2 — Guests Table Tanpa Limit

### Masalah
Query di `dashboard.js:488-489`:
```js
sb.from("guests").select("id, slug, name, pronoun, invited_count, created_at, side, nomor_wa")
```
Tidak ada `.limit()`. Jika 5000 baris → semua di-fetch ke memori. Web bisa crash.

### Solusi
Tambah `.limit(1000)` atau implementasi server-side pagination. Untuk sekarang: `.limit(1000)` sudah cukup.

### Perubahan
- **File:** `dashboard.js` — tambah `.limit(1000)` di query guests

---

## 3.3 — RSVP Limit 500 Hardcoded

### Masalah
`.limit(500)` di `dashboard.js:496`. Wedding dengan 800 tamu → 300 RSVP tidak muncul.

### Solusi
Naikkan limit ke 2000, atau implementasi server-side pagination. Untuk sekarang: naikkan ke 2000.

### Perubahan
- **File:** `dashboard.js` — ubah `.limit(500)` jadi `.limit(2000)`

---

## 3.4 — Orphan Auto-match Heuristic Fragile

### Masalah
`dashboard.js:457-479` — auto-match orphan RSVP ke guest berdasarkan:
- Nama exact match (score 3)
- Substring match (score 1)
- Nomor WA match (score 5)
- Threshold 2

Masalah: Nama duplikat "Budi" → match ke guest yang salah. Nomor WA format beda (`08123` vs `+628123`) → score 0.

### Solusi
Tidak otomatis match. Tandai orphan sebagai "unmatched" dan tampilkan daftar untuk **manual matching** oleh admin. Tambah UI dropdown di dashboard untuk pilih guest manual.

### Perubahan
- **File:** `dashboard.js` — ubah auto-match jadi manual matching dengan UI dropdown

---

## 4.1 — Login catch Tidak Menangani verifyAdmin Error

### Masalah
Di `dashboard.js:153-174`:
```js
try {
  var res = await sb.auth.signInWithPassword({...});
  var isAdmin = await verifyAdmin(res.data.user); // bisa throw!
} catch (err) {
  setLoginError("Tidak bisa terhubung ke server.");
}
```
Jika `verifyAdmin()` throw (RPC timeout), catch menangkap dan tampilkan "Tidak bisa terhubung". User tidak tahu bahwa login sebenarnya berhasil.

### Solusi
Pisahkan login flow dari admin verification:
1. Login → sukses/gagal
2. Jika login sukses, baru verifyAdmin → jika gagal, tampilkan "Verifikasi admin gagal, coba lagi" + tombol retry (jangan logout user)

### Perubahan
- **File:** `dashboard.js` — baris 153-174, pisahkan login dan verifyAdmin

---

## 4.2 — Guestbook Error Tidak Ditampilkan

### Masalah
Di `dashboard.js:961-979`, error loading guestbook hanya tampilkan teks statis "Gagal memuat guestbook." Tidak ada tombol retry.

### Solusi
Tambah tombol "Coba lagi" di status error, sama seperti pattern di overview dan tamu tab.

### Perubahan
- **File:** `dashboard.js` — tambah tombol retry di guestbook error state

---

## 4.3 — allTamu State Mutation Race

### Masalah
`allTamu` adalah array global yang di-reset (`allTamu = []`) dan diisi ulang setiap `loadTamuRSVP()`. Jika fungsi dipanggil dua kali cepat, data dari panggilan pertama bisa tercampur dengan panggilan kedua.

### Solusi
Gunakan guard variable (`isLoadingTamu` flag) untuk mencegah multiple simultaneous loads.

### Perubahan
- **File:** `dashboard.js` — tambah `isLoadingTamu` guard di `loadTamuRSVP()`

---

## 5.1 — disableScroll Closure Capture by Value

### Masalah
Di `index.html:733-743`:
```js
function disableScroll() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  window.onscroll = function () {
    window.scrollTo(scrollTop, scrollLeft);
  };
}
```
`scrollTop`/`scrollLeft` di-capture sekali saat pemanggilan. Setiap programmatic scroll (AOS, IntersectionObserver) akan fight dengan `window.onscroll`.

### Solusi
Tidak ada fix sempurna tanpa menghapus `disableScroll()` entirely. Opsi:
1. Gunakan CSS `overflow: hidden` pada `<body>` sebagai gantinya
2. Atau: tetap pertahankan fungsi ini karena sudah bekerja untuk use case-nya, dokumentasikan keterbatasannya
3. Tambah `enableScroll()` yang benar-benar mereset `window.onscroll = null`

### Perubahan
- **File:** `index.html` — ganti `disableScroll()` pakai CSS `overflow: hidden`, atau dokumentasikan keterbatasan

---

## 5.2 — renderDigitalCard html2canvas Binary

### Masalah
Di `index.html:1040-1086`:
1. Elemen `#digital-card` punya `display: none` + `position: fixed; left: -9999px` — html2canvas bisa gagal di mobile Safari
2. `canvas.toBlob()` callback-based — error di dalam callback tidak tertangkap try/catch
3. Tidak ada timeout — html2canvas bisa hang selamanya

### Solusi
1. Clone elemen ke dalam viewport untuk render
2. Promisify `toBlob()`:
   ```js
   function toBlobAsync(canvas, type) {
     return new Promise(function(resolve, reject) {
       canvas.toBlob(function(blob) {
         if (blob) resolve(blob);
         else reject(new Error("Gagal generate blob"));
       }, type);
     });
   }
   ```
3. Tambah timeout 10 detik via `Promise.race()` dengan setTimeout reject

### Perubahan
- **File:** `index.html` — fungsi `renderDigitalCard()` baris 1040-1086

---

## 5.3 — submitRSVP Selalu Return is_approved: true

### Masalah
Di `index.html:999-1027`, `is_approved` di-hardcode return `true` tanpa cek hasil insert yang sebenarnya. Jika schema diubah default `is_approved` jadi `false`, kode ini akan tetap return `true`.

### Solusi
Gunakan `returning("*")` di query insert untuk mendapatkan data real dari database:
```js
var { data, error } = await supabaseClient
  .from("rsvps")
  .insert([{ ... }])
  .select();
if (error) throw error;
return { is_approved: data[0].is_approved, ... };
```

### Perubahan
- **File:** `index.html` — fungsi `submitRSVP()` baris 999-1027, tambah `.select()`

---

## 5.4 — Edit Orphan Slug Collision

### Masalah
`dashboard.js:736-745` — deteksi duplikasi slug hanya terhadap `allTamu` (array global yang mungkin tidak lengkap). Guest dengan slug sama di database tapi tidak di-fetch → INSERT gagal.

### Solusi
Validasi slug langsung ke database via SELECT query sebelum INSERT:
```js
var existing = await sb.from("guests").select("slug").eq("slug", proposedSlug);
if (existing.data && existing.data.length > 0) {
  // increment slug number
}
```

### Perubahan
- **File:** `dashboard.js` — baris 736-745, validasi slug ke database

---

## 5.5 — fetchGuest Declared Twice

### Masalah
`fetchGuest()` dideklarasikan di `index.html:820` (dalam closure) dan `index.html:980` (global). Harmless tapi membingungkan.

### Solusi
Hapus deklarasi global di baris 980, pindahkan deklarasi ke atas sebelum digunakan.

### Perubahan
- **File:** `index.html` — hapus deklarasi duplikat `fetchGuest()` di baris 980

---

## 8.1 — crypto.randomUUID di HTTP

### Masalah
`crypto.randomUUID()` hanya tersedia di HTTPS. Fallback `Math.random()` tidak aman. Project sudah via Netlify (HTTPS), tapi development local via HTTP bisa kena fallback.

### Solusi
Hapus fallback `Math.random()`. Di development, pastikan pakai localhost HTTPS atau gunakan `https://localhost`. Dokumentasikan requirement HTTPS.

### Perubahan
- **File:** `index.html` — fungsi `generateUUID()` baris 987-996, hapus fallback Math.random()

---

## 10.2 — Tidak Ada Unit Test

### Masalah
Fungsi kritis tanpa test:
- `escapeHtml()` — XSS prevention
- `escapeAttr()` — XSS prevention
- `sensorKataKasar()` — profanity filter
- `autoMatchOrphan()` — data integrity
- `generateUUID()` — QR token security
- `disableScroll()` / `enableScroll()` — UX-critical
- `formatDate()` / `formatTime()` — formatting consistency

### Solusi
Buat file unit test `qa/unit/helpers.test.js` yang test fungsi-fungsi di atas dengan mocking.

### Perubahan
- **File baru:** `qa/unit/helpers.test.js`

---

## Konteks
Semua temuan dari QA Brutal Analysis (27 Juni 2026). Proyek wedding invitation system — vanilla HTML/CSS/JS + Supabase.

## Success Criteria

### Automated Verification
- [ ] Profanity filter tidak false-positive untuk kata seperti "babikon"
- [ ] Polling berhenti setelah logout
- [ ] Overview tidak di-load dua kali saat dashboard dibuka
- [ ] Guests query punya `.limit()`
- [ ] RSVP query pakai `.limit(2000)`
- [ ] Orphan RSVP tampil dengan opsi manual matching
- [ ] verifyAdmin error tidak menutupi login success
- [ ] Guestbook error punya tombol retry
- [ ] `loadTamuRSVP()` duplikat tidak menyebabkan data corrupt
- [ ] digital card render tidak hang >10 detik
- [ ] `submitRSVP()` return data real dari database
- [ ] Slug validasi ke database, bukan hanya allTamu
- [ ] fetchGuest() hanya dideklarasikan sekali
- [ ] Unit test minimal 5 fungsi kritis

### Manual Verification
- [ ] XSS via nama tamu tidak lolos
- [ ] QR token selalu via crypto.randomUUID (tidak pernah Math.random)
- [ ] Login + verifyAdmin error flow user-friendly
- [ ] Digital card tetap terdownload di mobile Safari
