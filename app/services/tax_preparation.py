import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.enums import TaxpayerType, TaxReturnStatus, TaxType
from app.models.tax import TaxAdjustment, TaxPayment, TaxProfile, TaxReturn
from app.services.accounting import money
from app.services.period_accounting import calculate_period_accounting
from app.services.tax_calculator import (
    calculate_income_tax,
    calculate_vat,
    provisional_schedule,
    reconcile_payments,
)
from app.services.tax_calendar import statutory_period
from app.services.tax_rules import canonical_json, checksum, resolve_rule_set


class TaxPreparationError(ValueError):
    pass


def _decimal(value: object, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    return Decimal(str(value))


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(money(value))
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _warning(code: str, message: str, severity: str = "warning") -> dict:
    return {"code": code, "message": message, "severity": severity}


def _taxpayer_type(profile: TaxProfile | None) -> str:
    return profile.taxpayer_type.value if profile is not None else "unknown"


def _rule_taxpayer_type(profile: TaxProfile | None) -> TaxpayerType | None:
    if profile is None:
        return None
    return profile.taxpayer_type


def _query_adjustments(
    db: Session,
    business_id: uuid.UUID,
    tax_type: TaxType,
    start: date,
    end: date,
) -> list[dict]:
    rows = db.scalars(
        select(TaxAdjustment)
        .where(
            TaxAdjustment.business_id == business_id,
            TaxAdjustment.tax_type == tax_type,
            TaxAdjustment.period_start >= start,
            TaxAdjustment.period_end <= end,
        )
        .order_by(TaxAdjustment.period_start, TaxAdjustment.created_at, TaxAdjustment.id)
    ).all()
    return [
        {
            "id": str(row.id),
            "category": row.category.value,
            "amount": row.amount,
            "description": row.description,
            "reference": row.reference,
            "period_start": row.period_start,
            "period_end": row.period_end,
        }
        for row in rows
    ]


def _query_payments(
    db: Session,
    business_id: uuid.UUID,
    tax_types: list[TaxType],
    start: date,
    end: date,
) -> list[dict]:
    rows = db.scalars(
        select(TaxPayment)
        .where(
            TaxPayment.business_id == business_id,
            TaxPayment.tax_type.in_(tax_types),
            TaxPayment.payment_date >= start,
            TaxPayment.payment_date <= end,
        )
        .order_by(TaxPayment.payment_date, TaxPayment.created_at, TaxPayment.id)
    ).all()
    return [
        {
            "id": str(row.id),
            "tax_type": row.tax_type.value,
            "payment_date": row.payment_date,
            "amount": row.amount,
            "reference": row.reference,
        }
        for row in rows
    ]


def _prior_income_tax_return(
    db: Session, business_id: uuid.UUID, statutory_start: date
) -> TaxReturn | None:
    rows = db.scalars(
        select(TaxReturn)
        .where(
            TaxReturn.business_id == business_id,
            TaxReturn.tax_type == TaxType.income_tax,
            TaxReturn.statutory_period_end < statutory_start,
        )
        .order_by(TaxReturn.statutory_period_end.desc(), TaxReturn.created_at.desc())
        .limit(20)
    ).all()
    for row in rows:
        tax = row.tax_liability.get("tax") if isinstance(row.tax_liability, dict) else None
        if tax is not None:
            return row
    return None


def _rule_payload(rule) -> dict:
    if rule is None:
        return {
            "version": "UNRESOLVED",
            "effective_from": None,
            "effective_to": None,
            "checksum": None,
            "source_ids": [],
        }
    return {
        "version": rule.version,
        "effective_from": rule.effective_from,
        "effective_to": rule.effective_to,
        "checksum": rule.checksum,
        "source_ids": rule.source_ids,
    }


def _validation(
    warnings: list[dict], *, profile_present: bool, rule_present: bool, ledger_balanced: bool, tax_calculated: bool
) -> dict:
    critical = any(item.get("severity") == "critical" for item in warnings)
    return {
        "status": "flagged" if critical or not (profile_present and rule_present and ledger_balanced and tax_calculated) else "validated",
        "profile_present": profile_present,
        "rule_present": rule_present,
        "ledger_balanced": ledger_balanced,
        "tax_calculated": tax_calculated,
        "issues": warnings,
    }


def _income_form(taxpayer_type: str) -> str:
    if taxpayer_type in (TaxpayerType.sole_trader.value, TaxpayerType.individual.value):
        return "S128-I"
    if taxpayer_type in (TaxpayerType.company.value, TaxpayerType.non_resident_company.value):
        return "S128-C"
    if taxpayer_type == TaxpayerType.partnership.value:
        return "S128-P"
    return "INCOME_TAX"


def _return_structure(
    *,
    tax_type: TaxType,
    taxpayer: dict,
    reporting_start: date,
    reporting_end: date,
    statutory_start: date,
    statutory_end: date,
    rule: dict,
    accounting: dict,
    liability: dict | None,
    payment_reconciliation: dict,
    provisional: dict | None,
) -> dict:
    common = {
        "taxpayer": taxpayer,
        "tax_type": tax_type.value,
        "reporting_period": {"start": reporting_start, "end": reporting_end},
        "statutory_period": {"start": statutory_start, "end": statutory_end},
        "rule": rule,
    }
    if tax_type == TaxType.vat:
        accounting_sales = accounting["sales"]
        accounting_purchases = accounting["purchases"]
        lines = [
            {"line": "1", "description": "Taxable sales at standard rate", "amount": None, "mapping_status": "unavailable"},
            {"line": "2", "description": "Taxable sales at reduced rate", "amount": None, "mapping_status": "unavailable"},
            {"line": "3a", "description": "Local zero-rated sales", "amount": None, "mapping_status": "unavailable"},
            {"line": "3b", "description": "Exports", "amount": None, "mapping_status": "unavailable"},
            {"line": "4", "description": "Exempt sales", "amount": None, "mapping_status": "unavailable"},
            {"line": "5", "description": "Output tax", "amount": liability.get("output_tax") if liability else None},
            {"line": "6", "description": "Total sales value", "amount": accounting_sales["net"]},
            {"line": "7a", "description": "Local purchases of goods", "amount": None, "mapping_status": "unavailable"},
            {"line": "7b", "description": "Local purchases of services", "amount": None, "mapping_status": "unavailable"},
            {"line": "8a", "description": "Imported goods", "amount": None, "mapping_status": "unavailable"},
            {"line": "8b", "description": "Imported services", "amount": None, "mapping_status": "unavailable"},
            {"line": "9", "description": "Total purchases value", "amount": accounting_purchases["net"]},
            {"line": "10", "description": "Deductible input VAT", "amount": liability.get("input_tax") if liability else None},
            {"line": "11", "description": "Net VAT payable or refundable", "amount": liability.get("net_vat") if liability else None},
            {"line": "12", "description": "VAT refundable", "amount": liability.get("refundable") if liability else None},
            {"line": "13", "description": "VAT payable", "amount": liability.get("tax") if liability else None},
        ]
        return {**common, "form": "VAT-12", "lines": lines, "payments": payment_reconciliation}
    if tax_type == TaxType.provisional:
        return {
            **common,
            "form": "PROVISIONAL",
            "lines": (provisional or {}).get("instalments", []),
            "provisional": provisional,
            "payments": payment_reconciliation,
        }
    return {
        **common,
        "form": _income_form(taxpayer["taxpayer_type"]),
        "lines": [
            {"line": "accounting_profit", "description": "Accounting net profit", "amount": accounting["net_profit"]},
            {"line": "adjustments", "description": "Tax adjustments", "amount": liability.get("adjustments_total") if liability else None},
            {"line": "taxable_income", "description": "Taxable income", "amount": liability.get("taxable_income") if liability else None},
            {"line": "tax_before_credits", "description": "Tax before credits", "amount": liability.get("tax_before_credits") if liability else None},
            {"line": "credits", "description": "Credits", "amount": liability.get("credits") if liability else None},
            {"line": "tax", "description": "Tax liability", "amount": liability.get("tax") if liability else None},
        ],
        "provisional": provisional,
        "payments": payment_reconciliation,
    }


def prepare_tax_return(
    db: Session,
    *,
    business: Business,
    tax_type: TaxType | str,
    reporting_start: date,
    reporting_end: date,
    created_by: uuid.UUID | None = None,
    persist: bool = True,
) -> dict:
    tax_type = TaxType(tax_type)
    if reporting_start > reporting_end:
        raise TaxPreparationError("reporting_start must be on or before reporting_end")

    profile = db.scalar(select(TaxProfile).where(TaxProfile.business_id == business.id))
    taxpayer_type = _taxpayer_type(profile)
    taxpayer = {
        "business_id": str(business.id),
        "name": business.name,
        "taxpayer_type": taxpayer_type,
        "tax_id_number": profile.tax_id_number if profile else None,
        "vat_number": profile.vat_number if profile else None,
    }
    statutory_start, statutory_end = statutory_period(
        profile, tax_type, reporting_start, reporting_end
    )
    accounting = calculate_period_accounting(
        db, business.id, reporting_start, reporting_end
    )
    warnings = list(accounting["warnings"])

    if profile is None:
        warnings.append(
            _warning(
                "tax_profile_missing",
                "A tax profile is required to determine taxpayer classification and applicable rules.",
                "critical",
            )
        )
    if profile is not None and not profile.resident:
        warnings.append(
            _warning(
                "non_resident_taxpayer",
                "The taxpayer is marked non-resident; treaty and source rules require adviser review.",
                "warning",
            )
        )
    if reporting_start != statutory_start or reporting_end != statutory_end:
        warnings.append(
            _warning(
                "reporting_period_differs",
                "The selected reporting period differs from the statutory tax period.",
                "warning",
            )
        )
    if tax_type == TaxType.vat and (
        reporting_start.year != reporting_end.year
        or reporting_start.month != reporting_end.month
    ):
        warnings.append(
            _warning(
                "vat_multiple_tax_periods",
                "A VAT return must cover one calendar month; the selected period spans multiple months.",
                "critical",
            )
        )

    adjustments = _query_adjustments(
        db, business.id, tax_type, reporting_start, reporting_end
    )
    if tax_type in (TaxType.income_tax, TaxType.provisional):
        payment_start, payment_end = statutory_start, statutory_end
        payment_types = (
            [TaxType.income_tax, TaxType.provisional]
            if tax_type == TaxType.income_tax
            else [TaxType.provisional]
        )
    else:
        payment_start, payment_end = reporting_start, reporting_end
        payment_types = [tax_type]
    payments = _query_payments(
        db, business.id, payment_types, payment_start, payment_end
    )

    rule = resolve_rule_set(
        db,
        tax_type=tax_type,
        taxpayer_type=_rule_taxpayer_type(profile),
        period_start=statutory_start,
        period_end=statutory_end,
    )
    rule_info = _rule_payload(rule)
    if rule is None:
        warnings.append(
            _warning(
                "tax_rule_missing",
                "No verified active tax rule set matches the taxpayer and statutory period.",
                "critical",
            )
        )

    liability: dict | None = None
    provisional: dict | None = None
    tax_value: Decimal | None = None

    if rule is not None and tax_type == TaxType.income_tax:
        try:
            liability, tax_warnings = calculate_income_tax(
                taxpayer_type=taxpayer_type,
                company_income_category=profile.company_income_category if profile else "other",
                net_profit=accounting["net_profit"],
                adjustments=adjustments,
                rule=rule.rules,
            )
            warnings.extend(tax_warnings)
            tax_value = _decimal(liability["tax"])
            if accounting["assets"]["count"] and not any(
                item["category"] == "capital_allowance" for item in adjustments
            ):
                warnings.append(
                    _warning(
                        "capital_allowance_adjustment_missing",
                        "Assets are recorded but no capital allowance adjustment has been supplied.",
                    )
                )
        except ValueError as exc:
            warnings.append(
                _warning("income_tax_calculation_failed", str(exc), "critical")
            )
    elif rule is not None and tax_type == TaxType.vat:
        try:
            liability, tax_warnings = calculate_vat(
                output_tax=accounting["sales"]["output_tax"],
                input_tax=accounting["purchases"]["tax"],
                adjustments=adjustments,
                rule=rule.rules,
                vat_registered=profile.vat_registered if profile else False,
                taxable_turnover=accounting["sales"]["net"],
            )
            warnings.extend(tax_warnings)
            tax_value = _decimal(liability["tax"])
        except ValueError as exc:
            warnings.append(_warning("vat_calculation_failed", str(exc), "critical"))
    elif rule is not None and tax_type == TaxType.provisional:
        provisional_rule = resolve_rule_set(
            db,
            tax_type=TaxType.provisional,
            taxpayer_type=_rule_taxpayer_type(profile),
            period_start=statutory_start,
            period_end=statutory_end,
        )
        if provisional_rule is None:
            warnings.append(
                _warning(
                    "provisional_rule_missing",
                    "No verified provisional tax rule is available for the period.",
                    "critical",
                )
            )
        else:
            prior = _prior_income_tax_return(db, business.id, statutory_start)
            prior_tax = (
                _decimal(prior.tax_liability.get("tax")) if prior is not None and prior.tax_liability.get("tax") is not None else None
            )
            provisional_payments = _query_payments(
                db, business.id, [TaxType.provisional], statutory_start, statutory_end
            )
            provisional, provisional_warnings = provisional_schedule(
                tax_year_start=statutory_start,
                tax_year_end=statutory_end,
                prior_tax_liability=prior_tax,
                withholding_credit=Decimal("0"),
                rule=provisional_rule.rules,
                payments=provisional_payments,
            )
            warnings.extend(provisional_warnings)
            if provisional["available"]:
                tax_value = _decimal(provisional["scheduled_total"])
                liability = {
                    "tax_type": "provisional",
                    "tax": tax_value,
                    "scheduled_total": provisional["scheduled_total"],
                    "prior_tax_liability": provisional["prior_tax_liability"],
                    "withholding_credit": provisional["withholding_credit"],
                }
    elif rule is not None:
        warnings.append(
            _warning(
                "tax_type_not_implemented",
                f"Tax return preparation for {tax_type.value} is not implemented.",
                "critical",
            )
        )

    if tax_type == TaxType.income_tax and liability is not None:
        should_reconcile_provisional = (
            profile is not None
            and (profile.provisional_taxpayer or profile.taxpayer_type in (TaxpayerType.company, TaxpayerType.non_resident_company))
        )
        if should_reconcile_provisional:
            provisional_rule = resolve_rule_set(
                db,
                tax_type=TaxType.provisional,
                taxpayer_type=_rule_taxpayer_type(profile),
                period_start=statutory_start,
                period_end=statutory_end,
            )
            if provisional_rule is None:
                warnings.append(
                    _warning(
                        "provisional_rule_missing",
                        "No verified provisional tax rule is available for the period.",
                    )
                )
            else:
                prior = _prior_income_tax_return(db, business.id, statutory_start)
                prior_tax = (
                    _decimal(prior.tax_liability.get("tax")) if prior is not None and prior.tax_liability.get("tax") is not None else None
                )
                provisional_payments = _query_payments(
                    db, business.id, [TaxType.provisional], statutory_start, statutory_end
                )
                provisional, provisional_warnings = provisional_schedule(
                    tax_year_start=statutory_start,
                    tax_year_end=statutory_end,
                    prior_tax_liability=prior_tax,
                    withholding_credit=Decimal("0"),
                    rule=provisional_rule.rules,
                    payments=provisional_payments,
                )
                for item in provisional_warnings:
                    item["severity"] = "warning"
                warnings.extend(provisional_warnings)

    if tax_value is None:
        payment_reconciliation = {
            "payments": [_json_safe(payment) for payment in payments],
            "total_paid": _json_safe(
                money(sum((_decimal(payment["amount"]) for payment in payments), Decimal("0")))
            ),
            "balance_due": None,
            "refund_due": None,
        }
    else:
        payment_reconciliation = reconcile_payments(tax_value, payments)

    validation = _validation(
        warnings,
        profile_present=profile is not None,
        rule_present=rule is not None,
        ledger_balanced=accounting["ledger"]["balanced"],
        tax_calculated=tax_value is not None,
    )

    structure = _return_structure(
        tax_type=tax_type,
        taxpayer=taxpayer,
        reporting_start=reporting_start,
        reporting_end=reporting_end,
        statutory_start=statutory_start,
        statutory_end=statutory_end,
        rule=rule_info,
        accounting=accounting,
        liability=liability,
        payment_reconciliation=payment_reconciliation,
        provisional=provisional,
    )

    accounting_for_hash = {
        key: value for key, value in accounting.items() if key != "warnings"
    }
    accounting_for_hash["inventory"] = {
        key: value
        for key, value in accounting["inventory"].items()
        if key != "valuation_date"
    }
    input_payload = {
        "business_id": str(business.id),
        "tax_type": tax_type.value,
        "taxpayer_type": taxpayer_type,
        "reporting_start": reporting_start,
        "reporting_end": reporting_end,
        "statutory_start": statutory_start,
        "statutory_end": statutory_end,
        "rule": rule_info,
        "accounting": accounting_for_hash,
        "adjustments": adjustments,
        "payments": payments,
        "profile": {
            "accounting_basis": profile.accounting_basis if profile else None,
            "vat_registered": profile.vat_registered if profile else None,
            "company_income_category": profile.company_income_category if profile else None,
            "resident": profile.resident if profile else None,
        },
    }
    input_hash = checksum(input_payload)
    calculation_payload = {
        "input_hash": input_hash,
        "liability": liability,
        "provisional": provisional,
        "payments": payment_reconciliation,
        "validation": validation,
        "structure": structure,
    }
    calculation_hash = checksum(calculation_payload)

    payload = {
        "id": None,
        "taxpayer": taxpayer,
        "tax_type": tax_type.value,
        "taxpayer_type": taxpayer_type,
        "reporting_period": {
            "start": reporting_start.isoformat(),
            "end": reporting_end.isoformat(),
        },
        "statutory_period": {
            "start": statutory_start.isoformat(),
            "end": statutory_end.isoformat(),
        },
        "rule": _json_safe(rule_info),
        "rule_set_id": str(rule.id) if rule is not None else None,
        "rule_version": rule_info["version"],
        "status": validation["status"],
        "accounting_figures": _json_safe(accounting),
        "tax_adjustments": _json_safe(adjustments),
        "tax_liability": _json_safe(liability) if liability is not None else {},
        "payments_and_credits": _json_safe(payment_reconciliation),
        "warnings": _json_safe(warnings),
        "validation": _json_safe(validation),
        "return_structure": _json_safe(structure),
        "input_hash": input_hash,
        "calculation_hash": calculation_hash,
    }

    if not persist:
        return payload

    record = TaxReturn(
        business_id=business.id,
        tax_type=tax_type,
        taxpayer_type=taxpayer_type,
        reporting_period_start=reporting_start,
        reporting_period_end=reporting_end,
        statutory_period_start=statutory_start,
        statutory_period_end=statutory_end,
        rule_set_id=rule.id if rule is not None else None,
        rule_version=rule_info["version"],
        status=TaxReturnStatus(validation["status"]),
        accounting_figures=payload["accounting_figures"],
        tax_adjustments=payload["tax_adjustments"],
        tax_liability=payload["tax_liability"],
        payments_and_credits=payload["payments_and_credits"],
        warnings=payload["warnings"],
        validation=payload["validation"],
        return_structure=payload["return_structure"],
        input_hash=input_hash,
        calculation_hash=calculation_hash,
        created_by=created_by,
    )
    db.add(record)
    db.flush()
    payload["id"] = str(record.id)
    return payload


def serialize_tax_return(record: TaxReturn) -> dict:
    return {
        "id": str(record.id),
        "taxpayer": record.return_structure.get("taxpayer", {}),
        "tax_type": record.tax_type.value,
        "taxpayer_type": record.taxpayer_type,
        "reporting_period": {
            "start": record.reporting_period_start.isoformat(),
            "end": record.reporting_period_end.isoformat(),
        },
        "statutory_period": {
            "start": record.statutory_period_start.isoformat(),
            "end": record.statutory_period_end.isoformat(),
        },
        "rule": record.return_structure.get("rule", {}),
        "rule_set_id": str(record.rule_set_id) if record.rule_set_id else None,
        "rule_version": record.rule_version,
        "status": record.status.value,
        "accounting_figures": record.accounting_figures,
        "tax_adjustments": record.tax_adjustments,
        "tax_liability": record.tax_liability,
        "payments_and_credits": record.payments_and_credits,
        "warnings": record.warnings,
        "validation": record.validation,
        "return_structure": record.return_structure,
        "input_hash": record.input_hash,
        "calculation_hash": record.calculation_hash,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
