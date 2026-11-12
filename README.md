# Vibe Code

Antarmuka chat buatan sendiri sebagai pengganti tampilan terminal **Claude Code**. Mesin di belakangnya adalah **Claude Agent SDK**, sedangkan model AI disalurkan lewat **9Router** (proxy lokal). Tujuannya: mengobrol dengan asisten kode di aplikasi yang nyaman, dan asisten itu dapat membaca serta mengerjakan proyek di komputer sendiri.

> **Status:** proyek pribadi yang masih dalam pengembangan.

## Cara kerja

```
Anda mengetik di tampilan React
        ↓ WebSocket (/ws)
server.mjs (Express + ws)
        ↓
Claude Agent SDK
        ↓
9Router (proxy lokal, localhost:20128)
        ↓
Provider model (misalnya Kiro)
```

Jawaban dikirim kembali secara bertahap (streaming), sehingga tampil sedikit demi sedikit seperti di aplikasi chat AI pada umumnya.

## Fitur

- Percakapan dengan respons AI yang dikirim secara streaming.
- Tampilan respons Markdown, termasuk tabel, daftar, tautan, dan blok kode dengan pewarnaan sintaks.
- Riwayat sesi lokal per proyek di folder `.vibe`, termasuk melanjutkan sesi sebelumnya dan memulai sesi baru.
- Pemilihan model dari daftar yang dikonfigurasi di lingkungan Claude atau daftar cadangan di backend.
- Pengaturan tingkat effort (`low`, `medium`, `high`) per permintaan.
- Lampiran hingga 5 file, maksimum 10 MB per file; gambar PNG, JPEG, GIF, dan WebP dikirim sebagai gambar, sedangkan file lain tersedia untuk dibaca asisten.
- Persetujuan pengguna sebelum alat asisten dijalankan, dengan pilihan izinkan atau tolak.
- Kartu aktivitas alat dan ringkasan perubahan untuk alat baca/tulis/edit.
- Perintah chat: `/help`, `/new`, `/clear`, `/effort`, `/resume`, `/model`, `/project`, dan `/memory`.
- Mengganti folder kerja proyek dari antarmuka.
- Tema gelap dan tampilan yang dapat digunakan di jendela aplikasi.
- Skrip `start.mjs` untuk menyalakan backend, frontend, dan 9Router (bila belum aktif) dalam satu langkah.

> Catatan: backend saat ini membatasi alat yang diizinkan ke `Read`, `Glob`, dan `Grep`. Tindakan lain yang diminta SDK akan memerlukan persetujuan melalui antarmuka; periksa setiap permintaan sebelum menyetujuinya.

### Penyimpanan sesi

Vibe Code menyimpan metadata sesi dan riwayat tampilan di folder `.vibe` pada folder proyek aktif. Riwayat ini dipakai untuk menampilkan kembali pesan dan kartu alat; kelanjutan percakapan agen menggunakan ID sesi Claude Agent SDK. Lampiran yang diunggah disimpan di `.vibe/uploads`.

Fitur yang belum tersedia tidak dicantumkan sebagai fitur aktif. Contohnya, tombol **Izinkan Selalu**, SQLite, dan pengeditan pesan yang telah dikirim belum diimplementasikan.

## Commands

| Perintah | Fungsi |
|---|---|
| `/help` | Menampilkan daftar perintah |
| `/new` atau `/clear` | Memulai sesi baru; sesi lama tetap tersimpan |
| `/effort [low\|medium\|high]` | Melihat atau mengganti tingkat effort |
| `/resume` | Memilih sesi lama untuk dilanjutkan |
| `/model [nama-model]` | Melihat atau mengganti model |
| `/project [jalur]` | Melihat atau mengganti folder proyek |
| `/memory` | Menampilkan informasi file `CLAUDE.md` di folder proyek aktif |

Perintah tersedia melalui antarmuka chat; tidak semua perintah menerima argumen kosong untuk mengubah pengaturan.

## Teknologi

| Bagian | Pilihan |
|---|---|
| Bahasa | TypeScript / JavaScript (Node.js) |
| Backend | Node.js, Express, ws (WebSocket) |
| Mesin agen | `@anthropic-ai/claude-agent-sdk` |
| Tampilan | React, Vite, Tailwind CSS, react-markdown |
| Sumber model | 9Router |

## Prasyarat

- [Node.js](https://nodejs.org/) (proyek ini diuji dengan Node.js v24)
- [9Router](https://github.com/nightwalker89/9router) terpasang dan sudah dikonfigurasi dengan minimal satu provider
- Variabel lingkungan untuk menyambungkan SDK ke 9Router (lihat bagian di bawah)

## Instalasi

```bash
git clone <url-repositori-ini>
cd vibe-app

# paket backend
npm install

# paket tampilan
cd client
npm install
cd ..
```

## Konfigurasi

Atur dua variabel lingkungan agar Agent SDK terhubung ke 9Router. Isi alamat dan key sesuai menu **Endpoint & Key** di dashboard 9Router (`http://localhost:20128`).

PowerShell:

```powershell
$env:ANTHROPIC_BASE_URL="http://localhost:20128"
$env:ANTHROPIC_AUTH_TOKEN="isi_key_dari_dashboard_9router"
```

Command Prompt (cmd):

```
set ANTHROPIC_BASE_URL=http://localhost:20128
set ANTHROPIC_AUTH_TOKEN=isi_key_dari_dashboard_9router
```

Pengaturan di atas hanya berlaku untuk jendela terminal yang sama. **Jangan menulis key asli ke dalam kode atau mengunggahnya ke GitHub.**

Nama model diatur di `server.mjs` pada opsi `model` (saat ini memakai combo 9Router bernama `Vibe_Code`). Ganti sesuai nama combo atau model milik Anda.

## Menjalankan

Skrip utama menjalankan backend dan frontend pengembangan, memeriksa 9Router, lalu membuka aplikasi di Microsoft Edge:

```bash
npm start
```

Secara default frontend berjalan di `http://localhost:5173` dan backend di `http://localhost:3000`. Pastikan dependensi root dan frontend sudah dipasang, serta konfigurasi 9Router dan token sudah tersedia.

Untuk menjalankan komponennya secara terpisah:

```bash
# Terminal 1 - folder utama proyek
node server.mjs

# Terminal 2 - folder client
cd client
npm run dev
```

Untuk membuat build frontend produksi:

```bash
cd client
npm run build
```

Backend menyajikan file dari `client/dist` jika build tersebut tersedia. Saat mengakses lewat frontend Vite, konfigurasi Vite meneruskan koneksi WebSocket `/ws` ke backend di `localhost:3000`.

## Struktur proyek

```
vibe-app/
├── start.mjs            # menjalankan router, backend, dan frontend pengembangan
├── server.mjs           # Express, WebSocket, Agent SDK, sesi, dan lampiran
├── test.mjs             # skrip uji koneksi Agent SDK ke 9Router
├── public/              # aset/halaman statis tambahan
├── client/              # antarmuka React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── App.tsx       # chat, perintah, sesi, lampiran, dan persetujuan alat
│   │   ├── index.css     # gaya global dan scrollbar
│   │   └── App.css       # gaya tambahan
│   └── vite.config.ts    # plugin React/Tailwind dan proxy WebSocket
├── .vibe/               # data sesi dan lampiran lokal (dibuat saat digunakan)
└── package.json         # skrip dan dependensi backend
```

Data di `.vibe/` bersifat lokal untuk folder proyek aktif. Pastikan folder tersebut dan file rahasia tidak ikut dikomit.

## Catatan penting

- **Risiko akun provider.** Sebagian provider di 9Router bekerja dengan menggunakan sesi login (OAuth) dari layanan lain. 9Router sendiri menampilkan peringatan bahwa akun dapat dibatasi atau diblokir karena penggunaan lewat proxy tidak dijamin diizinkan. Gunakan dengan risiko sendiri, dan sebaiknya jangan memakai akun utama.
- **Privasi kode.** Isi proyek dan prompt dikirim ke provider yang dipilih di 9Router, bukan langsung ke Anthropic. Jangan mengirim kode yang berisi data rahasia.
- **Kuota terbatas.** Provider gratis memiliki batas pemakaian yang dapat berubah sewaktu-waktu.
- **Izin tindakan.** Asisten dapat mengubah file dan menjalankan perintah di folder kerja. Gunakan pada folder yang aman, dan periksa isi permintaan sebelum menekan **Izinkan**.
- Proyek ini tidak berafiliasi dengan Anthropic, AWS, maupun pembuat 9Router.

## Lisensi

Belum ditentukan. Tambahkan file `LICENSE` sesuai kebutuhan sebelum membagikan proyek ini secara luas.
