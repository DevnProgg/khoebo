import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership
from app.db.session import get_db
from app.models.business import BusinessMember
from app.models.reminder import Reminder
from app.models.user import User
from app.schemas.reminder import DueReminderOut, ReminderCreate, ReminderOut, ReminderUpdate
from app.services.reminders import due_reminders, snooze_reminder, trigger_reminder

router = APIRouter(prefix="/businesses/{business_id}/reminders", tags=["reminders"])


def _get_reminder(
    db: Session, business_id: uuid.UUID, user_id: uuid.UUID, reminder_id: uuid.UUID
) -> Reminder:
    reminder = db.scalar(
        select(Reminder).where(
            Reminder.business_id == business_id,
            Reminder.user_id == user_id,
            Reminder.id == reminder_id,
        )
    )
    if reminder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    return reminder


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Reminder:
    reminder = Reminder(
        business_id=membership.business_id,
        user_id=user.id,
        type=payload.type,
        title=payload.title.strip(),
        message=payload.message,
        frequency=payload.frequency,
        next_due_at=payload.next_due_at or datetime.now(timezone.utc),
        is_active=payload.is_active,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
) -> list[Reminder]:
    query = select(Reminder).where(
        Reminder.business_id == membership.business_id, Reminder.user_id == user.id
    )
    if not include_inactive:
        query = query.where(Reminder.is_active.is_(True))
    return list(db.scalars(query.order_by(Reminder.next_due_at)).all())


@router.get("/due", response_model=list[DueReminderOut])
def list_due_reminders(
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return due_reminders(db, membership.business_id, user.id)


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Reminder:
    reminder = _get_reminder(db, membership.business_id, user.id, reminder_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    reminder = _get_reminder(db, membership.business_id, user.id, reminder_id)
    db.delete(reminder)
    db.commit()


@router.post("/{reminder_id}/trigger", response_model=ReminderOut)
def trigger_reminder_endpoint(
    reminder_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Reminder:
    reminder = _get_reminder(db, membership.business_id, user.id, reminder_id)
    trigger_reminder(db, reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/{reminder_id}/snooze", response_model=ReminderOut)
def snooze_reminder_endpoint(
    reminder_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(default=1, ge=1, le=365),
) -> Reminder:
    reminder = _get_reminder(db, membership.business_id, user.id, reminder_id)
    snooze_reminder(db, reminder, days=days)
    db.commit()
    db.refresh(reminder)
    return reminder
