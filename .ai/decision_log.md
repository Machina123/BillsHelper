# Decision Log

## 2026-05-14

### Single Docker container instead of separate frontend/backend services
Serve the built React frontend as static files from FastAPI rather than running separate nginx + backend containers. Simplifies deployment to a single `docker compose up` with no proxy configuration.

### Python + FastAPI for backend
Chosen for readability, strong typing via Pydantic, and straightforward file generation (Windows-1250 encoding, custom text formatting). Alternatives considered: Node.js/Express (would unify the stack but adds less value for file I/O tasks).

### React + TypeScript + Vite for frontend
Standard maintainable stack with fast build times. TailwindCSS chosen to avoid maintaining a separate CSS layer. Alternatives considered: plain HTML + vanilla JS (simpler but harder to maintain as forms grow).

### SQLite via SQLAlchemy
No external database needed for a local-only app. The DB file is persisted on the host via a Docker volume (`./data/`). Alternatives considered: PostgreSQL (overkill for single-user local use).

### Erste `.txt` format as primary export target
The PDF spec described two formats: Erste Internet Banking `.txt` and Eliksir-0 `.pli`. The `.txt` format was chosen as the primary target because it is more commonly used for personal transfers and has a simpler, more readable structure. Eliksir-0 is deferred for future addition.

### Split payment (type 6) implemented but not surfaced in UI
Split payment is a VAT mechanism used exclusively by businesses, not individuals. The data model and export logic support it for future expansion, but the UI does not expose it as a primary flow to keep the app focused on the individual bill-payment use case.

### i18n via i18next with bundled locale files
Used `i18next` + `react-i18next` with locale files compiled into the bundle (`en.ts`, `pl.ts`) rather than loaded lazily from a server. Rationale: the app is small and local-only — no need for the complexity of async locale loading. Language preference is persisted in `localStorage`. The language switcher in the nav bar toggles between EN and PL.

### Bank registry served as a static JSON file, looked up client-side
`plewibnra.json` (585 entries, ~60 KB) is served from `frontend/public/` so Vite copies it to `dist/` unchanged. The frontend fetches it once via React Query (`staleTime: Infinity`, `gcTime: Infinity`) and builds a `Map<id, name>` for O(1) lookups. Lookup tries the 5-digit routing prefix first, then 4-digit, then 3-digit — longest match wins. Alternatives considered: store bank name in the DB (rejected — the registry changes independently of user data; keeping it out of the DB avoids migration noise); fetch from NBP at runtime (rejected — adds external network dependency to the app).

### Bank name not stored in the database
The bank name is derived on the fly from the routing prefix of the NRB. This keeps the data model clean and means the displayed name always reflects the latest imported registry without requiring any migration.

### Recipient sorting done client-side
Sorting by full name and short name is handled entirely in the frontend (`sortedRecipients` derived array) rather than via API query parameters. Rationale: recipients are already fully loaded into React Query's cache — a round-trip for sorting would be slower and add unnecessary backend complexity. Recipients without a short name always sort to the end when sorting by short name, falling back to full-name order among themselves.

### Alembic adopted for schema migrations; create_all removed
`Base.metadata.create_all()` was removed from `main.py`. Alembic is now the sole owner of the schema. The Dockerfile CMD runs `alembic upgrade head` before starting uvicorn so migrations are applied automatically on every container start. Alternatives considered: keeping `create_all` as a fallback for fresh installs (rejected — it silently skips existing tables and masks missing columns, which is exactly the problem Alembic solves).

### render_as_batch=True enabled globally in Alembic env.py
SQLite does not support most `ALTER TABLE` operations natively. Alembic's batch mode rewrites affected tables to apply changes. Enabled globally in `env.py` so all future migrations work correctly on SQLite without per-migration configuration.

### Recipients import in a separate router module
The import endpoint (`POST /api/recipients/import`) lives in `routers/import_recipients.py` rather than `routers/recipients.py`. This avoids making the main recipients router dependent on file-upload handling and keeps the parsing logic self-contained and independently testable.

### Import skips duplicates by NRB
When importing from a bank export file, recipients whose NRB already exists in the database are silently skipped and counted in `skipped`. Alternatives considered: overwrite existing record (too destructive without a diff preview), error out on first duplicate (poor UX for large files). Chosen approach lets the user re-import the same file safely.

### Bank export "Tytułem" field mapped to `title_suffix`
The bank's domestic recipients export includes an optional default title per recipient ("Tytułem"). This maps directly to the `title_suffix` field introduced for the same purpose, so the imported value is immediately usable when generating transfers.

### Elixir-0 format implemented in existing export endpoint via query params
Added `?format=erste|elixir&encoding=cp852|windows-1250|utf-8` to `GET /api/export/{batch_id}` rather than creating a second endpoint. Alternatives considered: separate `/api/export/elixir/{batch_id}` endpoint (cleaner separation but redundant routing, harder to link from UI). Chosen approach keeps the frontend URL construction in one place and the format/encoding pair travels together.

### Elixir-0 default encoding is CP852
The Millenet spec (source PDF) explicitly states CP852 as the default. Windows-1250 and UTF-8 are offered as alternatives for other banks' import tools that expect those encodings. Erste `.txt` is always Windows-1250 (non-configurable, per the Erste spec).

### Execution date is mandatory in Elixir-0; falls back to today
The Erste format treats execution date as optional and simply omits it. Elixir-0 requires it (position 2, `YYYYMMDD`). If the user left it blank, the generator uses `datetime.date.today()` so the file is always valid.

### Counterparty name+address packed into 4 subfields without empty middle fields
The Elixir-0 spec allows up to 4 subfields of 35 chars (name1, name2, addr1, addr2). When the name fits in 35 chars the empty name2 slot is skipped and address follows immediately, matching the field structure shown in the spec's own examples.

### Bank recipient type 2 (tax office) mapped to transfer_type 3
The bank's export uses type 2 for tax office recipients. Our internal transfer_type 3 (urząd skarbowy) is the correct semantic match. Export logic for type 3 is deferred, but the data is stored correctly for when it is implemented.

### Transfer types 2, 3, 4 deferred
ZUS/KRUS (type 2) and tax office transfers (type 3/4) are included in the recipient `transfer_type` field for future use but export logic for their specific field layouts is not yet implemented.

## 2026-05-16

### SPA catch-all route instead of StaticFiles(html=True)
`StaticFiles(html=True)` only serves `index.html` for directory-like paths; direct navigation to `/recipients` or a page refresh returned FastAPI's JSON 404 instead of the SPA shell. Replaced with an explicit `/assets` mount for the Vite-built bundles and a `/{full_path:path}` catch-all that returns `index.html` for any path not matched by the API routers or an existing file in `dist/`.

### LineIcons upgraded from v4.0 to v5.1
The CDN URL and all icon class names changed between major versions (e.g. `lni-layers` → `lni-layers-1`, `lni-world` → `lni-globe-1`, `lni-save` → `lni-floppy-disk-1`). Updated the `<link>` in `index.html` to the v5.1 line variant and renamed every icon class across `Layout.tsx`, `CreateBatch.tsx`, `Recipients.tsx`, and `Settings.tsx`.
