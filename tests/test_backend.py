"""Unit tests for YouThumber backend and FastAPI server."""

import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from youthumber.server import create_app


@pytest.fixture
def client(monkeypatch) -> TestClient:
    # Tests must not pick up a matting model downloaded on this machine.
    monkeypatch.setattr("youthumber.server.MODEL", _FakeModel("missing"))
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


def _png_data_url(size=(64, 64)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", size, color=(200, 50, 50)).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


class _FakeModel:
    size_mb = 444

    def __init__(self, status: str) -> None:
        self.status, self.started = status, False

    def state(self) -> dict:
        return {"status": self.status, "progress": 1.0, "error": None}

    def start(self) -> None:
        self.started = True


def test_remove_uses_birefnet_once_its_model_is_ready(monkeypatch) -> None:
    # BiRefNet's edges replace Vision's once the model is downloaded; the response then
    # also carries the mask with objects (mic stand, chair) for the "Keep objects" toggle.
    monkeypatch.setattr("youthumber.server.MODEL", _FakeModel("ready"))

    def fake_matting(image_bytes, matter):
        img = Image.new("RGB", (64, 64))
        person, objects = Image.new("L", (64, 64), 200), Image.new("L", (64, 64), 255)
        cutout = img.convert("RGBA")
        cutout.putalpha(person)
        return cutout, person, objects

    monkeypatch.setattr("youthumber.server.HAS_VISION", True)
    monkeypatch.setattr("youthumber.server.segment_with_matting", fake_matting)
    client = TestClient(create_app())

    payload = client.post("/remove", json={"image": _png_data_url()}).json()

    assert payload["objectsMask"].startswith("data:image/png;base64,")
    assert payload["metadata"]["modelId"] == "birefnet-general+apple-vision"


def test_remove_falls_back_to_vision_without_the_model(monkeypatch) -> None:
    monkeypatch.setattr("youthumber.server.MODEL", _FakeModel("missing"))
    client = TestClient(create_app())

    payload = client.post("/remove", json={"image": _png_data_url()}).json()

    assert payload.get("objectsMask") is None
    assert "birefnet" not in payload["metadata"]["modelId"]


def test_matting_model_status_and_download(monkeypatch) -> None:
    model = _FakeModel("missing")
    monkeypatch.setattr("youthumber.server.MODEL", model)
    client = TestClient(create_app())

    status = client.get("/matting-model").json()
    started = client.post("/matting-model/download")

    assert status["status"] == "missing"
    assert status["sizeMb"] == 444
    assert started.status_code == 202 and model.started
