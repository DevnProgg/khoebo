import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import StockMovementType
from app.models.inventory import Product, StockMovement


class InventoryError(ValueError):
    """Raised when an inventory operation is invalid."""


def low_stock_products(db: Session, business_id: uuid.UUID) -> list[Product]:
    return list(
        db.scalars(
            select(Product)
            .where(
                Product.business_id == business_id,
                Product.is_active.is_(True),
                Product.low_stock_threshold > 0,
                Product.stock_quantity <= Product.low_stock_threshold,
            )
            .order_by(Product.name)
        ).all()
    )


def apply_stock_movement(
    db: Session,
    *,
    product: Product,
    movement_type: StockMovementType,
    quantity: Decimal,
    created_by: uuid.UUID | None,
    unit_cost: Decimal | None = None,
    reason: str | None = None,
    reference_type: str | None = None,
    reference_id: str | None = None,
    commit: bool = False,
) -> StockMovement:
    quantity = Decimal(quantity)
    previous = Decimal(product.stock_quantity)

    if movement_type == StockMovementType.adjustment:
        if quantity < 0:
            raise InventoryError("Adjusted stock quantity cannot be negative")
        new_quantity = quantity
        movement_quantity = quantity - previous
    elif movement_type == StockMovementType.in_:
        if quantity <= 0:
            raise InventoryError("Stock-in quantity must be greater than zero")
        new_quantity = previous + quantity
        movement_quantity = quantity
    else:
        if quantity <= 0:
            raise InventoryError("Stock-out quantity must be greater than zero")
        if previous < quantity:
            raise InventoryError(
                f"Insufficient stock for {product.name}: available {previous}, requested {quantity}"
            )
        new_quantity = previous - quantity
        movement_quantity = quantity

    product.stock_quantity = new_quantity
    movement = StockMovement(
        business_id=product.business_id,
        product_id=product.id,
        movement_type=movement_type,
        quantity=movement_quantity,
        unit_cost=unit_cost,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by=created_by,
    )
    db.add(movement)
    db.flush()
    if commit:
        db.commit()
        db.refresh(product)
        db.refresh(movement)
    return movement
