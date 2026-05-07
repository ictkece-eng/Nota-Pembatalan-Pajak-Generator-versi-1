# Nota Pembatalan Pajak Generator

<p align="center">
   <strong>Generator nota pembatalan pajak internal</strong><br />
   Aman, cepat, siap cetak, dan terintegrasi dengan riwayat data.
</p>

<p align="center">
   <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black" />
   <img alt="React" src="https://img.shields.io/badge/React-19-149eca" />
   <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178c6" />
   <img alt="MySQL" src="https://img.shields.io/badge/Database-MySQL%20%2F%20TiDB-4479a1" />
   <img alt="Security" src="https://img.shields.io/badge/Security-2FA%20%2B%20Idle%20Timeout-success" />
</p>

Aplikasi internal berbasis **Next.js** untuk membantu proses pembuatan **Nota Pembatalan Pajak** secara lebih cepat, konsisten, dan siap cetak. Aplikasi ini menggabungkan **autentikasi berlapis**, **input manual atau ekstraksi AI dari faktur**, **preview dokumen real-time**, serta **penyimpanan riwayat ke database**.

README ini disusun untuk menjelaskan **alur aplikasi**, **fitur utama**, **komponen penting**, dan **cara menjalankan project** dengan aman.

> **Catatan keamanan**  
> Dokumen ini sengaja **tidak menampilkan nilai sensitif** seperti password, API key, secret TOTP, username database, host database, email internal, atau kredensial lain. Gunakan placeholder atau environment variable saat konfigurasi.

## Daftar isi

- [Ringkasan cepat](#ringkasan-cepat)
- [Diagram alur sistem](#diagram-alur-sistem)
- [Gambaran singkat](#gambaran-singkat)
- [Nilai bisnis aplikasi](#nilai-bisnis-aplikasi)
- [Alur aplikasi](#alur-aplikasi)
- [Struktur file yang berperan di flow utama](#struktur-file-yang-berperan-di-flow-utama)
- [Alur data antarkomponen](#alur-data-antarkomponen)
- [Environment variables](#environment-variables)
- [Cara menjalankan project](#cara-menjalankan-project)
- [Skenario penggunaan singkat](#skenario-penggunaan-singkat)
- [Ringkasan endpoint API](#ringkasan-endpoint-api)
- [Catatan penting](#catatan-penting)

## Ringkasan cepat

- Framework: **Next.js 15** + **React 19**
- UI: **React Bootstrap**, **Lucide**, **Motion**
- AI extraction: **Google Gemini** via `@google/genai`
- Database: **MySQL / TiDB-compatible** via `mysql2`
- Output: **Print A4** dan **PDF export**
- Security: **password + TOTP + idle timeout**

## Diagram alur sistem

```mermaid
flowchart TD
   A[User membuka aplikasi] --> B[Overlay autentikasi]
   B --> C[Password aplikasi]
   C -->|Valid| D[Verifikasi TOTP]
   C -->|Tidak valid| B
   D -->|Valid| E[Masuk ke Generator]
   D -->|Tidak valid| D

   E --> F[Input manual data nota]
   E --> G[Upload faktur]
   G --> H[Gemini ekstrak data]
   H --> I[Form terisi otomatis]

   F --> J[Preview dokumen real-time]
   I --> J
   J --> K[Print / PDF]
   J --> L[Simpan ke database]
   L --> M[History data]
   M --> N[Buka ulang / edit / hapus / export CSV]
```

## Gambaran singkat

App ini dipakai untuk membantu tim billing membuat dokumen nota pembatalan pajak dengan lebih rapi dan konsisten.

Fitur utama yang sudah ada di project:

- **Autentikasi 2 langkah**
   - Password aplikasi
   - Verifikasi TOTP / Google Authenticator
- **Generator nota pembatalan**
   - Isi form manual
   - Tambah / hapus item jasa
   - Hitung DPP dan PPN otomatis
   - Override PPN manual bila diperlukan
- **Ekstraksi data faktur dengan Gemini AI**
   - Upload gambar faktur
   - AI mengisi sebagian form otomatis
- **Preview dokumen real-time**
   - Format dokumen disusun untuk tampilan A4
- **Output dokumen**
   - Print langsung
   - Download PDF
- **Riwayat data**
   - Simpan ke database
   - Cari data
   - Pagination
   - Buka ulang untuk edit
   - Hapus data
   - Export CSV

## Nilai bisnis aplikasi

Aplikasi ini cocok untuk proses operasional yang membutuhkan:

- standardisasi format nota pembatalan
- percepatan input data dari faktur pajak
- pengurangan salah ketik saat pengisian manual
- arsip data yang bisa dicari dan dibuka ulang
- hasil dokumen yang konsisten untuk cetak dan PDF

## Alur aplikasi

Berikut alur kerja app dari user membuka halaman sampai data tersimpan:

### 1. User membuka aplikasi

Halaman utama dirender dari `app/page.tsx` dan langsung menampilkan **overlay keamanan** sebelum user bisa mengakses generator.

### 2. Login langkah pertama: password aplikasi

User memasukkan password yang divalidasi dari environment variable:

- `NEXT_PUBLIC_APP_PASSWORD`

> Nilai asli password **tidak ditampilkan di README** dan sebaiknya hanya dikelola melalui file environment lokal yang aman.

Jika password benar:

- status login tahap 1 disimpan di `sessionStorage` dengan key `billing_auth`
- user diarahkan ke tahap verifikasi berikutnya

Jika salah:

- aplikasi menampilkan error visual pada form login

### 3. Login langkah kedua: TOTP / Google Authenticator

Setelah lolos password, user harus memasukkan 6 digit kode TOTP.

Sumber secret TOTP:

- `NEXT_PUBLIC_TOTP_SECRET`

> Secret TOTP bersifat sensitif dan **jangan pernah ditulis langsung** di dokumentasi publik atau dibagikan lewat screenshot README.

Flow-nya:

- aplikasi membuat QR setup Google Authenticator
- user bisa scan QR sekali saat setup awal
- kode TOTP diverifikasi menggunakan `speakeasy`
- jika valid, aplikasi menyimpan status `totp_auth` di `sessionStorage`
- user resmi masuk ke halaman generator

Tambahan keamanan:

- ada **idle timeout 5 menit**
- jika tidak ada aktivitas, user otomatis logout

### 4. User masuk ke tab generator

Setelah autentikasi sukses, user akan melihat area utama dengan dua mode kerja:

- **Input & Preview**
- **History Data**

Secara default user masuk ke tab **Input & Preview**.

### 5. Pengisian data nota

Di tab generator, user bisa mengisi data berikut:

- nomor nota pembatalan
- nomor dan tanggal faktur pajak
- data penerima jasa
- data pemberi jasa
- rincian jasa yang dibatalkan
- kota dan tanggal dokumen
- penandatangan, nama, dan jabatan

Setiap perubahan di form akan langsung mengubah state React dan otomatis memperbarui preview dokumen di sisi kanan.

### 6. Upload faktur untuk ekstraksi AI

Kalau user tidak ingin input semua data secara manual, user bisa upload file faktur.

Flow upload:

1. user memilih file gambar / dokumen
2. file dibaca dengan `FileReader`
3. konten dikirim ke **Google Gemini** melalui package `@google/genai`
4. AI diminta mengembalikan data dalam format JSON terstruktur
5. hasil ekstraksi dipetakan ke state form

Supaya aman secara dokumentasi:

- README ini hanya menyebut nama variabel `NEXT_PUBLIC_GEMINI_API_KEY`
- nilai API key asli tidak ditampilkan
- contoh payload sensitif tidak ditulis di dokumen ini

Field yang diisi AI antara lain:

- nomor faktur
- tanggal faktur
- nama/alamat/NPWP penerima
- nama/alamat/NPWP pemberi
- kota dokumen
- item deskripsi dan amount

Kalau proses berhasil:

- form terisi otomatis
- aplikasi menampilkan notifikasi sukses upload

Kalau gagal:

- aplikasi menampilkan pesan error tanpa merusak data form yang sudah ada

### 7. Perhitungan nominal

Setelah item dimasukkan, aplikasi menghitung:

- **DPP / total penggantian JKP** = jumlah seluruh `items.amount`
- **PPN default** = `floor(totalAmount * 0.11)`

Jika dibutuhkan penyesuaian karena pembulatan atau acuan dokumen asli, user bisa mengisi **PPN manual**. Saat nilai manual ada, nilai itu yang dipakai di preview dan saat simpan ke database.

### 8. Preview dokumen siap cetak

Preview di sisi kanan dirender langsung dari state form dan dibentuk seperti dokumen formal A4.

Bagian yang ditampilkan antara lain:

- judul Nota Pembatalan
- nomor dokumen
- referensi faktur pajak
- data penerima jasa kena pajak
- data pemberi jasa kena pajak
- tabel item jasa yang dibatalkan
- total DPP dan PPN
- blok tanda tangan

Styling untuk preview dan print ada di `app/globals.css`.

### 9. Output dokumen

Setelah preview sesuai, user punya dua opsi output:

- **Print**
   - memakai `window.print()`
   - layout print dioptimalkan untuk kertas A4
- **PDF**
   - memakai `html2pdf.js`
   - nama file PDF diambil dari nomor nota

### 10. Simpan ke database

Saat user klik **Simpan Data** atau **Update Data**, frontend memanggil endpoint:

- `POST /api/nota` untuk data baru
- `PUT /api/nota` untuk update data lama

Data disimpan ke tabel `nota_pajak` melalui helper database di `lib/db.ts`.

Koneksi database dibaca dari environment variable `DATABASE_URL`, tetapi nilai koneksi aktual tetap harus disimpan di file environment lokal dan tidak dicantumkan di README.

Kolom utama yang disimpan meliputi:

- metadata nota dan faktur
- data penerima dan pemberi
- item JSON
- kota dan tanggal dokumen
- PPN manual
- data penandatangan
- timestamp create/update

### 11. Lihat dan kelola history

Saat user pindah ke tab **History Data**, aplikasi memanggil:

- `GET /api/nota?page=...&limit=...&search=...`

Fitur di halaman history:

- daftar nota tersimpan
- pencarian berdasarkan nomor nota / nomor faktur / penerima
- pagination
- ringkasan total DPP dan PPN
- buka data lama ke editor
- hapus data
- export CSV

Jika user klik **Buka**, data history dipetakan kembali ke format state frontend lalu dimuat ke tab generator untuk diedit atau dicetak ulang.

## Struktur file yang berperan di flow utama

Berikut file inti yang membentuk alur aplikasi saat ini.

### `app/page.tsx`

Pusat logika UI aplikasi:

- autentikasi 2 langkah
- upload dan ekstraksi AI
- state form nota
- preview dokumen
- print / PDF
- history view, search, pagination, export CSV

### `app/api/nota/route.ts`

Endpoint API internal untuk:

- `GET` daftar dan pencarian history
- `POST` simpan nota baru
- `PUT` update nota
- `DELETE` hapus nota

File ini juga menangani parsing tanggal Indonesia ke format ISO sebelum data masuk database.

### `lib/db.ts`

Helper koneksi database MySQL/TiDB:

- membuat connection pool
- membaca `DATABASE_URL`
- membuat tabel `nota_pajak` jika belum ada
- menambahkan kolom baru bila schema lama belum lengkap

### `app/globals.css`

Mengatur tampilan:

- preview dokumen
- layout print A4
- style login overlay
- tab, button, dan elemen UI pendukung

## Alur data antarkomponen

Secara sederhana, data bergerak dengan pola berikut:

1. User berinteraksi dengan form di `app/page.tsx`
2. State React menyimpan perubahan input
3. Preview dokumen dirender langsung dari state yang sama
4. Saat simpan, frontend mengirim payload ke `app/api/nota/route.ts`
5. API memvalidasi / merapikan format tanggal
6. Helper di `lib/db.ts` menghubungkan request ke database
7. Data yang tersimpan bisa diambil kembali lewat endpoint history

Pola ini membuat **editor dan preview selalu sinkron** karena sama-sama membaca dari sumber state yang sama di frontend.

## Environment variables

Project ini memakai beberapa environment variable. File contoh sudah tersedia di `.env.example`, dan konfigurasi lokal dapat disimpan di `.env` atau `.env.local`.

Variabel yang dipakai:

| Variable | Fungsi |
| --- | --- |
| `NEXT_PUBLIC_GEMINI_API_KEY` | API key untuk ekstraksi faktur menggunakan Gemini |
| `DATABASE_URL` | Koneksi database MySQL/TiDB untuk penyimpanan history |
| `NEXT_PUBLIC_APP_PASSWORD` | Password tahap pertama untuk masuk aplikasi |
| `NEXT_PUBLIC_TOTP_SECRET` | Shared secret untuk verifikasi TOTP / Google Authenticator |

### Contoh aman konfigurasi lokal

Gunakan placeholder seperti berikut, **bukan nilai asli**:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=mysql://username:password@host:4000/database_name
NEXT_PUBLIC_APP_PASSWORD=your_app_password_here
NEXT_PUBLIC_TOTP_SECRET=your_totp_secret_here
```

### Praktik keamanan yang disarankan

- jangan commit nilai asli `.env` ke repository
- jangan tulis secret pada README, wiki, atau screenshot
- gunakan kredensial berbeda untuk development dan production
- rotasi secret bila pernah terlanjur tersebar

## Cara menjalankan project

### Prasyarat

- Node.js
- akses ke database MySQL/TiDB yang valid
- API key Gemini yang aktif

### Langkah menjalankan

1. Install dependency:
   - `npm install`
2. Isi environment variable pada `.env` atau `.env.local`
3. Jalankan development server:
   - `npm run dev`
4. Buka browser ke:
   - `http://localhost:3000`

## Skenario penggunaan singkat

Berikut contoh alur penggunaan harian:

1. User login memakai password aplikasi
2. User verifikasi kode TOTP dari authenticator
3. User pilih salah satu metode input:
   - isi form manual, atau
   - upload faktur agar dibaca AI
4. User cek hasil preview nota
5. Bila perlu, user koreksi data atau PPN manual
6. User simpan data ke database
7. User cetak dokumen atau download PDF
8. Jika dibutuhkan di lain waktu, user membuka ulang data dari history

## Ringkasan endpoint API

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `GET` | `/api/nota` | Ambil history nota dengan search dan pagination |
| `POST` | `/api/nota` | Simpan nota baru |
| `PUT` | `/api/nota` | Update nota yang sudah ada |
| `DELETE` | `/api/nota?id=...` | Hapus nota berdasarkan ID |

## Catatan penting

- Data history disimpan di database, bukan hanya di browser.
- Status autentikasi disimpan sementara di `sessionStorage`.
- Preview dokumen dibuat agar mendekati format cetak A4.
- Struktur tabel database akan diinisialisasi otomatis saat API dipanggil.
- AI upload paling optimal jika gambar faktur jelas dan mudah dibaca.
- README ini hanya menjelaskan flow dan konfigurasi aman, bukan mempublikasikan secret operasional.

## Singkatnya

Alur app ini adalah:

**login 2 langkah → isi / ekstrak data faktur → review preview nota → print/PDF → simpan ke database → kelola history untuk buka ulang, edit, hapus, atau export.**

Jadi README ini sekarang menggambarkan cara kerja app sesuai implementasi yang ada di codebase, tanpa mengubah logic aplikasi yang sudah berjalan.
