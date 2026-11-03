from fastapi.testclient import TestClient


def test_create_business_seeds_owner_and_chart_of_accounts(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner, name="Acme Retail")

    assert business["name"] == "Acme Retail"
    assert business["slug"] == "acme-retail"
    assert business["owner_id"] == owner["id"]

    members = client.get(
        f"/api/v1/businesses/{business['id']}/members", headers=owner["headers"]
    )
    assert members.status_code == 200
    assert len(members.json()) == 1
    assert members.json()[0]["role"] == "owner"

    accounts = client.get(
        f"/api/v1/businesses/{business['id']}/accounts", headers=owner["headers"]
    )
    assert accounts.status_code == 200
    codes = {account["code"] for account in accounts.json()}
    assert {"1000", "1200", "4000", "5000", "5100"}.issubset(codes)

    listing = client.get("/api/v1/businesses", headers=owner["headers"])
    assert listing.status_code == 200
    assert [row["id"] for row in listing.json()] == [business["id"]]


def test_slug_is_unique(client: TestClient, user_factory, business_factory) -> None:
    owner = user_factory()
    first = business_factory(owner, name="Same Name")
    second = business_factory(owner, name="Same Name")
    assert first["slug"] != second["slug"]


def test_non_members_cannot_access_business(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    outsider = user_factory()
    business = business_factory(owner)

    response = client.get(
        f"/api/v1/businesses/{business['id']}", headers=outsider["headers"]
    )
    assert response.status_code == 404
    products = client.get(
        f"/api/v1/businesses/{business['id']}/products", headers=outsider["headers"]
    )
    assert products.status_code == 404


def test_member_permissions(client: TestClient, user_factory, business_factory) -> None:
    owner = user_factory()
    member = user_factory()
    business = business_factory(owner)
    business_id = business["id"]

    added = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )
    assert added.status_code == 201, added.text

    assert (
        client.get(
            f"/api/v1/businesses/{business_id}", headers=member["headers"]
        ).status_code
        == 200
    )

    member_product = client.post(
        f"/api/v1/businesses/{business_id}/products",
        json={"sku": "M-1", "name": "Member product"},
        headers=member["headers"],
    )
    assert member_product.status_code == 403

    member_add = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": "another@example.com", "role": "member"},
        headers=member["headers"],
    )
    assert member_add.status_code == 403

    member_update = client.patch(
        f"/api/v1/businesses/{business_id}",
        json={"name": "Hacked"},
        headers=member["headers"],
    )
    assert member_update.status_code == 403


def test_admin_cannot_escalate_to_owner(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    admin = user_factory()
    other = user_factory()
    business = business_factory(owner)
    business_id = business["id"]

    client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": admin["email"], "role": "admin"},
        headers=owner["headers"],
    )

    add_owner = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": other["email"], "role": "owner"},
        headers=admin["headers"],
    )
    assert add_owner.status_code == 403

    add_member = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": other["email"], "role": "member"},
        headers=admin["headers"],
    )
    assert add_member.status_code == 201


def test_last_owner_is_protected(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    business_id = business["id"]

    demote = client.patch(
        f"/api/v1/businesses/{business_id}/members/{owner['id']}",
        json={"role": "member"},
        headers=owner["headers"],
    )
    assert demote.status_code == 400

    remove = client.delete(
        f"/api/v1/businesses/{business_id}/members/{owner['id']}",
        headers=owner["headers"],
    )
    assert remove.status_code == 400


def test_admin_cannot_delete_business(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    admin = user_factory()
    business = business_factory(owner)
    business_id = business["id"]
    client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": admin["email"], "role": "admin"},
        headers=owner["headers"],
    )

    assert (
        client.delete(
            f"/api/v1/businesses/{business_id}", headers=admin["headers"]
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/v1/businesses/{business_id}", headers=owner["headers"]
        ).status_code
        == 204
    )
    assert (
        client.get(
            f"/api/v1/businesses/{business_id}", headers=owner["headers"]
        ).status_code
        == 404
    )


def test_adding_unknown_or_duplicate_member(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    member = user_factory()
    business = business_factory(owner)
    business_id = business["id"]

    unknown = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": "ghost@example.com", "role": "member"},
        headers=owner["headers"],
    )
    assert unknown.status_code == 404

    first = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )
    assert first.status_code == 201
    duplicate = client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )
    assert duplicate.status_code == 409


def test_deleting_business_cascades_data(
    client: TestClient,
    user_factory,
    business_factory,
    product_factory,
    session_factory,
) -> None:
    from datetime import date

    from sqlalchemy import func, select

    from app.models.accounting import Account, Expense, JournalEntry
    from app.models.business import Business, BusinessMember
    from app.models.inventory import Product, StockMovement
    from app.models.reminder import Reminder
    from app.models.sales import Sale
    from app.models.user import User

    owner = user_factory()
    business = business_factory(owner)
    business_id = business["id"]
    product = product_factory(business, owner)

    client.post(
        f"/api/v1/businesses/{business_id}/sales",
        json={"items": [{"product_id": product["id"], "quantity": "1"}]},
        headers=owner["headers"],
    )
    client.post(
        f"/api/v1/businesses/{business_id}/expenses",
        json={
            "description": "Snacks",
            "amount": "5.00",
            "expense_date": date.today().isoformat(),
        },
        headers=owner["headers"],
    )
    client.post(
        f"/api/v1/businesses/{business_id}/reminders",
        json={"title": "Reminder", "next_due_at": date.today().isoformat() + "T00:00:00Z"},
        headers=owner["headers"],
    )

    deleted = client.delete(
        f"/api/v1/businesses/{business_id}", headers=owner["headers"]
    )
    assert deleted.status_code == 204, deleted.text

    with session_factory() as session:
        for model in (
            Business,
            BusinessMember,
            Product,
            StockMovement,
            Sale,
            Account,
            JournalEntry,
            Expense,
            Reminder,
        ):
            count = session.scalar(select(func.count()).select_from(model))
            assert count == 0, model.__name__
        assert session.scalar(select(func.count()).select_from(User)) == 1
