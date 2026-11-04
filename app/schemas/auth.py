import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.identity import normalize_phone

from app.schemas.common import ORMModel


def validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(value) > 128:
        raise ValueError("Password must be at most 128 characters long")
    if not any(char.isalpha() for char in value):
        raise ValueError("Password must contain at least one letter")
    if not any(char.isdigit() for char in value):
        raise ValueError("Password must contain at least one digit")
    return value


class RegisterRequest(BaseModel):
    email: EmailStr | None = None
    phone_number: str | None = Field(default=None, max_length=30)
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    _validate_password = field_validator("password")(validate_password_strength)

    @field_validator("email", mode="before")
    @classmethod
    def blank_email_is_none(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("phone_number", mode="before")
    @classmethod
    def blank_phone_is_none(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        normalized = normalize_phone(value)
        if normalized is None:
            return None
        if not 7 <= len(normalized) <= 15:
            raise ValueError("Phone number must contain between 7 and 15 digits")
        return normalized

    @model_validator(mode="after")
    def require_contact_method(self) -> "RegisterRequest":
        if self.email is None and self.phone_number is None:
            raise ValueError("Provide an email address or a phone number")
        return self


class LoginRequest(BaseModel):
    identifier: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def resolve_identifier(self) -> "LoginRequest":
        candidate = self.identifier or (str(self.email) if self.email is not None else None)
        if candidate is None or not candidate.strip():
            raise ValueError("Provide an email address or a phone number")
        self.identifier = candidate.strip()
        return self


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    _validate_password = field_validator("new_password")(validate_password_strength)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: uuid.UUID
    email: EmailStr | None
    phone_number: str | None
    full_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)


class UserStatusUpdate(BaseModel):
    is_active: bool
