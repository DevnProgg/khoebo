import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.accounting import Expense
from app.models.enums import SaleStatus
from app.models.inventory import Product
from app.models.sales import Sale
from app.services.accounting import money
from app.services.inventory import low_stock_products


def _range_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return start, end


def overview(
    db: Session, business_id: uuid.UUID, start_date: date, end_date: date
) -> dict:
    sales = list(
        db.scalars(
            select(Sale).where(
                Sale.business_id == business_id,
                Sale.status == SaleStatus.completed,
                Sale.effective_date >= start_date,
                Sale.effective_date <= end_date,
            )
        ).all()
    )

    revenue = Decimal("0")
    cogs = Decimal("0")
    discounts = Decimal("0")
    tax_collected = Decimal("0")
    payment_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    daily: dict[date, dict] = defaultdict(
        lambda: {"revenue": Decimal("0"), "sales_count": 0}
    )
    product_stats: dict[uuid.UUID, dict] = {}

    for sale in sales:
        sale_revenue = money(sale.subtotal - sale.discount_amount)
        revenue += sale_revenue
        discounts += money(sale.discount_amount)
        tax_collected += money(sale.tax_amount)
        payment_totals[sale.payment_method.value] += money(sale.total)

        sale_day = sale.effective_date
        daily[sale_day]["revenue"] += sale_revenue
        daily[sale_day]["sales_count"] += 1

        for item in sale.items:
            item_cost = money(item.quantity * item.unit_cost)
            cogs += item_cost
            stats = product_stats.setdefault(
                item.product_id,
                {
                    "product_id": str(item.product_id),
                    "product_name": item.product_name,
                    "quantity_sold": Decimal("0"),
                    "revenue": Decimal("0"),
                },
            )
            stats["quantity_sold"] += Decimal(item.quantity)
            stats["revenue"] += money(item.line_total)

    expenses = money(
        db.scalar(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.business_id == business_id,
                Expense.effective_date >= start_date,
                Expense.effective_date <= end_date,
            )
        )
        or 0
    )

    inventory_value = Decimal("0")
    products = db.scalars(
        select(Product).where(Product.business_id == business_id, Product.is_active.is_(True))
    ).all()
    for product in products:
        inventory_value += money(product.stock_quantity * product.cost_price)

    revenue = money(revenue)
    cogs = money(cogs)
    gross_profit = money(revenue - cogs)
    sales_count = len(sales)

    top_products = sorted(
        product_stats.values(), key=lambda row: row["revenue"], reverse=True
    )[:5]
    top_products = [
        {
            **row,
            "quantity_sold": Decimal(row["quantity_sold"]),
            "revenue": money(row["revenue"]),
        }
        for row in top_products
    ]

    revenue_by_day = [
        {
            "date": day,
            "revenue": money(values["revenue"]),
            "sales_count": values["sales_count"],
        }
        for day, values in sorted(daily.items())
    ]

    return {
        "start_date": start_date,
        "end_date": end_date,
        "revenue": revenue,
        "cost_of_goods_sold": cogs,
        "gross_profit": gross_profit,
        "expenses": expenses,
        "net_profit": money(gross_profit - expenses),
        "sales_count": sales_count,
        "average_sale_value": money(revenue / sales_count) if sales_count else Decimal("0"),
        "total_discounts": money(discounts),
        "total_tax_collected": money(tax_collected),
        "inventory_value": money(inventory_value),
        "low_stock_count": len(low_stock_products(db, business_id)),
        "top_products": top_products,
        "revenue_by_day": revenue_by_day,
        "revenue_by_payment_method": {
            method: money(amount) for method, amount in payment_totals.items()
        },
    }


def sales_summary(
    db: Session, business_id: uuid.UUID, start_date: date, end_date: date
) -> dict:
    sales = list(
        db.scalars(
            select(Sale).where(
                Sale.business_id == business_id,
                Sale.effective_date >= start_date,
                Sale.effective_date <= end_date,
            )
        ).all()
    )
    completed = [sale for sale in sales if sale.status == SaleStatus.completed]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_sales": len(sales),
        "completed_sales": len(completed),
        "refunded_sales": sum(1 for sale in sales if sale.status == SaleStatus.refunded),
        "gross_revenue": money(sum((sale.total for sale in completed), Decimal("0"))),
        "net_revenue": money(
            sum((sale.subtotal - sale.discount_amount for sale in completed), Decimal("0"))
        ),
        "discounts": money(sum((sale.discount_amount for sale in completed), Decimal("0"))),
        "tax_collected": money(sum((sale.tax_amount for sale in completed), Decimal("0"))),
    }
