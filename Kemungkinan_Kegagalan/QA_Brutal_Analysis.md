# QA Brutal Analysis — Wedding Invitation System
**Tanggal:** 27 Juni 2026  
**Cakupan:** index.html (1354 baris), dashboard.js (1401 baris), dashboard.html (673 baris), style.css (624 baris), dashboard.css (593 baris), SQL schema (5 tables), Playwright tests (119 baris)

---

## 1. Security Vulnerabilities

### 1.1 — XSS via `escapeAttr()` Tidak Lengkap (KRITIS)

**Lokasi:** `dashboard.js:86-88`  
**Kode:**
```js
function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
```
**Masalah:** Hanya meng-escape `'` dan `"`. Karakter `<`, `>`, `` ` `` tidak disentuh. Fungsi ini dipakai di `renderTamuTable()` baris 661-666 untuk menyisipkan `onclick` string:
```js
'<button class="btn-sm" onclick="copyGuestLink(\'' +
escapeAttr(t.nama) + ...
```
**Eksploitasi:** Nama tamu: `"><script>alert(1)</script>` akan menyisipkan tag script ke dalam atribut onclick.  
**Dampak:** XSS stored — siapa pun yang membuka dashboard dan melihat tabel tamu akan mengeksekusi script.  
**Fix:** Gunakan `encodeURIComponent()` untuk atribut onclick, atau escape semua karakter HTML (`<`, `>`, `&`, `"`, `'`, `` ` ``).

### 1.2 — RSVP INSERT Tanpa Validasi (KRITIS)

**Lokasi:** `index.html:1008-1017`, SQL: `rsvps` table RLS `insert to anon with check (true)`  
**SQL Schema:**
```sql
CREATE TABLE public.rsvps (
  ...
  nama text NOT NULL,
  nomor_wa text NOT NULL,
  jumlah_hadir integer NOT NULL CHECK (jumlah_hadir > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['Hadir', 'Tidak Hadir'])),
  ...
);
```
**Masalah:** Supabase anon key hardcoded di frontend (`index.html:941-943`). RLS untuk INSERT `rsvps` mengizinkan siapa pun. Tidak ada captcha, rate limiting, atau validasi origin.  
**Dampak:** Bot dapat membanjiri database dengan ribuan RSVP palsu dalam hitungan detik.  
**CVE-equivalent:** Unauthenticated mass INSERT via public anon key + open RLS policy.  
**Fix:** Implementasi Google reCAPTCHA v3 sebelum submit, atau rate limiting via Supabase.

### 1.3 — Nama RSVP Tanpa `maxlength` (KRITIS)

**Lokasi:** `index.html:330-338`  
**Masalah:** Field `<input id="nama">` tidak memiliki atribut `maxlength`. Tabel `rsvps.nama` adalah `text NOT NULL` tanpa batasan panjang.  
**Dampak:** User dapat mengirim nama >= 10.000 karakter, memenuhi storage, merusak layout tabel dashboard, dan berpotensi DoS.  
**Fix:** Tambah `maxlength="100"` di HTML dan constraint `CHECK (char_length(nama) <= 100)` di SQL.

### 1.4 — Guestbook Profanity Filter Substring (HIGH)

**Lokasi:** `index.html:1116-1122`  
**Kode:**
```js
function sensorKataKasar(text) {
  var lower = text.toLowerCase();
  for (var i = 0; i < KATA_KASAR.length; i++) {
    if (lower.indexOf(KATA_KASAR[i]) !== -1) return true;
  }
  return false;
}
```
**Masalah:** `indexOf()` substring matching. `"babi"` di `"babikon"` terdeteksi (false positive). Dapat dilewati dengan: spasi (`b a b i`), Unicode homoglyph, atau karakter ASCII alternatif.  
**KATA_KASAR list (baris 1095-1114):** 18 kata, termasuk "anjing", "babi", "bangsat", "goblok", "tolol", "bodoh", "kontol", "memek", "jancok", "jancuk", "ngentot", "bajingan", "brengsek", "laknat", "sialan", "kampret", "bego", "setan".  
**Fix:** Gunakan regex word boundary (`\b`) atau library NLP.

### 1.5 — UUID QR Token Predictable via Math.random() (HIGH)

**Lokasi:** `index.html:987-996`  
**Kode:**
```js
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
```
**Masalah:** Jika `crypto.randomUUID()` tidak tersedia (HTTP, Safari lawas), fallback ke `Math.random()` yang tidak aman secara kriptografis. QR token adalah kredensial check-in — jika diprediksi, tamu palsu bisa check-in.  
**Fix:** Wajibkan HTTPS (sudah via Netlify) dan hapus fallback `Math.random()` — paksa crash jika `crypto.randomUUID()` tidak ada.

---

## 2. Race Conditions & Concurrency

### 2.1 — QR Check-in Double-scan Race (KRITIS)

**Lokasi:** `dashboard.js:1148-1155`  
**Kode:**
```js
await sb.from("guest_checkins").insert([{ rsvp_id: tamu.id, ... }]);
await sb.from("rsvps").update({ checked_in: true }).eq("id", tamu.id);
```
**Skenario:** Scanner memicu `onScanSuccess` dua kali dalam <100ms untuk QR yang sama.  
1. INSERT #1 sukses → `guest_checkins` unik constraint terpenuhi  
2. INSERT #2 gagal (`guest_checkins_rsvp_unq` unique violation) — error catch ke "Gagal memproses check-in"  
3. UPDATE #1 dan UPDATE #2 keduanya jalan (UPDATE `checked_in=true` dua kali, idempoten)

**Skenario lebih berbahaya:**  
1. INSERT #1 sukses, tapi UPDATE #1 gagal (network timeout)  
2. INSERT #2 gagal, masuk catch → `stopScanner()`  
3. **RSVP tidak pernah di-mark `checked_in=true`** meskipun ada record di `guest_checkins`  

**SQL constraint relevan:** `guest_checkins_rsvp_unq UNIQUE (rsvp_id)`  
**Fix:** Bungkus INSERT + UPDATE dalam satu transaksi atomik via Supabase RPC.

### 2.2 — Polling 30 Detik Tidak Pernah Di-clear (HIGH)

**Lokasi:** `dashboard.js:1382-1397`  
**Kode:**
```js
setInterval(async function () {
  // polling approval count...
}, 30000);
```
**Masalah:** `setInterval` ID tidak disimpan. Saat logout (baris 220-232), interval terus berjalan. Login lagi → interval baru bertumpuk.  
**Dampak:** Setelah 3x login/logout, ada 3 polling paralel = 90 request/menit ke Supabase.  
**Fix:** Simpan ID: `var pollTimer = setInterval(...)` dan `clearInterval(pollTimer)` di logout handler.

### 2.3 — Dashboard Tab Switch Double Load (MEDIUM)

**Lokasi:** `dashboard.js:178-199`, `dashboard.js:114-121`  
**Masalah:** `enterDashboard()` (dipanggil saat login sukses) memanggil `loadOverview()`, `loadTamuRSVP()`, `loadGuestbook()`, `loadCheckinLog()` sekaligus. Tab default adalah overview (tab-overview). Tapi `loadOverview()` juga dipanggil oleh `switchTab("tab-overview")` di inisialisasi default. Jadi overview di-load dua kali.  
**Fix:** Hapus eager load di `enterDashboard()`, serahkan ke `switchTab()` yang lazy-load.

---

## 3. Data Integrity

### 3.1 — Promise.all Partial Failure (KRITIS)

**Lokasi:** `dashboard.js:486-497`  
**Kode:**
```js
var [guestsRes, rsvpsRes] = await Promise.all([
  sb.from("guests").select(...),
  sb.from("rsvps").select(...).limit(500),
]);
if (guestsRes.error) throw guestsRes.error;
if (rsvpsRes.error) throw rsvpsRes.error;
```
**Masalah:** Jika salah satu query gagal (timeout), `Promise.all` throw dan semua data hilang. Baris 498-499 cek error secara terpisah, tapi `Promise.all` sudah gagal duluan.  
**Skenario:** Network glitch 1 detik — query guests gagal, rsvps berhasil. Keduanya dibuang. Error screen.  
**Fix:** Gunakan `Promise.allSettled()` atau try/catch per query.

### 3.2 — Guests Table Tanpa Limit (HIGH)

**Lokasi:** `dashboard.js:488-489`  
**Kode:**
```js
sb.from("guests").select("id, slug, name, pronoun, invited_count, created_at, side, nomor_wa")
```
**Masalah:** Tidak ada `.limit()`. Jika tabel guests memiliki 5000 baris, semua di-fetch ke memori. Web akan crash.  
**Fix:** Tambah `.limit(1000)` atau implementasi server-side pagination.

### 3.3 — RSVP Limit 500 Hardcoded (HIGH)

**Lokasi:** `dashboard.js:496`  
**Kode:**
```js
.limit(500)
```
**Masalah:** Hanya 500 RSVP terbaru yang di-fetch. Wedding dengan 800 tamu → 300 RSVP tidak muncul di dashboard.  
**Fix:** Implementasi pagination server-side dengan infinite scroll atau load more.

### 3.4 — Orphan Auto-match Heuristic Fragile (HIGH)

**Lokasi:** `dashboard.js:457-479`  
**Kode:**
```js
if (name === gName) score += 3;
else if (name.indexOf(gName) !== -1 || gName.indexOf(name) !== -1) score += 1;
if (wa && g.nomor_wa && wa === g.nomor_wa.trim()) score += 5;
return bestScore >= 2 ? best : null;
```
**Masalah:**  
- "Andi" dan "Andi P" → score 3 (exact match? Tidak, karena `name === gName` perlu exact). Sebenarnya substring match score 1. Tapi "Andi" vs "Andi" → score 3. OK.  
- Nomor WA format tidak seragam: `08123456789` vs `+628123456789` → score 0.  
- Threshold 2 terlalu rendah: substring match (score 1) + nomor WA beda format (0) = tidak match. Tapi substring "An" di "Andi" dan "Ani" → score 1 → tidak match. OK.  
- **Edge case:** Nama "Joko" dan "Joko Widodo" → substring cocok (score 1). Jika keduanya tidak punya WA → score 1 < 2 → tidak match. Benar.  
- **Edge case berbahaya:** Jika 2 guest berbeda punya nama sama "Budi" → score 3 + WA match 5 = 8. Orphan RSVP "Budi" dengan WA bisa match ke guest "Budi" yang salah (jika ada duplikasi nama).  
**Fix:** Validasi manual oleh admin, jangan auto-match.

### 3.5 — Guestbook Auto-approved by Default (MEDIUM)

**SQL Schema:**
```sql
CREATE TABLE public.guestbook (
  ...
  is_approved boolean NOT NULL DEFAULT true,
  ...
);
```
**Lokasi:** `index.html:1310-1312` (INSERT tidak kirim `is_approved` field)  
**Masalah:** Semua pesan guestbook langsung approved tanpa review. Nilai default `true` di schema berarti tidak ada moderasi. Dashboard menyediakan tombol "Sembunyikan" (hide), tapi pesan yang tidak pantas sudah sempat tampil publik.  
**Fix:** Ubah default ke `false`. Admin harus approve manual.

---

## 4. Error & Null Handling

### 4.1 — Login `catch` Tidak Menangani `verifyAdmin()` Error (HIGH)

**Lokasi:** `dashboard.js:153-174`  
**Kode:**
```js
try {
  var res = await sb.auth.signInWithPassword({...});
  if (res.error) { ... return; }
  var isAdmin = await verifyAdmin(res.data.user);  // bisa throw!
  if (!isAdmin) { ... return; }
} catch (err) {
  setLoginError("Tidak bisa terhubung ke server. Coba lagi.");
} finally {
  setLoginLoading(false);
}
```
**Masalah:** Jika `verifyAdmin()` throw (RPC timeout, network error), `catch` menangkap dan set login error. Tapi `finally` set loading false. Flow:  
1. Login sukses (email/password benar)  
2. `verifyAdmin()` gagal karena network error  
3. Error "Tidak bisa terhubung" muncul  
4. User melihat error tapi tidak tahu bahwa login sebenarnya berhasil  
5. User tidak bisa masuk meskipun kredensial benar  
**Fix:** Tangani error RPC secara spesifik. Pisahkan login flow dari admin verification.

### 4.2 — Guestbook Error Tidak Ditampilkan (MEDIUM)

**Lokasi:** `dashboard.js:961-979`  
**Kode:**
```js
async function loadGuestbook() {
  document.getElementById("gb-status").classList.remove("show");
  document.getElementById("gb-empty").style.display = "none";
  try {
    var res = await sb.from("guestbook").select(...);
    if (res.error) throw res.error;
    allGb = res.data || [];
    renderGbList();
  } catch (err) {
    document.getElementById("gb-status").textContent = "Gagal memuat guestbook.";
    document.getElementById("gb-status").classList.add("show");
  }
}
```
**Masalah:** Error hanya menampilkan pesan statis. Tidak ada tombol retry, tidak ada logging error detail ke console. User harus refresh halaman atau klik tab lain.  
**Fix:** Tambah tombol "Coba lagi" seperti di overview dan tamu tab.

### 4.3 — `allTamu` State Mutation Race (MEDIUM)

**Lokasi:** `dashboard.js:507` (`allTamu = []`), `dashboard.js:482-577`  
**Masalah:** `allTamu` adalah array global yang di-reset dan diisi ulang setiap `loadTamuRSVP()`. Jika fungsi dipanggil dua kali cepat (misal user double-click refresh, atau polling bersamaan dengan manual load), data dari panggilan pertama bisa tercampur dengan panggilan kedua karena JavaScript async tanpa lock.  
**Skenario:**  
1. Panggilan A: `allTamu = []` → fetch guests (pending)  
2. Panggilan B: `allTamu = []` → fetch guests (pending)  
3. Response A tiba → push data ke `allTamu`  
4. Response B tiba → push data ke `allTamu` (allTamu sekarang = A + B = duplikasi)  
**Fix:** Gunakan pattern abort atau guard variable (`isLoading` flag).

---

## 5. Logic Bugs

### 5.1 — `disableScroll()` Closure Capture by Value (HIGH)

**Lokasi:** `index.html:733-743`  
**Kode:**
```js
function disableScroll() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  window.onscroll = function () {
    window.scrollTo(scrollTop, scrollLeft);  // nilai captured ONCE
  };
  rootElement.style.scrollBehavior = "auto";
}
```
**Masalah:** `scrollTop` dan `scrollLeft` adalah angka primitif yang di-capture saat `disableScroll()` dipanggil. Setiap user scroll, browser paksa scroll ke posisi yang sama. Tapi jika ada programmatic scroll (AOS, IntersectionObserver, URL hash navigation), akan terjadi fight: program ingin scroll ke posisi baru, `window.onscroll` paksa balik.  
**Dampak:** Scroll terasa "laggy" atau melompat. Jika user klik "Lihat Undangan" sebelum DOM siap, `enableScroll()` mungkin gagal karena `rootElement` belum ada (baris 727 querySelector dipanggil di script block sebelumnya — jadi aman).  
**Trivia:** `scrollTop` dan `scrollLeft` adalah `const` — mereka tidak bisa di-reassign.  

### 5.2 — `renderDigitalCard()` html2canvas Binary (HIGH)

**Lokasi:** `index.html:1040-1086`  
**Kode:**
```js
var canvas = await html2canvas(card, { scale: 2, useCORS: true });
canvas.toBlob(function (blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "Undangan_" + nama.replace(/\s+/g, "_") + ".png";
  a.click();
  ...
}, "image/png");
```
**Masalah:**  
1. Elemen `#digital-card` memiliki `display: none` + `position: fixed; left: -9999px`. html2canvas mungkin gagal merender elemen di luar viewport (terbukti di mobile Safari).  
2. `canvas.toBlob()` adalah callback-based — jika error di dalam callback, `try/catch` tidak menangkap (Unhandled Promise).  
3. Tidak ada timeout — jika html2canvas hang, user tunggu selamanya.  
**Fix:** Clone elemen ke dalam viewport untuk render. Promisify `toBlob()`. Tambah timeout 10 detik.

### 5.3 — `submitRSVP()` Selalu Return `is_approved: true` (MEDIUM)

**Lokasi:** `index.html:999-1027`  
**Kode:**
```js
async function submitRSVP(guestId, namaInput, jumlahInput, ...) {
  const qrToken = generateUUID();
  const { error } = await supabaseClient.from("rsvps").insert([{ ... }]);
  if (error) throw error;
  return {
    is_approved: true,  // <-- HARDCODED!
    qr_token: qrToken,
    ...
  };
}
```
**Masalah:** `is_approved` di-return sebagai `true` tanpa cek apakah insert benar-benar menghasilkan `is_approved = true`. Di SQL schema, `rsvps.is_approved` default-nya `true`, jadi untuk `jumlah_hadir <= 2` ini benar. Tapi kode di `index.html:833` langsung ngecek `rsvpResult.is_approved` — jika suatu saat default schema diubah ke `false`, kode ini akan tetap return `true`.  
**Fix:** Fetch kembali data setelah insert, atau gunakan `returning("*")`.

### 5.4 — Edit Orphan Slug Collision (MEDIUM)

**Lokasi:** `dashboard.js:736-745`  
**Kode:**
```js
var baseSlug = entry.nama.toLowerCase().replace(/\s+/g, "-");
var slug = baseSlug;
var slugNum = 1;
while (allTamu.some(function (t) { return t._slug === slug; })) {
  slug = baseSlug + "-" + slugNum++;
}
```
**Masalah:** Deteksi duplikasi slug hanya terhadap `allTamu` — array global yang mungkin tidak lengkap (limit 500 RSVP, guests tanpa limit). Jika ada guest dengan slug yang sama di database tapi tidak di-fetch ke `allTamu`, slug akan dianggap unik dan INSERT akan gagal (unique constraint `guests.slug`).  
**Dampak:** Error "Slug sudah digunakan" muncul padahal user tidak melihat duplikat.

### 5.5 — `fetchGuest()` Declared Twice (LOW)

**Lokasi:** `index.html:820` (dalam closure) vs `index.html:980` (global)  
**Masalah:** Fungsi global `fetchGuest()` dideklarasikan di baris 980. Tapi di baris 820, ada `const guest = await fetchGuest(slug)` — ini merujuk ke fungsi global (closure tidak punya deklarasi sendiri). Harmless karena hoisting, tapi membingungkan.  
**Fix:** Hapus deklarasi global, pindahkan ke atas sebelum digunakan.

---

## 6. Performance

### 6.1 — Guestbook Pagination Double Query (MEDIUM)

**Lokasi:** `index.html:1206-1220`  
**Kode:**
```js
var countRes = await supabaseClient.from("guestbook").select("id", { count: "exact", head: true }).eq("is_approved", true);
// ...
var res = await supabaseClient.from("guestbook").select("nama, pesan, created_at").eq("is_approved", true).order("created_at", { ascending: false }).range(from, to);
```
**Masalah:** Dua query sequential. `count.exact` memakan resource di PostgreSQL untuk tabel besar. Untuk guestbook dengan 10.000 entri, COUNT(*) scan semua baris.  
**Fix:** Hapus `count: "exact"` → gunakan `count: "estimated"`. Atau implementasi cursor-based pagination.

### 6.2 — Render Ulang Tbody Setiap Filter (MEDIUM)

**Lokasi:** `dashboard.js:592-676`  
**Masalah:** Setiap perubahan filter/search, seluruh `<tbody>` dihapus (`innerHTML = ""`) dan di-render ulang dari awal. Untuk 500 tamu, 500 DOM insertions.  
**Fix:** Gunakan DocumentFragment atau virtual DOM approach.

### 6.3 — Activity Log Client-side Pagination (MEDIUM)

**Lokasi:** `dashboard.js:375-398`  
**Masalah:** Semua RSVP + guestbook di-fetch tanpa limit, lalu pagination di client. Untuk data besar (10.000+), transfer data sia-sia.  
**Fix:** Pindahkan pagination ke server-side (`range()` dan `count()` di query).

### 6.4 — Guestbook Limit 500 (MEDIUM)

**Lokasi:** `dashboard.js:970`  
**Kode:**
```js
.limit(500)
```
**Masalah:** Guestbook dengan 1000+ pesan hanya menampilkan 500 terbaru di dashboard.  
**Fix:** Implementasi server-side pagination.

---

## 7. UX / Usability

### 7.1 — Scanner One-shot Only (MEDIUM)

**Lokasi:** `dashboard.js:1163, 1127, 1144, 1170`  
**Masalah:** QR scanner berhenti setelah satu scan (sukses/error/gagal). Untuk event dengan 200 tamu, admin harus klik "Mulai Scan" 200 kali.  
**Fix:** Opsi continuous scan mode.

### 7.2 — No Loading State Awal Guestbook (MEDIUM)

**Lokasi:** `index.html:1257-1273`  
**Masalah:** `retryFetchGuestbook(0)` dipanggil tanpa menampilkan loading state. Area guestbook kosong selama fetch.  
**Fix:** Tampilkan `gb-loading` sebelum fetch.

### 7.3 — Toast Collision (LOW)

**Lokasi:** `dashboard.js:38-46` (dashboard), `index.html:946-963` (public)  
**Masalah:** Dua implementasi toast berbeda. Dashboard punya `toastTimer` global. Public page buat toast baru setiap panggilan. Keduanya punya durasi 3200ms.  
**Fix:** Satu implementasi konsisten.

### 7.4 — Copy Link Fallback Prompt (LOW)

**Lokasi:** `dashboard.js:704-705`  
**Kode:**
```js
.catch(function () { prompt("Salin link ini:", link); });
```
**Masalah:** `prompt()` tidak didukung di beberapa browser mobile.  
**Fix:** Select text otomatis atau fallback modal custom.

---

## 8. Cross-browser & Compatibility

### 8.1 — `crypto.randomUUID()` di HTTP (HIGH)

**Lokasi:** `index.html:988-989`  
**Masalah:** `crypto.randomUUID()` hanya tersedia di HTTPS. Jika diakses via HTTP (development local), fallback ke `Math.random()` yang tidak aman.  
**Fix:** Wajibkan HTTPS.

### 8.2 — `toLocaleString` `dateStyle` (MEDIUM)

**Lokasi:** `dashboard.js:60-62`  
**Kode:**
```js
return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
```
**Masalah:** `dateStyle`/`timeStyle` didukung di Chrome 77+, Firefox 71+, Safari 14.1+. iOS <14.5 tidak mendukung → fallback ke format default yang mungkin berbeda.  
**Fix:** Manual date formatting sebagai fallback.

### 8.3 — `backdrop-filter` di Firefox (LOW)

**Lokasi:** `style.css:437`, `dashboard.css:220`  
**Masalah:** Firefox lawas dan IE tidak mendukung `backdrop-filter`. Efek glass-morphism hilang.  
**Dampak:** Visual only — tidak ada dampak fungsional.

---

## 9. Schema & Constraint Issues

### 9.1 — `rsvps.nomor_wa` NOT NULL Tapi Bisa Kosong dari Admin (MEDIUM)

**SQL Schema:**
```sql
nomor_wa text NOT NULL
```
**Lokasi:** `dashboard.js:874-881`, `dashboard.js:908-914`  
**Masalah:** Admin bisa menyimpan guest tanpa nomor WA (`gf-nomor-wa` tidak required di modal). Tapi di database `rsvps.nomor_wa` adalah `NOT NULL`. Jika admin simpan tanpa WA, kode mengirim `nomor_wa: nomorWa || null` — ini akan gagal karena `NOT NULL`.  
**Crash scenario:**  
1. Admin buka modal edit tamu  
2. Kosongkan field "Nomor WA"  
3. Klik Simpan → error `"null value in column nomor_wa violates not-null constraint"`  
4. Error messaging menunjukkan `"Gagal menyimpan: null value..."` — user-facing message bocorkan detail database.  
**Fix:** Jadikan `gf-nomor-wa` required di modal, atau ubah schema ke nullable.

### 9.2 — `rsvps.status` CHECK Constraint Bisa Dilewati (MEDIUM)

**SQL Schema:**
```sql
status text NOT NULL CHECK (status = ANY (ARRAY['Hadir'::text, 'Tidak Hadir'::text]))
```
**Lokasi:** `dashboard.js:904`  
**Masalah:** Admin bisa menyimpan guest dengan status `""` (empty string) karena kode mengirim `status: status` di mana status bisa `""` dari `<select>` default. Tapi jika admin pilih "Pilih status" (value `""`), kode di baris 904 (`var status = document.getElementById("gf-status").value`) mengirim string kosong. SQL `CHECK` akan reject karena `""` tidak ada di array.  
**Skenario:** Error `"new row violates check constraint"` tanpa pesan user-friendly.  
**Fix:** Validasi status sebelum INSERT, atau kirim `null` jika tidak dipilih.

### 9.3 — `guest_checkins.checked_in_by` Tidak Pernah Diisi (MEDIUM)

**SQL Schema:**
```sql
checked_in_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL
```
**Lokasi:** `dashboard.js:1148-1154` (QR), `dashboard.js:1228-1234` (manual)  
**Masalah:** Kolom `checked_in_by` tidak pernah diisi oleh kode. Selalu `null` meskipun admin login. Tidak ada audit trail siapa yang melakukan check-in.  
**Fix:** Set `checked_in_by: currentUser.id` saat INSERT.

---

## 10. Testing Coverage Gaps

### 10.1 — Semua Test Hanya DOM Presence (KRITIS)

**Lokasi:** `qa/wedding.spec.js`  
**Total test:** 13  
**Test coverage:**  
- ✅ DOM element existence: 13/13  
- ❌ Form submission: 0/13  
- ❌ API mock: 0/13  
- ❌ RSVP flow: 0/13  
- ❌ Guestbook CRUD: 0/13  
- ❌ Login/logout: 0/13  
- ❌ QR scan simulation: 0/13  
- ❌ Error states: 0/13  
- ❌ Pagination: 0/13  
- ❌ Profanity filter: 0/13  
- ❌ Digital card download: 0/13  

**Dampak:** Regresi fungsional tidak terdeteksi. Perubahan pada logic submit RSVP, guestbook, atau auth tidak akan mempengaruhi test.  
**Fix:** Tambah test dengan Supabase mocking (e.g., MSW atau Supabase local emulator).

### 10.2 — Tidak Ada Unit Test (HIGH)

**Fungsi tanpa test:**
- `escapeHtml()` — XSS prevention  
- `escapeAttr()` — XSS prevention  
- `sensorKataKasar()` — profanity filter  
- `autoMatchOrphan()` — data integrity  
- `generateUUID()` — QR token security  
- `disableScroll()` / `enableScroll()` — UX-critical  
- `formatDate()` / `formatTime()` — formatting consistency  

**Fix:** Minimal 1 test per fungsi kritis.

---

## Summary

| Prioritas | Jumlah | Kategori |
|-----------|-------|----------|
| 🔴 KRITIS | 5 | XSS, No CSRF, No maxlength, Race condition, Test coverage |
| 🟠 HIGH | 11 | Partial failure, No limit, Heuristic fragile, Polling leak, crypto, etc |
| 🟡 MEDIUM | 15 | Logging, UX, Pagination, Auto-approve, Constraint issues |
| ⚪ LOW | 4 | Toast, Fallback, backdrop-filter, fetchGuest duplicate |
| **Total** | **35** | |

### Immediate Action (Top 5)

1. **Fix `escapeAttr()`** — Tambah escape `<`, `>`, `` ` `` — **XSS critical**
2. **Tambah `maxlength`** di input nama RSVP — **DoS prevention**
3. **Clear polling on logout** — `clearInterval` di logout handler
4. **Implementasi reCAPTCHA** — atau rate limiting di RSVP form
5. **Bungkus check-in INSERT+UPDATE** dalam satu transaksi atomik
