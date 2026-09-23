"""Tests for the Core Image texture generator."""

import os

import pytest
from fastapi.testclient import TestClient

from youthumber.server import create_app
from youthumber.textures import (
    HAS_CORE_IMAGE,
    TEXTURE_PRESETS,
    parse_hex_color,
    render_texture,
)

# Rendering needs macOS Core Image. On Linux CI these skip; with YOUTHUMBER_REQUIRE_MACOS=1
# (set on Mac runs) a missing Core Image fails them instead, so they can't silently pass.
requires_core_image = pytest.mark.skipif(
    not HAS_CORE_IMAGE and not os.environ.get("YOUTHUMBER_REQUIRE_MACOS"),
    reason="Core Image is macOS-only",
)


def test_parse_hex_color() -> None:
    assert parse_hex_color("#FF8000") == pytest.approx((1.0, 128 / 255, 0.0))
    assert parse_hex_color("0a0a0a") == pytest.approx((10 / 255, 10 / 255, 10 / 255))
    with pytest.raises(ValueError):
        parse_hex_color("#12345")
    with pytest.raises(ValueError):
        parse_hex_color("not-a-colour")


def test_presets_have_unique_ids_and_names() -> None:
    ids = [p["id"] for p in TEXTURE_PRESETS]
    assert len(ids) == len(set(ids)) >= 8
    assert all(p["name"] for p in TEXTURE_PRESETS)


@requires_core_image
@pytest.mark.parametrize("preset", [p["id"] for p in TEXTURE_PRESETS])
def test_every_preset_renders_at_the_requested_size(preset: str) -> None:
    image = render_texture(
        preset, ["#1E3A8A", "#F59E0B"], seed=1, width=320, height=180
    )

    assert image.size == (320, 180)
    assert image.mode == "RGB"
    # Not a flat fill: a texture has some variation.
    lo, hi = image.convert("L").getextrema()
    assert hi - lo > 10


@requires_core_image
def test_different_seeds_give_different_textures() -> None:
    a = render_texture("smoke", ["#000000", "#FFFFFF"], seed=1, width=160, height=90)
    b = render_texture("smoke", ["#000000", "#FFFFFF"], seed=2, width=160, height=90)

    assert a.tobytes() != b.tobytes()


@requires_core_image
def test_the_same_seed_gives_the_same_texture() -> None:
    a = render_texture("smoke", ["#000000", "#FFFFFF"], seed=7, width=160, height=90)
    b = render_texture("smoke", ["#000000", "#FFFFFF"], seed=7, width=160, height=90)

    assert a.tobytes() == b.tobytes()


@requires_core_image
def test_textures_use_the_chosen_colours() -> None:
    reds = render_texture("smoke", ["#400000", "#FF0000"], seed=1, width=160, height=90)
    r, g, b = reds.resize((1, 1)).getpixel((0, 0))

    assert r > 3 * max(g, b, 1)


@requires_core_image
def test_parallel_renders_in_a_fresh_process_all_succeed() -> None:
    # The picker requests all 8 previews at once. In a fresh engine process two of them
    # failed (2026-09-23): PyObjC resolves Quartz functions lazily on first use and that
    # isn't thread-safe (KeyError: 'CFDataCreateMutable'). Needs a cold process to show.
    import subprocess
    import sys

    script = (
        "from concurrent.futures import ThreadPoolExecutor\n"
        "from youthumber.textures import TEXTURE_PRESETS, render_texture\n"
        "def one(p):\n"
        "    return render_texture(p['id'], ['#0F172A', '#F59E0B'], 1, 64, 36).size\n"
        "with ThreadPoolExecutor(8) as pool:\n"
        "    print(list(pool.map(one, TEXTURE_PRESETS * 2)))\n"
    )
    for _ in range(3):  # a race: try a few cold starts
        result = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,  # checked below, with stderr in the failure message
        )
        assert result.returncode == 0, result.stderr[-2000:]


def test_unknown_preset_is_rejected() -> None:
    with pytest.raises(ValueError):
        render_texture("nope", ["#000000", "#FFFFFF"], seed=1, width=16, height=9)


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_textures_endpoint_lists_presets(client: TestClient) -> None:
    res = client.get("/textures")
    assert res.status_code == 200
    assert [p["id"] for p in res.json()["textures"]] == [
        p["id"] for p in TEXTURE_PRESETS
    ]


def test_texture_endpoint_rejects_bad_input(client: TestClient) -> None:
    bad_preset = client.post(
        "/texture", json={"preset": "nope", "colors": ["#000000", "#ffffff"]}
    )
    bad_colour = client.post(
        "/texture", json={"preset": "smoke", "colors": ["red", "#ffffff"]}
    )
    too_big = client.post(
        "/texture",
        json={"preset": "smoke", "colors": ["#000000", "#ffffff"], "width": 8000},
    )

    assert bad_preset.status_code == 400
    assert bad_colour.status_code == 400
    assert too_big.status_code == 422


@requires_core_image
def test_texture_endpoint_returns_a_jpeg_data_url(client: TestClient) -> None:
    res = client.post(
        "/texture",
        json={
            "preset": "grain",
            "colors": ["#111111", "#eeeeee"],
            "seed": 3,
            "width": 64,
            "height": 36,
        },
    )

    assert res.status_code == 200
    assert res.json()["image"].startswith("data:image/jpeg;base64,")
