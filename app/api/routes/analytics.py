from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_membership
from app.db.session import get_db
from app.models.business import BusinessMember
from app.schemas.analytics import AnalyticsOverview
from app.services.analytics import overview

router = APIRouter(prefix="/businesses/{business_id}/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def get_overview(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    today = date.today()
    start_date = start_date or today.replace(day=1)
    end_date = end_date or today
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date"
        )
    return overview(db, membership.business_id, start_date, end_date)
