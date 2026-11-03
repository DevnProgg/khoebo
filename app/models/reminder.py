import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import ReminderFrequency, ReminderType


def _reminder_type_enum() -> Enum:
    return Enum(
        ReminderType,
        native_enum=False,
        length=30,
        values_callable=lambda enum_cls: [item.value for item in enum_cls],
    )


def _frequency_enum() -> Enum:
    return Enum(
        ReminderFrequency,
        native_enum=False,
        length=20,
        values_callable=lambda enum_cls: [item.value for item in enum_cls],
    )


class Reminder(TimestampMixin, Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[ReminderType] = mapped_column(_reminder_type_enum(), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency: Mapped[ReminderFrequency] = mapped_column(
        _frequency_enum(), default=ReminderFrequency.once, nullable=False
    )
    next_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
