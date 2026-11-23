import enum
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.accounting import Account, Expense, JournalEntry, JournalLine
from app.models.business import BusinessMember
from app.models.inventory import Product, StockMovement
from app.models.sales import Sale, SaleItem
from app.models.user import User
from app.services.accounting import income_statement, money, trial_balance
from app.services.analytics import overview, sales_summary

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_MEDIA_TYPE = "application/pdf"


@dataclass(frozen=True)
class ExportTable:
    title: str
    headers: list[str]
    rows: list[tuple]


Builder = Callable[[Session, uuid.UUID, date | None, date | None], tuple[list[str], list[tuple]]]


def _amount(value: Decimal | float | int | None) -> float | None:
    return None if value is None else float(value)


def _when(value: datetime | date | None) -> str:
    return "" if value is None else value.isoformat()


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, enum.Enum):
        return value.value
    return str(value)


def _filter_datetime(
    query: Select, column: Any, start_date: date | None, end_date: date | None
) -> Select:
    if start_date is not None:
        query = query.where(column >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date is not None:
        upper = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        query = query.where(column < upper)
    return query


def _filter_date(query: Select, column: Any, start_date: date | None, end_date: date | None) -> Select:
    if start_date is not None:
        query = query.where(column >= start_date)
    if end_date is not None:
        query = query.where(column <= end_date)
    return query


def _sales(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_datetime(
        select(Sale).where(Sale.business_id == business_id), Sale.created_at, start, end
    ).order_by(Sale.created_at.desc())
    rows = [
        (
            sale.reference,
            _text(sale.customer_name),
            sale.status.value,
            sale.payment_method.value,
            _amount(sale.subtotal),
            _amount(sale.discount_amount),
            _amount(sale.tax_amount),
            _amount(sale.total),
            _amount(sale.amount_paid),
            _amount(sale.change_given),
            _text(sale.notes),
            _when(sale.created_at),
        )
        for sale in db.scalars(query).all()
    ]
    return (
        [
            "Reference",
            "Customer",
            "Status",
            "Payment method",
            "Subtotal",
            "Discount",
            "Tax",
            "Total",
            "Amount paid",
            "Change",
            "Notes",
            "Created at",
        ],
        rows,
    )


def _sale_items(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_datetime(
        select(SaleItem, Sale.reference)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.business_id == business_id),
        Sale.created_at,
        start,
        end,
    ).order_by(Sale.created_at.desc())
    rows = [
        (
            reference,
            item.product_name,
            _amount(item.quantity),
            _amount(item.unit_price),
            _amount(item.unit_cost),
            _amount(item.line_total),
        )
        for item, reference in db.execute(query).all()
    ]
    return (
        ["Sale reference", "Product", "Quantity", "Unit price", "Unit cost", "Line total"],
        rows,
    )


def _products(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_datetime(
        select(Product).where(Product.business_id == business_id), Product.created_at, start, end
    ).order_by(Product.name)
    rows = [
        (
            product.sku,
            product.name,
            _text(product.description),
            _amount(product.unit_price),
            _amount(product.cost_price),
            _amount(product.stock_quantity),
            _amount(product.low_stock_threshold),
            product.is_active,
            _when(product.created_at),
        )
        for product in db.scalars(query).all()
    ]
    return (
        [
            "SKU",
            "Name",
            "Description",
            "Unit price",
            "Cost price",
            "Stock",
            "Low stock threshold",
            "Active",
            "Created at",
        ],
        rows,
    )


def _stock_movements(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_datetime(
        select(StockMovement, Product.name)
        .join(Product, StockMovement.product_id == Product.id)
        .where(StockMovement.business_id == business_id),
        StockMovement.created_at,
        start,
        end,
    ).order_by(StockMovement.created_at.desc())
    rows = [
        (
            _when(movement.created_at),
            product_name,
            movement.movement_type.value,
            _amount(movement.quantity),
            _amount(movement.unit_cost),
            _text(movement.reason),
            _text(movement.reference_type),
            _text(movement.reference_id),
        )
        for movement, product_name in db.execute(query).all()
    ]
    return (
        [
            "Date",
            "Product",
            "Type",
            "Quantity",
            "Unit cost",
            "Reason",
            "Reference type",
            "Reference id",
        ],
        rows,
    )


def _expenses(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_date(
        select(Expense, Account.name)
        .join(Account, Expense.account_id == Account.id)
        .where(Expense.business_id == business_id),
        Expense.expense_date,
        start,
        end,
    ).order_by(Expense.expense_date.desc())
    rows = [
        (
            expense.expense_date.isoformat(),
            expense.description,
            _amount(expense.amount),
            expense.payment_method,
            account_name,
            _when(expense.created_at),
        )
        for expense, account_name in db.execute(query).all()
    ]
    return (["Date", "Description", "Amount", "Payment method", "Account", "Created at"], rows)


def _accounts(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_datetime(
        select(Account).where(Account.business_id == business_id), Account.created_at, start, end
    ).order_by(Account.code)
    rows = [
        (account.code, account.name, account.type.value, account.is_system, _when(account.created_at))
        for account in db.scalars(query).all()
    ]
    return (["Code", "Name", "Type", "System", "Created at"], rows)


def _journal_entries(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_date(
        select(JournalEntry).where(JournalEntry.business_id == business_id),
        JournalEntry.entry_date,
        start,
        end,
    ).order_by(JournalEntry.entry_date.desc())
    rows = [
        (
            entry.entry_date.isoformat(),
            entry.memo,
            _text(entry.reference_type),
            _text(entry.reference_id),
            _amount(sum((line.debit for line in entry.lines), Decimal("0"))),
            _amount(sum((line.credit for line in entry.lines), Decimal("0"))),
            _when(entry.created_at),
        )
        for entry in db.scalars(query).all()
    ]
    return (
        ["Date", "Memo", "Reference type", "Reference id", "Debit", "Credit", "Created at"],
        rows,
    )


def _journal_lines(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_date(
        select(JournalEntry.entry_date, JournalEntry.memo, Account.code, Account.name, JournalLine)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .join(Account, JournalLine.account_id == Account.id)
        .where(JournalEntry.business_id == business_id),
        JournalEntry.entry_date,
        start,
        end,
    ).order_by(JournalEntry.entry_date.desc())
    rows = [
        (
            entry_date.isoformat(),
            memo,
            code,
            account_name,
            _text(line.description),
            _amount(line.debit),
            _amount(line.credit),
        )
        for entry_date, memo, code, account_name, line in db.execute(query).all()
    ]
    return (
        ["Date", "Entry memo", "Account code", "Account", "Description", "Debit", "Credit"],
        rows,
    )


def _team_members(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    query = _filter_datetime(
        select(User.full_name, User.email, BusinessMember.role, BusinessMember.created_at)
        .join(User, BusinessMember.user_id == User.id)
        .where(BusinessMember.business_id == business_id),
        BusinessMember.created_at,
        start,
        end,
    ).order_by(User.full_name)
    rows = [
        (full_name, email, role.value, _when(joined_at))
        for full_name, email, role, joined_at in db.execute(query).all()
    ]
    return (["Name", "Email", "Role", "Joined at"], rows)


def _reminders(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    from app.models.reminder import Reminder

    query = _filter_datetime(
        select(Reminder).where(Reminder.business_id == business_id),
        Reminder.created_at,
        start,
        end,
    ).order_by(Reminder.next_due_at)
    rows = [
        (
            reminder.title,
            reminder.type.value,
            _text(reminder.message),
            reminder.frequency.value,
            _when(reminder.next_due_at),
            _when(reminder.last_triggered_at),
            reminder.is_active,
            _when(reminder.created_at),
        )
        for reminder in db.scalars(query).all()
    ]
    return (
        [
            "Title",
            "Type",
            "Message",
            "Frequency",
            "Next due",
            "Last triggered",
            "Active",
            "Created at",
        ],
        rows,
    )


def _trial_balance(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    accounts = trial_balance(db, business_id, as_of=end)
    rows = [
        (
            account["code"],
            account["name"],
            account["type"],
            _amount(account["debit"]),
            _amount(account["credit"]),
            _amount(account["balance"]),
        )
        for account in accounts
    ]
    return (["Code", "Account", "Type", "Debit", "Credit", "Balance"], rows)


def _income_statement(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    today = date.today()
    start, end = start or today - timedelta(days=29), end or today
    data = income_statement(db, business_id, start, end)
    rows: list[tuple] = [
        ("Start date", start.isoformat(), ""),
        ("End date", end.isoformat(), ""),
    ]
    rows += [
        (line["name"], _amount(line["amount"]), f"{line['code']} · revenue")
        for line in data["revenue"]
    ]
    rows.append(("Total revenue", _amount(data["total_revenue"]), ""))
    rows += [
        (line["name"], _amount(line["amount"]), f"{line['code']} · expense")
        for line in data["expenses"]
    ]
    rows.append(("Total expenses", _amount(data["total_expenses"]), ""))
    rows.append(("Net income", _amount(data["net_income"]), ""))
    return (["Line", "Amount", "Detail"], rows)


def _inventory_valuation(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    products = db.scalars(
        select(Product)
        .where(Product.business_id == business_id, Product.is_active.is_(True))
        .order_by(Product.name)
    ).all()
    rows = []
    total_units = Decimal("0")
    total_value = Decimal("0")
    for product in products:
        value = money(product.stock_quantity * product.cost_price)
        total_units += product.stock_quantity
        total_value += value
        rows.append(
            (
                product.sku,
                product.name,
                _amount(product.stock_quantity),
                _amount(product.cost_price),
                _amount(value),
            )
        )
    rows.append(("Total", "", _amount(total_units), "", _amount(total_value)))
    return (["SKU", "Product", "Quantity", "Unit cost", "Value"], rows)


def _sales_summary(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    today = date.today()
    start, end = start or today - timedelta(days=29), end or today
    data = sales_summary(db, business_id, start, end)
    keys = [
        ("Start date", "start_date"),
        ("End date", "end_date"),
        ("Total sales", "total_sales"),
        ("Completed sales", "completed_sales"),
        ("Refunded sales", "refunded_sales"),
        ("Gross revenue", "gross_revenue"),
        ("Net revenue", "net_revenue"),
        ("Discounts", "discounts"),
        ("Tax collected", "tax_collected"),
    ]
    rows = [(label, _amount(data[key]) if isinstance(data[key], Decimal) else data[key]) for label, key in keys]
    return (["Metric", "Value"], rows)


def _analytics_overview(db: Session, business_id: uuid.UUID, start: date | None, end: date | None):
    today = date.today()
    start, end = start or today - timedelta(days=29), end or today
    data = overview(db, business_id, start, end)
    keys = [
        ("Revenue", "revenue"),
        ("Cost of goods sold", "cost_of_goods_sold"),
        ("Gross profit", "gross_profit"),
        ("Expenses", "expenses"),
        ("Net profit", "net_profit"),
        ("Sales count", "sales_count"),
        ("Average sale value", "average_sale_value"),
        ("Total discounts", "total_discounts"),
        ("Total tax collected", "total_tax_collected"),
        ("Inventory value", "inventory_value"),
        ("Low stock count", "low_stock_count"),
    ]
    rows = [(label, _amount(data[key]) if isinstance(data[key], Decimal) else data[key]) for label, key in keys]
    return (["Metric", "Value"], rows)


DATASETS: dict[str, tuple[str, Builder]] = {
    "sales": ("Sales", _sales),
    "sale_items": ("Sale items", _sale_items),
    "products": ("Products", _products),
    "stock_movements": ("Stock movements", _stock_movements),
    "expenses": ("Expenses", _expenses),
    "accounts": ("Accounts", _accounts),
    "journal_entries": ("Journal entries", _journal_entries),
    "journal_lines": ("Journal lines", _journal_lines),
    "team_members": ("Team members", _team_members),
    "reminders": ("Reminders", _reminders),
    "trial_balance": ("Trial balance", _trial_balance),
    "income_statement": ("Income statement", _income_statement),
    "inventory_valuation": ("Inventory valuation", _inventory_valuation),
    "sales_summary": ("Sales summary", _sales_summary),
    "analytics_overview": ("Analytics overview", _analytics_overview),
}
DATASET_NAMES = (*DATASETS, "all")


def dataset_catalog() -> list[dict[str, str]]:
    return [
        {"id": name, "title": "All data" if name == "all" else DATASETS[name][0]}
        for name in DATASET_NAMES
    ]


def build_tables(
    db: Session,
    business_id: uuid.UUID,
    dataset: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[ExportTable]:
    names = DATASETS if dataset == "all" else {dataset: DATASETS[dataset]}
    tables = []
    for name, (title, builder) in names.items():
        headers, rows = builder(db, business_id, start_date, end_date)
        tables.append(ExportTable(title, headers, rows))
    return tables


def render_xlsx(tables: list[ExportTable]) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for table in tables:
        sheet = workbook.create_sheet(title=table.title[:31])
        sheet.append(table.headers)
        for row in table.rows:
            sheet.append(list(row))
        sheet.freeze_panes = "A2"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def render_pdf(tables: list[ExportTable]) -> bytes:
    styles = getSampleStyleSheet()
    cell_style = styles["BodyText"]
    cell_style.fontSize = 7
    cell_style.leading = 9
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
        title="Khoebo data export",
    )
    available_width = landscape(A4)[0] - 48
    story = [Paragraph("Khoebo data export", styles["Title"])]
    for table in tables:
        story.append(Paragraph(table.title, styles["Heading2"]))
        width = available_width / len(table.headers)
        data = [[Paragraph(escape(header), cell_style) for header in table.headers]]
        data += [
            [Paragraph(escape(_text(value)[:300]), cell_style) for value in row]
            for row in table.rows
        ]
        pdf_table = Table(data, colWidths=[width] * len(table.headers), repeatRows=1, hAlign="LEFT")
        pdf_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8F1EF")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B8C7C3")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9F8")]),
                ]
            )
        )
        story.extend([pdf_table, Spacer(1, 12)])
    document.build(story)
    return output.getvalue()
