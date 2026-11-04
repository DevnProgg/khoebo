import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.accounting import Account, Expense, JournalEntry, JournalLine
from app.models.enums import SaleStatus
from app.models.inventory import Product
from app.models.sales import Sale
from app.models.tax import FixedAsset, Purchase
from app.services.accounting import income_statement, money, trial_balance


def _utc_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return start, end


def _warning(code: str, message: str, severity: str = "warning") -> dict:
    return {"code": code, "message": message, "severity": severity}


def calculate_period_accounting(
    db: Session, business_id: uuid.UUID, start_date: date, end_date: date
) -> dict:
    statement = income_statement(db, business_id, start_date, end_date)
    total_revenue = money(statement["total_revenue"])
    total_expenses = money(statement["total_expenses"])

    cogs = Decimal("0")
    for line in statement["expenses"]:
        if line["code"] == "5000":
            cogs = money(line["amount"])
            break
    operating_expenses = money(total_expenses - cogs)

    start_at, end_at = _utc_bounds(start_date, end_date)
    sales = list(
        db.scalars(
            select(Sale).where(
                Sale.business_id == business_id,
                Sale.created_at >= start_at,
                Sale.created_at < end_at,
            )
        ).all()
    )
    completed = [sale for sale in sales if sale.status == SaleStatus.completed]
    refunded = [
        sale
        for sale in db.scalars(
            select(Sale).where(
                Sale.business_id == business_id,
                Sale.status == SaleStatus.refunded,
                Sale.refunded_at >= start_at,
                Sale.refunded_at < end_at,
            )
        ).all()
    ]

    tax_payable_account = db.scalar(
        select(Account.id).where(
            Account.business_id == business_id, Account.code == "2200"
        )
    )
    output_tax = Decimal("0")
    if tax_payable_account is not None:
        output_tax = money(
            db.scalar(
                select(
                    func.coalesce(func.sum(JournalLine.credit - JournalLine.debit), 0)
                )
                .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
                .where(
                    JournalEntry.business_id == business_id,
                    JournalEntry.entry_date >= start_date,
                    JournalEntry.entry_date <= end_date,
                    JournalLine.account_id == tax_payable_account,
                )
            )
            or 0
        )

    expenses = list(
        db.scalars(
            select(Expense)
            .where(
                Expense.business_id == business_id,
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
            )
            .order_by(Expense.expense_date, Expense.id)
        ).all()
    )
    purchases = list(
        db.scalars(
            select(Purchase)
            .where(
                Purchase.business_id == business_id,
                Purchase.invoice_date >= start_date,
                Purchase.invoice_date <= end_date,
            )
            .order_by(Purchase.invoice_date, Purchase.id)
        ).all()
    )
    assets = list(
        db.scalars(
            select(FixedAsset)
            .where(
                FixedAsset.business_id == business_id,
                FixedAsset.acquisition_date <= end_date,
            )
            .order_by(FixedAsset.acquisition_date, FixedAsset.id)
        ).all()
    )
    products = list(
        db.scalars(
            select(Product).where(
                Product.business_id == business_id, Product.is_active.is_(True)
            )
        ).all()
    )

    inventory_value = money(
        sum((money(product.stock_quantity * product.cost_price) for product in products), Decimal("0"))
    )
    purchase_net = money(sum((purchase.net_amount for purchase in purchases), Decimal("0")))
    purchase_tax = money(sum((purchase.tax_amount for purchase in purchases), Decimal("0")))
    purchase_total = money(sum((purchase.total_amount for purchase in purchases), Decimal("0")))

    warnings = []
    if end_date < date.today():
        warnings.append(
            _warning(
                "inventory_valuation_current",
                "Closing inventory uses the current product valuation because no historical stock snapshot exists.",
            )
        )
    if any(
        purchase.tax_amount > 0 and (not purchase.invoice_number or not purchase.supplier_tin)
        for purchase in purchases
    ):
        warnings.append(
            _warning(
                "purchase_vat_evidence_missing",
                "One or more purchases with VAT are missing an invoice number or supplier TIN.",
                "critical",
            )
        )
    if expenses:
        warnings.append(
            _warning(
                "expense_vat_not_captured",
                "Expenses do not currently store supplier VAT; use purchases for input VAT evidence.",
                "info",
            )
        )
    if sales:
        warnings.append(
            _warning(
                "sale_tax_codes_missing",
                "Sales store a header tax rate rather than per-line VAT tax codes; VAT category splits are unavailable.",
                "warning",
            )
        )

    trial = trial_balance(db, business_id, as_of=end_date)
    total_debit = money(sum((row["debit"] for row in trial), Decimal("0")))
    total_credit = money(sum((row["credit"] for row in trial), Decimal("0")))
    balanced = total_debit == total_credit
    if not balanced:
        warnings.append(
            _warning(
                "trial_balance_unbalanced",
                "The trial balance does not balance for the selected period end.",
                "critical",
            )
        )

    return {
        "currency": "LSL",
        "period": {"start": start_date, "end": end_date},
        "revenue": total_revenue,
        "discounts": money(
            sum((sale.discount_amount for sale in completed), Decimal("0"))
        ),
        "cost_of_goods_sold": cogs,
        "gross_profit": money(total_revenue - cogs),
        "expenses": total_expenses,
        "operating_expenses": operating_expenses,
        "net_profit": money(total_revenue - total_expenses),
        "sales": {
            "count": len(completed),
            "gross": money(sum((sale.total for sale in completed), Decimal("0"))),
            "net": money(
                sum(
                    (sale.subtotal - sale.discount_amount for sale in completed),
                    Decimal("0"),
                )
            ),
            "tax": money(sum((sale.tax_amount for sale in completed), Decimal("0"))),
            "output_tax": output_tax,
        },
        "refunds": {
            "count": len(refunded),
            "gross": money(sum((sale.total for sale in refunded), Decimal("0"))),
            "tax": money(sum((sale.tax_amount for sale in refunded), Decimal("0"))),
        },
        "purchases": {
            "count": len(purchases),
            "net": purchase_net,
            "tax": purchase_tax,
            "total": purchase_total,
        },
        "inventory": {
            "value": inventory_value,
            "valuation_date": date.today(),
            "product_count": len(products),
        },
        "assets": {
            "count": len(assets),
            "cost": money(sum((asset.cost for asset in assets), Decimal("0"))),
            "opening_wdv": money(
                sum(
                    (asset.opening_wdv if asset.opening_wdv is not None else asset.cost for asset in assets),
                    Decimal("0"),
                )
            ),
        },
        "ledger": {
            "revenue_accounts": statement["revenue"],
            "expense_accounts": statement["expenses"],
            "balanced": balanced,
            "total_debit": total_debit,
            "total_credit": total_credit,
        },
        "warnings": warnings,
    }
