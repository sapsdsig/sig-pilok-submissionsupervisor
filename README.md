# PILOK Supervisor Form

Form React + TypeScript untuk membuat dan mengedit data Supervisor berdasarkan satu identitas bisnis:

```text
Distributor + AP
```

Satu form hanya menangani satu AP. Distributor yang memiliki dua AP harus disimpan melalui dua submission terpisah.

## Arsitektur data Phase 7

`master_supervisor` adalah referensi immutable baseline Q2 2026. Form publik hanya membacanya dan tidak pernah mengubah atau menghapus baris master.

```text
master_supervisor (immutable Q2 2026 reference)
        |
        +--> pilihan Distributor dari Vendor Name
        +--> pilihan AP per Distributor
        +--> validasi identitas baseline dan ID MDXL

submission + submission_area + submission_supervisor
        |
        +--> current editable state setelah save pertama
```

Sebelum save pertama, Supervisor baseline dimuat dari baris `submission_supervisor` yang memiliki transaction ID kosong. Setelah save pertama, state submission menjadi satu-satunya source of truth; baris master atau baseline tidak digabungkan kembali. Karena itu Supervisor baseline yang sudah dihapus tidak akan muncul kembali.

## Setup lokal

Memerlukan Node.js 20+, satu Spreadsheet master, satu Spreadsheet transaksi, dan folder Google Drive untuk KTP.

```bash
npm install
copy .env.example .env
npm run dev
```

Semua kredensial dan resource ID bersifat server-side. Jangan memakai prefix `VITE_`.

| Variable | Keterangan |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Offline refresh token |
| `GOOGLE_MASTER_SUPERVISOR_SPREADSHEET_ID` | Spreadsheet master Q2 2026 |
| `GOOGLE_SUBMISSION_SPREADSHEET_ID` | Spreadsheet transaksi |
| `GOOGLE_DRIVE_KTP_FOLDER_ID` | Folder upload KTP |
| `APP_ORIGIN` | Origin produksi yang diizinkan |

Override nama worksheet opsional tersedia di `.env.example`.

## Skema Google Sheets

Worksheet `master_supervisor`:

```text
AP
Vendor Name
Fullname
ID MDXL
```

Worksheet `submission`:

```text
submission_id
nama_distributor
created_at
updated_at
```

Worksheet `submission_area`:

```text
submission_area_id
submission_id
ap
jumlah_supervisor
```

Worksheet `submission_supervisor`:

```text
supervisor_id
submission_id
submission_area_id
nama_distributor
ap
id_mdxl
supervisor_no
nama_supervisor
ktp_file_id
ktp_file_name
ktp_file_url
```

Kolom legacy tambahan boleh tetap ada secara fisik dan akan diabaikan berdasarkan header mapping. Aplikasi tidak menghapus kolom secara otomatis. Record submission lama tanpa AP tidak ditebak dari Province/Area; record tersebut dilaporkan sebagai kebutuhan migrasi manual.

Timestamp transaksi disimpan dalam zona `Asia/Jakarta` dengan format `YYYY-MM-DD HH:mm:ss`.

## Perilaku form

- Distributor berasal dari distinct canonical `Vendor Name`.
- AP selalu berasal dari master untuk Distributor terpilih; satu AP dipilih otomatis, beberapa AP memerlukan pilihan pengguna.
- Nilai Distributor dan AP arbitrary ditolak frontend dan backend.
- Nama Supervisor baseline readonly, `ID MDXL` tidak pernah ditampilkan, dan KTP tidak diperlukan.
- Supervisor custom memiliki `id_mdxl` kosong dan wajib memiliki KTP JPG/JPEG/PNG/PDF maksimal 5 MB.
- Custom Supervisor tersimpan hanya menampilkan `KTP tersimpan` dan `Ganti KTP`; URL, file ID, dan filename tidak diekspos oleh DTO publik.
- Semua kartu dapat dihapus selama tersisa minimal satu Supervisor.
- `jumlah_supervisor` dan `supervisor_no` selalu diturunkan server dari urutan terkini.
- Perubahan Distributor/AP yang akan membuang edit belum tersimpan memerlukan konfirmasi.

Penghapusan atau penggantian KTP custom dilakukan setelah update Sheets berhasil. Kegagalan persistence tidak menghapus KTP lama, dan cleanup file baru memeriksa referensi Sheets terlebih dahulu.

## Baseline bootstrap

Import baseline bersifat idempotent dan default-nya dry-run:

```bash
npm run import:supervisor-baseline
```

Setelah memeriksa jumlah, jalankan write secara eksplisit:

```bash
npm run import:supervisor-baseline -- --apply
```

Import hanya menambah blank-ID baseline ke `submission_supervisor`. Import tidak membuat parent `submission`/`submission_area`, tidak memodifikasi master, tidak menduplikasi identitas, dan melewati seluruh kombinasi Distributor + AP yang sudah memiliki saved state.

## Verifikasi

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run verify:google
```

`verify:google` bersifat read-only: memeriksa OAuth, worksheet/header master dan transaksi, serta kemampuan upload folder Drive tanpa mengimpor baseline atau membuat file/baris.

## API

```text
GET  /api/distributors?query=...
GET  /api/aps?namaDistributor=...
GET  /api/submissions/by-distributor-ap?namaDistributor=...&ap=...
POST /api/uploads/ktp/session
POST /api/uploads/ktp/verify
POST /api/uploads/ktp/cleanup
POST /api/submissions
PUT  /api/submissions/:submissionId
```

UI PILOK/SIG dan konvensinya didokumentasikan di [docs/ui-guidelines.md](docs/ui-guidelines.md).
