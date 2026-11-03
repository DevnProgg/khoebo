from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient


def _q(value: object) -> Decimal:
    return Decimal(str(value))


def test_analytics_overview(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    business_id = business["id"]

    product_a = product_factory(
        business,
        owner,
        name="Coffee",
        unit_price="20.00",
        cost_price="8.00",
        stock_quantity="50",
        low_stock_threshold="5",
    )
    product_b = product_factory(
        business,
        owner,
        name="Mug",
        unit_price="10.00",
        cost_price="3.00",
        stock_quantity="5",
        low_stock_threshold="5",
    )

    sale = client.post(
        f"/api/v1/businesses/{business_id}/sales",
        json={
            "items": [{"product_id": product_a["id"], "quantity": "2"}],
            "tax_rate": "10",
            "payment_method": "cash",
        },
        headers=owner["headers"],
    )
    assert sale.status_code == 201, sale.text

    expense = client.post(
        f"/api/v1/businesses/{business_id}/expenses",
        json={
            "description": "Milk",
            "amount": "10.00",
            "expense_date": date.today().isoformat(),
        },
        headers=owner["headers"],
    )
    assert expense.status_code == 201

    today = date.today().isoformat()
    response = client.get(
        f"/api/v1/businesses/{business_id}/analytics/overview"
        f"?start_date={today}&end_date={today}",
        headers=owner["headers"],
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert _q(data["revenue"]) == Decimal("40.00")
    assert _q(data["cost_of_goods_sold"]) == Decimal("16.00")
    assert _q(data["gross_profit"]) == Decimal("24.00")
    assert _q(data["expenses"]) == Decimal("10.00")
    assert _q(data["net_profit"]) == Decimal("14.00")
    assert data["sales_count"] == 1
    assert _q(data["average_sale_value"]) == Decimal("40.00")
    assert _q(data["total_discounts"]) == Decimal("0")
    assert _q(data["total_tax_collected"]) == Decimal("4.00")
    assert _q(data["inventory_value"]) == Decimal("399.00")
    assert data["low_stock_count"] == 1
    assert data["top_products"][0]["product_id"] == product_a["id"]
    assert _q(data["top_products"][0]["revenue"]) == Decimal("40.00")
    assert _q(data["top_products"][0]["quantity_sold"]) == Decimal("2")
    assert _q(data["revenue_by_payment_method"]["cash"]) == Decimal("44.00")
    assert len(data["revenue_by_day"]) == 1
    assert _q(data["revenue_by_day"][0]["revenue"]) == Decimal("40.00")

    summary = client.get(
        f"/api/v1/businesses/{business_id}/reports/sales-summary"
        f"?start_date={today}&end_date={today}",
        headers=owner["headers"],
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["total_sales"] == 1
    assert body["completed_sales"] == 1
    assert _q(body["gross_revenue"]) == Decimal("44.00")
    assert _q(body["net_revenue"]) == Decimal("40.00")
    assert _q(body["tax_collected"]) == Decimal("4.00")


def test_analytics_empty_range(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    today = date.today()
    response = client.get(
        f"/api/v1/businesses/{business['id']}/analytics/overview"
        f"?start_date={today.isoformat()}&end_date={today.isoformat()}",
        headers=owner["headers"],
    )
    assert response.status_code == 200
    data = response.json()
    assert _q(data["revenue"]) == Decimal("0")
    assert data["sales_count"] == 0
    assert data["top_products"] == []
    assert data["revenue_by_day"] == []

    invalid = client.get(
        f"/api/v1/businesses/{business['id']}/analytics/overview"
        f"?start_date={today.isoformat()}&end_date={(today - timedelta(days=1)).isoformat()}",
        headers=owner["headers"],
    )
    assert invalid.status_code == 400


def test_refunded_sales_are_excluded_from_performance(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(
        business, owner, unit_price="10.00", cost_price="4.00", stock_quantity="5"
    )
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={"items": [{"product_id": product["id"], "quantity": "1"}]},
        headers=owner["headers"],
    ).json()
    client.post(
        f"/api/v1/businesses/{business['id']}/sales/{sale['id']}/refund",
        headers=owner["headers"],
    )

    today = date.today().isoformat()
    data = client.get(
        f"/api/v1/businesses/{business['id']}/analytics/overview"
        f"?start_date={today}&end_date={today}",
        headers=owner["headers"],
    ).json()
    assert data["sales_count"] == 0
    assert _q(data["revenue"]) == Decimal("0")
    assert _q(data["cost_of_goods_sold"]) == Decimal("0")
