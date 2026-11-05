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


def test_security_headers_present(client: TestClient) -> None:
    # Standard defense-in-depth headers must be set on both API and HTML/static responses
    for path in ("/health", "/"):
        res = client.get(path)
        assert res.headers.get("x-content-type-options") == "nosniff"
        assert res.headers.get("x-frame-options") == "DENY"


def test_cors_allows_local_origins(client: TestClient) -> None:
    # Requests from local dev server or loopback should be allowed CORS access
    for origin in ("http://localhost:5173", "http://127.0.0.1:8731"):
        res = client.get("/health", headers={"Origin": origin})
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") == origin


def test_cors_rejects_untrusted_origins(client: TestClient) -> None:
    # Requests from arbitrary websites or spoofed localhost domains must not receive CORS headers
    for evil in ("https://evil.com", "http://localhost.evil.com"):
        res = client.get("/health", headers={"Origin": evil})
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") is None


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


def test_remove_background_rejects_malformed_base64(client: TestClient) -> None:
    # Malformed base64 must fail closed with 400 Bad Request
    res = client.post("/remove", json={"image": "data:image/png;base64,invalid!@#$"})
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid image data"


def test_remove_background_rejects_invalid_base64_suffix(client: TestClient) -> None:
    # The default permissive base64 decoder ignores invalid trailing characters.
    image = _png_data_url() + "!!!"
    res = client.post("/remove", json={"image": image})
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid image data"


def test_remove_background_rejects_corrupt_non_image_payload(
    client: TestClient,
) -> None:
    # Valid base64 that is not a valid image must fail closed with 400 Bad Request
    fake_b64 = "data:image/png;base64," + base64.b64encode(b"not-an-image").decode()
    res = client.post("/remove", json={"image": fake_b64})
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid image data"


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


def test_actions_api_endpoints(client: TestClient) -> None:
    # 1. GET /api/actions
    res = client.get("/api/actions")
    assert res.status_code == 200
    data = res.json()
    assert "actions" in data
    assert "tools" in data
    assert "openai" in data["tools"]
    assert "anthropic" in data["tools"]

    # Test format query param
    oa_res = client.get("/api/actions?format=openai")
    assert oa_res.status_code == 200
    assert "tools" in oa_res.json()

    ant_res = client.get("/api/actions?format=anthropic")
    assert ant_res.status_code == 200
    assert "tools" in ant_res.json()

    # 2. POST /api/actions/execute
    exec_res = client.post(
        "/api/actions/execute",
        json={
            "action": "create_project",
            "parameters": {"name": "API Project", "speaker_count": 2},
        },
    )
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["success"] is True
    assert exec_data["action"] == "create_project"
    project = exec_data["project"]
    assert project["name"] == "API Project"

    # Test validation / error
    bad_res = client.post(
        "/api/actions/execute",
        json={"action": "unknown_action", "parameters": {}},
    )
    assert bad_res.status_code == 400

    # 3. POST /api/actions/batch
    batch_res = client.post(
        "/api/actions/batch",
        json={
            "actions": [
                {"action": "create_project", "parameters": {"name": "Batch API"}},
                {"action": "set_headline", "parameters": {"text": "HEADLINE FROM API"}},
            ]
        },
    )
    assert batch_res.status_code == 200
    batch_data = batch_res.json()
    assert batch_data["success"] is True
    assert batch_data["count"] == 2
    assert batch_data["project"]["text"]["text"] == "HEADLINE FROM API"


def test_remove_falls_back_to_vision_when_birefnet_fails(monkeypatch) -> None:
    # The first packaged build couldn't run the model ("torchvision::nms does not
    # exist", 2026-09-23) and every cutout returned 500. Vision's cutout still works.
    monkeypatch.setattr("youthumber.server.MODEL", _FakeModel("ready"))
    monkeypatch.setattr("youthumber.server.HAS_VISION", True)

    def broken_matting(image_bytes, matter):
        raise RuntimeError("operator torchvision::nms does not exist")

    monkeypatch.setattr("youthumber.server.segment_with_matting", broken_matting)
    client = TestClient(create_app())

    res = client.post("/remove", json={"image": _png_data_url()})

    assert res.status_code == 200
    assert "birefnet" not in res.json()["metadata"]["modelId"]
    assert res.json()["objectsMask"] is None


def test_show_preset_input_validation(
    client: TestClient, tmp_path, monkeypatch
) -> None:
    # Use isolated test directory for presets storage
    preset_file = tmp_path / "show-presets.json"
    monkeypatch.setattr("youthumber.server.show_presets_path", lambda: preset_file)

    # 1. Reject non-string id or name
    res = client.post("/show-presets", json={"preset": {"id": 123, "name": "Valid"}})
    assert res.status_code == 400
    assert "Preset id and name must be strings" in res.json()["detail"]

    res = client.post("/show-presets", json={"preset": {"id": "valid_id", "name": 456}})
    assert res.status_code == 400
    assert "Preset id and name must be strings" in res.json()["detail"]

    # 2. Reject whitespace-only id or name
    res = client.post("/show-presets", json={"preset": {"id": "   ", "name": "Valid"}})
    assert res.status_code == 400
    assert "Preset id and name cannot be empty" in res.json()["detail"]

    res = client.post(
        "/show-presets", json={"preset": {"id": "valid_id", "name": "   "}}
    )
    assert res.status_code == 400
    assert "Preset id and name cannot be empty" in res.json()["detail"]

    # 3. Reject oversized id or name
    res = client.post(
        "/show-presets", json={"preset": {"id": "x" * 65, "name": "Valid"}}
    )
    assert res.status_code == 400
    assert "exceeds maximum length" in res.json()["detail"]

    res = client.post(
        "/show-presets", json={"preset": {"id": "valid_id", "name": "y" * 101}}
    )
    assert res.status_code == 400
    assert "exceeds maximum length" in res.json()["detail"]

    # 4. Reject invalid delete preset_id
    res = client.delete("/show-presets/%20%20%20")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid preset id"

    res = client.delete(f"/show-presets/{'x' * 65}")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid preset id"

    # 5. Accept valid preset creation and deletion
    res = client.post(
        "/show-presets", json={"preset": {"id": "custom-1", "name": "My Preset"}}
    )
    assert res.status_code == 200
    presets = res.json()["presets"]
    assert any(p["id"] == "custom-1" and p["name"] == "My Preset" for p in presets)

    del_res = client.delete("/show-presets/custom-1")
    assert del_res.status_code == 200
    assert not any(p["id"] == "custom-1" for p in del_res.json()["presets"])
