import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ReminderFrequency, ReminderType
from app.schemas.common import ORMModel


class ReminderCreate(BaseModel):
    type: ReminderType = ReminderType.custom
    title: str = Field(min_length=1, max_length=255)
    message: str | None = None
    frequency: ReminderFrequency = ReminderFrequency.once
    next_due_at: datetime | None = None
    is_active: bool = True


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    message: str | None = None
    frequency: ReminderFrequency | None = None
    next_due_at: datetime | None = None
    is_active: bool | None = None


class ReminderOut(ORMModel):
    id: uuid.UUID
    business_id: uuid.UUID
    user_id: uuid.UUID
    type: ReminderType
    title: str
    message: str | None
    frequency: ReminderFrequency
    next_due_at: datetime
    last_triggered_at: datetime | None
    is_active: bool
    created_at: datetime


class DueReminderOut(BaseModel):
    reminder: ReminderOut
    overdue: bool
    context: dict | None = None
