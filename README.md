# Internal File Hosting (Cloudflare Workers + R2 + D1)

A production-ready internal file host with:
- Worker API endpoints for upload/list/delete/download redirect
- R2 object storage
- D1 metadata + download counters
- HTMX + Tailwind admin UI

## Features
- Upload file via admin UI (`/`)
- JSON upload endpoint (`POST /api/upload`)
- Public download route (`GET /d/:id`) that increments download count before redirect
- File list API (`GET /api/files`)
- File delete API (`DELETE /api/files/:id`)
- Password login form and Cloudflare Access header support

## Project Structure
- `src/index.ts` – Worker routes and API
- `src/templates.ts` – HTMX/Tailwind HTML templates
- `src/utils.ts` – ID/hash/sanitization utilities
- `db/migrations/0001_init.sql` – D1 schema
- `db/seed.sql` – local seed data
- `scripts/seed.sh` – seed helper

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create D1 DB + R2 bucket in Cloudflare and update `wrangler.toml` IDs/names.
3. Apply migration locally:
   ```bash
   npm run db:migrate:local
   ```
4. Seed local data (optional):
   ```bash
   npm run db:seed:local
   ```
5. Set secrets:
   ```bash
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put R2_SECRET_ACCESS_KEY
   ```
   Also set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_BUCKET_NAME` in `wrangler.toml` (or env-specific config).
6. Run locally:
   ```bash
   npm run dev
   ```

## API
### `POST /api/upload`
Multipart fields:
- `file` (required)
- `uploader` (required)

Response:
```json
{ "id": "abc123...", "publicUrl": "https://<host>/d/<id>" }
```

### `GET /d/:id`
- Looks up metadata
- Increments `files.downloads`
- Inserts optional download event row (`downloads` table)
- Redirects (`302`) to signed R2 URL

### `GET /api/files`
Returns file metadata and download counts.

### `DELETE /api/files/:id`
Deletes object in R2 and metadata in D1.

## Testing
```bash
npm test
npm run typecheck
```
