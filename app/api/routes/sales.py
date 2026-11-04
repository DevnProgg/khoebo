import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership, require_roles
from app.db.session import get_db
from app.models.business import BusinessMember
from app.models.enums import MemberRole, SaleStatus
from app.models.inventory import Product
from app.models.sales import Sale
from app.models.user import User
from app.schemas.sales import QuickSaleCreate, SaleCreate, SaleOut
from app.services.sales import SaleError, create_sale, refund_sale

router = APIRouter(prefix="/businesses/{business_id}/sales", tags=["sales"])


def _get_sale(db: Session, business_id: uuid.UUID, sale_id: uuid.UUID) -> Sale:
    sale = db.scalar(
        select(Sale).where(Sale.business_id == business_id, Sale.id == sale_id)
    )
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale_endpoint(
    payload: SaleCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sale:
    try:
        sale = create_sale(db, business=membership.business, user=user, payload=payload)
    except (SaleError, ValueError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(sale)
    return sale


@router.post("/quick", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_quick_sale(
    payload: QuickSaleCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sale:
    item_summary = (payload.items_text or "").strip()
    if item_summary:
        for raw_item in item_summary.split(","):
            token = raw_item.strip()
            if not token:
                continue
            parts = token.rsplit(" ", 1)
            name = parts[0].strip() if len(parts) == 2 and parts[1].replace(".", "", 1).isdigit() else token
            if not name:
                continue
            existing = db.scalar(
                select(Product).where(
                    Product.business_id == membership.business_id,
                    Product.name == name,
                )
            )
            if existing is None:
                db.add(
                    Product(
                        business_id=membership.business_id,
                        sku=f"DRAFT-{uuid.uuid4().hex[:10].upper()}",
                        name=name,
                        unit_price=0,
                        cost_price=0,
                        stock_quantity=0,
                        is_draft=True,
                    )
                )
        db.flush()
    notes = payload.notes
    if item_summary:
        notes = f"Quick items: {item_summary}" + (f". {notes}" if notes else "")
    sale_payload = SaleCreate(
        amount=payload.amount,
        effective_date=payload.effective_date,
        payment_method=payload.payment_method,
        notes=notes,
        idempotency_key=payload.idempotency_key,
    )
    try:
        sale = create_sale(db, business=membership.business, user=user, payload=sale_payload)
    except (SaleError, ValueError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(sale)
    return sale


@router.get("", response_model=list[SaleOut])
def list_sales(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    status_filter: SaleStatus | None = Query(default=None, alias="status"),
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[Sale]:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date"
        )
    query = select(Sale).where(Sale.business_id == membership.business_id)
    if status_filter is not None:
        query = query.where(Sale.status == status_filter)
    if start_date:
        query = query.where(
            Sale.effective_date >= start_date
        )
    if end_date:
        query = query.where(
            Sale.effective_date <= end_date
        )
    query = query.order_by(Sale.effective_date.desc(), Sale.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(query).all())


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Sale:
    return _get_sale(db, membership.business_id, sale_id)


@router.post("/{sale_id}/refund", response_model=SaleOut)
def refund_sale_endpoint(
    sale_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sale:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    sale = _get_sale(db, membership.business_id, sale_id)
    try:
        sale = refund_sale(db, sale=sale, user=user)
    except (SaleError, ValueError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(sale)
    return sale
