# Design — Overview

## What the app does

Local web app for generating monthly bank transfer import files. The user maintains a list of bill recipients, then each month selects which ones to pay, enters amounts and invoice numbers, and downloads a ready-to-import `.txt` file for Erste Internet Banking.

Format spec source: `format_danych.pdf` (Erste Bank, 17 pages, Polish).
Recipients import spec: `format_danych_Odbiorcy.pdf` (Erste Bank, 10 pages, Polish).
Elixir-0 spec: `Elixir-0_EN_2012-09-18_...pdf` (Millennium Bank, 11 pages, English).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | **Python 3.12 + FastAPI** | Typed, strong file I/O, easy to maintain |
| Database | **SQLite via SQLAlchemy** | Zero-config, single file, persisted via Docker volume |
| Frontend | **React 18 + TypeScript + Vite** | Maintainable, fast dev loop |
| Styling | **TailwindCSS** | No separate CSS files |
| Container | **Single Docker image** | FastAPI serves the built React assets — one container, no proxy |

## Project structure

```
BillsHelper/
├── backend/
│   ├── alembic/                      # Alembic migration environment
│   │   ├── env.py                    # SQLAlchemy + DATABASE_URL wiring
│   │   └── versions/                 # Versioned migration scripts
│   ├── alembic.ini                   # Alembic config
│   ├── app/
│   │   ├── main.py                   # FastAPI app, mounts static files
│   │   ├── database.py               # SQLAlchemy engine + session
│   │   ├── models.py                 # ORM models
│   │   ├── schemas.py                # Pydantic schemas (incl. IBAN validation)
│   │   └── routers/
│   │       ├── recipients.py         # CRUD
│   │       ├── import_recipients.py  # Parse + import bank recipients export file
│   │       ├── batches.py            # Create batch, list history
│   │       ├── export.py             # Transfer file generation
│   │       └── settings.py           # Own NRB config
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── i18n/
│   │   │   ├── index.ts              # i18next setup, localStorage persistence
│   │   │   ├── en.ts                 # English strings
│   │   │   └── pl.ts                 # Polish strings
│   │   ├── pages/
│   │   │   ├── Recipients.tsx        # Manage recipients + import
│   │   │   ├── CreateBatch.tsx       # Select bills + generate file
│   │   │   └── Settings.tsx          # Own NRB config
│   │   ├── components/
│   │   │   └── Layout.tsx            # Nav bar with language switcher
│   │   ├── hooks/
│   │   └── useBankRegistry.ts    # Lazy-loads plewibnra.json, returns NRB→bank lookup fn
│   ├── utils.ts                  # Shared NRB validation + formatting
│   │   └── api.ts                    # Typed API client
│   ├── package.json
│   ├── vite.config.ts
│   └── .nvmrc                        # Pins Node 20 for nvm
├── utilities/
│   └── plewibnra/
│       ├── parse_plewibnra.py            # Downloads + parses NBP PLEWIBNRA bank registry → JSON
│       └── README.md
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Out of scope (first version)

- ~~**Eliksir-0 `.pli` format**~~ — implemented (selectable at export time alongside Erste)
- **Authentication** — local-only hosting, no auth needed
- **Batch history / re-download** — file is generated and downloaded immediately; no history UI
