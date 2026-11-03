import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_membership, require_roles
from app.db.session import get_db
from app.models.business import BusinessMember
from app.models.enums import MemberRole
from app.models.inventory import Product, StockMovement
from app.schemas.inventory import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockMovementCreate,
    StockMovementOut,
)
from app.services.inventory import InventoryError, apply_stock_movement, low_stock_products

router = APIRouter(prefix="/businesses/{business_id}", tags=["inventory"])


def _get_product(db: Session, business_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    product = db.scalar(
        select(Product).where(Product.business_id == business_id, Product.id == product_id)
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.post(
    "/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED
)
def create_product(
    payload: ProductCreate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Product:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    sku = payload.sku.strip()
    exists = db.scalar(
        select(Product.id).where(
            Product.business_id == membership.business_id, Product.sku == sku
        )
    )
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")

    product = Product(
        business_id=membership.business_id,
        sku=sku,
        name=payload.name.strip(),
        description=payload.description,
        unit_price=payload.unit_price,
        cost_price=payload.cost_price,
        stock_quantity=payload.stock_quantity,
        low_stock_threshold=payload.low_stock_threshold,
    )
    db.add(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists") from None
    db.refresh(product)
    return product


@router.get("/products", response_model=list[ProductOut])
def list_products(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=255),
    low_stock_only: bool = False,
    include_inactive: bool = False,
) -> list[Product]:
    query = select(Product).where(Product.business_id == membership.business_id)
    if not include_inactive:
        query = query.where(Product.is_active.is_(True))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(Product.name.ilike(pattern), Product.sku.ilike(pattern))
        )
    if low_stock_only:
        query = query.where(
            Product.low_stock_threshold > 0,
            Product.stock_quantity <= Product.low_stock_threshold,
        )
    return list(db.scalars(query.order_by(Product.name)).all())


@router.get("/products/low-stock", response_model=list[ProductOut])
def get_low_stock_products(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> list[Product]:
    return low_stock_products(db, membership.business_id)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(
    product_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Product:
    return _get_product(db, membership.business_id, product_id)


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Product:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    product = _get_product(db, membership.business_id, product_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_product(
    product_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> None:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    product = _get_product(db, membership.business_id, product_id)
    product.is_active = False
    db.commit()


@router.post(
    "/products/{product_id}/stock-movements",
    response_model=StockMovementOut,
    status_code=status.HTTP_201_CREATED,
)
def create_stock_movement(
    product_id: uuid.UUID,
    payload: StockMovementCreate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> StockMovement:
    product = _get_product(db, membership.business_id, product_id)
    try:
        movement = apply_stock_movement(
            db,
            product=product,
            movement_type=payload.movement_type,
            quantity=payload.quantity,
            unit_cost=payload.unit_cost,
            reason=payload.reason,
            created_by=membership.user_id,
        )
    except InventoryError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(movement)
    return movement


@router.get("/products/{product_id}/stock-movements", response_model=list[StockMovementOut])
def list_stock_movements(
    product_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> list[StockMovement]:
    _get_product(db, membership.business_id, product_id)
    return list(
        db.scalars(
            select(StockMovement)
            .where(
                StockMovement.business_id == membership.business_id,
                StockMovement.product_id == product_id,
            )
            .order_by(StockMovement.created_at.desc())
        ).all()
    )
