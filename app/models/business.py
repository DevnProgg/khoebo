import uuid

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import MemberRole


def _role_enum() -> Enum:
    return Enum(
        MemberRole,
        native_enum=False,
        length=20,
        values_callable=lambda enum_cls: [item.value for item in enum_cls],
    )


class Business(TimestampMixin, Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    memberships: Mapped[list["BusinessMember"]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    sales: Mapped[list["Sale"]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    accounts: Mapped[list["Account"]] = relationship(cascade="all, delete-orphan")
    journal_entries: Mapped[list["JournalEntry"]] = relationship(cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship(cascade="all, delete-orphan")
    reminders: Mapped[list["Reminder"]] = relationship(cascade="all, delete-orphan")


class BusinessMember(TimestampMixin, Base):
    __tablename__ = "business_members"
    __table_args__ = (
        UniqueConstraint("business_id", "user_id", name="uq_business_members_business_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[MemberRole] = mapped_column(_role_enum(), default=MemberRole.member, nullable=False)

    business: Mapped[Business] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="memberships")
