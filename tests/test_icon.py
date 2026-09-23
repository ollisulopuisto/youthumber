"""The app icon is drawn by scripts/make_icon.py; the committed files must match it."""

import importlib.util
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _make_icon():
    spec = importlib.util.spec_from_file_location(
        "make_icon", ROOT / "scripts" / "make_icon.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["make_icon"] = module  # dataclasses look their module up here
    spec.loader.exec_module(module)
    return module


def test_committed_svg_is_what_the_script_draws() -> None:
    # Edit the script, not the SVG: run `uv run python scripts/make_icon.py`.
    assert (ROOT / "public" / "icon.svg").read_text() == _make_icon().to_svg()


def test_small_sizes_use_simpler_art() -> None:
    # 16/32 px must still scan: no shadows, a coarse checkerboard, fewer shapes.
    icon = _make_icon()
    small, detailed = icon.shapes(detail=False), icon.shapes(detail=True)

    assert all(s.opacity == 1.0 for s in small)
    assert len(small) < len(detailed)


def test_svg_is_a_square_1024_canvas() -> None:
    root = ET.fromstring(_make_icon().to_svg())

    assert root.tag.endswith("svg")
    assert root.attrib["viewBox"] == "0 0 1024 1024"


def test_the_page_and_the_desktop_app_use_the_icon() -> None:
    assert 'href="/icon.svg"' in (ROOT / "index.html").read_text()
    assert (ROOT / "public" / "favicon.png").is_file()  # dock icon (paths.py)
    build = (ROOT / "scripts" / "build_binaries.py").read_text()
    assert '"--icon"' in build and "YouThumber.icns" in build  # app bundle
    assert (ROOT / "assets" / "YouThumber.icns").is_file()
