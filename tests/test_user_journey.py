from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient


def _q(value: object) -> Decimal:
    return Decimal(str(value))


def test_complete_business_journey(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory(full_name="Owner")
    staff = user_factory(full_name="Staff")
    business = business_factory(owner, name="Khoebo Store")
    business_id = business["id"]

    membership = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": staff["email"], "role": "member"},
        headers=owner["headers"],
    )
    assert membership.status_code == 201

    product = product_factory(
        business,
        owner,
        name="Bread",
        unit_price="10.00",
        cost_price="4.00",
        stock_quantity="5",
        low_stock_threshold="3",
    )

    sale = client.post(
        f"/api/v1/businesses/{business_id}/sales",
        json={
            "items": [{"product_id": product["id"], "quantity": "2"}],
            "tax_rate": "5",
            "payment_method": "card",
            "customer_name": "Walk-in",
        },
        headers=staff["headers"],
    )
    assert sale.status_code == 201, sale.text
    sale = sale.json()

    stock = client.get(
        f"/api/v1/businesses/{business_id}/products/{product['id']}",
        headers=staff["headers"],
    )
    assert _q(stock.json()["stock_quantity"]) == Decimal("3")

    reminder = client.post(
        f"/api/v1/businesses/{business_id}/reminders",
        json={
            "type": "low_stock",
            "title": "Restock bread",
            "frequency": "daily",
            "next_due_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        },
        headers=owner["headers"],
    )
    assert reminder.status_code == 201
    due = client.get(
        f"/api/v1/businesses/{business_id}/reminders/due", headers=owner["headers"]
    ).json()
    assert due[0]["context"]["low_stock_count"] == 1

    expense = client.post(
        f"/api/v1/businesses/{business_id}/expenses",
        json={
            "description": "Flour",
            "amount": "5.00",
            "expense_date": date.today().isoformat(),
        },
        headers=owner["headers"],
    )
    assert expense.status_code == 201

    today = sale["created_at"][:10]
    trial = client.get(
        f"/api/v1/businesses/{business_id}/reports/trial-balance?as_of={today}",
        headers=staff["headers"],
    ).json()
    assert trial["balanced"] is True

    statement = client.get(
        f"/api/v1/businesses/{business_id}/reports/income-statement"
        f"?start_date={today}&end_date={today}",
        headers=owner["headers"],
    ).json()
    assert _q(statement["total_revenue"]) == Decimal("20.00")
    assert _q(statement["total_expenses"]) == Decimal("13.00")
    assert _q(statement["net_income"]) == Decimal("7.00")

    analytics = client.get(
        f"/api/v1/businesses/{business_id}/analytics/overview"
        f"?start_date={today}&end_date={today}",
        headers=owner["headers"],
    ).json()
    assert _q(analytics["revenue"]) == Decimal("20.00")
    assert _q(analytics["gross_profit"]) == Decimal("12.00")
    assert _q(analytics["net_profit"]) == Decimal("7.00")
    assert analytics["low_stock_count"] == 1
    assert _q(analytics["revenue_by_payment_method"]["card"]) == Decimal("21.00")

    refund = client.post(
        f"/api/v1/businesses/{business_id}/sales/{sale['id']}/refund",
        headers=owner["headers"],
    )
    assert refund.status_code == 200
    stock = client.get(
        f"/api/v1/businesses/{business_id}/products/{product['id']}",
        headers=owner["headers"],
    )
    assert _q(stock.json()["stock_quantity"]) == Decimal("5")

    analytics = client.get(
        f"/api/v1/businesses/{business_id}/analytics/overview"
        f"?start_date={today}&end_date={today}",
        headers=owner["headers"],
    ).json()
    assert _q(analytics["revenue"]) == Decimal("0")
    assert _q(analytics["net_profit"]) == Decimal("-5.00")
    assert analytics["low_stock_count"] == 0
