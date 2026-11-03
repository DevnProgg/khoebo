from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

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
