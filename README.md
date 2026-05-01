# SEMCO AI Knowledge Base

Backend + admin UI for SEMCO Surfaces' AI customer support chatbot. The chatbot itself is Tidio Lyro (powered by Claude); this repo holds the master knowledge base that feeds Lyro and the FastAPI service that backs it.

## What's here

| Path | What it is |
|---|---|
| [`app/`](app/) | FastAPI service deployed to Render at `semco-ai-kb.onrender.com`. KB CRUD, CSV export, Supabase JWT auth (JWKS-verified). |
| [`web/`](web/) | React + Vite admin UI deployed to Render Static Site at `semco-kb-admin.onrender.com`. Login-gated; lets the team add / edit / delete KB entries and download the latest CSV for Lyro. |
| [`migrations/`](migrations/) | Numbered SQL migrations to run in Supabase SQL Editor. |
| [`scripts/`](scripts/) | One-off importers and utilities. |
| [`CLAUDE.md`](CLAUDE.md) | Full project context, architecture, dos/don'ts, file structure, deployment env vars. **Read this first.** |
| [`UPDATE.md`](UPDATE.md) | Changelog. |
| [`Phase 0.5 UI.md`](Phase%200.5%20UI.md) | Approved plan + final outcomes for the admin UI build. |

## How knowledge flows

```
Admin UI / Supabase Studio       Master DB                Tidio Lyro
        │                            │                         │
        │  edit kb_entries           │                         │
        ├───────────────────────────►│                         │
        │                            │                         │
        │  click "Download CSV"      │   GET /export/csv       │
        │◄────────────────────────── │ ◄───── csv from rows    │
        │  (manual upload to Tidio)  │                         │
        ├──────────────────────────────────────────────────────►│
                                                                │
                                            Lyro indexes the CSV
                                            and answers customer
                                            questions from its own
                                            internal snapshot.
```

**Supabase is the master.** The CSV is a derived snapshot. Lyro's index is a snapshot of that snapshot. Anything edited inside Tidio's UI is wiped on the next CSV re-upload — always edit in Supabase first.

## Quick links

- **Live API:** https://semco-ai-kb.onrender.com (status: `/`, diagnostics: `/health`)
- **Admin UI:** https://semco-kb-admin.onrender.com (login required)
- **Knowledge entries:** 148 (as of 2026-04-30) — see [`migrations/002_seed_kb_entries.sql`](migrations/002_seed_kb_entries.sql)

## Phase status

- **Phase 1 — KB consolidation, Lyro configuration, internal testing:** ✅ KB live, 148 entries, Lyro internal testing in progress
- **Phase 0.5 — Admin UI:** ✅ Shipped 2026-04-30 (Lyro API integration deferred — see [Phase 0.5 UI.md](Phase%200.5%20UI.md))
- **Phase 2 — Shopify integration, Lyro Actions, customer launch:** Upcoming
- **Phase 3 — B2B portal, Zoho integration, multi-language:** Future

## Development

### Backend (FastAPI)

```bash
pip install -r requirements.txt
# Set env vars (see CLAUDE.md > Render Deployment) or use a local .env
uvicorn app.main:app --reload
# http://localhost:8000
```

### Admin UI (React)

```bash
cd web
cp .env.example .env.local   # fill in real Supabase values
npm install
npm run dev
# http://localhost:5173
```

Requires Node 20+ and Python 3.11+. Both deploy automatically from `main` to Render.
