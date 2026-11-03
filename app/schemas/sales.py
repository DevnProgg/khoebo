import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import PaymentMethod, SaleStatus
from app.schemas.common import Money, ORMModel, PositiveQuantity


class SaleItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: PositiveQuantity
    unit_price: Money | None = None


class SaleCreate(BaseModel):
    items: list[SaleItemCreate] = Field(min_length=1, max_length=200)
    customer_name: str | None = Field(default=None, max_length=255)
    discount_amount: Money = 0
    tax_rate: Decimal = Field(default=0, ge=0, le=100, max_digits=5, decimal_places=2)
    payment_method: PaymentMethod = PaymentMethod.cash
    notes: str | None = None


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
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    refunded_at: datetime | None
    items: list[SaleItemOut]
