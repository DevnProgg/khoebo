import os
import uuid
from collections.abc import Generator

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["AUTO_CREATE_TABLES"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-0123456789abcdef-0123456789"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "15"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import enable_sqlite_foreign_keys, get_db
from app.main import app


@pytest.fixture()
def engine() -> Generator[Engine, None, None]:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    enable_sqlite_foreign_keys(test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


@pytest.fixture()
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db_session(session_factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    session = session_factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(engine: Engine, session_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def user_factory(client: TestClient):
    def create_user(
        email: str | None = None,
        password: str = "Password123",
        full_name: str = "Test User",
    ) -> dict:
        email = email or f"user-{uuid.uuid4().hex[:12]}@example.com"
        register = client.post(
            "/api/v1/auth/register",
            json={"email": email, "full_name": full_name, "password": password},
        )
        assert register.status_code == 201, register.text
        login = client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert login.status_code == 200, login.text
        tokens = login.json()
        return {
            "id": register.json()["id"],
            "email": email,
            "password": password,
            "full_name": full_name,
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
        }

    return create_user


@pytest.fixture()
def business_factory(client: TestClient):
    def create_business(user: dict, name: str | None = None, currency: str = "LSL") -> dict:
        name = name or f"Business {uuid.uuid4().hex[:8]}"
        response = client.post(
            "/api/v1/businesses",
            json={"name": name, "currency": currency},
            headers=user["headers"],
        )
        assert response.status_code == 201, response.text
        return response.json()

    return create_business


@pytest.fixture()
def product_factory(client: TestClient):
    def create_product(
        business: dict,
        user: dict,
        *,
        sku: str | None = None,
        name: str = "Widget",
        unit_price: str = "10.00",
        cost_price: str = "4.00",
        stock_quantity: str = "10",
        low_stock_threshold: str = "2",
    ) -> dict:
        response = client.post(
            f"/api/v1/businesses/{business['id']}/products",
            json={
                "sku": sku or f"SKU-{uuid.uuid4().hex[:8]}",
                "name": name,
                "unit_price": unit_price,
                "cost_price": cost_price,
                "stock_quantity": stock_quantity,
                "low_stock_threshold": low_stock_threshold,
            },
            headers=user["headers"],
        )
        assert response.status_code == 201, response.text
        return response.json()

    return create_product
