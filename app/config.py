from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_db_url: Optional[str] = None
    supabase_jwt_secret: str = ""
    render_api_key: Optional[str] = None
    allowed_origins: str = ""

    class Config:
        env_file = ".env"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
