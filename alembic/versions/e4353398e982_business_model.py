"""business model

Revision ID: e4353398e982
Revises: 3d8e6e1f4a2b
Create Date: 2026-11-23 12:33:18.364124

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'e4353398e982'
down_revision: str | None = '3d8e6e1f4a2b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


BUSINESS_MODEL = sa.Enum('stock', 'service', 'hybrid', name='businessmodel', native_enum=False, length=20)


def upgrade() -> None:
    with op.batch_alter_table('businesses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('business_model', BUSINESS_MODEL, nullable=True))

    op.execute(sa.text("UPDATE businesses SET business_model = 'hybrid'"))

    with op.batch_alter_table('businesses', schema=None) as batch_op:
        batch_op.alter_column(
            'business_model',
            existing_type=BUSINESS_MODEL,
            server_default='stock',
            nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table('businesses', schema=None) as batch_op:
        batch_op.drop_column('business_model')
