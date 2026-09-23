"""Tests for the BiRefNet matting model: download, input preparation, and combining
its edges with Vision's idea of where the person is."""

import hashlib

import numpy as np
from PIL import Image, ImageDraw

from youthumber import matting
from youthumber.matting import ModelDownload, combine_masks, prepare_input


def _serve(tmp_path, payload: bytes) -> str:
    source = tmp_path / "served.onnx"
    source.write_bytes(payload)
    return source.as_uri()


def test_download_verifies_the_checksum_and_reports_ready(tmp_path) -> None:
    payload = b"model-bytes" * 1000
    target = tmp_path / "models" / "birefnet.onnx"
    download = ModelDownload(
        url=_serve(tmp_path, payload),
        sha256=hashlib.sha256(payload).hexdigest(),
        path=target,
    )

    download.run()

    assert download.state()["status"] == "ready"
    assert download.state()["progress"] == 1.0
    assert target.read_bytes() == payload


def test_download_with_a_wrong_checksum_fails_closed_and_keeps_nothing(
    tmp_path,
) -> None:
    # A truncated or tampered model must never be loaded as if it were the real one.
    target = tmp_path / "models" / "birefnet.onnx"
    download = ModelDownload(
        url=_serve(tmp_path, b"not the model"), sha256="0" * 64, path=target
    )

    download.run()

    state = download.state()
    assert state["status"] == "error"
    assert "checksum" in state["error"]
    assert not target.exists()
    assert not list(target.parent.glob("*.part"))


def test_an_existing_model_is_checked_before_it_counts_as_ready(tmp_path) -> None:
    target = tmp_path / "birefnet.onnx"
    target.write_bytes(b"corrupt")
    download = ModelDownload(url="file:///nowhere", sha256="0" * 64, path=target)

    assert download.state()["status"] == "missing"


def test_prepare_input_matches_birefnet_normalisation() -> None:
    image = Image.new("RGB", (640, 360), (255, 128, 0))

    tensor = prepare_input(image)

    assert tensor.shape == (1, 3, 1024, 1024) and tensor.dtype == np.float32
    # Scaled by the image's own max, then ImageNet mean/std, as BiRefNet was trained.
    expected = [
        (1.0 - 0.485) / 0.229,
        (128 / 255 - 0.456) / 0.224,
        (0.0 - 0.406) / 0.225,
    ]
    assert np.allclose(tensor[0, :, 500, 500], expected, atol=1e-3)


def _scene() -> tuple[Image.Image, Image.Image]:
    """A matte (BiRefNet: person + mic stand far off) and Vision's person mask, which
    stops short of the fingertips — as on the real frames (2026-09-23)."""
    matte = Image.new("L", (1000, 600), 0)
    draw = ImageDraw.Draw(matte)
    draw.rectangle([200, 100, 500, 599], fill=255)  # body
    draw.rectangle([500, 300, 560, 320], fill=255)  # finger reaching out
    draw.rectangle([850, 50, 870, 599], fill=255)  # mic stand, well clear

    person = Image.new("L", (1000, 600), 0)
    ImageDraw.Draw(person).rectangle([200, 100, 540, 599], fill=255)  # no fingertip
    return matte, person


def test_combine_keeps_the_matte_edges_near_the_person_and_drops_far_objects() -> None:
    matte, person = _scene()

    person_only, objects = combine_masks(matte, person, keep_points=[])

    assert person_only.getpixel((555, 310)) >= 240  # fingertip Vision missed
    assert person_only.getpixel((860, 300)) == 0  # stand
    assert person_only.getpixel((350, 400)) == 255
    assert person_only.getpixel((150, 400)) == 0  # background stays background
    assert objects.getpixel((860, 300)) == 255  # "Keep objects" gets everything


def test_combine_never_adds_opacity_the_matte_does_not_have() -> None:
    matte, person = _scene()
    ImageDraw.Draw(person).rectangle([0, 0, 199, 599], fill=255)  # Vision too wide

    person_only, _ = combine_masks(matte, person, keep_points=[])

    assert person_only.getpixel((100, 300)) == 0


def test_model_path_can_be_overridden(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("YOUTHUMBER_MODEL_DIR", str(tmp_path))

    assert matting.model_path().parent == tmp_path
