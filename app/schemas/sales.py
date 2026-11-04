import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import EntrySource, PaymentMethod, SaleStatus
from app.schemas.common import Money, ORMModel, PositiveMoney, PositiveQuantity


class SaleItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: PositiveQuantity
    unit_price: Money | None = None


class SaleCreate(BaseModel):
    items: list[SaleItemCreate] = Field(default_factory=list, max_length=200)
    amount: PositiveMoney | None = None
    customer_name: str | None = Field(default=None, max_length=255)
    discount_amount: Money = 0
    tax_rate: Decimal = Field(default=0, ge=0, le=100, max_digits=5, decimal_places=2)
    payment_method: PaymentMethod = PaymentMethod.cash
    notes: str | None = None
    effective_date: date | None = None
    idempotency_key: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def require_items_or_amount(self) -> "SaleCreate":
        if not self.items and self.amount is None:
            raise ValueError("A sale needs items or an amount")
        if self.items and self.amount is not None:
            raise ValueError("Use either sale items or an amount-only sale")
        return self


class QuickSaleCreate(BaseModel):
    amount: PositiveMoney
    items_text: str | None = Field(default=None, max_length=1000)
    effective_date: date | None = None
    payment_method: PaymentMethod = PaymentMethod.cash
    notes: str | None = None
    idempotency_key: str | None = Field(default=None, max_length=120)


class SaleItemOut(ORMModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    quantity: PositiveQuantity
    unit_price: Money
    unit_cost: Money
    line_total: Money


class SaleOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    reference: str
    customer_name: str | None
    status: SaleStatus
    payment_method: PaymentMethod
    subtotal: Money
    discount_amount: Money
    tax_rate: Decimal
    tax_amount: Money
    total: Money
    effective_date: date
    entry_source: EntrySource
    idempotency_key: str | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    refunded_at: datetime | None
    items: list[SaleItemOut]
