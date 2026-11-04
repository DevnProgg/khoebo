import calendar
from datetime import date, timedelta

from app.models.enums import TaxType


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def clamp_date(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def tax_year_end(year: int, end_month: int, end_day: int) -> date:
    return clamp_date(year, end_month, end_day)


def tax_year_bounds(on_date: date, end_month: int = 3, end_day: int = 31) -> tuple[date, date]:
    candidate = tax_year_end(on_date.year, end_month, end_day)
    if on_date > candidate:
        end = tax_year_end(on_date.year + 1, end_month, end_day)
    else:
        end = candidate
    previous_end = tax_year_end(end.year - 1, end_month, end_day)
    start = previous_end + timedelta(days=1)
    return start, end


def statutory_period(profile, tax_type: TaxType, start: date, end: date) -> tuple[date, date]:
    if tax_type in (TaxType.income_tax, TaxType.provisional):
        end_month = profile.financial_year_end_month if profile is not None else 3
        end_day = profile.financial_year_end_day if profile is not None else 31
        return tax_year_bounds(end, end_month, end_day)
    if tax_type == TaxType.vat:
        return date(start.year, start.month, 1), month_end(end.year, end.month)
    return start, end


def due_date(tax_type: TaxType, statutory_end: date) -> date:
    if tax_type in (TaxType.income_tax, TaxType.provisional):
        year, month = add_months(statutory_end.year, statutory_end.month, 3)
        return month_end(year, month)
    if tax_type == TaxType.vat:
        return statutory_end + timedelta(days=20)
    return statutory_end


def _income_period(profile, start: date, end: date, today: date) -> dict:
    return {
        "label": f"{start.isoformat()} to {end.isoformat()}",
        "reporting_start": start,
        "reporting_end": end,
        "statutory_start": start,
        "statutory_end": end,
        "due_date": due_date(TaxType.income_tax, end),
        "status": "overdue" if due_date(TaxType.income_tax, end) < today else "upcoming",
    }


def _vat_period(end: date, today: date) -> dict:
    start = date(end.year, end.month, 1)
    return {
        "label": end.strftime("%B %Y"),
        "reporting_start": start,
        "reporting_end": end,
        "statutory_start": start,
        "statutory_end": end,
        "due_date": due_date(TaxType.vat, end),
        "status": "overdue" if due_date(TaxType.vat, end) < today else "upcoming",
    }


def _provisional_due_dates(
    start: date, end: date, instalments: list[dict] | None
) -> list[date]:
    if not instalments:
        return []
    result = []
    for item in instalments:
        due_month = int(item["due_month"])
        due_day = int(item["due_day"])
        year = start.year if due_month > end.month else end.year
        result.append(clamp_date(year, due_month, due_day))
    return result


def suggest_reporting_periods(
    profile,
    tax_type: TaxType,
    *,
    count: int = 4,
    today: date | None = None,
    instalments: list[dict] | None = None,
) -> list[dict]:
    today = today or date.today()
    count = max(1, min(count, 24))
    end_month = profile.financial_year_end_month if profile is not None else 3
    end_day = profile.financial_year_end_day if profile is not None else 31

    if tax_type == TaxType.vat:
        cursor = date(today.year, today.month, 1) - timedelta(days=1)
        periods = []
        for _ in range(count):
            end = month_end(cursor.year, cursor.month)
            periods.append(_vat_period(end, today))
            cursor = date(cursor.year, cursor.month, 1) - timedelta(days=1)
        return periods

    current_start, current_end = tax_year_bounds(today, end_month, end_day)
    periods = []
    for offset in range(count):
        end = tax_year_end(current_end.year - offset, end_month, end_day)
        previous_end = tax_year_end(end.year - 1, end_month, end_day)
        start = previous_end + timedelta(days=1)
        if tax_type == TaxType.provisional:
            dues = _provisional_due_dates(start, end, instalments)
            periods.append(
                {
                    "label": f"{start.isoformat()} to {end.isoformat()}",
                    "reporting_start": start,
                    "reporting_end": end,
                    "statutory_start": start,
                    "statutory_end": end,
                    "due_dates": dues,
                    "due_date": dues[-1] if dues else due_date(TaxType.provisional, end),
                    "status": "overdue" if dues and dues[0] < today else "upcoming",
                }
            )
        else:
            periods.append(_income_period(profile, start, end, today))
    return periods
