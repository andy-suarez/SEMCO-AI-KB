# SEMCO AI Chatbot - Changelog

All notable changes to this project will be documented in this file.

---

## [2026-03-04] - Project Initialization

### Added
- `CLAUDE.md` - Core project documentation with architecture, tech stack, DOs/DON'Ts, feedback loops, phase targets, and installed dependencies
- `UPDATE.md` - Changelog file (this file)
- Installed Python dependencies: `supabase` (2.28.0), `psycopg2-binary` (2.9.11), `requests` (2.32.5)

### Decisions
- **Hosting:** Render confirmed as backend hosting platform
- **Database:** Supabase confirmed as PostgreSQL provider (replaces generic self-hosted Postgres from spec)
- **Backups:** Supabase S3-compatible storage for JSON backups
- **CLI access:** Using Python SDKs instead of CLI tools (Render REST API via `requests`, Supabase via `supabase` client and `psycopg2`)

---

## [2026-03-04] - Initial FastAPI Project Scaffold

### Added
- `requirements.txt` - Python dependencies for Render build (fastapi, uvicorn, supabase, psycopg2-binary, httpx, python-dotenv, pydantic-settings)
- `app/__init__.py` - Package init
- `app/main.py` - FastAPI app with `GET /` (status) and `GET /health` (DB connectivity check)
- `app/config.py` - Pydantic BaseSettings loading env vars: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_DB_URL`, `RENDER_API_KEY`
- `app/db.py` - Supabase client factory using settings
- Updated `CLAUDE.md` with file structure and Render deployment commands

### Render Config
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Verified
- Local run: both `/` and `/health` return 200 OK

---

## [2026-03-04] - Knowledge Base CRUD + CSV Export

### Added
- `migrations/001_create_kb_entries.sql` - Table creation script (run in Supabase SQL Editor)
- `app/models/kb.py` - Pydantic models: `KBEntryCreate`, `KBEntryUpdate`, `KBEntryRead`, `KBEntryList`
- `app/routers/kb.py` - CRUD endpoints for `/kb` (list, get, create, update, delete)
- `app/routers/export.py` - CSV export endpoint `GET /export/csv` (question+answer pairs for Lyro import)
- Wired both routers into `app/main.py`

### KB Table Schema
- `id` (bigint auto), `question` (text), `answer` (text), `category` (text), `products` (text[]), `substrates` (text[]), `source` (text), `created_at`, `updated_at`
- Indexes on category, source, and GIN indexes on products/substrates arrays
- Auto-update trigger on `updated_at`
- RLS enabled with service role full access policy

### API Endpoints
- `GET /kb/` - List entries (filter by category/source, paginate with limit/offset)
- `GET /kb/{id}` - Get single entry
- `POST /kb/` - Create entry
- `PATCH /kb/{id}` - Partial update
- `DELETE /kb/{id}` - Delete entry
- `GET /export/csv` - Download all entries as CSV for Lyro

### Verified
- All 8 routes registered (confirmed via OpenAPI schema)
- App starts locally without import errors
