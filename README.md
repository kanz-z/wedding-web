# Wedding Invitation Reza & Ashila

Sebuah website undangan pernikahan digital interaktif yang dilengkapi dengan dashboard admin untuk mengelola tamu, RSVP, buku tamu, dan banyak lagi.

Website ini dapat diakses langsung di:

🔗 **[rezashila2026.vercel.app](https://rezashila2026.vercel.app/)**

---

## Masalah yang Diselesaikan

Mengirim undangan pernikahan fisik bisa merepotkan: biaya cetak, alamat salah, konfirmasi kehadiran yang berantakan. Website ini menggantikan semua itu dengan satu tautan digital yang:

- Mudah dibagikan melalui WhatsApp atau media sosial
- Memungkinkan tamu mengkonfirmasi kehadiran (RSVP) secara langsung
- Memberikan informasi lengkap acara (tanggal, waktu, lokasi, peta)
- Membantu pengantin mengelola daftar tamu dan pesan dari satu tempat

---

## Fitur Utama

### Untuk Tamu (Halaman Publik)

| Fitur                     | Deskripsi                                                      |
| ------------------------- | -------------------------------------------------------------- |
| 🎨 Kartu Undangan Digital | Tampilan undangan yang elegan dan responsif di semua perangkat |
| ✅ Formulir RSVP          | Tamu dapat mengkonfirmasi kehadiran beserta jumlah orang       |
| 📍 Informasi Acara        | Tanggal, waktu, lokasi, dan peta acara pernikahan              |
| 💌 Buku Tamu Digital      | Tamu dapat meninggalkan ucapan dan doa                         |
| 📸 Ekspor Gambar          | Simpan kartu undangan sebagai gambar                           |

### Untuk Admin (Dashboard)

| Fitur              | Deskripsi                                                  |
| ------------------ | ---------------------------------------------------------- |
| 📊 Ringkasan       | Statistik tamu, RSVP, dan pesan dalam satu tampilan        |
| 👥 Manajemen Tamu  | Lihat, tambah, edit, dan hapus data tamu undangan          |
| 📋 Kelola RSVP     | Setujui atau tolak konfirmasi kehadiran                    |
| 💬 Buku Tamu       | Moderasi dan tampilkan ucapan dari tamu                    |
| 📱 QR Scanner      | Pindai QR code untuk check-in tamu di lokasi acara         |
| ✉️ Pesan Pribadi   | Baca pesan khusus dari tamu untuk pengantin                |
| 📨 WhatsApp Blast  | Kirim undangan massal melalui WhatsApp ke banyak tamu      |
| 💾 Unduh Massal    | Unduh banyak kartu undangan sekaligus dalam format pilihan |
| 🔐 Manajemen Admin | Kelola akun admin yang dapat mengakses dashboard           |

---

## Cara Menggunakan Aplikasi

### Untuk Tamu Undangan

1. Buka tautan undangan yang dibagikan oleh pengantin
2. Lihat informasi acara dan kartu undangan digital
3. Isi formulir RSVP untuk mengkonfirmasi kehadiran
4. Tulis ucapan di buku tamu (opsional)

### Untuk Admin (Pengantin)

1. Buka halaman **Dashboard** melalui tautan khusus
2. Masuk menggunakan email dan kata sandi admin
3. Kelola tamu, RSVP, buku tamu, dan lainnya melalui tab-tab yang tersedia
4. Gunakan fitur **WhatsApp Blast** untuk mengirim undangan massal
5. Pantau kehadiran tamu melalui **QR Scanner** saat hari acara

---

## Cara Menjalankan Proyek (Untuk Developer)

### Prasyarat

- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- Akun [Supabase](https://supabase.com/) (untuk database dan backend)

### Instalasi

```bash
# 1. Clone repositori
git clone https://github.com/kanz-z/wedding-invitation-1.git
cd wedding-invitation-1

# 2. Install dependensi
npm install

# 3. Salin file environment dan isi dengan kredensial Supabase kamu
cp .env.example .env
```

### Konfigurasi Environment

Isi file `.env` dengan kredensial dari proyek Supabase kamu:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Menjalankan Aplikasi

| Perintah            | Kegunaan                                    |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Menjalankan server pengembangan lokal       |
| `npm run build`     | Membuat file produksi di folder `dist/`     |
| `npm run preview`   | Melihat hasil build produksi secara lokal   |
| `npm run typecheck` | Memeriksa error TypeScript                  |
| `npm test`          | Menjalankan pengujian otomatis (Playwright) |

---

## Struktur Proyek

```
wedding-invitation-1/
├── index.html                  # Halaman undangan publik
├── dashboard.html              # Halaman dashboard admin
├── src/
│   ├── main.ts                 # Entry point halaman publik
│   ├── dashboard.ts            # Entry point dashboard admin
│   ├── main/                   # Modul halaman publik
│   ├── dashboard/              # Modul dashboard admin
│   │   ├── state.ts            # State global dashboard
│   │   └── ...                 # Modul per fitur dashboard
│   ├── shared/                 # Kode yang dipakai bersama
│   ├── styles/                 # File CSS (satu per halaman)
│   ├── types/                  # Definisi tipe TypeScript
│   └── config.ts               # Konfigurasi aplikasi
├── supabase/                   # Edge Functions Supabase
├── tests/                      # Pengujian Playwright
└── dist/                       # Hasil build produksi
```

---

## Teknologi yang Digunakan

| Teknologi                                              | Kegunaan                               |
| ------------------------------------------------------ | -------------------------------------- |
| [TypeScript](https://www.typescriptlang.org/)          | Bahasa pemrograman utama               |
| [Vite](https://vitejs.dev/)                            | Alat build dan server pengembangan     |
| [Supabase](https://supabase.com/)                      | Database, otentikasi, dan backend      |
| [Bootstrap 5](https://getbootstrap.com/)               | Framework CSS untuk tampilan           |
| [Bootstrap Icons](https://icons.getbootstrap.com/)     | Ikon-ikon antarmuka                    |
| [html2canvas](https://html2canvas.hertzen.com/)        | Mengubah kartu undangan menjadi gambar |
| [html5-qrcode](https://github.com/mebjas/html5-qrcode) | Pemindai QR code untuk check-in        |
| [qrcodejs](https://github.com/davidshimjs/qrcodejs)    | Membuat kode QR                        |
| [AOS](https://michalsnik.github.io/aos/)               | Animasi saat menggulir halaman         |
| [Vercel](https://www.vercel.com/)                      | Hosting website                        |
| [Playwright](https://playwright.dev/)                  | Pengujian otomatis                     |

---

## Lisensi

Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE).

## Kredit

Proyek ini dikembangkan berdasarkan template dari [elix-stack](https://github.com/elix-stack). Template telah dimodifikasi dan disesuaikan secara signifikan untuk kebutuhan proyek ini.
