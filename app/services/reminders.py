import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import ReminderFrequency, ReminderType, SaleStatus
from app.models.reminder import Reminder
from app.models.sales import Sale
from app.services.inventory import low_stock_products


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def compute_next_due(frequency: ReminderFrequency, from_time: datetime) -> datetime | None:
    if frequency == ReminderFrequency.once:
        return None
    if frequency == ReminderFrequency.daily:
        return from_time + timedelta(days=1)
    if frequency == ReminderFrequency.weekly:
        return from_time + timedelta(weeks=1)
    return from_time + timedelta(days=30)


def _context_for(
    db: Session, reminder: Reminder, now: datetime
) -> dict | None:
    if reminder.type == ReminderType.low_stock:
        products = low_stock_products(db, reminder.business_id)
        return {
            "low_stock_products": [
                {
                    "id": str(product.id),
                    "sku": product.sku,
                    "name": product.name,
                    "stock_quantity": str(product.stock_quantity),
                    "low_stock_threshold": str(product.low_stock_threshold),
                }
                for product in products
            ],
            "low_stock_count": len(products),
        }
    if reminder.type == ReminderType.record_sales:
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        count = db.scalar(
            select(Sale.id)
            .where(
                Sale.business_id == reminder.business_id,
                Sale.status == SaleStatus.completed,
                Sale.created_at >= day_start,
            )
            .limit(1)
        )
        return {"sales_recorded_today": count is not None}
    return None


def due_reminders(
    db: Session, business_id: uuid.UUID, user_id: uuid.UUID, now: datetime | None = None
) -> list[dict]:
    now = ensure_aware(now or utcnow())
    reminders = db.scalars(
        select(Reminder)
        .where(
            Reminder.business_id == business_id,
            Reminder.user_id == user_id,
            Reminder.is_active.is_(True),
            Reminder.next_due_at <= now,
        )
        .order_by(Reminder.next_due_at)
    ).all()

    result = []
    for reminder in reminders:
        context = _context_for(db, reminder, now)
        if reminder.type == ReminderType.low_stock and context and context["low_stock_count"] == 0:
            continue
        result.append(
            {
                "reminder": reminder,
                "overdue": ensure_aware(reminder.next_due_at) < now,
                "context": context,
            }
        )
    return result


def trigger_reminder(db: Session, reminder: Reminder, now: datetime | None = None) -> Reminder:
    now = ensure_aware(now or utcnow())
    reminder.last_triggered_at = now
    next_due = compute_next_due(reminder.frequency, now)
    if next_due is None:
        reminder.is_active = False
    else:
        reminder.next_due_at = next_due
    db.flush()
    return reminder


def snooze_reminder(
    db: Session, reminder: Reminder, days: int, now: datetime | None = None
) -> Reminder:
    now = ensure_aware(now or utcnow())
    reminder.next_due_at = now + timedelta(days=max(days, 1))
    db.flush()
    return reminder
