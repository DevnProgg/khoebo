import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import AccountType, EntrySource, PaymentMethod
from app.schemas.common import Money, ORMModel, PositiveMoney


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    type: AccountType


class AccountOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    code: str
    name: str
    type: AccountType
    is_system: bool


class JournalLineCreate(BaseModel):
    account_id: uuid.UUID
    debit: Money = Decimal("0")
    credit: Money = Decimal("0")
    description: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_single_sided(self) -> "JournalLineCreate":
        if self.debit > 0 and self.credit > 0:
            raise ValueError("A journal line cannot have both debit and credit amounts")
        if self.debit == 0 and self.credit == 0:
            raise ValueError("A journal line must have a debit or credit amount")
        return self


class JournalEntryCreate(BaseModel):
    entry_date: date
    memo: str = Field(min_length=1, max_length=255)
    lines: list[JournalLineCreate] = Field(min_length=2)


class JournalLineOut(ORMModel):
    id: uuid.UUID
    account_id: uuid.UUID
    description: str | None
    debit: Money
    credit: Money


class JournalEntryOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    entry_date: date
    memo: str
    reference_type: str | None
    reference_id: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    lines: list[JournalLineOut]


class ExpenseCreate(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: PositiveMoney
    expense_date: date
    payment_method: PaymentMethod = PaymentMethod.cash
    account_id: uuid.UUID | None = None
    effective_date: date | None = None
    idempotency_key: str | None = Field(default=None, max_length=120)


class ExpenseOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    description: str
    amount: Money
    expense_date: date
    effective_date: date
    entry_source: EntrySource
    idempotency_key: str | None
    payment_method: str
    account_id: uuid.UUID
    journal_entry_id: uuid.UUID | None
    created_at: datetime
