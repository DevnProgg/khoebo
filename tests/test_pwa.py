import json
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "mobile" / "public"
DIST_DIR = ROOT / "mobile" / "dist"


def _png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    width = int.from_bytes(data[16:20], "big")
    height = int.from_bytes(data[20:24], "big")
    return width, height


def test_manifest_has_required_identity_and_icons() -> None:
    manifest = json.loads((PUBLIC_DIR / "manifest.webmanifest").read_text(encoding="utf-8"))

    assert manifest["name"] == "Khoebo"
    assert manifest["short_name"] == "Khoebo"
    assert manifest["description"] == "Manage your business, inventory, sales and finances in one place."
    assert manifest["start_url"] == "/"
    assert manifest["display"] == "standalone"
    assert manifest["orientation"] == "portrait"
    assert manifest["theme_color"] == "#E96B1A"
    assert manifest["background_color"] == "#FFFFFF"

    sizes = {
        tuple(icon.get("sizes", "").split("x"))
        for icon in manifest["icons"]
        if "sizes" in icon
    }
    assert ("192", "192") in sizes
    assert ("512", "512") in sizes
    assert any("maskable" in icon.get("purpose", "") for icon in manifest["icons"])


def test_pwa_icons_have_expected_sizes() -> None:
    icons = PUBLIC_DIR / "icons"
    assert _png_size(icons / "icon-192.png") == (192, 192)
    assert _png_size(icons / "icon-512.png") == (512, 512)
    assert _png_size(icons / "icon-maskable-512.png") == (512, 512)
    assert _png_size(icons / "apple-touch-icon.png") == (180, 180)
    assert _png_size(icons / "favicon.png") == (48, 48)


def test_generated_html_links_pwa_resources() -> None:
    html = (DIST_DIR / "index.html").read_text(encoding="utf-8")

    assert 'rel="manifest"' in html
    assert "/manifest.webmanifest" in html
    assert 'name="theme-color"' in html
    assert "#E96B1A" in html
    assert 'rel="apple-touch-icon"' in html
    assert "viewport-fit=cover" in html


def test_service_worker_avoids_api_and_mutation_caching() -> None:
    source = (PUBLIC_DIR / "sw.js").read_text(encoding="utf-8")

    assert "request.method !== 'GET'" in source
    assert "pathname.startsWith('/api/')" in source
    assert "SKIP_WAITING" in source
    assert "offline.html" in source
    assert "khoebo-shell-v" in source


def test_offline_fallback_is_branded_and_useful() -> None:
    html = (PUBLIC_DIR / "offline.html").read_text(encoding="utf-8")

    assert "Khoebo" in html
    assert "offline" in html.lower()
    assert "Try again" in html


def test_manifest_is_served_with_manifest_content_type(client: TestClient) -> None:
    response = client.get("/manifest.webmanifest")
    assert response.status_code == 200
    assert "manifest" in response.headers["content-type"]
    assert response.json()["name"] == "Khoebo"
    assert "public" in response.headers["cache-control"]


def test_service_worker_is_served_with_revalidation(client: TestClient) -> None:
    response = client.get("/sw.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]
    assert "no-cache" in response.headers["cache-control"]


def test_offline_fallback_is_served(client: TestClient) -> None:
    response = client.get("/offline.html")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Khoebo" in response.text


def test_pwa_icons_are_served(client: TestClient) -> None:
    for name in (
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "apple-touch-icon.png",
        "favicon.png",
    ):
        response = client.get(f"/icons/{name}")
        assert response.status_code == 200, name
        assert response.headers["content-type"] == "image/png", name


def test_hashed_assets_are_immutable(client: TestClient) -> None:
    bundles = sorted((DIST_DIR / "_expo" / "static" / "js" / "web").glob("entry-*.js"))
    assert bundles
    response = client.get(f"/_expo/static/js/web/{bundles[0].name}")
    assert response.status_code == 200
    assert "immutable" in response.headers["cache-control"]


def test_api_responses_remain_private(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
