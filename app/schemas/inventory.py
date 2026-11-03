import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import StockMovementType
from app.schemas.common import Money, ORMModel, Quantity


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    unit_price: Money = 0
    cost_price: Money = 0
    stock_quantity: Quantity = 0
    low_stock_threshold: Quantity = 0


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    unit_price: Money | None = None
    cost_price: Money | None = None
    low_stock_threshold: Quantity | None = None
    is_active: bool | None = None


class ProductOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    sku: str
    name: str
    description: str | None
    unit_price: Money
    cost_price: Money
    stock_quantity: Quantity
    low_stock_threshold: Quantity
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StockMovementCreate(BaseModel):
    movement_type: StockMovementType
    quantity: Quantity
    unit_cost: Money | None = None
    reason: str | None = Field(default=None, max_length=255)


class StockMovementOut(ORMModel):
    id: uuid.UUID
    product_id: uuid.UUID
    movement_type: StockMovementType
    quantity: Quantity
    unit_cost: Money | None
    reason: str | None
    reference_type: str | None
    reference_id: str | None
    created_by: uuid.UUID | None
    created_at: datetime
