from decimal import Decimal

from fastapi.testclient import TestClient


def _q(value: object) -> Decimal:
    return Decimal(str(value))


def _sale_payload(product_id: str, **overrides) -> dict:
    payload = {
        "items": [{"product_id": product_id, "quantity": "2"}],
        "discount_amount": "5.00",
        "tax_rate": "10",
        "payment_method": "cash",
    }
    payload.update(overrides)
    return payload


def test_sale_posts_inventory_and_double_entry(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, unit_price="10.00", cost_price="4.00", stock_quantity="10")

    response = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json=_sale_payload(product["id"]),
        headers=owner["headers"],
    )
    assert response.status_code == 201, response.text
    sale = response.json()

    assert _q(sale["subtotal"]) == Decimal("20.00")
    assert _q(sale["discount_amount"]) == Decimal("5.00")
    assert _q(sale["tax_amount"]) == Decimal("1.50")
    assert _q(sale["total"]) == Decimal("16.50")
    assert sale["status"] == "completed"
    assert sale["items"][0]["product_name"] == "Widget"

    current = client.get(
        f"/api/v1/businesses/{business['id']}/products/{product['id']}",
        headers=owner["headers"],
    )
    assert _q(current.json()["stock_quantity"]) == Decimal("8")

    sale_day = sale["created_at"][:10]
    trial = client.get(
        f"/api/v1/businesses/{business['id']}/reports/trial-balance?as_of={sale_day}",
        headers=owner["headers"],
    )
    assert trial.status_code == 200
    report = trial.json()
    assert report["balanced"] is True
    balances = {row["code"]: row for row in report["accounts"]}
    assert _q(balances["1000"]["debit"]) == Decimal("16.50")
    assert _q(balances["4000"]["credit"]) == Decimal("20.00")
    assert _q(balances["4010"]["debit"]) == Decimal("5.00")
    assert _q(balances["2200"]["credit"]) == Decimal("1.50")
    assert _q(balances["5000"]["debit"]) == Decimal("8.00")
    assert _q(balances["1200"]["credit"]) == Decimal("8.00")

    income = client.get(
        f"/api/v1/businesses/{business['id']}/reports/income-statement"
        f"?start_date={sale_day}&end_date={sale_day}",
        headers=owner["headers"],
    )
    assert income.status_code == 200
    statement = income.json()
    assert _q(statement["total_revenue"]) == Decimal("15.00")
    assert _q(statement["total_expenses"]) == Decimal("8.00")
    assert _q(statement["net_income"]) == Decimal("7.00")

    movements = client.get(
        f"/api/v1/businesses/{business['id']}/products/{product['id']}/stock-movements",
        headers=owner["headers"],
    )
    assert len(movements.json()) == 1
    assert movements.json()[0]["movement_type"] == "out"


def test_insufficient_stock_rolls_back_entire_sale(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, stock_quantity="10")

    response = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json=_sale_payload(product["id"], items=[{"product_id": product["id"], "quantity": "11"}]),
        headers=owner["headers"],
    )
    assert response.status_code == 400

    sales = client.get(
        f"/api/v1/businesses/{business['id']}/sales", headers=owner["headers"]
    )
    assert sales.json() == []
    entries = client.get(
        f"/api/v1/businesses/{business['id']}/journal-entries", headers=owner["headers"]
    )
    assert entries.json() == []
    current = client.get(
        f"/api/v1/businesses/{business['id']}/products/{product['id']}",
        headers=owner["headers"],
    )
    assert _q(current.json()["stock_quantity"]) == Decimal("10")


def test_sale_validation_errors(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, stock_quantity="10")
    base = f"/api/v1/businesses/{business['id']}/sales"

    too_much_discount = client.post(
        base,
        json=_sale_payload(product["id"], discount_amount="999.00"),
        headers=owner["headers"],
    )
    assert too_much_discount.status_code == 400

    duplicate_items = client.post(
        base,
        json=_sale_payload(
            product["id"],
            items=[
                {"product_id": product["id"], "quantity": "1"},
                {"product_id": product["id"], "quantity": "1"},
            ],
        ),
        headers=owner["headers"],
    )
    assert duplicate_items.status_code == 400

    empty_items = client.post(
        base,
        json=_sale_payload(product["id"], items=[]),
        headers=owner["headers"],
    )
    assert empty_items.status_code == 422

    negative_quantity = client.post(
        base,
        json=_sale_payload(
            product["id"], items=[{"product_id": product["id"], "quantity": "-1"}]
        ),
        headers=owner["headers"],
    )
    assert negative_quantity.status_code == 422

    other_owner = user_factory()
    other_business = business_factory(other_owner)
    foreign_product = product_factory(other_business, other_owner)
    foreign = client.post(
        base,
        json=_sale_payload(foreign_product["id"]),
        headers=owner["headers"],
    )
    assert foreign.status_code == 400


def test_refund_restores_stock_and_reverses_accounting(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, cost_price="4.00", stock_quantity="10")
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json=_sale_payload(product["id"]),
        headers=owner["headers"],
    ).json()

    refund = client.post(
        f"/api/v1/businesses/{business['id']}/sales/{sale['id']}/refund",
        headers=owner["headers"],
    )
    assert refund.status_code == 200, refund.text
    assert refund.json()["status"] == "refunded"
    assert refund.json()["refunded_at"] is not None

    current = client.get(
        f"/api/v1/businesses/{business['id']}/products/{product['id']}",
        headers=owner["headers"],
    )
    assert _q(current.json()["stock_quantity"]) == Decimal("10")

    sale_day = sale["created_at"][:10]
    trial = client.get(
        f"/api/v1/businesses/{business['id']}/reports/trial-balance?as_of={sale_day}",
        headers=owner["headers"],
    ).json()
    assert trial["balanced"] is True
    balances = {row["code"]: row for row in trial["accounts"]}
    assert _q(balances["1000"]["balance"]) == Decimal("0.00")
    assert _q(balances["4000"]["balance"]) == Decimal("0.00")
    assert _q(balances["5000"]["balance"]) == Decimal("0.00")
    assert _q(balances["1200"]["balance"]) == Decimal("0.00")

    again = client.post(
        f"/api/v1/businesses/{business['id']}/sales/{sale['id']}/refund",
        headers=owner["headers"],
    )
    assert again.status_code == 400

    refunded = client.get(
        f"/api/v1/businesses/{business['id']}/sales?status=refunded",
        headers=owner["headers"],
    )
    assert len(refunded.json()) == 1


def test_only_owners_and_admins_can_refund(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    member = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner)
    business_id = business["id"]
    client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )

    sale = client.post(
        f"/api/v1/businesses/{business_id}/sales",
        json=_sale_payload(product["id"]),
        headers=member["headers"],
    )
    assert sale.status_code == 201

    refund = client.post(
        f"/api/v1/businesses/{business_id}/sales/{sale.json()['id']}/refund",
        headers=member["headers"],
    )
    assert refund.status_code == 403


def test_sales_are_isolated_between_businesses(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner)
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json=_sale_payload(product["id"]),
        headers=owner["headers"],
    ).json()

    other_owner = user_factory()
    other_business = business_factory(other_owner)
    response = client.get(
        f"/api/v1/businesses/{other_business['id']}/sales/{sale['id']}",
        headers=other_owner["headers"],
    )
    assert response.status_code == 404
