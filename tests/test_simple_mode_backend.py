import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.models.accounting import Account, JournalEntry, JournalLine
from app.models.enums import EntrySource, TaxpayerType, UiMode
from app.models.inventory import Product
from app.models.tax import TaxProfile
from app.models.user import User
from app.services.tax_rules import ensure_reference_rules


def test_new_users_default_to_simple_and_can_change_mode(client, user_factory):
    user = user_factory()
    me = client.get("/api/v1/auth/me", headers=user["headers"])
    assert me.status_code == 200
    assert me.json()["ui_mode"] == "simple"

    updated = client.patch(
        "/api/v1/users/me",
        json={"ui_mode": "advanced"},
        headers=user["headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["ui_mode"] == "advanced"


def test_amount_only_sale_posts_balanced_cash_revenue_journal(
    client, user_factory, business_factory, db_session
):
    user = user_factory()
    business = business_factory(user)
    response = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={"amount": "125.00", "effective_date": "2026-06-05"},
        headers=user["headers"],
    )
    assert response.status_code == 201, response.text
    sale = response.json()
    assert sale["items"] == []
    assert sale["subtotal"] == "125.00"
    assert sale["entry_source"] == "backdated"
    assert sale["effective_date"] == "2026-06-05"

    entry = db_session.scalar(
        select(JournalEntry).where(
            JournalEntry.business_id == uuid.UUID(business["id"]),
            JournalEntry.reference_type == "sale",
            JournalEntry.reference_id == sale["id"],
        )
    )
    assert entry is not None
    assert entry.entry_date == date(2026, 6, 5)
    lines = db_session.scalars(
        select(JournalLine).where(JournalLine.journal_entry_id == entry.id)
    ).all()
    accounts = {db_session.get(Account, line.account_id).code: line for line in lines}
    assert accounts["1000"].debit == Decimal("125.00")
    assert accounts["4000"].credit == Decimal("125.00")
    assert "5000" not in accounts


def test_effective_date_drives_sales_and_accounting_reports(
    client, user_factory, business_factory
):
    user = user_factory()
    business = business_factory(user)
    headers = user["headers"]
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={"amount": "80.00", "effective_date": "2026-05-01"},
        headers=headers,
    )
    assert sale.status_code == 201

    in_period = client.get(
        f"/api/v1/businesses/{business['id']}/reports/income-statement",
        params={"start_date": "2026-05-01", "end_date": "2026-05-31"},
        headers=headers,
    )
    assert in_period.status_code == 200
    assert in_period.json()["total_revenue"] == "80.00"

    out_of_period = client.get(
        f"/api/v1/businesses/{business['id']}/reports/income-statement",
        params={"start_date": "2026-06-01", "end_date": "2026-06-30"},
        headers=headers,
    )
    assert out_of_period.status_code == 200
    assert out_of_period.json()["total_revenue"] == "0.00"

    listed = client.get(
        f"/api/v1/businesses/{business['id']}/sales",
        params={"start_date": "2026-05-01", "end_date": "2026-05-31"},
        headers=headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_quick_sale_creates_draft_products_and_is_tenant_scoped(
    client, user_factory, business_factory, db_session
):
    user = user_factory()
    business = business_factory(user)
    response = client.post(
        f"/api/v1/businesses/{business['id']}/sales/quick",
        json={
            "amount": "60.00",
            "items_text": "Boss 2, Noodles 2, Coke 3",
            "idempotency_key": "quick-1",
        },
        headers=user["headers"],
    )
    assert response.status_code == 201, response.text
    assert "Quick items:" in response.json()["notes"]
    drafts = db_session.scalars(
        select(Product).where(
            Product.business_id == uuid.UUID(business["id"]), Product.is_draft.is_(True)
        )
    ).all()
    assert {product.name for product in drafts} == {"Boss", "Noodles", "Coke"}

    retry = client.post(
        f"/api/v1/businesses/{business['id']}/sales/quick",
        json={"amount": "60.00", "idempotency_key": "quick-1"},
        headers=user["headers"],
    )
    assert retry.status_code == 201
    assert retry.json()["id"] == response.json()["id"]

    other = user_factory()
    other_business = business_factory(other)
    isolated = client.post(
        f"/api/v1/businesses/{business['id']}/sales/quick",
        json={"amount": "10.00", "idempotency_key": "quick-1"},
        headers=other["headers"],
    )
    assert isolated.status_code == 404


def test_unverified_ui_mode_and_tax_rules_do_not_change_simple_default(
    client, user_factory, business_factory, db_session
):
    user = user_factory()
    business = business_factory(user)
    db_session.add(
        TaxProfile(business_id=uuid.UUID(business["id"]), taxpayer_type=TaxpayerType.company)
    )
    db_session.commit()
    ensure_reference_rules(db_session)
    db_session.commit()
    assert db_session.get(User, uuid.UUID(user["id"])).ui_mode == UiMode.simple
    assert EntrySource.live.value == "live"
