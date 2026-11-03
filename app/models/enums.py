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
