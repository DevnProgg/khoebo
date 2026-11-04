"""tax preparation

Revision ID: 8a1f2c3d4e5f
Revises: 4f1c2b3a9d7e
Create Date: 2026-11-04 11:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "8a1f2c3d4e5f"
down_revision: str | None = "4f1c2b3a9d7e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


taxpayer_type = sa.Enum(
    "sole_trader",
    "individual",
    "partnership",
    "company",
    "non_resident_company",
    "trustee",
    name="taxpayertype",
    native_enum=False,
    length=30,
)
tax_type = sa.Enum(
    "income_tax",
    "vat",
    "provisional",
    "wht",
    "paye",
    "fbt",
    name="taxtype",
    native_enum=False,
    length=30,
)
tax_return_status = sa.Enum(
    "validated", "flagged", "approved", "filed",
    name="taxreturnstatus", native_enum=False, length=20
)
tax_adjustment_category = sa.Enum(
    "disallowed_expense",
    "capital_allowance",
    "exempt_income",
    "loss_brought_forward",
    "other_addition",
    "other_deduction",
    "vat_output_adjustment",
    "vat_input_adjustment",
    name="taxadjustmentcategory",
    native_enum=False,
    length=40,
)


def upgrade() -> None:
    op.create_table(
        "tax_rule_sets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("jurisdiction", sa.String(length=2), nullable=False),
        sa.Column("tax_type", tax_type, nullable=False),
        sa.Column("taxpayer_type", taxpayer_type, nullable=True),
        sa.Column("version", sa.String(length=80), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source_ids", sa.JSON(), nullable=False),
        sa.Column("rules", sa.JSON(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_rule_sets")),
        sa.UniqueConstraint(
            "jurisdiction",
            "tax_type",
            "version",
            name="uq_tax_rule_sets_jurisdiction_type_version",
        ),
    )

    op.create_table(
        "tax_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("taxpayer_type", taxpayer_type, nullable=False),
        sa.Column("tax_id_number", sa.String(length=50), nullable=True),
        sa.Column("vat_number", sa.String(length=50), nullable=True),
        sa.Column("vat_registered", sa.Boolean(), nullable=False),
        sa.Column("resident", sa.Boolean(), nullable=False),
        sa.Column("accounting_basis", sa.String(length=10), nullable=False),
        sa.Column("financial_year_end_month", sa.Integer(), nullable=False),
        sa.Column("financial_year_end_day", sa.Integer(), nullable=False),
        sa.Column("company_income_category", sa.String(length=30), nullable=False),
        sa.Column("provisional_taxpayer", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_tax_profiles_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_profiles")),
    )
    with op.batch_alter_table("tax_profiles", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_tax_profiles_business_id"), ["business_id"], unique=True
        )

    op.create_table(
        "purchases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("supplier_name", sa.String(length=255), nullable=True),
        sa.Column("supplier_tin", sa.String(length=50), nullable=True),
        sa.Column("invoice_number", sa.String(length=120), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("net_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("is_import", sa.Boolean(), nullable=False),
        sa.Column("tax_code", sa.String(length=30), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("net_amount >= 0", name=op.f("ck_purchases_net_amount_non_negative")),
        sa.CheckConstraint("tax_amount >= 0", name=op.f("ck_purchases_tax_amount_non_negative")),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_purchases_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_purchases_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_purchases")),
        sa.UniqueConstraint(
            "business_id", "invoice_number", name="uq_purchases_business_invoice"
        ),
    )
    with op.batch_alter_table("purchases", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_purchases_business_id"), ["business_id"], unique=False
        )

    op.create_table(
        "fixed_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("acquisition_date", sa.Date(), nullable=False),
        sa.Column("cost", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("group_number", sa.Integer(), nullable=False),
        sa.Column("opening_wdv", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("disposed_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("cost >= 0", name=op.f("ck_fixed_assets_cost_non_negative")),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_fixed_assets_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_fixed_assets_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fixed_assets")),
    )
    with op.batch_alter_table("fixed_assets", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_fixed_assets_business_id"), ["business_id"], unique=False
        )

    op.create_table(
        "tax_adjustments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("tax_type", tax_type, nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("category", tax_adjustment_category, nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("reference", sa.String(length=120), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("amount != 0", name=op.f("ck_tax_adjustments_amount_non_zero")),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_tax_adjustments_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_tax_adjustments_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_adjustments")),
    )
    with op.batch_alter_table("tax_adjustments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_tax_adjustments_business_id"), ["business_id"], unique=False
        )

    op.create_table(
        "tax_payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("tax_type", tax_type, nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("reference", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name=op.f("ck_tax_payments_amount_positive")),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_tax_payments_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_tax_payments_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_payments")),
    )
    with op.batch_alter_table("tax_payments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_tax_payments_business_id"), ["business_id"], unique=False
        )

    op.create_table(
        "tax_returns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("tax_type", tax_type, nullable=False),
        sa.Column("taxpayer_type", sa.String(length=30), nullable=False),
        sa.Column("reporting_period_start", sa.Date(), nullable=False),
        sa.Column("reporting_period_end", sa.Date(), nullable=False),
        sa.Column("statutory_period_start", sa.Date(), nullable=False),
        sa.Column("statutory_period_end", sa.Date(), nullable=False),
        sa.Column("rule_set_id", sa.Uuid(), nullable=True),
        sa.Column("rule_version", sa.String(length=80), nullable=False),
        sa.Column("status", tax_return_status, nullable=False),
        sa.Column("accounting_figures", sa.JSON(), nullable=False),
        sa.Column("tax_adjustments", sa.JSON(), nullable=False),
        sa.Column("tax_liability", sa.JSON(), nullable=False),
        sa.Column("payments_and_credits", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("validation", sa.JSON(), nullable=False),
        sa.Column("return_structure", sa.JSON(), nullable=False),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column("calculation_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_tax_returns_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_tax_returns_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["rule_set_id"],
            ["tax_rule_sets.id"],
            name=op.f("fk_tax_returns_rule_set_id_tax_rule_sets"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_returns")),
    )
    with op.batch_alter_table("tax_returns", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_tax_returns_business_id"), ["business_id"], unique=False
        )

    op.create_table(
        "tax_filings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("tax_return_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("external_reference", sa.String(length=120), nullable=True),
        sa.Column("portal_url", sa.String(length=500), nullable=True),
        sa.Column("filed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tax_return_id"], ["tax_returns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_filings")),
    )
    with op.batch_alter_table("tax_filings", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_tax_filings_business_id"), ["business_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_tax_filings_tax_return_id"), ["tax_return_id"], unique=False)

    op.create_table(
        "tax_audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("tax_return_id", sa.Uuid(), nullable=True),
        sa.Column("tax_filing_id", sa.Uuid(), nullable=True),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tax_return_id"], ["tax_returns.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tax_filing_id"], ["tax_filings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tax_audit_events")),
    )
    with op.batch_alter_table("tax_audit_events", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_tax_audit_events_business_id"), ["business_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_tax_audit_events_tax_return_id"), ["tax_return_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_tax_audit_events_tax_filing_id"), ["tax_filing_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("tax_audit_events", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tax_audit_events_tax_filing_id"))
        batch_op.drop_index(batch_op.f("ix_tax_audit_events_tax_return_id"))
        batch_op.drop_index(batch_op.f("ix_tax_audit_events_business_id"))
    op.drop_table("tax_audit_events")
    with op.batch_alter_table("tax_filings", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tax_filings_tax_return_id"))
        batch_op.drop_index(batch_op.f("ix_tax_filings_business_id"))
    op.drop_table("tax_filings")
    with op.batch_alter_table("tax_returns", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tax_returns_business_id"))
    op.drop_table("tax_returns")
    with op.batch_alter_table("tax_payments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tax_payments_business_id"))
    op.drop_table("tax_payments")
    with op.batch_alter_table("tax_adjustments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tax_adjustments_business_id"))
    op.drop_table("tax_adjustments")
    with op.batch_alter_table("fixed_assets", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_fixed_assets_business_id"))
    op.drop_table("fixed_assets")
    with op.batch_alter_table("purchases", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_purchases_business_id"))
    op.drop_table("purchases")
    with op.batch_alter_table("tax_profiles", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tax_profiles_business_id"))
    op.drop_table("tax_profiles")
    op.drop_table("tax_rule_sets")
