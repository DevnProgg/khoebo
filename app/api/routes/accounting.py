import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership, require_roles
from app.db.session import get_db
from app.models.accounting import Account, Expense, JournalEntry
from app.models.business import BusinessMember
from app.models.enums import AccountType, EntrySource, MemberRole
from app.models.user import User
from app.schemas.accounting import (
    AccountCreate,
    AccountOut,
    ExpenseCreate,
    ExpenseOut,
    JournalEntryCreate,
    JournalEntryOut,
)
from app.services.accounting import (
    AccountingError,
    create_journal_entry,
    get_account_by_code,
    post_expense_journal,
)

router = APIRouter(prefix="/businesses/{business_id}", tags=["accounting"])


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> list[Account]:
    return list(
        db.scalars(
            select(Account)
            .where(Account.business_id == membership.business_id)
            .order_by(Account.code)
        ).all()
    )


@router.post("/accounts", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Account:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    account = Account(
        business_id=membership.business_id,
        code=payload.code.strip(),
        name=payload.name.strip(),
        type=payload.type,
        is_system=False,
    )
    db.add(account)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Account code already exists"
        ) from None
    db.refresh(account)
    return account


@router.get("/journal-entries", response_model=list[JournalEntryOut])
def list_journal_entries(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[JournalEntry]:
    query = select(JournalEntry).where(JournalEntry.business_id == membership.business_id)
    if start_date:
        query = query.where(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.where(JournalEntry.entry_date <= end_date)
    query = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
    return list(db.scalars(query.limit(limit).offset(offset)).all())


@router.post(
    "/journal-entries", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED
)
def create_manual_journal_entry(
    payload: JournalEntryCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalEntry:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    try:
        entry = create_journal_entry(
            db,
            business_id=membership.business_id,
            entry_date=payload.entry_date,
            memo=payload.memo,
            lines=[line.model_dump() for line in payload.lines],
            created_by=user.id,
        )
    except AccountingError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[Expense]:
    query = select(Expense).where(Expense.business_id == membership.business_id)
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)
    query = query.order_by(Expense.expense_date.desc(), Expense.created_at.desc())
    return list(db.scalars(query.limit(limit).offset(offset)).all())


@router.post("/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Expense:
    require_roles(membership, MemberRole.owner, MemberRole.admin)

    if payload.idempotency_key:
        existing = db.scalar(
            select(Expense).where(
                Expense.business_id == membership.business_id,
                Expense.idempotency_key == payload.idempotency_key,
            )
        )
        if existing is not None:
            return existing

    if payload.account_id is not None:
        account = db.scalar(
            select(Account).where(
                Account.business_id == membership.business_id,
                Account.id == payload.account_id,
            )
        )
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expense account does not belong to this business",
            )
        if account.type != AccountType.expense:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expenses must be posted to an expense account",
            )
    else:
        account = get_account_by_code(db, membership.business_id, "5100")
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Default expense account is missing",
            )

    expense = Expense(
        business_id=membership.business_id,
        description=payload.description.strip(),
        amount=payload.amount,
        expense_date=payload.effective_date or payload.expense_date,
        effective_date=payload.effective_date or payload.expense_date,
        entry_source=(
            EntrySource.backdated
            if (payload.effective_date or payload.expense_date) < date.today() - timedelta(days=1)
            else EntrySource.live
        ),
        idempotency_key=payload.idempotency_key,
        payment_method=payload.payment_method.value,
        account_id=account.id,
        created_by=user.id,
    )
    db.add(expense)
    db.flush()
    try:
        entry = post_expense_journal(
            db,
            business_id=membership.business_id,
            expense_date=payload.effective_date or payload.expense_date,
            description=payload.description,
            amount=payload.amount,
            account_id=account.id,
            created_by=user.id,
            reference_id=str(expense.id),
        )
    except AccountingError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    expense.journal_entry_id = entry.id
    db.commit()
    db.refresh(expense)
    return expense
