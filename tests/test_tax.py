from sqlalchemy import select
import pytest
import uuid
from datetime import date, timedelta
from decimal import Decimal
from fastapi import status

from app.models.enums import TaxpayerType, TaxType, TaxAdjustmentCategory
from app.services.tax_rules import ensure_reference_rules

def test_tax_profile_upsert(client, user_factory, business_factory):
    user = user_factory()
    business = business_factory(user)
    headers = user["headers"]
    b_id = business["id"]

    payload = {
        "taxpayer_type": "company",
        "tax_id_number": "TIN123",
        "vat_registered": True,
        "company_income_category": "manufacturing",
    }
    
    # Create
    resp = client.put(f"/api/v1/businesses/{b_id}/tax/profile", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["taxpayer_type"] == "company"
    assert data["tax_id_number"] == "TIN123"
    assert data["vat_registered"] is True
    assert data["company_income_category"] == "manufacturing"

    # Update
    payload["tax_id_number"] = "TIN456"
    resp = client.put(f"/api/v1/businesses/{b_id}/tax/profile", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["tax_id_number"] == "TIN456"

def test_suggest_reporting_periods(client, user_factory, business_factory, db_session):
    user = user_factory()
    business = business_factory(user)
    headers = user["headers"]
    b_id = business["id"]
    
    # Must have profile for meaningful periods
    from app.models.tax import TaxProfile
    profile = TaxProfile(
        business_id=uuid.UUID(b_id),
        taxpayer_type=TaxpayerType.company,
        financial_year_end_month=3,
        financial_year_end_day=31,
    )
    db_session.add(profile)
    db_session.commit()

    # Income tax periods
    resp = client.get(
        f"/api/v1/businesses/{b_id}/tax/periods?tax_type=income_tax", 
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "periods" in data
    assert len(data["periods"]) > 0
    assert "reporting_start" in data["periods"][0]

    # Provisional periods
    resp = client.get(
        f"/api/v1/businesses/{b_id}/tax/periods?tax_type=provisional", 
        headers=headers
    )
    assert resp.status_code == 200
    assert "periods" in resp.json()

def test_tax_return_flow_income_tax(client, user_factory, business_factory, db_session):
    user = user_factory()
    business = business_factory(user)
    headers = user["headers"]
    b_id = business["id"]

    # 1. Setup Profile
    from app.models.tax import TaxProfile
    profile = TaxProfile(
        business_id=uuid.UUID(b_id),
        taxpayer_type=TaxpayerType.company,
        company_income_category="other",
        resident=True,
    )
    db_session.add(profile)
    db_session.commit()
    
    # Ensure reference rules are in DB for tests
    ensure_reference_rules(db_session)
    db_session.commit()

    # 2. Create some accounting data
    # Using raw DB for speed, matching la.py logic
    from app.models.accounting import Account, JournalEntry, JournalLine
    acc_rev = db_session.scalar(
        select(Account).where(Account.business_id == uuid.UUID(b_id), Account.code == "4000")
    )
    acc_exp = db_session.scalar(
        select(Account).where(Account.business_id == uuid.UUID(b_id), Account.code == "5100")
    )
    
    entry_date = date(2026, 6, 1)
    entry = JournalEntry(
        business_id=uuid.UUID(b_id),
        entry_date=entry_date,
        memo="Test Data",
    )
    db_session.add(entry)
    db_session.flush()
    
    # Revenue 100,000; Expense 40,000 -> Profit 60,000
    db_session.add(JournalLine(journal_entry_id=entry.id, account_id=acc_rev.id, credit=Decimal("100000.00"), debit=0))
    db_session.add(JournalLine(journal_entry_id=entry.id, account_id=acc_exp.id, debit=Decimal("40000.00"), credit=0))
    # Balance with cash
    acc_cash = db_session.scalar(select(Account).where(Account.business_id == uuid.UUID(b_id), Account.code == "1000"))
    db_session.add(JournalLine(journal_entry_id=entry.id, account_id=acc_cash.id, debit=Decimal("60000.00"), credit=0))
    db_session.commit()

    # 3. Preview Return
    payload = {
        "tax_type": "income_tax",
        "reporting_start": "2026-04-01",
        "reporting_end": "2027-03-31",
    }
    resp = client.post(f"/api/v1/businesses/{b_id}/tax/returns/preview", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    
    # 60k profit * 25% (company other) = 15k tax
    assert Decimal(str(data["tax_liability"]["tax"])) == Decimal("15000.00")
    assert data["validation"]["status"] == "validated"
    
    # 4. Create Return
    resp = client.post(f"/api/v1/businesses/{b_id}/tax/returns", json=payload, headers=headers)
    assert resp.status_code == 201
    return_id = resp.json()["id"]
    
    # 5. Verify Persistence
    resp = client.get(f"/api/v1/businesses/{b_id}/tax/returns/{return_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["tax_liability"]["tax"] == "15000.00"

def test_tax_return_deterministic(client, user_factory, business_factory, db_session):
    user = user_factory()
    business = business_factory(user)
    headers = user["headers"]
    b_id = business["id"]

    from app.models.tax import TaxProfile
    profile = TaxProfile(
        business_id=uuid.UUID(b_id),
        taxpayer_type=TaxpayerType.company,
    )
    db_session.add(profile)
    db_session.commit()
    ensure_reference_rules(db_session)
    db_session.commit()

    payload = {
        "tax_type": "income_tax",
        "reporting_start": "2026-04-01",
        "reporting_end": "2027-03-31",
    }
    
    resp1 = client.post(f"/api/v1/businesses/{b_id}/tax/returns/preview", json=payload, headers=headers)
    hash1 = resp1.json()["calculation_hash"]
    
    resp2 = client.post(f"/api/v1/businesses/{b_id}/tax/returns/preview", json=payload, headers=headers)
    hash2 = resp2.json()["calculation_hash"]
    
    assert hash1 == hash2

def test_vat_return_flow(client, user_factory, business_factory, db_session):
    user = user_factory()
    business = business_factory(user)
    headers = user["headers"]
    b_id = business["id"]

    from app.models.tax import TaxProfile
    profile = TaxProfile(
        business_id=uuid.UUID(b_id),
        taxpayer_type=TaxpayerType.company,
        vat_registered=True,
    )
    db_session.add(profile)
    db_session.commit()
    ensure_reference_rules(db_session)
    db_session.commit()

    # VAT Sales: 1000 net + 150 tax = 1150 total
    from app.models.tax import Purchase
    # We simulate VAT via Purchases model for simplicity in test if we want input tax
    # and using a manual JournalEntry for output tax since sales logic is complex
    from app.models.accounting import Account, JournalEntry, JournalLine
    acc_tax = db_session.scalar(select(Account).where(Account.business_id == uuid.UUID(b_id), Account.code == "2200"))
    
    entry = JournalEntry(business_id=uuid.UUID(b_id), entry_date=date(2026, 6, 1), memo="VAT Sale")
    db_session.add(entry)
    db_session.flush()
    db_session.add(JournalLine(journal_entry_id=entry.id, account_id=acc_tax.id, credit=Decimal("150.00"), debit=0))
    # Balancing...
    acc_rev = db_session.scalar(select(Account).where(Account.business_id == uuid.UUID(b_id), Account.code == "4000"))
    db_session.add(JournalLine(journal_entry_id=entry.id, account_id=acc_rev.id, debit=Decimal("150.00"), credit=0)) # Simplified
    db_session.commit()
    
    # Input tax from purchase
    purchase = Purchase(
        business_id=uuid.UUID(b_id),
        invoice_date=date(2026, 6, 1),
        net_amount=Decimal("500.00"),
        tax_amount=Decimal("75.00"),
        total_amount=Decimal("575.00"),
    )
    db_session.add(purchase)
    db_session.commit()

    payload = {
        "tax_type": "vat",
        "reporting_start": "2026-06-01",
        "reporting_end": "2026-06-30",
    }
    resp = client.post(f"/api/v1/businesses/{b_id}/tax/returns/preview", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    
    # Output 150 - Input 75 = 75 Net
    assert Decimal(str(data["tax_liability"]["net_vat"])) == Decimal("75.00")
    assert Decimal(str(data["tax_liability"]["tax"])) == Decimal("75.00")
