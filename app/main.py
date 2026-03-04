import httpx
from fastapi import FastAPI

from app.config import get_settings
from app.db import get_supabase

app = FastAPI(title="SEMCO AI KB API")


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

    return {"status": "ok", "database": db_status}
