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

**Sudah ada**

- Chat dengan jawaban streaming
- Jawaban AI ditampilkan dalam format Markdown
- Sesi percakapan berlanjut selama koneksi masih terbuka
- Kartu persetujuan **Izinkan / Tolak** sebelum asisten memakai alat tertentu (*dalam tahap pengujian*)

**Rencana**

- Pemilihan folder proyek yang dibaca asisten
- Penyimpanan riwayat percakapan secara lokal per proyek (SQLite)
- Tampilan diff untuk perubahan kode
- Perintah seperti `/model`, `/clear`, dan `/project`
- Satu perintah terminal yang menyalakan semuanya sekaligus

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

**Mode pemakaian** (satu server backend yang menyajikan tampilan hasil build):

```bash
cd client
npm run build
cd ..
node server.mjs
```

Lalu buka `http://localhost:3000`.

Agar backend menyajikan hasil build, pastikan baris ini ada di `server.mjs`:

```js
app.use(express.static("client/dist"));
```

**Mode pengembangan** (tampilan dimuat ulang otomatis saat kode diedit), gunakan dua terminal:

```bash
# Terminal 1 - folder vibe-app
node server.mjs

# Terminal 2 - folder vibe-app/client
npm run dev
```

Lalu buka `http://localhost:5173`. Pastikan 9Router sudah aktif sebelum memulai.

## Struktur proyek

```
vibe-app/
├── server.mjs          # backend: WebSocket + Agent SDK
├── test.mjs            # skrip uji koneksi Agent SDK ke 9Router
├── public/             # halaman uji sederhana (opsional)
├── client/             # tampilan React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx     # halaman chat
│   │   └── index.css
│   └── vite.config.ts  # plugin Tailwind + proxy /ws ke backend
└── package.json
```

## .gitignore yang disarankan

Buat file `.gitignore` di folder utama sebelum `git add`, agar folder paket dan data sensitif tidak ikut terunggah:

```
node_modules/
client/node_modules/
client/dist/
.env
*.log
.vibe/
```

## Catatan penting

- **Risiko akun provider.** Sebagian provider di 9Router bekerja dengan menggunakan sesi login (OAuth) dari layanan lain. 9Router sendiri menampilkan peringatan bahwa akun dapat dibatasi atau diblokir karena penggunaan lewat proxy tidak dijamin diizinkan. Gunakan dengan risiko sendiri, dan sebaiknya jangan memakai akun utama.
- **Privasi kode.** Isi proyek dan prompt dikirim ke provider yang dipilih di 9Router, bukan langsung ke Anthropic. Jangan mengirim kode yang berisi data rahasia.
- **Kuota terbatas.** Provider gratis memiliki batas pemakaian yang dapat berubah sewaktu-waktu.
- **Izin tindakan.** Asisten dapat mengubah file dan menjalankan perintah di folder kerja. Gunakan pada folder yang aman, dan periksa isi permintaan sebelum menekan **Izinkan**.
- Proyek ini tidak berafiliasi dengan Anthropic, AWS, maupun pembuat 9Router.

## Lisensi

Belum ditentukan. Tambahkan file `LICENSE` sesuai kebutuhan sebelum membagikan proyek ini secara luas.
