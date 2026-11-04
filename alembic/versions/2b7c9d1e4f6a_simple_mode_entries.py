"""simple mode preferences and effective-dated entries

Revision ID: 2b7c9d1e4f6a
Revises: 8a1f2c3d4e5f
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "2b7c9d1e4f6a"
down_revision: str | None = "8a1f2c3d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    ui_mode = sa.Enum("simple", "advanced", name="uimode", native_enum=False, length=20)
    entry_source = sa.Enum("live", "backdated", "estimate", name="entrysource", native_enum=False, length=20)

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("ui_mode", ui_mode, nullable=False, server_default="advanced"))

    with op.batch_alter_table("sales") as batch_op:
        batch_op.add_column(sa.Column("effective_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("entry_source", entry_source, nullable=False, server_default="live"))
        batch_op.add_column(sa.Column("idempotency_key", sa.String(length=120), nullable=True))
    op.execute("UPDATE sales SET effective_date = DATE(created_at) WHERE effective_date IS NULL")
    with op.batch_alter_table("sales") as batch_op:
        batch_op.alter_column("effective_date", nullable=False)
        batch_op.create_unique_constraint("uq_sales_business_idempotency_key", ["business_id", "idempotency_key"])

    with op.batch_alter_table("expenses") as batch_op:
        batch_op.add_column(sa.Column("effective_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("entry_source", entry_source, nullable=False, server_default="live"))
        batch_op.add_column(sa.Column("idempotency_key", sa.String(length=120), nullable=True))
    op.execute("UPDATE expenses SET effective_date = expense_date WHERE effective_date IS NULL")
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.alter_column("effective_date", nullable=False)
        batch_op.create_unique_constraint("uq_expenses_business_idempotency_key", ["business_id", "idempotency_key"])

    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("is_draft")
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.drop_constraint("uq_expenses_business_idempotency_key", type_="unique")
        batch_op.drop_column("idempotency_key")
        batch_op.drop_column("entry_source")
        batch_op.drop_column("effective_date")
    with op.batch_alter_table("sales") as batch_op:
        batch_op.drop_constraint("uq_sales_business_idempotency_key", type_="unique")
        batch_op.drop_column("idempotency_key")
        batch_op.drop_column("entry_source")
        batch_op.drop_column("effective_date")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("ui_mode")