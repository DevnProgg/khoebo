import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.models.accounting import Account, JournalEntry, JournalLine
from app.models.enums import TaxpayerType
from app.models.tax import TaxProfile
from app.services.tax_rules import ensure_reference_rules


def _seed_company_ledger(db_session, business_id: str) -> None:
    account = lambda code: db_session.scalar(
        select(Account).where(Account.business_id == uuid.UUID(business_id), Account.code == code)
    )
    revenue = account("4000")
    expense = account("5100")
    cash = account("1000")
    entry = JournalEntry(
        business_id=uuid.UUID(business_id),
        entry_date=date(2026, 6, 1),
        memo="Synthetic integration ledger",
    )
    db_session.add(entry)
    db_session.flush()
    db_session.add_all(
        [
            JournalLine(journal_entry_id=entry.id, account_id=revenue.id, credit=Decimal("100000.00"), debit=0),
            JournalLine(journal_entry_id=entry.id, account_id=expense.id, debit=Decimal("40000.00"), credit=0),
            JournalLine(journal_entry_id=entry.id, account_id=cash.id, debit=Decimal("60000.00"), credit=0),
        ]
    )
    db_session.commit()


def test_tax_workflow_pdf_external_filing_and_audit(
    client, user_factory, business_factory, db_session
):
    user = user_factory()
    business = business_factory(user, name="Synthetic Lesotho Company")
    headers = user["headers"]
    business_id = business["id"]
    db_session.add(
        TaxProfile(
            business_id=uuid.UUID(business_id),
            taxpayer_type=TaxpayerType.company,
            tax_id_number="TIN-SYNTHETIC",
            company_income_category="other",
        )
    )
    db_session.commit()
    ensure_reference_rules(db_session)
    db_session.commit()
    _seed_company_ledger(db_session, business_id)

    summary = client.get(
        f"/api/v1/businesses/{business_id}/tax/summaries",
        params={"start": "2026-04-01", "end": "2027-03-31"},
        headers=headers,
    )
    assert summary.status_code == 200
    assert summary.json()["revenue"] == "100000.00"
    assert summary.json()["net_profit"] == "60000.00"

    calculation = client.get(
        f"/api/v1/businesses/{business_id}/tax/calculations",
        params={
            "tax_type": "income_tax",
            "start": "2026-04-01",
            "end": "2027-03-31",
        },
        headers=headers,
    )
    assert calculation.status_code == 200
    assert calculation.json()["tax_liability"]["tax"] == "15000.00"
    assert calculation.json()["rule_version"] == "LS-CIT-2026.1"

    create = client.post(
        f"/api/v1/businesses/{business_id}/tax/returns",
        json={
            "tax_type": "income_tax",
            "reporting_start": "2026-04-01",
            "reporting_end": "2027-03-31",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    tax_return = create.json()
    return_id = tax_return["id"]
    assert tax_return["reporting_period"] == {"start": "2026-04-01", "end": "2027-03-31"}
    assert tax_return["rule_version"] == "LS-CIT-2026.1"

    pdf = client.get(
        f"/api/v1/businesses/{business_id}/tax/returns/{return_id}/pdf",
        headers=headers,
    )
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF-1.4")
    assert b"LS-CIT-2026.1" in pdf.content

    schedule = client.get(
        f"/api/v1/businesses/{business_id}/tax/returns/{return_id}/schedules",
        headers=headers,
    )
    assert schedule.status_code == 200
    assert "rule,version,LS-CIT-2026.1" in schedule.text

    validated = client.post(
        f"/api/v1/businesses/{business_id}/tax/returns/{return_id}/validate",
        headers=headers,
    )
    assert validated.status_code == 200
    assert validated.json()["status"] == "validated"

    approved = client.post(
        f"/api/v1/businesses/{business_id}/tax/returns/{return_id}/approve",
        headers=headers,
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    portal = client.get(
        f"/api/v1/businesses/{business_id}/tax/filing-portal", headers=headers
    )
    assert portal.status_code == 200
    assert portal.json()["automated"] is False

    handoff = client.post(
        f"/api/v1/businesses/{business_id}/tax/returns/{return_id}/filing-handoff",
        headers=headers,
    )
    assert handoff.status_code == 200, handoff.text
    filing_id = handoff.json()["filing"]["id"]
    assert handoff.json()["filing"]["status"] == "handoff"

    confirmed = client.post(
        f"/api/v1/businesses/{business_id}/tax/filings/{filing_id}/confirm",
        json={"external_reference": "RSL-EXT-123", "notes": "Confirmed in portal"},
        headers=headers,
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"

    final_return = client.get(
        f"/api/v1/businesses/{business_id}/tax/returns/{return_id}", headers=headers
    )
    assert final_return.status_code == 200
    assert final_return.json()["status"] == "filed"

    history = client.get(
        f"/api/v1/businesses/{business_id}/tax/filings", headers=headers
    )
    assert history.status_code == 200
    assert history.json()[0]["external_reference"] == "RSL-EXT-123"

    audit = client.get(
        f"/api/v1/businesses/{business_id}/tax/audit-events", headers=headers
    )
    assert audit.status_code == 200
    actions = {event["action"] for event in audit.json()}
    assert {"validated", "approved", "external_filing_handoff", "external_filing_confirmed"} <= actions


def test_tax_integration_enforces_business_isolation(
    client, user_factory, business_factory
):
    first_user = user_factory()
    first_business = business_factory(first_user)
    second_user = user_factory()
    second_business = business_factory(second_user)

    response = client.get(
        f"/api/v1/businesses/{first_business['id']}/tax/filing-portal",
        headers=second_user["headers"],
    )
    assert response.status_code == 404

    response = client.get(
        f"/api/v1/businesses/{second_business['id']}/tax/summaries",
        params={"start": "2026-04-01", "end": "2026-04-30"},
        headers=first_user["headers"],
    )
    assert response.status_code == 404


def test_tax_return_missing_profile_is_flagged_and_not_approvable(
    client, user_factory, business_factory
):
    user = user_factory()
    business = business_factory(user)
    response = client.post(
        f"/api/v1/businesses/{business['id']}/tax/returns",
        json={
            "tax_type": "income_tax",
            "reporting_start": "2026-04-01",
            "reporting_end": "2027-03-31",
        },
        headers=user["headers"],
    )
    assert response.status_code == 201
    tax_return = response.json()
    assert tax_return["status"] == "flagged"
    assert any(item["code"] == "tax_profile_missing" for item in tax_return["warnings"])

    approval = client.post(
        f"/api/v1/businesses/{business['id']}/tax/returns/{tax_return['id']}/approve",
        headers=user["headers"],
    )
    assert approval.status_code == 409


def test_unverified_tax_rule_is_flagged_and_not_approvable(
    client, user_factory, business_factory, db_session
):
    user = user_factory()
    business = business_factory(user)
    db_session.add(
        TaxProfile(
            business_id=uuid.UUID(business["id"]),
            taxpayer_type=TaxpayerType.company,
        )
    )
    db_session.commit()
    ensure_reference_rules(db_session)
    db_session.commit()

    response = client.post(
        f"/api/v1/businesses/{business['id']}/tax/returns",
        json={
            "tax_type": "wht",
            "reporting_start": "2026-06-01",
            "reporting_end": "2026-06-30",
        },
        headers=user["headers"],
    )
    assert response.status_code == 201
    tax_return = response.json()
    assert tax_return["status"] == "flagged"
    assert tax_return["rule_version"] == "UNRESOLVED"
    assert any(item["code"] == "tax_rule_missing" for item in tax_return["warnings"])

    approval = client.post(
        f"/api/v1/businesses/{business['id']}/tax/returns/{tax_return['id']}/approve",
        headers=user["headers"],
    )
    assert approval.status_code == 409
