# Phase 0.5 — Admin UI

**Status:** Proposed, pending manager approval
**Owner:** Andy
**Estimated effort:** 5–6 working days, staged into 4 deployable milestones
**Hosting impact:** Adds one Render Static Site (free tier). No new monthly costs.

---

## TL;DR

Build a small internal-only React admin UI that lets the SEMCO team manage the Knowledge Base directly — adding, editing, and deleting Q&A entries — without needing technical access to Supabase. The UI also automates the CSV resync to Tidio Lyro and surfaces unanswered questions from Lyro for resolution.

It's a thin layer on top of the existing FastAPI + Supabase backend already running on Render. No new infrastructure, no new monthly costs. Hosted on Render's free Static Site tier alongside the API. Locked behind email/password login, restricted to ~5 internal employees provisioned manually by Andy.

This unblocks the daily KB editing loop required by CLAUDE.md feedback rules without forcing every team member to learn Supabase Studio.

---

## Why this matters now

The Knowledge Base is now live in Supabase (148 entries from the Excel Repository), the FastAPI export endpoint is wired up, and Lyro is ingesting the CSV for internal testing. The remaining gap is **operational**:

- **Editing the KB requires Supabase Studio access** — only Andy is comfortable navigating it. Doesn't scale.
- **Resyncing to Lyro is a manual 4-step process** — export CSV, download file, open Tidio admin, re-upload. Error-prone, easy to forget.
- **Unanswered questions in Lyro have no closed-loop workflow** — currently they'd need to be transcribed by hand into Supabase, which means they'll be skipped.

CLAUDE.md feedback loop #1 ("Unanswered questions — review daily, target <20 in queue") is effectively impossible without a UI that surfaces and processes these in one place.

This phase fixes all three.

---

## Architecture

```
                  Render Static Site                  Render Web Service
                  ─────────────────                   ──────────────────
                  semco-kb-admin                      semco-ai-kb (existing)
                  (React + Vite + Tailwind)           (FastAPI + Python)
                          │                                   │
                          │                                   │
                  ┌───────┴────────┐                          │
                  ↓                ↓                          ↓
           Supabase direct      FastAPI proxy             Tidio API
           (anon key + RLS)     /sync/lyro                (Growth plan)
                                /unanswered
              ↓                                               ↑
        Supabase Postgres                                     │
        ─────────────────                                     │
        kb_entries          ←  CSV export ────────────────────┘
        (existing table)
```

**Principle:** anything needing a third-party secret (Tidio API token) flows through FastAPI. Anything that's just KB data goes from React directly to Supabase, gated by RLS.

The React app **never sees the Tidio token** — it lives only in Render env vars on the FastAPI service.

---

## Authentication & access control

### Provisioning

- **Method:** Supabase Auth, email/password provider
- **Workflow:** Andy adds users one at a time via Supabase Dashboard → Authentication → Users → Add user
- **Expected user count:** ~5 internal employees
- **Removing a user:** delete or disable in the same panel; access revoked on next request

No SSO, no OAuth, no Google Workspace integration. Manual provisioning is the right tradeoff for a 5-person team — the operational overhead of SSO isn't worth it at this scale. SSO/SAML can be added in a future phase if the team grows beyond ~20.

### Two enforcement layers

Both layers verify the same JWT issued by Supabase on login:

1. **Supabase Row Level Security (RLS)** — controls direct table access from the React client.

   ```sql
   DROP POLICY IF EXISTS "Service role full access" ON kb_entries;

   CREATE POLICY "Authenticated full access" ON kb_entries
       FOR ALL TO authenticated
       USING (true) WITH CHECK (true);
   ```

   Effect: only logged-in users can read or write `kb_entries`. The service role policy is also retained for backend cron/import scripts.

2. **FastAPI JWT verification** — controls access to proxy endpoints (`/sync/lyro`, `/unanswered`, etc.). Without this, anyone with the API URL could trigger a Tidio sync. React sends `Authorization: Bearer <jwt>` on every API call; FastAPI verifies the token against Supabase's JWT secret (new env var: `SUPABASE_JWT_SECRET`).

### Login UX

- Public visitors hitting any URL → forced to login screen
- No public read access, no preview mode, no "demo" tease
- After login → full admin UI
- Logout button in top bar; deletes session, returns to login

### Future hardening (not in scope for Phase 0.5)

- IP allowlist (office IP, VPN range) layered **on top** of auth — never as a replacement
- Per-user roles (e.g. agents can edit, managers can delete)
- 2FA via Supabase Auth's TOTP support
- SSO via Google Workspace if team grows

---

## Tech stack

| Concern | Choice | Reason |
|---|---|---|
| Build tool | **Vite** | Fast dev server, simple SPA build, no Next.js overhead |
| Language | **TypeScript** | Catches schema drift between Supabase and UI |
| Styling | **Tailwind CSS + shadcn/ui** | Light, presentable, professional defaults; components copied into repo (no runtime lock-in) |
| Forms | **React Hook Form** | Standard, minimal validation overhead |
| Supabase | `@supabase/supabase-js` | Official client, handles auth + DB |
| Login UI | `@supabase/auth-ui-react` | Drop-in pre-built form |
| State | `useState` + Supabase client | No Redux, no Zustand, no global store |
| Hosting | **Render Static Site** (free tier) | Same platform as the API, auto-deploys from `main` |
| Repo layout | `web/` subdirectory in `SEMCO-AI-KB` | Single repo, separate deploy target |

**Visual reference:** the look will be in the family of Linear, Vercel dashboard, or Supabase Studio — minimal, light, sans-serif, restrained color, lots of whitespace, subtle borders. Not heavy / colorful / "Material UI" style.

---

## Features

### 1. Login screen
- Email + password form
- Error handling (invalid creds, network errors)
- Logged-in users redirect straight to the dashboard

### 2. KB Entries (main view)
- Sortable, filterable table of all `kb_entries`
- Filters: category, source, full-text search
- Inline edit for question/answer (click-to-edit pattern)
- Edit dialog for fuller fields (products[], substrates[])
- "Add new entry" button → modal form
- Delete with confirmation toast
- Pagination (50 per page; with 148 entries today, this is comfortable headroom)

### 3. Sync to Lyro
- Single button: **"Sync to Lyro"**
- Triggers `POST /sync/lyro` on the FastAPI side
- Shows progress: generating CSV → uploading to Tidio → confirmed
- Displays "Last synced at <timestamp>" so the team knows freshness
- Error states surface clearly

### 4. Unanswered questions tab
- Reads live from `GET /unanswered` (FastAPI proxy → Tidio API)
- For each unanswered question:
  - Shows the question and conversation context
  - Inline form: draft an answer, set category/products/substrates
  - **"Add to repository"** button → writes to `kb_entries` with `source = "tidio_unanswered"`
  - Optionally calls Tidio API to mark the question as resolved
- This is the closed-loop fix for CLAUDE.md feedback rule #1

### 5. Top bar
- Logged-in user email
- Logout button

### 6. Toasts
- Success/error feedback on every action (save, sync, add, delete)

---

## Build phases (staged, deployable milestones)

Each phase ends in a deployable, manager-reviewable checkpoint. Andy verifies before the next phase starts.

### Phase A — Auth foundation *(0.5 day)*
- Enable Supabase Email/Password auth provider
- Pre-provision Andy + 1 test user
- Update RLS policy from service-role-only to authenticated-users
- Add `SUPABASE_JWT_SECRET` to Render env vars
- Add CORS middleware to FastAPI
- Add `verify_jwt` FastAPI dependency on existing `/kb/*` and `/export/csv`

**Checkpoint:** existing curl tests still work with a JWT in the header; without one, they 401.

### Phase B — React shell on Render *(1 day)*
- Scaffold `web/` with Vite + TS + Tailwind + shadcn/ui
- Create Render Static Site `semco-kb-admin`, hooked to GitHub auto-deploy from `main`
- Login page wired to Supabase Auth
- Authenticated-route guard
- Empty admin shell: sidebar nav, top bar with logout

**Checkpoint:** Andy logs into a deployed `semco-kb-admin.onrender.com` and sees an empty (but real) authenticated shell. Manager can also log in to verify access flow.

### Phase C — KB CRUD *(2 days)*
- Table view of `kb_entries`
- Filters (category, source, search)
- Add / edit / delete
- Toast feedback on every action

**Checkpoint:** Andy can fully manage the KB through the UI. Supabase Studio access becomes optional.

### Phase D — Lyro integration *(1.5 days)*
- FastAPI: `POST /sync/lyro` → reads existing `/export/csv` → uploads to Tidio
- React: "Sync to Lyro" button + last-synced timestamp
- FastAPI: `GET /unanswered` → calls Tidio Conversations API
- React: Unanswered tab + "Add to repository" workflow

**Checkpoint:** entire daily loop works in the UI: review unanswered → write answers → sync to Lyro.

---

## Hosting & costs

| Item | Today | After Phase 0.5 |
|---|---|---|
| Render Web Service (`semco-ai-kb`) | Free tier | Free tier (unchanged) |
| Render Static Site (`semco-kb-admin`) | — | Free tier (new) |
| Supabase | Free tier | Free tier (unchanged, well within row + auth user limits) |
| Tidio (Growth plan) | Existing | Existing (no plan change needed; Growth already includes API access) |

**Net new monthly cost: $0.**

If usage grows, the Render free tier's cold-start latency (~30s on first hit after idle) may warrant moving the API to Render's $7/mo tier, but that's a future decision driven by user pain, not by this phase.

---

## Risks & open questions

### Tidio API access (medium risk)
Confirmed Tidio Growth plan has API access. **Not yet confirmed:**
- Whether Tidio's API exposes Lyro Data Source CRUD (needed for `/sync/lyro` upload)
- Whether Tidio's API exposes unanswered/handoff conversations (needed for `/unanswered` read)

If either is missing, the affected feature degrades to a manual fallback (download-and-upload for sync; or polling all conversations for unanswered detection). Phases A–C are not affected and ship regardless.

**Mitigation:** verify both endpoints in Tidio's API docs before starting Phase D. If unavailable, reshape Phase D into a manual-export workflow instead.

### Render free tier cold starts (low risk)
The API service sleeps after 15 minutes of inactivity. First request after sleep takes 30–60 seconds. This is fine for daily admin use (one user notices, waits, moves on) but would be unacceptable customer-facing. The admin UI is internal-only, so this risk is bounded.

### Browser-side Supabase access (low risk, mitigated)
The Supabase anon key ships in the browser bundle. This is the canonical Supabase pattern — RLS does the actual gating. As long as the RLS policy is correct (only `authenticated` role gets access), the anon key alone is useless.

**Mitigation:** Phase A includes verifying the RLS policy with a logged-out request to confirm it returns nothing.

### No SSO / weak auth surface (accepted tradeoff)
Email + password is weaker than SSO. Acceptable for an internal-only 5-person tool. Phase 3 should revisit.

---

## Success criteria

The phase is complete when:

1. ✅ Andy and 4 other team members have working login credentials
2. ✅ The team can add, edit, and delete KB entries through the UI without touching Supabase Studio
3. ✅ Resyncing the KB to Lyro is a single button click
4. ✅ Lyro's unanswered questions appear in the UI and can be promoted to KB entries inline
5. ✅ The login screen blocks all unauthenticated access
6. ✅ Both Render services auto-deploy on push to `main`
7. ✅ Net new monthly cost is $0

---

## Out of scope for Phase 0.5

These are explicitly *not* included; they remain on the broader roadmap:

- Per-user roles / permissions (everyone authenticated has full access)
- IP allowlist
- 2FA / SSO
- Customer-facing dashboard or chat UI (Tidio still owns this)
- Confidence scoring layer (deferred — see prior conversation)
- Calculator UI (Phase 3)
- Order lookup / draft order endpoints (Phase 2)
- Audit log of who edited what (defer until needed)
- Pagination beyond 50/page (current entry count doesn't justify it)
- Mobile-first design (it's an internal desktop tool)

---

## Questions for the manager

1. **Approve the $0 hosting impact and 5-day timeline?**
2. **Confirm Andy is the right owner / single point of contact for user provisioning?**
3. **Approve email+password (no SSO) for the first version?**
4. **Any team members beyond the initial 5 who should have access at launch?**
5. **Is there an internal style guide / brand colors we should layer in, or are neutral defaults fine?**

---

## Appendix — what's already built (context for the manager)

For context on what this phase is building *on top of*:

| Component | Status |
|---|---|
| FastAPI backend on Render | ✅ Deployed (`semco-ai-kb.onrender.com`) |
| Supabase project + `kb_entries` table | ✅ Created, RLS enabled |
| 148 Q&A entries imported from Excel | ✅ Live in Supabase |
| `GET /export/csv` for Lyro feed | ✅ Working |
| KB CRUD endpoints (`/kb/*`) | ✅ Working |
| Tidio Lyro Data Source uploaded | ✅ Internal testing in progress |
| Lyro Guidance prompt (guardrails) | ✅ Configured |
| Migration scripts + seed SQL | ✅ Versioned in repo |

Phase 0.5 is the operational layer on top — making the daily edit/sync/review loop usable by non-technical team members.
