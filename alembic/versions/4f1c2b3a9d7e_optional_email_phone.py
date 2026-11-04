"""optional email and phone login

Revision ID: 4f1c2b3a9d7e
Revises: 3d8e6e1f4a2b
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "4f1c2b3a9d7e"
down_revision: str | None = "3d8e6e1f4a2b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("email", existing_type=sa.String(length=255), nullable=True)
        batch_op.add_column(sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index(
        op.f("ix_users_phone_number"), "users", ["phone_number"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_phone_number"), table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("phone_number")
        batch_op.alter_column("email", existing_type=sa.String(length=255), nullable=False)
