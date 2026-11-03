import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership, require_roles
from app.db.session import get_db
from app.models.business import Business, BusinessMember
from app.models.enums import MemberRole
from app.models.user import User
from app.schemas.business import (
    BusinessCreate,
    BusinessOut,
    BusinessUpdate,
    MemberAdd,
    MemberOut,
    MemberRoleUpdate,
)
from app.services.accounting import seed_default_accounts

router = APIRouter(prefix="/businesses", tags=["businesses"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (slug or "business")[:100]


def _unique_slug(db: Session, name: str) -> str:
    base = _slugify(name)
    candidate = base
    suffix = 2
    while db.scalar(select(Business.id).where(Business.slug == candidate)) is not None:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _member_out(membership: BusinessMember) -> MemberOut:
    return MemberOut(
        user_id=membership.user_id,
        email=membership.user.email,
        full_name=membership.user.full_name,
        role=membership.role,
        joined_at=membership.created_at,
    )


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Business:
    business = Business(
        name=payload.name.strip(),
        slug=_unique_slug(db, payload.name),
        currency=payload.currency,
        owner_id=user.id,
    )
    db.add(business)
    db.flush()
    db.add(
        BusinessMember(business_id=business.id, user_id=user.id, role=MemberRole.owner)
    )
    seed_default_accounts(db, business.id)
    db.commit()
    db.refresh(business)
    return business


@router.get("", response_model=list[BusinessOut])
def list_businesses(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Business]:
    return list(
        db.scalars(
            select(Business)
            .join(BusinessMember, BusinessMember.business_id == Business.id)
            .where(BusinessMember.user_id == user.id)
            .order_by(Business.created_at)
        ).all()
    )


@router.get("/{business_id}", response_model=BusinessOut)
def get_business(
    membership: BusinessMember = Depends(get_membership),
) -> Business:
    return membership.business


@router.patch("/{business_id}", response_model=BusinessOut)
def update_business(
    payload: BusinessUpdate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Business:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    business = membership.business
    if payload.name is not None:
        business.name = payload.name.strip()
    if payload.currency is not None:
        business.currency = payload.currency
    db.commit()
    db.refresh(business)
    return business


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> None:
    require_roles(membership, MemberRole.owner)
    db.delete(membership.business)
    db.commit()


@router.get("/{business_id}/members", response_model=list[MemberOut])
def list_members(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    members = db.scalars(
        select(BusinessMember)
        .where(BusinessMember.business_id == membership.business_id)
        .order_by(BusinessMember.created_at)
    ).all()
    return [_member_out(member) for member in members]


@router.post(
    "/{business_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    payload: MemberAdd,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> MemberOut:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    if payload.role in (MemberRole.owner, MemberRole.admin) and membership.role != MemberRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the business owner can grant admin or owner roles",
        )

    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = db.scalar(
        select(BusinessMember).where(
            BusinessMember.business_id == membership.business_id,
            BusinessMember.user_id == user.id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User is already a member"
        )

    member = BusinessMember(
        business_id=membership.business_id, user_id=user.id, role=payload.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    member.user = user
    return _member_out(member)


@router.patch("/{business_id}/members/{user_id}", response_model=MemberOut)
def update_member_role(
    user_id: uuid.UUID,
    payload: MemberRoleUpdate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> MemberOut:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    target = db.scalar(
        select(BusinessMember).where(
            BusinessMember.business_id == membership.business_id,
            BusinessMember.user_id == user_id,
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if (
        target.role in (MemberRole.owner, MemberRole.admin)
        or payload.role in (MemberRole.owner, MemberRole.admin)
    ) and membership.role != MemberRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the business owner can manage admin or owner roles",
        )

    if target.role == MemberRole.owner and payload.role != MemberRole.owner:
        owner_count = db.scalar(
            select(func.count())
            .select_from(BusinessMember)
            .where(
                BusinessMember.business_id == membership.business_id,
                BusinessMember.role == MemberRole.owner,
            )
        )
        if owner_count is not None and owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A business must have at least one owner",
            )

    target.role = payload.role
    db.commit()
    db.refresh(target)
    return _member_out(target)


@router.delete("/{business_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    user_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> None:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    target = db.scalar(
        select(BusinessMember).where(
            BusinessMember.business_id == membership.business_id,
            BusinessMember.user_id == user_id,
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if target.role in (MemberRole.owner, MemberRole.admin) and membership.role != MemberRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the business owner can remove admin or owner members",
        )
    if target.role == MemberRole.owner:
        owner_count = db.scalar(
            select(func.count())
            .select_from(BusinessMember)
            .where(
                BusinessMember.business_id == membership.business_id,
                BusinessMember.role == MemberRole.owner,
            )
        )
        if owner_count is not None and owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A business must have at least one owner",
            )

    db.delete(target)
    db.commit()
