from datetime import date
from decimal import Decimal

from app.models.enums import TaxpayerType
from app.services.accounting import money
from app.services.tax_calendar import clamp_date


def _decimal(value: object, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    return Decimal(str(value))


def _warning(code: str, message: str, severity: str = "warning") -> dict:
    return {"code": code, "message": message, "severity": severity}


def _sum_adjustments(adjustments: list[dict]) -> Decimal:
    return money(sum((_decimal(item["amount"]) for item in adjustments), Decimal("0")))


def calculate_income_tax(
    *,
    taxpayer_type: TaxpayerType | str,
    company_income_category: str,
    net_profit: Decimal,
    adjustments: list[dict],
    rule: dict,
) -> tuple[dict, list[dict]]:
    taxpayer_type = TaxpayerType(taxpayer_type)
    adjustment_total = _sum_adjustments(adjustments)
    taxable_income = money(max(money(net_profit + adjustment_total), Decimal("0")))
    warnings: list[dict] = []
    liability: dict = {
        "tax_type": "income_tax",
        "taxpayer_type": taxpayer_type.value,
        "accounting_profit": money(net_profit),
        "adjustments_total": adjustment_total,
        "taxable_income": taxable_income,
        "tax_before_credits": Decimal("0.00"),
        "credits": Decimal("0.00"),
        "tax": Decimal("0.00"),
        "unrelieved_loss": money(min(net_profit + adjustment_total, Decimal("0"))) * -1,
    }

    if taxpayer_type in (TaxpayerType.sole_trader, TaxpayerType.individual):
        brackets = sorted(rule.get("brackets", []), key=lambda row: _decimal(row["lower"]))
        tax_before_credits = Decimal("0")
        bracket_breakdown = []
        for bracket in brackets:
            lower = _decimal(bracket["lower"])
            upper = _decimal(bracket["upper"]) if bracket.get("upper") is not None else None
            rate = _decimal(bracket["rate"])
            amount_in_band = max(
                min(taxable_income, upper) - lower if upper is not None else taxable_income - lower,
                Decimal("0"),
            )
            tax = amount_in_band * rate
            tax_before_credits += tax
            bracket_breakdown.append(
                {
                    "lower": lower,
                    "upper": upper,
                    "rate": rate,
                    "taxable_amount": money(amount_in_band),
                    "tax": money(tax),
                }
            )
        tax_before_credits = money(tax_before_credits)
        credit = money(_decimal(rule.get("personal_credit"), "0"))
        if rule.get("credit_refundable", False):
            warnings.append(
                _warning(
                    "refundable_personal_credit",
                    "The rule marks the personal credit as refundable; review refund treatment.",
                )
            )
        tax = money(max(tax_before_credits - credit, Decimal("0")))
        liability.update(
            {
                "tax_before_credits": tax_before_credits,
                "credits": credit,
                "tax": tax,
                "brackets": bracket_breakdown,
            }
        )
    elif taxpayer_type in (TaxpayerType.company, TaxpayerType.non_resident_company):
        categories = rule.get("categories", {})
        requested_category = company_income_category or "other"
        selected = categories.get(requested_category)
        if selected is None or taxpayer_type.value not in selected.get("eligible_taxpayer_types", []):
            if requested_category != "other":
                warnings.append(
                    _warning(
                        "company_category_not_eligible",
                        f"Income category {requested_category!r} is not available for {taxpayer_type.value}; other income treatment was used.",
                        "critical",
                    )
                )
            requested_category = "other"
            selected = categories.get("other")
        if selected is None:
            raise ValueError("The selected corporate tax rule does not define an 'other' category")
        rate = _decimal(selected["rate"])
        tax = money(taxable_income * rate)
        liability.update(
            {
                "income_category": requested_category,
                "rate": rate,
                "tax_before_credits": tax,
                "credits": Decimal("0.00"),
                "tax": tax,
            }
        )
    elif taxpayer_type == TaxpayerType.partnership:
        warnings.append(
            _warning(
                "partnership_allocation_required",
                "Partnership income is allocated to partners; this return is informational and does not impose entity-level income tax.",
                "critical",
            )
        )
        liability.update({"informational": True, "tax": Decimal("0.00")})
    else:
        raise ValueError(f"Unsupported income tax taxpayer type: {taxpayer_type.value}")

    return liability, warnings


def calculate_vat(
    *,
    output_tax: Decimal,
    input_tax: Decimal,
    adjustments: list[dict],
    rule: dict,
    vat_registered: bool,
    taxable_turnover: Decimal,
) -> tuple[dict, list[dict]]:
    warnings: list[dict] = []
    output_adjustment = money(
        sum(
            (
                _decimal(item["amount"])
                for item in adjustments
                if item["category"] == "vat_output_adjustment"
            ),
            Decimal("0"),
        )
    )
    input_adjustment = money(
        sum(
            (
                _decimal(item["amount"])
                for item in adjustments
                if item["category"] == "vat_input_adjustment"
            ),
            Decimal("0"),
        )
    )
    ignored = [
        item
        for item in adjustments
        if item["category"] not in ("vat_output_adjustment", "vat_input_adjustment")
    ]
    if ignored:
        warnings.append(
            _warning(
                "vat_adjustments_ignored",
                "Only VAT output and VAT input adjustments are applied to a VAT return.",
            )
        )

    adjusted_output = money(output_tax + output_adjustment)
    adjusted_input = money(input_tax + input_adjustment)
    net_vat = money(adjusted_output - adjusted_input)
    threshold = _decimal(rule.get("registration_threshold"))
    if not vat_registered:
        severity = "critical" if taxable_turnover > threshold else "warning"
        warnings.append(
            _warning(
                "vat_registration_required" if taxable_turnover > threshold else "vat_not_registered",
                "The business is not marked as VAT-registered." ,
                severity,
            )
        )
    if adjusted_input > adjusted_output and not vat_registered:
        warnings.append(
            _warning(
                "refund_without_registration",
                "A VAT refund cannot be claimed unless the business is VAT-registered.",
                "critical",
            )
        )

    liability = {
        "tax_type": "vat",
        "output_tax": adjusted_output,
        "output_adjustment": output_adjustment,
        "input_tax": adjusted_input,
        "input_adjustment": input_adjustment,
        "net_vat": net_vat,
        "tax": money(max(net_vat, Decimal("0"))),
        "refundable": money(max(-net_vat, Decimal("0"))),
        "standard_rate": _decimal(rule.get("standard_rate")),
        "registration_threshold": threshold,
    }
    return liability, warnings


def provisional_schedule(
    *,
    tax_year_start: date,
    tax_year_end: date,
    prior_tax_liability: Decimal | None,
    withholding_credit: Decimal,
    rule: dict,
    payments: list[dict],
) -> tuple[dict, list[dict]]:
    warnings: list[dict] = []
    if prior_tax_liability is None:
        return (
            {
                "available": False,
                "prior_tax_liability": None,
                "withholding_credit": money(withholding_credit),
                "instalments": [],
                "scheduled_total": Decimal("0.00"),
                "paid_total": money(sum((_decimal(p["amount"]) for p in payments), Decimal("0"))),
                "balance_due": None,
            },
            [
                _warning(
                    "prior_year_liability_missing",
                    "Provisional tax cannot be calculated without the prior year's income tax liability.",
                    "critical",
                )
            ],
        )

    base = money(max(prior_tax_liability - withholding_credit, Decimal("0")))
    remaining_payments = money(sum((_decimal(p["amount"]) for p in payments), Decimal("0")))
    instalments = []
    scheduled_total = Decimal("0")
    for item in sorted(rule.get("instalments", []), key=lambda row: int(row["number"])):
        due_month = int(item["due_month"])
        due_day = int(item["due_day"])
        due_year = tax_year_start.year if due_month > tax_year_end.month else tax_year_end.year
        due = clamp_date(due_year, due_month, due_day)
        expected = money(base * _decimal(item["rate_of_prior_liability"]))
        scheduled_total += expected
        paid = money(min(remaining_payments, expected))
        remaining_payments = money(remaining_payments - paid)
        instalments.append(
            {
                "number": int(item["number"]),
                "due_date": due,
                "expected": expected,
                "paid": paid,
                "balance": money(max(expected - paid, Decimal("0"))),
            }
        )
    scheduled_total = money(scheduled_total)
    paid_total = money(sum((item["paid"] for item in instalments), Decimal("0")))
    return (
        {
            "available": True,
            "prior_tax_liability": money(prior_tax_liability),
            "withholding_credit": money(withholding_credit),
            "instalments": instalments,
            "scheduled_total": scheduled_total,
            "paid_total": paid_total,
            "balance_due": money(max(scheduled_total - paid_total, Decimal("0"))),
        },
        warnings,
    )


def reconcile_payments(tax: Decimal, payments: list[dict]) -> dict:
    total = money(sum((_decimal(payment["amount"]) for payment in payments), Decimal("0")))
    return {
        "payments": [
            {
                "id": payment.get("id"),
                "tax_type": payment.get("tax_type"),
                "payment_date": payment.get("payment_date"),
                "amount": money(_decimal(payment["amount"])),
                "reference": payment.get("reference"),
            }
            for payment in payments
        ],
        "total_paid": total,
        "balance_due": money(max(tax - total, Decimal("0"))),
        "refund_due": money(max(total - tax, Decimal("0"))),
    }
