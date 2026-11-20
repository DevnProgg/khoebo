import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "postgres://postgres:secret@db.abc.supabase.co:5432/postgres",
            "postgresql+psycopg://postgres:secret@db.abc.supabase.co:5432/postgres?sslmode=require",
        ),
        (
            "postgresql://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
            "postgresql+psycopg://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require",
        ),
    ],
)
def test_supabase_database_urls_use_psycopg_and_require_tls(url: str, expected: str) -> None:
    settings = Settings(_env_file=None, database_url=url)

    assert settings.database_url == expected
