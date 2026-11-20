from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SUPABASE_HOST_SUFFIXES = (".supabase.co", ".pooler.supabase.com")
BUILTIN_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "https://khoebo.netlify.app",
    "https://khoebo.onrender.com",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Khoebo API"
    environment: str = "development"
    database_url: str = "sqlite:///./khoebo.db"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    auto_create_tables: bool = True
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("cors_origins")
    @classmethod
    def include_known_frontends(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys([*value, *BUILTIN_CORS_ORIGINS]))

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql+psycopg://", 1)
        elif value.startswith("postgresql://"):
            value = value.replace("postgresql://", "postgresql+psycopg://", 1)
        if not value.startswith("postgresql+psycopg://"):
            return value

        parts = urlsplit(value)
        if not (parts.hostname or "").endswith(SUPABASE_HOST_SUFFIXES):
            return value
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        if "sslmode" in query:
            return value
        query["sslmode"] = "require"
        return urlunsplit(parts._replace(query=urlencode(query)))

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def validate_for_runtime(self) -> None:
        if self.is_production:
            if self.secret_key == "change-me-in-production" or len(self.secret_key) < 32:
                raise RuntimeError(
                    "SECRET_KEY must be set to a random value of at least 32 characters in production"
                )
            if self.auto_create_tables:
                raise RuntimeError(
                    "AUTO_CREATE_TABLES must be disabled in production; run `alembic upgrade head`"
                )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
