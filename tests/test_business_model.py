import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.capabilities import CAPABILITIES, Capability, has_capability
from app.models.enums import BusinessModel

ROOT = Path(__file__).resolve().parents[1]


def test_new_business_defaults_to_stock_model(client: TestClient, user_factory, business_factory) -> None:
    business = business_factory(user_factory())

    assert business["business_model"] == BusinessModel.stock.value


def test_business_model_can_be_selected_at_creation(client: TestClient, user_factory) -> None:
    owner = user_factory()
    response = client.post(
        "/api/v1/businesses",
        json={"name": "Salon", "business_model": "service"},
        headers=owner["headers"],
    )

    assert response.status_code == 201, response.text
    assert response.json()["business_model"] == BusinessModel.service.value


def test_owner_can_change_business_model(client: TestClient, user_factory, business_factory) -> None:
    owner = user_factory()
    business = business_factory(owner)

    response = client.patch(
        f"/api/v1/businesses/{business['id']}",
        json={"business_model": "hybrid"},
        headers=owner["headers"],
    )

    assert response.status_code == 200, response.text
    assert response.json()["business_model"] == BusinessModel.hybrid.value


def test_invalid_business_model_is_rejected(client: TestClient, user_factory, business_factory) -> None:
    owner = user_factory()
    business = business_factory(owner)

    response = client.patch(
        f"/api/v1/businesses/{business['id']}",
        json={"business_model": "retail"},
        headers=owner["headers"],
    )

    assert response.status_code == 422


def test_member_cannot_change_business_model(client: TestClient, user_factory, business_factory) -> None:
    owner = user_factory()
    member = user_factory()
    business = business_factory(owner)
    added = client.post(
        f"/api/v1/businesses/{business['id']}/members",
        json={"email": member["email"], "role": "member"},
        headers=owner["headers"],
    )
    assert added.status_code == 201, added.text

    response = client.patch(
        f"/api/v1/businesses/{business['id']}",
        json={"business_model": "service"},
        headers=member["headers"],
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("model", "capabilities"),
    [
        (BusinessModel.stock, {Capability.inventory}),
        (BusinessModel.service, {Capability.services}),
        (BusinessModel.hybrid, {Capability.inventory, Capability.services}),
    ],
)
def test_capabilities_depend_on_business_model(model: BusinessModel, capabilities: set[Capability]) -> None:
    assert CAPABILITIES[model] == capabilities
    for capability in Capability:
        assert has_capability(model, capability) is (capability in capabilities)


def test_service_business_cannot_mutate_products(client: TestClient, user_factory) -> None:
    owner = user_factory()
    created = client.post(
        "/api/v1/businesses",
        json={"name": "Cleaning Services", "business_model": "service"},
        headers=owner["headers"],
    )
    assert created.status_code == 201, created.text
    business_id = created.json()["id"]

    response = client.post(
        f"/api/v1/businesses/{business_id}/products",
        json={"sku": "S-1", "name": "Not a product"},
        headers=owner["headers"],
    )

    assert response.status_code == 403


def test_migration_defaults_existing_businesses_to_hybrid(tmp_path: Path) -> None:
    database_path = tmp_path / "business-model.db"
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")
    command.upgrade(config, "3d8e6e1f4a2b")

    engine = create_engine(f"sqlite:///{database_path}")
    user_id = str(uuid.uuid4())
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, email, full_name, hashed_password, is_active, is_superuser) "
                "VALUES (:id, 'legacy@example.com', 'Legacy', 'hash', 1, 0)"
            ),
            {"id": user_id},
        )
        connection.execute(
            text(
                "INSERT INTO businesses (id, name, slug, currency, owner_id) "
                "VALUES (:id, 'Legacy Shop', 'legacy-shop', 'LSL', :owner_id)"
            ),
            {"id": str(uuid.uuid4()), "owner_id": user_id},
        )
    engine.dispose()

    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database_path}")
    with engine.connect() as connection:
        models = connection.execute(text("SELECT business_model FROM businesses")).scalars().all()
    engine.dispose()

    assert models == [BusinessModel.hybrid.value]
