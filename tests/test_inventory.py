from decimal import Decimal

from fastapi.testclient import TestClient


def _q(value: object) -> Decimal:
    return Decimal(str(value))


def test_product_crud_and_sku_uniqueness(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, sku="WIDGET-1")

    duplicate = client.post(
        f"/api/v1/businesses/{business['id']}/products",
        json={"sku": "WIDGET-1", "name": "Duplicate"},
        headers=owner["headers"],
    )
    assert duplicate.status_code == 409

    updated = client.patch(
        f"/api/v1/businesses/{business['id']}/products/{product['id']}",
        json={"name": "Updated Widget", "unit_price": "12.50"},
        headers=owner["headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Widget"
    assert _q(updated.json()["unit_price"]) == Decimal("12.50")

    deleted = client.delete(
        f"/api/v1/businesses/{business['id']}/products/{product['id']}",
        headers=owner["headers"],
    )
    assert deleted.status_code == 204
    listing = client.get(
        f"/api/v1/businesses/{business['id']}/products", headers=owner["headers"]
    )
    assert listing.json() == []
    including_inactive = client.get(
        f"/api/v1/businesses/{business['id']}/products?include_inactive=true",
        headers=owner["headers"],
    )
    assert len(including_inactive.json()) == 1

    other_owner = user_factory()
    other_business = business_factory(other_owner)
    same_sku_other_business = client.post(
        f"/api/v1/businesses/{other_business['id']}/products",
        json={"sku": "WIDGET-1", "name": "Other Widget"},
        headers=other_owner["headers"],
    )
    assert same_sku_other_business.status_code == 201


def test_stock_movements_and_insufficient_stock(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, stock_quantity="10")
    base = f"/api/v1/businesses/{business['id']}/products/{product['id']}"

    stock_in = client.post(
        f"{base}/stock-movements",
        json={"movement_type": "in", "quantity": "5", "reason": "Delivery"},
        headers=owner["headers"],
    )
    assert stock_in.status_code == 201, stock_in.text
    assert _q(stock_in.json()["quantity"]) == Decimal("5")

    stock_out = client.post(
        f"{base}/stock-movements",
        json={"movement_type": "out", "quantity": "3", "reason": "Damaged"},
        headers=owner["headers"],
    )
    assert stock_out.status_code == 201

    insufficient = client.post(
        f"{base}/stock-movements",
        json={"movement_type": "out", "quantity": "100"},
        headers=owner["headers"],
    )
    assert insufficient.status_code == 400

    adjustment = client.post(
        f"{base}/stock-movements",
        json={"movement_type": "adjustment", "quantity": "7", "reason": "Count"},
        headers=owner["headers"],
    )
    assert adjustment.status_code == 201

    negative_adjustment = client.post(
        f"{base}/stock-movements",
        json={"movement_type": "adjustment", "quantity": "-1"},
        headers=owner["headers"],
    )
    assert negative_adjustment.status_code == 400

    current = client.get(base, headers=owner["headers"])
    assert _q(current.json()["stock_quantity"]) == Decimal("7")

    movements = client.get(f"{base}/stock-movements", headers=owner["headers"])
    assert movements.status_code == 200
    assert len(movements.json()) == 3


def test_low_stock_detection(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(
        business, owner, stock_quantity="10", low_stock_threshold="5"
    )
    base = f"/api/v1/businesses/{business['id']}/products/{product['id']}"

    low_stock = client.get(
        f"/api/v1/businesses/{business['id']}/products/low-stock",
        headers=owner["headers"],
    )
    assert low_stock.json() == []

    client.post(
        f"{base}/stock-movements",
        json={"movement_type": "out", "quantity": "6"},
        headers=owner["headers"],
    )

    low_stock = client.get(
        f"/api/v1/businesses/{business['id']}/products/low-stock",
        headers=owner["headers"],
    )
    assert [row["id"] for row in low_stock.json()] == [product["id"]]

    filtered = client.get(
        f"/api/v1/businesses/{business['id']}/products?low_stock_only=true",
        headers=owner["headers"],
    )
    assert [row["id"] for row in filtered.json()] == [product["id"]]

    no_threshold = product_factory(
        business, owner, stock_quantity="0", low_stock_threshold="0"
    )
    low_stock = client.get(
        f"/api/v1/businesses/{business['id']}/products/low-stock",
        headers=owner["headers"],
    )
    assert no_threshold["id"] not in [row["id"] for row in low_stock.json()]


def test_member_can_adjust_stock_but_not_manage_products(
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

    movement = client.post(
        f"/api/v1/businesses/{business_id}/products/{product['id']}/stock-movements",
        json={"movement_type": "in", "quantity": "2"},
        headers=member["headers"],
    )
    assert movement.status_code == 201

    create = client.post(
        f"/api/v1/businesses/{business_id}/products",
        json={"sku": "NOPE", "name": "Nope"},
        headers=member["headers"],
    )
    assert create.status_code == 403


def test_products_are_isolated_between_businesses(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner)

    other_owner = user_factory()
    other_business = business_factory(other_owner)

    response = client.get(
        f"/api/v1/businesses/{other_business['id']}/products/{product['id']}",
        headers=other_owner["headers"],
    )
    assert response.status_code == 404

    movement = client.post(
        f"/api/v1/businesses/{other_business['id']}/products/{product['id']}/stock-movements",
        json={"movement_type": "in", "quantity": "1"},
        headers=other_owner["headers"],
    )
    assert movement.status_code == 404
