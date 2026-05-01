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

---

## [2026-04-28] - KB Seed + Phase 0.5 Plan

### Added
- `migrations/002_seed_kb_entries.sql` - One-shot seed for the existing 148 Q&As from the Excel Repository CSV. Wrapped in a transaction with a non-empty guard so re-runs are safe; multi-product entries (e.g., Stone Soap / Power Cleaner) parse into proper Postgres `text[]` literals.
- `scripts/import_csv.py` - Alternative one-shot importer via the Supabase Python client. Requires local env vars; rarely used now that the SQL seed exists.
- `.env.example` - Template for any local script that needs Supabase creds.
- `.gitignore` - Added; previously missing.
- `Phase 0.5 UI.md` - Phase plan for the admin UI. Approved by manager on 2026-04-28.

### Loaded
- 148 Q&A entries imported via `migrations/002` ran in Supabase SQL Editor.
- All 6 categories represented: Application Inquiry (60), Product Knowledge (45), General Inquiry (22), Technical Inquiry (19), Installer Inquiry (1), Color (1).

---

## [2026-04-30] - Phase A: Auth Foundation

### Added
- `app/auth.py` - `verify_jwt` FastAPI dependency that validates Supabase-issued JWTs.
- `migrations/003_update_rls_for_authenticated_users.sql` - Replaces the earlier catch-all "Service role full access" policy (which technically permitted anon) with `FOR ALL TO authenticated` so the React UI gets gated by login while service_role still bypasses RLS for backend scripts.
- CORS middleware in `app/main.py` reading `ALLOWED_ORIGINS` (comma-split list) for the future static site origin.
- New env vars: `ALLOWED_ORIGINS` on Render API service.
- Dependency: `pyjwt`.

### Applied
- `verify_jwt` attached as a router-wide dependency on `/kb/*` and `/export/csv`. `/` and `/health` remain public for deploy probes.

### Verified
- Locally: valid tokens accepted, wrong audience / expired / bad signature / garbage all return 401.

---

## [2026-04-30] - Phase B: Admin UI Scaffold

### Added
- `web/` directory: full Vite + React 18 + TypeScript + Tailwind CSS + shadcn-style component scaffold.
- `web/README.md` with build/run notes.
- Auth flow: `AuthProvider` context, `AuthGuard` route wrapper, `LoginPage` with Supabase email/password sign-in.
- Empty admin shell: sidebar nav (KB / Unanswered / Sync), topbar with logged-in email + sign-out.
- `web/src/lib/api.ts`: `apiFetch` wrapper that attaches the user's JWT to FastAPI calls.
- Hand-rolled UI primitives in `web/src/components/ui/`: button, card, input, label (kept dependency-free at this stage; Radix Dialog added in Phase C).
- New Render service: `semco-kb-admin` (Static Site, free tier) auto-deploying from `main`.
- New env vars on the static site: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.

### Fixed (mid-phase)
- Initial Render build failed with `TS6310: Referenced project ... may not disable emit`. Collapsed the `tsconfig.json` + `tsconfig.node.json` project-references split into a single self-contained `tsconfig.json` (`tsc --noEmit && vite build`).

### Verified
- Login screen blocks unauthenticated access; login redirects to the admin shell; sign-out returns to the login page.

---

## [2026-04-30] - Phase C: KB CRUD UI

### Added
- `web/src/lib/kb.ts` - Types (`KBEntry`, `KBEntryInput`, `KBListFilters`) and Supabase queries: `listKBEntries`, `listKBFacets`, `createKBEntry`, `updateKBEntry`, `deleteKBEntry`. Direct browser → Supabase, gated by the Phase A RLS policy.
- `web/src/pages/KBEntriesPage.tsx` - Sortable table (default `updated_at` DESC), filters (full-text search debounced 250ms across question+answer, plus category and source dropdowns from distinct values), pagination at 50/page.
- `web/src/components/KBEntryDialog.tsx` - Add/edit form with comma-separated parsing for the `products` and `substrates` arrays.
- `web/src/components/DeleteConfirmDialog.tsx` - Confirmation with question preview.
- `web/src/components/ui/`: `dialog.tsx`, `textarea.tsx`, `table.tsx`, `badge.tsx`, `select.tsx`.
- New runtime dep: `@radix-ui/react-dialog`.

### Verified
- Create / edit / delete all round-trip cleanly. Multi-value array entries (e.g. Stone Soap + Power Cleaner) preserve correctly through the form.

---

## [2026-04-30] - Phase D (Modified): CSV Download Flow

### Discovered
- Tidio's Growth plan does **not** include Lyro AI's API. Programmatic Data Source replacement and unanswered-question read are gated behind a higher tier. Phase D's "one-click sync" and "live unanswered tab" can't ship as planned.

### Adjusted plan
- `Sync to Lyro` page now provides a CSV **download** instead of a push. Workflow: click → browser downloads `semco_kb_<YYYY-MM-DD>.csv` from `GET /export/csv` → user manually uploads to Tidio's Knowledge Sources.
- `Unanswered Questions` page intentionally left empty; the manual workflow is to review unanswered conversations inside Tidio's admin and create entries via the KB Entries page.

### Added
- Cold-start tolerance on the download button: 90s `AbortController` timeout, button label flips to "Waking up the API…" after 5s with no response. AbortError surfaces a friendly cold-start hint instead of a generic failure.
- `localStorage` "last download" timestamp displayed on the Sync card so the team can tell freshness at a glance.
- Numbered upload-to-Tidio instructions on the Sync page.

---

## [2026-04-30] - JWT Verification Migration: HS256 → JWKS

### Issue
- After Phase A landed, the first `/export/csv` call from the deployed UI returned `401 Invalid token: The specified alg value is not allowed`. Inspecting the JWT header showed `alg: ES256` — Supabase has migrated to **asymmetric** JWT signing keys (per-project public keys published via JWKS), not the legacy HS256 + shared secret.

### Fixed
- `app/auth.py`: replaced HS256 + `SUPABASE_JWT_SECRET` decoding with `PyJWKClient` fetching `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. Accepts both `ES256` and `RS256`. JWKS is cached by PyJWT for 1 hour.
- `requirements.txt`: `pyjwt` → `pyjwt[crypto]` AND explicit `cryptography`. The double dependency is intentional — Render's pip wheel cache silently dropped the `[crypto]` extras at least once until a "Clear build cache & deploy" forced a fresh install.
- `SUPABASE_JWT_SECRET` env var on Render is now unused; safe to delete.

### Diagnostic
- `GET /health` extended to return `git_commit` (from Render's `RENDER_GIT_COMMIT`) and `jwt_algorithms` (from `jwt.algorithms.get_default_algorithms().keys()`). Both are needed to verify remotely whether a deploy actually picked up the latest code AND whether `cryptography` loaded so ES256/RS256 are available.

### Operational learning
- Render's free tier sometimes lags on auto-deploy and pip cache invalidation. The diagnostic `/health` fields above are how we confirmed which build was actually serving requests. Logged in CLAUDE.md DOs/DON'Ts.

---

## [2026-04-30] - Phase 0.5 Status

### Shipped
- ✅ Phase A — Auth foundation (Supabase Auth + JWKS + RLS + CORS)
- ✅ Phase B — React admin shell on Render Static Site
- ✅ Phase C — KB CRUD with search/filter/edit/delete
- ✅ Phase D (revised) — CSV download with manual Tidio upload

### Deferred
- ⏸️ Live unanswered-questions feed — blocked on Tidio Lyro API tier.

### Net new monthly cost
- **$0** (both Render services on free tier; Supabase + Tidio plans unchanged).

### Approved follow-up when Lyro API becomes available
- Add `TIDIO_API_KEY` to API service env vars
- Add FastAPI proxy `GET /unanswered` (read Tidio Conversations API, filter for unanswered/handoff)
- Wire `UnansweredPage` to it with the "Add to repository" flow
- Estimated: half a day
