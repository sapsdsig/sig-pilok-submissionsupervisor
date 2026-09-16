# PILOK Supervisor Form

Standalone React + TypeScript form for recording Supervisors by distributor and operational area. The application reads master data from Google Sheets, uploads KTP files directly from the browser to Google Drive resumable sessions, and writes normalized transactions to Google Sheets through server-side APIs.

Google credentials and access tokens never enter the browser. The application server creates resumable sessions, while the KTP bytes travel directly from the browser to Google Drive.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, React Hook Form, Zod, TypeScript server APIs, Google APIs, and Vercel-compatible serverless functions.

## Requirements

- Node.js 20 or newer
- A separate Google Cloud project with Google Sheets API and Google Drive API enabled
- OAuth client ID, client secret, and offline refresh token for the Google account that can access all three spreadsheets and the KTP folder
- Three Google Spreadsheets: distributor master, Province/Area master, and submission transactions
- The `File Upload - KTP Supervisor` Google Drive folder

## Local setup

```bash
npm install
copy .env.example .env
npm run dev
```

`npm run dev` starts the Vite frontend and local TypeScript API adapter together at `http://localhost:5173`. `npm run dev:frontend` starts Vite only and is useful only when API requests are served elsewhere.

Other commands:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run verify:google
```

## Environment variables

All Google variables are server-only. Never add a `VITE_` prefix.

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID from this project's Google Cloud project |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Yes | Offline refresh token belonging to an account with access to Sheets and Drive |
| `GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID` | Yes | Spreadsheet containing the `master_distributor` worksheet |
| `GOOGLE_PROVINSI_AREA_SPREADSHEET_ID` | Yes | Spreadsheet containing the `provinsi_area` worksheet |
| `GOOGLE_SUBMISSION_SPREADSHEET_ID` | Yes | Spreadsheet containing all three transaction worksheets |
| `GOOGLE_DRIVE_KTP_FOLDER_ID` | Yes | ID of the direct `File Upload - KTP Supervisor` destination folder |
| `APP_ORIGIN` | Production | Exact production origin, for example `https://example.vercel.app`, without a path or trailing slash |
| `GOOGLE_MASTER_DISTRIBUTOR_SHEET_NAME` | No | Defaults to `master_distributor` |
| `GOOGLE_PROVINCE_AREA_SHEET_NAME` | No | Defaults to `provinsi_area` |
| `GOOGLE_SUBMISSION_SHEET_NAME` | No | Defaults to `submission` |
| `GOOGLE_SUBMISSION_AREA_SHEET_NAME` | No | Defaults to `submission_area` |
| `GOOGLE_SUBMISSION_SUPERVISOR_SHEET_NAME` | No | Defaults to `submission_supervisor` |

Local origins `http://localhost:5173` and `http://127.0.0.1:5173` are allowed automatically. The production origin must match `APP_ORIGIN`; this origin is also sent when the server creates the Drive resumable session so the browser's subsequent cross-origin upload is compatible with the session.

## Spreadsheet files, worksheets, and headers

Header spelling is exact, but column order may change. The server reads the header row and maps values by header name.

```text
PILOK - Supervisor
|-- File Upload - KTP Supervisor
|-- master_distributor
|-- provinsi_area
`-- submission
```

The three spreadsheet names above are separate files. `File Upload - KTP Supervisor` is the direct Drive upload destination; its parent folder is not configured by the application.

### Master Distributor Spreadsheet → `master_distributor`

```text
Kode Distributor
Nama Distributor
```

Format `Kode Distributor` cells as **Plain text** in Google Sheets. The API uses formatted strings and never converts distributor codes to numbers, but leading zeroes cannot be recovered if Sheets has already stored a code as an unformatted number.

### Provinsi Area Spreadsheet → `provinsi_area`

```text
Provinsi ID
Provinsi Name
Area ID
Area Name
Area AP
```

The server deduplicates provinces by `Provinsi ID` and areas by `Provinsi ID + Area ID`.

### Submission Spreadsheet → `submission`

```text
submission_id
kode_distributor
nama_distributor
created_at
updated_at
```

### Submission Spreadsheet → `submission_area`

```text
submission_area_id
submission_id
provinsi_id
provinsi_name
area_id
area_name
area_ap
jumlah_supervisor
```

### Submission Spreadsheet → `submission_supervisor`

```text
supervisor_id
submission_id
submission_area_id
supervisor_no
nama_supervisor
ktp_file_id
ktp_file_name
ktp_file_url
```

## Google verification

After filling `.env`, run:

```bash
npm run verify:google
```

The script checks OAuth access, each of the three spreadsheet files, every required worksheet/header, and the direct KTP Drive folder's write capability. It does not upload a file or write transaction rows. A failure is reported honestly as `FAIL`; live verification is not part of the offline unit tests.

## API surface

```text
GET  /api/distributors/:code
GET  /api/regions/provinces
GET  /api/regions/areas?provinceId=...
POST /api/uploads/ktp/session
POST /api/uploads/ktp/verify
POST /api/uploads/ktp/cleanup
POST /api/submissions
```

Master data uses a 60-second in-memory server cache. This is only an optimization; each serverless instance can repopulate it from Google Sheets.

Submission validation resolves distributor and region labels from their separate master spreadsheets and verifies every Drive file's folder, MIME type, size, and request-bound `appProperties`. All three transaction worksheets are appended within the single submission spreadsheet through one atomic Google Sheets `spreadsheets.batchUpdate` call. A deterministic ID plus a short-lived in-process lock reduces immediate duplicate writes.

`GOOGLE_DRIVE_KTP_FOLDER_ID` points directly to `File Upload - KTP Supervisor`; no parent Drive folder ID is required or supported.

If persistence fails, cleanup is best-effort and deletes only files tagged with the current request token. Before cleanup, the server checks for the deterministic parent record to avoid deleting files after an ambiguous but successful Sheets response.

## Deployment

The repository is ready for manual Vercel import. Vercel project creation, environment configuration, domain setup, and production deployment are intentionally performed outside this repository workflow.
