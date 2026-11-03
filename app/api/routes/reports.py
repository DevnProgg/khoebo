from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_membership
from app.db.session import get_db
from app.models.business import BusinessMember
from app.models.inventory import Product
from app.services.accounting import income_statement, money, trial_balance
from app.services.analytics import sales_summary

router = APIRouter(prefix="/businesses/{business_id}/reports", tags=["reports"])


@router.get("/trial-balance")
def get_trial_balance(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    as_of: date | None = None,
) -> dict:
    accounts = trial_balance(db, membership.business_id, as_of=as_of)
    total_debit = money(sum((account["debit"] for account in accounts), Decimal("0")))
    total_credit = money(sum((account["credit"] for account in accounts), Decimal("0")))
    return {
        "as_of": as_of,
        "accounts": accounts,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "balanced": total_debit == total_credit,
    }


@router.get("/income-statement")
def get_income_statement(
    start_date: date,
    end_date: date,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date"
        )
    return income_statement(db, membership.business_id, start_date, end_date)


@router.get("/inventory-valuation")
def get_inventory_valuation(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    products = db.scalars(
        select(Product)
        .where(Product.business_id == membership.business_id, Product.is_active.is_(True))
        .order_by(Product.name)
    ).all()

    items = []
    total_value = Decimal("0")
    total_units = Decimal("0")
    for product in products:
        value = money(product.stock_quantity * product.cost_price)
        total_value += value
        total_units += Decimal(product.stock_quantity)
        items.append(
            {
                "product_id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "quantity": product.stock_quantity,
                "cost_price": product.cost_price,
                "value": value,
            }
        )

    return {
        "items": items,
        "total_units": total_units,
        "total_value": money(total_value),
    }


@router.get("/sales-summary")
def get_sales_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date"
        )
    return sales_summary(db, membership.business_id, start_date, end_date)
