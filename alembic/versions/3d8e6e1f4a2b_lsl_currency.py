"""enforce LSL business currency

Revision ID: 3d8e6e1f4a2b
Revises: 17181c55d223
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "3d8e6e1f4a2b"
down_revision: str | None = "17181c55d223"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE businesses SET currency = 'LSL'"))
    with op.batch_alter_table("businesses") as batch_op:
        batch_op.alter_column("currency", server_default="LSL")


def downgrade() -> None:
    with op.batch_alter_table("businesses") as batch_op:
        batch_op.alter_column("currency", server_default=None)