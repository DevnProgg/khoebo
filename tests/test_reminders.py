from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _iso(moment: datetime) -> str:
    return moment.isoformat()


def _parse(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def test_reminder_crud_and_due_filtering(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    base = f"/api/v1/businesses/{business['id']}/reminders"
    now = datetime.now(timezone.utc)

    due = client.post(
        base,
        json={
            "type": "custom",
            "title": "Call supplier",
            "message": "Restock soon",
            "frequency": "once",
            "next_due_at": _iso(now - timedelta(hours=1)),
        },
        headers=owner["headers"],
    )
    assert due.status_code == 201, due.text

    future = client.post(
        base,
        json={
            "type": "custom",
            "title": "Future task",
            "frequency": "once",
            "next_due_at": _iso(now + timedelta(days=1)),
        },
        headers=owner["headers"],
    )
    assert future.status_code == 201

    due_list = client.get(f"{base}/due", headers=owner["headers"])
    assert due_list.status_code == 200
    assert [row["reminder"]["title"] for row in due_list.json()] == ["Call supplier"]
    assert due_list.json()[0]["overdue"] is True
    assert due_list.json()[0]["context"] is None

    all_reminders = client.get(base, headers=owner["headers"])
    assert len(all_reminders.json()) == 2

    updated = client.patch(
        f"{base}/{future.json()['id']}",
        json={"title": "Future task renamed", "next_due_at": _iso(now - timedelta(minutes=5))},
        headers=owner["headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Future task renamed"

    due_list = client.get(f"{base}/due", headers=owner["headers"])
    assert len(due_list.json()) == 2

    deleted = client.delete(
        f"{base}/{future.json()['id']}", headers=owner["headers"]
    )
    assert deleted.status_code == 204
    assert len(client.get(base, headers=owner["headers"]).json()) == 1


def test_low_stock_reminder_context(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    base = f"/api/v1/businesses/{business['id']}/reminders"
    now = datetime.now(timezone.utc)

    reminder = client.post(
        base,
        json={
            "type": "low_stock",
            "title": "Check stock",
            "frequency": "daily",
            "next_due_at": _iso(now - timedelta(minutes=1)),
        },
        headers=owner["headers"],
    )
    assert reminder.status_code == 201

    due = client.get(f"{base}/due", headers=owner["headers"]).json()
    assert due == []

    product_factory(
        business,
        owner,
        name="Low Item",
        stock_quantity="2",
        low_stock_threshold="5",
    )
    due = client.get(f"{base}/due", headers=owner["headers"]).json()
    assert len(due) == 1
    assert due[0]["context"]["low_stock_count"] == 1
    assert due[0]["context"]["low_stock_products"][0]["name"] == "Low Item"


def test_record_sales_reminder_context(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner)
    base = f"/api/v1/businesses/{business['id']}/reminders"
    now = datetime.now(timezone.utc)

    client.post(
        base,
        json={
            "type": "record_sales",
            "title": "Record today's sales",
            "frequency": "daily",
            "next_due_at": _iso(now - timedelta(minutes=1)),
        },
        headers=owner["headers"],
    )

    due = client.get(f"{base}/due", headers=owner["headers"]).json()
    assert due[0]["context"]["sales_recorded_today"] is False

    client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={"items": [{"product_id": product["id"], "quantity": "1"}]},
        headers=owner["headers"],
    )
    due = client.get(f"{base}/due", headers=owner["headers"]).json()
    assert due[0]["context"]["sales_recorded_today"] is True


def test_trigger_and_snooze_reminders(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    base = f"/api/v1/businesses/{business['id']}/reminders"
    now = datetime.now(timezone.utc)

    once = client.post(
        base,
        json={
            "type": "custom",
            "title": "One shot",
            "frequency": "once",
            "next_due_at": _iso(now - timedelta(minutes=1)),
        },
        headers=owner["headers"],
    ).json()

    triggered = client.post(
        f"{base}/{once['id']}/trigger", headers=owner["headers"]
    )
    assert triggered.status_code == 200
    assert triggered.json()["is_active"] is False
    assert triggered.json()["last_triggered_at"] is not None
    assert client.get(f"{base}/due", headers=owner["headers"]).json() == []

    daily = client.post(
        base,
        json={
            "type": "custom",
            "title": "Daily task",
            "frequency": "daily",
            "next_due_at": _iso(now - timedelta(minutes=1)),
        },
        headers=owner["headers"],
    ).json()

    triggered_daily = client.post(
        f"{base}/{daily['id']}/trigger", headers=owner["headers"]
    ).json()
    assert triggered_daily["is_active"] is True
    assert _parse(triggered_daily["next_due_at"]) > now

    snoozed = client.post(
        f"{base}/{daily['id']}/snooze?days=2", headers=owner["headers"]
    )
    assert snoozed.status_code == 200
    assert _parse(snoozed.json()["next_due_at"]) > now + timedelta(days=1)
    assert client.get(f"{base}/due", headers=owner["headers"]).json() == []


def test_reminders_are_private_to_the_user(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    member = user_factory()
    outsider = user_factory()
    business = business_factory(owner)
    business_id = business["id"]
    base = f"/api/v1/businesses/{business_id}/reminders"
    now = datetime.now(timezone.utc)

    reminder = client.post(
        base,
        json={
            "type": "custom",
            "title": "Owner only",
            "frequency": "once",
            "next_due_at": _iso(now - timedelta(minutes=1)),
        },
        headers=owner["headers"],
    ).json()

    client.post(
        f"/api/v1/businesses/{business_id}/members",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )

    assert client.get(base, headers=member["headers"]).json() == []
    assert (
        client.get(f"{base}/due", headers=member["headers"]).json() == []
    )
    assert (
        client.post(
            f"{base}/{reminder['id']}/trigger", headers=member["headers"]
        ).status_code
        == 404
    )

    assert client.get(base, headers=outsider["headers"]).status_code == 404
