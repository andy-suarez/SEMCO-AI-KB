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
