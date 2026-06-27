---
type: debt
priority: low
created: 2026-06-27
status: implemented
tags: [ux, compatibility, duplicate-code]
keywords: [toast, prompt, backdrop-filter, fetchGuest]
patterns: [code duplication, fallback handling, css compatibility]
---

# DEBT-LOW: Perbaikan 4 Temuan LOW — UX, Duplikasi, CSS Fallback

## Daftar Temuan
1. **7.3 — Toast Collision** — Dua implementasi toast berbeda
2. **7.4 — Copy Link Fallback Prompt** — `prompt()` tidak didukung mobile
3. **8.3 — backdrop-filter di Firefox** — Fallback CSS tidak ada
4. **5.5 — fetchGuest Declared Twice** — Fungsi global duplikat

---

## 7.3 — Toast Collision

### Masalah
Dua implementasi toast berbeda:
- **Dashboard** (`dashboard.js:38-46`): punya `toastTimer` global yang bisa overwrite
- **Public** (`index.html:946-963`): buat elemen toast baru setiap panggilan
- Keduanya durasi 3200ms

### Solusi
Konsolidasi jadi satu implementasi. Pilih yang dari dashboard (lebih stabil) dan pakai di kedua tempat.

### File yang Diubah
- `dashboard.js` — implementasi toast existing
- `index.html` — panggil fungsi toast yang sama

---

## 7.4 — Copy Link Fallback Prompt

### Masalah
Di `dashboard.js:704-705`:
```js
.catch(function () { prompt("Salin link ini:", link); });
```
`prompt()` tidak didukung di beberapa browser mobile.

### Solusi
Ganti fallback dengan `<textarea>` temporary + `document.execCommand('copy')`:
```js
.catch(function () {
  var ta = document.createElement("textarea");
  ta.value = link;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  showToast("Link disalin otomatis");
});
```

### File yang Diubah
- `dashboard.js` — fungsi copyGuestLink, ganti prompt() fallback

---

## 8.3 — backdrop-filter di Firefox

### Masalah
Firefox lawas dan IE tidak mendukung `backdrop-filter`. Efek glass-morphism (frosted glass) hilang.

### Solusi
Tambah CSS fallback:
```css
/* Modern browser */
.navbar-blur { backdrop-filter: blur(10px); }
/* Fallback untuk Firefox lawas */
@supports not (backdrop-filter: blur(10px)) {
  .navbar-blur { background-color: rgba(10, 10, 10, 0.95); }
}
```

### File yang Diubah
- `style.css` — tambah @supports fallback
- `dashboard.css` — tambah @supports fallback

---

## 5.5 — fetchGuest Declared Twice

### Masalah
`fetchGuest()` dideklarasikan di `index.html:820` (dalam closure) dan `index.html:980` (global). Harmless tapi membingungkan.

### Solusi
Hapus deklarasi duplikat di baris 980. Pindahkan deklarasi global ke atas.

### File yang Diubah
- `index.html` — hapus deklarasi duplikat baris 980

---

## Konteks
Temuan LOW dari QA Brutal Analysis (27 Juni 2026). Prioritas rendah — tidak mempengaruhi keamanan atau fungsionalitas inti.

## Success Criteria

### Automated Verification
- [ ] Toast hanya punya satu implementasi di codebase
- [ ] copyGuestLink() tidak pakai prompt() sebagai fallback
- [ ] backdrop-filter punya CSS fallback untuk Firefox
- [ ] fetchGuest() hanya dideklarasikan satu kali di index.html

### Manual Verification
- [ ] Toast tampil konsisten di dashboard dan halaman publik
- [ ] Copy link berfungsi di browser mobile (Chrome Android, Safari iOS)
- [ ] Efek glass-morphism tetap acceptable di Firefox lawas
