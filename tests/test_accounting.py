from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient


def _q(value: object) -> Decimal:
    return Decimal(str(value))


def _accounts(client: TestClient, business: dict, user: dict) -> dict[str, dict]:
    response = client.get(
        f"/api/v1/businesses/{business['id']}/accounts", headers=user["headers"]
    )
    assert response.status_code == 200
    return {row["code"]: row for row in response.json()}


def test_manual_journal_entry_and_trial_balance(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    accounts = _accounts(client, business, owner)

    response = client.post(
        f"/api/v1/businesses/{business['id']}/journal-entries",
        json={
            "entry_date": date.today().isoformat(),
            "memo": "Owner capital",
            "lines": [
                {"account_id": accounts["1000"]["id"], "debit": "100.00"},
                {"account_id": accounts["3000"]["id"], "credit": "100.00"},
            ],
        },
        headers=owner["headers"],
    )
    assert response.status_code == 201, response.text
    entry = response.json()
    assert len(entry["lines"]) == 2

    trial = client.get(
        f"/api/v1/businesses/{business['id']}/reports/trial-balance",
        headers=owner["headers"],
    ).json()
    assert trial["balanced"] is True
    assert _q(trial["total_debit"]) == _q(trial["total_credit"])
    balances = {row["code"]: row for row in trial["accounts"]}
    assert _q(balances["1000"]["debit"]) == Decimal("100.00")
    assert _q(balances["3000"]["credit"]) == Decimal("100.00")


def test_unbalanced_and_invalid_journal_entries_are_rejected(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    accounts = _accounts(client, business, owner)

    unbalanced = client.post(
        f"/api/v1/businesses/{business['id']}/journal-entries",
        json={
            "entry_date": date.today().isoformat(),
            "memo": "Bad entry",
            "lines": [
                {"account_id": accounts["1000"]["id"], "debit": "100.00"},
                {"account_id": accounts["4000"]["id"], "credit": "90.00"},
            ],
        },
        headers=owner["headers"],
    )
    assert unbalanced.status_code == 400

    both_sides = client.post(
        f"/api/v1/businesses/{business['id']}/journal-entries",
        json={
            "entry_date": date.today().isoformat(),
            "memo": "Bad line",
            "lines": [
                {
                    "account_id": accounts["1000"]["id"],
                    "debit": "100.00",
                    "credit": "100.00",
                },
                {"account_id": accounts["4000"]["id"], "credit": "100.00"},
            ],
        },
        headers=owner["headers"],
    )
    assert both_sides.status_code == 422

    zero_line = client.post(
        f"/api/v1/businesses/{business['id']}/journal-entries",
        json={
            "entry_date": date.today().isoformat(),
            "memo": "Zero line",
            "lines": [
                {"account_id": accounts["1000"]["id"], "debit": "0"},
                {"account_id": accounts["4000"]["id"], "credit": "0"},
            ],
        },
        headers=owner["headers"],
    )
    assert zero_line.status_code == 422

    entries = client.get(
        f"/api/v1/businesses/{business['id']}/journal-entries",
        headers=owner["headers"],
    )
    assert entries.json() == []


def test_journal_entries_cannot_use_another_business_account(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    own_accounts = _accounts(client, business, owner)

    other_owner = user_factory()
    other_business = business_factory(other_owner)
    other_accounts = _accounts(client, other_business, other_owner)

    response = client.post(
        f"/api/v1/businesses/{business['id']}/journal-entries",
        json={
            "entry_date": date.today().isoformat(),
            "memo": "Cross tenant",
            "lines": [
                {"account_id": own_accounts["1000"]["id"], "debit": "50.00"},
                {"account_id": other_accounts["4000"]["id"], "credit": "50.00"},
            ],
        },
        headers=owner["headers"],
    )
    assert response.status_code == 400


def test_expense_posts_double_entry_and_income_statement(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    today = date.today()

    response = client.post(
        f"/api/v1/businesses/{business['id']}/expenses",
        json={
            "description": "Office supplies",
            "amount": "25.50",
            "expense_date": today.isoformat(),
            "payment_method": "cash",
        },
        headers=owner["headers"],
    )
    assert response.status_code == 201, response.text
    expense = response.json()
    assert expense["journal_entry_id"] is not None

    statement = client.get(
        f"/api/v1/businesses/{business['id']}/reports/income-statement"
        f"?start_date={today.isoformat()}&end_date={today.isoformat()}",
        headers=owner["headers"],
    ).json()
    assert _q(statement["total_revenue"]) == Decimal("0")
    assert _q(statement["total_expenses"]) == Decimal("25.50")
    assert _q(statement["net_income"]) == Decimal("-25.50")

    trial = client.get(
        f"/api/v1/businesses/{business['id']}/reports/trial-balance",
        headers=owner["headers"],
    ).json()
    assert trial["balanced"] is True
    balances = {row["code"]: row for row in trial["accounts"]}
    assert _q(balances["5100"]["debit"]) == Decimal("25.50")
    assert _q(balances["1000"]["credit"]) == Decimal("25.50")


def test_custom_expense_account_and_duplicate_code(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    accounts = _accounts(client, business, owner)

    duplicate = client.post(
        f"/api/v1/businesses/{business['id']}/accounts",
        json={"code": "1000", "name": "Duplicate cash", "type": "asset"},
        headers=owner["headers"],
    )
    assert duplicate.status_code == 409

    custom = client.post(
        f"/api/v1/businesses/{business['id']}/accounts",
        json={"code": "5700", "name": "Travel", "type": "expense"},
        headers=owner["headers"],
    )
    assert custom.status_code == 201

    expense = client.post(
        f"/api/v1/businesses/{business['id']}/expenses",
        json={
            "description": "Taxi",
            "amount": "10.00",
            "expense_date": date.today().isoformat(),
            "account_id": custom.json()["id"],
        },
        headers=owner["headers"],
    )
    assert expense.status_code == 201
    assert expense.json()["account_id"] == custom.json()["id"]
    assert custom.json()["code"] == "5700"


def test_expense_requires_an_expense_account(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    accounts = _accounts(client, business, owner)

    response = client.post(
        f"/api/v1/businesses/{business['id']}/expenses",
        json={
            "description": "Wrong account",
            "amount": "10.00",
            "expense_date": date.today().isoformat(),
            "account_id": accounts["1000"]["id"],
        },
        headers=owner["headers"],
    )
    assert response.status_code == 400


def test_expense_account_must_belong_to_business(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)

    other_owner = user_factory()
    other_business = business_factory(other_owner)
    other_accounts = _accounts(client, other_business, other_owner)

    response = client.post(
        f"/api/v1/businesses/{business['id']}/expenses",
        json={
            "description": "Nope",
            "amount": "10.00",
            "expense_date": date.today().isoformat(),
            "account_id": other_accounts["5100"]["id"],
        },
        headers=owner["headers"],
    )
    assert response.status_code == 400
