from datetime import date
from enum import Enum
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_membership
from app.db.session import get_db
from app.models.business import BusinessMember
from app.services.exports import (
    PDF_MEDIA_TYPE,
    XLSX_MEDIA_TYPE,
    DATASET_NAMES,
    build_tables,
    dataset_catalog,
    render_pdf,
    render_xlsx,
)

router = APIRouter(prefix="/businesses/{business_id}/exports", tags=["exports"])
DatasetName = Enum("DatasetName", {name: name for name in DATASET_NAMES}, type=str)


@router.get("")
def list_exports(membership: BusinessMember = Depends(get_membership)) -> dict:
    return {"datasets": dataset_catalog()}


@router.get("/{dataset}")
def export_records(
    dataset: DatasetName,
    format: Literal["pdf", "xlsx"] = Query(default="pdf"),
    start_date: date | None = None,
    end_date: date | None = None,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Response:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date"
        )

    tables = build_tables(db, membership.business_id, dataset.value, start_date, end_date)
    if format == "xlsx":
        content, media_type, extension = render_xlsx(tables), XLSX_MEDIA_TYPE, "xlsx"
    else:
        content, media_type, extension = render_pdf(tables), PDF_MEDIA_TYPE, "pdf"

    filename = f"khoebo-{dataset.value}-{(end_date or date.today()).isoformat()}.{extension}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
