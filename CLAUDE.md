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
| Backend API            | FastAPI on Render                         |
| Admin dashboard        | React or Vercel + FastAPI                 |
| Chat widget            | Tidio (single widget, all brand sites)    |
| Live data lookups      | Lyro Actions -> FastAPI endpoints on Render |
| Product recommendations| Lyro Product Recommendations (OpenAPI) -> Shopify |
| CRM                    | Zoho CRM (existing)                       |
| E-commerce             | Shopify (existing)                        |
| Backups                | Supabase (S3-compatible storage, JSON format) |

## Tech Stack

- **Backend:** Python, FastAPI
- **Database:** PostgreSQL on Supabase
- **Hosting:** Render (backend API + admin dashboard)
- **Frontend (admin):** React or Vercel
- **Integrations:** Shopify API, Zoho CRM API, Tidio/Lyro API
- **Data format:** CSV for Lyro imports, JSON for backups

## Installed Dependencies

### Python Packages (via pip3 --user)

| Package            | Version | Purpose                                      |
|--------------------|---------|----------------------------------------------|
| `supabase`         | 2.28.0  | Supabase Python client - DB queries, auth, storage, realtime |
| `psycopg2-binary`  | 2.9.11  | Direct PostgreSQL connection to Supabase Postgres |
| `requests`         | 2.32.5  | HTTP client for Render REST API calls        |
| `httpx`            | 0.28.1  | Async HTTP client (installed as supabase dependency) |
| `pydantic`         | 2.12.5  | Data validation (installed as supabase dependency) |

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

## DON'Ts

- Do NOT build a custom chat UI -- Tidio handles all frontend chat
- Do NOT connect or integrate a custom LLM -- Lyro already uses Claude
- Do NOT bypass Lyro for AI responses; all AI answering goes through Tidio/Lyro
- Do NOT import data into Lyro without deduplication against master DB first
- Do NOT hardcode knowledge into the backend -- all knowledge lives in the master DB and flows to Lyro via CSV
- Do NOT skip the feedback loops (unanswered questions, conversation review, escalation learning, analytics)
- Do NOT make Lyro answer questions it's unsure about -- configure confidence thresholds and "I don't know" behavior
- Do NOT deploy to customer-facing sites without hitting 85% answer accuracy in internal testing
- Do NOT forget safety disclaimers in Lyro Guidance configuration
- Do NOT store secrets in code -- use environment variables on Render and Supabase project settings
- Do NOT run raw SQL against Supabase in production when the client library covers the use case

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
CLAUDE.md              # System rules, architecture, dos/don'ts (this file)
UPDATE.md              # Changelog for all project changes
requirements.txt       # Python dependencies (Render uses this for builds)
app/
  __init__.py
  main.py              # FastAPI app entry point, root + health routes
  config.py            # Pydantic BaseSettings (env vars: SUPABASE_URL, SUPABASE_KEY, etc.)
  db.py                # Supabase client initialization
```

## Render Deployment

- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Env vars to set in Render dashboard:** `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_DB_URL` (optional), `RENDER_API_KEY` (optional)
