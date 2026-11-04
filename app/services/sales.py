import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.enums import EntrySource, SaleStatus, StockMovementType
from app.models.inventory import Product
from app.models.sales import Sale, SaleItem
from app.models.user import User
from app.schemas.sales import SaleCreate
from app.services.accounting import (
    AccountingError,
    find_journal_entry,
    money,
    post_sale_journal,
    reverse_journal_entry,
)
from app.services.inventory import InventoryError, apply_stock_movement


class SaleError(ValueError):
    """Raised when a sale cannot be created or refunded."""


def _new_reference() -> str:
    return f"SALE-{uuid.uuid4().hex[:10].upper()}"


def create_sale(db: Session, *, business: Business, user: User, payload: SaleCreate) -> Sale:
    if payload.idempotency_key:
        existing = db.scalar(
            select(Sale).where(
                Sale.business_id == business.id,
                Sale.idempotency_key == payload.idempotency_key,
            )
        )
        if existing is not None:
            return existing

    product_ids = [item.product_id for item in payload.items]
    if not product_ids and payload.amount is None:
        raise SaleError("An amount is required when a sale has no items")
    if len(product_ids) != len(set(product_ids)):
        raise SaleError("Each product may only appear once per sale")

    products = []
    if product_ids:
        products = db.scalars(
            select(Product)
            .where(Product.business_id == business.id, Product.id.in_(product_ids))
            .with_for_update()
        ).all()
    products_by_id = {product.id: product for product in products}

    missing = [str(pid) for pid in product_ids if pid not in products_by_id]
    if missing:
        raise SaleError("One or more products do not exist in this business")

    for product in products:
        if not product.is_active:
            raise SaleError(f"Product {product.name} is inactive")

    items: list[SaleItem] = []
    subtotal = Decimal("0")
    for item_data in payload.items:
        product = products_by_id[item_data.product_id]
        quantity = Decimal(item_data.quantity)
        unit_price = (
            money(item_data.unit_price) if item_data.unit_price is not None else money(product.unit_price)
        )
        line_total = money(quantity * unit_price)
        subtotal += line_total
        items.append(
            SaleItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=unit_price,
                unit_cost=money(product.cost_price),
                line_total=line_total,
            )
        )

    subtotal = money(payload.amount) if not product_ids else money(subtotal)
    discount = money(payload.discount_amount)
    if discount > subtotal:
        raise SaleError("Discount cannot be greater than the sale subtotal")

    taxable = money(subtotal - discount)
    tax_amount = money(taxable * Decimal(payload.tax_rate) / Decimal("100"))
    total = money(taxable + tax_amount)

    sale = Sale(
        business_id=business.id,
        reference=_new_reference(),
        customer_name=payload.customer_name,
        status=SaleStatus.completed,
        payment_method=payload.payment_method,
        subtotal=subtotal,
        discount_amount=discount,
        tax_rate=Decimal(payload.tax_rate),
        tax_amount=tax_amount,
        total=total,
        notes=payload.notes,
        created_by=user.id,
        items=items,
        effective_date=payload.effective_date or date.today(),
        entry_source=EntrySource.live,
        idempotency_key=payload.idempotency_key,
    )
    if sale.effective_date < date.today() - timedelta(days=1):
        sale.entry_source = EntrySource.backdated
    db.add(sale)
    db.flush()

    for item in sale.items:
        product = products_by_id[item.product_id]
        try:
            apply_stock_movement(
                db,
                product=product,
                movement_type=StockMovementType.out,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                reason=f"Sale {sale.reference}",
                reference_type="sale",
                reference_id=str(sale.id),
                created_by=user.id,
            )
        except InventoryError as exc:
            raise SaleError(str(exc)) from exc

    try:
        post_sale_journal(db, sale, created_by=user.id)
    except AccountingError as exc:
        raise SaleError(str(exc)) from exc

    db.flush()
    db.refresh(sale)
    return sale


def refund_sale(db: Session, *, sale: Sale, user: User) -> Sale:
    if sale.status != SaleStatus.completed:
        raise SaleError("Only completed sales can be refunded")

    sale.status = SaleStatus.refunded
    sale.refunded_at = datetime.now(timezone.utc)
    db.flush()

    products = db.scalars(
        select(Product)
        .where(Product.business_id == sale.business_id, Product.id.in_([i.product_id for i in sale.items]))
        .with_for_update()
    ).all()
    products_by_id = {product.id: product for product in products}

    for item in sale.items:
        product = products_by_id.get(item.product_id)
        if product is None:
            raise SaleError("Cannot refund: a product on this sale no longer exists")
        apply_stock_movement(
            db,
            product=product,
            movement_type=StockMovementType.in_,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
            reason=f"Refund {sale.reference}",
            reference_type="sale_refund",
            reference_id=str(sale.id),
            created_by=user.id,
        )

    original_entry = find_journal_entry(db, sale.business_id, "sale", str(sale.id))
    if original_entry is None:
        raise SaleError("Cannot refund: original journal entry was not found")
    reverse_journal_entry(
        db,
        original_entry,
        memo=f"Refund of sale {sale.reference}",
        created_by=user.id,
    )

    db.flush()
    db.refresh(sale)
    return sale
