# SEMCO KB Admin

Internal-only React admin UI for the SEMCO Knowledge Base. Hosted on Render Static Site at
`semco-kb-admin.onrender.com`. Talks directly to Supabase for `kb_entries` CRUD (RLS-gated)
and to the FastAPI backend (`semco-ai-kb.onrender.com`) for everything that needs Tidio
secrets (sync, unanswered).

See [`Phase 0.5 UI.md`](../Phase%200.5%20UI.md) at the repo root for the full plan.

## Local development

Requires Node 20+. Install via `brew install node@20` if needed.

```bash
cd web
cp .env.example .env.local   # fill in real Supabase URL/anon key
npm install
npm run dev                   # http://localhost:5173
```

## Render Static Site config

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |
| Branch | `main` |
| Auto-Deploy | Yes |

Env vars on the static site:

- `VITE_SUPABASE_URL` — same as the API service
- `VITE_SUPABASE_ANON_KEY` — Supabase Project Settings → API → **anon public key** (NOT service role)
- `VITE_API_BASE_URL` — `https://semco-ai-kb.onrender.com`

After Render assigns the static site URL, add it to the API service's `ALLOWED_ORIGINS`
env var so CORS lets the browser through.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (shadcn/ui-style components, hand-rolled in `src/components/ui/`)
- React Router 6
- `@supabase/supabase-js` for auth + DB
- `sonner` for toasts, `lucide-react` for icons
