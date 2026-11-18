# Catatan Laundry

Aplikasi pencatatan laundry dengan frontend Vite, Supabase sebagai database/API, dan Vercel untuk hosting. Pelanggan, layanan, dan pesanan disimpan permanen di Supabase. Login memakai Supabase Auth; kebijakan RLS membatasi setiap akun hanya ke datanya sendiri.

## Struktur

```text
.
├── index.html              # Halaman aplikasi
├── src/
│   ├── main.js             # UI, autentikasi, dan akses data Supabase
│   ├── style.css           # Tampilan responsif
│   └── supabase.js         # Inisialisasi klien Supabase
├── supabase/
│   ├── setup.sql           # SQL lengkap untuk setup Supabase sekali jalan
│   ├── schema.sql          # Tabel, validasi, trigger, dan RLS
│   ├── public-board-migration.sql # Menambahkan mode baca publik ke database lama
│   ├── public-owner.sql    # Menentukan akun yang papan pesanannya boleh dilihat publik
│   └── seed.sql            # Data contoh lama, dijalankan secara opsional
├── .env.example            # Konfigurasi frontend (publishable key)
└── vercel.json             # Konfigurasi build Vercel
```

## Menyiapkan Supabase

1. Buat akun pemilik di **Authentication → Users** di Supabase. Pendaftaran akun tidak dibuka dari aplikasi.
2. Buka [supabase/setup.sql](./supabase/setup.sql), ganti `OWNER_EMAIL` dengan email akun tadi, salin seluruh isi file ke **SQL Editor → New query**, lalu tekan **Run**.
3. Skrip membuat tabel, RLS, papan publik, menetapkan pemilik, dan mengimpor data contoh lama yang belum ada. Skrip tidak menimpa data pelanggan yang sudah ada.
4. Di **Authentication → URL Configuration**, set **Site URL** ke URL deployment dan tambahkan URL preview Vercel ke **Redirect URLs**.
5. Nonaktifkan pendaftaran publik di pengaturan Supabase Auth. RLS membatasi data edit per akun; papan publik tidak menampilkan nomor HP atau alamat.

Gunakan `setup.sql` sebagai satu-satunya skrip setup. Jangan jalankan `schema.sql`, `public-board-migration.sql`, `public-owner.sql`, atau `seed.sql` lagi secara terpisah untuk setup yang sama.

`total` pesanan dihitung database dari berat dan harga layanan. Harga per kg disalin melalui trigger ketika pesanan dibuat atau diubah; tanggal selesai juga dikelola database.

## Mode tampilan

Papan pesanan dapat dilihat tanpa login. Pengunjung publik dapat melihat nama pelanggan, layanan, berat, status, total, dan tanggal masuk—jangan masukkan informasi sensitif ke nama pelanggan atau layanan. Nomor HP, alamat, daftar pelanggan, dan pengelolaan data hanya tersedia setelah login. Tombol **Masuk** selalu tersedia; pengguna yang ingin mengubah data harus masuk dengan akun Supabase.

## Jalankan lokal

```sh
npm install
```

Salin `.env.example` menjadi `.env.local` (di PowerShell: `Copy-Item .env.example .env.local`), lalu isi URL project dan publishable key dari pengaturan API Supabase. File `.env.local` tidak masuk Git. Setelah mengubah file env, hentikan dan jalankan ulang `npm run dev`.

Jalankan aplikasi:

```sh
npm run dev
```

Vite tidak membaca `.env.example` secara otomatis.

## Deploy ke Vercel

Import repository di Vercel. Build command adalah `npm run build` dan output directory adalah `dist`; konfigurasi default project sudah tersedia. Jika ingin mengubah project Supabase, tambahkan environment variables berikut di **Project Settings → Environment Variables** untuk Production dan Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Publishable key memang dipakai di browser dan aman untuk frontend selama RLS pada `schema.sql` aktif. Jangan gunakan atau menambahkan `service_role` key ke frontend/repository.
