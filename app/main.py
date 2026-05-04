import os

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from jwt.algorithms import get_default_algorithms

from app.config import get_settings
from app.db import get_supabase
from app.routers import calculator, export, kb, me, sync, unanswered, webhooks

app = FastAPI(title="SEMCO AI KB API")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(kb.router)
app.include_router(export.router)
app.include_router(sync.router)
app.include_router(unanswered.router)
app.include_router(webhooks.router)
app.include_router(calculator.router)
app.include_router(me.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "semco-ai-kb-api"}


@app.get("/health")
def health():
    settings = get_settings()

    supabase_url = settings.supabase_url
    supabase_key = settings.supabase_key

    if not supabase_url or not supabase_key:
        return {
            "status": "ok",
            "database": "not configured",
            "debug": {
                "supabase_url_set": bool(supabase_url),
                "supabase_key_set": bool(supabase_key),
            },
        }

    try:
        # Hit the PostgREST root endpoint — returns API schema, no tables needed
        response = httpx.get(
            f"{supabase_url}/rest/v1/",
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
            },
            timeout=5.0,
        )
        if response.status_code == 200:
            db_status = "connected"
        else:
            db_status = f"error: status {response.status_code}"
    except Exception as e:
        db_status = f"error: {str(e)[:200]}"

    # Diagnostic info: which JWT algorithms PyJWT can actually verify
    # (depends on cryptography being installed) and the deployed git commit.
    return {
        "status": "ok",
        "database": db_status,
        "git_commit": os.getenv("RENDER_GIT_COMMIT", "unknown")[:7],
        "jwt_algorithms": sorted(get_default_algorithms().keys()),
    }
