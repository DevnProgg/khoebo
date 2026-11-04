import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, model_validator

from app.models.enums import (
    TaxAdjustmentCategory,
    TaxpayerType,
    TaxReturnStatus,
    TaxType,
)
from app.schemas.common import Money, ORMModel, PositiveMoney

SignedMoney = Annotated[Decimal, Field(max_digits=14, decimal_places=2)]


class TaxProfileUpsert(BaseModel):
    taxpayer_type: TaxpayerType
    tax_id_number: str | None = Field(default=None, max_length=50)
    vat_number: str | None = Field(default=None, max_length=50)
    vat_registered: bool = False
    resident: bool = True
    accounting_basis: str = Field(default="accrual", pattern="^(accrual|cash)$")
    financial_year_end_month: int = Field(default=3, ge=1, le=12)
    financial_year_end_day: int = Field(default=31, ge=1, le=31)
    company_income_category: str = Field(default="other", pattern="^(manufacturing|farming|other)$")
    provisional_taxpayer: bool = False
    notes: str | None = None


class TaxProfileOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    taxpayer_type: TaxpayerType
    tax_id_number: str | None
    vat_number: str | None
    vat_registered: bool
    resident: bool
    accounting_basis: str
    financial_year_end_month: int
    financial_year_end_day: int
    company_income_category: str
    provisional_taxpayer: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class TaxReturnCreate(BaseModel):
    tax_type: TaxType
    reporting_start: date
    reporting_end: date

    @model_validator(mode="after")
    def validate_period(self) -> "TaxReturnCreate":
        if self.reporting_start > self.reporting_end:
            raise ValueError("reporting_start must be on or before reporting_end")
        return self


class TaxReturnOut(BaseModel):
    id: uuid.UUID
    taxpayer: dict
    tax_type: TaxType
    taxpayer_type: str
    reporting_period: dict
    statutory_period: dict
    rule: dict
    rule_set_id: str | None
    rule_version: str
    status: TaxReturnStatus
    accounting_figures: dict
    tax_adjustments: list
    tax_liability: dict
    payments_and_credits: dict
    warnings: list
    validation: dict
    return_structure: dict
    input_hash: str
    calculation_hash: str
    created_at: datetime | None = None


class TaxFilingCreate(BaseModel):
    external_reference: str = Field(min_length=1, max_length=120)
    filed_at: datetime | None = None
    notes: str | None = None


class TaxFilingOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    tax_return_id: uuid.UUID
    channel: str
    status: str
    external_reference: str | None
    portal_url: str | None
    filed_at: datetime | None
    confirmed_at: datetime | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime


class TaxValidationOut(BaseModel):
    return_id: uuid.UUID
    status: TaxReturnStatus
    validation: dict
    warnings: list
    input_hash: str
    calculation_hash: str


class TaxAdjustmentCreate(BaseModel):
    tax_type: TaxType
    period_start: date
    period_end: date
    category: TaxAdjustmentCategory
    amount: SignedMoney
    description: str = Field(min_length=1, max_length=255)
    reference: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def validate_adjustment(self) -> "TaxAdjustmentCreate":
        if self.period_start > self.period_end:
            raise ValueError("period_start must be on or before period_end")
        if self.amount == 0:
            raise ValueError("amount must not be zero")
        return self


class TaxAdjustmentOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    tax_type: TaxType
    period_start: date
    period_end: date
    category: TaxAdjustmentCategory
    amount: Decimal
    description: str
    reference: str | None
    created_by: uuid.UUID | None
    created_at: datetime


class TaxPaymentCreate(BaseModel):
    tax_type: TaxType
    payment_date: date
    period_start: date
    period_end: date
    amount: PositiveMoney
    reference: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def validate_period(self) -> "TaxPaymentCreate":
        if self.period_start > self.period_end:
            raise ValueError("period_start must be on or before period_end")
        return self


class TaxPaymentOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    tax_type: TaxType
    payment_date: date
    period_start: date
    period_end: date
    amount: Decimal
    reference: str | None
    status: str
    created_by: uuid.UUID | None
    created_at: datetime


class PurchaseCreate(BaseModel):
    supplier_name: str | None = Field(default=None, max_length=255)
    supplier_tin: str | None = Field(default=None, max_length=50)
    invoice_number: str | None = Field(default=None, max_length=120)
    invoice_date: date
    description: str | None = Field(default=None, max_length=255)
    net_amount: Money
    tax_amount: Money = Decimal("0")
    total_amount: Money | None = None
    is_import: bool = False
    tax_code: str = Field(default="standard", max_length=30)

    @model_validator(mode="after")
    def calculate_total(self) -> "PurchaseCreate":
        expected = (self.net_amount + self.tax_amount).quantize(Decimal("0.01"))
        if self.total_amount is None:
            self.total_amount = expected
        elif self.total_amount.quantize(Decimal("0.01")) != expected:
            raise ValueError("total_amount must equal net_amount plus tax_amount")
        return self


class PurchaseOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    supplier_name: str | None
    supplier_tin: str | None
    invoice_number: str | None
    invoice_date: date
    description: str | None
    net_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    is_import: bool
    tax_code: str
    created_by: uuid.UUID | None
    created_at: datetime


class FixedAssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    acquisition_date: date
    cost: Money
    group_number: int = Field(ge=1, le=20)
    opening_wdv: Money | None = None
    disposed_value: Money | None = None


class FixedAssetOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    acquisition_date: date
    cost: Decimal
    group_number: int
    opening_wdv: Decimal | None
    disposed_value: Decimal | None
    created_by: uuid.UUID | None
    created_at: datetime
