from pathlib import Path

from fastapi.testclient import TestClient

DIST_DIR = Path(__file__).resolve().parents[1] / "mobile" / "dist"


def test_serve_index_html(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<!DOCTYPE html>" in response.text


def test_serve_exact_html_file(client: TestClient) -> None:
    response = client.get("/login.html")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<!DOCTYPE html>" in response.text


def test_serve_clean_url_html_file(client: TestClient) -> None:
    response = client.get("/login")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<!DOCTYPE html>" in response.text


def test_serve_nested_clean_url_html_file(client: TestClient) -> None:
    response = client.get("/settings/business")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<!DOCTYPE html>" in response.text


def test_serve_favicon(client: TestClient) -> None:
    response = client.get("/favicon.ico")
    assert response.status_code == 200
    assert len(response.content) > 0


def test_serve_expo_static_asset(client: TestClient) -> None:
    bundles = sorted((DIST_DIR / "_expo" / "static" / "js" / "web").glob("entry-*.js"))
    assert bundles
    response = client.get(f"/_expo/static/js/web/{bundles[0].name}")
    assert response.status_code == 200
    assert len(response.content) > 0


def test_spa_fallback_for_dynamic_route(client: TestClient) -> None:
    response = client.get("/sale/12345")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<!DOCTYPE html>" in response.text


def test_nonexistent_asset_returns_404(client: TestClient) -> None:
    response = client.get("/missing-asset.png")
    assert response.status_code == 404


def test_api_routes_not_shadowed(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

    response = client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404
