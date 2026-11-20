from pathlib import Path

from alembic import command
from alembic.config import Config

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = ROOT / "sql" / "postgres_schema.sql"


def _normalize(sql: str) -> str:
    return "\n".join(line.rstrip() for line in sql.splitlines()) + "\n"


def test_postgres_schema_file_matches_alembic_head(capsys) -> None:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    config.set_main_option(
        "sqlalchemy.url", "postgresql+psycopg://khoebo:placeholder@localhost:5432/khoebo"
    )

    command.upgrade(config, "head", sql=True)

    assert _normalize(capsys.readouterr().out) == SCHEMA_FILE.read_text(encoding="utf-8")
