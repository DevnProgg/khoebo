import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import MemberRole
from app.schemas.auth import UserOut
from app.schemas.common import ORMModel


class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    currency: str = Field(default="USD", min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str) -> str:
        return value.upper()


class BusinessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class BusinessOut(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    currency: str
    owner_id: uuid.UUID
    created_at: datetime


class MemberOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str
    role: MemberRole
    joined_at: datetime


class MemberAdd(BaseModel):
    email: EmailStr
    role: MemberRole = MemberRole.member


class MemberRoleUpdate(BaseModel):
    role: MemberRole


class MembershipSummary(ORMModel):
    business_id: uuid.UUID
    role: MemberRole


class UserWithMemberships(UserOut):
    memberships: list[MembershipSummary] = []
