# Agents

## Project context

BillsHelper is a local-only web app for generating monthly bank transfer import files. It supports two export formats:

- **Erste Internet Banking `.txt`** — pipe-separated, Windows-1250, header `4120414|1`
- **Elixir-0 `.pli`** — comma-separated, quoted fields, CRLF, selectable encoding (CP852 / Windows-1250 / UTF-8)

Recipients can be managed manually or imported directly from a bank export file (Erste domestic recipients `.txt`, Windows-1250).

Format specs are documented in `.ai/design/file-formats.md` and derived from:
- `format_danych.pdf` — Erste transfer export (Polish)
- `format_danych_Odbiorcy.pdf` — Erste recipients export (Polish)
- `Elixir-0_EN_2012-09-18_...pdf` — Elixir-0 / Millenet (English)

## Architecture

Single Docker container: a multi-stage build compiles the React frontend, then FastAPI serves the built assets alongside the API. SQLite database is persisted in `./data/` via a Docker volume.

```
backend/app/                FastAPI application (Python 3.12)
  routers/recipients.py     CRUD
  routers/import_recipients.py  Parse + import bank recipients export file
  routers/batches.py        Create/list/delete transfer batches
  routers/export.py         Generate Erste .txt or Elixir-0 .pli file
  routers/settings.py       Own NRB config
frontend/src/               React + TypeScript + Vite + TailwindCSS
  i18n/                     i18next bundles — en.ts and pl.ts
  utils.ts                  Shared NRB validation (IBAN mod-97) + formatting
utilities/                  Standalone helper scripts (outside the main app)
  plewibnra/                Downloads + parses the NBP PLEWIBNRA bank registry → JSON
Dockerfile                  Multi-stage: node:20-alpine → python:3.12-slim
docker-compose.yml          Single service, port 8080, ./data volume
```

## Running locally

```bash
# Backend (Python 3.12+)
cd backend && uvicorn app.main:app --reload --port 8080

# Frontend (Node 20 via nvm)
cd frontend && nvm use && npm install && npm run dev
```

Frontend dev server at `:5173` proxies `/api` → `:8080`.

## Key conventions

- **NRB accounts**: always stored and written as 26 raw digits (no spaces). Spaces are added in the UI only for display. Every NRB is validated with the IBAN mod-97 checksum (`validateNrb` in `utils.ts`, `_validate_nrb` in `schemas.py`).
- **Own account NRB**: stored in the `settings` table under key `own_account_nrb`. The export endpoint returns HTTP 422 if it is not configured.
- **Erste export encoding**: always Windows-1250. Amounts use decimal comma (`123,50`). Dates use `DD-MM-YYYY`. Every data line ends with a trailing `|`.
- **Elixir-0 export encoding**: CP852 by default; Windows-1250 and UTF-8 are selectable. Amounts are integer cents (`12350`). Dates use `YYYYMMDD`. Execution date falls back to today if not set. Lines end with CRLF.
- **Transfer title**: the final title written to the export file is `item.title` + ` ` + `recipient.title_suffix` (if set), truncated to 140 chars. The `title_suffix` is a static per-recipient string set on the recipient.
- **Transfer types**: type 1 (regular) is the primary use case for individuals. Type 6 (split payment / VAT) is in the data model and export logic but not highlighted in the UI — business-only feature for future expansion. Types 2, 3, 4 are in the data model only; export logic is deferred.
- **Static files path**: in `backend/app/main.py`, the frontend `dist/` is resolved with a single `..` from `app/main.py` → `/app/frontend/dist`. Two levels up overshoots the container root. Static assets are served via a `StaticFiles` mount at `/assets`; a catch-all `/{full_path:path}` route returns `index.html` for all other paths so React Router handles client-side navigation including direct URL access and page refresh.

## Decision log

Every major decision regarding the codebase — architecture choices, scope changes, format interpretations, dependency selections — should be recorded in `.ai/decision_log.md`. Include what was decided, why, and any alternatives that were considered.

## Architecture changes

Any addition or change to the architecture — new modules, new dependencies, structural refactors, changes to the data model, changes to the Docker setup — should be reflected in the relevant file under `.ai/design/`:

| File | Covers |
|---|---|
| `overview.md` | App purpose, tech stack, project structure |
| `data-model.md` | Database tables and columns |
| `frontend.md` | Pages, routes, localisation |
| `file-formats.md` | Transfer export formats (Erste + Elixir-0), recipients import format |
| `infrastructure.md` | Docker, deployment, environment variables |

Keep these files in sync with the actual codebase.

## Development notes

- Node is managed via `nvm`; `.nvmrc` in `frontend/` pins Node 20.
- Do not run `npm audit fix` across major Vite versions — `@vitejs/plugin-react@^4.x` has a peer dependency on Vite 5.
- The `data/` directory, `.env`, and `.claude/` are gitignored and must not be committed.
