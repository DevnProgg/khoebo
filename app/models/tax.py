import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    TaxAdjustmentCategory,
    TaxpayerType,
    TaxReturnStatus,
    TaxType,
)


def _enum(enum_cls: type, length: int) -> Enum:
    return Enum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda cls: [item.value for item in cls],
    )


class TaxProfile(TimestampMixin, Base):
    __tablename__ = "tax_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    taxpayer_type: Mapped[TaxpayerType] = mapped_column(
        _enum(TaxpayerType, 30), nullable=False
    )
    tax_id_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vat_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resident: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    accounting_basis: Mapped[str] = mapped_column(
        String(10), default="accrual", nullable=False
    )
    financial_year_end_month: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    financial_year_end_day: Mapped[int] = mapped_column(Integer, default=31, nullable=False)
    company_income_category: Mapped[str] = mapped_column(
        String(30), default="other", nullable=False
    )
    provisional_taxpayer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TaxRuleSet(TimestampMixin, Base):
    __tablename__ = "tax_rule_sets"
    __table_args__ = (
        UniqueConstraint(
            "jurisdiction", "tax_type", "version", name="uq_tax_rule_sets_jurisdiction_type_version"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    jurisdiction: Mapped[str] = mapped_column(String(2), default="LS", nullable=False)
    tax_type: Mapped[TaxType] = mapped_column(_enum(TaxType, 30), nullable=False)
    taxpayer_type: Mapped[TaxpayerType | None] = mapped_column(
        _enum(TaxpayerType, 30), nullable=True
    )
    version: Mapped[str] = mapped_column(String(80), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    source_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    rules: Mapped[dict] = mapped_column(JSON, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)


class TaxAdjustment(TimestampMixin, Base):
    __tablename__ = "tax_adjustments"
    __table_args__ = (CheckConstraint("amount != 0", name="amount_non_zero"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tax_type: Mapped[TaxType] = mapped_column(_enum(TaxType, 30), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[TaxAdjustmentCategory] = mapped_column(
        _enum(TaxAdjustmentCategory, 40), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class TaxPayment(TimestampMixin, Base):
    __tablename__ = "tax_payments"
    __table_args__ = (CheckConstraint("amount > 0", name="amount_positive"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tax_type: Mapped[TaxType] = mapped_column(_enum(TaxType, 30), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="paid", nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class Purchase(TimestampMixin, Base):
    __tablename__ = "purchases"
    __table_args__ = (
        UniqueConstraint(
            "business_id", "invoice_number", name="uq_purchases_business_invoice"
        ),
        CheckConstraint("net_amount >= 0", name="net_amount_non_negative"),
        CheckConstraint("tax_amount >= 0", name="tax_amount_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    supplier_tin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    is_import: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tax_code: Mapped[str] = mapped_column(String(30), default="standard", nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class FixedAsset(TimestampMixin, Base):
    __tablename__ = "fixed_assets"
    __table_args__ = (CheckConstraint("cost >= 0", name="cost_non_negative"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    acquisition_date: Mapped[date] = mapped_column(Date, nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    group_number: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_wdv: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    disposed_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class TaxReturn(TimestampMixin, Base):
    __tablename__ = "tax_returns"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tax_type: Mapped[TaxType] = mapped_column(_enum(TaxType, 30), nullable=False)
    taxpayer_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reporting_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    reporting_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    statutory_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    statutory_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    rule_set_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tax_rule_sets.id", ondelete="RESTRICT"), nullable=True
    )
    rule_version: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[TaxReturnStatus] = mapped_column(
        _enum(TaxReturnStatus, 20), nullable=False
    )
    accounting_figures: Mapped[dict] = mapped_column(JSON, nullable=False)
    tax_adjustments: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tax_liability: Mapped[dict] = mapped_column(JSON, nullable=False)
    payments_and_credits: Mapped[dict] = mapped_column(JSON, nullable=False)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    validation: Mapped[dict] = mapped_column(JSON, nullable=False)
    return_structure: Mapped[dict] = mapped_column(JSON, nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    calculation_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class TaxFiling(TimestampMixin, Base):
    __tablename__ = "tax_filings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tax_return_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tax_returns.id", ondelete="CASCADE"), index=True, nullable=False
    )
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    external_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    portal_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    filed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class TaxAuditEvent(TimestampMixin, Base):
    __tablename__ = "tax_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tax_return_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tax_returns.id", ondelete="SET NULL"), index=True, nullable=True
    )
    tax_filing_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tax_filings.id", ondelete="SET NULL"), index=True, nullable=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
