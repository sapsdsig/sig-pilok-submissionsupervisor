# PILOK Supervisor Form #

Standalone form for creating and editing Supervisor data by Distributor and
operational area. Master data and normalized transactions live in Google
Sheets. KTP files upload directly from the browser to Google Drive through
server-created resumable sessions; file bytes never pass through the Vercel
functions.

Google OAuth credentials, refresh tokens, spreadsheet IDs, and Drive folder
configuration remain server-side.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, React Hook Form, Zod, Google APIs, and
Vercel-compatible TypeScript server functions.

## Shared UI baseline

The Supervisor form is the visual baseline for other PILOK forms. Branding,
layout, field, button, upload, and feedback conventions are documented in
[docs/ui-guidelines.md](docs/ui-guidelines.md).

## Local setup

Requirements: Node.js 20 or newer, three configured Google Spreadsheets, and
the direct File Upload - KTP Supervisor Drive folder.

~~~bash
npm install
copy .env.example .env
npm run dev
~~~

Available checks:

~~~bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run verify:google
~~~

The Google verifier is read-only. It checks OAuth access, spreadsheet
worksheets and headers, and Drive folder access without appending rows or
uploading files.

## Environment variables

Never expose these variables with a VITE_ prefix.

| Variable | Required | Description |
| --- | --- | --- |
| GOOGLE_CLIENT_ID | Yes | OAuth client ID |
| GOOGLE_CLIENT_SECRET | Yes | OAuth client secret |
| GOOGLE_REFRESH_TOKEN | Yes | Offline refresh token |
| GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID | Yes | Distributor master spreadsheet |
| GOOGLE_PROVINSI_AREA_SPREADSHEET_ID | Yes | Province/Area master spreadsheet |
| GOOGLE_SUBMISSION_SPREADSHEET_ID | Yes | Transaction spreadsheet |
| GOOGLE_DRIVE_KTP_FOLDER_ID | Yes | Direct KTP upload destination |
| APP_ORIGIN | Production | Exact public application origin |

Optional worksheet-name overrides remain documented in .env.example.
Localhost origins are allowed automatically; production must match APP_ORIGIN.

## Google resources

~~~text
PILOK - Supervisor
|-- File Upload - KTP Supervisor
|-- master_distributor
|-- provinsi_area
|-- submission
~~~

The three spreadsheet names are separate Google Spreadsheet files. The Drive
folder ID points directly to File Upload - KTP Supervisor; no parent folder
configuration is used.

Header spelling is exact, while column order may change. Runtime access maps
columns by header name.

### Distributor spreadsheet

Worksheet master_distributor:

~~~text
Nama Distributor
~~~

Distributor names are canonical business keys and must be unique after
case-insensitive trimming.

### Province/Area spreadsheet

Worksheet provinsi_area:

~~~text
Provinsi Name
Area Name
~~~

The server defensively deduplicates Province names and Province/Area pairs.

### Submission spreadsheet

Worksheet submission:

~~~text
submission_id
nama_distributor
created_at
updated_at
~~~

Worksheet submission_area:

~~~text
submission_area_id
submission_id
provinsi_name
area_name
jumlah_supervisor
~~~

Worksheet submission_supervisor:

~~~text
supervisor_id
submission_id
submission_area_id
nama_distributor
provinsi
area
supervisor_no
nama_supervisor
ktp_file_id
ktp_file_name
ktp_file_url
~~~

The three reporting fields on submission_supervisor are resolved from validated
server-side master data. This keeps the normalized parent/area model while
allowing reporting directly from the Supervisor worksheet. Historical rows are
not migrated automatically and may remain blank until their submission is
edited and saved.

Legacy extra columns may remain physically present; they are ignored. No
destructive sheet migration is performed by the application.

## User flow

- Distributor, Province, and Area are searchable master-backed controls.
- Selecting a Distributor checks for one existing active submission.
- No stored data opens Create Mode with one Wilayah and one Supervisor.
- Existing data opens Edit Mode and hydrates child IDs and KTP references.
- Each Wilayah always contains 1-10 Supervisor cards.
- jumlah_supervisor and supervisor_no are derived on the server.
- One canonical Distributor may have only one parent submission.
- Switching Distributor with unsaved changes requires confirmation.

The server rejects arbitrary master values, duplicate Province/Area pairs,
duplicate parent submissions, foreign child IDs, and foreign Drive file
references.

## KTP edit safety

Existing KTP metadata satisfies form validation and does not require a
re-upload. Replacement and deletion follow this ordering:

1. upload and verify required new files;
2. validate the complete update;
3. persist the parent and full replacement child state atomically with one
   Google Sheets spreadsheets.batchUpdate;
4. only after persistence succeeds, best-effort delete old files no longer
   referenced.

If persistence fails, old Sheets data and old KTP files remain untouched.
Newly uploaded files are cleanup candidates, but cleanup first checks current
Sheets references so an ambiguous successful write cannot lose its new KTP.
Post-success old-file cleanup failure is logged and does not roll back the
saved form.

## API surface

~~~text
GET  /api/distributors?query=...
GET  /api/regions/provinces
GET  /api/regions/areas?provinceName=...
GET  /api/submissions/by-distributor?namaDistributor=...
POST /api/uploads/ktp/session
POST /api/uploads/ktp/verify
POST /api/uploads/ktp/cleanup
POST /api/submissions
PUT  /api/submissions/:submissionId
~~~

Master reads use a short-lived in-memory cache. Authentication and all Google
resource IDs remain controlled by server environment configuration.

## Deployment

The repository is connected to Vercel. Deployment, production environment
changes, and domain management are handled outside this development workflow.
