import enum


class MemberRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class StockMovementType(str, enum.Enum):
    in_ = "in"
    out = "out"
    adjustment = "adjustment"


class SaleStatus(str, enum.Enum):
    completed = "completed"
    refunded = "refunded"
    void = "void"


class UiMode(str, enum.Enum):
    simple = "simple"
    advanced = "advanced"


class EntrySource(str, enum.Enum):
    live = "live"
    backdated = "backdated"
    estimate = "estimate"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    transfer = "transfer"
    other = "other"


class AccountType(str, enum.Enum):
    asset = "asset"
    liability = "liability"
    equity = "equity"
    revenue = "revenue"
    expense = "expense"


class ReminderType(str, enum.Enum):
    low_stock = "low_stock"
    record_sales = "record_sales"
    inventory_count = "inventory_count"
    custom = "custom"


class ReminderFrequency(str, enum.Enum):
    once = "once"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class TaxpayerType(str, enum.Enum):
    sole_trader = "sole_trader"
    individual = "individual"
    partnership = "partnership"
    company = "company"
    non_resident_company = "non_resident_company"
    trustee = "trustee"


class TaxType(str, enum.Enum):
    income_tax = "income_tax"
    vat = "vat"
    provisional = "provisional"
    wht = "wht"
    paye = "paye"
    fbt = "fbt"


class TaxReturnStatus(str, enum.Enum):
    validated = "validated"
    flagged = "flagged"
    approved = "approved"
    filed = "filed"


class TaxAdjustmentCategory(str, enum.Enum):
    disallowed_expense = "disallowed_expense"
    capital_allowance = "capital_allowance"
    exempt_income = "exempt_income"
    loss_brought_forward = "loss_brought_forward"
    other_addition = "other_addition"
    other_deduction = "other_deduction"
    vat_output_adjustment = "vat_output_adjustment"
    vat_input_adjustment = "vat_input_adjustment"
