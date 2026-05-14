# BillsHelper

A local web app for generating monthly bank transfer import files compatible with **Elixir-O** (a.k.a. Multicash PLI) or **Erste Poland Internet Banking** formats.

## What it does

- Manage a list of bill recipients (name, address, account NRB, transfer type)
- Each month: select which recipients to pay, enter amounts and invoice numbers
- Download a ready-to-import `.txt` file for your bank

## Stack

- **Backend**: Python + FastAPI + SQLite
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Container**: Single Docker image

## Utilities

Standalone scripts in `utilities/` that support the project but run outside the main app:

| Script | Description |
|---|---|
| [`utilities/plewibnra/`](utilities/plewibnra/) | Downloads and parses the NBP PLEWIBNRA bank registry into a JSON list of unique banks with their identifiers |

## Quick start

| Command | Description |
|---|---|
| `make install` | Install Python and Node.js dependencies |
| `make run` | Build and start the Docker container |
| `make rerun` | Tear down and rebuild the Docker container |
| `make dev` | Start backend and frontend dev servers |
| `make clean` | Remove build artefacts, `node_modules`, and the local database |

## Running with Docker

```bash
cp .env.example .env
make run
```

App will be available at [http://localhost:8080](http://localhost:8080).

The SQLite database is persisted in `./data/` on the host.

## Local development

Requires Python 3.12+ and Node.js 20+.

```bash
cp .env.example .env
make install
make dev
```

This starts the backend on `:8080` and the frontend dev server on `:5173` (proxies `/api` to the backend). Press `Ctrl+C` to stop the frontend; run `pkill -f uvicorn` to stop the backend.

### Manual setup (without Make)

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8080

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Database migrations

Schema changes are managed with Alembic. To apply all pending migrations:

```bash
cd backend
alembic upgrade head
```

To create a new migration after changing `models.py`:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
```

Always review the generated file in `alembic/versions/` before committing.

Frontend dev server runs at [http://localhost:5173](http://localhost:5173) and proxies `/api` to the backend.

## First-time setup

1. Open **Settings** and enter your bank account NRB (26 digits)
2. Go to **Recipients** and add your bill recipients
3. On the home page, select bills to pay, fill in amounts, and download the transfer file

## License

This project is licensed under [MIT License](./LICENSE.md).

## Acknowledgements

Code in this repository has been co-authored by [Claude](https://claude.ai) from Anthropic.
