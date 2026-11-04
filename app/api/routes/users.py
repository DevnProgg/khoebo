import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_superuser, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserOut, UserStatusUpdate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.ui_mode is not None:
        user.ui_mode = payload.ui_mode
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    _: User = Depends(get_current_superuser),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at)).all())


@router.patch("/{user_id}/status", response_model=UserOut)
def set_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdate,
    current: User = Depends(get_current_superuser),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate yourself"
        )
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user
