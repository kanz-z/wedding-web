# ARCHITECTURE.md — Wedding Invitation 1

> **Catatan untuk AI Assistant (Claude Code / lainnya) yang membaca file ini:**
> Dokumen ini adalah ground truth arsitektur repo `wedding-invitation-1`, dihasilkan dari audit langsung terhadap source code (bukan asumsi). Sebelum membuat perubahan apapun di repo ini, baca minimal bagian **"Known Issues & Technical Debt"** dan **"Modification Risk Map"** di bawah — itu menentukan area mana yang aman diubah bebas dan mana yang harus hati-hati. Semua referensi baris (`file.ext:N`) akurat per tanggal dokumen ini dibuat; jika file sudah berubah, verifikasi ulang nomor barisnya sebelum dipakai.

**Tanggal dokumen:** 2026-06-21
**Repo:** `elix-stack/wedding-invitation-1`
**Live demo:** https://elix-stack.github.io/wedding-invitation-1/

---

## 1. Ringkasan Eksekutif

Ini adalah **static website satu halaman** (single-page, non-SPA) untuk undangan pernikahan digital. Tidak ada framework JavaScript (bukan React/Vue/Next/dst), tidak ada build tool, tidak ada package manager. Seluruh logic ditulis langsung sebagai vanilla HTML/CSS/JS, di-enhance dengan Bootstrap 5 (CSS framework, bukan JS framework) dan beberapa library kecil yang di-load via CDN.

| Atribut | Nilai |
|---|---|
| Jenis project | Static HTML site, 1 halaman (`index.html`) |
| Framework JS | **Tidak ada** (vanilla JS) |
| CSS Framework | Bootstrap 5.3.5 (via CDN) + custom `style.css` |
| Build tool / bundler | **Tidak ada** |
| Package manager | **Tidak ada** (`package.json` tidak ditemukan) |
| Hosting | GitHub Pages, serve langsung dari branch `main` |
| Backend / database | Tidak ada. "Backend" satu-satunya = Google Apps Script Web App (eksternal, di luar repo) yang nulis ke Google Sheet |
| Routing | Tidak ada (anchor scroll `#id`, bukan client-side router) |
| State management | Tidak ada library. State = variabel JS global + atribut DOM |

**Implikasi penting:** karena tidak ada build step dan tidak ada staging environment, **setiap push ke branch `main` langsung live** di GitHub Pages. Tidak ada jaring pengaman otomatis (no CI, no automated test).

---

## 2. Struktur File

```
wedding-invitation-1/
├── index.html              ← satu-satunya page, 545 baris, semua section ada di sini
├── style.css                ← satu file CSS global, 543 baris
├── README.md                 ← dokumentasi asal (bahasa Inggris), referensi sumber inspirasi
├── LICENSE                   ← MIT License
├── countdown/                 ← library pihak ketiga, di-SELF-HOST (bukan CDN)
│   ├── simplyCountdown.umd.js
│   ├── simplyCountdown.js
│   └── circle.css
├── img/                       ← semua asset visual
│   ├── floraPattern1.png       (background dekoratif section .home)
│   ├── prewed1.jpg              (background hero)
│   ├── prewed2.jpeg              (timeline item pertama)
│   ├── pengantinPria.png         (foto avatar mempelai pria)
│   ├── pengantinWanita.png       (foto avatar mempelai wanita)
│   └── gallery/
│       ├── galleryMain1.jpeg
│       └── tumbnail/
│           ├── gallery1.jpeg … gallery4.jpeg
│           └── galleryMain2.jpeg
└── audio/
    └── cintaVina.mp3           ← backsound, autoplay loop
```

**Tidak ada folder** `src/`, `components/`, `assets/js/`, `dist/`, `.github/`, `.env*`. Ini bukan kelalaian — ini konsisten dengan keputusan desain "static site tanpa build tool" yang terlihat di git log (commit `8830bce`: *"mending bikin css sendiri ... daripada pakai framework"*).

---

## 3. Tech Stack & Dependency Map

| Dependency | Sumber | Self-host / CDN | Fungsi | Kritis? |
|---|---|---|---|---|
| Bootstrap 5.3.5 (CSS + JS bundle) | jsDelivr | CDN | Grid, navbar/offcanvas, card, button | **Ya** |
| Bootstrap Icons 1.11.3 | jsDelivr | CDN | Semua icon (`bi-*`) | Sedang |
| Google Fonts: Pacifico, Sacramento, Work Sans | Google Fonts CDN | CDN | Tipografi tema | Sedang |
| `bs5-lightbox` 1.8.5 | jsDelivr | CDN | Lightbox klik-foto di section Gallery | Hanya relevan jika Gallery dipertahankan |
| `simplyCountdown` | — | **Self-hosted** (`/countdown`) | Render countdown di Hero | **Ya** |
| Google Apps Script Web App | hardcoded URL di `index.html:287` | External service | Endpoint submit form RSVP → Google Sheet | **Ya**, satu-satunya "backend" |
| Disqus (`mywedding1-1.disqus.com`) | embed script | External | Comment/guestbook section | Rendah |
| Google Maps Embed | iframe | External | Peta lokasi venue | Sedang |

Tidak ada dependency yang dikelola lewat lockfile — versi "dikunci" langsung di string URL CDN (`bootstrap@5.3.5`). Upgrade dependency = edit manual URL + manual re-test, tidak ada `npm audit` atau notifikasi otomatis.

---

## 4. Peta Section (`index.html`)

| Section | Baris | Elemen kunci | Sumber data |
|---|---|---|---|
| Hero | 20–29 | `#countdown` (simplyCountdown), CTA "Lihat Undangan" | Hardcoded teks + tanggal di-set 2x (teks HTML & config script baris 407–420) |
| Navbar | 32–54 | Bootstrap offcanvas mobile menu | Hardcoded link anchor |
| Home / Couple | 57–97 | Foto avatar 2 mempelai, bio singkat | Hardcoded, masih ada `Lorem ipsum` |
| Info (Event) | 100–158 | Iframe Google Maps, 2 card (Akad/Resepsi) | Hardcoded alamat & jam |
| Story (Timeline) | 161–217 | `<ul class="timeline">`, alternating kiri-kanan | Hardcoded, 1 foto lokal + 2 placeholder `picsum.photos` |
| Gallery | 220–275 | Grid foto + `bs5-lightbox` | **Inkonsisten**: `<a href>` menuju file lokal asli, tapi `<img src>` thumbnail pakai `picsum.photos` (lihat Known Issues) |
| RSVP | 278–345 | `<form id="my-form">` → `fetch()` POST, embed Disqus | Endpoint Google Apps Script hardcoded baris 287 |
| Gifts | 348–368 | List nomor rekening (Bootstrap `list-group`) | Hardcoded nomor rekening — data sensitif tampil plain di HTML |
| Footer | 371–388 | Copyright, social link (di-comment-out) | — |
| Audio player | 391–399 | `<audio autoplay loop>` + toggle icon | — |
| Scripts (semua logic JS) | 401–541 | 6 blok `<script>` inline, sequential | — |

---

## 5. Arsitektur JavaScript

**Tidak ada module system.** Semua JS adalah inline `<script>` di bagian bawah `<body>`, dieksekusi berurutan sesuai posisi di HTML. Tidak ada `import`/`export`, sehingga variabel-variabel berikut hidup di **global scope**:

```
stickyTop, offcanvas        (script baris ~441)
rootElement, audioIconWrapper, audioIcon, backSong, isPlaying   (script baris ~455)
urlParams, nama, pronoun, namaContainer                          (script baris ~531)
```

Risiko: kalau nanti ditambah library JS lain yang kebetulan mendeklarasikan nama variabel sama secara global, akan terjadi collision tanpa error yang jelas.

### Alur Data Utama (ASCII)

**A. Personalisasi nama tamu via URL**
```
URL: ?n=Budi&p=Bapak
   → URLSearchParams.get('n'/'p')   (index.html:533-534)
   → innerText elemen .hero h4 span  (index.html:537-538)
   → prefill input #nama di form RSVP (index.html:540)
```

**B. Buka undangan → audio**
```
Klik "Lihat Undangan" (index.html:27)
   → enableScroll()  (index.html:473-478)
       → scroll dikembalikan normal
       → playAudio()  (index.html:481-486)
           → <audio>.play(), volume 0.5
           → tampilkan icon disc
```

**C. Submit RSVP**
```
Submit #my-form (index.html:286)
   → e.preventDefault()
   → new FormData(form)
   → fetch(POST, action = Google Apps Script URL)
   → .then(() => alert("Success!"))   ⚠️ TIDAK ada pengecekan response.ok / catch error
```

---

## 6. Arsitektur CSS

**Design tokens** (`style.css:1-6`) — hanya 4 variabel:
```css
--pink: #f14e95;
--bg: #0a0a0a;
--shadow: 0 2px 2px rgba(0 0 0 / 0.5);
--transparant: rgba(0, 0, 0, 0.319);
```
Font (`Sacramento`, `Work Sans`) **tidak** ditokenisasi — di-hardcode berulang di banyak selector berbeda.

**Breakpoint responsif khusus** untuk timeline ada di 6 titik berbeda: `style.css:368, 408, 448, 475, 503, 523`. Ini hasil trial-error karena struktur zig-zag timeline susah responsive. **Jika struktur HTML timeline diubah, ke-6 breakpoint ini kemungkinan perlu disesuaikan satu-satu.**

**Image dependencies di CSS** (background-image, bukan `<img>` tag):
- `style.css:20` — `.hero::before` → `img/prewed1.jpg`
- `style.css:80` — `.home` → `img/floraPattern1.png` (dekoratif, bukan foto orang)
- `style.css:226-236` — `.timeline-image` → background-image per item, fallback `background-color: #ccc`

---

## 7. Known Issues & Technical Debt

Diurut dari yang paling perlu diberesin sebelum production:

| # | Issue | Lokasi | Dampak |
|---|---|---|---|
| 1 | Tidak ada error handling di fetch RSVP — user selalu lihat "Success" walau request gagal | `index.html:508-526` | Data tamu bisa hilang tanpa terdeteksi |
| 2 | Gallery: thumbnail pakai placeholder `picsum.photos`, padahal `href` lightbox menuju file lokal asli — tidak sinkron | `index.html:231-269` | Foto yang tampil ≠ foto yang dibuka di lightbox |
| 3 | Placeholder `Lorem ipsum` masih ada di bio pasangan, story, gallery, gifts | `index.html:72, 89, 167, 182, 195, 208, 226, 354` | Wajib diganti sebelum live ke tamu |
| 4 | Inline style attribute (`style="margin-top: 30px"`) | `index.html:314` | Minor, sebaiknya jadi class CSS |
| 5 | Endpoint Google Apps Script ke-expose plain di client code | `index.html:287` | Bukan kebocoran kritikal (endpoint memang publik by design), tapi rawan spam submission tanpa proteksi |
| 6 | Nomor rekening plain-text di HTML | `index.html:362-368` | Wajar untuk kasus ini, tapi sadari itu publicly viewable di siapa pun yang akses link |
| 7 | 2 dari 3 foto timeline masih placeholder eksternal `picsum.photos` | `index.html:188, 201` | Harus diganti foto asli sebelum live |

---

## 8. Modification Risk Map

| Area | Risiko ubah | Alasan |
|---|---|---|
| Teks konten (bio, alamat, copy) | 🟢 Rendah | Hardcoded plain text, tidak ada dependency lain |
| Warna tema (`:root` variables) | 🟢 Rendah | Terpusat di satu tempat |
| Foto/gambar | 🟢 Rendah–Sedang | Lihat section 6 untuk daftar file CSS yang depend ke gambar tertentu |
| Section Gallery | 🟡 Sedang | Kalau dihapus, jangan lupa hapus juga `bs5-lightbox` script (`index.html:403`) dan nav link (`index.html:48`) — supaya tidak ada dependency nganggur |
| Story Timeline (struktur HTML) | 🟡 Sedang | Terikat ke 6 breakpoint CSS manual (lihat section 6) |
| RSVP form / endpoint | 🟠 Sedang–Tinggi | Satu-satunya jalur data ke luar repo; ubah struktur field harus disinkronkan dengan Google Apps Script di sisi server (luar repo ini) |
| Tanggal acara | 🟡 Sedang | Harus diubah di **2 tempat**: teks HTML (`index.html:62, 125, 147`) dan config countdown (`index.html:408-410`) — mudah lupa salah satu |
| Struktur navbar/offcanvas | 🟢 Rendah | Standar Bootstrap, well-documented |

---

## 9. Git Workflow yang Sudah Berjalan di Repo Ini

Repo ini punya 2 branch: `main` dan `maybe-better` (branch eksperimen). Histori commit menunjukkan pola commit kecil & deskriptif:
```
4d08021 update countdown & gift
e70c076 update countdown & lokasi
daeec54 update rsvp linkage to spreadsheet
d41c059 update tanggal
30fc305 little update for reza & lala
```
**Rekomendasi lanjutan:** pertahankan pola ini — buat branch per fitur (`feat/...`, `fix/...`), commit kecil per concern, dan QA manual (buka di browser, cek console error, cek 3 breakpoint) sebelum merge ke `main` — karena **push ke `main` = langsung live**, tidak ada staging.

---

## 10. Open Decisions / Backlog

- [ ] **Kebijakan gambar**: klien berpotensi tidak ingin foto pribadi dipakai. Opsi penggantian per elemen (hero, avatar pasangan, timeline, gallery) sudah dibahas terpisah di luar dokumen ini — perlu keputusan final apakah "no foto" berarti zero gambar (termasuk dekoratif seperti `floraPattern1.png`) atau hanya foto pribadi pasangan.
- [ ] Perbaiki error handling fetch RSVP (Issue #1)
- [ ] Sinkronkan thumbnail Gallery dengan file lokal asli, hapus dependency ke `picsum.photos` (Issue #2 & #7)
- [ ] Ganti semua placeholder `Lorem ipsum` (Issue #3)
- [ ] Pertimbangkan honeypot field di form RSVP untuk mitigasi spam (terkait Issue #5)
- [ ] Tambah Open Graph meta tags untuk preview link WhatsApp/Instagram (belum ada di `<head>` saat ini)
