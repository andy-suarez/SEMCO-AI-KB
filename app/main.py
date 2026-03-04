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
        client = get_supabase()
        # Use PostgREST's built-in RPC — no table needed
        # Any response (including errors about missing tables) means DB is reachable
        client.table("_health_check").select("*").limit(1).execute()
        db_status = "connected"
    except Exception as e:
        error_msg = str(e)
        # These errors still mean Supabase is reachable, just no table
        if any(keyword in error_msg for keyword in ["404", "204", "relation", "does not exist", "Missing response"]):
            db_status = "connected"
        else:
            db_status = f"error: {error_msg[:200]}"

    return {"status": "ok", "database": db_status}
