# SEMCO AI Chatbot - Knowledge Base & Backend System

## Project Overview

Backend system for the SEMCO AI customer support chatbot. Tidio/Lyro handles the chat UI and AI responses (powered by Claude). We build and maintain:

- A centralized PostgreSQL knowledge base (hosted on Supabase)
- FastAPI backend APIs that Lyro Actions call for live data (hosted on Render)
- An admin dashboard for KB management
- CSV export pipelines to sync data into Lyro

We do NOT build a custom chat UI or connect a custom LLM.

## Architecture

| Component              | Platform                                  |
|------------------------|-------------------------------------------|
| AI chatbot engine      | Lyro (Tidio) - powered by Claude          |
| Knowledge base feed    | Tidio Lyro Data Sources (CSV import, URL scanning, manual Q&A) |
| Master KB database     | PostgreSQL on Supabase                    |
| Backend API            | FastAPI on Render (`semco-ai-kb`)         |
| Admin dashboard        | React + Vite + shadcn-style UI on Render Static Site (`semco-kb-admin`) |
| Auth                   | Supabase Auth (email/password); JWT verified server-side via Supabase JWKS |
| Chat widget            | Tidio (single widget, all brand sites)    |
| Live data lookups      | Lyro Actions -> FastAPI endpoints on Render *(blocked: Lyro API not on current Tidio plan)* |
| Product recommendations| Lyro Product Recommendations (OpenAPI) -> Shopify |
| CRM                    | Zoho CRM (existing)                       |
| E-commerce             | Shopify (existing)                        |
| Backups                | Supabase (S3-compatible storage, JSON format) |

**Live URLs:**
- API: `https://semco-ai-kb.onrender.com`
- Admin UI: `https://semco-kb-admin.onrender.com`

## Tech Stack

- **Backend:** Python, FastAPI, PyJWT (with cryptography for ES256/RS256), httpx
- **Database:** PostgreSQL on Supabase, RLS enforced for `kb_entries`
- **Hosting:** Render (Web Service for API, Static Site for admin UI; both free tier)
- **Frontend (admin):** Vite + React 18 + TypeScript + Tailwind CSS + shadcn-style components (Radix Dialog primitives, hand-rolled in `web/src/components/ui/`)
- **Auth:** Supabase Auth (email/password); JWT verified via JWKS public-key lookup (asymmetric ES256/RS256, not legacy HS256)
- **Integrations:** Shopify API, Zoho CRM API; Tidio API gated behind a Lyro-tier plan we don't currently have
- **Data format:** CSV for Lyro imports, JSON for backups

## Installed Dependencies

### Python Packages (`requirements.txt`, installed by Render at deploy)

| Package              | Purpose                                                       |
|----------------------|---------------------------------------------------------------|
| `fastapi`            | API framework                                                 |
| `uvicorn[standard]`  | ASGI server                                                   |
| `supabase`           | Supabase Python client (anon + service role)                  |
| `psycopg2-binary`    | Direct PostgreSQL fallback (rarely used; client lib preferred)|
| `httpx`              | Async HTTP client                                             |
| `python-dotenv`      | Local `.env` loading                                          |
| `pydantic-settings`  | Typed env-var config                                          |
| `pyjwt[crypto]`      | JWT decode/verify (PyJWKClient for asymmetric Supabase tokens) |
| `cryptography`       | Backs ES256/RS256 signature checks; explicit dep so pip can't skip it on cache hits |

### Node Packages (`web/package.json`, installed by Render Static Site)

Selected highlights — see `web/package.json` for the full list:

| Package                     | Purpose                                       |
|-----------------------------|-----------------------------------------------|
| `react` / `react-dom`       | UI runtime (v18)                              |
| `react-router-dom`          | SPA routing                                   |
| `@supabase/supabase-js`     | Auth + direct DB access (RLS-gated)           |
| `@radix-ui/react-dialog`    | Accessible modal primitive                    |
| `tailwindcss`               | Styling                                       |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn-style component variants |
| `lucide-react`              | Icons                                         |
| `sonner`                    | Toast notifications                           |
| `vite`, `typescript`        | Build / type-check                            |

### CLI Tools

- **Render CLI:** Not installed (requires Homebrew/npm). Use Render REST API via `requests` instead.
- **Supabase CLI:** Not installed (requires Homebrew/npm). Use `supabase` Python client and `psycopg2` instead.

### How to Use

**Supabase (DB queries, data management):**
```python
from supabase import create_client
client = create_client(SUPABASE_URL, SUPABASE_KEY)
# Query: client.table("kb_entries").select("*").execute()
# Insert: client.table("kb_entries").insert({"question": "...", "answer": "..."}).execute()
```

**Supabase (direct SQL via psycopg2):**
```python
import psycopg2
conn = psycopg2.connect(SUPABASE_DB_CONNECTION_STRING)
cur = conn.cursor()
cur.execute("SELECT * FROM kb_entries WHERE category = %s", ("safety",))
```

**Render API (deployments, logs, services):**
```python
import requests
headers = {"Authorization": f"Bearer {RENDER_API_KEY}"}
# List services: requests.get("https://api.render.com/v1/services", headers=headers)
# Get logs: requests.get(f"https://api.render.com/v1/services/{service_id}/logs", headers=headers)
```

## Key Backend API Endpoints (Phase 2)

- Order status lookup (Shopify)
- Product stock levels (Shopify)
- Escalation / ticket creation (Zoho CRM - Cases module)
- Dealer profile sync (Zoho CRM - Phase 3)
- Conversation summary push to Zoho (Phase 3)

## Knowledge Base Schema

Entries are structured as: question, answer, category, products, substrates.
Sources consolidated into master DB:

1. Excel knowledge repository (tiebreaker for conflicts)
2. TDS/SDS PDF content (chunked by section: surface prep, mixing, curing, safety)
3. Existing Tidio Q&As
4. Shopify Knowledge Base entries

## DOs

- Always export master DB as CSV (question + answer pairs) for Lyro import
- Always edit KB entries in **Supabase** (via the admin UI or Studio), then re-export the CSV to Lyro. Supabase is the master; Lyro's index is a derived snapshot.
- Deduplicate across all data sources before loading into master DB
- Use Excel repo as the tiebreaker when sources conflict
- Manually add high-priority Q&As with exact wording (safety procedures, warranty info)
- Set up handoff rules for when Lyro can't answer -> route to human via Tidio inbox
- Automate Shopify product catalog sync every 6 hours via cron jobs
- Convert resolved escalations into new Lyro Q&As weekly
- Keep unanswered question queue under target thresholds
- Use Lyro Audiences to separate B2B (dealer/pro) vs B2C content where applicable
- Push conversation summaries to Zoho on escalation
- Store backups in Supabase storage as JSON format
- Use Supabase client library for all DB operations (not raw SQL unless necessary)
- Deploy backend services to Render; use Render's built-in logging and monitoring
- Hit `Manual Deploy → Clear build cache & deploy` on the API service after dependency changes — Render's pip cache can hide new packages otherwise

## DON'Ts

- Do NOT build a custom chat UI -- Tidio handles all frontend chat
- Do NOT connect or integrate a custom LLM -- Lyro already uses Claude
- Do NOT bypass Lyro for AI responses; all AI answering goes through Tidio/Lyro
- Do NOT import data into Lyro without deduplication against master DB first
- Do NOT hardcode knowledge into the backend -- all knowledge lives in the master DB and flows to Lyro via CSV
- Do NOT edit KB entries inside Tidio's Lyro UI. Anything edited there gets wiped on the next CSV re-upload. Edit in Supabase, re-export.
- Do NOT skip the feedback loops (unanswered questions, conversation review, escalation learning, analytics)
- Do NOT make Lyro answer questions it's unsure about -- configure confidence thresholds and "I don't know" behavior
- Do NOT deploy to customer-facing sites without hitting 85% answer accuracy in internal testing
- Do NOT forget safety disclaimers in Lyro Guidance configuration
- Do NOT store secrets in code -- use environment variables on Render and Supabase project settings
- Do NOT run raw SQL against Supabase in production when the client library covers the use case
- Do NOT ship the Supabase **service role** key to the browser — only the anon key. RLS does the gating.
- Do NOT use HS256 + a shared `SUPABASE_JWT_SECRET` for token verification on this project. Supabase issues asymmetric JWTs (ES256); verify via JWKS.

## Feedback Loops (All Required)

1. **Unanswered Questions** - Review daily, target < 20 in queue
2. **Conversation Review** - Sample 10-20/week, target > 90% correct
3. **Escalation Learning** - Convert resolutions to Q&As weekly, target < 15% escalation rate
4. **Lyro Analytics** - Review weekly: answer rate > 70%, satisfaction > 85%

## Project Phases

- **Phase 1 (Weeks 1-8):** KB consolidation, Lyro configuration, internal testing
- **Phase 2 (Weeks 8-16):** FastAPI backend on Render, Lyro Actions, go live on customer sites
- **Phase 3 (Weeks 16-22):** B2B Pro portal, full Zoho integration, multi-language, automation

## Success Targets

| KPI                    | Phase 1 (Wk 8) | Phase 2 (Wk 16) | Phase 3 (Wk 22) |
|------------------------|-----------------|------------------|------------------|
| KB entries in Lyro     | > 300 Q&As      | > 500 Q&As       | > 700 Q&As       |
| Lyro answer rate       | > 60%           | > 70%            | > 75%            |
| Escalation rate        | < 25%           | < 15%            | < 10%            |
| Unanswered queue       | < 30 open       | < 20 open        | < 10 open        |
| Avg response time      | < 5 seconds     | < 5 seconds      | < 5 seconds      |
| Support email/call reduction | N/A       | 15-20%           | 30-40%           |
| B2B dealer adoption    | N/A             | N/A              | > 50% active dealers |

## File Structure

```
CLAUDE.md                    # System rules, architecture, dos/don'ts (this file)
UPDATE.md                    # Changelog for all project changes
README.md                    # Project intro for new readers / managers
Phase 0.5 UI.md              # Approved phase plan + final outcomes for the admin UI
requirements.txt             # Python dependencies (Render uses this for builds)
.env.example                 # Template env vars for local one-shot scripts
.gitignore

migrations/
  001_create_kb_entries.sql                   # Initial table + indexes + trigger + RLS
  002_seed_kb_entries.sql                     # 148-row seed from Excel Repository
  003_update_rls_for_authenticated_users.sql  # Tightens RLS to authenticated role only

scripts/
  import_csv.py              # Alternative one-shot importer via Supabase client (rarely used now)

app/                         # FastAPI service (semco-ai-kb on Render)
  __init__.py
  main.py                    # FastAPI app, CORS middleware, /, /health (with diagnostics), router mounts
  config.py                  # Pydantic BaseSettings (SUPABASE_URL, SUPABASE_KEY, ALLOWED_ORIGINS, etc.)
  db.py                      # Supabase client factory (service role)
  auth.py                    # verify_jwt FastAPI dependency — Supabase JWKS lookup, ES256/RS256
  models/
    __init__.py
    kb.py                    # Pydantic models: KBEntryCreate/Update/Read/List
  routers/
    __init__.py
    kb.py                    # CRUD endpoints: GET/POST/PATCH/DELETE /kb (JWT-protected)
    export.py                # CSV export: GET /export/csv (JWT-protected)

web/                         # React admin UI (semco-kb-admin Render Static Site)
  package.json
  tsconfig.json              # Single self-contained TS config (no project references)
  vite.config.ts
  tailwind.config.js
  postcss.config.js
  index.html
  README.md                  # web-specific build/run notes
  .env.example               # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
  src/
    main.tsx                 # entry
    App.tsx                  # router + AuthProvider
    index.css                # Tailwind base + shadcn CSS variables
    lib/
      supabase.ts            # Supabase client factory (anon key)
      auth.tsx               # AuthProvider context + useAuth hook
      api.ts                 # apiFetch wrapper that attaches the user's JWT to FastAPI calls
      kb.ts                  # KB types + Supabase CRUD queries (list/create/update/delete/facets)
      utils.ts               # cn() className helper
    components/
      Layout.tsx             # sidebar + topbar (logged-in user, sign out)
      KBEntryDialog.tsx      # add/edit form
      DeleteConfirmDialog.tsx
      ui/                    # shadcn-style primitives (button, card, dialog, input, label, select, table, textarea, badge)
    pages/
      LoginPage.tsx          # email/password sign-in
      KBEntriesPage.tsx      # main table + filters + pagination + add/edit/delete
      UnansweredPage.tsx     # placeholder; needs Lyro API access we don't have
      SyncPage.tsx           # CSV download + manual upload instructions
    routes/
      AuthGuard.tsx          # redirects unauthenticated users to /login
```

## Render Deployment

Two services, both auto-deploy from `main`. Free tier on both.

### `semco-ai-kb` (Web Service / Python — the FastAPI API)

- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Env vars:**
  - `SUPABASE_URL` — Supabase project URL (also used to derive the JWKS endpoint for JWT verification)
  - `SUPABASE_KEY` — Supabase service role key (bypasses RLS for backend/scripts)
  - `ALLOWED_ORIGINS` — comma-separated, must include `https://semco-kb-admin.onrender.com` and (optionally) `http://localhost:5173`
  - `SUPABASE_DB_URL` *(optional)* — direct Postgres connection string for psycopg2 fallback
  - `RENDER_API_KEY` *(optional)* — for scripts that talk to Render's REST API
  - `SUPABASE_JWT_SECRET` *(legacy / unused)* — kept for back-compat; safe to delete

### `semco-kb-admin` (Static Site — the React admin UI)

- **Root Directory:** `web`
- **Build command:** `npm install && npm run build`
- **Publish directory:** `dist`
- **Env vars (must be prefixed `VITE_` to reach the browser bundle):**
  - `VITE_SUPABASE_URL` — same as the API service
  - `VITE_SUPABASE_ANON_KEY` — Supabase **anon public** key (NOT service role; RLS enforces access)
  - `VITE_API_BASE_URL` — `https://semco-ai-kb.onrender.com`

### Free-tier behavior to know about

- The API sleeps after 15 min idle. First request after sleep takes 30–60s. The admin UI's CSV download surfaces this with a "Waking up the API…" button label.
- Auto-deploy can occasionally lag or skip; if a push doesn't reflect within a few minutes, **Manual Deploy → Clear build cache & deploy** is the reliable workaround. Pip wheel caching has bitten us at least once when adding native deps like `cryptography`.
- `GET /health` returns `git_commit` and `jwt_algorithms` fields specifically so deploy + dependency state can be verified remotely without dashboard access.
