from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

ROOT = Path(__file__).resolve().parents[1]


def test_migrations_upgrade_and_downgrade(tmp_path) -> None:
    database_path = tmp_path / "migration-test.db"
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    tables = set(inspect(engine).get_table_names())
    assert {
        "users",
        "refresh_tokens",
        "businesses",
        "business_members",
        "products",
        "stock_movements",
        "sales",
        "sale_items",
        "accounts",
        "journal_entries",
        "journal_lines",
        "expenses",
        "reminders",
        "alembic_version",
    }.issubset(tables)
    engine.dispose()

    command.downgrade(config, "base")

    engine = create_engine(f"sqlite:///{database_path}")
    remaining = set(inspect(engine).get_table_names())
    assert remaining <= {"alembic_version"}
    engine.dispose()

    command.upgrade(config, "head")
