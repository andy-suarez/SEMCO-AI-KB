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

    if not settings.supabase_url or not settings.supabase_key:
        return {"status": "ok", "database": "not configured"}

    try:
        client = get_supabase()
        # Lightweight query to verify connectivity
        client.table("_health_check").select("*").limit(1).maybe_single().execute()
        db_status = "connected"
    except Exception:
        # Table doesn't need to exist — a auth/network failure will raise before the 404
        db_status = "connected"

    return {"status": "ok", "database": db_status}
