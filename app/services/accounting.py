import uuid
from datetime import date
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.accounting import Account, Expense, JournalEntry, JournalLine
from app.models.enums import AccountType
from app.models.sales import Sale

CENT = Decimal("0.01")


class AccountingError(ValueError):
    """Raised when a bookkeeping operation would produce invalid entries."""


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


DEFAULT_ACCOUNTS: list[tuple[str, str, AccountType]] = [
    ("1000", "Cash", AccountType.asset),
    ("1010", "Accounts Receivable", AccountType.asset),
    ("1200", "Inventory", AccountType.asset),
    ("2000", "Accounts Payable", AccountType.liability),
    ("2200", "Tax Payable", AccountType.liability),
    ("3000", "Owner's Equity", AccountType.equity),
    ("4000", "Sales Revenue", AccountType.revenue),
    ("4010", "Sales Discounts", AccountType.revenue),
    ("5000", "Cost of Goods Sold", AccountType.expense),
    ("5100", "Operating Expenses", AccountType.expense),
    ("5200", "Rent Expense", AccountType.expense),
    ("5300", "Salaries Expense", AccountType.expense),
    ("5400", "Utilities Expense", AccountType.expense),
    ("5500", "Marketing Expense", AccountType.expense),
    ("5600", "Other Expenses", AccountType.expense),
]


def seed_default_accounts(db: Session, business_id: uuid.UUID) -> list[Account]:
    accounts = [
        Account(
            business_id=business_id,
            code=code,
            name=name,
            type=account_type,
            is_system=True,
        )
        for code, name, account_type in DEFAULT_ACCOUNTS
    ]
    db.add_all(accounts)
    db.flush()
    return accounts


def get_account_by_code(db: Session, business_id: uuid.UUID, code: str) -> Account | None:
    return db.scalar(
        select(Account).where(Account.business_id == business_id, Account.code == code)
    )


def create_journal_entry(
    db: Session,
    *,
    business_id: uuid.UUID,
    entry_date: date,
    memo: str,
    lines: list[dict],
    created_by: uuid.UUID | None = None,
    reference_type: str | None = None,
    reference_id: str | None = None,
) -> JournalEntry:
    if len(lines) < 2:
        raise AccountingError("A journal entry needs at least two lines")

    total_debit = money(sum((money(line.get("debit", 0)) for line in lines), Decimal("0")))
    total_credit = money(sum((money(line.get("credit", 0)) for line in lines), Decimal("0")))
    if total_debit != total_credit:
        raise AccountingError(
            f"Journal entry is not balanced (debits {total_debit} != credits {total_credit})"
        )
    if total_debit <= 0:
        raise AccountingError("Journal entry must have a non-zero balance")

    account_ids = {line["account_id"] for line in lines}
    accounts = db.scalars(
        select(Account).where(
            Account.business_id == business_id, Account.id.in_(account_ids)
        )
    ).all()
    if len(accounts) != len(account_ids):
        raise AccountingError("One or more accounts do not belong to this business")

    entry = JournalEntry(
        business_id=business_id,
        entry_date=entry_date,
        memo=memo,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()

    for line in lines:
        debit = money(line.get("debit", 0))
        credit = money(line.get("credit", 0))
        if debit < 0 or credit < 0:
            raise AccountingError("Debit and credit amounts cannot be negative")
        if debit == 0 and credit == 0:
            raise AccountingError("A journal line needs a debit or credit amount")
        db.add(
            JournalLine(
                journal_entry_id=entry.id,
                account_id=line["account_id"],
                debit=debit,
                credit=credit,
                description=line.get("description"),
            )
        )
    db.flush()
    db.refresh(entry)
    return entry


def post_sale_journal(db: Session, sale: Sale, created_by: uuid.UUID | None = None) -> JournalEntry:
    cash = get_account_by_code(db, sale.business_id, "1000")
    revenue = get_account_by_code(db, sale.business_id, "4000")
    discounts = get_account_by_code(db, sale.business_id, "4010")
    tax_payable = get_account_by_code(db, sale.business_id, "2200")
    cogs_account = get_account_by_code(db, sale.business_id, "5000")
    inventory = get_account_by_code(db, sale.business_id, "1200")
    if not all([cash, revenue, discounts, tax_payable]):
        raise AccountingError("Default chart of accounts is incomplete")

    cogs_total = money(
        sum((money(item.quantity * item.unit_cost) for item in sale.items), Decimal("0"))
    )
    lines: list[dict] = []
    if sale.total > 0:
        lines.append({"account_id": cash.id, "debit": sale.total, "description": "Sale payment"})
    if sale.subtotal > 0:
        lines.append(
            {"account_id": revenue.id, "credit": sale.subtotal, "description": "Sales revenue"}
        )
    if sale.discount_amount > 0:
        lines.append(
            {
                "account_id": discounts.id,
                "debit": sale.discount_amount,
                "description": "Sales discount",
            }
        )
    if sale.tax_amount > 0:
        lines.append(
            {
                "account_id": tax_payable.id,
                "credit": sale.tax_amount,
                "description": "Sales tax",
            }
        )
    if cogs_total > 0:
        if cogs_account is None or inventory is None:
            raise AccountingError("Default chart of accounts is incomplete")
        lines.append(
            {"account_id": cogs_account.id, "debit": cogs_total, "description": "Cost of goods sold"}
        )
        lines.append(
            {
                "account_id": inventory.id,
                "credit": cogs_total,
                "description": "Inventory reduction",
            }
        )

    return create_journal_entry(
        db,
        business_id=sale.business_id,
        entry_date=sale.effective_date,
        memo=f"Sale {sale.reference}",
        lines=lines,
        created_by=created_by,
        reference_type="sale",
        reference_id=str(sale.id),
    )


def post_expense_journal(
    db: Session,
    *,
    business_id: uuid.UUID,
    expense_date: date,
    description: str,
    amount: Decimal,
    account_id: uuid.UUID,
    created_by: uuid.UUID | None = None,
    reference_id: str | None = None,
) -> JournalEntry:
    cash = get_account_by_code(db, business_id, "1000")
    if cash is None:
        raise AccountingError("Default chart of accounts is incomplete")
    return create_journal_entry(
        db,
        business_id=business_id,
        entry_date=expense_date,
        memo=f"Expense: {description}",
        lines=[
            {"account_id": account_id, "debit": money(amount), "description": description},
            {"account_id": cash.id, "credit": money(amount), "description": "Cash payment"},
        ],
        created_by=created_by,
        reference_type="expense",
        reference_id=reference_id,
    )


def find_journal_entry(
    db: Session, business_id: uuid.UUID, reference_type: str, reference_id: str
) -> JournalEntry | None:
    return db.scalar(
        select(JournalEntry).where(
            JournalEntry.business_id == business_id,
            JournalEntry.reference_type == reference_type,
            JournalEntry.reference_id == reference_id,
        )
    )


def reverse_journal_entry(
    db: Session,
    entry: JournalEntry,
    *,
    memo: str,
    created_by: uuid.UUID | None = None,
) -> JournalEntry:
    lines = [
        {
            "account_id": line.account_id,
            "debit": line.credit,
            "credit": line.debit,
            "description": f"Reversal: {line.description or entry.memo}",
        }
        for line in entry.lines
    ]
    return create_journal_entry(
        db,
        business_id=entry.business_id,
        entry_date=date.today(),
        memo=memo,
        lines=lines,
        created_by=created_by,
        reference_type="reversal",
        reference_id=entry.reference_id,
    )


def trial_balance(db: Session, business_id: uuid.UUID, as_of: date | None = None) -> list[dict]:
    totals = (
        select(
            JournalLine.account_id.label("account_id"),
            func.coalesce(func.sum(JournalLine.debit), 0).label("debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("credit"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(JournalEntry.business_id == business_id)
    )
    if as_of is not None:
        totals = totals.where(JournalEntry.entry_date <= as_of)
    totals = totals.group_by(JournalLine.account_id).subquery()

    rows = db.execute(
        select(
            Account,
            func.coalesce(totals.c.debit, 0),
            func.coalesce(totals.c.credit, 0),
        )
        .outerjoin(totals, totals.c.account_id == Account.id)
        .where(Account.business_id == business_id)
        .order_by(Account.code)
    ).all()

    result = []
    for account, debit, credit in rows:
        debit = money(debit)
        credit = money(credit)
        result.append(
            {
                "account_id": account.id,
                "code": account.code,
                "name": account.name,
                "type": account.type.value,
                "debit": debit,
                "credit": credit,
                "balance": money(debit - credit),
            }
        )
    return result


def income_statement(
    db: Session, business_id: uuid.UUID, start_date: date, end_date: date
) -> dict:
    totals = (
        select(
            Account,
            func.coalesce(func.sum(JournalLine.debit), 0).label("debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("credit"),
        )
        .outerjoin(JournalLine, JournalLine.account_id == Account.id)
        .outerjoin(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            Account.business_id == business_id,
            JournalEntry.entry_date >= start_date,
            JournalEntry.entry_date <= end_date,
        )
        .group_by(Account.id)
        .order_by(Account.code)
    )
    rows = db.execute(totals).all()

    revenue_lines = []
    expense_lines = []
    total_revenue = Decimal("0")
    total_expenses = Decimal("0")
    for account, debit, credit in rows:
        debit = money(debit)
        credit = money(credit)
        balance = money(credit - debit) if account.type == AccountType.revenue else money(
            debit - credit
        )
        if account.type == AccountType.revenue and (debit or credit):
            revenue_lines.append(
                {"code": account.code, "name": account.name, "amount": balance}
            )
            total_revenue += balance
        elif account.type == AccountType.expense and (debit or credit):
            expense_lines.append(
                {"code": account.code, "name": account.name, "amount": balance}
            )
            total_expenses += balance

    total_revenue = money(total_revenue)
    total_expenses = money(total_expenses)
    return {
        "start_date": start_date,
        "end_date": end_date,
        "revenue": revenue_lines,
        "expenses": expense_lines,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_income": money(total_revenue - total_expenses),
    }
