import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    "origin",
    [
        "https://khoebo.onrender.com",
        "http://127.0.0.1:8081",
    ],
)
def test_known_frontend_origin_can_preflight_login(client: TestClient, origin: str) -> None:
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200, response.text
    assert response.headers["access-control-allow-origin"] == origin
