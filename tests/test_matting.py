"""Tests for the BiRefNet matting model: download, input preparation, and combining
its edges with Vision's idea of where the person is."""

import hashlib

import numpy as np
from PIL import Image, ImageDraw

from youthumber import matting
from youthumber.matting import (
    ModelDownload,
    ModelFile,
    choose_backend,
    combine_masks,
    prepare_input,
    prepare_torch_input,
)


def _serve(tmp_path, payload: bytes) -> str:
    source = tmp_path / "served.onnx"
    source.write_bytes(payload)
    return source.as_uri()


def _file(tmp_path, name: str, payload: bytes, sha: str | None = None) -> ModelFile:
    source = tmp_path / f"served-{name}"
    source.write_bytes(payload)
    return ModelFile(
        name=name,
        url=source.as_uri(),
        sha256=sha or hashlib.sha256(payload).hexdigest(),
        size=len(payload),
    )


def test_download_verifies_every_file_and_reports_ready(tmp_path) -> None:
    files = [
        _file(tmp_path, "config.json", b"{}"),
        _file(tmp_path, "model.safetensors", b"weights" * 1000),
    ]
    download = ModelDownload(files, tmp_path / "model")

    download.run()

    assert download.state()["status"] == "ready"
    assert download.state()["progress"] == 1.0
    assert (tmp_path / "model" / "model.safetensors").read_bytes() == b"weights" * 1000
    assert download.size_mb == 0  # rounded; real models report hundreds


def test_download_with_a_wrong_checksum_fails_closed_and_keeps_nothing(
    tmp_path,
) -> None:
    # A truncated or tampered model must never be loaded as if it were the real one.
    files = [
        _file(tmp_path, "config.json", b"{}"),
        _file(tmp_path, "model.safetensors", b"not the model", sha="0" * 64),
    ]
    download = ModelDownload(files, tmp_path / "model")

    download.run()

    state = download.state()
    assert state["status"] == "error"
    assert "checksum" in state["error"]
    assert not (tmp_path / "model" / "model.safetensors").exists()
    assert not list((tmp_path / "model").glob("*.part"))


def test_existing_files_are_checked_before_they_count_as_ready(tmp_path) -> None:
    files = [_file(tmp_path, "model.onnx", b"real", sha="0" * 64)]
    (tmp_path / "model").mkdir()
    (tmp_path / "model" / "model.onnx").write_bytes(b"corrupt")

    assert ModelDownload(files, tmp_path / "model").state()["status"] == "missing"


def test_backend_is_pytorch_on_the_mac_gpu_when_installed_else_onnx() -> None:
    # PyTorch on Metal ran BiRefNet in 0.9 s vs 10 s for ONNX on the CPU (2026-09-23);
    # CoreML could not compile it at all. PyTorch is only installed on macOS.
    assert choose_backend(has_torch=True) == "torch"
    assert choose_backend(has_torch=False) == "onnx"


def test_prepare_torch_input_uses_plain_0_to_1_scaling() -> None:
    tensor = prepare_torch_input(Image.new("RGB", (640, 360), (255, 128, 0)))

    assert tensor.shape == (1, 3, 1024, 1024)
    expected = [(1.0 - 0.485) / 0.229, (128 / 255 - 0.456) / 0.224, -0.406 / 0.225]
    assert np.allclose(tensor[0, :, 500, 500], expected, atol=1e-3)


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


def test_model_dir_can_be_overridden(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("YOUTHUMBER_MODEL_DIR", str(tmp_path))

    assert matting.models_dir() == tmp_path


def test_box_blur_dilation_matches_max_filter_equivalence() -> None:
    # Verifies that on a binary mask, BoxBlur(reach).point(>0 -> 255) produces
    # identical results to MaxFilter(2*reach+1) across multiple shapes and reaches.
    from PIL import ImageFilter

    rng = np.random.RandomState(42)
    for w, h in [(50, 40), (120, 80), (250, 140)]:
        for reach in [1, 2, 4, 8]:
            arr = (rng.rand(h, w) > 0.85).astype(np.uint8) * 255
            # Add a known contiguous block
            arr[h // 4 : h // 2, w // 4 : w // 2] = 255
            img = Image.fromarray(arr, mode="L")

            mf = img.filter(ImageFilter.MaxFilter(2 * reach + 1))
            bb = img.filter(ImageFilter.BoxBlur(reach)).point(
                lambda v: 255 if v > 0 else 0
            )

            diff = np.max(
                np.abs(np.asarray(mf, dtype=np.int16) - np.asarray(bb, dtype=np.int16))
            )
            assert diff == 0, (
                f"Mismatch at ({w}, {h}) with reach={reach}: max diff={diff}"
            )


def _lone_pixel(size: int = 80) -> Image.Image:
    arr = np.zeros((size, size), np.uint8)
    arr[size // 2, size // 2] = 255
    return Image.fromarray(arr, mode="L")


def test_dilate_binary_equals_max_filter_for_a_lone_pixel_at_every_reach() -> None:
    """An isolated pixel is the case a box blur loses first: it must survive
    at every reach, including ones past the box-blur cap."""
    from PIL import ImageFilter

    for reach in range(1, 16):
        img = _lone_pixel()
        expected = np.asarray(img.filter(ImageFilter.MaxFilter(2 * reach + 1)))
        got = np.asarray(matting._dilate_binary(img, reach))
        assert np.array_equal(got, expected), f"reach {reach}"


def test_box_blur_alone_loses_a_lone_pixel_from_reach_11() -> None:
    """Pins the reason for the cap: the shortcut is exact at 10 and wrong at 11."""
    from PIL import ImageFilter

    def boxed(reach: int) -> int:
        out = (
            _lone_pixel()
            .filter(ImageFilter.BoxBlur(reach))
            .point(lambda v: 255 if v > 0 else 0)
        )
        return int(np.count_nonzero(np.asarray(out)))

    assert boxed(10) == 21 * 21
    assert boxed(11) == 0
    assert matting._BOX_DILATION_MAX_REACH == 10


def test_production_reach_never_exceeds_the_box_blur_cap() -> None:
    widest = round(matting.REACH_WORK_WIDTH * matting.PERSON_REACH_FRACTION)
    assert widest <= matting._BOX_DILATION_MAX_REACH
