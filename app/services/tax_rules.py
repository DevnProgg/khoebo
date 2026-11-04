import hashlib
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.enums import TaxpayerType, TaxType
from app.models.tax import TaxRuleSet

REFERENCE_PATH = Path(__file__).resolve().parents[1] / "tax_rules" / "lesotho_reference.json"


def _json_default(value: Any) -> str:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        default=_json_default,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def checksum(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def load_reference_rules() -> list[dict]:
    with REFERENCE_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload["rules"]


def ensure_reference_rules(db: Session) -> int:
    created = 0
    for item in load_reference_rules():
        existing = db.scalar(
            select(TaxRuleSet.id).where(
                TaxRuleSet.jurisdiction == item.get("jurisdiction", "LS"),
                TaxRuleSet.tax_type == TaxType(item["tax_type"]),
                TaxRuleSet.version == item["version"],
            )
        )
        if existing is not None:
            continue
        taxpayer_type = (
            TaxpayerType(item["taxpayer_type"]) if item.get("taxpayer_type") else None
        )
        rule = TaxRuleSet(
            jurisdiction=item.get("jurisdiction", "LS"),
            tax_type=TaxType(item["tax_type"]),
            taxpayer_type=taxpayer_type,
            version=item["version"],
            effective_from=date.fromisoformat(item["effective_from"]),
            effective_to=date.fromisoformat(item["effective_to"]) if item.get("effective_to") else None,
            status=item.get("status", "active"),
            source_ids=item.get("source_ids", []),
            rules=item["rules"],
            checksum=checksum(item["rules"]),
        )
        db.add(rule)
        created += 1
    if created:
        db.flush()
    return created


def _resolved_taxpayer_type(taxpayer_type: TaxpayerType | str | None) -> TaxpayerType | None:
    if taxpayer_type is None:
        return None
    if isinstance(taxpayer_type, str):
        taxpayer_type = TaxpayerType(taxpayer_type)
    if taxpayer_type == TaxpayerType.sole_trader:
        return TaxpayerType.individual
    if taxpayer_type in (TaxpayerType.company, TaxpayerType.non_resident_company):
        return TaxpayerType.company
    return taxpayer_type


def resolve_rule_set(
    db: Session,
    *,
    tax_type: TaxType | str,
    taxpayer_type: TaxpayerType | str | None,
    period_start: date,
    period_end: date,
) -> TaxRuleSet | None:
    if isinstance(tax_type, str):
        tax_type = TaxType(tax_type)
    ensure_reference_rules(db)
    resolved_type = _resolved_taxpayer_type(taxpayer_type)
    conditions = [
        TaxRuleSet.jurisdiction == "LS",
        TaxRuleSet.tax_type == tax_type,
        TaxRuleSet.status == "active",
        TaxRuleSet.effective_from <= period_start,
        or_(TaxRuleSet.effective_to.is_(None), TaxRuleSet.effective_to >= period_end),
    ]
    if resolved_type is None:
        conditions.append(TaxRuleSet.taxpayer_type.is_(None))
    else:
        conditions.append(
            or_(
                TaxRuleSet.taxpayer_type == resolved_type,
                TaxRuleSet.taxpayer_type.is_(None),
            )
        )
    return db.scalar(
        select(TaxRuleSet)
        .where(*conditions)
        .order_by(TaxRuleSet.effective_from.desc(), TaxRuleSet.version.desc())
        .limit(1)
    )
