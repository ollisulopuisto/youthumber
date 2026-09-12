"""Unit tests for YouThumber backend and FastAPI server."""

import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from youthumber.server import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_health_check(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert "supportedModels" in data


def test_remove_background_endpoint(client: TestClient) -> None:
    # Create small test image
    img = Image.new("RGB", (64, 64), color=(200, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    data_url = f"data:image/png;base64,{b64}"

    res = client.post(
        "/remove",
        json={"image": data_url, "model": "apple-vision-ane"},
    )
    assert res.status_code == 200
    payload = res.json()
    assert "image" in payload
    assert "mask" in payload
    assert payload["image"].startswith("data:image/png;base64,")
    assert payload["mask"].startswith("data:image/png;base64,")
    assert payload["metadata"]["backendId"] == "coreml-local"


def test_remove_background_validation_error(client: TestClient) -> None:
    res = client.post("/remove", json={})
    assert res.status_code == 422  # Missing required field 'image'


def test_index_serving(client: TestClient) -> None:
    res = client.get("/")
    assert res.status_code == 200
    assert "YouThumber" in res.text or "<!doctype html>" in res.text.lower()
