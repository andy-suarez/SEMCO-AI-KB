from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_db_url: Optional[str] = None
    supabase_jwt_secret: str = ""  # legacy / unused (now using JWKS); kept for back-compat
    render_api_key: Optional[str] = None
    allowed_origins: str = ""

    # Tidio Lyro OpenAPI credentials (Developer > OpenAPI in Tidio panel).
    lyro_client_id: str = ""
    lyro_client_secret: str = ""
    tidio_api_base_url: str = "https://api.tidio.com"

    class Config:
        env_file = ".env"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
