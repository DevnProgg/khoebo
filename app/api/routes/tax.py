import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership, require_roles
from app.db.session import get_db
from app.models.business import BusinessMember
from app.models.enums import MemberRole, TaxReturnStatus, TaxType
from app.models.tax import (
    FixedAsset,
    Purchase,
    TaxAdjustment,
    TaxAuditEvent,
    TaxFiling,
    TaxPayment,
    TaxProfile,
    TaxReturn,
)
from app.models.user import User
from app.schemas.tax import (
    FixedAssetCreate,
    FixedAssetOut,
    PurchaseCreate,
    PurchaseOut,
    TaxAdjustmentCreate,
    TaxAdjustmentOut,
    TaxPaymentCreate,
    TaxPaymentOut,
    TaxProfileOut,
    TaxProfileUpsert,
    TaxReturnCreate,
    TaxReturnOut,
    TaxFilingCreate,
    TaxFilingOut,
)
from app.services.period_accounting import calculate_period_accounting
from app.services.tax_calendar import statutory_period, suggest_reporting_periods
from app.services.tax_documents import render_return_pdf, render_supporting_schedule
from app.services.tax_preparation import (
    TaxPreparationError,
    prepare_tax_return,
    serialize_tax_return,
)
from app.services.tax_rules import resolve_rule_set

router = APIRouter(prefix="/businesses/{business_id}/tax", tags=["tax"])
RSL_ETAX_PORTAL = "https://www.rsl.org.ls/filing-tax-returns"


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _get_profile(db: Session, business_id: uuid.UUID) -> TaxProfile | None:
    return db.scalar(select(TaxProfile).where(TaxProfile.business_id == business_id))


def _period_out(item: dict) -> dict:
    result = {key: value for key, value in item.items() if not hasattr(value, "isoformat")}
    for key in ("reporting_start", "reporting_end", "statutory_start", "statutory_end", "due_date"):
        if item.get(key) is not None:
            result[key] = item[key].isoformat()
    if item.get("due_dates") is not None:
        result["due_dates"] = [value.isoformat() for value in item["due_dates"]]
    return result


def _json_safe(value):
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _get_tax_return(db: Session, business_id: uuid.UUID, return_id: uuid.UUID) -> TaxReturn:
    record = db.scalar(
        select(TaxReturn).where(
            TaxReturn.id == return_id,
            TaxReturn.business_id == business_id,
        )
    )
    if record is None:
        raise _not_found("Tax return not found")
    return record


def _audit(
    db: Session,
    *,
    business_id: uuid.UUID,
    action: str,
    actor_id: uuid.UUID | None = None,
    tax_return_id: uuid.UUID | None = None,
    tax_filing_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> TaxAuditEvent:
    event = TaxAuditEvent(
        business_id=business_id,
        tax_return_id=tax_return_id,
        tax_filing_id=tax_filing_id,
        actor_id=actor_id,
        action=action,
        details=details or {},
    )
    db.add(event)
    return event


def _serialize_filing(filing: TaxFiling) -> dict:
    return {
        "id": str(filing.id),
        "business_id": str(filing.business_id),
        "tax_return_id": str(filing.tax_return_id),
        "channel": filing.channel,
        "status": filing.status,
        "external_reference": filing.external_reference,
        "portal_url": filing.portal_url,
        "filed_at": filing.filed_at.isoformat() if filing.filed_at else None,
        "confirmed_at": filing.confirmed_at.isoformat() if filing.confirmed_at else None,
        "notes": filing.notes,
        "created_by": str(filing.created_by) if filing.created_by else None,
        "created_at": filing.created_at.isoformat() if filing.created_at else None,
    }


@router.get("/profile", response_model=TaxProfileOut)
def get_tax_profile(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> TaxProfile:
    profile = _get_profile(db, membership.business_id)
    if profile is None:
        raise _not_found("Tax profile not found")
    return profile


@router.put("/profile", response_model=TaxProfileOut)
def upsert_tax_profile(
    payload: TaxProfileUpsert,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> TaxProfile:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    profile = _get_profile(db, membership.business_id)
    values = payload.model_dump()
    if profile is None:
        profile = TaxProfile(business_id=membership.business_id, **values)
        db.add(profile)
    else:
        for key, value in values.items():
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/periods")
def get_reporting_periods(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    tax_type: TaxType = Query(...),
    count: int = Query(default=4, ge=1, le=24),
) -> dict:
    profile = _get_profile(db, membership.business_id)
    instalments = None
    today = date.today()
    statutory_start, statutory_end = statutory_period(
        profile, tax_type, today, today
    )
    rule = resolve_rule_set(
        db,
        tax_type=tax_type,
        taxpayer_type=profile.taxpayer_type if profile else None,
        period_start=statutory_start,
        period_end=statutory_end,
    )
    if tax_type == TaxType.provisional and rule is not None:
        instalments = rule.rules.get("instalments")
    periods = suggest_reporting_periods(
        profile, tax_type, count=count, instalments=instalments
    )
    db.commit()
    return {
        "tax_type": tax_type.value,
        "profile_present": profile is not None,
        "rule_version": rule.version if rule is not None else None,
        "periods": [_period_out(item) for item in periods],
    }


@router.get("/deadlines")
def get_upcoming_deadlines(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    tax_type: TaxType = Query(...),
    count: int = Query(default=6, ge=1, le=24),
) -> dict:
    profile = _get_profile(db, membership.business_id)
    today = date.today()
    statutory_start, statutory_end = statutory_period(profile, tax_type, today, today)
    rule = resolve_rule_set(
        db,
        tax_type=tax_type,
        taxpayer_type=profile.taxpayer_type if profile else None,
        period_start=statutory_start,
        period_end=statutory_end,
    )
    instalments = rule.rules.get("instalments") if tax_type == TaxType.provisional and rule else None
    periods = suggest_reporting_periods(profile, tax_type, count=count, instalments=instalments)
    db.commit()
    return {
        "tax_type": tax_type.value,
        "rule_version": rule.version if rule is not None else None,
        "deadlines": [_period_out(item) for item in periods],
        "legal_notice": "Deadlines are preparation reminders and are not filing confirmation.",
    }


@router.get("/summaries")
@router.get("/accounting-summaries")
def get_accounting_summary(
    start: date = Query(...),
    end: date = Query(...),
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    if start > end:
        raise HTTPException(status_code=400, detail="start must be on or before end")
    return _json_safe(calculate_period_accounting(db, membership.business_id, start, end))


@router.get("/calculations")
def get_tax_calculation(
    tax_type: TaxType = Query(...),
    start: date = Query(...),
    end: date = Query(...),
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return prepare_tax_return(
            db,
            business=membership.business,
            tax_type=tax_type,
            reporting_start=start,
            reporting_end=end,
            persist=False,
        )
    except TaxPreparationError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/returns", response_model=list[TaxReturnOut])
def list_tax_returns(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    tax_type: TaxType | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    query = select(TaxReturn).where(TaxReturn.business_id == membership.business_id)
    if tax_type is not None:
        query = query.where(TaxReturn.tax_type == tax_type)
    query = query.order_by(TaxReturn.created_at.desc()).limit(limit).offset(offset)
    return [serialize_tax_return(row) for row in db.scalars(query).all()]


@router.post("/returns/preview")
def preview_tax_return(
    payload: TaxReturnCreate,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    try:
        return prepare_tax_return(
            db,
            business=membership.business,
            tax_type=payload.tax_type,
            reporting_start=payload.reporting_start,
            reporting_end=payload.reporting_end,
            persist=False,
        )
    except TaxPreparationError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/returns", response_model=TaxReturnOut, status_code=status.HTTP_201_CREATED)
def create_tax_return(
    payload: TaxReturnCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    try:
        result = prepare_tax_return(
            db,
            business=membership.business,
            tax_type=payload.tax_type,
            reporting_start=payload.reporting_start,
            reporting_end=payload.reporting_end,
            created_by=user.id,
            persist=True,
        )
    except TaxPreparationError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    db.commit()
    record = db.get(TaxReturn, uuid.UUID(result["id"]))
    if record is None:
        raise HTTPException(status_code=500, detail="Tax return could not be loaded")
    return serialize_tax_return(record)


@router.get("/returns/{return_id}", response_model=TaxReturnOut)
def get_tax_return(
    return_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    record = _get_tax_return(db, membership.business_id, return_id)
    return serialize_tax_return(record)


@router.post("/returns/{return_id}/validate")
def validate_tax_return(
    return_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    record = _get_tax_return(db, membership.business_id, return_id)
    if record.status in (TaxReturnStatus.approved, TaxReturnStatus.filed):
        raise HTTPException(status_code=409, detail="An approved or filed return cannot be revalidated")
    try:
        preview = prepare_tax_return(
            db,
            business=membership.business,
            tax_type=record.tax_type,
            reporting_start=record.reporting_period_start,
            reporting_end=record.reporting_period_end,
            persist=False,
        )
    except TaxPreparationError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    old_status = record.status.value
    changed = preview["input_hash"] != record.input_hash
    if changed:
        issue = {
            "code": "return_inputs_changed",
            "message": "Source data changed since this return was generated.",
            "severity": "critical",
        }
        preview["warnings"].append(issue)
        preview["validation"]["status"] = "flagged"
    record.status = TaxReturnStatus.flagged if changed or preview["status"] == "flagged" else TaxReturnStatus.validated
    record.warnings = preview["warnings"]
    record.validation = preview["validation"]
    record.updated_at = datetime.now(timezone.utc)
    _audit(
        db,
        business_id=membership.business_id,
        tax_return_id=record.id,
        actor_id=user.id,
        action="validated",
        details={"old_status": old_status, "new_status": record.status.value, "inputs_changed": changed},
    )
    db.commit()
    return {
        "return_id": str(record.id),
        "status": record.status.value,
        "validation": record.validation,
        "warnings": record.warnings,
        "input_hash": record.input_hash,
        "calculation_hash": record.calculation_hash,
    }


@router.post("/returns/{return_id}/approve", response_model=TaxReturnOut)
def approve_tax_return(
    return_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    record = _get_tax_return(db, membership.business_id, return_id)
    if record.status != TaxReturnStatus.validated:
        raise HTTPException(status_code=409, detail="Only a validated return can be approved")
    if any(item.get("severity") == "critical" for item in record.warnings):
        raise HTTPException(status_code=422, detail="Resolve critical validation warnings before approval")
    record.status = TaxReturnStatus.approved
    _audit(
        db,
        business_id=membership.business_id,
        tax_return_id=record.id,
        actor_id=user.id,
        action="approved",
        details={"rule_version": record.rule_version, "calculation_hash": record.calculation_hash},
    )
    db.commit()
    return serialize_tax_return(record)


@router.get("/returns/{return_id}/pdf")
def download_tax_return_pdf(
    return_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Response:
    record = _get_tax_return(db, membership.business_id, return_id)
    if record.status == TaxReturnStatus.flagged:
        raise HTTPException(status_code=409, detail="Flagged returns cannot be downloaded as final PDFs")
    filename = f"{record.tax_type.value}-{record.reporting_period_end.isoformat()}.pdf"
    return Response(
        content=render_return_pdf(record),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/returns/{return_id}/schedules")
def download_supporting_schedule(
    return_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> Response:
    record = _get_tax_return(db, membership.business_id, return_id)
    filename = f"{record.tax_type.value}-{record.reporting_period_end.isoformat()}-schedule.csv"
    return Response(
        content=render_supporting_schedule(record),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/adjustments", response_model=list[TaxAdjustmentOut])
def list_tax_adjustments(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    tax_type: TaxType | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TaxAdjustment]:
    query = select(TaxAdjustment).where(
        TaxAdjustment.business_id == membership.business_id
    )
    if tax_type is not None:
        query = query.where(TaxAdjustment.tax_type == tax_type)
    query = (
        query.order_by(TaxAdjustment.period_end.desc(), TaxAdjustment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(query).all())


@router.post(
    "/adjustments", response_model=TaxAdjustmentOut, status_code=status.HTTP_201_CREATED
)
def create_tax_adjustment(
    payload: TaxAdjustmentCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaxAdjustment:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    is_vat_adjustment = payload.category.value.startswith("vat_")
    if is_vat_adjustment != (payload.tax_type == TaxType.vat):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VAT adjustment categories must be used with VAT returns",
        )
    adjustment = TaxAdjustment(
        business_id=membership.business_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment


@router.get("/payments", response_model=list[TaxPaymentOut])
def list_tax_payments(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    tax_type: TaxType | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TaxPayment]:
    query = select(TaxPayment).where(TaxPayment.business_id == membership.business_id)
    if tax_type is not None:
        query = query.where(TaxPayment.tax_type == tax_type)
    query = (
        query.order_by(TaxPayment.payment_date.desc(), TaxPayment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(query).all())


@router.post(
    "/payments", response_model=TaxPaymentOut, status_code=status.HTTP_201_CREATED
)
def create_tax_payment(
    payload: TaxPaymentCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaxPayment:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    payment = TaxPayment(
        business_id=membership.business_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/purchases", response_model=list[PurchaseOut])
def list_purchases(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[Purchase]:
    return list(
        db.scalars(
            select(Purchase)
            .where(Purchase.business_id == membership.business_id)
            .order_by(Purchase.invoice_date.desc(), Purchase.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
    )


@router.post(
    "/purchases", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED
)
def create_purchase(
    payload: PurchaseCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Purchase:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    purchase = Purchase(
        business_id=membership.business_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(purchase)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A purchase with this invoice number already exists",
        ) from None
    db.refresh(purchase)
    return purchase


@router.get("/assets", response_model=list[FixedAssetOut])
def list_fixed_assets(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[FixedAsset]:
    return list(
        db.scalars(
            select(FixedAsset)
            .where(FixedAsset.business_id == membership.business_id)
            .order_by(FixedAsset.acquisition_date.desc(), FixedAsset.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
    )


@router.post(
    "/assets", response_model=FixedAssetOut, status_code=status.HTTP_201_CREATED
)
def create_fixed_asset(
    payload: FixedAssetCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FixedAsset:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    asset = FixedAsset(
        business_id=membership.business_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/filing-portal")
def get_rsl_filing_portal(membership: BusinessMember = Depends(get_membership)) -> dict:
    return {
        "url": RSL_ETAX_PORTAL,
        "channel": "rsl_etax_portal",
        "automated": False,
        "notice": "Khoebo does not submit returns to RSL; open the official portal and complete filing externally.",
    }


@router.post("/returns/{return_id}/filing-handoff")
def handoff_tax_return(
    return_id: uuid.UUID,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    record = _get_tax_return(db, membership.business_id, return_id)
    if record.status != TaxReturnStatus.approved:
        raise HTTPException(status_code=409, detail="Only an approved return can be handed off for external filing")
    filing = TaxFiling(
        business_id=membership.business_id,
        tax_return_id=record.id,
        channel="rsl_etax_portal",
        status="handoff",
        portal_url=RSL_ETAX_PORTAL,
        created_by=user.id,
    )
    db.add(filing)
    db.flush()
    _audit(
        db,
        business_id=membership.business_id,
        tax_return_id=record.id,
        tax_filing_id=filing.id,
        actor_id=user.id,
        action="external_filing_handoff",
        details={"channel": filing.channel, "portal_url": filing.portal_url},
    )
    db.commit()
    db.refresh(filing)
    return {"filing": _serialize_filing(filing), "automated": False, "notice": "Complete filing externally in the RSL portal."}


@router.post("/filings/{filing_id}/confirm", response_model=TaxFilingOut)
def confirm_external_filing(
    filing_id: uuid.UUID,
    payload: TaxFilingCreate,
    membership: BusinessMember = Depends(get_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaxFiling:
    require_roles(membership, MemberRole.owner, MemberRole.admin)
    filing = db.scalar(
        select(TaxFiling).where(
            TaxFiling.id == filing_id,
            TaxFiling.business_id == membership.business_id,
        )
    )
    if filing is None:
        raise _not_found("Filing record not found")
    if filing.status != "handoff":
        raise HTTPException(status_code=409, detail="This filing is already confirmed")
    record = _get_tax_return(db, membership.business_id, filing.tax_return_id)
    now = datetime.now(timezone.utc)
    filing.status = "confirmed"
    filing.external_reference = payload.external_reference
    filing.filed_at = payload.filed_at or now
    filing.confirmed_at = now
    filing.notes = payload.notes
    record.status = TaxReturnStatus.filed
    _audit(
        db,
        business_id=membership.business_id,
        tax_return_id=record.id,
        tax_filing_id=filing.id,
        actor_id=user.id,
        action="external_filing_confirmed",
        details={"external_reference": filing.external_reference, "filed_at": filing.filed_at.isoformat()},
    )
    db.commit()
    db.refresh(filing)
    return filing


@router.get("/filings", response_model=list[TaxFilingOut])
def list_filing_history(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[TaxFiling]:
    return list(
        db.scalars(
            select(TaxFiling)
            .where(TaxFiling.business_id == membership.business_id)
            .order_by(TaxFiling.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
    )


@router.get("/audit-events")
def list_tax_audit_events(
    membership: BusinessMember = Depends(get_membership),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict]:
    events = db.scalars(
        select(TaxAuditEvent)
        .where(TaxAuditEvent.business_id == membership.business_id)
        .order_by(TaxAuditEvent.created_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": str(event.id),
            "action": event.action,
            "tax_return_id": str(event.tax_return_id) if event.tax_return_id else None,
            "tax_filing_id": str(event.tax_filing_id) if event.tax_filing_id else None,
            "actor_id": str(event.actor_id) if event.actor_id else None,
            "details": event.details,
            "created_at": event.created_at.isoformat(),
        }
        for event in events
    ]
